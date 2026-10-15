import Foundation

/// 业务读写端点，视图不直接处理 URLSession 或 JSON。
struct LedgerRepository: Sendable {
    /// 当前身份 API 解码边界。
    let client: APIClient

    /// 读取分类树；- Parameters: type: 收支；archived: 是否包含历史归档；- Returns: 后端顺序分类树。
    func categories(_ type: TransactionType, archived: Bool = false) async throws -> [Category] {
        /// 只有请求历史选项时发送 includeArchived。
        var query = [URLQueryItem(name: "type", value: type.rawValue)]
        if archived { query.append(URLQueryItem(name: "includeArchived", value: "true")) }
        return try await client.get("/categories/getUserCategories", query: query)
    }

    /// 读取真实可选图标；- Returns: 后端图库键和默认颜色。
    func icons() async throws -> [CategoryIcon] { try await client.get("/categories/getAllIcons") }

    /// 新增或固定层级编辑分类；- Parameters: id: 编辑 ID，nil 新增；type: 方向；parentId: 新增二级父 ID；name: 名称；iconKey: 图标。
    func saveCategory(id: Int64?, type: TransactionType, parentId: Int64?, name: String, iconKey: String) async throws {
        /// 创建与编辑具有不同键，不向编辑端点发送不可变方向和父级。
        struct Create: Encodable {
            /// 收支。
            let type: TransactionType
            /// 父类 ID。
            let parentId: Int64?
            /// 名称。
            let name: String
            /// 图标键。
            let iconKey: String
        }
        /// 固定层级编辑请求。
        struct Update: Encodable {
            /// 真实分类 ID。
            let id: Int64
            /// 新名称。
            let name: String
            /// 新图标键。
            let iconKey: String
        }
        /// 已校验且 trim 的名称。
        let name = try TextRule.required(name)
        guard !iconKey.isEmpty else { throw ValidationError(message: "请选择分类图标") }
        // id为来自服务端的真实业务主键，新增时不存在，不在本地伪造。
        if let id { try await client.write("/categories/update", body: JSONEncoder().encode(Update(id: id, name: name, iconKey: iconKey))) }
        else { try await client.write("/categories/create", body: JSONEncoder().encode(Create(type: type, parentId: parentId, name: name, iconKey: iconKey))) }
    }

    /// 删除即归档分类，不级联删子类；- Parameter id: 真实分类 ID。
    func archiveCategory(_ id: Int64) async throws { try await client.write("/categories/\(id)/archive", method: "DELETE") }

    /// 服务端标签搜索；- Parameters: key: 关键词；archived: 空搜索是否包括归档；- Returns: 标签结果。
    func tags(key: String = "", archived: Bool = false) async throws -> [Tag] {
        /// 空关键词必须使用列表端点。
        let name = try TextRule.optional(key, limit: 50, name: "搜索词")
        // name为当前trim后的名称或Cookie属性名，按所属字段规则处理。
        if let name { return try await client.get("/tags/search", query: [URLQueryItem(name: "key", value: name)]) }
        return try await client.get("/tags", query: archived ? [URLQueryItem(name: "includeArchived", value: "true")] : [])
    }

    /// 只读查重，不创建标签；- Parameter name: 候选名称；- Returns: 已有同名项或 nil。
    func checkTag(_ name: String) async throws -> Tag? {
        try await client.checkTag([URLQueryItem(name: "name", value: TextRule.required(name))])
    }

    /// 管理模式下立即保存标签；- Parameters: id: 编辑 ID，nil 新增；name: 输入名称。
    func saveTag(id: Int64?, name: String) async throws {
        /// 管理标签名称请求。
        struct Body: Encodable {
            /// 校验后的名称。
            let name: String
        }
        /// 精确编码 JSON，写后必须重查不能伪造 ID。
        let body = try JSONEncoder().encode(Body(name: TextRule.required(name)))
        try await client.write(id.map { value in
            // value 是真实编辑标签 ID。
            "/tags/\(value)"
        } ?? "/tags", method: id == nil ? "POST" : "PATCH", body: body)
    }

    /// 管理模式归档标签；- Parameter id: 真实标签 ID。
    func archiveTag(_ id: Int64) async throws { try await client.write("/tags/\(id)/archive", method: "DELETE") }

    /// 日明细真实读取；- Parameters: month: YYYY-MM；filter: 已应用筛选；- Returns: 完整服务端响应。
    func daily(month: String, filter: TransactionFilter) async throws -> DailyResult {
        try await client.get("/transactions/daily", query: [URLQueryItem(name: "month", value: month)] + filter.query(daily: true))
    }

    /// 年内月汇总真实读取；- Parameters: year: 年；filter: 仅支持的筛选；- Returns: 汇总响应。
    func monthly(year: Int, filter: TransactionFilter) async throws -> MonthlyResult {
        try await client.get("/transactions/monthly-summary", query: [URLQueryItem(name: "year", value: String(year))] + filter.query(daily: false))
    }

    /// 流水与标签草稿事务提交；- Parameters: id: 编辑 ID，nil 新增；body: 完整写入模型。
    func saveTransaction(id: Int64?, body: TransactionWrite) async throws {
        try await client.write(id.map { value in
            // value 是编辑快照的真实 ID。
            "/transactions/\(value)"
        } ?? "/transactions", method: id == nil ? "POST" : "PATCH", body: JSONEncoder().encode(body))
    }

    /// 归档流水，由后端决定独占标签归档；- Parameter id: 真实流水 ID。
    func archiveTransaction(_ id: Int64) async throws { try await client.write("/transactions/\(id)/archive", method: "DELETE") }

    /// 排行或占比读取；- Parameters: section: 非趋势板块；query: 该板块独立条件；- Returns: 分类统计。
    func categoryStatistics(_ section: StatisticsSection, query: StatisticsQuery) async throws -> CategoryStatistics {
        try await client.get("/statistics/\(section.path)/\(query.yearly ? "yearly" : "monthly")", query: query.parameters(for: section))
    }

    /// 趋势读取；- Parameter query: 趋势独立条件；- Returns: 完整时间轴。
    func trend(_ query: StatisticsQuery) async throws -> TransactionTrend {
        try await client.get("/statistics/transaction-trend/\(query.yearly ? "yearly" : "monthly")", query: query.parameters(for: .trend))
    }
}
