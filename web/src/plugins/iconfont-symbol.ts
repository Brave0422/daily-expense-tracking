/**
 * @author Brave
 * @date 2026-09-20T16:46:27+08:00
 * @description Iconfont Symbol 在线脚本配置与加载入口，空链接时不发起网络请求。
 */

/** 从 Iconfont 项目的 Symbol 页面复制最新在线 JS 链接并粘贴到这里。 */
export const ICONFONT_SYMBOL_SCRIPT_URL = '//at.alicdn.com/t/c/font_5236708_nm8240jipm.js'

const SCRIPT_ELEMENT_ID = 'expense-iconfont-symbol-script'

/**
 * 加载 Iconfont Symbol 在线脚本。
 * 相同页面只加载一次；链接留空时安全跳过，便于尚未配置图标库时正常开发。
 */
export function loadIconfontSymbols(): void {
  const scriptUrl = ICONFONT_SYMBOL_SCRIPT_URL.trim()
  if (!scriptUrl || document.getElementById(SCRIPT_ELEMENT_ID)) {
    return
  }

  const script = document.createElement('script')
  script.id = SCRIPT_ELEMENT_ID
  script.src = scriptUrl
  script.async = true
  script.addEventListener(
    'error',
    () => {
      script.remove()
      console.error('Iconfont Symbol 脚本加载失败，请检查在线 JS 链接。')
    },
    { once: true },
  )

  document.head.append(script)
}
