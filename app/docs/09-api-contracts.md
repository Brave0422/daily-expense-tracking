# 09 API 与数据契约

[返回主 PRD](../PRD.md) · [项目基础](01-project-foundation.md) · [账户与认证](03-authentication.md)

## 1. 契约来源

本文件整理当前可用接口，供 App 实现使用，不要求后端新增接口。具体类型和校验以 [后端模块](../../service-nest/src/modules/) 与 [Web API 类型](../../web/src/api/) 为准。

现有参考：[认证类型](../../web/src/api/auth.types.ts)、[流水类型](../../web/src/api/transaction.types.ts)、[分类类型](../../web/src/api/category.types.ts)、[标签类型](../../web/src/api/tag.types.ts)、[统计类型](../../web/src/api/statistics.types.ts)。旧业务设计文档若与实现不一致，不得用来推测接口存在。

## 2. 通用传输

- `API_BASE_URL` 指向含 `/api` 前缀且 App 可访问的 API 基础地址，例如 `http://192.168.1.100:3000/api`。下表为完整接口路径，客户端端点相对于基础地址声明，避免重复拼接 `/api`。
- JSON 请求使用 `Content-Type: application/json`。受保护接口带 Bearer Access Token；登录 / 刷新通过 Cookie 管理接收和发送 Refresh Token。
- 成功 HTTP 状态当前统一为 200；JSON 包含 `code`、`msg`、`success`、`timestamp`，有业务结果时包含 `data`。
- 无返回值写接口可能省略 `data`，不能将其判为解析失败；`data: null` 和缺失 `data` 也要区分于需要非空模型的查询结果。
- 查询 / 登录响应必须校验业务结果的实际结构，不使用空模型替代损坏的响应并提示成功。
- 错误使用真实 HTTP 状态码，响应可能包含 `statusCode`、`message`、`error`、`retryAfterSeconds`；`message` 支持字符串或字符串数组。
- 普通查询的可选筛选未设置时省略；不能统一把空字段序列化为 `null` 或空字符串。
- ID 数组使用重复键：`categoryIds=1&categoryIds=2`、`tagIds=3&tagIds=4`。Dio 查询序列化显式配置 multi 形式，不输出方括号键名、逗号列表或 JSON 数组字符串。
- ID 来源于服务端，提交时为正整数；不要生成本地业务 ID 或虚构分类 / 标签。
- 统计接口严格拒绝多余查询字段，只发送对应端点允许的参数。

## 3. 账户接口

| 方法与路径 | 请求 | `data` / 行为 |
| --- | --- | --- |
| `POST /api/auth/register` | `email`、`password`、`code` | boolean；不建立登录会话，成功后调用登录 |
| `POST /api/auth/login` | `email`、`password` | `{accessToken: string}`，另通过 Set-Cookie 返回 Refresh Cookie |
| `POST /api/auth/refresh` | 无请求体 Token；携带 Refresh Cookie | `{accessToken: string}`，同时轮换 Refresh Cookie |
| `POST /api/auth/logout` | 无业务请求体；需 Bearer | 无业务 data；撤销当前会话并清除 Cookie |
| `POST /api/auth/resetPassword` | `email`、`newPassword`、`code` | boolean |
| `POST /api/auth/changePassword` | `newPassword`、`code`；需 Bearer | boolean；邮箱由服务端取得 |
| `POST /api/verification-codes/send` | 见下方用途 | 无业务 data；可能返回发送频控错误 |

验证码用途必须精确映射：注册为 `register`，忘记密码为 `reset_password`，修改密码为 `change_password`。前两者提交邮箱，修改密码只提交 purpose 并携带登录态。虽然后端枚举有其他值，v1 不实现账户注销。

邮箱 trim 后转小写；密码 6–20 位，保留原始字符，不 trim 或擅自要求复杂度；验证码为六位数字字符串，保留前导零。App 的客户端校验不能代替服务端校验。

## 4. 分类接口

