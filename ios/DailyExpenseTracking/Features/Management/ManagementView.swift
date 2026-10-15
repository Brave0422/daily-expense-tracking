import SwiftUI

/// 配置和账户安全入口，没有模板占位或不存在的账户资料接口。
@MainActor struct ManagementView: View {
    /// 当前会话依赖。
    @Environment(AppModel.self) private var app
    /// 修改密码模态。
    @State private var changingPassword = false
    /// 退出确认。
    @State private var confirmLogout = false
    /// 退出失败保留当前身份。
    @State private var error: String?
    /// 配置分组与账户安全。
    var body: some View {
        List {
            Section {
                HStack(spacing: 16) {
                    Text("账").font(.title.bold()).padding(16).foregroundStyle(Theme.onPrimary).background(Theme.primary, in: RoundedRectangle(cornerRadius: 16))
                    VStack(alignment: .leading, spacing: 6) { Text("日常记账").font(.title2.bold()); Text(app.email ?? "已登录").foregroundStyle(Theme.secondary) }
                }.padding(.vertical, 8)
            }
            Section("配置管理") {
                NavigationLink { CategoriesView() } label: { Label("分类管理", systemImage: "square.grid.2x2") }
                NavigationLink { TagsView() } label: { Label("标签管理", systemImage: "tag") }
            }
            Section("账户安全") {
                Button { changingPassword = true } label: { Label("修改密码", systemImage: "lock.rotation") }.frame(minHeight: 44)
                Button(role: .destructive) { confirmLogout = true } label: { Label("退出登录", systemImage: "rectangle.portrait.and.arrow.right") }.frame(minHeight: 44)
            }
            // error为当前捕获的错误或持续错误提示，用于分类处理和就地反馈。
            if let error { Section { ErrorNotice(message: "退出未完成，请重试：" + error) } }
            Section("关于") {
                LabeledContent("版本", value: Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0")
                Text("原生 iOS · 数据与 Web 共用同一服务").font(.footnote).foregroundStyle(Theme.secondary)
            }
        }.scrollContentBackground(.hidden).background(Theme.page).navigationTitle("管理")
            .sheet(isPresented: $changingPassword) { AuthView(mode: .change) }
            .confirmationDialog("退出当前账户？", isPresented: $confirmLogout, titleVisibility: .visible) {
                Button("退出登录", role: .destructive) {
                    Task {
                        do { try await app.session.logout() }
                        catch { self.error = error.localizedDescription }
                    }
                }
                Button("取消", role: .cancel) {}
            } message: { Text("成功后将清空本机当前会话、页面与未保存草稿。") }
    }
}
