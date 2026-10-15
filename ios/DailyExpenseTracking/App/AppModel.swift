import SwiftUI
import Observation

/// 当前登录会话的依赖、路由和缓存失效入口。
@MainActor @Observable final class AppModel {
    /// 当前路由状态。
    var phase: SessionPhase = .restoring
    /// 会话身份标识，用于释放全部业务导航和表单。
    var identity = UUID()
    /// 业务写入和回前台后递增，三 Tab 读取按需失效。
    var revision = 0
    /// 仅当前登录输入可信；Cookie 恢复不伪造邮箱。
    var email: String?
    /// 当前环境配置。
    let configuration: AppConfiguration
    /// 会话唯一协调器。
    let session: SessionCoordinator
    /// 当前会话业务仓库。
    let repository: LedgerRepository

    /// 装配正式依赖；- Parameter configuration: 受信环境。
    init(configuration: AppConfiguration) {
        self.configuration = configuration
        session = SessionCoordinator(configuration: configuration, transport: URLSessionTransport(), store: KeychainCredentialStore(namespace: configuration.credentialNamespace))
        repository = LedgerRepository(client: APIClient(session: session))
    }

    /// 根视图生命周期内订阅路由；恢复并发执行，状态流先安装再请求。
    func start() async {
        /// 会话状态流。
        let stream = await session.states()
        // 订阅建立后启动恢复，避免丢失认证完成事件。
        Task { await session.restore() }
        // value 是每次会话阶段，UI 始终在 MainActor 更新。
        for await value in stream {
            if Task.isCancelled { return }
            if value == .signedOut || isBlocking(value) {
                identity = UUID()
                email = nil
            }
            phase = value
        }
    }

    /// 存储故障必须销毁业务视图；- Parameter phase: 待判断状态；- Returns: 是否阻断业务。
    private func isBlocking(_ phase: SessionPhase) -> Bool {
        if case .credentialFailed = phase { return true }
        return false
    }

    /// 写成功后统一失效；不可见 Tab 在下次进入读取，不重复写入。
    func changed() { revision += 1 }
}
