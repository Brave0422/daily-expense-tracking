# 日常记账移动端

Flutter Android / iOS 客户端，默认简体中文。功能包括账户认证、分类与标签管理、流水日明细与年内月汇总、筛选和记账、分类排行、占比及收支趋势。正式流程连接现有 NestJS API，必须联网使用。

原始需求入口：[PRD.md](PRD.md)。实施及验证记录：[docs/11-implementation-report.md](docs/11-implementation-report.md)。本次保留原有 PRD 与模块文档，未修改 Web 或后端代码。

## 工具链

本次生成及检查使用 Flutter **3.47.7 stable**、Dart **3.13.5**。依赖锁定在 `pubspec.lock`；Freezed 4、Riverpod 3、go_router 18 的代码与此工具链兼容。Android 工程使用 SDK 36、Flutter 默认最低 SDK 24、Gradle 9.3.1；iOS 构建需 macOS / Xcode。

## 运行

浏览器预览在 `app/` 执行 `flutter run -d chrome`，默认打开 `http://localhost:5174`。`web_dev_config.yaml` 将原有接口路径同源转发到本机 `3000` 服务，按实际服务地址修改 `target`。`app/web/` 为 Flutter 入口，独立于仓库根目录的 Vue `web/`。

Web 的 HttpOnly Refresh Cookie 由浏览器接收和发送，Access Token 仍只存内存；原生端继续使用安全存储。手机浏览器预览使用 `flutter run -d web-server --web-hostname=0.0.0.0`，打开电脑局域网 IP 的 `5174` 端口。完整步骤见[启动和浏览flutter项目的方式](../启动和浏览flutter项目的方式.md)。

在 `app/` 中执行：

```powershell
flutter pub get
dart run build_runner build
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000
```

原生端默认地址是 Android 模拟器访问开发电脑的 `10.0.2.2:3000`。真机改为开发电脑可访问的局域网地址，例如 `http://192.168.1.10:3000`；iOS 模拟器可使用 `http://localhost:3000`。服务端路由没有 Web 的 `/api` 前缀。

Windows 可以复制 `toolchain.example.json` 为 `toolchain.local.json`，填写本机 Flutter SDK、Android SDK、完整 JDK 和短临时目录，再使用包装脚本。此文件已被 Git 忽略，本次开发电脑已配置，不更改系统 PATH。

```powershell
.\tool\flutter.ps1 run --dart-define=API_BASE_URL=http://10.0.2.2:3000
.\tool\flutter.ps1 build apk --debug --no-pub
```

包装脚本在结束时恢复调用者的环境变量。Android 构建需要完整 JDK，只有 `java.exe` 的 JRE 不能完成 `jlink` 步骤。Windows 上若 Java 提示 `Unable to establish loopback connection`，配置 `javaTemporaryDirectory` 为可写短路径。构建限制内存和并发，首次会下载 Gradle / Maven 依赖。

生产必须通过 `API_BASE_URL` 配置 HTTPS：

```powershell
flutter build appbundle --release --dart-define=API_BASE_URL=https://your-service.example.com
```

发布前需要设置正式 applicationId / Bundle ID、签名和商店信息。脚手架的 release 调试签名不可作为正式发布签名。Android HTTP 例外只在 debug；iOS debug 使用独立的 `Info-Debug.plist`，Release 不放行任意 HTTP。iOS Keychain entitlement 已分别接入构建配置，但尚需在 Xcode 配置开发团队并完成平台验收。

## 实现组织

```text
lib/app/                         主题、路由、启动恢复、底部导航
lib/core/config/                 API 地址与发布 HTTPS 校验
lib/core/network/                Dio、会话协调、Service、Repository
lib/core/storage/                安全 Cookie、串行写入与 Secure 约束
lib/core/utils/                  精确金额、自然日期、Unicode 码点校验
lib/core/widgets/                查询状态、表单返回保护、周期与图标
lib/features/                   各业务模型、查询 / 草稿与页面
assets/icons/categories/         110 个适配 SVG 及许可说明
test/                           单元、契约、会话、页面和布局测试
integration_test/               真设备闭环测试入口
tool/                           Windows 运行、图标适配、注释检查
```

Riverpod 管理会话快照、可取消查询和写入失效；不可变模型由 Freezed / json_serializable 生成。View 通过 Repository 访问数据，Service 封装统一网络请求。Access Token 仅保存在内存；原生端的完整 Refresh Cookie 在平台安全存储中按 API 环境隔离，Web 交给浏览器管理 HttpOnly Cookie。并发 401 共享刷新，每个请求最多重放一次；普通写入超时不自动重试。

日明细和月汇总各自保留筛选，统计三板块各自保留条件。流水标签新增 / 改名仅形成页面草稿，在流水事务中提交。金额业务比较使用整数分，只有图表坐标转换为 double。业务自然日期不经过 UTC 转换。没有本地账单数据库或离线写入。

## 检查

```powershell
dart format --output=none --set-exit-if-changed lib test integration_test tool
flutter analyze --no-pub
flutter test --no-pub
dart run tool/check_comments.dart
flutter build apk --debug --no-pub
```

`check_comments.dart` 自动检查手写变量声明、具名函数、构造器和方法的中文注释；生成产物不手改。参数、回调及关键流程的注释准确性还需人工复核。布局测试在 Windows 上读取系统中文字体供截图检查，不将系统字体复制进工程；图像输出到忽略的 `build/ui_preview/`。

真后端测试默认跳过，避免普通测试写入用户服务。启用前使用专用开发服务配置固定验证码，服务端将跳过真实邮件；勿在生产运行。测试注册独立 `mobile-test-*` 账号，归档本轮流水、分类与标签；用户账号与历史归档条目保留，因为服务端没有账户注销 / 物理清理接口。

```powershell
$env:LIVE_API_URL = 'http://localhost:3000'
$env:LIVE_TEST_CODE = '<开发环境固定六位验证码>'
flutter test test/live_backend_test.dart --dart-define=RUN_LIVE_TESTS=true
```

真设备测试必须使用独立测试账号并预先具备可用的支出二级分类，安全存储采用独立测试命名空间：

```powershell
flutter test integration_test/app_flow_test.dart -d <设备ID> --dart-define=API_BASE_URL=<服务地址> --dart-define=E2E_EMAIL=<测试邮箱> --dart-define=E2E_PASSWORD=<测试密码>
```

图标源来自 Web 原有 SVG，许可保留于 `assets/icons/categories/THIRD_PARTY_NOTICES.md`。需要重新适配时在 `app/` 执行 `.\tool\adapt_category_icons.ps1`，然后 `dart format lib/core/widgets/category_icon_keys.dart`。该脚本只更新 App 的中心图案和映射，背景由 Flutter 根据后端颜色绘制。