| 方法与路径 | 请求 | 结果 |
| --- | --- | --- |
| `GET /api/categories/getUserCategories` | 必填 `type=expense/income`；可选 `includeArchived=true` | 一级分类树数组，子项在 `children` |
| `GET /api/categories/getAllIcons` | 无 | 图标选项，使用 `iconKey`、`backgroundColor` |
| `POST /api/categories/create` | `type`、`name`、`iconKey`；二级增加 `parentId` | 无业务 data |
| `POST /api/categories/update` | `id`、`name`、`iconKey` | 无业务 data；类型、父级与层级不可修改 |
| `DELETE /api/categories/:id/archive` | 路径 id | 无业务 data；一级分类仍有未归档二级分类时拒绝删除，须先删除二级 |

分类字段包括 `id`、`type`、`parentId`、`name`、`sortOrder`、`level`、`iconKey`、`isDefault`、`backgroundColor`，历史查询可能有 `archived`。二级图标背景继承父级，客户端使用后端返回颜色，不开放背景色编辑。

名称 trim 后必填，最多 50 字符；图标必须来自接口图库。收入只允许一级，支出二级的父分类须为当前用户有效的支出一级分类。同类型同父级范围内，未归档分类名称不能重复。

## 5. 标签接口

| 方法与路径 | 请求 | 结果 |
| --- | --- | --- |
| `GET /api/tags` | 可选 `includeArchived=true` | 标签数组，`id`、`name`、`archived` |
| `GET /api/tags/search` | `key`，trim 后非空，最多 50 字符 | 未归档标签数组；未提供 archived 时按有效项解析 |
| `GET /api/tags/check-name` | `name` | 同名未归档标签或 null；只查询，不创建 |
| `POST /api/tags` | `name` | 无业务 data |
| `PATCH /api/tags/:id` | `name` | 无业务 data |
| `DELETE /api/tags/:id/archive` | 路径 id | 无业务 data；历史关联保留 |

名称 trim 后非空、最多 50 字符；当前用户未归档标签不允许重名。搜索为空时调用列表接口，不发送空 key。已有标签由 ID 识别，不按名字合并成另一个标签。

## 6. 流水接口与请求

| 方法与路径 | 请求 / 条件 | 结果 |
| --- | --- | --- |
| `POST /api/transactions` | CreateTransactionBody | 无业务 data；成功后重查 |
| `PATCH /api/transactions/:id` | UpdateTransactionBody | 无业务 data；不允许更改 type |
| `DELETE /api/transactions/:id/archive` | 路径 id | 无业务 data；可能同时归档无其他有效引用的标签 |
| `GET /api/transactions/daily` | `month` 及日明细筛选 | DailyTransactionsResult |
| `GET /api/transactions/monthly-summary` | `year` 及汇总筛选 | MonthlySummaryResult |

### 创建与编辑字段

| 字段 | 创建 | 编辑 |
| --- | --- | --- |
| `type` | 必填 expense / income | 禁止提交，类型固定 |
| `categoryId` | 必填；支出二级、收入一级 | 必填；允许保留原有归档分类 |
| `amount` | 必填正数元字符串 | 同创建 |
| `occurredDate` | 必填 YYYY-MM-DD 有效自然日期 | 同创建 |
| `title` | 可选，trim 后最多 50 字符 | 必须提交；清空时 null |
| `remark` | 可选，trim 后最多 100 字符 | 必须提交；清空时 null |
| `tagIds` | 可选已有标签 ID 数组 | 必须提交完整集合；无标签时 [] |
| `tagNames` | 可选新标签名称草稿数组 | 同创建 |
| `tagUpdates` | 可选 `[{id, name}]`，只针对 tagIds 内已有标签 | 同创建 |

金额大于零、整数部分最多 13 位、小数最多 2 位，不允许负数、指数、货币符号和千分位符；`"0"`、`"0.00"` 无效。新标签与标签改名均随流水在服务端同一事务中保存，不能先调用标签写接口再提交流水。

### 查询字段

日明细：必填 `month=YYYY-MM`；可选 `type`、`categoryIds`、`minAmount`、`maxAmount`、`tagIds`、`title`、`remark`。

月汇总：必填 `year=YYYY`；可选 `type`、`categoryIds`、`minAmount`、`maxAmount`。禁止提交 title、tagIds、remark，包括它们的空值。

