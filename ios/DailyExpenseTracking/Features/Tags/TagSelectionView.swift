import SwiftUI

/// 标签子页只维护本地事务草稿，禁用侧滑返回，显式取消 / 完成。
@MainActor struct TagSelectionView: View {
    /// 当前仓库依赖。
    @Environment(AppModel.self) private var app
    /// 返回父表单。
    @Environment(\.dismiss) private var dismiss
    /// 确认后的草稿回调，不是写入。
    let apply: (TagDraft) -> Void
    /// 独立子草稿，取消不污染父级。
    @State private var draft: TagDraft
    /// 服务端搜索关键词。
    @State private var keyword = ""
    /// 最新搜索结果。
    @State private var query = QueryState<[Tag]>()
    /// 查重进度锁。
    @State private var checking = false
    /// 查重错误。
    @State private var error: String?
    /// 待用户确认复用的同名项。
    @State private var reuse: Tag?
    /// 待改名的有效标签。
    @State private var renaming: Tag?
    /// 新名称草稿的编辑路由。
    @State private var renamingNew: NewTagNameRoute?
    /// 关闭后禁止迟到查重写入。
    @State private var closed = false
    /// 取消子草稿确认。
    @State private var confirmDiscard = false
    /// 父级初始快照。
    let initial: TagDraft

    /// 复制父级草稿；- Parameters: initial: 原标签草稿；apply: 完成回调。
    init(initial: TagDraft, apply: @escaping (TagDraft) -> Void) {
        self.initial = initial
        self.apply = apply
        _draft = State(initialValue: initial)
    }

