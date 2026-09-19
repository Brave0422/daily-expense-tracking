# Daily Expense Tracking

一个面向个人日常消费场景的多端记账系统，计划提供 PC Web 和移动 App，统一使用 NestJS 服务端提供账户、账单、分类、预算和统计等能力。

## 项目结构

```text
daily-expense-tracking/
├── web/           # PC Web 客户端
├── service-nest/  # NestJS 服务端
└── app/           # Flutter 移动端（待创建）
```

## 技术栈总览

| 项目 | 核心框架 | UI / 样式 | 状态与数据 | 状态 |
| --- | --- | --- | --- | --- |
| PC Web | Vue 3、TypeScript、Vite | TDesign Vue Next、Tailwind CSS | Pinia、Vue Router、TanStack Vue Query、Axios | 基础项目已创建，业务依赖待补充 |
| 移动 App | Flutter、Dart | Material 3、Cupertino | Riverpod、go_router、Dio、Drift / SQLite | 待创建 |
| 服务端 | NestJS、TypeScript | REST API | TypeORM、MySQL、JWT | 已创建，认证相关模块开发中 |

## PC Web

目录：`web/`

### 已安装

- Vue 3：视图层框架
- TypeScript：静态类型检查
- Vite：开发服务器与生产构建
- Vue Router：客户端路由
- Pinia：登录用户、权限、主题等客户端全局状态
- Vitest + Vue Test Utils：单元测试与组件测试
- ESLint + Oxlint + Prettier：代码检查与格式化

### 规划采用

- TDesign Vue Next：表格、表单、日期选择、弹窗、菜单等业务组件
- Tailwind CSS：页面布局、间距、响应式和少量定制样式
- Apache ECharts + vue-echarts：收支趋势、分类占比和预算统计图表
- TanStack Vue Query：账单、分类、预算等服务端数据的请求与缓存
- Axios：HTTP 请求
- Zod：接口数据和复杂表单的数据校验
- Playwright：关键业务流程的端到端测试

### UI 使用约定

- 优先使用 TDesign 提供的业务组件，保持交互和视觉一致。
- Tailwind CSS 主要用于布局、间距、尺寸和响应式适配。
- 避免使用 Tailwind 大范围覆盖 TDesign 组件内部样式；需要统一换肤时优先使用 TDesign Design Token 和 CSS 变量。
- PC 端以数据管理和统计分析为主，不与 App 强行复用页面组件。

## 移动 App

计划目录：`app/`

- Flutter + Dart：构建 Android 和 iOS 客户端
- Material 3：主要 UI 组件与主题体系
- Cupertino：需要遵循 iOS 交互习惯的组件
- Riverpod：应用状态和依赖管理
- go_router：声明式路由和登录重定向
- Dio：HTTP 请求、拦截器和文件上传
- Freezed + json_serializable：不可变数据模型及 JSON 序列化
- Drift / SQLite：账单数据的本地持久化与离线使用
- flutter_secure_storage：Access Token、Refresh Token 等敏感信息存储
- fl_chart：移动端收支统计图表
- flutter_test + integration_test：单元、组件和集成测试

移动端按业务模块组织代码，并采用 View、ViewModel、Repository、Service 分层。账单录入优先支持本地保存，联网后再与服务端同步。

## NestJS 服务端

目录：`service-nest/`

- NestJS 11 + TypeScript：服务端框架与开发语言
- TypeORM + MySQL：数据访问与持久化
- JWT：Access Token 和 Refresh Token 认证
- bcrypt：密码哈希
- class-validator + class-transformer：DTO 校验与数据转换
- Nodemailer：注册、修改密码等邮件验证码
- Jest + Supertest：单元测试和端到端 API 测试
- ESLint + Prettier：代码检查与格式化

当前模块包括：

- `auth`：注册、登录和令牌管理
- `users`：用户信息管理
- `verification-code`：验证码生成与校验
- `mail`：验证码邮件发送

## 本地开发

### 启动服务端

```bash
cd service-nest
npm install
copy .env.example .env.development
npm run start:dev
```

启动前需要在 `.env.development` 中配置 MySQL、JWT 和 SMTP 等环境变量。

### 启动 PC Web

```bash
cd web
npm install
npm run dev
```

默认开发地址为 `http://localhost:5173`。

## 数据约定

- 金额在接口和业务计算中使用“分”为单位的整数，或者使用十进制字符串，避免浮点数精度问题。
- 日期时间通过 ISO 8601 字符串传输，并明确服务端、数据库和客户端的时区处理规则。
- PC Web 和 App 共用同一套 REST API；后续通过 OpenAPI 分别生成 TypeScript 和 Dart API Client。
- Web 端敏感凭证优先放在 HttpOnly Cookie 中；App 端凭证存入系统安全存储，不使用普通本地存储保存长期令牌。
