/**
 * @author Brave
 * @date 2026-09-20T16:46:27+08:00
 * @description 本地图标 Symbol 加载入口，装配 Iconfont 项目资源和分类 SVG 图库。
 */

/** 通用 UI 图标项目的本地 Symbol JS，来源 font_5236708_ewyx33wfman.js。 */
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
const ICON_FILE_NAME_PATTERN = /\/([^/]+)\.svg$/
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'
const SORT_SYMBOL_IDS = ['icon-jiangxu', 'icon-shengxu'] as const
/** 原图形包围盒中心约为 (582.329, 542.453)，修正画布原点以居中且保留尺寸。 */
const SORT_SYMBOL_VIEW_BOX = '70.329 30.453 1024 1024'

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
  'icon-sousuo1',
  'icon-rili',
  'icon-ribao',
  'icon-tianjinshiliangyoujiagezhishuyuebao',
  'icon-yearly-summary-upload',
  'icon-24_beizhu',
  'icon-biaoqianguanli',
  'icon-biaoqian',
  'icon-gengduo2_more-two',
  'icon-bianji1',
  'icon-shanchu1',
  'icon-queshengye_zanwushuju',
] as const

/**
 * 通用图标继承文字颜色，删除减号保留白色，排序图标居中并将活动箭头改为主题色。
 */
function normalizeAppSymbols(): void {
  CURRENT_COLOR_SYMBOL_IDS.forEach((symbolId) => {
    document
      .getElementById(symbolId)
      ?.querySelectorAll('[fill]')
      .forEach((element) => {
        if (symbolId === 'icon-shanchu1' && element.getAttribute('fill') === '#FFFDFD') return
        element.removeAttribute('fill')
      })
  })
  SORT_SYMBOL_IDS.forEach((symbolId) => {
    const symbol = document.getElementById(symbolId)
    symbol?.setAttribute('viewBox', SORT_SYMBOL_VIEW_BOX)
    const activeArrow = symbol?.querySelector('path:last-child')
    activeArrow?.setAttribute('fill', 'var(--color-primary, #ffe639)')
    activeArrow?.removeAttribute('fill-opacity')
  })
}

function loadIconfontSymbolSource(source: IconfontSymbolSource): void {
  const scriptUrl = source.url.trim()
  if (!scriptUrl) {
    return
  }

  if (document.getElementById(source.id)) {
    if (source.normalizeColors) {
      normalizeAppSymbols()
    }
    return
  }

  const script = document.createElement('script')
  script.id = source.id
  script.src = scriptUrl
  script.async = true
  if (source.normalizeColors) {
    // Symbol 脚本通过零延时任务注入 SVG，延后一轮再处理才能稳定拿到 Symbol 节点。
    script.addEventListener('load', () => window.setTimeout(normalizeAppSymbols, 0), {
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
 * 将单个本地 SVG 转换为可供 `<use>` 引用的 Symbol。
 * @param filePath - Vite glob 返回的 SVG 模块路径
 * @param svgSource - SVG 原始文本
 * @returns 转换成功的 Symbol；资源结构不完整时返回 null
 */
function createLocalSymbol(filePath: string, svgSource: string): SVGSymbolElement | null {
  const fileName = filePath.match(ICON_FILE_NAME_PATTERN)?.[1]
  if (!fileName) {
    console.error(`无法从本地图标路径解析 Symbol ID：${filePath}`)
    return null
  }

  const sourceDocument = new DOMParser().parseFromString(svgSource, 'image/svg+xml')
  const sourceSvg = sourceDocument.querySelector('svg')
  const viewBox = sourceSvg?.getAttribute('viewBox')
  if (!sourceSvg || !viewBox || sourceDocument.querySelector('parsererror')) {
    console.error(`本地图标 SVG 解析失败：${filePath}`)
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

/**
 * 将仓库 SVG 按文件名注入隐藏 Sprite，并防止重复加载。
 * @param spriteId - 该图标集合的唯一 Sprite ID
 * @param svgByPath - SVG 文件路径与原始文本的映射
 */
function injectLocalSymbols(spriteId: string, svgByPath: Record<string, string>): void {
  if (document.getElementById(spriteId)) {
    return
  }

  const sprite = document.createElementNS(SVG_NAMESPACE, 'svg')
  sprite.id = spriteId
  sprite.setAttribute('aria-hidden', 'true')
  sprite.setAttribute('focusable', 'false')
  sprite.style.position = 'absolute'
  sprite.style.width = '0'
  sprite.style.height = '0'
  sprite.style.overflow = 'hidden'

  const symbols = document.createDocumentFragment()
  Object.entries(svgByPath)
    .sort(([leftPath], [rightPath]) => leftPath.localeCompare(rightPath))
    .forEach(([filePath, svgSource]) => {
      const symbol = createLocalSymbol(filePath, svgSource)
      if (symbol) {
        symbols.append(symbol)
      }
    })
  sprite.append(symbols)
  document.body.prepend(sprite)
}

/**
 * 加载全部本地 Symbol 资源。
 * 通用 UI 图标统一使用 Iconfont 项目资源，分类图标由仓库 SVG 生成。
 */
export function loadIconfontSymbols(): void {
  ICONFONT_SYMBOL_SOURCES.forEach(loadIconfontSymbolSource)
  injectLocalSymbols(CATEGORY_SYMBOL_SPRITE_ID, CATEGORY_ICON_SVG_BY_PATH)
}
