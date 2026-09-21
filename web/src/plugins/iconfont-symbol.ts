/**
 * @author Brave
 * @date 2026-09-20T16:46:27+08:00
 * @description Iconfont Symbol 在线脚本配置与加载入口，空链接时不发起网络请求。
 */

/** 通用 UI 图标项目的 Symbol 在线 JS。 */
export const APP_ICONFONT_SYMBOL_SCRIPT_URL = '//at.alicdn.com/t/c/font_5236708_nm8240jipm.js'
/** 账单分类图标项目 DET-category-icon 的 Symbol 在线 JS。 */
export const CATEGORY_ICONFONT_SYMBOL_SCRIPT_URL = '//at.alicdn.com/t/c/font_5237186_dzhj2dbu5zt.js'

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
  {
    id: 'expense-category-iconfont-symbol-script',
    name: '账单分类图标',
    url: CATEGORY_ICONFONT_SYMBOL_SCRIPT_URL,
  },
]
const CURRENT_COLOR_SYMBOL_IDS = ['icon-pie-chart'] as const

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
    // 在线脚本通过零延时任务注入 SVG，延后一轮再处理才能稳定拿到 Symbol 节点。
    script.addEventListener('load', () => window.setTimeout(normalizeSymbolColors, 0), {
      once: true,
    })
  }
  script.addEventListener(
    'error',
    () => {
      script.remove()
      console.error(`${source.name}的 Iconfont Symbol 脚本加载失败，请检查在线 JS 链接。`)
    },
    { once: true },
  )

  document.head.append(script)
}

/**
 * 加载全部 Iconfont Symbol 在线脚本。
 * 每个图标项目只加载一次；链接留空时安全跳过，便于分类图标项目尚未发布时正常开发。
 */
export function loadIconfontSymbols(): void {
  ICONFONT_SYMBOL_SOURCES.forEach(loadIconfontSymbolSource)
}
