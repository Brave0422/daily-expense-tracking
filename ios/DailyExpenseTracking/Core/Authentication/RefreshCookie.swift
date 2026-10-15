import Foundation

/// 完整 Cookie 快照；不把裸 Refresh Token 发送到任意地址。
struct RefreshCookie: Codable, Sendable, Equatable {
    /// Cookie 名称，固定 refresh_token。
    let name: String
    /// 敏感 Cookie 值，仅存 Keychain 和内存。
    let value: String
    /// 服务端返回的规范化域。
    let domain: String
    /// 无 Domain 时只允许原始主机。
    let hostOnly: Bool
    /// Cookie 的路径范围。
    let path: String
    /// Max-Age 或 Expires 推导的时间点。
    let expiresAt: Date
    /// Secure 限制。
    let secure: Bool
    /// HttpOnly 属性快照。
    let httpOnly: Bool
    /// SameSite 原始语义，原生仍额外验证主机和路径。
    let sameSite: String?

    /// 检查发送范围；- Parameters: url: 目标地址；now: 校验时间；- Returns: 该地址是否可以接收凭证。
    func matches(_ url: URL, now: Date = Date()) -> Bool {
        guard let host = url.host?.lowercased(), expiresAt > now, !secure || url.scheme == "https" else { return false }
        /// 仅去除 Domain 前导点，不做不安全的子串匹配。
        let normalized = domain.trimmingCharacters(in: CharacterSet(charactersIn: ".")).lowercased()
        /// Domain Cookie 必须位于完整域边界。
        let domainMatches = hostOnly ? host == normalized : (host == normalized || host.hasSuffix("." + normalized))
        return domainMatches && (url.path == path || url.path.hasPrefix(path.hasSuffix("/") ? path : path + "/"))
    }

    /// 请求头值只在通过范围检查后生成；- Parameter url: 目标地址；- Returns: Cookie 头或 nil。
    func header(for url: URL) -> String? { matches(url) ? "\(name)=\(value)" : nil }

    /// Foundation 解析 Set-Cookie，保留 Expires 的逗号；- Parameters: response: 登录或刷新响应；now: 到期推导基准。
    /// - Returns: 有效 refresh Cookie；删除或非法范围抛错。
    static func parse(_ response: HTTPURLResponse, now: Date = Date()) throws -> RefreshCookie {
        guard let url = response.url else { throw APIError.invalidResponse }
        /// 合并后的原始头通过 Foundation 解析，不手工按逗号拆分。
        var headers: [String: String] = [:]
        // key 是头名称，value 是头值；Foundation 已对同名头进行协议层合并。
        for (key, value) in response.allHeaderFields { headers[String(describing: key)] = String(describing: value) }
        /// 系统 Cookie 解析结果，只取协议约定的 refresh_token。
        let cookies = HTTPCookie.cookies(withResponseHeaderFields: headers, for: url)
        guard let cookie = cookies.last(where: { item in
            // item 是当前解析 Cookie，其他 Cookie 不进入凭证层。
            item.name == "refresh_token"
        }), !cookie.value.isEmpty else { throw APIError.credential("响应未提供有效的安全会话 Cookie") }
        /// 原始头用于补充 Foundation 未暴露的 host-only 与 SameSite。
        let combined = headers.first { key, _ in
            // key 是 HTTP 头名称，大小写不敏感。
            key.lowercased() == "set-cookie"
        }?.value ?? ""
        /// 仅识别“逗号后紧随新Cookie名=”的边界；Expires逗号不会匹配。
        /// Cookie实际解析仍由Foundation完成，这里只提取目标Cookie的附加属性。
        let separator = try NSRegularExpression(pattern: #",(?=\s*[!#$%&'*+.^_`|~0-9A-Za-z-]+\s*=)"#)
        /// 不同Cookie头的安全元数据片段，避免其他Cookie的Domain污染host-only判断。
        let blocks = separator.stringByReplacingMatches(in: combined, range: NSRange(combined.startIndex..., in: combined), withTemplate: "\n").split(separator: "\n")
        /// 目标Cookie原始片段，最后一个覆盖相同Cookie。
        let raw = blocks.last { block in
            // block 是保留Expires完整文本的头片段。
            block.trimmingCharacters(in: .whitespaces).hasPrefix("refresh_token=")
        }.map(String.init) ?? combined
        /// 保留目标Cookie的可识别属性值。
        var attributes: [String: String] = [:]
        // attribute是单个分号属性，Expires的逗号不会破坏属性值。
        for attribute in raw.split(separator: ";").dropFirst() {
            /// 第一个等号分开属性名和值；未知属性也保留只读识别边界。
            let parts = attribute.split(separator: "=", maxSplits: 1).map { part in
                // part为属性名称或其完整值。
                part.trimmingCharacters(in: .whitespaces)
            }
            // name为当前Cookie属性名称，规范为小写后识别Domain、Max-Age和SameSite。
            if let name = parts.first { attributes[name.lowercased()] = parts.count > 1 ? parts[1] : "" }
        }
        /// Cookie 到期时间；Max-Age 优先于 Expires。
        let expiry: Date
        // maxAge为目标Cookie的Max-Age文本，seconds是其秒数；优先于Expires推导到期时间。
        if let maxAge = attributes["max-age"], let seconds = Double(maxAge) {
            expiry = now.addingTimeInterval(seconds)
        // date是Foundation解析的Cookie到期时间点，与流水自然日没有关联。
        } else if let date = cookie.expiresDate { expiry = date }
        else { throw APIError.credential("会话 Cookie 缺少有效期") }
        /// 完整范围快照，登录刷新之后必须先保存才能进入业务。
        let snapshot = RefreshCookie(name: cookie.name, value: cookie.value, domain: cookie.domain,
                                     hostOnly: attributes["domain"] == nil,
                                     path: cookie.path, expiresAt: expiry, secure: cookie.isSecure,
                                     httpOnly: cookie.isHTTPOnly, sameSite: attributes["samesite"])
        guard snapshot.matches(url, now: now), snapshot.httpOnly, snapshot.path == "/auth" else {
            throw APIError.credential("会话 Cookie 范围或有效期不符合服务约定")
        }
        return snapshot
    }
}
