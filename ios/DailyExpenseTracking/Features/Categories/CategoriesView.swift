import SwiftUI

/// 分类创建 / 编辑路由，父级和类型在表单中不可更改。
struct CategoryEditorRoute: Identifiable {
    /// 界面路由标识。
    let id = UUID()
    /// 固定方向。
    let type: TransactionType
    /// 新增二级时的固定父级。
    let parent: Category?
    /// 编辑原分类。
    let category: Category?
}

/// 分类管理允许支出两级、收入一级；不提供移动排序或恢复假入口。
@MainActor struct CategoriesView: View {
    /// 当前会话依赖。
    @Environment(AppModel.self) private var app
    /// 独立类型分段。
    @State private var type: TransactionType = .expense
    /// 分类读取状态。
    @State private var query = QueryState<[Category]>()
    /// 当前编辑路由。
    @State private var editor: CategoryEditorRoute?
    /// 待确认归档分类。
    @State private var deleting: Category?
    /// 删除加载锁。
    @State private var busy = false
    /// 写入失败保留当前分类。
    @State private var error: String?
    /// 删除成功与读取失败分开表达。
    @State private var saved = false
    /// 各类型按真实父ID保留展开状态，初始全部折叠。
    @State private var expanded: Set<Int64> = []

    /// 分类树和操作菜单。
    var body: some View {
        List {
            Section {
                // value为当前已校验字段或控件回调值，用于对应字段的状态更新。
                ChoicePicker(title: "收支分类", selection: $type, options: TransactionType.allCases) { value in value.title }
            }
            if query.loading { ProgressView("加载分类…") }
            // error为当前捕获的错误或持续错误提示，用于分类处理和就地反馈。
            if let error = query.error { ErrorNotice(message: (saved ? "已保存，刷新失败：" : "") + error) { Task { await load() } } }
            // error为当前捕获的错误或持续错误提示，用于分类处理和就地反馈。
            if let error { ErrorNotice(message: error) }
            if query.value?.isEmpty == true { ContentUnavailableView("暂无分类", systemImage: "square.grid.2x2", description: Text("点击右上角添加一级分类")) }
            ForEach(query.loadedLabel == type.title ? (query.value ?? []) : []) { parent in
                // parent 为一级，支出可展开二级、收入只显示自身。
                Section {
                    if type == .expense {
                        DisclosureGroup(isExpanded: Binding(get: { expanded.contains(parent.id) }, set: { value in
                            // value 为此一级分类的展开状态，切方向不会清除另一组ID。
                            if value { expanded.insert(parent.id) } else { expanded.remove(parent.id) }
                        })) {
                            ForEach(parent.children ?? []) { child in
                                // child 是当前父级二级分类，层级缩进呈现。
                                categoryRow(child, parent: parent).padding(.leading, 16)
                            }
                            if parent.children?.isEmpty != false { Text("暂无二级分类").foregroundStyle(Theme.secondary).font(.subheadline) }
                            Button { editor = CategoryEditorRoute(type: .expense, parent: parent, category: nil) } label: { Label("添加二级分类", systemImage: "plus.circle").frame(minHeight: 44) }
                        } label: { categoryRow(parent, parent: nil) }
                    } else { categoryRow(parent, parent: nil) }
                }
            }
        }.scrollContentBackground(.hidden).background(Theme.page).navigationTitle("分类管理").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("添加一级") { editor = CategoryEditorRoute(type: type, parent: nil, category: nil) } } }
            .task(id: type.rawValue + "-\(app.revision)") { await load() }
            .refreshable { await load() }
            // route为当前模态的真实编辑上下文，不作为服务端业务ID。
            .sheet(item: $editor) { route in CategoryEditorView(route: route) }
            // value为当前已校验字段或控件回调值，用于对应字段的状态更新。
            .confirmationDialog("删除分类“\(deleting?.name ?? "")”？", isPresented: Binding(get: { deleting != nil }, set: { value in if !value { deleting = nil } }), titleVisibility: .visible) {
                // category为真实分类节点或原关联快照，用于固定层级选择和写入。
                Button("确认删除", role: .destructive) { if let category = deleting { Task { await archive(category) } } }
                Button("取消", role: .cancel) { deleting = nil }
            } message: { Text("历史流水仍保留关联；该分类下记录不再计入统计，统计金额可能改变。一级分类仍有有效二级时请先逐个删除二级。") }
    }

    /// 分类行与菜单；- Parameters: category: 当前分类；parent: 固定父级。
    private func categoryRow(_ category: Category, parent: Category?) -> some View {
        HStack {
            CategoryGlyph(key: category.iconKey, background: category.backgroundColor)
            Text(category.name)
            Spacer()
            Menu {
                Button("编辑分类") { editor = CategoryEditorRoute(type: category.type, parent: parent, category: category) }
                Button("删除分类", role: .destructive) {
                    if category.level == 1, category.children?.isEmpty == false { error = "请先删除二级分类" }
                    else { deleting = category }
                }
            } label: { Image(systemName: "ellipsis").frame(width: 44, height: 44) }.disabled(busy).accessibilityLabel("管理分类\(category.name)")
        }
    }

    /// 按当前类型读取；旧结果保留期间标明原方向。
    private func load() async {
        /// 类型快照。
        let type = self.type
        await query.load(label: type.title) { try await app.repository.categories(type) }
    }

    /// 归档单一分类；- Parameter category: 已确认目标，不循环删除子类。
    private func archive(_ category: Category) async {
        guard !busy else { return }
        busy = true
        defer { busy = false }
        do { try await app.repository.archiveCategory(category.id); deleting = nil; saved = true; app.changed() }
        catch { self.error = error.localizedDescription }
    }
}

