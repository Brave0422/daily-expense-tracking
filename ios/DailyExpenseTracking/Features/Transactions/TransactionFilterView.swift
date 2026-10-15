import SwiftUI

/// 查询面板只维护本地草稿；取消、手势关闭均不改变父筛选。
@MainActor struct TransactionFilterView: View {
    /// 当前依赖。
    @Environment(AppModel.self) private var app
    /// 关闭面板。
    @Environment(\.dismiss) private var dismiss
    /// 是否允许标题、标签和备注。
    let daily: Bool
    /// 确认后回传的完整筛选。
    let apply: (TransactionFilter) -> Void
    /// 当前面板草稿。
    @State private var draft: TransactionFilter
    /// 含历史归档的分类选项。
    @State private var categories: [Category] = []
    /// 含历史归档的标签选项。
    @State private var tags: [Tag] = []
    /// 初始选项读取进度。
    @State private var loading = false
    /// 读取或校验错误。
    @State private var error: String?
    /// 类型切换清理不兼容分类的提示。
    @State private var notice: String?

    /// 复制父级已应用条件；- Parameters: daily: 模式；initial: 原条件；apply: 应用回调。
    init(daily: Bool, initial: TransactionFilter, apply: @escaping (TransactionFilter) -> Void) {
        self.daily = daily
        self.apply = apply
        _draft = State(initialValue: initial)
    }

    /// 完整历史筛选表单。
    var body: some View {
        NavigationStack {
            Form {
                Section("收支类型") {
                    ChoicePicker(title: "类型", selection: $draft.type, options: [nil, .expense, .income]) { type in
                        // nil表示全部，序列化时省略type。
                        type?.title ?? "全部"
                    }
                }
                Section("金额区间（元）") {
                    TextField("最小金额", text: $draft.minAmount).keyboardType(.decimalPad)
                    TextField("最大金额", text: $draft.maxAmount).keyboardType(.decimalPad)
                }
                Section("分类 · 已选\(draft.categoryIds.count)项") {
                    if loading { ProgressView("加载历史选项…") }
                    ForEach(categories.filter { category in
                        // category 按真实类型过滤，名称不参与关联。
                        draft.type == nil || category.type == draft.type
                    }) { category in
                        // category 是一级选项，可表示整个支出父类范围。
                        categoryToggle(category, prefix: "")
                        ForEach(category.children ?? []) { child in
                            // child 为对应父级的二级选项，归档也允许历史查询。
                            categoryToggle(child, prefix: category.name + " / ")
                        }
                    }
                }
                if daily {
                    Section("文字条件") {
                        TextField("标题（最多50字符）", text: $draft.title)
                        TextField("备注（最多100字符）", text: $draft.remark)
                    }
                    Section("标签 · 任一匹配 · 已选\(draft.tagIds.count)项") {
                        ForEach(tags) { tag in
                            // tag 为历史选项，删除标记不禁止历史筛选。
                            Toggle(tag.name + (tag.archived == true ? "（已删除）" : ""), isOn: Binding(get: { draft.tagIds.contains(tag.id) }, set: { selected in
                                // selected 为此标签选择状态。
                                if selected { draft.tagIds.insert(tag.id) } else { draft.tagIds.remove(tag.id) }
                            }))
                        }
                    }
                }
                // notice为当前操作结果说明，用于持续展示已保存或处理位置。
                if let notice { Text(notice).foregroundStyle(Theme.secondary) }
                // error为当前捕获的错误或持续错误提示，用于分类处理和就地反馈。
                if let error { ErrorNotice(message: error) { Task { await load() } } }
            }.navigationTitle("筛选流水").navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) { Button("取消") { dismiss() } }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("应用") {
                            do {
                                _ = try draft.query(daily: daily)
                                apply(draft)
                                dismiss()
                            } catch { self.error = error.localizedDescription }
                        }
                    }
                    ToolbarItem(placement: .bottomBar) { Button("重置条件") { draft = TransactionFilter(); error = nil }.frame(minHeight: 44) }
                }
        }.presentationDetents([.large]).task { await load() }
            .onChange(of: draft.type) { _, value in
                // value 为新类型；只清理类型不兼容的真实 ID。
                guard let value else { return }
                /// 允许的父子分类 ID 集合。
                let allowed = Set(categories.filter { category in category.type == value }.flatMap { category in
                    // category 为同方向父类，连同所有子类。
                    [category.id] + (category.children ?? []).map { child in child.id }
                })
                if !draft.categoryIds.isSubset(of: allowed) { draft.categoryIds.formIntersection(allowed); notice = "已清除不符合收支类型的分类" }
            }
    }

    /// 分类选择；- Parameters: category: 当前真实节点；prefix: 二级父类路径。
    private func categoryToggle(_ category: Category, prefix: String) -> some View {
        Toggle(isOn: Binding(get: { draft.categoryIds.contains(category.id) }, set: { selected in
            // selected 为选择状态；按 ID 保存，不合并同名分类。
            if selected { draft.categoryIds.insert(category.id) } else { draft.categoryIds.remove(category.id) }
        })) {
            HStack { CategoryGlyph(key: category.iconKey, background: category.backgroundColor); Text(prefix + category.name + (category.archived == true ? "（已删除）" : "")) }
        }
    }

    /// 同时获取两个类型与历史标签，失败保留草稿和已加载选项。
    private func load() async {
        loading = true
        defer { loading = false }
        do {
            /// 历史支出树。
            async let expense = app.repository.categories(.expense, archived: true)
            /// 历史收入树。
            async let income = app.repository.categories(.income, archived: true)
            /// 历史标签，仅明细需要。
            let loadedTags = daily ? try await app.repository.tags(archived: true) : []
            /// 同时等待分类读取完成。
            let loadedCategories = try await (expense, income)
            try Task.checkCancellation()
            categories = loadedCategories.0 + loadedCategories.1
            tags = loadedTags
            error = nil
        } catch is CancellationError {} catch { self.error = error.localizedDescription }
    }
}
