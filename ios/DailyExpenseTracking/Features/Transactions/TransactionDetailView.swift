import SwiftUI

/// 日明细快照的只读详情，无虚构详情接口。
@MainActor struct TransactionDetailView: View {
    /// 关闭详情。
    @Environment(\.dismiss) private var dismiss
    /// 当前快照。
    let transaction: Transaction
    /// 父级删除锁。
    let deleting: Bool
    /// 关闭详情后由父级开启编辑。
    let edit: () -> Void
    /// 归档动作由父级管理。
    let remove: () async -> String?
    /// 删除确认。
    @State private var confirmDelete = false
    /// 当前详情自己的删除锁，覆盖sheet内容更新时机。
    @State private var removing = false
    /// 删除失败在当前详情持续可见。
    @State private var error: String?
    /// 原生详情与完整可读字段。
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    AmountText(amount: transaction.amount, type: transaction.type, signed: true).font(.largeTitle)
                    LabeledContent("分类", value: transaction.category.path)
                    LabeledContent("发生日期", value: transaction.occurredDate)
                    if transaction.category.actual.archived { Text("当前分类已删除，历史关联保留").foregroundStyle(Theme.secondary) }
                }
                Section("标题") { Text(transaction.title ?? "未填写") }
                Section("标签") {
                    if transaction.tags.isEmpty { Text("无标签").foregroundStyle(Theme.secondary) }
                    ForEach(transaction.tags) { tag in
                        // tag 保留归档历史名称。
                        Text(tag.name + (tag.archived == true ? "（已删除）" : ""))
                    }
                }
                Section("备注") { Text(transaction.remark ?? "未填写").textSelection(.enabled) }
                Section {
                    Button("编辑流水", action: edit).disabled(removing)
                    Button("删除流水", role: .destructive) { confirmDelete = true }.disabled(deleting || removing)
                }
                // error为当前捕获的错误或持续错误提示，用于分类处理和就地反馈。
                if let error { Section { ErrorNotice(message: error) } }
            }.navigationTitle("流水详情").navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .cancellationAction) { Button("关闭") { dismiss() }.disabled(deleting || removing) } }
        }.interactiveDismissDisabled(deleting || removing)
            .confirmationDialog("删除\(transaction.title ?? transaction.category.actual.name)？", isPresented: $confirmDelete, titleVisibility: .visible) {
                Button("确认删除", role: .destructive) {
                    guard !removing else { return }
                    removing = true
                    Task { error = await remove(); removing = false }
                }
                Button("取消", role: .cancel) {}
            } message: { Text("\(transaction.occurredDate) · ¥\(Money.display(transaction.amount))。删除后不再计入流水；仅此流水使用的标签也可能被删除。") }
    }
}
