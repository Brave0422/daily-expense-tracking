import XCTest
@testable import DailyExpenseTracking

/// 精确金额、自然日与端点序列化的边界测试。
final class ContractTests: XCTestCase {
    /// 金额规则不允许偷偷截断小数或清理粘贴符号。
    func testMoneyBoundaries() throws {
        // value 为明确无效的后端输入样本。
        for value in ["0", "0.00", "01", "-1", "1.001", "1e2", "¥1", "1,000", "10000000000000"] {
            XCTAssertThrowsError(try Money.validate(value), value)
        }
        XCTAssertEqual(try Money.validate("9999999999999.99"), "9999999999999.99")
        XCTAssertEqual(try Money.validate("0.01"), "0.01")
        XCTAssertEqual(try Money.validate("0", allowZero: true), "0")
        XCTAssertEqual(Money.display("123456789012345678901234.50"), "123,456,789,012,345,678,901,234.50")
        XCTAssertEqual(Money.display("-1234.5"), "-1,234.50")
    }

    /// 无效日期拒绝、闰日和固定时区桥接往返不跨天。
    func testNaturalDateRoundTrip() throws {
        XCTAssertThrowsError(try LedgerDate("2025-02-29"))
        XCTAssertThrowsError(try LedgerDate("2026-02-30"))
        /// 闰年自然日期，不是 UTC 服务端时间点。
        let leapDay = try LedgerDate("2024-02-29")
        XCTAssertEqual(LedgerDate(picker: leapDay.pickerDate), leapDay)
        /// 跨年上月控件桥接。
        let january = try LedgerDate("2026-01-01")
        /// 固定公历减一月。
        let previous = try XCTUnwrap(LedgerDate.calendar.date(byAdding: .month, value: -1, to: january.pickerDate))
        XCTAssertEqual(LedgerDate(picker: previous).monthKey, "2025-12")
    }

    /// 数组使用重复键，汇总不泄漏日专用字段。
    func testTransactionFilterWhitelist() throws {
        /// 故意同时包含所有类型条件以验证汇总白名单。
        var filter = TransactionFilter()
        filter.categoryIds = [1, 2]
        filter.tagIds = [3, 4]
        filter.title = " 早餐 "
        filter.remark = " 中文备注 "
        /// 日明细参数。
        let daily = try filter.query(daily: true)
        // item为当前统计分类原始项，保留金额和百分比字符串。
        XCTAssertEqual(daily.filter { item in item.name == "categoryIds" }.map(\.value), ["1", "2"])
        // item为当前统计分类原始项，保留金额和百分比字符串。
        XCTAssertEqual(daily.filter { item in item.name == "tagIds" }.map(\.value), ["3", "4"])
        // item为当前统计分类原始项，保留金额和百分比字符串。
        XCTAssertFalse(daily.contains { item in item.name == "type" })
        XCTAssertEqual(try filter.query(daily: false).map(\.name), ["categoryIds", "categoryIds"])
        filter.minAmount = "2"
        filter.maxAmount = "1.99"
        XCTAssertThrowsError(try filter.query(daily: true))
    }

    /// 编辑清空字段必须是 null / []，且无 type。
    func testCompletePatchEncodesNullAndEmptyTags() throws {
        /// 真实 ID 仅在测试样本使用固定值。
        let body = TransactionWrite(type: nil, categoryId: 123, amount: "12.50", occurredDate: "2026-10-15", title: nil, tagIds: [], tagNames: [], tagUpdates: [], remark: nil)
        /// JSONSerialization 只用于检查编码字节，不贯穿业务层。
        let json = try XCTUnwrap(JSONSerialization.jsonObject(with: JSONEncoder().encode(body)) as? [String: Any])
        XCTAssertTrue(json["title"] is NSNull)
        XCTAssertTrue(json["remark"] is NSNull)
        XCTAssertEqual((json["tagIds"] as? [Int])?.count, 0)
        XCTAssertNil(json["type"])
    }

    /// 六端点查询必须按板块白名单构造，收入强制一级并恢复支出层级。
    func testStatisticsParametersAndPeriodMemory() throws {
        /// 独立板块条件。
        var query = StatisticsQuery()
        XCTAssertEqual(query.level, 2)
        query.type = .income
        XCTAssertEqual(query.level, 1)
        query.type = .expense
        XCTAssertEqual(query.level, 2)
        XCTAssertEqual(Set(try query.parameters(for: .ranking).map(\.name)), ["type", "month", "categoryLevel", "order"])
        XCTAssertEqual(Set(try query.parameters(for: .proportion).map(\.name)), ["type", "month", "categoryLevel"])
        XCTAssertEqual(Set(try query.parameters(for: .trend).map(\.name)), ["type", "month"])
        query.year = 2024
        query.month = 2
        query.setYearly(true)
        query.setYearly(false)
        XCTAssertEqual(query.month, 2)
        query.year = 1000
        query.month = 1
        XCTAssertThrowsError(try query.parameters(for: .trend))
    }

    /// 新名称、归档标签和改名只存在草稿，移除同步取消改名。
    func testTagDraftRemovalAndValueIsolation() {
        /// 父表单原快照。
        var original = TagDraft()
        original.selected = [Tag(id: 1, name: "原名", archived: false)]
        /// 子面板值复制，取消时直接丢弃。
        var child = original
        child.names.append("新名称")
        child.updates.append(TagUpdate(id: 1, name: "新名"))
        child.remove(1)
        XCTAssertTrue(child.updates.isEmpty)
        XCTAssertEqual(original.selected.count, 1)
        XCTAssertTrue(original.names.isEmpty)
    }

    /// 码点计数区别于用户可见字素簇，不能直接用 String.count。
    func testUnicodeScalarLength() throws {
        XCTAssertEqual(try TextRule.optional(" 中文 ", limit: 2, name: "名称"), "中文")
        XCTAssertThrowsError(try TextRule.optional(String(repeating: "e\u{301}", count: 26), limit: 50, name: "名称"))
        XCTAssertThrowsError(try TextRule.optional(String(repeating: "👨‍👩‍👧‍👦", count: 8), limit: 50, name: "名称"))
        XCTAssertNoThrow(try TextRule.credentials(password: " 1234 ", code: "001234"))
    }

    /// void 成功无需 data，查询缺失 data 不被映射成空成功。
    func testVoidAndNullableDecoding() throws {
        /// 真实 void 响应形态。
        let raw = Data(#"{"code":200,"success":true,"msg":"成功"}"#.utf8)
        XCTAssertNil(try JSONDecoder().decode(APIEnvelope<EmptyPayload>.self, from: raw).data)
        /// 收入分类没有二级。
        let category = Data(##"{"primary":{"id":1,"name":"工资","iconKey":"icon-income-salary","backgroundColor":"#ffffff","archived":false},"secondary":null}"##.utf8)
        XCTAssertNil(try JSONDecoder().decode(TransactionCategory.self, from: category).secondary)
    }
}
