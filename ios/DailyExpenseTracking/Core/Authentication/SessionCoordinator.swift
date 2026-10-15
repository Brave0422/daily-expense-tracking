import Foundation

/// 会话路由状态；恢复失败和存储失败不能当成无凭证。
enum SessionPhase: Equatable, Sendable {
    case restoring, signedOut, authenticated, signingOut
    case recoveryFailed(String), credentialFailed(String)
}

/// 身份、刷新和 Keychain 写入的唯一串行协调点。
actor SessionCoordinator {
    /// 当前受信环境。
    private let configuration: AppConfiguration
    /// 可注入的真实传输。
    private let transport: any HTTPTransport
    /// 当前环境安全存储。
    private let store: any CredentialStore
    /// 仅存在内存的短期 Token。
    private var accessToken: String?
    /// 当前身份的完整 Cookie。
    private var cookie: RefreshCookie?
    /// 递增身份代次，禁止旧响应进入新身份。
    private var generation = 0
    /// 当前身份共享的刷新任务，单个读取取消不能取消它。
    private var flight: RefreshFlight?
    /// 当前对外状态。
    private var phase: SessionPhase = .restoring
    /// 唯一 UI 订阅者的状态流。
    private var continuation: AsyncStream<SessionPhase>.Continuation?

    /// 刷新只计算候选结果，不在脱离 actor 的任务里写 Keychain。
    private struct RefreshResult: Sendable {
        /// 新 Access Token。
        let token: String
        /// 待串行保存的新 Cookie。
        let cookie: RefreshCookie
    }
    /// 同一身份共享的刷新操作。
    private struct RefreshFlight: Sendable {
        /// 任务标识用于防止多个等待者重复保存旧结果。
        let id: UUID
        /// 网络刷新任务。
        let task: Task<RefreshResult, Error>
    }
    /// 登录 / 刷新响应。
    private struct TokenPayload: Decodable, Sendable {
        /// 内存短期 Token。
        let accessToken: String
    }

    /// 装配会话；- Parameters: configuration: 环境；transport: 网络；store: 安全存储。
    init(configuration: AppConfiguration, transport: any HTTPTransport, store: any CredentialStore) {
        self.configuration = configuration
        self.transport = transport
        self.store = store
    }

    /// 获取状态流；- Returns: 初始状态及后续路由变化。
    func states() -> AsyncStream<SessionPhase> {
        AsyncStream { continuation in
            // continuation 是当前 UI 接收器，先推送当前状态防止闪现业务。
            self.continuation = continuation
            continuation.yield(phase)
        }
    }

    /// 更新路由；- Parameter value: 新阶段；立即阻断失效身份的业务画面。
    private func publish(_ value: SessionPhase) {
        phase = value
        continuation?.yield(value)
    }

    /// 恢复当前环境会话；存储故障和临时网络错误均保留可重试状态。
    func restore() async {
        guard phase != .authenticated, phase != .signingOut else { return }
        publish(.restoring)
        do {
            cookie = try store.read()
            // cookie为当前完整刷新Cookie，使用前仍须校验范围和有效期。
            guard let cookie, cookie.matches(try configuration.url("/auth/refresh")) else {
                try clearIdentity()
                return
            }
            _ = try await refresh(expectedGeneration: generation)
            publish(.authenticated)
        } catch APIError.staleIdentity { return }
        catch APIError.unauthenticated { return }
        // error为当前捕获的错误或持续错误提示，用于分类处理和就地反馈。
        catch let error as APIError {
            if case .credential = error { publish(.credentialFailed(error.localizedDescription)) }
            else { publish(.recoveryFailed(error.localizedDescription)) }
        } catch { publish(.recoveryFailed("暂时无法恢复会话，请检查网络后重试")) }
    }

    /// 用户主动清理损坏凭证，成功后回登录；失败仍阻断业务。
    func discardCredentials() {
        do { try clearIdentity() }
        catch { publish(.credentialFailed(error.localizedDescription)) }
    }

    /// 登录并等待 Cookie 保存；- Parameters: email: 规范邮箱；password: 原始密码。
    func login(email: String, password: String) async throws {
        // 新登录使先前恢复或登录响应全部过期。
        generation += 1
        /// 本次登录身份代次。
        let expected = generation
        flight?.task.cancel()
        flight = nil
        accessToken = nil
        /// 登录 JSON，不包含虚构 refreshToken 字段。
        let body = try JSONEncoder().encode(LoginBody(email: email, password: password))
        /// 真实登录响应。
        let response = try await checkedPerform("/auth/login", method: "POST", body: body, expected: expected)
        guard generation == expected else { throw APIError.staleIdentity }
        /// 验证封装和完整 Cookie，随后在 actor 内原子保存。
        let result = try Self.decodeToken(response)
        do { try store.save(result.cookie) }
        catch {
            publish(.credentialFailed(error.localizedDescription))
            throw error
        }
        cookie = result.cookie
        accessToken = result.token
        publish(.authenticated)
    }

    /// 统一请求，最多一次认证重放；- Parameters: path: 路径；method: 动词；query: 参数；body: 可重用 JSON；protected: 认证要求。
    /// - Returns: 已确认身份代次的原始成功 JSON；不自动重试未知结果的写入。
    func request(_ path: String, method: String, query: [URLQueryItem], body: Data?, protected: Bool) async throws -> Data {
        guard phase != .signingOut else { throw APIError.staleIdentity }
        /// 原请求身份代次。
        let expected = generation
        /// 发送时 Token 用于发现其他请求已经完成刷新。
        let sentToken = accessToken
        if protected, phase != .authenticated { throw APIError.unauthenticated }
        /// 首次响应，普通传输错误不会自动补写。
        var result = try await checkedPerform(path, method: method, query: query, body: body, token: protected ? sentToken : nil, expected: expected)
        guard expected == generation, phase != .signingOut else { throw APIError.staleIdentity }
        if protected, result.response.statusCode == 401 {
            /// 已有新 Token 时直接复用，否则共享一次刷新。
            let token: String
            // current为当前已持有的Token、任务或详情快照，用于与发送时状态比较。
            if let current = accessToken, current != sentToken { token = current }
            else { token = try await refresh(expectedGeneration: expected) }
            guard expected == generation, phase != .signingOut else { throw APIError.staleIdentity }
            result = try await checkedPerform(path, method: method, query: query, body: body, token: token, expected: expected)
            guard expected == generation else { throw APIError.staleIdentity }
            if result.response.statusCode == 401 {
                try clearIdentity()
                throw APIError.unauthenticated
            }
        }
        guard (200..<300).contains(result.response.statusCode) else { throw APIError.from(result) }
        return result.data
    }

    /// 协调在途刷新后退出；服务端失败保持当前身份并提示，不伪称已撤销。
    func logout() async throws {
        guard phase == .authenticated else { throw APIError.unauthenticated }
        /// 退出操作所属代次。
        let expected = generation
        publish(.signingOut)
        do {
            // 只等待已在途刷新；退出中不让业务启动竞争刷新。
            if flight != nil { _ = try await refresh(expectedGeneration: expected) }
            /// 首次退出结果。
            var result = try await perform("/auth/logout", method: "POST", token: accessToken)
            guard generation == expected else { throw APIError.staleIdentity }
            if result.response.statusCode == 401 {
                // 退出专用协调刷新，保证过期 Access Token 仍能撤销当前会话。
                _ = try await refresh(expectedGeneration: expected)
                result = try await perform("/auth/logout", method: "POST", token: accessToken)
            }
            guard generation == expected else { throw APIError.staleIdentity }
            guard (200..<300).contains(result.response.statusCode) else { throw APIError.from(result) }
            /// 后端 void 成功封装也必须成功。
            let envelope = try JSONDecoder().decode(APIEnvelope<EmptyPayload>.self, from: result.data)
            guard envelope.success else { throw APIError.business(envelope.msg) }
            try clearIdentity()
        } catch {
            // 本地清理失败已进入阻断状态，不重新开放旧业务。
            if generation == expected { publish(.authenticated) }
            throw error
        }
    }

    /// 等待共享刷新并串行提交；- Parameter expectedGeneration: 发起请求身份代次；- Returns: 最新 Token。
    private func refresh(expectedGeneration: Int) async throws -> String {
        guard expectedGeneration == generation else { throw APIError.staleIdentity }
        if flight == nil {
            /// 受信刷新地址。
            let url = try configuration.url("/auth/refresh")
            // cookie为当前完整刷新Cookie，使用前仍须校验范围和有效期。
            guard let cookie, let header = cookie.header(for: url) else {
                try clearIdentity()
                throw APIError.unauthenticated
            }
            /// 不捕获可变身份，只捕获本次网络请求所需值。
            let transport = self.transport
            flight = RefreshFlight(id: UUID(), task: Task {
                // 独立共享任务不随某个页面取消；结果不能自行写 Keychain。
                var request = URLRequest(url: url)
                request.httpMethod = "POST"
                request.setValue(header, forHTTPHeaderField: "Cookie")
                request.setValue("application/json", forHTTPHeaderField: "Content-Type")
                /// 轮换响应，仅返回候选凭证。
                let result = try await transport.send(request)
                if result.response.statusCode == 401 { throw APIError.unauthenticated }
                guard (200..<300).contains(result.response.statusCode) else { throw APIError.from(result) }
                return try Self.decodeToken(result)
            })
        }
        // current为当前已持有的Token、任务或详情快照，用于与发送时状态比较。
        guard let current = flight else { throw APIError.unauthenticated }
        do {
            /// 多个调用者等待相同任务。
            let result = try await current.task.value
            guard generation == expectedGeneration else { throw APIError.staleIdentity }
            if flight?.id == current.id {
                // 在同一 actor 临界区校验代次并保存，迟到响应不能覆盖下一身份。
                do { try store.save(result.cookie) }
                catch {
                    generation += 1
                    accessToken = nil
                    cookie = nil
                    flight = nil
                    publish(.credentialFailed(error.localizedDescription))
                    throw error
                }
                cookie = result.cookie
                accessToken = result.token
                flight = nil
            }
            // token为仅在内存使用的Access Token，不能写入普通持久化存储。
            guard let token = accessToken else { throw APIError.unauthenticated }
            return token
        } catch {
            // 不仅迟到成功，旧身份的网络错误也必须被替换为无副作用的过期结果。
            guard generation == expectedGeneration else { throw APIError.staleIdentity }
            if generation == expectedGeneration, flight?.id == current.id {
                flight = nil
                if case APIError.unauthenticated = error { try clearIdentity() }
                else if case APIError.credential = error {
                    // 服务端轮换后的Cookie无效也必须阻断，不能继续使用旧凭证假装可恢复。
                    generation += 1
                    accessToken = nil
                    cookie = nil
                    publish(.credentialFailed(error.localizedDescription))
                }
            }
            throw error
        }
    }

    /// 在成功和失败两条返回路径校验身份；- Parameters: path: 路径；method: 动词；query: 白名单参数；body: JSON；token: 内存Bearer；expected: 发送时代次。
    /// - Returns: 属于当前身份的响应，旧成功和旧错误均抛staleIdentity，不回写下一账号。
    private func checkedPerform(_ path: String, method: String, query: [URLQueryItem] = [], body: Data? = nil,
                                token: String? = nil, expected: Int) async throws -> HTTPResult {
        do {
            /// 尚未经过身份接收校验的网络响应。
            let result = try await perform(path, method: method, query: query, body: body, token: token)
            guard generation == expected else { throw APIError.staleIdentity }
            return result
        } catch {
            // 取消并不能保证传输层及时停止，所以错误也验证同一个发送代次。
            guard generation == expected else { throw APIError.staleIdentity }
            throw error
        }
    }

    /// 清理内存并原子删除当前环境凭证；失败发布存储故障，不能恢复旧身份。
    private func clearIdentity() throws {
        generation += 1
        flight?.task.cancel()
        flight = nil
        accessToken = nil
        cookie = nil
        do { try store.clear(); publish(.signedOut) }
        catch { publish(.credentialFailed(error.localizedDescription)); throw error }
    }

    /// 执行一次传输；- Parameters: path: 路径；method: 动词；query: 参数；body: JSON；token: 可选 Bearer。
    /// - Returns: 原始响应，未知结果写入错误单独反馈。
    private func perform(_ path: String, method: String, query: [URLQueryItem] = [], body: Data? = nil, token: String? = nil) async throws -> HTTPResult {
        /// Cookie 不自动发送，refresh 之外仅使用 Bearer。
        var request = URLRequest(url: try configuration.url(path, query: query))
        request.httpMethod = method
        request.httpBody = body
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        // token为仅在内存使用的Access Token，不能写入普通持久化存储。
        if let token { request.setValue("Bearer " + token, forHTTPHeaderField: "Authorization") }
        do { return try await transport.send(request) }
        catch is CancellationError { throw CancellationError() }
        // error为当前捕获的错误或持续错误提示，用于分类处理和就地反馈。
        catch let error as URLError where error.code == .cancelled { throw CancellationError() }
        catch let error as URLError {
            // 连接中断和超时的写入可能已落库，不自动重复提交。
            if method != "GET", !path.hasPrefix("/auth"), path != "/verification-codes/send", [.timedOut, .networkConnectionLost].contains(error.code) { throw APIError.uncertainWrite }
            throw error
        }
    }

    /// 验证登录 / 刷新封装；- Parameter result: 成功 HTTP 候选响应；- Returns: Token 和完整 Cookie。
    private static func decodeToken(_ result: HTTPResult) throws -> RefreshResult {
        guard (200..<300).contains(result.response.statusCode) else { throw APIError.from(result) }
        /// 成功也要求明确非空 Token 和 Cookie。
        let envelope = try JSONDecoder().decode(APIEnvelope<TokenPayload>.self, from: result.data)
        guard envelope.success, envelope.code == 200, let token = envelope.data?.accessToken, !token.isEmpty else { throw APIError.decoding }
        return RefreshResult(token: token, cookie: try RefreshCookie.parse(result.response))
    }
}

/// 登录请求不持久化密码。
struct LoginBody: Encodable, Sendable {
    /// 规范化邮箱。
    let email: String
    /// 原始未 trim 密码。
    let password: String
}
