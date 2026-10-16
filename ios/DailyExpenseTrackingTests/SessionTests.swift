import XCTest
@testable import DailyExpenseTracking

/// 同步 CredentialStore 测试替身；所有可变值均由同一 NSLock 保护。
/// @unchecked 仅限该锁保护的测试适配器，正式凭证不绕过并发检查。
final class MemoryCredentialStore: CredentialStore, @unchecked Sendable {
    /// 保护凭证与模拟故障。
    private let lock = NSLock()
    /// 当前快照。
    private var cookie: RefreshCookie?
    /// 下一次保存是否模拟故障。
    private var failsSave = false
    /// 删除是否模拟故障。
    private var failsClear = false

    /// 读取锁保护快照。
    func read() throws -> RefreshCookie? { lock.lock(); defer { lock.unlock() }; return cookie }
    /// 保存锁保护快照；- Parameter cookie: 完整凭证。
    func save(_ cookie: RefreshCookie) throws {
        lock.lock(); defer { lock.unlock() }
        if failsSave { throw APIError.credential("测试：保存失败") }
        self.cookie = cookie
    }
    /// 删除锁保护快照，模拟故障必须保留旧项。
    func clear() throws {
        lock.lock(); defer { lock.unlock() }
        if failsClear { throw APIError.credential("测试：清理失败") }
        cookie = nil
    }
    /// 修改故障开关；- Parameters: save: 保存失败；clear: 删除失败。
    func fail(save: Bool = false, clear: Bool = false) {
        lock.lock(); defer { lock.unlock() }
        failsSave = save
        failsClear = clear
    }
}

