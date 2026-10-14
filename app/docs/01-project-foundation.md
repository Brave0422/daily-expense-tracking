# 01 项目基础与架构

[返回主 PRD](../PRD.md) · [代码规范](02-flutter-code-standards.md) · [API 契约](09-api-contracts.md)

## 1. 技术选型

| 依赖 / 工具 | 职责 |
| --- | --- |
| Flutter stable + 配套 Dart | Android / iOS 工程与 Widget |
| Material 3、按需 Cupertino | 主题、基础组件和平台交互 |
| `flutter_riverpod` | 页面状态、异步数据与依赖注入 |
| `go_router` | 路由、底部导航分支与登录访问控制 |
| `dio` | HTTP、拦截器、取消和超时 |
| `dio_cookie_manager` + `cookie_jar` | 现有 Refresh Cookie 接入 |
| `flutter_secure_storage` | Cookie 自定义安全持久化 |
| `freezed_annotation` + `json_annotation` | 不可变模型及序列化声明 |
| `flutter_svg` | 适配后的分类图案 |
| `fl_chart` | 饼图、趋势柱状图及必要图表交互 |
| `flutter_localizations`、按需 `intl` | 中文日期控件与本地化格式 |
| `build_runner`、`freezed`、`json_serializable` | 开发期模型代码生成 |
| `flutter_lints`、`flutter_test`、`integration_test` | 静态检查与测试 |

创建工程时记录实际 Flutter / Dart 版本，确认依赖兼容性并提交 `pubspec.lock`。不机械沿用过期教程的版本、Riverpod API 或平台配置。v1 使用手动声明的 Riverpod Provider，无需额外引入 Provider 代码生成工具。

不引入 SQLite、Drift、离线队列、第二套状态管理框架或 WebView 页面壳。也不为简单 CRUD 强制建立完整 Domain / UseCase 层。

## 2. 目录建议

```text
app/
├── PRD.md
├── docs/                         # 本次建立的需求文档
├── lib/
│   ├── main.dart                 # 启动与 ProviderScope
│   ├── app/                      # 根应用、主题、路由、启动恢复页面
│   ├── core/
│   │   ├── config/               # API 地址与运行环境
│   │   ├── network/              # Dio、响应解包、错误与刷新协调
│   │   ├── storage/              # Cookie 安全存储适配
│   │   ├── utils/                # 精确金额、自然日期等通用逻辑
│   │   └── widgets/              # 通用加载、错误、输入等组件
│   └── features/
│       ├── auth/
│       ├── transactions/
│       ├── categories/
│       ├── tags/
│       ├── statistics/
│       └── account/              # 我的页面，组合账户与配置入口
├── assets/icons/categories/
├── test/                         # 镜像业务目录
├── integration_test/
├── android/
├── ios/
├── analysis_options.yaml
└── pubspec.yaml
```

每个业务目录按需设 `presentation/`、`application/`、`data/`：页面与组件放 presentation；状态模型与 Notifier 放 application；API Service、Repository 和数据模型放 data。不要先创建大量没有职责的空文件。

## 3. 依赖方向与职责

| 层 | 责任 | 不应承担的任务 |
| --- | --- | --- |
| View / Widget | 展示、输入、导航、动画 | 直接拼接口、写 Cookie 或计算服务器合计 |
| ViewModel / Notifier | 页面状态、校验、动作协调 | 重复实现全局 Token 刷新 |
| Repository | 业务请求与模型转换、相关数据刷新 | 依赖 BuildContext 或直接弹提示 |
| Service | 现有 HTTP 端点、查询 / 请求序列化 | 决定页面导航或混入表单状态 |
| core network / storage | 通用网络、Cookie、安全存储与错误 | 保存某个页面的业务草稿 |

Riverpod 负责创建并注入 Dio、Cookie Jar、Repository 和页面状态；避免全局可变单例。会话全局共享，具体筛选和表单草稿属于页面或业务模块。

## 4. 请求与数据状态

- 每个查询具有加载、成功、空结果和错误状态。刷新时可以保留当前进程已加载的内容，但必须说明刷新失败，不能标成最新数据。
- 不把业务数据持久化到本地。表单未提交草稿仅在当前页面 / 进程保留，关闭或退出登录后清除。
- 使用不可变状态；展示结果与编辑草稿分开，取消编辑不能改变原记录。
- 读请求支持取消；同时使用请求序号或条件标识，防止旧响应覆盖新的筛选结果。
- 写请求提交期间禁用重复提交。取消页面不代表服务端回滚，超时也不代表写入必然失败。
- POST / PATCH / DELETE 不因超时或网络错误自动重试。认证守卫拒绝请求后的单次 401 重放遵循认证文档。
- 写入成功后通知关联查询失效，并在相关页面可见时重查；不要继续展示被修改前的数据为最新。
- 会话变化时取消旧请求、清空页面状态和内存缓存，用会话序号阻止旧响应污染新账号。

## 5. 配置与运行

- API 地址通过 `--dart-define=API_BASE_URL=...` 注入，在集中配置类中读取和校验。
- 默认接口路径直接为 `/auth`、`/transactions` 等，不照搬 Web 的 Vite `/api` 代理。
- 如果实际部署有网关前缀，地址与 Cookie Path 必须一并验证；不能盲目改写服务端 Cookie。
- 真机使用可访问的局域网或部署地址；手机 `localhost` 不是开发电脑。生产环境使用 HTTPS。
- Dio 的连接、发送和接收超时需显式配置，初版可从 15 秒开始，分别转换为可理解的错误。
- 安全存储按环境 / API 主机区分命名空间，切换服务地址不能复用另一服务的认证 Cookie。
- Android 需要网络权限；开发 HTTP 如需平台例外，限定开发环境。iOS 按当前插件说明配置 Keychain 等能力。

建议初始化命令（后续生成阶段执行，本次不执行）：

```powershell
cd app
flutter create --project-name daily_expense_tracking --platforms=android,ios .
```

初始化前保护 `PRD.md` 与 `docs/`，不得因脚手架生成而清空需求文件。应用中文名默认“日常记账”；发布用 applicationId、Bundle ID、签名与商店资料在发版阶段确定。

## 6. 模块数据刷新关联

| 已完成操作 | 应失效 / 刷新的数据 |
| --- | --- |
| 新增 / 编辑流水 | 流水日明细、月汇总、统计；若包含标签草稿，则包括标签列表 |
| 删除流水 | 流水、统计、标签列表与标签筛选项；后端可能归档独占标签 |
| 分类新增 / 编辑 / 删除 | 分类管理、流水选项 / 历史展示、各统计板块 |
| 标签新增 / 编辑 / 删除 | 标签管理、流水选项与历史标签展示；保留现有有效筛选 |
| 退出 / 会话失效 / 更换账号 | 清空全部属于旧会话的业务状态与草稿 |

## 7. 本文验收

- 工程能在 `app/` 初始化且保留文档，实际依赖版本有记录。
- 页面不直接调用 Dio；API 地址、Cookie、响应和错误处理集中维护。
- 业务状态不持久化；网络失败不触发静默离线写入。
- 读请求取消和账号切换不会造成旧数据回写。

架构参考：[Flutter 官方建议](https://docs.flutter.dev/app-architecture/recommendations)。具体业务分层和全部注释要求以本项目文档为准。
