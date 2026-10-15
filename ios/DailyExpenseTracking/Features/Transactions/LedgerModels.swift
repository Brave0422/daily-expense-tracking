import Foundation

/// 分类树节点；所有业务 ID 均来自后端。
struct Category: Decodable, Identifiable, Hashable, Sendable {
    /// 分类主键。
    let id: Int64
    /// 固定收支方向。
    let type: TransactionType
    /// 一级为 nil，二级指向父类。
    let parentId: Int64?
    /// 分类名称。
    let name: String
    /// 服务端顺序，不在客户端重新排序。
    let sortOrder: Int
    /// 仅 1 或 2。
    let level: Int
    /// 本地资源映射键。
    let iconKey: String
    /// 是否为默认初始化分类。
    let isDefault: Bool
    /// 最终图标背景，二级也直接使用返回值。
    let backgroundColor: String
    /// 兼容有效列表省略 archived。
    let archived: Bool?
    /// 仅一级树节点有子数组。
    let children: [Category]?
}

/// 图库中的可选图案。
struct CategoryIcon: Decodable, Identifiable, Sendable {
    /// 真实图标键。
    let iconKey: String
    /// 图标默认背景，二级编辑由父类覆盖。
    let backgroundColor: String
    /// 网格稳定标识。
    var id: String { iconKey }
}

/// 标签用于历史、有效搜索与本地草稿。
struct Tag: Codable, Identifiable, Hashable, Sendable {
    /// 服务端标签 ID。
    let id: Int64
    /// 显示名称，可在本地改名草稿中改变。
    var name: String
    /// 未返回时按有效处理。
    let archived: Bool?
}

/// 历史关联分类，不要求完整配置字段。
struct CategorySnapshot: Codable, Identifiable, Hashable, Sendable {
    /// 历史关联分类 ID。
    let id: Int64
    /// 返回的分类名称。
    let name: String
    /// 图标键。
    let iconKey: String
    /// 最终背景色。
    let backgroundColor: String
    /// 归档关联仍可显示。
    let archived: Bool
}

/// 流水分类路径，收入 secondary 为 nil。
struct TransactionCategory: Decodable, Hashable, Sendable {
    /// 一级分类快照。
    let primary: CategorySnapshot
    /// 支出二级快照。
    let secondary: CategorySnapshot?
    /// 实际绑定分类。
    var actual: CategorySnapshot { secondary ?? primary }
    /// 可读层级关系。
    var path: String { secondary.map { child in
        // child 是支出二级快照。
        primary.name + " / " + child.name
    } ?? primary.name }
}

/// 当次日明细快照，详情和编辑不得请求不存在的单笔端点。
struct Transaction: Decodable, Identifiable, Sendable {
    /// 流水主键。
    let id: Int64
    /// 固定收支方向。
    let type: TransactionType
    /// 元金额原始文本。
    let amount: String
    /// 空标题为 nil。
    let title: String?
    /// 空备注为 nil。
    let remark: String?
    /// YYYY-MM-DD 自然日期。
    let occurredDate: String
    /// 完整分类路径。
    let category: TransactionCategory
    /// 含可能归档的历史标签。
    let tags: [Tag]
}

/// 完整周期合计，不能由已筛选行重算。
struct PeriodTotals: Decodable, Sendable {
    /// 元单位支出。
    let expense: String
    /// 元单位收入。
    let income: String
    /// 服务端精确结余。
    let balance: String
}

/// 筛选结果独立合计。
struct FilterTotals: Decodable, Sendable {
    /// 已筛选支出元金额。
    let expense: String
    /// 已筛选收入元金额。
    let income: String
}

/// 日分组，保持服务返回顺序。
struct DayGroup: Decodable, Identifiable, Sendable {
    /// 自然日期键。
    let date: String
    /// 当日支出元金额。
    let expenseTotal: String
    /// 当日收入元金额。
    let incomeTotal: String
    /// 当日流水快照。
    let transactions: [Transaction]
    /// 分组标识。
    var id: String { date }
}

/// 日明细响应。
struct DailyResult: Decodable, Sendable {
    /// 已加载 YYYY-MM。
    let period: String
    /// 整月合计。
    let totals: PeriodTotals
    /// 筛选合计。
    let filterTotals: FilterTotals
    /// 日分组。
    let days: [DayGroup]
}

/// 月汇总分类节点，收入和二级无需 children。
struct CategorySummary: Decodable, Identifiable, Sendable {
    /// 分类 ID。
    let id: Int64
    /// 分类名称。
    let name: String
    /// 本地图标键。
    let iconKey: String
    /// 最终背景色。
    let backgroundColor: String
    /// 历史归档标记。
    let archived: Bool
    /// 元金额。
    let amount: String
    /// 支出一级包含二级金额。
    let children: [CategorySummary]?
}

/// 年内有结果月份，不补造服务未返回月份。
struct MonthGroup: Decodable, Identifiable, Sendable {
    /// 1 至 12。
    let month: Int
    /// 当月支出元金额。
    let expenseTotal: String
    /// 当月收入元金额。
    let incomeTotal: String
    /// 支出一级与二级金额树。
    let expenseCategories: [CategorySummary]
    /// 收入一级金额。
    let incomeCategories: [CategorySummary]
    /// 折叠标识。
    var id: Int { month }
}