    /// 选择、搜索、查重和事务改名。
    var body: some View {
        List {
            Section("已选 · 保存流水时才生效") {
                ForEach(draft.selected) { tag in
                    // tag 是真实标签，已归档只能保留或解绑。
                    HStack {
                        VStack(alignment: .leading) {
                            Text(tag.name + (tag.archived == true ? "（已删除）" : ""))
                            // update为保留原标签ID的待提交改名项。
                            if draft.updates.contains(where: { update in update.id == tag.id }) { Text("待保存改名").font(.caption).foregroundStyle(Theme.secondary) }
                        }
                        Spacer()
                        if tag.archived != true { Button("改名") { renaming = tag }.buttonStyle(.borderless).frame(minHeight: 44) }
                        Button { draft.remove(tag.id) } label: { Image(systemName: "minus.circle").frame(width: 44, height: 44) }.buttonStyle(.borderless).accessibilityLabel("移除标签\(tag.name)")
                    }
                }
                ForEach(draft.names, id: \.self) { name in
                    // name 是本地新名称，没有真实 ID。
                    HStack {
                        Text(name + "（待创建）")
                        Spacer()
                        Button("改名") { renamingNew = NewTagNameRoute(name: name) }.buttonStyle(.borderless).frame(minHeight: 44)
                        // value为当前已校验字段或控件回调值，用于对应字段的状态更新。
                        Button { draft.names.removeAll { value in value == name } } label: { Image(systemName: "minus.circle").frame(width: 44, height: 44) }.buttonStyle(.borderless).accessibilityLabel("移除新名称\(name)")
                    }
                }
            }
            Section("服务端搜索") {
                TextField("搜索或输入新名称", text: $keyword)
                if query.loading { ProgressView("搜索中…") }
                // error为当前捕获的错误或持续错误提示，用于分类处理和就地反馈。
                if let error = query.error { ErrorNotice(message: error) { Task { await search() } } }
                if query.value?.isEmpty == true { Text("没有匹配标签").foregroundStyle(Theme.secondary) }
                ForEach(query.value ?? []) { tag in
                    // tag 是服务端有效标签，不包含新建草稿。
                    Button {
                        // selected为已选标签或当前勾选状态，用于按ID选择与移除。
                        if draft.selected.contains(where: { selected in selected.id == tag.id }) { draft.remove(tag.id) }
                        else if !draft.names.contains(tag.name) { draft.selected.append(tag) }
                    } label: {
                        // selected为已选标签或当前勾选状态，用于按ID选择与移除。
                        HStack { Text(tag.name); Spacer(); if draft.selected.contains(where: { selected in selected.id == tag.id }) { Image(systemName: "checkmark") } }.frame(minHeight: 44)
                    }
                }
                if !keyword.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    Button(checking ? "正在查重…" : "使用此名称") { Task { await useName() } }.disabled(checking).frame(minHeight: 44)
                }
            }
            // error为当前捕获的错误或持续错误提示，用于分类处理和就地反馈。
            if let error { Section { ErrorNotice(message: error) } }
        }.navigationTitle("流水标签").navigationBarTitleDisplayMode(.inline).navigationBarBackButtonHidden(true)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("取消") { if draft != initial { confirmDiscard = true } else { closed = true; dismiss() } }
                }
                ToolbarItem(placement: .confirmationAction) { Button("完成") { closed = true; apply(draft); dismiss() }.disabled(checking) }
            }
            .task(id: keyword + "-\(app.revision)") {
                // 300ms 去抖；取消后不发旧搜索。
                try? await Task.sleep(for: .milliseconds(300))
                if !Task.isCancelled { await search() }
            }
            .onDisappear { closed = true }
            .onAppear { closed = false }
            .confirmationDialog("放弃本次标签选择修改？", isPresented: $confirmDiscard, titleVisibility: .visible) {
                Button("放弃修改", role: .destructive) { closed = true; dismiss() }
                Button("继续选择", role: .cancel) {}
            }
            // value为当前已校验字段或控件回调值，用于对应字段的状态更新。
            .alert("已有同名标签，是否复用？", isPresented: Binding(get: { reuse != nil }, set: { value in if !value { reuse = nil } })) {
                Button("复用已有标签") {
                    // tag为当前真实标签，按ID判等，归档项仅可保留或解绑；selected为已选标签或当前勾选状态，用于按ID选择与移除。
                    if let tag = reuse, !draft.selected.contains(where: { selected in selected.id == tag.id }) { draft.selected.append(tag) }
                    reuse = nil
                }
                Button("取消", role: .cancel) { reuse = nil }
            } message: { Text(reuse?.name ?? "") }
            .sheet(item: $renaming) { tag in
                // tag 保留原 ID，全局改名仅进入事务草稿。
                NameEditorSheet(title: "标签改名草稿", original: tag.name, explanation: "保存流水后将影响使用此标签的其他流水；现在只修改草稿。") { name in
                    // existing为服务端只读查重返回的同名有效标签，须按当前操作明确复用或报冲突。
                    if let existing = try await app.repository.checkTag(name), existing.id != tag.id { throw ValidationError(message: "新名称与另一有效标签冲突，不能替换原ID") }
                    // selected为已选标签或当前勾选状态，用于按ID选择与移除。
                    guard !draft.names.contains(name), !draft.selected.contains(where: { selected in selected.id != tag.id && selected.name == name }) else { throw ValidationError(message: "已有相同名称草稿") }
                    // index为当前真实项在草稿或完整时间轴中的位置，使用前检查有效范围；selected为已选标签或当前勾选状态，用于按ID选择与移除。
                    if let index = draft.selected.firstIndex(where: { selected in selected.id == tag.id }) {
                        draft.selected[index].name = name
                        // update为保留原标签ID的待提交改名项。
                        draft.updates.removeAll { update in update.id == tag.id }
                        draft.updates.append(TagUpdate(id: tag.id, name: name))
                    }
                }
            }
            .sheet(item: $renamingNew) { route in
                // route.name 是本地名称，改名仍不调用写接口。
                NameEditorSheet(title: "修改新名称", original: route.name, explanation: "新标签将在保存流水时创建。") { name in
                    guard try await app.repository.checkTag(name) == nil else { throw ValidationError(message: "已有同名标签，请移除新名称后选择已有标签") }
                    // selected为已选标签或当前勾选状态，用于按ID选择与移除；value为当前已校验字段或控件回调值，用于对应字段的状态更新。
                    guard !draft.selected.contains(where: { selected in selected.name == name }), !draft.names.contains(where: { value in value != route.name && value == name }) else { throw ValidationError(message: "已有同名草稿") }
                    // index为当前真实项在草稿或完整时间轴中的位置，使用前检查有效范围。
                    if let index = draft.names.firstIndex(of: route.name) { draft.names[index] = name }
                }
            }
    }

    /// 读取最新关键词结果，QueryState 同时防止旧响应和旧错误覆盖。
    private func search() async {
        /// 关键词快照。
        let key = keyword
        await query.load(label: key) { try await app.repository.tags(key: key) }
    }

    /// 只读查重后创建本地名称草稿，迟到结果不添加旧输入。
    private func useName() async {
        guard !checking else { return }
        checking = true
        error = nil
        /// 保留原输入用于防止查重期间输入改变。
        let original = keyword
        defer { checking = false }
        do {
            /// trim 后候选名称。
            let name = try TextRule.required(original)
            guard !draft.names.contains(name), !draft.selected.contains(where: { tag in tag.name == name }) else { throw ValidationError(message: "此名称已选择") }
            /// 同名查询只有读取副作用。
            let existing = try await app.repository.checkTag(name)
            guard keyword == original, !closed else { return }
            // existing为服务端只读查重返回的同名有效标签，须按当前操作明确复用或报冲突。
            if let existing { reuse = existing }
            else { draft.names.append(name) }
        } catch { if keyword == original, !closed { self.error = error.localizedDescription } }
    }
}

/// UI 新名称路由，不作为业务 ID 使用。
struct NewTagNameRoute: Identifiable {
    /// 原草稿名称。
    let name: String
    /// 模态标识。
    var id: String { name }
}
