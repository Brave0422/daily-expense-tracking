/**
 * @author Brave
 * @date 2026-09-20T16:46:27+08:00
 * @description BaseIcon 组件测试，验证业务名称与 Iconfont Symbol ID 的集中映射。
 */

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import BaseIcon, { type IconName } from '@/components/base/BaseIcon.vue'

const SYMBOL_ID_BY_NAME: Readonly<Record<IconName, string>> = {
  records: 'icon-shouye',
  statistics: 'icon-bingtu-F',
  management: 'icon-wrench-full',
  changePassword: 'icon-xiugaimima01',
  logout: 'icon-exit-full',
  hide: 'icon-yincang',
  show: 'icon-xianshikejian',
}

describe('BaseIcon', () => {
  it.each(Object.entries(SYMBOL_ID_BY_NAME))('将 %s 映射为 #%s', (name, symbolId) => {
    const wrapper = mount(BaseIcon, {
      props: { name: name as IconName, size: 20 },
    })

    expect(wrapper.get('use').attributes('href')).toBe(`#${symbolId}`)
    expect(wrapper.get('svg').attributes('style')).toContain('width: 20px')
    expect(wrapper.get('svg').attributes('aria-hidden')).toBe('true')
  })
})
