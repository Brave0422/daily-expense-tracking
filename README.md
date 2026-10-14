# Daily Expense Tracking

一个面向个人日常消费场景的多端记账系统。PC Web 和 NestJS 服务端的初版功能已完成，下一阶段开发 Flutter 移动 App，复用现有账户、流水、分类、标签和统计 API。

项目采用联网使用模式，业务数据以服务端为准。移动端首版不提供离线记账或本地账单同步功能。

## 当前进度与功能

| 客户端 / 服务 | 当前状态 | 功能范围 |
| --- | --- | --- |
| PC Web | 初版功能已完成 | 账户认证、流水管理、分类与标签配置、收支统计 |
| NestJS 服务端 | 初版功能已完成 | 对应业务 API、双 Token 认证、数据校验与持久化 |
| 移动 App | 立项文档已建立，工程待初始化 | 使用 Flutter 实现移动端交互，复用现有业务 API |

已实现的主要功能：

- 账户：注册、登录、退出登录、验证码、忘记密码和修改密码。
- 流水：新增、编辑、归档删除，按日查看明细、按月查看汇总，以及分类、标签、金额、标题和备注等条件筛选；不同视图支持的筛选条件以接口契约为准。
- 分类：收入与支出分类、支出一级 / 二级分类、自定义名称与图标、归档删除。
- 标签：新增、编辑、归档删除、搜索及重名检查；流水表单支持在提交流水时一并创建或修改标签。
- 统计：按月 / 年查看分类排行、分类占比、收支趋势，以及与上一个月 / 年的比较。

预算管理尚未实现，不属于当前初版功能范围。

## 项目结构

```text
daily-expense-tracking/
├── web/           # PC Web 客户端，初版已完成
├── service-nest/  # NestJS 服务端，初版已完成
└── app/           # 移动端 PRD 与模块文档，Flutter 工程待初始化
```

## 已实现的技术栈

### PC Web

目录：`web/`

- Vue 3 + TypeScript + Vite：页面开发、类型检查与构建。
- TDesign Vue Next + Tailwind CSS：业务组件、布局与样式。
- Vue Router：页面路由与登录访问控制。
- Pinia：登录会话等全局状态。
- Axios：HTTP 请求、Bearer Token 注入、认证刷新与错误处理。
- Apache ECharts：分类占比和收支趋势图表，直接按需引入 ECharts 模块。
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
3. `POST /auth/refresh` 从 Cookie 读取 Refresh Token，校验会话后签发新 Access Token，并轮换 Refresh Cookie。
4. Web 启动时尝试刷新以恢复会话；业务请求遇到 401 时，并发请求共享一次刷新任务，原请求最多重放一次。
5. 退出登录时，服务端撤销当前会话并清除 Refresh Cookie。

Refresh Cookie 使用 `HttpOnly`、`SameSite=Lax` 和 `/auth` 路径，生产环境开启 `Secure`。Web 不将长期认证凭证写入普通浏览器持久化存储。

### API 接入

- 服务端默认地址为 `http://localhost:3000`，路由没有统一的 `/api` 前缀。
- Web 开发环境请求 `/api/...`，由 Vite 代理到服务端并移除 `/api`；代理同时将 Cookie Path 从 `/auth` 改写为 `/api/auth`。
- Web 可通过 `VITE_API_BASE_URL` 配置 API 地址；App 需要单独配置可访问的服务端地址。手机上的 `localhost` 指向手机自身。
- 成功响应包含 `code`、`msg`、`success`、`timestamp`，有业务结果时通过 `data` 返回；无返回值的写入接口不保证包含 `data` 字段。
- 错误响应使用实际 HTTP 状态码及 NestJS 的 `statusCode`、`message` 等字段；校验错误的 `message` 可能为字符串数组。
- 新增、编辑、删除成功后，客户端重新查询相关列表或统计，不假定写入接口会返回完整实体。

接口与请求 / 响应类型以 `service-nest/src/modules/` 和 `web/src/api/` 中的实现为准。当前尚未集成 OpenAPI 文档或自动生成 API Client。

## 移动 App 规划

目录：`app/`，目标平台为 Android 和 iOS。立项需求入口为 [移动端主 PRD](app/PRD.md)，通过主文档阅读各模块及 Flutter 代码与注释规范。当前只建立需求文档，尚未初始化 Flutter 工程或安装移动端依赖。

| 技术 | 用途 |
| --- | --- |
| Flutter + Dart | 移动端页面与平台交互 |
| Material 3 | 主要 UI 组件与主题体系 |
| Cupertino | 按需适配 iOS 交互习惯 |
| Riverpod | 页面状态、异步请求状态与依赖管理 |
| go_router | 路由、登录访问控制与会话恢复后的导航 |
| Dio | HTTP 请求、认证拦截器与请求取消 |
| Freezed + json_serializable | 不可变模型及 JSON 序列化 |
| flutter_secure_storage | 长期认证凭证的安全存储 |
| flutter_svg | 分类 SVG 图案显示 |
| fl_chart | 分类占比、排行与收支趋势图表 |
| flutter_test + integration_test | 单元、组件与集成测试 |

模型代码生成需要配套配置 `build_runner`、`freezed` 和 `json_serializable` 开发依赖；具体版本在创建 App 时统一确认。

### 数据与代码组织

- 必须联网使用，账单写入以服务端成功响应为准；网络失败时提示用户并保留当前表单输入。
- 首版不引入 Drift / SQLite，不维护本地账单数据库、离线写入队列或同步协议。
- Riverpod 管理页面状态与内存中的请求结果；写入成功后刷新相关数据。
- 按业务模块组织代码，使用 View、ViewModel、Repository、Service 分工。Riverpod 的 `Notifier / AsyncNotifier` 可以承担 ViewModel 职责，避免重复维护同一份状态。
- Repository 封装业务数据访问，Service 封装具体 HTTP 接口；按实际复杂度增加抽象。
- 复用现有后端接口和业务契约，移动端页面、图表交互及布局独立实现。

### 已确定的认证接入

移动端沿用现有 Cookie 双 Token 登录与刷新接口，不新增 App 专用认证入口。Dio 配合 `dio_cookie_manager` 和 `cookie_jar` 接收、发送 Cookie，通过自定义存储接入 `flutter_secure_storage` 安全保存 Refresh Cookie；Access Token 保存在内存。

实现需处理并发请求共享刷新任务、Token 轮换、启动恢复、退出清理与账号切换竞态。详细流程见 [移动端账户与认证 PRD](app/docs/03-authentication.md)。

### 图标与图表适配

- 分类图标资源位于 `web/src/assets/icons/categories/`，服务端通过 `iconKey` 与 `backgroundColor` 提供图标及最终背景色。
- Web 将 SVG 转为 Symbol，并通过 CSS 变量设置背景色；App 需要建立 `iconKey` 到 SVG 资源的映射，不能直接照搬 Web 的 Symbol / CSS 机制。
- 建议由 Flutter 绘制圆形背景，使用适配后的 SVG 显示中心图案；具体资源处理在创建 App 时完成。
- 现有统计接口可复用，ECharts 配置与 Tooltip 实现需要转换为 Flutter 图表和触摸交互。

Android 可在当前 Windows 环境开发；iOS 构建与调试需要 macOS 和 Xcode 环境。

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

移动端目前仅有 PRD，暂无可运行的 Flutter 工程。初始化、生成和验收顺序见 [移动端实施阶段](app/docs/10-delivery-and-acceptance.md)。
