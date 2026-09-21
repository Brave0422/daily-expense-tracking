# 分类 SVG 图标

这一套图标用于账单一级、二级分类，视觉规范如下：

- 64 × 64 画布，圆形纯色背景；
- 中心图案固定为白色；
- 同一个一级分类及其二级分类使用同一种背景色，用颜色表达归属；
- 图标名称使用稳定英文语义，不依赖中文名称；
- SVG 保留背景色和白色图案，适用于当前项目采用的 Iconfont Symbol 模式。

## 目录

- `level1/`：19 个一级分类图标，其中支出 14 个、收入 5 个；
- `level2/`：62 个支出二级分类图标；
- `manifest.json`：中文名称、父级归属、颜色和文件名映射；
- `preview/`：支出一级、支出二级、收入一级三份图标总览；
- `generate-category-icons.mjs`：重新生成所有 SVG 和清单。

## 导入 Iconfont

1. 在单独的 `DET-category-icon` 项目中批量上传 `level1/` 和 `level2/` 下的 SVG。
2. 保留多色，不要执行“去除颜色”或改为单色字体图标。
3. 将新项目的 FontClass/Symbol 前缀设为 `det-cat-`，避免与通用 UI 图标项目默认的 `icon-` 前缀冲突。
4. 使用 Symbol 引用方式；Font class 和 Unicode 模式无法可靠保留“彩色圆底＋白色图案”两种颜色。
5. 文件名已经是可直接上传的图标名称：一级支出为 `expense-{一级英文名}`，二级支出为 `expense-{一级英文名}-{二级英文名}`，收入为 `income-{收入英文名}`。
6. 发布 Symbol 在线链接后，将新链接填写到 `src/plugins/iconfont-symbol.ts` 的 `CATEGORY_ICONFONT_SYMBOL_SCRIPT_URL`。项目已支持同时加载通用 UI 图标和分类图标两份在线 JS。

例如：

- `expense-education.svg` → `det-cat-expense-education`
- `expense-education-tuition.svg` → `det-cat-expense-education-tuition`
- `income-salary.svg` → `det-cat-income-salary`

使用方式与项目当前图标一致：

```html
<svg aria-hidden="true">
  <use href="#det-cat-expense-meals" />
</svg>
```

> `BaseIcon.vue` 上的 `fill: currentcolor` 只作为继承默认值。图标内部已经显式设置背景色和白色，因此 Symbol 模式下不会被外层文字颜色覆盖。

同一个 Web 页面可以加载多个 Iconfont Symbol 在线 JS。每份脚本会向页面注入自己的 `<symbol>` 集合；只要不同项目的 Symbol ID 不重复，就可以同时使用。分类项目采用独立的 `det-cat-` 前缀就是为了解决这个冲突风险。

## 重新生成

在 `web/` 目录运行：

```bash
node src/assets/icons/categories/generate-category-icons.mjs
```

## 图形来源

通用中心图案基于项目现有依赖 **TDesign Icons** 的填充图标调整，缺少的分类语义图案为本项目补充绘制。TDesign Icons 使用 MIT License，许可文本见 `THIRD_PARTY_NOTICES.md`。
