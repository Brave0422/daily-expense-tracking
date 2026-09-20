# 页面结构与前端鉴权实现计划

## Summary

- 仅改造 `web` 前端，不修改 `service-nest`、现有需求文档或其他业务模块。
- 完成登录、注册、忘记密码、修改密码、退出登录，以及 Access Token 刷新、路由鉴权和登录状态恢复。
- 搭建左侧固定导航与列表、统计、管理三个独立占位页面；本期不实现账单、统计、管理业务。
- 参考图片的圆角卡片、留白和布局层次，但使用项目主题色 `#ffe639`，不复制图片中的配色、Logo 和插画。
- 遵循 Vue Code Standards：Vue 3、TypeScript、`<script setup lang="ts">`、职责分层、严格类型、文件元数据和可访问性要求。

## Implementation Changes

### 1. 前端基础设施与视觉规范

- 安装当前功能需要的依赖：`tdesign-vue-next`、`axios`、`zod`、`tailwindcss`、`@tailwindcss/vite`；暂不引入 Vue Query、ECharts 和 Playwright。
- TDesign 使用具名导入并全局加载基础样式，避免额外的自动导入插件。[TDesign 官方接入方式](https://github.com/Tencent/tdesign-vue-next/blob/develop/packages/tdesign-vue-next/site/docs/getting-started.md)
- Tailwind 使用 Vite 插件和 `@import "tailwindcss"` 的 v4 方案。[Tailwind 官方 Vite 指南](https://tailwindcss.com/docs/installation/using-vite)
- 建立全局设计变量：
  - 主色 `#ffe639`，悬停色 `#f3d900`，按下色 `#dec500`，浅色背景 `#fff9cc`。
  - 页面背景 `#f4f5f7`、卡片背景白色、正文 `#202124`。
  - 字体依次为 `PingFang SC`、`Microsoft YaHei`、sans-serif。
  - 页面边距和区域间距默认 16px，普通卡片圆角 16px，鉴权卡片圆角 24px。
- 阿里 Iconfont 下载包放入 `src/assets/icons/iconfont/` 并本地加载；创建统一 `BaseIcon` 包装和语义图标映射，至少覆盖品牌、用户、列表、统计、管理、邮箱、验证码、密码、显示/隐藏密码、修改密码、退出和状态反馈。
- 不安装或使用 SVG 图标包；TDesign 内置图标能关闭的全部关闭，业务可见图标统一走 Iconfont。

### 2. 鉴权数据流与安全策略

- 新建统一 HTTP 实例，读取 `VITE_API_BASE_URL`，开发默认值为 `http://localhost:3000`，始终启用 `withCredentials`。
- Access Token 只保存在内存，不写入 localStorage、sessionStorage 或 URL；Refresh Token 继续由后端 HttpOnly Cookie 管理。
- 请求拦截器给受保护请求添加 `Authorization: Bearer <accessToken>`。
- 应用首次导航前调用刷新接口恢复会话，避免页面刷新后误判退出。
- 对普通请求的 401 使用单例刷新任务：并发失败请求只触发一次刷新，各请求最多重放一次；刷新失败时清空前端会话并跳转登录页。
- 登录、刷新等鉴权接口排除自动刷新，防止循环请求；启动时缺少 Refresh Cookie 属于正常未登录状态，不显示错误提示。
- 退出登录仅在服务端成功清除 Cookie 和会话后清空本地状态；网络失败时保留当前会话并提示重试，避免出现“界面已退出但 Cookie 仍可恢复登录”的假退出。
- 注册成功和重置密码成功后跳转登录页；修改密码成功后关闭弹窗并保持当前登录状态。

### 3. 页面、布局与交互

- 路由固定为：
  - 访客页：`/login`、`/register`、`/forgot-password`。
  - 鉴权页：`/records`、`/statistics`、`/management`。
  - `/` 重定向 `/records`，未知地址也进入 `/records`，再由守卫处理登录跳转。
- 路由使用 `requiresAuth`、`guestOnly` 元信息；未登录访问业务页跳转 `/login?redirect=原地址`，已登录访问鉴权页跳回 `/records`。
- 三个鉴权页共享 `DefaultLayout`：
  - 左侧 72px 固定侧栏，顶部为通用默认头像，中部依次为列表、统计、管理入口。
  - 当前路由使用黄色浅底高亮，图标按钮提供 Tooltip、键盘焦点和 `aria-label`。
  - 点击头像在右侧弹出菜单，依次为“修改密码”和红色“退出登录”；退出前显示文本确认对话框。
  - 列表和统计占位页采用“左侧约 320px 搜索区 + 右侧弹性数据区”；管理页使用单卡片占位。
  - 小于 1024px 时搜索区与数据区纵向排列；本期仍定位为 PC Web，不实现移动端导航。
- 三个鉴权页面共享居中的 `AuthLayout` 和表单卡片，品牌暂用“每日记账”及记账类 Iconfont 图标：
  - 登录：邮箱、密码、登录按钮、注册和忘记密码入口。
  - 注册：邮箱、验证码及发送按钮、密码、注册按钮；不提供确认密码。
  - 忘记密码：邮箱、验证码及发送按钮、新密码、重置按钮。
  - 修改密码弹窗：邮箱、验证码及发送按钮、新密码；不要求旧密码和确认密码。
- 密码按后端真实契约校验为 6–20 位，覆盖参考图中的“6–32 位”；邮箱提交前去空并转小写，验证码限定为 6 位数字字符串。
- 验证码按钮成功发送后进入 60 秒倒计时；若服务端返回 `retryAfterSeconds` 则采用服务端数值。邮箱修改后清空验证码并要求重新发送，组件卸载时清理定时器。
- 所有提交按钮在请求期间禁用并使用文字状态防止重复提交；表单提供正确的 label、autocomplete、数字键盘提示及可见焦点。

## APIs and Types

- 建立 `ApiResponse<T>`、`ApiErrorResponse`、`AccessTokenData` 以及登录、注册、重置密码、修改密码、发送验证码的请求类型。
- 严格对接现有后端接口：
  - `POST /auth/login`
  - `POST /auth/register`
  - `POST /auth/refresh`
  - `POST /auth/changePassword`
  - `POST /auth/resetPassword`
  - `POST /auth/logout`
  - `POST /verificationCode/sendCode`
- 验证码用途固定为 `register`、`reset_password`、`change_password`；修改密码发送验证码时携带 Access Token。
- 统一解析 NestJS 的成功包装 `{ code, msg, data, success, timestamp }`，以及 `message` 为字符串或数组、429 附带 `retryAfterSeconds` 的失败响应。
- Auth Store 暴露 `isInitialized`、`isAuthenticated`、内存 Token 状态，以及 `initialize`、`login`、`logout`、`clearSession` 动作；请求刷新协调逻辑集中在 HTTP 层，不散落到页面。

## Test Plan

- 使用 Vitest 和 Vue Test Utils覆盖表单校验、验证码倒计时、邮箱变更、重复提交、成功跳转和错误展示。
- 覆盖路由守卫：未登录拦截、登录后回跳、已登录禁止进入访客页、刷新恢复会话。
- 覆盖 HTTP 鉴权：Bearer 注入、并发 401 只刷新一次、单次重放、刷新失败清理状态、登录 401 不触发刷新。
- 覆盖侧栏高亮、头像弹层、修改密码弹窗和退出确认。
- 联调验证注册、登录、刷新、重置密码、修改密码、退出后 Cookie 不再恢复会话。
- 最终运行 `npm run test:unit -- --run`、`npm run lint` 和 `npm run build`。

## Assumptions and Boundaries

- `页面结构.md` 中“列表页图标跳转统计页”和“管理页图标跳转统计页”视为笔误，分别修正为跳转列表页和管理页。
- 实施前由用户提供包含上述图标的阿里 Iconfont 本地下载包；生成的字体和 CSS 作为生成资源保留，业务代码只引用统一图标封装。
- 不新增头像上传、用户资料、账单列表、统计图表、管理功能、后端接口或移动端适配。
- 所有新建可注释源码添加作者 `Brave`、实际创建时间和中文职责说明；现有文件保留原创建信息，无法确认时标记为历史未知。
- 保留当前工作区中用户对 `web/页面结构.md` 和 `web/plan/` 的现有改动，不覆盖或整理这些文件。
