# Daily Expense Tracking

一个面向个人日常消费场景的多端记账系统。PC Web、NestJS 服务端和 Flutter 移动端的初版已完成；后续移动端改用 **Swift + SwiftUI 原生 iOS** 实现，复用现有账户、流水、分类、标签和统计 API。Android 后续另行规划。

项目采用联网使用模式，业务数据以服务端为准。移动端首版不提供离线记账或本地账单同步功能。

## 当前进度与功能

| 客户端 / 服务 | 当前状态 | 功能范围 |
| --- | --- | --- |
| PC Web | 初版功能已完成 | 账户认证、流水管理、分类与标签配置、收支统计 |
| NestJS 服务端 | 初版功能已完成 | 对应业务 API、双 Token 认证、数据校验与持久化 |
| 原生 iOS | 分模块 PRD 已建立，原生工程待生成 | SwiftUI 原生交互，视觉接近 Web，复用现有业务 API |
| Flutter 移动端 | 初版已实现，保留为历史实现与参考 | 现有 Android / iOS 工程与验证记录见 `app/` |

已实现的主要功能：

- 账户：注册、登录、退出登录、验证码、忘记密码和修改密码。
- 流水：新增、编辑、归档删除，按日查看明细、按月查看汇总，以及分类、标签、金额、标题和备注等条件筛选；不同视图支持的筛选条件以接口契约为准。
- 分类：收入与支出分类、支出一级 / 二级分类、自定义名称与图标、归档删除。
- 标签：新增、编辑、归档删除、搜索及重名检查；流水表单支持在提交流水时一并创建或修改标签。
- 统计：按月 / 年查看分类排行、分类占比、收支趋势，以及与上一个月 / 年的比较。

预算管理与录入模板尚未实现，不属于当前初版功能范围。

## 项目结构

```text
daily-expense-tracking/
├── web/           # PC Web 客户端，初版已完成
├── service-nest/  # NestJS 服务端，初版已完成
├── ios/           # 新的原生 iOS 方向；本轮仅有 PRD 和 Web 设计参考图
└── app/           # 已有 Flutter 客户端、历史 PRD 与实施记录
```

## 已实现的 Web 与服务端技术栈

### PC Web

目录：`web/`

- Vue 3 + TypeScript + Vite：页面开发、类型检查与构建。
- TDesign Vue Next + Tailwind CSS：业务组件、布局与样式。
- Vue Router：页面路由与登录访问控制。
- Pinia：登录会话等全局状态。
- Axios：HTTP 请求、Bearer Token 注入、认证刷新与错误处理。
- Apache ECharts 6.1.0：分类占比使用实心饼图、收支趋势使用竖向柱状图；按需引入 PieChart、BarChart、Grid、Tooltip、Aria 和 CanvasRenderer。分类排行使用原生页面列表。
- 本地 SVG 分类图标与 Iconfont Symbol：分类图案、继承背景色和通用操作图标；分类资源保留来源及 MIT 许可说明。
- Zod：认证表单数据校验。
- Vitest + Vue Test Utils：单元测试与组件测试。
- ESLint + Oxlint + Prettier：代码检查与格式化。

当前服务端数据请求由 Axios 和业务组合函数管理，尚未引入 TanStack Vue Query；图表未使用 `vue-echarts` 包装组件。Playwright 不属于当前 `package.json` 中的测试依赖。

UI 优先使用 TDesign 业务组件，Tailwind 主要负责布局、间距和响应式适配。统一换肤优先使用 Design Token 和 CSS 变量，避免大范围覆盖组件内部样式。

### NestJS 服务端

目录：`service-nest/`

- NestJS 11 + TypeScript：REST API 与业务模块。
- TypeORM + MySQL：数据访问、事务与持久化。
- JWT：Access Token 和 Refresh Token 双 Token 认证。
- bcrypt：密码及 Refresh Token 哈希。
- class-validator + class-transformer：DTO 校验与数据转换。
- cookie-parser：Refresh Token Cookie 读取。
- Nodemailer：账户相关邮件验证码。
- Jest + Supertest：单元测试与端到端 API 测试。
- ESLint + Prettier：代码检查与格式化。

当前模块包括：

| 模块 | 职责 |
| --- | --- |
| `auth` | 注册、登录、令牌签发与轮换、会话注销、密码修改与重置 |
| `users` | 用户数据与账户查询 |
| `verification-codes` | 验证码生成、用途校验与发送频控 |
| `mail` | 邮件发送 |
| `categories` | 用户分类、分类图标及归档管理 |
| `tags` | 用户标签、搜索、重名检查及归档管理 |
| `transactions` | 流水创建、编辑、归档、日明细与月汇总 |
| `statistics` | 月 / 年分类排行、占比与收支趋势 |

## 认证与 API 约定

