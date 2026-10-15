import SwiftUI
import Observation

/// 所有账户表单共用校验与验证码冷却，但保持独立敏感输入。
enum AuthMode: String, Identifiable {
    case login, register, reset, change
    /// 模态标识。
    var id: String { rawValue }
    /// 页面标题。
    var title: String { switch self { case .login: "登录"; case .register: "注册"; case .reset: "忘记密码"; case .change: "修改密码" } }
    /// 后端验证码用途。
    var purpose: String { switch self { case .register: "register"; case .reset: "reset_password"; case .change: "change_password"; case .login: "" } }
}

/// 账户输入和提交锁归属于当前表单，不保存密码到磁盘。
@MainActor @Observable final class AuthFormModel {
    /// 当前表单场景。
    var mode: AuthMode
    /// 原始邮箱输入。
    var email = ""
    /// 原始密码，不 trim。
    var password = ""
    /// 六位字符串验证码。
    var code = ""
    /// 主提交锁。
    var submitting = false
    /// 验证码发送锁。
    var sending = false
    /// 截止时间驱动冷却，后台不影响正确性。
    var cooldownUntil: Date?
    /// 持续错误提示。
    var error: String?
    /// 成功或部分成功提示。
    var notice: String?
    /// 显示密码开关。
    var showPassword = false
    /// 是否存在需要保护的输入。
    var dirty: Bool { !email.isEmpty || !password.isEmpty || !code.isEmpty }

    /// 创建场景状态；- Parameter mode: 当前账户场景。
    init(mode: AuthMode) { self.mode = mode }

    /// 当前剩余秒数；- Parameter date: 当前时间；- Returns: 向上取整秒数。
    func remaining(at date: Date) -> Int { max(0, Int(ceil(cooldownUntil?.timeIntervalSince(date) ?? 0))) }

    /// 发送真实邮件验证码；- Parameter app: 当前依赖；失败保留输入，频控继续冷却。
    func sendCode(app: AppModel) async {
        guard !sending, remaining(at: Date()) == 0 else { return }
        sending = true
        error = nil
        defer { sending = false }
        do {
            /// 修改密码不发送另一邮箱，身份由 Bearer 决定。
            let target = mode == .change ? nil : try TextRule.email(email)
            /// 邮件发送 JSON。
            struct Body: Encodable {
                /// register / reset_password / change_password。
                let purpose: String
                /// 仅公共场景存在。
                let email: String?
            }
            try await app.repository.client.write("/verification-codes/send", body: JSONEncoder().encode(Body(purpose: mode.purpose, email: target)), protected: mode == .change)
            cooldownUntil = Date().addingTimeInterval(60)
            notice = "验证码已发送，请查收邮件"
        } catch {
            // seconds为服务端提供的等待或有效秒数，用于计算截止时间。
            if let seconds = (error as? APIError)?.retryAfter { cooldownUntil = Date().addingTimeInterval(TimeInterval(seconds)) }
            self.error = error.localizedDescription
        }
    }

    /// 提交账户动作；- Parameter app: 当前依赖；- Returns: 重置或修改成功需要关闭页面时为 true。
    func submit(app: AppModel) async -> Bool {
        guard !submitting else { return false }
        submitting = true
        error = nil
        notice = nil
        defer { submitting = false }
        do {
            /// 变更密码没有邮箱字段。
            let target = mode == .change ? "" : try TextRule.email(email)
            try TextRule.credentials(password: password, code: mode == .login ? nil : code)
            if mode == .login {
                try await app.session.login(email: target, password: password)
                app.email = target
                password = ""
                code = ""
                return false
            }
            /// 注册与密码动作各自使用真实字段。
            struct Register: Encodable {
                /// 规范邮箱。
                let email: String
                /// 原始密码。
                let password: String
                /// 保留前导零的验证码。
                let code: String
            }
            /// 密码修改 / 重置请求。
            struct PasswordBody: Encodable {
                /// 仅重置密码需要邮箱。
                let email: String?
                /// 原始新密码。
                let newPassword: String
                /// 邮件验证码。
                let code: String
            }
            if mode == .register {
                try await app.repository.client.boolean("/auth/register", body: JSONEncoder().encode(Register(email: target, password: password, code: code)), protected: false)
                do {
                    try await app.session.login(email: target, password: password)
                    app.email = target
                } catch {
                    // 注册已提交，自动登录失败不能再次注册。
                    mode = .login
                    notice = "注册成功，请登录"
                    self.error = error.localizedDescription
                }
            } else {
                try await app.repository.client.boolean(mode == .change ? "/auth/changePassword" : "/auth/resetPassword",
                    body: JSONEncoder().encode(PasswordBody(email: mode == .change ? nil : target, newPassword: password, code: code)), protected: mode == .change)
                password = ""
                code = ""
                notice = mode == .change ? "密码修改成功，当前会话继续有效" : "密码重置成功，请登录"
                return true
            }
            password = ""
            code = ""
        } catch { self.error = error.localizedDescription }
        return false
    }
}

