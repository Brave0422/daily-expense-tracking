import Foundation

/// 传输返回原始数据和响应头，不在底层持久化 Cookie。
struct HTTPResult: Sendable {
    /// 完整响应 JSON。
    let data: Data
    /// 状态码、受信响应 URL 与头。
    let response: HTTPURLResponse
}

/// 可注入传输边界，用于测试并发与故障，不替换正式 API。
protocol HTTPTransport: Sendable {
    /// 执行一次请求；- Parameter request: 可重复使用 body 的请求；- Returns: 原始响应；传输失败抛错。
    func send(_ request: URLRequest) async throws -> HTTPResult
}

/// 拒绝所有重定向，避免认证头被带到其他源，也不自动重发写入。
final class RedirectBlocker: NSObject, URLSessionTaskDelegate {
    /// 拒绝 HTTP 跳转；- Parameters: session: 会话；task: 当前任务；response: 跳转响应；request: 目标请求；completionHandler: 传 nil 拒绝。
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
        // Cookie 与 Bearer 仅发送到最初配置的端点。
        completionHandler(nil)
    }
}

/// 真实 URLSession 传输；ephemeral 且完全关闭自动 Cookie。
struct URLSessionTransport: HTTPTransport {
    /// 当前进程网络会话，无磁盘业务缓存。
    let session: URLSession

    /// 创建正式网络依赖。
    init() {
        /// 临时配置仅在内存缓存，进一步关闭缓存和系统 Cookie 存储。
        let configuration = URLSessionConfiguration.ephemeral
        configuration.httpCookieStorage = nil
        configuration.httpShouldSetCookies = false
        configuration.httpCookieAcceptPolicy = .never
        configuration.urlCache = nil
        configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
        configuration.timeoutIntervalForRequest = 30
        configuration.timeoutIntervalForResource = 45
        session = URLSession(configuration: configuration, delegate: RedirectBlocker(), delegateQueue: nil)
    }

    /// 执行一次网络请求；- Parameter request: 受信请求；- Returns: 数据与 HTTP 响应。
    func send(_ request: URLRequest) async throws -> HTTPResult {
        /// URLSession 返回的完整字节与协议响应。
        let (data, response) = try await session.data(for: request)
        // response为HTTP协议响应，非HTTP内容按无效响应处理。
        guard let response = response as? HTTPURLResponse else { throw APIError.invalidResponse }
        return HTTPResult(data: data, response: response)
    }
}

/// 网络、业务与凭证错误保持可区分。
enum APIError: LocalizedError, Sendable {
    case invalidResponse
    case server(Int, String, Int?)
    case business(String)
    case decoding
    case unauthenticated
    case staleIdentity
    case credential(String)
    case uncertainWrite

    /// 中文错误，不包含密码、Token 或 Cookie。
    var errorDescription: String? {
        switch self {
        case .invalidResponse: return "服务返回无效响应，请稍后重试"
        case .server(_, let message, _), .business(let message), .credential(let message): return message
        case .decoding: return "响应结构与接口约定不符，请检查服务版本"
        case .unauthenticated: return "登录状态已失效，请重新登录"
        case .staleIdentity: return "会话已切换，此操作已取消"
        case .uncertainWrite: return "结果尚未确认，请先返回列表刷新核实，避免重复提交"
        }
    }
    /// 频控等待秒数，nil 表示没有服务端值。
    var retryAfter: Int? {
        if case .server(_, _, let seconds) = self { return seconds }
        return nil
    }

