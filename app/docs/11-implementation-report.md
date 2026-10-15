# 移动端实施与验证记录

日期：2026-10-14。目标：按 v1 移动端 PRD 生成可运行 Flutter 工程，复用现有 NestJS 业务接口。

## 交付内容

所有改动位于 `app/`。原 `PRD.md` 和 01–10 模块文档保留；没有改动 `web/` 或 `service-nest/` 的源码、API、环境文件和数据库结构。

| 阶段 / 需求 | 主要实现 | 文件入口 |
| --- | --- | --- |
| 工程基础、UI-01/02/03/05 | Android / iOS 工程、简体中文、Material 3、系统浅深色、三个底部导航、登录路由保护 | `pubspec.yaml`、`lib/main.dart`、`lib/app/`、`android/`、`ios/` |
| AUTH-01–07 | Cookie 安全持久化、启动恢复、双客户端、并发共享刷新、迟到 Token 单次重放、会话序号与清理锁 | `lib/core/network/api_client.dart`、`lib/core/storage/` |
| 账户流程 | 登录、注册及自动登录、邮件验证码截止冷却、忘记 / 修改密码、服务端确认后退出；普通失败保留输入 | `lib/features/auth/presentation/auth_page.dart`、`lib/features/account/` |
| CAT-01–04 | 收入一级、支出两级、名称 / 图标修改、归档删除前检查子类、110 个 SVG 图案适配 | `lib/features/categories/`、`assets/icons/categories/`、`tool/adapt_category_icons.ps1` |
| TAG-01/02 | 标签配置 CRUD、服务器搜索、300ms 去抖、取消旧请求、成功后保留关键词重查 | `lib/features/tags/` |
| TX-01–06 | 日明细、年内月汇总、独立筛选、精确金额、自然日期、创建 / 完整编辑 / 删除、历史归档关联 | `lib/features/transactions/` |
| TAG-03–05 | 同名确认复用、真实 ID 去重、新名称 / 改名随流水提交、解绑只取消草稿 | `lib/features/transactions/application/tag_drafts.dart`、`transaction_editor.dart` |
| STAT-01–05 | 独立排行 / 占比 / 趋势条件、触摸扇区与图例、原金额 Tooltip、完整周期零点、变化状态文案 | `lib/features/statistics/` |
| UI-04/06 | 表单草稿返回确认、提交锁、键盘滚动、配置面板明确关闭路径、中文大字体和图表文字替代 | `lib/core/widgets/` 与各页面 |
| 契约与联调 | Freezed / JSON 模型、查询白名单、重复键数组、空写入 data、跨模块查询失效、测试入口 | `lib/core/network/book_repository.dart`、`test/`、`integration_test/` |

客户端只使用 PRD 所列真实端点。编辑流水以当前日明细记录回填；缺少路由数据时回列表，没有伪造详情接口。未知图标显示占位；正式应用没有模拟 API、账单演示数据、本地数据库或离线队列。

## 数据与会话边界

- 金额录入 / 比较使用元字符串与整数分；标题、备注和名称按 Unicode 码点校验；业务日期不转 UTC。
- 日明细 / 月汇总各自构造参数，月汇总不发送标签、标题、备注。统计每个端点只带允许字段，收入强制一级。
- 登录与刷新等待 Cookie 保存；Access Token 仅在内存。Refresh Cookie 按主机、路径、有效期匹配，并补齐依赖库的 Secure 发送约束。
- 安全存储按完整 API 环境隔离；损坏索引先报告错误，不让依赖库静默删除并伪装成功。
- 刷新、Cookie 写入、退出与账号切换由身份序号和串行清理约束；旧登录、旧刷新和旧查询不能回写新账号。
- 成功写入后只让查询失效；查询失败不重复创建。写入超时标记结果未确认，提示先查询。
- 标签名称 / 改名只存页面草稿，保存流水才提交。原归档分类可保留、归档标签可保留或解绑，不能新绑定其他归档项。
- 配置编辑面板禁止通过遮罩 / 拖动绕过放弃确认，提供明确关闭按钮。系统返回由 `PopScope` 统一处理。

