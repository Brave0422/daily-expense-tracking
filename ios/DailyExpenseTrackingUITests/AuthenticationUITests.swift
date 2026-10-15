import XCTest

/// 使用干净模拟器验证公开页面，不内置账号或伪造已登录身份。
final class AuthenticationUITests: XCTestCase {
    /// 空邮箱提交应本地校验，无需真实后端可达。
    @MainActor func testLoginValidationAndRegistrationNavigation() throws {
        /// 真正启动原生App。
        let app = XCUIApplication()
        app.launch()
        guard app.textFields["auth.email"].waitForExistence(timeout: 8) else {
            throw XCTSkip("需要无既有Keychain会话且已配置API_BASE_URL的模拟器")
        }
        app.buttons["auth.submit"].tap()
        XCTAssertTrue(app.staticTexts["请输入有效邮箱"].waitForExistence(timeout: 2))
        app.buttons["创建账户"].tap()
        XCTAssertTrue(app.buttons["发送验证码"].waitForExistence(timeout: 2))
        app.buttons["取消"].tap()
        XCTAssertTrue(app.textFields["auth.email"].exists)
    }
}
