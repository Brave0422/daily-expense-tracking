import Foundation
import Observation

/// 标签子面板的事务草稿；完成只回填，保存流水才落库。
struct TagDraft: Equatable, Sendable {
    /// 真实 ID 标签，可保留原归档项。
    var selected: [Tag] = []
    /// 尚未创建的新名称，无伪造业务 ID。
    var names: [String] = []
    /// 全局改名事务项。
    var updates: [TagUpdate] = []

    /// 移除仅解绑，不归档；- Parameter id: 真实标签 ID。
    mutating func remove(_ id: Int64) {
        selected.removeAll { tag in tag.id == id }
        // 删除选择必须同步撤销该 ID 的改名事务。
        updates.removeAll { update in update.id == id }
    }
}

/// 可比较的独立流水输入，不能直接修改列表快照。
struct TransactionDraft: Equatable, Sendable {
    /// 新增可改，编辑锁定。
    var type: TransactionType = .expense
    /// 原始金额输入，空占位不是有效金额。
    var amount = ""
    /// 当前分类快照。
    var category: CategorySnapshot?
    /// 自然发生日期。
    var date = LedgerDate.today
    /// 可选标题原始输入。
    var title = ""
    /// 可选备注原始输入。
    var remark = ""
    /// 标签事务草稿。
    var tags = TagDraft()
}

/// 录入提交状态归属于当前全屏页面。
@MainActor @Observable final class TransactionEditorModel {
    /// 编辑快照，nil 新增。
    let transaction: Transaction?
    /// 初始快照用于未保存保护。
    let initial: TransactionDraft
    /// 当前值草稿。
    var draft: TransactionDraft
    /// 提交锁。
    var saving = false
    /// 持续错误。
    var error: String?
    /// 结果未知时禁止原样再次提交，先返回查询核实。
    var uncertain = false
    /// 是否修改过草稿。
    var dirty: Bool { draft != initial }

    /// 从真实快照初始化；- Parameter transaction: 编辑原值或 nil。
    init(transaction: Transaction?) {
        self.transaction = transaction
        /// 新增使用运行时自然日期，编辑使用原关联。
        var draft = TransactionDraft()
        // transaction为当前列表提供的完整流水快照，用于详情或独立编辑。
        if let transaction {
            draft.type = transaction.type
            draft.amount = transaction.amount
            draft.category = transaction.category.actual
            draft.date = (try? LedgerDate(transaction.occurredDate)) ?? .today
            draft.title = transaction.title ?? ""
            draft.remark = transaction.remark ?? ""
            draft.tags.selected = transaction.tags
        }
        initial = draft
        self.draft = draft
    }

    /// 校验并提交完整事务；- Parameter repository: 当前会话仓库；- Returns: 成功自然日期，失败保留全部输入。
    func save(_ repository: LedgerRepository) async -> LedgerDate? {
        guard !saving, !uncertain else { return nil }
        saving = true
        error = nil
        defer { saving = false }
        do {
            // category为真实分类节点或原关联快照，用于固定层级选择和写入。
            guard let category = draft.category else { throw ValidationError(message: draft.type == .expense ? "请选择二级分类，或先在管理中创建" : "请选择收入分类") }
            _ = try LedgerDate(draft.date.description)
            /// 所有文本和金额在发送前校验，不用 Double 生成提交值。
            let body = try TransactionWrite(type: transaction == nil ? draft.type : nil, categoryId: category.id,
                amount: Money.validate(draft.amount), occurredDate: draft.date.description,
                // tag为当前真实标签，按ID判等，归档项仅可保留或解绑。
                title: TextRule.optional(draft.title, limit: 50, name: "标题"), tagIds: draft.tags.selected.map { tag in tag.id },
                tagNames: draft.tags.names, tagUpdates: draft.tags.updates.filter { update in
                    // update 只对仍选中的有效 ID 提交。
                    draft.tags.selected.contains { tag in tag.id == update.id && tag.archived != true }
                }, remark: TextRule.optional(draft.remark, limit: 100, name: "备注"))
            try await repository.saveTransaction(id: transaction?.id, body: body)
            return draft.date
        } catch {
            if case APIError.uncertainWrite = error { uncertain = true }
            self.error = error.localizedDescription
            return nil
        }
    }
}
