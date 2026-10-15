import Foundation
import Security

/// 安全存储边界，操作是同步原子的，调用方由 Session actor 串行隔离。
protocol CredentialStore: Sendable {
    /// 读取当前环境 Cookie；- Returns: 无记录返回 nil，存储不可读则抛错。
    func read() throws -> RefreshCookie?
    /// 原子替换完整快照；- Parameter cookie: 通过受信范围校验的轮换 Cookie。
    func save(_ cookie: RefreshCookie) throws
    /// 删除当前环境凭证；无记录也视作成功。
    func clear() throws
}

/// Keychain 仅本机、解锁后可读，不同步到 iCloud。
struct KeychainCredentialStore: CredentialStore {
    /// Bundle 与环境共同组成的 service。
    let namespace: String
    /// 当前环境查询属性；字典仅存在 Security 框架适配边界。
    private var query: [String: Any] {
        [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: namespace,
         kSecAttrAccount as String: "refresh-cookie", kSecAttrSynchronizable as String: false]
    }

    /// 读取完整快照；- Returns: 无凭证 nil，权限或损坏抛错。
    func read() throws -> RefreshCookie? {
        /// 增加读取数据标志，避免返回 Keychain 元数据。
        var attributes = query
        attributes[kSecReturnData as String] = true
        attributes[kSecMatchLimit as String] = kSecMatchLimitOne
        /// Security 输出的单项对象。
        var item: CFTypeRef?
        /// Keychain 真实结果码。
        let status = SecItemCopyMatching(attributes as CFDictionary, &item)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess, let data = item as? Data else { throw APIError.credential("无法读取安全凭证，请解锁设备后重试") }
        do { return try JSONDecoder().decode(RefreshCookie.self, from: data) }
        catch { throw APIError.credential("安全凭证已损坏，请清理后重新登录") }
    }

    /// 串行原子替换；- Parameter cookie: 完整快照；写失败不删除原项并伪报成功。
    func save(_ cookie: RefreshCookie) throws {
        /// 序列化数据不会写入普通文件或日志。
        let data = try JSONEncoder().encode(cookie)
        /// 更新现有记录，Keychain 保证单项替换。
        let status = SecItemUpdate(query as CFDictionary, [kSecValueData as String: data] as CFDictionary)
        if status == errSecItemNotFound {
            /// 首次登录创建受本机解锁保护的记录。
            var attributes = query
            attributes[kSecValueData as String] = data
            attributes[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
            guard SecItemAdd(attributes as CFDictionary, nil) == errSecSuccess else { throw APIError.credential("安全凭证保存失败，请清理后重新登录") }
        } else if status != errSecSuccess { throw APIError.credential("安全凭证轮换保存失败，请清理后重新登录") }
    }

    /// 仅清理该环境；删除失败需要阻断旧身份。
    func clear() throws {
        /// errSecItemNotFound 是已经清理的幂等结果。
        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else { throw APIError.credential("本地凭证清理失败，请解锁设备后重试") }
    }
}