/// 年度汇总响应。
struct MonthlyResult: Decodable, Sendable {
    /// YYYY。
    let period: String
    /// 全年合计。
    let totals: PeriodTotals
    /// 筛选合计。
    let filterTotals: FilterTotals
    /// 月份结果。
    let months: [MonthGroup]
}

/// 流水筛选草稿与已应用条件通过值复制分离。
struct TransactionFilter: Equatable, Sendable {
    /// nil 表示全部，请求省略 type。
    var type: TransactionType?
    /// 可包含历史归档分类。
    var categoryIds: Set<Int64> = []
    /// 非负元下界，空时省略。
    var minAmount = ""
    /// 非负元上界，空时省略。
    var maxAmount = ""
    /// 仅日明细使用。
    var title = ""
    /// 仅日明细使用，任一匹配。
    var tagIds: Set<Int64> = []
    /// 仅日明细使用。
    var remark = ""
    /// 是否存在筛选条件。
    var isActive: Bool { self != TransactionFilter() }
    /// 已应用条件文字，随读取快照保留，旧金额不会标成新筛选结果。
    var summary: String {
        /// 可并列展示的有效条件。
        var parts = [type?.title ?? "全部收支"]
        if !categoryIds.isEmpty { parts.append("分类\(categoryIds.count)项") }
        if !minAmount.isEmpty || !maxAmount.isEmpty { parts.append("金额\(minAmount.isEmpty ? "不限" : minAmount)–\(maxAmount.isEmpty ? "不限" : maxAmount)元") }
        if !tagIds.isEmpty { parts.append("标签\(tagIds.count)项") }
        if !title.isEmpty { parts.append("标题：" + title) }
        if !remark.isEmpty { parts.append("备注：" + remark) }
        return parts.joined(separator: " · ")
    }

    /// 白名单编码；- Parameter daily: 是否日明细；- Returns: 重复键 ID 参数；非法边界抛错。
    func query(daily: Bool) throws -> [URLQueryItem] {
        /// 每个端点独立构造，汇总绝不携带日专用键。
        var items: [URLQueryItem] = []
        if let type { items.append(URLQueryItem(name: "type", value: type.rawValue)) }
        // id 是已选真实分类；重复键保持数组语义。
        for id in categoryIds.sorted() { items.append(URLQueryItem(name: "categoryIds", value: String(id))) }
        if !minAmount.isEmpty { items.append(URLQueryItem(name: "minAmount", value: try Money.validate(minAmount, allowZero: true))) }
        if !maxAmount.isEmpty { items.append(URLQueryItem(name: "maxAmount", value: try Money.validate(maxAmount, allowZero: true))) }
        // minimum为精确十进制金额下界，单位为元。
        if let minimum = Decimal(string: minAmount, locale: Money.locale), let maximum = Decimal(string: maxAmount, locale: Money.locale), minimum > maximum {
            throw ValidationError(message: "最小金额不能大于最大金额")
        }
        if daily {
            // value为当前已校验字段或控件回调值，用于对应字段的状态更新。
            if let value = try TextRule.optional(title, limit: 50, name: "标题") { items.append(URLQueryItem(name: "title", value: value)) }
            if let value = try TextRule.optional(remark, limit: 100, name: "备注") { items.append(URLQueryItem(name: "remark", value: value)) }
            // id 是已选真实标签，空集合不发送。
            for id in tagIds.sorted() { items.append(URLQueryItem(name: "tagIds", value: String(id))) }
        }
        return items
    }
}

/// 标签改名仅在保存流水时提交。
struct TagUpdate: Encodable, Equatable, Sendable {
    /// 仍被选择的有效标签 ID。
    let id: Int64
    /// 新的 trim 后名称。
    let name: String
}

/// 完整流水写入；PATCH 的空文本必须显式 null。
struct TransactionWrite: Encodable, Sendable {
    /// 新增时传方向，编辑时 nil 并省略。
    let type: TransactionType?
    /// 支出二级或收入一级 ID。
    let categoryId: Int64
    /// 已校验元字符串。
    let amount: String
    /// 自然日期文本。
    let occurredDate: String
    /// 空标题编码 null。
    let title: String?
    /// 完整真实标签集合，清空为 []。
    let tagIds: [Int64]
    /// 尚未落库的新名称。
    let tagNames: [String]
    /// 保留 ID 的全局改名事务草稿。
    let tagUpdates: [TagUpdate]
    /// 空备注编码 null。
    let remark: String?
    /// 写入字段键名。
    enum CodingKeys: String, CodingKey { case type, categoryId, amount, occurredDate, title, tagIds, tagNames, tagUpdates, remark }

    /// 明确区分省略和 null；- Parameter encoder: JSON 编码器。
    func encode(to encoder: Encoder) throws {
        /// 显式编码完整编辑契约。
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encodeIfPresent(type, forKey: .type)
        try container.encode(categoryId, forKey: .categoryId)
        try container.encode(amount, forKey: .amount)
        try container.encode(occurredDate, forKey: .occurredDate)
        try container.encode(title, forKey: .title)
        try container.encode(remark, forKey: .remark)
        try container.encode(tagIds, forKey: .tagIds)
        if !tagNames.isEmpty { try container.encode(tagNames, forKey: .tagNames) }
        if !tagUpdates.isEmpty { try container.encode(tagUpdates, forKey: .tagUpdates) }
    }
}
