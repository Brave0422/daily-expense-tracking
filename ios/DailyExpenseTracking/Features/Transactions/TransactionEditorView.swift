import SwiftUI

/// 长表单全屏呈现，子选择页留在自身导航栈。
@MainActor struct TransactionEditorView: View {
    /// 当前依赖。
    @Environment(AppModel.self) private var app
    /// 全屏关闭动作。
    @Environment(\.dismiss) private var dismiss
    /// 录入状态。
    @State private var model: TransactionEditorModel
    /// 放弃修改确认。
    @State private var confirmDiscard = false
    /// 键盘收起控制。
    @FocusState private var inputFocused: Bool
    /// 保存完成回传自然日期，不自行修改父查询。
    let saved: (LedgerDate) -> Void

    /// 独立复制编辑输入；- Parameters: transaction: 原快照；saved: 确认成功回调。
    init(transaction: Transaction?, saved: @escaping (LedgerDate) -> Void) {
        _model = State(initialValue: TransactionEditorModel(transaction: transaction))
        self.saved = saved
    }

    /// 输入与子导航；不能通过手势绕过未保存保护。
    var body: some View {
        /// 绑定只指向当前编辑草稿。
        @Bindable var form = model
        NavigationStack {
            Form {
                Section {
                    if model.transaction == nil {
                        ChoicePicker(title: "收支类型", selection: $form.draft.type, options: TransactionType.allCases) { type in
                            // type 是当前方向选项。
                            type.title
                        }.onChange(of: model.draft.type) { _, _ in
                            // 切换方向只清除分类，保留金额、文本和标签草稿。
                            model.draft.category = nil
                        }
                    } else { LabeledContent("收支类型", value: model.draft.type.title) }
                    Text("金额（元）").font(.subheadline)
                    TextField("0.00", text: $form.draft.amount).keyboardType(.decimalPad).font(.largeTitle.bold()).foregroundStyle(Theme.color(model.draft.type)).focused($inputFocused).accessibilityIdentifier("transaction.amount")
                }
                Section {
                    NavigationLink {
                        CategorySelectionView(type: model.draft.type) { category in
                            // category 是用户选择的有效二级支出或一级收入。
                            model.draft.category = category
                        }
                    } label: { LabeledContent("分类 *", value: (model.draft.category?.name ?? "请选择") + (model.draft.category?.archived == true ? "（已删除）" : "")) }
                    DatePicker("发生日期 *", selection: Binding(get: { model.draft.date.pickerDate }, set: { date in
                        // date 使用固定日历时区回读自然日。
                        model.draft.date = LedgerDate(picker: date)
                    }), in: LedgerDate(year: 1000, month: 1, day: 1).pickerDate...LedgerDate(year: 9999, month: 12, day: 31).pickerDate, displayedComponents: .date)
                        .environment(\.calendar, LedgerDate.calendar).environment(\.timeZone, LedgerDate.calendar.timeZone)
                    TextField("标题（选填，最多50字符）", text: $form.draft.title).focused($inputFocused)
                }
                Section("标签") {
                    NavigationLink {
                        TagSelectionView(initial: model.draft.tags) { tags in
                            // tags 只回填父草稿，不调用写接口。
                            model.draft.tags = tags
                        }
                    } label: {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("选择 / 新建 / 改名")
                            // tag为当前真实标签，按ID判等，归档项仅可保留或解绑；name为当前trim后的名称或Cookie属性名，按所属字段规则处理。
                            Text((model.draft.tags.selected.map { tag in tag.name } + model.draft.tags.names.map { name in name + "（待创建）" }).joined(separator: " · ")).font(.caption).foregroundStyle(Theme.secondary)
                        }
                    }
                }
                Section("备注（选填，最多100字符）") { TextField("补充说明", text: $form.draft.remark, axis: .vertical).lineLimit(3...6).focused($inputFocused) }
                // error为当前捕获的错误或持续错误提示，用于分类处理和就地反馈。
                if let error = model.error { Section { ErrorNotice(message: error) } }
                if model.uncertain { Section { Text("请取消返回流水页，刷新核实后再决定是否重新录入。当前输入会保留到您确认放弃。") } }
            }.scrollContentBackground(.hidden).background(Theme.page).navigationTitle(model.transaction == nil ? "新增流水" : "编辑流水").navigationBarTitleDisplayMode(.inline)
                .disabled(model.saving)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) { Button("取消") { if model.dirty { confirmDiscard = true } else { dismiss() } }.disabled(model.saving) }
                    ToolbarItem(placement: .confirmationAction) {
                        Button {
                            inputFocused = false
                            Task {
                                // date为有效自然日期或Cookie到期时间，不将自然日当作UTC时间戳。
                                if let date = await model.save(app.repository) { saved(date); dismiss() }
                            }
                        } label: { if model.saving { ProgressView() } else { Text("保存").fontWeight(.semibold) } }.disabled(model.saving || model.uncertain).accessibilityIdentifier("transaction.save")
                    }
                    ToolbarItemGroup(placement: .keyboard) { Spacer(); Button("完成") { inputFocused = false } }
                }
        }.interactiveDismissDisabled(model.dirty || model.saving)
            .confirmationDialog("放弃本次流水及标签草稿？", isPresented: $confirmDiscard, titleVisibility: .visible) {
                Button("放弃修改", role: .destructive) { dismiss() }
                Button("继续填写", role: .cancel) {}
            }
    }
}

/// 只能选择有效分类；历史原归档项由父编辑草稿保留。
@MainActor struct CategorySelectionView: View {
    /// 当前依赖。
    @Environment(AppModel.self) private var app
    /// 返回父表单。
    @Environment(\.dismiss) private var dismiss
    /// 固定录入方向。
    let type: TransactionType
    /// 合法选择回调。
    let select: (CategorySnapshot) -> Void
    /// 当前有效树。
    @State private var query = QueryState<[Category]>()
    /// 分类层级列表。
    var body: some View {
        List {
            if query.loading { ProgressView("加载分类…") }
            // error为当前捕获的错误或持续错误提示，用于分类处理和就地反馈。
            if let error = query.error { ErrorNotice(message: error) { Task { await load() } } }
            ForEach(query.value ?? []) { parent in
                // parent 是一级，收入直接可选，支出仅作为分组。
                if type == .income { row(parent) }
                else {
                    Section(parent.name) {
                        // child为当前父级的真实二级分类节点，不合并不同父级同名项。
                        ForEach(parent.children ?? []) { child in row(child) }
                        if parent.children?.isEmpty != false { Text("暂无二级分类，请先创建").foregroundStyle(Theme.secondary) }
                    }
                }
            }
            Section { NavigationLink("前往分类管理") { CategoriesView() } }
        }.navigationTitle(type == .expense ? "选择二级分类" : "选择收入分类")
            .task(id: app.revision) { await load() }
            .refreshable { await load() }
    }

    /// 可选择分类行；- Parameter category: 有效合法层级节点。
    private func row(_ category: Category) -> some View {
        Button {
            select(CategorySnapshot(id: category.id, name: category.name, iconKey: category.iconKey, backgroundColor: category.backgroundColor, archived: false))
            dismiss()
        } label: { HStack { CategoryGlyph(key: category.iconKey, background: category.backgroundColor); Text(category.name) }.frame(minHeight: 44) }
    }

    /// 子页重入时按失效版本刷新，不覆盖父表单。
    private func load() async { await query.load(label: type.title) { try await app.repository.categories(type) } }
}
