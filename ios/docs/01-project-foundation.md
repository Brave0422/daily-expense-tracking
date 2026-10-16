# 01 项目基础与架构

[返回主 PRD](../PRD.md) · [认证](03-authentication.md) · [API](09-api-contracts.md)

## 1. 原生技术方案

| 技术 | 职责与约束 |
| --- | --- |
| Swift + SwiftUI | 原生界面、NavigationStack、TabView、表单和 Sheet |
| Observation | `@Observable` 管理页面状态，UI 状态由 MainActor 隔离 |
| Swift Concurrency | async / await、任务取消；actor 协调会话和凭证写入 |
| Foundation URLSession | HTTP、JSON 请求、状态码、超时与取消 |
| Codable | DTO 序列化，区分缺失、null、字符串金额与数值 ID |
| Security / Keychain | 完整 Refresh Cookie 安全持久化，按 API 环境隔离 |
| Swift Charts | SectorMark 实心饼图、BarMark 柱图及原生触摸选择 |
| Asset Catalog + SF Symbols | 转换后的分类中心图案与系统操作图标 |
| XCTest / XCUITest | 业务与会话契约、关键真实页面流程 |

首版以 Apple 框架为主，不要求引入第三方架构、网络或图表依赖。最低部署版本 iOS 17.0；项目创建时选择可用稳定版 Xcode / Swift 编译器，记录版本并启用对应并发检查。所有选用 API 均须支持最低系统或提供兼容分支。

## 2. 建议的后续工程组织

以下为工程组织基线；初始文档轮次仅提供示意，后续已授权生成原生源码，实际内容见 [运行说明](../README.md) 与 [实施记录](11-implementation-report.md)：

```text
ios/
├── PRD.md
├── docs/                         本次 PRD 与截图
├── DailyExpenseTracking.xcodeproj/ 后续生成
├── DailyExpenseTracking/
│   ├── App/                      入口、依赖装配、会话路由、主导航
│   ├── Core/
│   │   ├── Configuration/        环境与服务地址
│   │   ├── Networking/           URLSession、响应与错误、请求构造
│   │   ├── Authentication/       会话协调、刷新任务、身份代次
│   │   ├── Storage/              Keychain Cookie 存取
│   │   └── Utilities/            精确金额、自然日期、文本校验
│   ├── DesignSystem/             Token、卡片、金额、状态、分类图标
│   ├── Features/                 Auth、Transactions、Categories、Tags、Statistics、Management
│   └── Resources/                Assets、中文文案、许可
├── DailyExpenseTrackingTests/
└── DailyExpenseTrackingUITests/
```

Feature 内按实际复杂度组织 Model / Service / Repository / ViewModel / View；单一文件不堆放整个模块，简单组件不为凑层级增加空协议。

## 3. 分工与状态所有权（BASE-01）

- View 负责呈现和用户事件，不直接处理 Cookie、JSON 或发 HTTP。
- ViewModel 管理查询条件、页面结果、表单草稿、加载和错误；提交动作调用 Repository。
- Repository 隔离业务读取与写入；Service / APIClient 负责 HTTP 和 DTO。对视图暴露明确业务结果，不传散装字典。
- SessionCoordinator actor 是内存 Token、刷新任务和身份代次的唯一协调点；CredentialStore 封装 Keychain。
- DesignSystem 集中维护视觉 Token；各页复用金额、分类图标、分段控件和查询状态。
- 登录身份、已应用查询、面板草稿、服务端结果和未提交表单分别持有，不通过全局可变单例共享表单。

导航和业务缓存作用域是当前登录会话。切换 Tab 保留筛选、展开项、滚动位置与统计条件；重启后恢复会话但默认重新查询当前周期。退出或身份失效必须释放上一身份的所有状态。

## 4. 网络与环境（BASE-02）

- 通过构建配置提供 `API_BASE_URL`。直连 NestJS 示例为 `http://localhost:3000/api`；Web、原生客户端及反向代理统一保留 `/api` 前缀。
- 模拟器连接其所在 Mac 的本地后端可用 localhost；Windows 上的服务应填 Mac / 设备可达的 Windows 局域网地址。真机 localhost 指向手机自身。
- Debug 如需访问开发 HTTP / 局域网，单独配置最小范围的 ATS 例外与所需本地网络说明，在设备验证；Release 只允许正式 HTTPS。
- 不内置真实账号、密码或固定验证码。开发固定验证码只能由现有后端开发配置提供，不能让 iOS 绕过认证。
- 请求仅发送到配置的受信 API；跨源重定向不得携带 Authorization / Refresh Cookie。
- 读取请求支持取消及最新响应校验；超时、取消、HTTP 错误、业务失败、结构解码失败分别表达。

## 5. 数据生命周期（BASE-03）

业务不落地账单数据库，不采用 SwiftData、Core Data、SQLite、离线写入队列或客户端同步协议。UserDefaults 只可保存非敏感偏好；敏感凭证按认证模块存 Keychain。

业务响应仅在当前会话内存缓存；URLSession 使用不落盘的配置并避免磁盘响应缓存。正在编辑的表单在当前进程、当前会话保留，进程终止不承诺恢复。网络恢复后由用户明确提交或刷新，不后台补写。

| 写入事件 | 必须失效的读取结果 |
| --- | --- |
| 流水新增 / 编辑 / 删除 | 日明细、月汇总、全部统计；涉及标签时标签列表 / 搜索 / 筛选选项 |
| 分类新增 / 编辑 / 删除 | 分类树、录入 / 筛选选项、流水历史展示、统计 |
| 标签新增 / 改名 / 删除 | 标签列表 / 搜索 / 选项、流水历史与编辑数据；统计不按标签过滤 |
| 成功退出 / 身份失效 | 所有业务、导航、草稿、任务与当前身份凭证 |

可见查询及时重查，不可见查询标记失效并在下次进入时重查。没有服务端推送：Web 或另一设备改动通过下拉刷新、重入已失效页面或回前台刷新获得；表单未保存时不以新结果覆盖草稿。

写成功但重查失败是两个阶段的结果：显示“已保存，刷新失败”，不再次写入。传输超时且无法判定是否提交时显示“结果尚未确认”，先查询核实，不自动重试写入。

## 6. 取消、身份与前后台（BASE-04）

每次查询使用条件快照和递增请求序号，并检查身份代次；旧响应、旧错误、旧结束回调不得覆盖新状态。取消不弹失败提示，不能只依赖取消就省略响应校验。

启动顺序为安全存储 → 会话恢复 → 受保护导航 → 业务加载。回前台重新计算验证码冷却与 Cookie 有效期；可见只读页按失效情况刷新。后台不新增常驻同步任务。

会话失效时立即遮挡旧业务并清栈；不跨身份自动恢复敏感表单。用户自行返回而未失效时，表单草稿受统一放弃确认保护。

## 7. 验收

- BASE-01：各状态只有明确所有者，切 Tab 保留、退出清空，不串账号。
- BASE-02：原生正确直连接口，Debug / Release 配置隔离，Release 不依赖 Vite。
- BASE-03：写后失效覆盖完整，保存成功后刷新失败不重复创建。
- BASE-04：快速条件切换、切账号与回前台时，不出现旧结果回写。

平台选型依据见 [00 官方参考](00-sources-and-references.md#4-原生能力参考)，详细会话要求见 [03](03-authentication.md)。
