/**
 * @author Brave
 * @date 2026-09-20T16:46:27+08:00
 * @description 本地图标 Symbol 加载入口，装配通用 UI 图标和分类 SVG 图库。
 */

/** 通用 UI 图标项目的本地 Symbol JS。 */
export const APP_ICONFONT_SYMBOL_SCRIPT_URL = new URL(
  '../assets/iconfont/app-symbol.js',
  import.meta.url,
).href

const CATEGORY_ICON_SVG_BY_PATH = import.meta.glob<string>(
  [
    '../assets/icons/categories/level1/*.svg',
    '../assets/icons/categories/level2/*.svg',
    '../assets/icons/categories/general/*.svg',
  ],
  {
    eager: true,
    import: 'default',
    query: '?raw',
  },
)
const CATEGORY_SYMBOL_SPRITE_ID = 'expense-category-icon-symbol-sprite'
const CATEGORY_ICON_FILE_NAME_PATTERN = /\/([^/]+)\.svg$/
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'

interface IconfontSymbolSource {
  id: string
  name: string
  url: string
  normalizeColors?: boolean
}

const ICONFONT_SYMBOL_SOURCES: readonly IconfontSymbolSource[] = [
  {
    id: 'expense-app-iconfont-symbol-script',
    name: '通用 UI 图标',
    url: APP_ICONFONT_SYMBOL_SCRIPT_URL,
    normalizeColors: true,
  },
]
const CURRENT_COLOR_SYMBOL_IDS = [
  'icon-pie-chart',
  'icon-jia',
  'icon-shanchu',
  'icon-bianji',
  'icon-jiaohuanshunxu',
] as const

/**
 * 移除图标库内写死的填充色，使指定单色图标跟随按钮的普通态与激活态颜色。
 */
function normalizeSymbolColors(): void {
  CURRENT_COLOR_SYMBOL_IDS.forEach((symbolId) => {
    document
      .getElementById(symbolId)
      ?.querySelectorAll('[fill]')
      .forEach((element) => element.removeAttribute('fill'))
  })
}

function loadIconfontSymbolSource(source: IconfontSymbolSource): void {
  const scriptUrl = source.url.trim()
  if (!scriptUrl) {
    return
  }

  if (document.getElementById(source.id)) {
    if (source.normalizeColors) {
      normalizeSymbolColors()
    }
    return
  }

  const script = document.createElement('script')
  script.id = source.id
  script.src = scriptUrl
  script.async = true
  if (source.normalizeColors) {
    // Symbol 脚本通过零延时任务注入 SVG，延后一轮再处理才能稳定拿到 Symbol 节点。
    script.addEventListener('load', () => window.setTimeout(normalizeSymbolColors, 0), {
      once: true,
    })
  }
  script.addEventListener(
    'error',
    () => {
      script.remove()
      console.error(`${source.name}的 Iconfont Symbol 脚本加载失败，请检查本地资源。`)
    },
    { once: true },
  )

  document.head.append(script)
}

/**
 * 将单个分类 SVG 转换为可供 `<use>` 引用的 Symbol。
 * @param filePath - Vite glob 返回的 SVG 模块路径
 * @param svgSource - SVG 原始文本
 * @returns 转换成功的 Symbol；资源结构不完整时返回 null
 */
function createCategorySymbol(filePath: string, svgSource: string): SVGSymbolElement | null {
  const fileName = filePath.match(CATEGORY_ICON_FILE_NAME_PATTERN)?.[1]
  if (!fileName) {
    console.error(`无法从分类图标路径解析 Symbol ID：${filePath}`)
    return null
  }

  const sourceDocument = new DOMParser().parseFromString(svgSource, 'image/svg+xml')
  const sourceSvg = sourceDocument.querySelector('svg')
  const viewBox = sourceSvg?.getAttribute('viewBox')
  if (!sourceSvg || !viewBox || sourceDocument.querySelector('parsererror')) {
    console.error(`分类图标 SVG 解析失败：${filePath}`)
    return null
  }

  const symbol = document.createElementNS(SVG_NAMESPACE, 'symbol')
  symbol.id = `icon-${fileName}`
  symbol.setAttribute('viewBox', viewBox)

  Array.from(sourceSvg.childNodes).forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE && (node as Element).localName === 'title') {
      return
    }
    symbol.append(node.cloneNode(true))
  })

  return symbol
}

/** 将仓库内的分类 SVG 注入隐藏 Sprite，避免依赖 Iconfont 在线项目。 */
function injectCategorySymbols(): void {
  if (document.getElementById(CATEGORY_SYMBOL_SPRITE_ID)) {
    return
  }

  const sprite = document.createElementNS(SVG_NAMESPACE, 'svg')
  sprite.id = CATEGORY_SYMBOL_SPRITE_ID
  sprite.setAttribute('aria-hidden', 'true')
  sprite.setAttribute('focusable', 'false')
  sprite.style.position = 'absolute'
  sprite.style.width = '0'
  sprite.style.height = '0'
  sprite.style.overflow = 'hidden'

  const symbols = document.createDocumentFragment()
  Object.entries(CATEGORY_ICON_SVG_BY_PATH)
    .sort(([leftPath], [rightPath]) => leftPath.localeCompare(rightPath))
    .forEach(([filePath, svgSource]) => {
      const symbol = createCategorySymbol(filePath, svgSource)
      if (symbol) {
        symbols.append(symbol)
      }
    })
  sprite.append(symbols)
  document.body.prepend(sprite)
}

/**
 * 加载全部本地 Symbol 资源。
 * 通用 UI 图标由 Vite 输出同源脚本，分类图标直接由仓库 SVG 生成。
 */
export function loadIconfontSymbols(): void {
  ICONFONT_SYMBOL_SOURCES.forEach(loadIconfontSymbolSource)
  injectCategorySymbols()
}
