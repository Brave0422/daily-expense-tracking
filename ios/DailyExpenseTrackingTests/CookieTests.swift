import XCTest
@testable import DailyExpenseTracking

/// Cookie范围、过期、完整响应解析与环境隔离。
final class CookieTests: XCTestCase {
    /// 业务端点附加在 /api 基础路径后，认证路径不丢失或重复前缀。
    func testAPIBasePathIsPreserved() throws {
        /// 与构建配置一致的 API 基础地址。
        let configuration = AppConfiguration(baseURL: try XCTUnwrap(URL(string: "https://example.com/api")), namespace: "api-prefix-test")
        XCTAssertEqual(try configuration.url("/auth/refresh").absoluteString, "https://example.com/api/auth/refresh")
        XCTAssertEqual(try configuration.url("/tags").path, "/api/tags")
    }

    /// 生产Secure Cookie只在匹配主机路径及有效期内发送。
    func testCookieScopeAndExpiry() throws {
        /// 固定可复现的到期基准。
        let now = Date()
        /// host-only 生产Cookie。
        let cookie = RefreshCookie(name: "refresh_token", value: "test", domain: "example.com", hostOnly: true, path: "/api/auth", expiresAt: now.addingTimeInterval(60), secure: true, httpOnly: true, sameSite: "Lax")
        XCTAssertTrue(cookie.matches(try XCTUnwrap(URL(string: "https://example.com/api/auth/refresh")), now: now))
        // address 是不允许接收该凭证的协议 / 主机 / 路径组合。
        for address in ["http://example.com/api/auth/refresh", "https://evil.example.com/api/auth/refresh", "https://example.com/api/authentication", "https://other.com/api/auth/refresh"] {
            XCTAssertFalse(cookie.matches(try XCTUnwrap(URL(string: address)), now: now))
        }
        XCTAssertFalse(cookie.matches(try XCTUnwrap(URL(string: "https://example.com/api/auth/refresh")), now: now.addingTimeInterval(61)))
    }

    /// Expires包含逗号，不能被简单拆开。
    func testFoundationCookieParsing() throws {
        /// 真实认证端点地址。
        let url = try XCTUnwrap(URL(string: "https://example.com/api/auth/login"))
        /// Cookie头包含Expires逗号以及完整安全属性。
        let response = try XCTUnwrap(HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: ["Set-Cookie": "refresh_token=test; Expires=Wed, 01 Jan 2031 00:00:00 GMT; Path=/api/auth; HttpOnly; Secure; SameSite=Lax"]))
        /// 解析完整快照。
        let cookie = try RefreshCookie.parse(response)
        XCTAssertTrue(cookie.secure)
        XCTAssertTrue(cookie.httpOnly)
        XCTAssertTrue(cookie.hostOnly)
        XCTAssertEqual(cookie.path, "/api/auth")
        /// 删除Cookie不允许恢复成登录成功。
        let deletion = try XCTUnwrap(HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: ["Set-Cookie": "refresh_token=; Max-Age=0; Path=/api/auth; HttpOnly"]))
        XCTAssertThrowsError(try RefreshCookie.parse(deletion))
    }

    /// 多Cookie头中其他Cookie的Domain不能污染refresh_token的host-only属性。
    func testMultipleCookiesAndDomainBoundary() throws {
        /// 真实认证URL。
        let url = try XCTUnwrap(URL(string: "https://example.com/api/auth/login"))
        /// 合并头保留Expires逗号以及另一个Domain Cookie。
        let response = try XCTUnwrap(HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: ["Set-Cookie": "other=x; Domain=example.com; Path=/, refresh_token=test; Expires=Wed, 01 Jan 2031 00:00:00 GMT; Path=/api/auth; HttpOnly; Secure; SameSite=Lax"]))
        /// Foundation解析后保留目标Cookie自身属性。
        let cookie = try RefreshCookie.parse(response)
        XCTAssertTrue(cookie.hostOnly)
        XCTAssertEqual(cookie.sameSite?.lowercased(), "lax")
        /// 显式Domain允许边界子域，但禁止相似后缀攻击。
        let domainCookie = RefreshCookie(name: "refresh_token", value: "test", domain: ".example.com", hostOnly: false, path: "/api/auth", expiresAt: Date().addingTimeInterval(60), secure: true, httpOnly: true, sameSite: "Lax")
        XCTAssertTrue(domainCookie.matches(try XCTUnwrap(URL(string: "https://api.example.com/api/auth/refresh"))))
        XCTAssertFalse(domainCookie.matches(try XCTUnwrap(URL(string: "https://evilexample.com/api/auth/refresh"))))
    }
}