### 当前双 Token 流程

1. 登录成功后，响应 JSON 返回 Access Token，Refresh Token 通过 `Set-Cookie` 写入 `refresh_token` Cookie。
2. Web 将 Access Token 保存在内存中，业务请求通过 `Authorization: Bearer <accessToken>` 携带。
3. `POST /api/auth/refresh` 从 Cookie 读取 Refresh Token，校验会话后签发新 Access Token，并轮换 Refresh Cookie。
4. Web 启动时尝试刷新以恢复会话；业务请求遇到 401 时，并发请求共享一次刷新任务，原请求最多重放一次。
5. 退出登录时，服务端撤销当前会话并清除 Refresh Cookie。

Refresh Cookie 使用 `HttpOnly`、`SameSite=Lax` 和 `/api/auth` 路径，生产环境开启 `Secure`。Web 不将长期认证凭证写入普通浏览器持久化存储。

### API 接入

- 服务端统一使用 `/api` 前缀，默认 API 基础地址为 `http://localhost:3000/api`，例如 `POST /api/auth/login`。
- Web 开发环境请求 `/api/...`，Vite 保留完整路径转发到服务端；生产 Nginx 也保留 `/api`，Cookie Path 直接使用服务端的 `/api/auth`。
- Web 的 `VITE_API_BASE_URL` 默认为 `/api`；配置绝对地址时应包含 `/api`。App 的 `API_BASE_URL` 同样包含 `/api`，例如 `http://192.168.1.100:3000/api`。手机上的 `localhost` 指向手机自身。
- 成功响应包含 `code`、`msg`、`success`、`timestamp`，有业务结果时通过 `data` 返回；无返回值的写入接口不保证包含 `data` 字段。
- 错误响应使用实际 HTTP 状态码及 NestJS 的 `statusCode`、`message` 等字段；校验错误的 `message` 可能为字符串数组。
- 新增、编辑、删除成功后，客户端重新查询相关列表或统计，不假定写入接口会返回完整实体。

接口与请求 / 响应类型以 `service-nest/src/modules/` 和 `web/src/api/` 中的实现为准。当前尚未集成 OpenAPI 文档或自动生成 API Client。

## 原生 iOS 规划

目录：`ios/`，与历史 Flutter 工程的 `app/ios/` 区分。本轮仅建立分模块 PRD 和 Web 参考图，未生成 Xcode 工程、Swift 源码或安装依赖。需求入口为 [原生 iOS 主 PRD](ios/PRD.md)，Android 后续另行规划。

| 计划技术 | 用途 |
| --- | --- |
| Swift + SwiftUI | 原生页面、NavigationStack、TabView、全屏表单与 Sheet |
| Observation | 页面状态与数据观察，UI 状态由 MainActor 管理 |
| Swift Concurrency | async / await、任务取消、actor 会话协调 |
| URLSession + Codable | HTTP、JSON 模型、统一响应与错误处理 |
| Security / Keychain | Refresh Cookie 安全持久化和环境隔离 |
| Swift Charts | 原生实心饼图、柱状趋势与触摸选择；排行使用列表 |
| Asset Catalog + SF Symbols | 本地分类图案与系统操作图标 |
| XCTest + XCUITest | 后续业务 / 会话契约与关键界面流程验证 |

PRD 以 iOS 17.0 为最低部署基线；实际 Xcode、Swift 编译器与 SDK 版本在后续创建工程时记录。

### 数据、认证与架构

- 必须联网，业务数据以服务端为准；不引入本地账单数据库、离线写入队列或同步协议。
- 按业务模块组织，View、ViewModel、Repository、Service 分工；业务结果在当前会话内存中缓存，写成功后刷新相关查询。
- 沿用现有 Cookie 双 Token 接口：Access Token 仅内存保存，完整 Refresh Cookie 由受控 URLSession 适配层解析并保存在 Keychain，不新增 App 专用认证入口。
- 实现启动恢复、并发共享刷新、最多一次认证重放、Cookie 轮换、退出清理与账号切换隔离。详见 [iOS 账户与认证](ios/docs/03-authentication.md)。
- 金额使用精确十进制或安全整数分，发生日期保持自然日期；标签新建 / 改名随流水事务提交，取消草稿不产生写入。

### 视觉、图标与图表

- 参考现有 Web：黄色强调、浅灰背景、白色圆角卡片、支出绿色、收入红色和彩色分类图标。主导航为“流水 / 统计 / 管理”。
- Web 筛选侧栏改为 Sheet，长录入弹窗改为全屏表单，统计三列改为子分段；手机图表用点按 / 拖动读取信息。详见 [iOS 视觉与交互](ios/docs/08-ios-design-and-interaction.md)。
- 分类图形沿用 `web/src/assets/icons/categories/`，后续转换为本地原生资源，按 iconKey 映射；SwiftUI 绘制服务端 backgroundColor 的圆形背景，保留资源许可。
- 复用统计数据接口，图表使用 Swift Charts 实现，金额与百分比文字仍使用服务端精确结果。
- 五张用户提供的 Web 原图及差异说明见 [设计参考](ios/docs/00-sources-and-references.md)。

