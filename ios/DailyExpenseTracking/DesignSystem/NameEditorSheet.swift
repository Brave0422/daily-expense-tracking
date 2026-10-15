import SwiftUI

/// 可复用的名称表单，有修改时禁止手势丢弃。
struct NameEditorSheet: View {
    /// 关闭当前表单。
    @Environment(\.dismiss) private var dismiss
    /// 表单标题。
    let title: String
    /// 原始名称用于放弃检查。
    let original: String
    /// 作用范围说明。
    let explanation: String
    /// 已确认名称写入动作，参数为 trim 后名称；失败抛错保留输入。
    let save: (String) async throws -> Void
    /// 本地名称草稿。
    @State private var name: String
    /// 保存中禁止关闭。
    @State private var saving = false
    /// 未知结果防止重复创建。
    @State private var uncertain = false
    /// 当前错误。
    @State private var error: String?
    /// 放弃确认。
    @State private var confirmDiscard = false

    /// 创建受保护名称编辑；- Parameters: title: 标题；original: 原值；explanation: 影响说明；save: 确认操作。
    init(title: String, original: String = "", explanation: String, save: @escaping (String) async throws -> Void) {
        self.title = title
        self.original = original
        self.explanation = explanation
        self.save = save
        _name = State(initialValue: original)
    }

    /// 单字段表单，错误持续展示。
    var body: some View {
        NavigationStack {
            Form {
                Section("名称（最多50字符）") { TextField("请输入名称", text: $name) }
                Section { Text(explanation).foregroundStyle(Theme.secondary) }
                // error为当前捕获的错误或持续错误提示，用于分类处理和就地反馈。
                if let error { Section { ErrorNotice(message: error) } }
            }.disabled(saving).navigationTitle(title).navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) { Button("取消") { if name != original { confirmDiscard = true } else { dismiss() } }.disabled(saving) }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("保存") {
                            guard !saving else { return }
                            saving = true
                            Task {
                                defer { saving = false }
                                do { try await save(TextRule.required(name)); dismiss() }
                                catch {
                                    if case APIError.uncertainWrite = error { uncertain = true }
                                    self.error = error.localizedDescription
                                }
                            }
                        }.disabled(saving || uncertain)
                    }
                }
        }.interactiveDismissDisabled(name != original || saving)
            .confirmationDialog("放弃名称修改？", isPresented: $confirmDiscard, titleVisibility: .visible) {
                Button("放弃修改", role: .destructive) { dismiss() }
                Button("继续填写", role: .cancel) {}
            }
    }
}
