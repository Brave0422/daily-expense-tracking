import Foundation

/// 统计三个板块各持有独立条件。
enum StatisticsSection: String, CaseIterable, Identifiable, Sendable {
    case ranking, proportion, trend
    /// 分段标识。
    var id: String { rawValue }
    /// 中文板块名称。
    var title: String { switch self { case .ranking: "排行"; case .proportion: "占比"; case .trend: "趋势" } }
    /// 后端路径段。
    var path: String { switch self { case .ranking: "category-ranking"; case .proportion: "category-proportion"; case .trend: "transaction-trend" } }
}

/// 支出层级记忆与月年切换封装在每个板块的值状态中。
struct StatisticsQuery: Equatable, Sendable {
    /// 默认支出。
    var type: TransactionType = .expense
    /// false 月，true 年。
    var yearly = false
    /// 当前年份。
    var year = LedgerDate.today.year
    /// 当前月份。
    var month = LedgerDate.today.month
    /// 记住各年上次选中的月份。
    var rememberedMonths: [Int: Int] = [:]
    /// 支出默认二级，切收入时请求层强制一级。
    var expenseLevel = 2
    /// 排行默认降序。
    var ascending = false
    /// 当前协议周期。
    var period: String { yearly ? String(format: "%04d", year) : String(format: "%04d-%02d", year, month) }
    /// 可读周期。
    var title: String { yearly ? "\(year)年" : "\(year)年\(month)月" }
    /// 实际层级，收入永远一级。
    var level: Int { type == .income ? 1 : expenseLevel }

    /// 切换粒度并记忆月份；- Parameter value: 是否全年。
    mutating func setYearly(_ value: Bool) {
        if !yearly { rememberedMonths[year] = month }
        yearly = value
        if !value { month = rememberedMonths[year] ?? (year == LedgerDate.today.year ? LedgerDate.today.month : 12) }
    }

    /// 严格按板块白名单编码；- Parameter section: 板块；- Returns: 参数；超出统计边界抛错。
    func parameters(for section: StatisticsSection) throws -> [URLQueryItem] {
        guard yearly ? (1001...9998).contains(year) : ((1000...9999).contains(year) && (1...12).contains(month) && period >= "1000-02" && period <= "9999-11") else {
            throw ValidationError(message: "请选择有效统计周期：月1000-02至9999-11，年1001至9998")
        }
        /// 趋势绝不包含层级或排序，占比绝不包含排序。
        var items = [URLQueryItem(name: "type", value: type.rawValue), URLQueryItem(name: yearly ? "year" : "month", value: period)]
        if section != .trend { items.append(URLQueryItem(name: "categoryLevel", value: String(level))) }
        if section == .ranking { items.append(URLQueryItem(name: "order", value: ascending ? "asc" : "desc")) }
        return items
    }
}

/// 统计二级分类的父级关系。
struct StatisticsParent: Decodable, Sendable {
    /// 父级 ID。
    let categoryId: Int64
    /// 父级名称。
    let name: String
}

/// 排行与饼图原始精确项。
struct StatisticsItem: Decodable, Identifiable, Sendable {
    /// 分类 ID，稳定配色依据。
    let categoryId: Int64
    /// 分类自身名称。
    let name: String
    /// 图标键。
    let iconKey: String
    /// 图标背景色。
    let backgroundColor: String
    /// 二级所属父类。
    let parent: StatisticsParent?
    /// 精确元文本。
    let amount: String
    /// 已由后端舍入的百分比文本，不含 %。
    let percentage: String
    /// 图例标识。
    var id: Int64 { categoryId }
}

/// 分类统计响应。
struct CategoryStatistics: Decodable, Sendable {
    /// 已加载周期。
    let period: String
    /// month 或 year。
    let periodType: String
    /// 收支方向。
    let type: TransactionType
    /// 统计层级。
    let categoryLevel: Int
    /// 笔数。
    let transactionCount: Int
    /// 精确总额。
    let totalAmount: String
    /// 保持服务端顺序。
    let items: [StatisticsItem]
}

/// 完整趋势时间点，零值和未来日期也保留。
struct TrendPoint: Decodable, Identifiable, Sendable {
    /// YYYY-MM-DD 或 YYYY-MM。
    let date: String
    /// 精确元金额。
    let amount: String
    /// 时间轴标识。
    var id: String { date }
}

/// 服务端比较状态，不能从舍入后的比例猜方向。
enum ChangeStatus: String, Decodable, Sendable { case increase, decrease, unchanged, new }

/// 收支趋势响应。
struct TransactionTrend: Decodable, Sendable {
    /// 当前完整周期。
    let period: String
    /// month 或 year。
    let periodType: String
    /// 收支方向。
    let type: TransactionType
    /// 笔数。
    let transactionCount: Int
    /// 本期元总额。
    let totalAmount: String
    /// 上一完整周期。
    let previousPeriod: String
    /// 上期精确元金额。
    let previousTotalAmount: String
    /// nil 表示无可定义比率。
    let changeRate: String?
    /// 比较方向。
    let changeStatus: ChangeStatus
    /// 完整自然日或12个月。
    let series: [TrendPoint]
    /// 直接使用原始状态与比例，新增不伪造 100%。
    var changeTitle: String {
        /// 月年比较文案。
        let comparisonPrefix = periodType == "month" ? "较上月" : "较上年"
        switch changeStatus {
        case .new: return comparisonPrefix + "新增"
        case .unchanged: return comparisonPrefix + "持平 0.00%"
        case .increase: return comparisonPrefix + " ↑ " + (changeRate ?? "0.00").replacingOccurrences(of: "-", with: "") + "%"
        case .decrease: return comparisonPrefix + " ↓ " + (changeRate ?? "0.00").replacingOccurrences(of: "-", with: "") + "%"
        }
    }
}