“全部收支”在请求中省略 type。筛选金额可为零，最小值不得大于最大值。分类 ID 可选择支出一级，表示该一级下全部二级分类；多个标签按任一匹配筛选。服务端目前不提供分页参数。

### 查询模型

- 公共结果：`period`、`totals: {expense, income, balance}`、`filterTotals: {expense, income}`，金额均为元字符串。totals 为完整周期总览，filterTotals 为当前筛选结果，不混用。
- 日明细增加 `days: [{date, expenseTotal, incomeTotal, transactions}]`。
- 日流水项：`id`、`type`、`amount`、`title`、`remark`、`occurredDate`、`category: {primary, secondary}`、`tags`。
- primary / secondary：`id`、`name`、`iconKey`、`backgroundColor`、`archived`；收入 secondary 为 null。标签项含 `id`、`name`、`archived`。
- 月汇总增加 `months: [{month, expenseTotal, incomeTotal, expenseCategories, incomeCategories}]`；分类项含分类展示字段与 amount，一级支出增加 children。
- 按返回顺序显示，不在 App 重新排序、求和或用筛选结果覆盖完整周期总览。

## 7. 统计接口

| GET 路径 | 必填查询 |
| --- | --- |
| `/api/statistics/category-ranking/monthly` | type、categoryLevel、month、order |
| `/api/statistics/category-ranking/yearly` | type、categoryLevel、year、order |
| `/api/statistics/category-proportion/monthly` | type、categoryLevel、month |
| `/api/statistics/category-proportion/yearly` | type、categoryLevel、year |
| `/api/statistics/transaction-trend/monthly` | type、month |
| `/api/statistics/transaction-trend/yearly` | type、year |

- type 只允许 expense 或 income，没有 all；categoryLevel 为数值 1 / 2，收入只能为 1；order 为 asc / desc。
- month / year 按端点二选一；趋势不传 categoryLevel、order，占比不传 order。禁止传标签、分类 ID、标题、备注、金额区间或分页参数。
- 月份允许 1000-02 至 9999-11，年份允许 1001 至 9998，选择器须处理前后比较周期边界。
- 分类响应：`period`、`periodType`、`type`、`categoryLevel`、`transactionCount`、`totalAmount`、`items`；排行额外返回 order。
- items：`categoryId`、`name`、`iconKey`、`backgroundColor`、`parent: {categoryId, name} | null`、`amount`、`percentage`。
- 趋势响应：`period`、`periodType`、`type`、`transactionCount`、`totalAmount`、`previousPeriod`、`previousTotalAmount`、`changeRate`、`changeStatus`、`series: [{date, amount}]`。
- percentage / changeRate 为百分比字符串且不含 `%`；`"12.50"` 表示 12.50%。changeRate 可为 null。
- changeStatus 为 increase / decrease / unchanged / new；用它决定变化方向，不依据舍入后的 changeRate 猜测。

统计排除已归档流水、已归档实际分类及已归档支出父分类。与流水历史展示的规则不同，见 [统计模块](07-statistics.md)。

## 8. 首版不能假定存在的接口

当前无 `GET /api/transactions/:id` 单笔详情、App JSON 双 Token 登录、当前用户资料查询、服务器分页、分类排序 / 重置 / 恢复、附件上传或预算接口。页面实现不得调用猜测出来的路径。

编辑入口使用当前日明细已有记录；进入编辑时缺少数据则回到列表重查，不能通过模拟记录补齐。App 能否展示邮箱取决于当前登录输入，Cookie 恢复不会返回邮箱，不依赖不存在的 `/api/users/me`。

## 9. 数据与解析要求

- 金额字符串保持原始精度；客户端校验或比较采用精确转换，不能通过 double 再格式化生成提交金额。
- 使用 year / month / day 格式化自然日期；不调用 `toUtc()` 后截取发生日期。
- 客户端预校验文本长度应与服务端的字符计数一致；对 emoji 等多字节字符加入契约测试，不能盲目依赖 Dart String.length。
- 解析显式处理 nullable title / remark、收入空 secondary、空列表、缺失写入 data、可选 archived 和 null changeRate。
- 类型异常、未知错误与请求取消使用不同处理路径，不能都转成“未登录”。
