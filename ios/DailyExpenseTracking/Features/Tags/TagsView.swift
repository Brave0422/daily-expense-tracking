import SwiftUI

/// 标签管理编辑路由。
struct TagEditorRoute: Identifiable {
    /// 模态路由 ID。
    let id = UUID()
    /// 编辑项，nil 表示新增。
    let tag: Tag?
}

/// 管理模式确认后立即增改删，与流水草稿模式分离。
@MainActor struct TagsView: View {
    /// 当前依赖。
    @Environment(AppModel.self) private var app
    /// 保留服务器关键词。
    @State private var keyword = ""
    /// 标签读取状态。
    @State private var query = QueryState<[Tag]>()
    /// 名称表单路由。
    @State private var editor: TagEditorRoute?
    /// 待归档项。
    @State private var deleting: Tag?
    /// 删除锁。
    @State private var busy = false
    /// 写入失败文案。
    @State private var error: String?
    /// 保存后刷新错误需要区分。
    @State private var saved = false
    /// 单列原生管理列表。
    var body: some View {
        List {
            if query.loading { ProgressView("读取标签…") }
            // error为当前捕获的错误或持续错误提示，用于分类处理和就地反馈。
            if let error = query.error { ErrorNotice(message: (saved ? "已保存，刷新失败：" : "") + error) { Task { await load() } } }
            // error为当前捕获的错误或持续错误提示，用于分类处理和就地反馈。
            if let error { ErrorNotice(message: error) }
            if !query.loadedLabel.isEmpty { Text("已加载：" + query.loadedLabel).font(.caption).foregroundStyle(Theme.secondary) }
            Section("\(query.value?.count ?? 0)个标签") {
                ForEach(query.value ?? []) { tag in
                    // tag 是服务端有效项，确认改名影响全局。
                    HStack {
                        Text(tag.name).padding(.horizontal, 10).padding(.vertical, 6).background(Theme.primarySoft, in: RoundedRectangle(cornerRadius: 8))
                        Spacer()
                        Menu {
                            Button("改名") { editor = TagEditorRoute(tag: tag) }
                            Button("删除标签", role: .destructive) { deleting = tag }
                        } label: { Image(systemName: "ellipsis").frame(width: 44, height: 44) }.disabled(busy).accessibilityLabel("管理标签\(tag.name)")
                    }
                }
                if query.value?.isEmpty == true { Text(keyword.isEmpty ? "暂无标签，点击右上角新增" : "没有匹配标签").foregroundStyle(Theme.secondary) }
            }
        }.searchable(text: $keyword, prompt: "搜索服务端标签").navigationTitle("标签管理").navigationBarTitleDisplayMode(.inline)
            .scrollContentBackground(.hidden).background(Theme.page)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("新增") { editor = TagEditorRoute(tag: nil) } } }
            .task(id: keyword + "-\(app.revision)") {
                try? await Task.sleep(for: .milliseconds(300))
                if !Task.isCancelled { await load() }
            }.refreshable { await load() }
            .sheet(item: $editor) { route in
                // route 区分全局新增和改名，不复用流水写入边界。
                NameEditorSheet(title: route.tag == nil ? "新增标签" : "标签改名", original: route.tag?.name ?? "",
                    // name为当前trim后的名称或Cookie属性名，按所属字段规则处理。
                    explanation: route.tag == nil ? "保存后立即创建全局标签。" : "确认改名会影响使用此标签的其他流水。") { name in
                    try await app.repository.saveTag(id: route.tag?.id, name: name)
                    saved = true
                    app.changed()
                }
            }
            // value为当前已校验字段或控件回调值，用于对应字段的状态更新。
            .confirmationDialog("删除标签“\(deleting?.name ?? "")”？", isPresented: Binding(get: { deleting != nil }, set: { value in if !value { deleting = nil } }), titleVisibility: .visible) {
                // tag为当前真实标签，按ID判等，归档项仅可保留或解绑。
                Button("确认删除", role: .destructive) { if let tag = deleting { Task { await archive(tag) } } }
                Button("取消", role: .cancel) { deleting = nil }
            } message: { Text("历史关联保留，标签不再用于新绑定。不会删除流水。") }
    }

    /// 搜索条件快照，空关键词走列表。
    private func load() async {
        /// 本次输入快照。
        let key = keyword
        await query.load(label: key.isEmpty ? "全部标签" : key) { try await app.repository.tags(key: key) }
    }

    /// 删除真实标签；- Parameter tag: 确认目标。
    private func archive(_ tag: Tag) async {
        guard !busy else { return }
        busy = true
        defer { busy = false }
        do { try await app.repository.archiveTag(tag.id); deleting = nil; saved = true; app.changed() }
        catch { self.error = error.localizedDescription }
    }
}
