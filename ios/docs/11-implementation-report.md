# 原生 iOS 工程生成记录

日期：2026-10-15。依据：主 PRD、01–10 模块文档及当前 NestJS / Web 源码。用户本次已明确要求在 `ios/` 生成原生工程；旧文档中“仅编写 PRD”的范围属于之前文档轮次。

## 交付与状态

已生成原生源码、可直接打开的 Xcode 工程、共享 Scheme、Debug / Release 配置、资源及测试源码。**这是源码交付；没有 Xcode 构建、测试运行、设备或真实后端联调通过的证据，阶段 1–6 的平台验收尚未完成。** 没有使用 mock、Preview、Web 或 Flutter 页面冒充原生运行结果。

| 范围 | 当前源码实现 |
| --- | --- |
| BASE-01–04 | 会话内存作用域、依赖装配、三个导航栈、写后失效、最新读取序号、环境隔离 |
| AUTH-01–06 | 账户表单、验证码截止时间、恢复状态、ephemeral 传输、完整 Cookie、Keychain、共享刷新 / 单次重放、退出协调与存储故障阻断 |
| CAT-01–04 | 固定层级分类树、名称 / 图标维护、一级有子类拒删、历史归档标识、本地矢量图库 |
| TAG-01–05 | 管理写入、去抖服务端搜索、只读查重 / 明确复用、独立子草稿、新名称 / 改名随流水提交、移除只解绑 |
| TX-01–07 | 双查询模式、独立筛选、周期总览 / 筛选合计、折叠、明细钻入、快照详情、完整 PATCH、删除确认、失败保留输入、未知结果防重复提交 |
| STAT-01–06 | 三套独立条件、月年与层级规则、严格查询白名单、完整排行、SectorMark / BarMark、稳定分类配色、触摸摘要、上一完整周期比较 |
| UI-01–07 | 品牌 Token、浅深资源、黄色分段、大字体纵向选项、VoiceOver 标签、完整金额、原生表单与未保存保护；设备布局与交互待验 |
| API-01–04 | 核对真实路由与 DTO；强类型解码、void 与查询分离、重复键数组、null / []、精确金额、自然日期 |

正式入口只装配 `URLSessionTransport` 与 `KeychainCredentialStore`。测试替身仅在单元测试 target，不编入应用。未修改 Web、NestJS 或 Flutter 实现，保留工作区中已有修改。

## 工具链与检查证据

- 执行环境：Windows PowerShell、Python 3.13.12。未安装 Swift / Xcode / iOS SDK，因此不填写虚构的原生编译器或 SDK 版本。
- 最低部署：iOS 17.0；源码使用 Swift 5.9 语法，构建设置为 Swift 5 模式、`SWIFT_STRICT_CONCURRENCY=complete`。工程兼容元数据中的 Xcode 数字并非已执行版本。
- `tools/generate_project.py`：实际执行成功，生成 PBX 工程、三个 target、共享 Scheme、两套 plist、中文 String Catalog。
- `tools/prepare_resources.py`：实际执行成功。当前后端有 **111** 个图标键，较文档原数量 110 有变化；全部与现有 Web 唯一 SVG 源文件对应，剥离圆背景后转换为单页矢量 PDF。映射在 `Resources/CategoryIconMapping.json`，保留 `THIRD_PARTY_NOTICES.md`。
- `tools/check_project.py`：实际执行通过。32 个 Swift 文件语法解析错误 0；3 个 Python 工具语法有效；3 个原生 target 与共享 Scheme 引用完整；111 个图标键、单页 PDF 和资源清单匹配；Release 无开发 ATS 例外或 Local 配置引用。报告位于本机 `artifacts/static-check.json`。
- 图标资源实际使用 PyMuPDF 渲染过全部 111 个中心图案，并查看本机 `artifacts/icon-contact-sheet.png`，确认白色图形保留、背景分离、没有空图案。此图仅为资源检查，不是原生 App 界面截图。
- `git diff --check -- ios`：实际执行，无空白错误。
- 未运行 XCTest / XCUITest；未声称任何测试用例已经通过。

静态检查早期遇到 Python `tree-sitter 0.26.0` 原生扩展崩溃，固定为已实际使用的 `0.25.2` 后正常。Swift grammar 为 `0.7.4`。工具依赖版本记录在 `tools/requirements.txt`，不属于 App 运行依赖。

## 注释检查

正式源码、测试及辅助脚本均以中文说明类型、属性、方法、参数、局部量及关键处理。静态工具逐个扫描属性 / 函数 / 初始化器附近中文注释；同时人工复查金额精度、日期桥接、Cookie 范围与轮换、Keychain 替换、共享刷新、身份代次、查询白名单、标签事务、归档规则和未保存保护。

自动声明检查不等于闭包参数或语义全覆盖证明。后续在 Mac 上修正任何类型 / 并发诊断时，应同步复核 COMMENT-01–03，不以本记录替代最终代码审查。

## 真实接入边界

按 09 文档实现账户与验证码、分类、标签、日明细 / 月汇总、流水写入和全部六个统计端点。未新增用户资料、单笔详情、分页、预算、模板、离线数据库或归档恢复接口。Release 默认地址有意不可用，必须由维护者填写正式环境。

已编写 19 个 XCTest 用例和 1 个 XCUITest 用例，尚未执行。覆盖金额边界、巨大汇总展示、Unicode 码点、闰日 / 跨年、重复参数、汇总 / 统计白名单、完整编辑 null、标签草稿值隔离、void / nullable 解码、Cookie 范围 / Expires / 多头、并发401共享刷新、最多一次重放、401与503区分、轮换保存失败、迟到旧身份、本地退出清理失败以及旧查询成功 / 错误覆盖保护。公开页UI测试不需要写入服务端业务数据。

## 下一步平台验收

在 Mac 填写服务地址后执行 `tools/verify_on_macos.sh`，将真实 Xcode / Swift / SDK 版本、构建日志和结果包补入本记录。随后使用专用开发账号走完 10 的业务闭环；记录本轮测试实体 ID，按现有归档接口清理。

仍需真实验证：iOS 17 与当前系统兼容、Foundation 合并 Cookie 头行为、Keychain 解锁 / 重启 / 故障、弱网与取消竞态、局域网权限、375pt / 横屏 / 大字号、深色、VoiceOver、图表触摸、表单返回手势、跨 Web 刷新一致性。尚无模拟器或真机截图，不提供合成界面图作为验收证据。