## 已执行的检查

| 检查 | 实际结果 |
| --- | --- |
| Flutter SDK / 依赖解析 | Flutter 3.47.7 stable、Dart 3.13.5；`pub get` 成功并提交 `pubspec.lock` |
| 模型生成 | `dart run build_runner build` 成功，生成对应 Freezed / JSON 产物 |
| 格式 | `dart format --output=none --set-exit-if-changed lib test integration_test tool`：通过 |
| 静态检查 | `flutter analyze --no-pub`：无问题 |
| 单元 / 契约 / 会话 / Widget | `flutter test --no-pub`：20 项通过；真后端测试默认跳过 1 项 |
| 注释声明 | `dart run tool/check_comments.dart`：0 项缺失；生成文件排除 |
| 真实 NestJS 闭环 | 单独开启 `RUN_LIVE_TESTS`：1 项通过，覆盖注册、登录、验证码用途、修改 / 重置密码、配置、流水、三类统计、月汇总、清空关联、删除、Cookie 恢复和退出 |
| iOS 配置结构 | 4 个 plist / entitlement 文件 XML 解析通过，Debug / Release 配置引用已核对 |
| Android Debug 构建 | `flutter build apk --debug --no-pub`：通过，产物 `build/app/outputs/flutter-apk/app-debug.apk` |

会话测试实际覆盖：无 Cookie 启动、并发 401 共享刷新、迟到旧 Token、不超过一次重放、重启 Cookie 轮换、503 保留凭证、退出期间迟到刷新、迟到旧账号登录、安全存储写入失败、Secure / 路径 / 过期与损坏索引。

页面测试覆盖：恢复入口不闪业务页、登录失败输入保留、窄屏表单校验与放弃确认；360×800、1.8 倍字体下浅深主题、非空排行 / 饼图 / 趋势切换及下降比例文案。实际 Widget 渲染 PNG 存在 `build/ui_preview/`，属于测试截图；它们不是设备截图。系统中文字体仅为 Windows 测试读取，不随项目分发。

真实联调临时启动现有已编译后端的开发实例，使用专用端口与进程级固定验证码，跳过真实 SMTP，不改变后端配置文件。每轮注册独立 `mobile-test-*` 测试账号；本轮创建的分类、标签和流水已经归档清理。测试账号及归档历史保留，服务端没有用户注销或物理清理端点。

## 注释复查与工具

手写模型字段、Provider、变量、方法和参数使用中文说明；会话恢复 / 轮换 / 清理、金额 / 日期、标签草稿、读请求取消、写后失效与图表原值分别有关键节点说明。自动检查覆盖变量声明与具名方法 / 构造器；回调语义、参数说明和注释准确性另外人工复查，不将自动检查等同于全部语义验收。

本机 SDK、Android SDK 与 JDK 路径存于忽略的 `toolchain.local.json`。Windows 包装脚本只在本次命令中设置工具链并在结束后恢复环境。构建期间遇到 Java 临时 socket 和 JRE 缺少 jlink、编译进程内存不足；通过短临时路径、完整 JDK 21 和降低并发完成构建，没有修改系统 PATH、网络或安全设置。

## 待验证与发布准备

1. `integration_test/app_flow_test.dart` 已提供真设备与原生安全存储的闭环入口；本次没有执行 Android / iOS 设备测试。真实后端测试使用原生 Dio 网络，但安全存储是测试替身，不据此声称已验证原生 Keychain / Android 加密。
2. iOS 编译、签名、Keychain 实机恢复、返回手势和本地网络授权需在 macOS / Xcode 验证；XML 检查不等于 iOS 构建成功。
3. Android 安装运行、进程重启恢复、弱网与平台返回，仍需在模拟器 / 真机完成设备验收。
4. 发布前配置正式 HTTPS 地址、applicationId / Bundle ID、开发团队、正式签名及商店信息。当前 APK 为开发调试构建。
5. 真实 SMTP 发信未测试；联调使用固定开发验证码。各模块复杂异常、很多分类 / 标签、横屏和更高字体倍率仍需设备人工验收。
