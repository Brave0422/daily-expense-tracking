import Foundation
import Observation

/// 流水页拥有两套周期、已应用筛选和折叠状态。
@MainActor @Observable final class TransactionsModel {
    /// 当前是否日明细。
    var dailyMode = true
    /// 当前明细月的第一天。
    var month = LedgerDate(year: LedgerDate.today.year, month: LedgerDate.today.month, day: 1)
    /// 汇总独立年份，首次进入取明细年份。
    var year = LedgerDate.today.year
    /// 是否已经进入过汇总。
    var visitedSummary = false
    /// 日明细已应用条件。
    var dailyFilter = TransactionFilter()
    /// 汇总已应用条件。
    var monthlyFilter = TransactionFilter()
    /// 日明细读取状态。
    var daily = QueryState<DailyResult>()
    /// 月汇总读取状态。
    var monthly = QueryState<MonthlyResult>()
    /// 当前周期折叠日。
    var collapsedDays: Set<String> = []
    /// 展开月份。
    var expandedMonths: Set<Int> = []
    /// 只在首次载入一个年度时默认展开首月，用户全部收起后刷新不重新展开。
    private var initializedSummaryPeriod: String?
    /// 写入状态，禁止重复删除。
    var deleting = false
    /// 写入与保存后的提示。
    var notice: String?
    /// 删除等操作错误。
    var error: String?
    /// 当前模式的已应用筛选。
    var filter: TransactionFilter { dailyMode ? dailyFilter : monthlyFilter }
    /// 可见周期。
    var periodTitle: String { dailyMode ? "\(month.year)年\(month.month)月" : "\(year)年" }
    /// 条件变化使 SwiftUI 取消上次读取。
    var queryKey: String {
        /// 已按契约编码的参数，含类型和重复键。
        let parameters = (try? filter.query(daily: dailyMode)) ?? []
        return "\(dailyMode)-\(month.monthKey)-\(year)-" + parameters.map { item in
            // item 是完整有效查询项，用于检测查询快照变化。
            item.name + "=" + (item.value ?? "")
        }.joined(separator: "&")
    }

    /// 读取当前模式；- Parameter repository: 当前身份仓库。
    func load(_ repository: LedgerRepository) async {
        if dailyMode {
            /// 读取期间条件值不再变化。
            let period = month.monthKey
            /// 当前日筛选快照。
            let filter = dailyFilter
            await daily.load(label: periodTitle + " · " + filter.summary) { try await repository.daily(month: period, filter: filter) }
        } else {
            /// 当前汇总年和筛选快照。
            let year = self.year
            /// 汇总不含日专用参数。
            let filter = monthlyFilter
            await monthly.load(label: periodTitle + " · " + filter.summary) { try await repository.monthly(year: year, filter: filter) }
            if monthly.error == nil, let result = monthly.value, initializedSummaryPeriod != result.period {
                initializedSummaryPeriod = result.period
                // first为服务端首个有记录月份；空结果不补造月份。
                if let first = result.months.first { expandedMonths = [first.month] }
                else { expandedMonths = [] }
            }
        }
    }

    /// 切换模式首次继承年；- Parameter daily: 目标是否日明细。
    func switchMode(_ daily: Bool) {
        dailyMode = daily
        if !daily, !visitedSummary { year = month.year; visitedSummary = true }
    }

    /// 前后周期；- Parameter offset: -1 或 1。
    func move(_ offset: Int) {
        if dailyMode {
            guard let date = LedgerDate.calendar.date(byAdding: .month, value: offset, to: month.pickerDate) else { return }
            /// 新周期必须在后端有效日期范围内。
            let candidate = LedgerDate(picker: date)
            guard (1000...9999).contains(candidate.year) else { return }
            month = candidate
            collapsedDays = []
        } else { year = min(9999, max(1000, year + offset)); expandedMonths = [] }
    }

    /// 从汇总钻入明确覆盖日筛选；- Parameter month: 数值自然月。
    func openMonth(_ month: Int) {
        self.month = LedgerDate(year: year, month: month, day: 1)
        dailyFilter = monthlyFilter
        dailyFilter.title = ""
        dailyFilter.remark = ""
        dailyFilter.tagIds = []
        dailyMode = true
        notice = "已按汇总条件查看本月明细"
    }

    /// 归档当前流水；- Parameters: transaction: 快照；app: 当前依赖；- Returns: 是否写成功。
    func archive(_ transaction: Transaction, app: AppModel) async -> Bool {
        guard !deleting else { return false }
        deleting = true
        defer { deleting = false }
        do {
            try await app.repository.archiveTransaction(transaction.id)
            app.changed()
            notice = "流水已删除"
            return true
        } catch { self.error = error.localizedDescription; return false }
    }
}
