import XCTest
@testable import DailyExpenseTracking

/// 可控迟到结果与错误，验证UI读取不只依赖取消。
@MainActor final class QueryStateTests: XCTestCase {
    /// 即使旧任务没有取消，慢成功也不能覆盖新条件结果。
    func testLateSuccessDoesNotReplaceNewQuery() async throws {
        /// 同一个页面读取容器。
        let query = QueryState<String>()
        /// 先发但后到的旧条件任务。
        let old = Task { await query.load(label: "旧月") { try await Task.sleep(for: .milliseconds(60)); return "旧结果" } }
        try await Task.sleep(for: .milliseconds(10))
        await query.load(label: "新月") { "新结果" }
        await old.value
        XCTAssertEqual(query.value, "新结果")
        XCTAssertEqual(query.loadedLabel, "新月")
        XCTAssertNil(query.error)
        XCTAssertFalse(query.loading)
    }

    /// 旧条件的慢失败也不能把新查询标成失败。
    func testLateFailureDoesNotReplaceNewQueryState() async throws {
        /// 当前读取容器。
        let query = QueryState<String>()
        /// 慢失败任务，模拟取消未被传输层及时执行。
        let old = Task { await query.load(label: "旧条件") { try await Task.sleep(for: .milliseconds(60)); throw ValidationError(message: "旧错误") } }
        try await Task.sleep(for: .milliseconds(10))
        await query.load(label: "新条件") { "有效结果" }
        await old.value
        XCTAssertEqual(query.value, "有效结果")
        XCTAssertNil(query.error)
        XCTAssertFalse(query.loading)
    }
}