/// 品牌账户表单，输入字段有标签和系统自动填充。
@MainActor struct AuthView: View {
    /// 当前会话依赖。
    @Environment(AppModel.self) private var app
    /// 模态关闭动作。
    @Environment(\.dismiss) private var dismiss
    /// 当前表单拥有自己的输入。
    @State private var model: AuthFormModel
    /// 注册或重置子模态。
    @State private var destination: AuthMode?
    /// 放弃确认。
    @State private var confirmDiscard = false
    /// 成功提示确认后关闭。
    @State private var completed = false
    /// 密码显示切换后仍保持输入焦点。
    @FocusState private var passwordFocused: Bool
    /// 子账户场景即使自动登录失败切回登录，也保留明确关闭入口。
    private let presentsClose: Bool

    /// 初始化表单；- Parameter mode: 登录、注册或密码场景。
    init(mode: AuthMode) { _model = State(initialValue: AuthFormModel(mode: mode)); presentsClose = mode != .login }

    /// 单列可滚动表单。
    var body: some View {
        /// 当前可观察输入的局部绑定，不创建第二份敏感输入。
        @Bindable var form = model
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("账").font(.largeTitle.bold()).foregroundStyle(Theme.onPrimary).padding(18).background(Theme.primary, in: RoundedRectangle(cornerRadius: 20))
                        Text("日常记账").font(.largeTitle.bold())
                        Text(model.mode == .login ? "记录每一笔，生活更有数。" : model.mode.title).foregroundStyle(Theme.secondary)
                    }.padding(.top, 20)
                    LedgerCard {
                        VStack(alignment: .leading, spacing: 18) {
                            if model.mode != .change {
                                Text("邮箱").font(.subheadline)
                                TextField("请输入邮箱", text: $form.email).textContentType(.emailAddress).keyboardType(.emailAddress).textInputAutocapitalization(.never).autocorrectionDisabled().accessibilityIdentifier("auth.email")
                                Divider()
                            }
                            Text(model.mode == .login ? "密码" : "设置密码（6–20字符）").font(.subheadline)
                            HStack {
                                Group {
                                    if model.showPassword { TextField("请输入密码", text: $form.password) }
                                    else { SecureField("请输入密码", text: $form.password) }
                                }.focused($passwordFocused).textContentType(model.mode == .login ? .password : .newPassword).accessibilityIdentifier("auth.password")
                                Button {
                                    // 用户显隐密码时让新输入框重新接收焦点。
                                    model.showPassword.toggle()
                                    passwordFocused = true
                                } label: { Image(systemName: model.showPassword ? "eye.slash" : "eye").frame(width: 44, height: 44) }.accessibilityLabel(model.showPassword ? "隐藏密码" : "显示密码")
                            }
                            if model.mode != .login {
                                Divider()
                                Text("邮件验证码").font(.subheadline)
                                HStack {
                                    TextField("六位数字", text: $form.code).keyboardType(.numberPad).textContentType(.oneTimeCode)
                                    TimelineView(.periodic(from: .now, by: 1)) { context in
                                        // context.date 是实时截止时间计算基准，回前台立即正确。
                                        Button(model.remaining(at: context.date) > 0 ? "\(model.remaining(at: context.date))秒后重发" : "发送验证码") {
                                            Task { await model.sendCode(app: app) }
                                        }.disabled(model.sending || model.remaining(at: context.date) > 0).frame(minHeight: 44)
                                    }
                                }
                            }
                        }
                    }
                    // error为当前捕获的错误或持续错误提示，用于分类处理和就地反馈。
                    if let error = model.error { ErrorNotice(message: error) }
                    // notice为当前操作结果说明，用于持续展示已保存或处理位置。
                    if let notice = model.notice { Text(notice).foregroundStyle(Theme.secondary) }
                    Button {
                        Task { completed = await model.submit(app: app) }
                    } label: { if model.submitting { ProgressView() } else { Text(model.mode.title) } }
                        .buttonStyle(PrimaryButtonStyle()).disabled(model.submitting || model.sending).accessibilityIdentifier("auth.submit")
                    if model.mode == .login {
                        HStack {
                            Button("创建账户") { destination = .register }.frame(minHeight: 44)
                            Spacer()
                            Button("忘记密码") { destination = .reset }.frame(minHeight: 44)
                        }
                    }
                }.padding(24).frame(maxWidth: 560).frame(maxWidth: .infinity)
            }.background(Theme.page).navigationTitle(model.mode == .login ? "" : model.mode.title).navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    if presentsClose {
                        ToolbarItem(placement: .cancellationAction) { Button("取消") { if model.dirty { confirmDiscard = true } else { dismiss() } }.disabled(model.submitting) }
                    }
                }
        }
        .sheet(item: $destination) { mode in
            // mode 是子账户场景，模态取消不会修改父登录输入。
            AuthView(mode: mode)
        }
        .interactiveDismissDisabled(model.dirty || model.submitting)
        .confirmationDialog("放弃当前输入？", isPresented: $confirmDiscard, titleVisibility: .visible) {
            Button("放弃输入", role: .destructive) { dismiss() }
            Button("继续填写", role: .cancel) {}
        }
        .alert("操作成功", isPresented: $completed) { Button("好") { dismiss() } } message: { Text(model.notice ?? "操作成功") }
    }
}