    /// 将 Nest 错误解码成持续可读信息；- Parameter result: 非成功 HTTP 响应；- Returns: 不泄露原始 HTML 的错误。
    static func from(_ result: HTTPResult) -> APIError {
        /// Nest 支持字符串和数组两种 message。
        struct Failure: Decodable {
            /// 错误提示字段。
            let message: String
            /// 服务端频控秒数。
            let retryAfterSeconds: Int?
            /// 已知键名。
            enum CodingKeys: String, CodingKey { case message, retryAfterSeconds }
            /// 解码可变提示形态；- Parameter decoder: JSON 解码器。
            init(from decoder: Decoder) throws {
                /// 当前错误对象容器。
                let container = try decoder.container(keyedBy: CodingKeys.self)
                // Nest校验失败可能返回多条字段提示，保留它们的顺序。
                if let scalar = try? container.decode(String.self, forKey: .message) { message = scalar }
                else { message = try container.decode([String].self, forKey: .message).joined(separator: "\n") }
                retryAfterSeconds = try container.decodeIfPresent(Int.self, forKey: .retryAfterSeconds)
            }
        }
        /// 能识别的后端错误，不打印原始内容。
        let failure = try? JSONDecoder().decode(Failure.self, from: result.data)
        return .server(result.response.statusCode, failure?.message ?? "服务请求失败（\(result.response.statusCode)）", failure?.retryAfterSeconds)
    }
}

/// 通用成功封装，写入允许缺失 data。
struct APIEnvelope<Value: Decodable & Sendable>: Decodable, Sendable {
    /// 后端业务码。
    let code: Int
    /// 后端中文提示。
    let msg: String
    /// 成功标志，不能仅凭 HTTP 200 判断。
    let success: Bool
    /// 业务数据可能缺失或为 null。
    let data: Value?
}

/// void 写入的标记解码类型。
struct EmptyPayload: Decodable, Sendable {}

/// 统一封装解码，查询和 void 写入使用不同路径。
struct APIClient: Sendable {
    /// 当前环境与身份协调器。
    let session: SessionCoordinator

    /// 获取必须存在的业务 data；- Parameters: path: 接口路径；query: 白名单参数；- Returns: 强类型业务对象。
    func get<Value: Decodable & Sendable>(_ path: String, query: [URLQueryItem] = []) async throws -> Value {
        /// 保留外层 data 的可空状态，坏响应不能退化成空数组。
        let envelope: APIEnvelope<Value> = try await envelope(path, query: query)
        // value为当前已校验字段或控件回调值，用于对应字段的状态更新。
        guard let value = envelope.data else { throw APIError.decoding }
        return value
    }

    /// 允许 data=null 的只读查重；- Parameter query: 名称查询项；- Returns: 同名标签或 nil。
    func checkTag(_ query: [URLQueryItem]) async throws -> Tag? {
        /// null 在该端点有明确的“不存在”语义。
        let result: APIEnvelope<Tag> = try await envelope("/tags/check-name", query: query)
        return result.data
    }

    /// 提交不返回实体的写入；- Parameters: path: 路径；method: HTTP 动词；body: 精确编码 JSON；protected: 是否需要身份。
    func write(_ path: String, method: String = "POST", body: Data? = nil, protected: Bool = true) async throws {
        /// 原始数据按 void 封装解码，boolean data 的账户操作由独立方法处理。
        let _: APIEnvelope<EmptyPayload> = try await envelope(path, method: method, body: body, protected: protected)
    }

    /// 账户操作必须得到 true；- Parameters: path: 路径；body: JSON；protected: 是否认证。
    func boolean(_ path: String, body: Data, protected: Bool) async throws {
        /// boolean 成功值不能与空 data 混淆。
        let result: APIEnvelope<Bool> = try await envelope(path, method: "POST", body: body, protected: protected)
        guard result.data == true else { throw APIError.decoding }
    }

    /// 统一执行并校验封装；- Parameters: path: 路径；method: 动词；query: 参数；body: JSON；protected: 身份要求。
    /// - Returns: 成功封装，结构或业务失败时抛错。
    private func envelope<Value: Decodable & Sendable>(_ path: String, method: String = "GET", query: [URLQueryItem] = [],
                                                     body: Data? = nil, protected: Bool = true) async throws -> APIEnvelope<Value> {
        /// Session 负责认证与最多一次重放。
        let data = try await session.request(path, method: method, query: query, body: body, protected: protected)
        do {
            /// DTO 解码不使用散装字典。
            let result = try JSONDecoder().decode(APIEnvelope<Value>.self, from: data)
            guard result.success, result.code == 200 else { throw APIError.business(result.msg) }
            return result
        // error为当前捕获的错误或持续错误提示，用于分类处理和就地反馈。
        } catch let error as APIError { throw error }
        catch { throw APIError.decoding }
    }
}
