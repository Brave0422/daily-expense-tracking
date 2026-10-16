# 日常记账 · 原生 iOS

SwiftUI 原生工程，最低 iOS 17.0。使用 Observation、Swift Concurrency、URLSession、Keychain 和 Swift Charts，与现有 NestJS 共用账户、分类、标签和流水数据；没有第三方运行依赖。

入口是 [DailyExpenseTracking.xcodeproj](DailyExpenseTracking.xcodeproj)，共享 Scheme 为 `DailyExpenseTracking`。源码已生成；当前 Windows 环境完成静态检查，尚未经过 Xcode 编译、模拟器 / 真机运行和真实后端闭环验收。详细证据见 [实施记录](docs/11-implementation-report.md)。

## 在 Mac 上打开

1. 使用支持 iOS 17 SDK、Swift 5.9 或更高编译器的 Xcode，打开 `DailyExpenseTracking.xcodeproj`。工程采用 Swift 5 语言模式和完整并发检查。
2. 将 `Config/Local.xcconfig.example` 复制为 `Config/Local.xcconfig`，填写包含 `/api` 前缀的实际 `API_BASE_URL`，例如 `http://192.168.1.100:3000/api`。
3. 选择 `DailyExpenseTracking` Scheme 和 iPhone 模拟器，运行。真机需在 Signing & Capabilities 填自己的 Team 和唯一 Bundle ID。

```sh
cd ios
cp Config/Local.xcconfig.example Config/Local.xcconfig
open DailyExpenseTracking.xcodeproj
```

默认 Debug API 地址是 `http://localhost:3000/api`，它指向模拟器所在 Mac。如果后端在 Windows，请改成手机 / Mac 可达的 Windows 局域网地址，并确认后端监听地址、防火墙和数据库正常。`Local.xcconfig` 已忽略，不应放账号、密码或验证码。

Debug 的 ATS 例外仅用于本地网络与 localhost。Release 独立使用 `Config/Release.xcconfig`，无 HTTP 例外，也不读取本机覆盖。发布前须设置正式 HTTPS 地址、Bundle ID 和签名；默认 `api.example.invalid` 会被启动校验阻止。对其他开发 HTTP 域名，需在 Debug plist 精确添加该域的例外并在设备上验证。

## 工程内容

| 目录 | 用途 |
| --- | --- |
| `DailyExpenseTracking/App` | 启动恢复、依赖装配、身份路由、三个独立导航栈 |
| `Core` | 环境、传输、强类型响应、Cookie / Keychain、共享刷新、金额与自然日期 |
| `DesignSystem` | 浅深语义色、黄色分段、卡片、精确金额、分类图案与状态 |
| `Features/Auth` | 登录、注册、邮件验证码、重置 / 修改密码 |
| `Features/Transactions` | 日明细、年内汇总、筛选、快照详情、完整录入 / 编辑、归档 |
| `Features/Categories` / `Tags` | 有约束的配置维护、服务端搜索与流水标签事务草稿 |
| `Features/Statistics` | 独立排行、实心饼图、完整时间轴柱图与触摸摘要 |
| `Resources` | 112 个分类中心矢量 PDF、Asset Catalog、中文 String Catalog 与许可 |
| `DailyExpenseTrackingTests` | 金额、日期、请求、Cookie、刷新、身份隔离和查询竞态测试 |
| `DailyExpenseTrackingUITests` | 公开认证页验证；使用干净模拟器，不内置账号 |

Access Token 仅在内存；完整 Refresh Cookie 按 Bundle 与规范化 API 环境隔离存入 Keychain。业务数据和草稿仅在当前会话内存。写后统一使读取失效，可见页刷新，其余页下次进入读取。未知写入结果不会自动重试。

流水新增标签、改名标签均先放草稿，保存流水时一并事务提交；管理页的标签维护则立即写入。编辑流水不会发送 `type`，空标题 / 备注明确编码 `null`，清空标签明确编码 `[]`。

## 验证

在 Mac 上记录实际 Xcode、Swift 和 SDK 版本并编译三个目标：

```sh
bash tools/verify_on_macos.sh
xcrun simctl list devices available
SIMULATOR_ID=实际模拟器UDID bash tools/verify_on_macos.sh
```

日志与 `.xcresult` 输出到忽略的 `artifacts/`。UI 测试遇到已有 Keychain 会话会明确跳过；请使用独立的干净测试模拟器。完整业务、真实服务联调、最低系统 / 当前系统、真机 Keychain、深色、大字体和 VoiceOver 仍需按 [验收文档](docs/10-delivery-and-acceptance.md) 执行，不能以静态解析替代。

跨平台静态检查和资源再生成是可选开发工具，不参与 App 构建。Python 3.10+：

```sh
python3 -m venv .build-tools
.build-tools/bin/python -m pip install -r tools/requirements.txt
.build-tools/bin/python tools/check_project.py
```

Windows 使用 `.build-tools/Scripts/python.exe`。新增 Swift 文件后运行 `tools/generate_project.py` 更新显式工程引用；Web 图标变动后运行 `tools/prepare_resources.py`，再生成工程和检查。现有 PDF 资源已提交，日常 Xcode 构建无需 Python。

需求入口：[PRD](PRD.md)。所有自有方法、变量和关键节点包含中文说明；静态声明注释检查之外，后续修改仍需人工复核参数、闭包与业务规则。