/// 不触达真实服务的可控并发端点。
actor ScenarioTransport: HTTPTransport {
    /// 可复现的服务端场景。
    enum Scenario: Sendable { case normal, refresh503, refresh401, replay401, slowLogin }
    /// 当前测试场景。
    let scenario: Scenario
    /// 每个路径请求次数，不包含凭证日志。
    private var counts: [String: Int] = [:]

    /// 创建场景；- Parameter scenario: 测试行为。
    init(_ scenario: Scenario = .normal) { self.scenario = scenario }
    /// 读取请求次数；- Parameter path: 接口路径；- Returns: 次数。
    func count(_ path: String) -> Int { counts[path, default: 0] }

    /// 模拟一次传输；- Parameter request: 请求；- Returns: 可控响应或取消。
    func send(_ request: URLRequest) async throws -> HTTPResult {
        /// 当前目标 URL。
        let url = try XCTUnwrap(request.url)
        /// 当前接口路径。
        let path = url.path
        counts[path, default: 0] += 1
        if path == "/api/auth/login" {
            if scenario == .slowLogin {
                try await Task.sleep(for: .milliseconds(String(data: request.httpBody ?? Data(), encoding: .utf8)?.contains("slow") == true ? 120 : 5))
            }
            return try response(url, token: "access-1")
        }
        if path == "/api/auth/refresh" {
            // 留出多个业务请求共享等待窗口。
            try await Task.sleep(for: .milliseconds(30))
            if scenario == .refresh503 { return try response(url, status: 503, json: #"{"message":"暂时不可用"}"#) }
            if scenario == .refresh401 { return try response(url, status: 401, json: #"{"message":"已失效"}"#) }
            return try response(url, token: "access-2")
        }
        if path == "/api/tags", request.value(forHTTPHeaderField: "Authorization") == "Bearer access-1" || scenario == .replay401 {
            return try response(url, status: 401, json: #"{"message":"过期"}"#)
        }
        if path == "/api/auth/logout" { return try response(url, json: #"{"code":200,"success":true,"msg":"成功"}"#) }
        return try response(url, json: #"{"code":200,"success":true,"msg":"成功","data":[]}"#)
    }

    /// 构造完整 HTTP 测试响应；- Parameters: url: 地址；status: HTTP 码；json: 业务 JSON；token: 可选 Token。
    /// - Returns: 响应和 Cookie，不向日志输出敏感数据。
    private func response(_ url: URL, status: Int = 200, json: String = "", token: String? = nil) throws -> HTTPResult {
        /// 仅登录和刷新返回带路径、到期、HttpOnly 的 Cookie。
        let headers = token == nil ? [:] : ["Set-Cookie": "refresh_token=test-cookie; Max-Age=3600; Path=/api/auth; HttpOnly; SameSite=Lax"]
        /// 测试封装采用真实字段。
        let payload = token.map { value in #"{"code":200,"success":true,"msg":"成功","data":{"accessToken":""# + value + #""}}"# } ?? json
        return HTTPResult(data: Data(payload.utf8), response: try XCTUnwrap(HTTPURLResponse(url: url, statusCode: status, httpVersion: "HTTP/1.1", headerFields: headers)))
    }
}

/// 认证共享刷新、失败分类与迟到身份隔离。
final class SessionTests: XCTestCase {
    /// 创建测试会话；- Parameters: transport: 场景网络；store: 锁保护存储；- Returns: 隔离会话。
    private func session(_ transport: ScenarioTransport, store: MemoryCredentialStore) throws -> SessionCoordinator {
        SessionCoordinator(configuration: AppConfiguration(baseURL: try XCTUnwrap(URL(string: "http://localhost:3000/api")), namespace: "test"), transport: transport, store: store)
    }

    /// 同身份并发401共享一次刷新，全部得到重放结果。
    func testConcurrent401SharesRefresh() async throws {
        /// 可控网络。
        let transport = ScenarioTransport()
        /// 测试安全存储。
        let store = MemoryCredentialStore()
        /// 当前身份。
        let session = try session(transport, store: store)
        try await session.login(email: "test@example.com", password: "123456")
        try await withThrowingTaskGroup(of: Void.self) { group in
            // group 是10个并发业务读取，不直接调用 refresh。
            for _ in 0..<10 {
                group.addTask { _ = try await session.request("/tags", method: "GET", query: [], body: nil, protected: true) }
            }
            try await group.waitForAll()
        }
        /// 刷新计数在 actor 内获取，随后断言。
        let refreshes = await transport.count("/api/auth/refresh")
        XCTAssertEqual(refreshes, 1)
    }

    /// 503保留凭证，401清理凭证。
    func testRefreshFailureDistinguishes503From401() async throws {
        // scenario 是两种具有不同身份语义的失败。
        for scenario in [ScenarioTransport.Scenario.refresh503, .refresh401] {
            /// 隔离测试网络。
            let transport = ScenarioTransport(scenario)
            /// 当前场景存储。
            let store = MemoryCredentialStore()
            /// 当前场景会话。
            let session = try session(transport, store: store)
            try await session.login(email: "test@example.com", password: "123456")
            do { _ = try await session.request("/tags", method: "GET", query: [], body: nil, protected: true); XCTFail("应返回刷新失败") }
            catch { XCTAssertNotNil(error as? APIError) }
            XCTAssertEqual(try store.read() == nil, scenario == .refresh401)
        }
    }

    /// 认证重放仍401时结束，不能无限刷新。
    func testOnlyOneAuthenticationReplay() async throws {
        /// 重放永远401的场景。
        let transport = ScenarioTransport(.replay401)
        /// 安全存储替身。
        let store = MemoryCredentialStore()
        /// 测试会话。
        let session = try session(transport, store: store)
        try await session.login(email: "test@example.com", password: "123456")
        do { _ = try await session.request("/tags", method: "GET", query: [], body: nil, protected: true); XCTFail("应失效") } catch {}
        /// 只允许一次刷新与两次业务发送。
        let refreshes = await transport.count("/api/auth/refresh")
        /// 首次与认证重放次数。
        let requests = await transport.count("/api/tags")
        XCTAssertEqual(refreshes, 1)
        XCTAssertEqual(requests, 2)
        XCTAssertNil(try store.read())
    }

    /// Cookie已轮换但本地保存失败，禁止继续业务。
    func testRotationPersistenceFailureBlocksBusiness() async throws {
        /// 正常网络，故障只在本地存储。
        let transport = ScenarioTransport()
        /// 支持注入故障的存储。
        let store = MemoryCredentialStore()
        /// 测试会话。
        let session = try session(transport, store: store)
        try await session.login(email: "test@example.com", password: "123456")
        store.fail(save: true)
        do { _ = try await session.request("/tags", method: "GET", query: [], body: nil, protected: true); XCTFail("应阻断") } catch {}
        do { _ = try await session.request("/tags", method: "GET", query: [], body: nil, protected: true); XCTFail("不能继续业务") } catch {}
        /// 第二次读取没有发送给服务。
        let requests = await transport.count("/api/tags")
        XCTAssertEqual(requests, 1)
    }

    /// 新登录代次阻止先发后到的旧Cookie保存。
    func testLateLoginCannotOverwriteNewIdentity() async throws {
        /// 首次指定 slow 邮箱以延迟响应。
        let transport = ScenarioTransport(.slowLogin)
        /// 当前环境存储。
        let store = MemoryCredentialStore()
        /// 当前会话。
        let session = try session(transport, store: store)
        /// 旧登录任务，预期被新身份拒绝。
        let old = Task { try await session.login(email: "slow@example.com", password: "123456") }
        try await Task.sleep(for: .milliseconds(15))
        try await session.login(email: "new@example.com", password: "123456")
        do { try await old.value; XCTFail("旧登录不能成功") } catch APIError.staleIdentity {} catch { XCTFail("错误分类不符") }
        XCTAssertNotNil(try store.read())
    }

    /// 服务端退出成功但本地删除失败时，旧Token不能继续发业务。
    func testLogoutCleanupFailureBlocksOldIdentity() async throws {
        /// 正常撤销服务。
        let transport = ScenarioTransport()
        /// 模拟本地删除权限故障。
        let store = MemoryCredentialStore()
        /// 目标会话。
        let session = try session(transport, store: store)
        try await session.login(email: "test@example.com", password: "123456")
        store.fail(clear: true)
        do { try await session.logout(); XCTFail("不能伪报本地退出完成") } catch {}
        do { _ = try await session.request("/tags", method: "GET", query: [], body: nil, protected: true); XCTFail("旧身份必须阻断") } catch {}
        /// 没有发出旧身份业务请求。
        let requests = await transport.count("/api/tags")
        XCTAssertEqual(requests, 0)
        store.fail()
        await session.discardCredentials()
        XCTAssertNil(try store.read())
    }
}
