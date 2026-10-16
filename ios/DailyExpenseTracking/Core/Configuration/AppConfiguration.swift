import Foundation

/// 当前构建的受信服务环境。
struct AppConfiguration: Sendable {
    /// 包含 /api 统一前缀的接口基础地址。
    let baseURL: URL
    /// 按 Bundle 和完整环境隔离 Keychain 项。
    let credentialNamespace: String

    /// 从构建配置加载；- Parameter bundle: 当前应用 Bundle；- Throws: 地址未配置或 Release 非 HTTPS。
    init(bundle: Bundle = .main) throws {
        // value为当前已校验字段或控件回调值，用于对应字段的状态更新。
        guard let value = bundle.object(forInfoDictionaryKey: "API_BASE_URL") as? String,
              let url = URL(string: value), let scheme = url.scheme?.lowercased(),
              ["https", "http"].contains(scheme), url.host != nil, url.user == nil,
              url.password == nil, url.query == nil, url.fragment == nil, !value.contains("$(") else {
            throw ValidationError(message: "请在 Config 中设置有效的 API_BASE_URL")
        }
        #if !DEBUG
        guard scheme == "https", url.host != "api.example.invalid" else {
            throw ValidationError(message: "Release 必须配置正式 HTTPS 服务地址")
        }
        #endif
        /// 只规范化源，基础路径保持大小写，默认端口与显式默认端口归一。
        var normalized = URLComponents(url: url, resolvingAgainstBaseURL: false)
        normalized?.scheme = scheme
        normalized?.host = url.host?.lowercased()
        if (scheme == "https" && url.port == 443) || (scheme == "http" && url.port == 80) { normalized?.port = nil }
        normalized?.path = url.path == "/" ? "" : url.path.trimmingCharacters(in: CharacterSet(charactersIn: "/")).withLeadingSlash
        if url.path.isEmpty { normalized?.path = "" }
        // canonical为按协议、主机、默认端口和基础路径规范化后的环境地址。
        guard let canonical = normalized?.url else { throw ValidationError(message: "API环境规范化失败") }
        baseURL = canonical
        credentialNamespace = (bundle.bundleIdentifier ?? "DailyExpenseTracking") + ":" + canonical.absoluteString
    }

    /// 测试或显式环境装配；- Parameters: baseURL: 受信根地址；namespace: 隔离命名空间。
    init(baseURL: URL, namespace: String) {
        self.baseURL = baseURL
        credentialNamespace = namespace
    }

    /// 构造受信 URL；- Parameters: path: 后端路径；query: 已按端点白名单生成的查询项。
    /// - Returns: 完整地址，构造失败抛错。
    func url(_ path: String, query: [URLQueryItem] = []) throws -> URL {
        /// 相对路径仅附加到受信基础地址，不能输入另一个源。
        var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false)
        components?.path = baseURL.path.trimmingCharacters(in: CharacterSet(charactersIn: "/")).isEmpty
            ? path : baseURL.path.trimmingCharacters(in: CharacterSet(charactersIn: "/")).withLeadingSlash + path
        components?.queryItems = query.isEmpty ? nil : query
        // url为当前受信请求或规范化配置地址。
        guard let url = components?.url else { throw ValidationError(message: "无法构造服务地址") }
        return url
    }
}

private extension String {
    /// 保留基础路径前导斜杠。
    var withLeadingSlash: String { "/" + self }
}
