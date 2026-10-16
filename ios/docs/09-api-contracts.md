# 09 API 与数据契约

[返回主 PRD](../PRD.md) · [认证](03-authentication.md)

核对日期：2026-10-16。来源为 [后端模块](../../service-nest/src/modules/)、[Web API 类型](../../web/src/api/) 与相关 Service 实现；本文件不要求新增接口。后续实现遇到变化需复核源码并更新契约，不按 REST 习惯猜路径。

## 1. 通用传输（API-01）

- 原生 `API_BASE_URL` 指向包含 `/api` 的实际 API 基础地址，例如 `http://localhost:3000/api`；下表列出含前缀的完整接口路径，客户端端点相对于基础地址声明，不重复拼接 `/api`。JSON 请求使用 `Content-Type: application/json`。
- 受保护请求带 Bearer；登录 / 刷新接收 Set-Cookie，刷新发送匹配的 Refresh Cookie。原生凭证层要求见 03。
- 当前成功 HTTP 统一 200，封装为 `code`、`msg`、`success`、ISO 8601 `timestamp` 和可选 `data`。
- void 写入的 JSON 可能没有 data；成功注册 / 密码操作 data 为 boolean；查询必须解码实际业务结构。不能强制所有成功响应都有非空 data。
- Nest 错误使用真实 HTTP 状态及 `statusCode`、`message`、可能的 `error` / `retryAfterSeconds`；message 可为字符串或数组。HTML 网关错误、解码失败与取消需单独处理，不统一转“未登录”。
- 可选查询未设置就省略，空 ID 数组也省略。ID 数组按重复键编码：`categoryIds=1&categoryIds=2&tagIds=3&tagIds=4`；不输出方括号、逗号串或 JSON 数组字符串。
- ID 使用服务端正整数，按 ID 判等；用户 ID 从认证上下文取得，不在业务请求中自行选择 ownerUserId。
- 写成功后重查，不假定接口返回完整实体或新 ID。当前没有幂等键协议，传输超时不自动重复写。

## 2. 账户与验证码

| 方法 / 路径 | JSON body | data / 行为 |
| --- | --- | --- |
| POST `/api/auth/register` | email、password、code | boolean；不直接建立会话 |
| POST `/api/auth/login` | email、password | `{accessToken}`，Set-Cookie 写 Refresh Cookie |
| POST `/api/auth/refresh` | 无 Token 请求体 | `{accessToken}`，轮换 Cookie |
| POST `/api/auth/logout` | 无业务 body，需 Bearer | void，撤销当前会话并清 Cookie |
| POST `/api/auth/resetPassword` | email、newPassword、code | boolean |
| POST `/api/auth/changePassword` | newPassword、code，需 Bearer | boolean |
| POST `/api/verification-codes/send` | purpose 与按场景需要的 email | void，可能有频控错误 |

purpose 严格使用 register / reset_password / change_password。前两者带邮箱，change_password 仅带 purpose 并带 Bearer。验证码六位数字字符串，邮箱 trim 后小写，密码 6–20 字符、不 trim。客户端校验不能代替后端验证。

当前没有 JSON Refresh Token 认证入口、用户资料查询或账户注销接口。

## 3. 分类

| 方法 / 路径 | 参数 / body | 返回 |
| --- | --- | --- |
| GET `/api/categories/getUserCategories` | type 必填；可选 includeArchived=true | 一级分类树数组 |
| GET `/api/categories/getAllIcons` | 无 | 图标数组 |
| POST `/api/categories/create` | type、name、iconKey；二级额外 parentId | void |
| POST `/api/categories/update` | id、name、iconKey | void |
| DELETE `/api/categories/:id/archive` | 路径 ID | void；一级存在有效二级时拒绝 |

分类字段：id、type、parentId（一级 null）、name、sortOrder、level（1 / 2）、iconKey、isDefault、backgroundColor，可选 archived；一级树项含 children。图标为 iconKey、backgroundColor。

type 为 expense / income。收入仅一级，支出两级；类型 / 父级 / 层级不允许通过编辑修改。name trim 后必填、最多 50 字符；同用户同类型同父级有效名称不重复。二级背景由父类继承，使用返回的最终 backgroundColor。