原生 iOS 的编译、模拟器 / 真机调试和签名需要 macOS + Xcode。后续生成顺序与设备验收见 [实施阶段](ios/docs/10-delivery-and-acceptance.md)。

### 历史 Flutter 实现

`app/` 已包含 Flutter + Dart 工程，使用 Material 3、Riverpod、go_router、Dio、Freezed / json_serializable、安全存储、flutter_svg 和 fl_chart。保留作业务与实现参考，后续原生开发入口以 `ios/PRD.md` 为准。

历史运行说明见 [app/README.md](app/README.md)，原需求见 [app/PRD.md](app/PRD.md)，历史检查与设备待验项见 [Flutter 实施记录](app/docs/11-implementation-report.md)。旧 PRD 中“工程待生成”的描述代表立项时状态，不能据此判断当前没有 Flutter 工程；历史 Flutter 通过记录也不代表原生 iOS 已通过验证。

## 数据约定

- 金额接口使用以人民币“元”为单位的十进制字符串，例如 `"12.50"`；流水金额在 MySQL 中使用 `DECIMAL(15,2)`。
- 金额计算与比较使用精确的整数分或十进制运算，不通过浮点数完成业务计算。绘图坐标可以转换为数值，金额文案仍使用原始字符串。
- 流水发生日期 `occurredDate` 使用 `YYYY-MM-DD`，表示自然日期，不转换为 UTC 时间点；月份、年份查询分别使用 `YYYY-MM` 和 `YYYY`。
- 创建、更新及响应时间与业务日期分开处理；接口时间戳使用 ISO 8601 字符串。
- 归档分类和标签保留历史关联，客户端按接口返回的归档状态展示，不能把历史关联当作不存在的数据。

## 本地开发

### 环境准备

- Node.js：Web 的 `package.json` 当前声明版本为 `24.11.0`。
- npm：两个子项目均使用 `package-lock.json`，可通过 `npm ci` 安装锁定依赖。
- MySQL：创建数据库并配置连接信息。
- SMTP：使用真实邮件验证码时配置；开发环境可使用固定验证码跳过邮件发送。

### 启动服务端

在 PowerShell 中执行：

```powershell
cd service-nest
npm ci
Copy-Item .env.example .env.development
```

复制环境文件仅需在首次配置时执行；已有 `.env.development` 时直接编辑现有配置。填写配置后启动：

```powershell
npm run start:dev
```

主要配置项：

| 配置 | 用途 |
| --- | --- |
| `DB_HOST`、`DB_PORT`、`DB_USER`、`DB_PASSWORD`、`DB_DATABASE` | MySQL 连接 |
| `JWT_ACCESS_SECRET`、`JWT_REFRESH_SECRET`、`JWT_ISSUER` | JWT 签发与校验 |
| `JWT_ACCESS_EXPIRES_IN`、`JWT_REFRESH_EXPIRES_IN` | Token 有效期，示例分别为 `15m`、`7d` |
| `VERIFICATION_CODE_SECRET` | 验证码校验所需密钥 |
| `FRONTEND_ORIGIN` | 允许携带 Cookie 的 Web 来源，默认示例为 `http://localhost:5173` |
| `DEV_VERIFICATION_CODE` | 仅开发环境有效的六位固定验证码；留空时发送真实邮件 |
| `MAIL_*` | SMTP 与邮件验证码配置 |

服务端默认监听 `3000` 端口，可通过 `PORT` 调整。配置文件按 `NODE_ENV` 加载，默认使用 `.env.development`。非生产环境开启 TypeORM 表结构同步，生产环境关闭。

### 启动 PC Web

在另一个终端中执行：

```powershell
cd web
npm ci
npm run dev
```

默认开发地址为 `http://localhost:5173`，开发代理目标为 `http://localhost:3000`。若服务端端口改变，需要同步修改 `web/vite.config.ts` 中的代理目标。

### 常用检查命令

在 `web/` 中执行：

```powershell
npm run type-check
npm run test:unit -- --run
npm run build
```

在 `service-nest/` 中执行：

```powershell
npm test -- --runInBand
npm run build
```

原生 iOS 当前只有 PRD，没有可执行构建命令；后续在 macOS / Xcode 按 [iOS 实施阶段](ios/docs/10-delivery-and-acceptance.md) 生成与验收。已有 Flutter 工程的运行命令见 [app/README.md](app/README.md)。
