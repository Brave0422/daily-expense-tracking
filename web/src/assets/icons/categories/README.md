# 分类 SVG 图标库

这一套图标用于账单一级、二级分类，并作为用户创建或编辑分类时的系统预选图库。图库共 110 个图标，其中现有默认分类图标 82 个、通用预选图标 28 个。

视觉规范如下：

- 64 × 64 画布，SVG 内保留圆形背景；
- 中心图案固定为白色；
- 一级分类决定背景色，二级分类渲染时继承其父级分类的背景色；
- 圆形背景使用 `--category-icon-background` CSS 变量，并保留图标自身默认颜色作为回退值；
- 图库中的 110 个中心图案全局唯一；用户分类可以重复选择同一个图库图标；
- 图标名称使用稳定英文语义，不依赖中文分类名称；
- SVG 保留圆底和白色图案，适用于当前项目采用的 Iconfont Symbol 模式。

## 目录

- `level1/`：20 个默认一级分类图标，其中支出 15 个、收入 5 个；
- `level2/`：62 个默认支出二级分类图标；
- `general/`：28 个不绑定默认分类层级的通用预选图标；
- `manifest.json`：全部 110 个图标的稳定标识、维护名称、颜色、文件和排序信息；
- `preview/`：支出一级、支出二级、收入一级、通用预选图标四份总览；
- `generate-category-icons.mjs`：重新生成所有 SVG、清单和总览。

`manifest.json` 中的中文名称只用于种子数据、资源维护和开发预览。面向用户的图标选择器只展示图形，不展示图库名称，避免图库名称限制用户对图标语义的理解。

## 命名空间

- 默认支出一级：`expense-{一级英文名}`；
- 默认支出二级：`expense-{一级英文名}-{二级英文名}`；
- 默认收入一级：`income-{收入英文名}`；
- 通用预选图标：`category-{图标英文名}`。

例如：

- `expense-education.svg` → `icon-expense-education`
- `expense-education-tuition.svg` → `icon-expense-education-tuition`
- `income-salary.svg` → `icon-income-salary`
- `category-coffee.svg` → `icon-category-coffee`

## 本地 Symbol

`src/plugins/iconfont-symbol.ts` 在构建时读取 `level1/`、`level2/` 和 `general/` 下的全部 SVG，运行时将其转换为隐藏的本地 Symbol Sprite。完整 Symbol ID 由文件名加 `icon-` 前缀生成，例如 `expense-education.svg` 对应 `icon-expense-education`。

分类图标不再上传或依赖 Iconfont 在线项目。新增或重新生成 SVG 后正常重新构建 Web 项目即可，无需手动维护 Symbol JS。

## 使用方式

使用图标自身的默认背景色：

```html
<svg aria-hidden="true">
  <use href="#icon-category-coffee" />
</svg>
```

二级分类需要继承父级分类背景色时，由分类图标组件传入父级颜色：

```html
<svg aria-hidden="true" style="--category-icon-background: #ff873d">
  <use href="#icon-category-coffee" />
</svg>
```

背景色只能由系统根据一级分类及其父子关系确定，不作为用户可编辑字段。图标自身的默认颜色用于一级分类和未传入继承色时的回退显示。

`BaseIcon.vue` 上的 `fill: currentcolor` 只作为继承默认值。图标内部的圆形背景和白色中心图案均显式设置颜色，因此不会被普通文字颜色覆盖。

同一个 Web 页面会加载 `src/assets/iconfont` 下的通用 UI 图标 Symbol JS，并从当前目录的 SVG 生成分类图标 Symbol。两类资源均来自本地构建产物，只要完整 Symbol ID 不重复即可同时使用。

## 重新生成

在 `web/` 目录运行：

```bash
node src/assets/icons/categories/generate-category-icons.mjs
```

生成器会校验全部 110 个中心图案是否重复，并清理三个图标目录及预览目录中的过期 SVG。

## 图形来源

通用中心图案优先基于项目现有依赖 **TDesign Icons** 的填充图标调整，缺少的分类语义图案为本项目补充绘制。TDesign Icons 使用 MIT License，许可文本见 `THIRD_PARTY_NOTICES.md`。
