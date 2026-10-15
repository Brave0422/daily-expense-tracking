import SwiftUI

/// 原生 iOS 入口，无 WebView 或 Flutter 运行时。
@main @MainActor struct DailyExpenseTrackingApp: App {
    /// 已装配的应用状态。
    @State private var model: AppModel?
    /// 配置失败需要在启动页显示。
    @State private var configurationError: String?
    /// 跟踪前后台，回前台使可见只读查询失效。
    @Environment(\.scenePhase) private var scenePhase
    /// 单窗口原生应用场景。
    var body: some Scene {
        WindowGroup {
            Group {
                // model为已完成装配的应用状态，仅在存在时进入对应路由。
                if let model { RootView().environment(model) }
                // configurationError为启动环境配置错误，阻止错误地址进入业务。
                else if let configurationError { ContentUnavailableView("服务地址未配置", systemImage: "network", description: Text(configurationError)) }
                else { ProgressView("正在准备账本…") }
            }
            .tint(Theme.text).foregroundStyle(Theme.text)
            .task {
                // 仅装配一次；没有正式配置不回落到 mock。
                guard model == nil else { return }
                do { model = AppModel(configuration: try AppConfiguration()) }
                catch { configurationError = error.localizedDescription }
            }
            .onChange(of: scenePhase) { _, value in
                // value 是当前场景阶段；编辑草稿不绑定读取结果，因此不会被刷新覆盖。
                if value == .active { model?.changed() }
            }
        }
    }
}

/// 恢复结束前不展示登录或上一身份业务。
@MainActor struct RootView: View {
    /// 根依赖。
    @Environment(AppModel.self) private var app
    /// 按认证状态选择唯一页面栈。
    var body: some View {
        Group {
            switch app.phase {
            case .restoring: ProgressView("正在恢复会话…")
            case .signedOut: AuthView(mode: .login)
            case .authenticated, .signingOut:
                MainTabs().id(app.identity).disabled(app.phase == .signingOut)
                    .overlay { if app.phase == .signingOut { ProgressView("正在退出…").padding().background(Theme.surface, in: RoundedRectangle(cornerRadius: 12)) } }
            case .recoveryFailed(let message):
                VStack(spacing: 20) {
                    ErrorNotice(message: message) { Task { await app.session.restore() } }
                    Button("清理本地会话并重新登录") { Task { await app.session.discardCredentials() } }
                }.padding()
            case .credentialFailed(let message):
                VStack(spacing: 20) {
                    ErrorNotice(message: message)
                    Button("清理凭证并重新登录") { Task { await app.session.discardCredentials() } }.buttonStyle(PrimaryButtonStyle())
                }.padding()
            }
        }.background(Theme.page).task { await app.start() }
    }
}

/// 三个入口各自保留 NavigationStack 与页面状态。
@MainActor struct MainTabs: View {
    /// 原生底部导航与中文名称。
    var body: some View {
        TabView {
            NavigationStack { TransactionsView() }.tabItem { Label("流水", systemImage: "list.bullet.rectangle") }
            NavigationStack { StatisticsView() }.tabItem { Label("统计", systemImage: "chart.pie") }
            NavigationStack { ManagementView() }.tabItem { Label("管理", systemImage: "slider.horizontal.3") }
        }
    }
}