/// 固定层级分类表单和真实图库，所有写入都由用户确认。
@MainActor struct CategoryEditorView: View {
    /// 当前依赖。
    @Environment(AppModel.self) private var app
    /// 关闭编辑。
    @Environment(\.dismiss) private var dismiss
    /// 固定类型、父级、原分类。
    let route: CategoryEditorRoute
    /// 名称草稿。
    @State private var name: String
    /// 图标草稿。
    @State private var iconKey: String
    /// 服务器图库。
    @State private var icons = QueryState<[CategoryIcon]>()
    /// 保存锁。
    @State private var saving = false
    /// 未知提交结果不能重复创建。
    @State private var uncertain = false
    /// 持续错误。
    @State private var error: String?
    /// 放弃确认。
    @State private var confirmDiscard = false
    /// 是否改动输入。
    private var dirty: Bool { name != (route.category?.name ?? "") || iconKey != (route.category?.iconKey ?? "") }
    /// 二级继承父色；一级用当前选图颜色，编辑原图保留真实色。
    private var background: String {
        route.parent?.backgroundColor ?? icons.value?.first(where: { icon in icon.iconKey == iconKey })?.backgroundColor ?? route.category?.backgroundColor ?? "#888888"
    }

    /// 从真实快照创建；- Parameter route: 固定层级信息。
    init(route: CategoryEditorRoute) {
        self.route = route
        _name = State(initialValue: route.category?.name ?? "")
        _iconKey = State(initialValue: route.category?.iconKey ?? "")
    }

    /// 图库网格采用本地矢量资源，未知键显示占位。
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    LabeledContent("收支类型", value: route.type.title)
                    LabeledContent("层级", value: route.parent == nil ? "一级" : "二级")
                    // parent为二级分类所属一级关系，保留路径或继承背景语义。
                    if let parent = route.parent { LabeledContent("父分类", value: parent.name) }
                    TextField("分类名称（最多50字符）", text: $name)
                    HStack { CategoryGlyph(key: iconKey, background: background, size: 44); Text(name.isEmpty ? "图标预览" : name) }
                }
                Section("选择图标") {
                    if icons.loading { ProgressView("读取图库…") }
                    // error为当前捕获的错误或持续错误提示，用于分类处理和就地反馈。
                    if let error = icons.error { ErrorNotice(message: error) { Task { await loadIcons() } } }
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 58))], spacing: 14) {
                        ForEach(icons.value ?? []) { icon in
                            // icon 为后端有效图库项，二级预览仍使用父背景。
                            Button { iconKey = icon.iconKey } label: {
                                CategoryGlyph(key: icon.iconKey, background: route.parent?.backgroundColor ?? icon.backgroundColor, size: 44)
                                    .padding(5).overlay(RoundedRectangle(cornerRadius: 12).stroke(iconKey == icon.iconKey ? Theme.primary : .clear, lineWidth: 3))
                            }.buttonStyle(.plain).accessibilityLabel(icon.iconKey).accessibilityAddTraits(iconKey == icon.iconKey ? [.isSelected] : [])
                        }
                    }
                }
                // error为当前捕获的错误或持续错误提示，用于分类处理和就地反馈。
                if let error { Section { ErrorNotice(message: error) } }
            }.navigationTitle(route.category == nil ? "新增分类" : "编辑分类").navigationBarTitleDisplayMode(.inline)
                .disabled(saving)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) { Button("取消") { if dirty { confirmDiscard = true } else { dismiss() } }.disabled(saving) }
                    ToolbarItem(placement: .confirmationAction) { Button(saving ? "保存中…" : "保存") { Task { await save() } }.disabled(saving || uncertain || icons.value == nil) }
                }
        }.task { await loadIcons() }.interactiveDismissDisabled(dirty || saving)
            .confirmationDialog("放弃分类修改？", isPresented: $confirmDiscard, titleVisibility: .visible) {
                Button("放弃修改", role: .destructive) { dismiss() }
                Button("继续填写", role: .cancel) {}
            }
    }

    /// 读取图库，失败不编造可用键。
    private func loadIcons() async { await icons.load(label: "图库") { try await app.repository.icons() } }

    /// 提交固定层级分类，失败保留草稿。
    private func save() async {
        guard !saving, !uncertain else { return }
        saving = true
        defer { saving = false }
        do {
            try await app.repository.saveCategory(id: route.category?.id, type: route.type, parentId: route.parent?.id, name: name, iconKey: iconKey)
            app.changed()
            dismiss()
        } catch {
            if case APIError.uncertainWrite = error { uncertain = true }
            self.error = error.localizedDescription
        }
    }
}