## 4. 标签

| 方法 / 路径 | 参数 / body | 返回 |
| --- | --- | --- |
| GET `/api/tags` | 可选 includeArchived=true | 标签数组 |
| GET `/api/tags/search` | key，trim 后非空，最多 50 字符 | 有效标签数组 |
| GET `/api/tags/check-name` | name | 同名有效标签或 null，只读 |
| POST `/api/tags` | name | void |
| PATCH `/api/tags/:id` | name | void |
| DELETE `/api/tags/:id/archive` | 路径 ID | void，保留历史关联 |

标签模型为 id、name、可选 archived；未带 archived 的有效搜索结果按未归档处理。name trim 后非空、最多 50 字符。空搜索用 GET `/api/tags`。同名检查不代表已经创建，完整草稿规则见 06。

## 5. 流水写入

| 方法 / 路径 | 行为 | 返回 |
| --- | --- | --- |
| POST `/api/transactions` | 创建流水与标签事务 | void |
| PATCH `/api/transactions/:id` | 完整编辑，不允许改 type | void |
| DELETE `/api/transactions/:id/archive` | 归档流水，可能归档独占标签 | void |

| 字段 | POST | PATCH |
| --- | --- | --- |
| type | expense / income，必填 | 禁止发送 |
| categoryId | 必填，支出二级 / 收入一级 | 必填，可保留原归档分类 |
| amount | 必填，正数元字符串 | 必填 |
| occurredDate | 必填，YYYY-MM-DD | 必填 |
| title | 可选，trim 后 ≤50 | 必须提交，清空显式 null |
| remark | 可选，trim 后 ≤100 | 必须提交，清空显式 null |
| tagIds | 可选真实 ID 数组 | 必须完整提交；清空 [] |
| tagNames | 可选新名称数组 | 同左，与 tagIds 合成完整集合 |
| tagUpdates | 可选 `[{id,name}]` | 同左，只修改仍在 tagIds 中的有效项 |

amount 校验模式：`^(?!0(?:\.0{1,2})?$)(?:0|[1-9]\d{0,12})(?:\.\d{1,2})?$`。正数、最多 13 位整数及 2 位小数，拒绝多余前导零、负数、指数、货币符号与千分位；0 / 0.00 无效。tagNames 中名称 trim 后非空、最多 50，不能把 tagIds=null 当作空集合。

PATCH 清空示意（ID 仅示意，正式必须来自服务端）：

```json
{
  "categoryId": 123,
  "amount": "12.50",
  "occurredDate": "2026-10-15",
  "title": null,
  "tagIds": [],
  "remark": null
}
```

Swift Encodable 必须显式编码 null 字段。流水表单里的新标签 / 改名随流水同事务提交，不提前调用标签写接口；取消无数据库副作用。

## 6. 流水查询（API-02）

| GET 路径 | 必填 | 可选 |
| --- | --- | --- |
| `/api/transactions/daily` | month=YYYY-MM | type、categoryIds、minAmount、maxAmount、tagIds、title、remark |
| `/api/transactions/monthly-summary` | year=YYYY | type、categoryIds、minAmount、maxAmount |

“全部收支”省略 type，不能发 all。筛选金额允许零，最小不大于最大；标题最多 50、备注最多 100，trim 后空值省略。分类可选支出一级，表示其二级范围；多个标签按任一匹配。汇总拒绝标题 / 标签 / 备注，空值同样不能发送。没有 page、pageSize、cursor。

### 公共结果

- period：日明细为 YYYY-MM，月汇总为 YYYY。
- totals：`{expense, income, balance}`，完整周期总览，balance 由后端精确计算。
- filterTotals：`{expense, income}`，筛选结果合计。不能覆盖 totals，也不由当前可见行相加得到。

### 日明细结果

`days: [{date, expenseTotal, incomeTotal, transactions}]`。

transactions 项：id、type、amount、title（nullable）、remark（nullable）、occurredDate、`category: {primary, secondary}`、tags。

