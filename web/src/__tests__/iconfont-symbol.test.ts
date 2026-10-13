/**
 * @author Brave
 * @date 2026-09-24T09:58:53+08:00
 * @description 本地 Symbol 加载测试，验证分类 SVG 注入、颜色变量保留和重复加载保护。
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { loadIconfontSymbols } from '@/plugins/iconfont-symbol'
import appSymbolSource from '@/assets/iconfont/app-symbol.js?raw'

const APP_SYMBOL_SCRIPT_ID = 'expense-app-iconfont-symbol-script'
const CATEGORY_SYMBOL_SPRITE_ID = 'expense-category-icon-symbol-sprite'

describe('loadIconfontSymbols', () => {
  beforeEach(() => {
    document.getElementById(APP_SYMBOL_SCRIPT_ID)?.remove()
    document.getElementById(CATEGORY_SYMBOL_SPRITE_ID)?.remove()
  })

  it('从本地资源加载通用图标脚本并注入全部分类 Symbol', () => {
    loadIconfontSymbols()

    const appSymbolScript = document.getElementById(APP_SYMBOL_SCRIPT_ID)
    expect(appSymbolScript?.getAttribute('src')).toContain('app-symbol')
    expect(appSymbolScript?.getAttribute('src')).not.toContain('alicdn.com')

    const categorySprite = document.getElementById(CATEGORY_SYMBOL_SPRITE_ID)
    expect(categorySprite?.querySelectorAll('symbol')).toHaveLength(110)

    const generalSymbol = categorySprite?.querySelector('#icon-category-coffee')
    expect(generalSymbol?.querySelector('path')?.getAttribute('fill')).toContain(
      'var(--category-icon-background',
    )
    expect(generalSymbol?.querySelector('title')).toBeNull()
  })

  it('重复加载时不重复创建脚本和 Sprite', () => {
    loadIconfontSymbols()
    loadIconfontSymbols()

    expect(document.querySelectorAll(`#${APP_SYMBOL_SCRIPT_ID}`)).toHaveLength(1)
    expect(document.querySelectorAll(`#${CATEGORY_SYMBOL_SPRITE_ID}`)).toHaveLength(1)
  })

  it('删除图标主体继承按钮颜色，白色减号保留而非显示实心圆', () => {
    const sprite = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    sprite.innerHTML =
      appSymbolSource.match(/<symbol id="icon-shanchu1"[\s\S]*?<\/symbol>/)?.[0] ?? ''
    document.body.append(sprite)
    try {
      loadIconfontSymbols()
      loadIconfontSymbols()
      const paths = sprite.querySelectorAll('path')
      expect(paths).toHaveLength(2)
      expect(paths[0]?.hasAttribute('fill')).toBe(false)
      expect(paths[1]?.getAttribute('fill')).toBe('#FFFDFD')
    } finally {
      sprite.remove()
    }
  })
})