primary / secondary：id、name、iconKey、backgroundColor、archived。收入 secondary=null。tags 项：id、name、archived。按返回顺序显示，列表不自行合计或改序。

### 月汇总结果

`months: [{month, expenseTotal, incomeTotal, expenseCategories, incomeCategories}]`。month 是数值 1–12，与外层 period 拼成完整月份。

分类项：id、name、iconKey、backgroundColor、archived、amount；expenseCategories 的一级项额外有 children（二级分类金额项）。incomeCategories 是一级项数组，不虚构 children。

当前没有 GET `/api/transactions/:id`。详情 / 编辑数据来自当次日明细，缺快照时回列表重查，不能猜测端点。

## 7. 统计接口（API-03）

| GET 路径 | 必填查询 |
| --- | --- |
| `/api/statistics/category-ranking/monthly` | type、categoryLevel、month、order |
| `/api/statistics/category-ranking/yearly` | type、categoryLevel、year、order |
| `/api/statistics/category-proportion/monthly` | type、categoryLevel、month |
| `/api/statistics/category-proportion/yearly` | type、categoryLevel、year |
| `/api/statistics/transaction-trend/monthly` | type、month |
| `/api/statistics/transaction-trend/yearly` | type、year |

type 只为 expense / income；categoryLevel 数值 1 / 2，收入仅 1；order 为 asc / desc。月端点仅 month、年端点仅 year。统计严格拒绝额外查询字段，不能把全局流水筛选对象直接展开到请求里。

允许 month 1000-02 至 9999-11、year 1001 至 9998，保留比较周期和数据库边界。此限制来自统计实现，不能盲目用于其他查询端点。

### 分类统计模型

period、periodType（month / year）、type、categoryLevel、transactionCount、totalAmount、items；排行额外 order。

items 项：categoryId、name、iconKey、backgroundColor、`parent: {categoryId,name} | null`、amount、percentage。

### 趋势模型

period、periodType、type、transactionCount、totalAmount、previousPeriod、previousTotalAmount、changeRate（nullable）、changeStatus、`series: [{date,amount}]`。

月 series.date 为 YYYY-MM-DD，年为 YYYY-MM。percentage / changeRate 是无 `%` 的百分比字符串，例如 `"12.50"` 表示 12.50%。changeStatus 为 increase / decrease / unchanged / new，方向以状态为准。完整周期、补零和归档排除见 07。

## 8. 金额、日期与文本（API-04）

- 保留金额字符串，输入 / 比较使用精确十进制或安全整数分。单笔最大 9,999,999,999,999.99 元可用 Int64 分表示，但聚合结果不应未经检查强转 Int64；原始总金额保留字符串，精确运算防溢出。
- Double 仅限图表坐标和几何绘制，不能生成业务提交金额、合计、百分比文案。展示千分位与两位小数，提交不带符号 / 分隔。
- occurredDate 是自然日期，不是 UTC 时间点；用 Gregorian 年月日建模，格式 YYYY-MM-DD。DatePicker 如需 Date 桥接，必须固定一致的日历 / 时区读写组件，不用 ISO 字符串截前十位。
- period 月 / 年独立建模，验证闰年与月末；发生日期允许有效历史与未来日期。服务端创建 / 更新时间、响应 timestamp 才按时间点处理。
- 名称、标题、备注按服务端字符计数验证，不能直接等同 Swift String.count 的扩展字素簇。使用与当前服务校验一致的 Unicode 码点口径并用中文、组合字符、emoji 验证；密码保留原字符。
- 模型显式处理 null title / remark、收入 secondary=null、空数组、可选 archived、缺失写入 data 和 null changeRate。

## 9. 当前无接口支持的能力

原生首版不能依赖用户资料、JSON Refresh Token、账户注销、预算、分页、单笔详情、分类移动 / 排序 / 重置 / 恢复、附件、任意日期范围或统计下钻。截图占位和历史设想不代表 API 已存在。

后续如发现真实业务缺口，先在实施记录写出当前行为和具体差异；不能静默修改 Web / 后端以使原生看似完成。
