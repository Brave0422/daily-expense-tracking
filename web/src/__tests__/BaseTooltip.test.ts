/**
 * @author Brave
 * @date 2026-10-10T21:12:17+08:00
 * @description 提示可访问性测试，验证悬停、聚焦和 Escape 关闭之间的状态协作。
 */

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import BaseTooltip from '@/components/base/BaseTooltip.vue'

describe('BaseTooltip', () => {
  it('仅截断提示在实际溢出时显示，并按最新宽度重新判断', async () => {
    const wrapper = mount(BaseTooltip, {
      props: { content: '分类 · 标题', block: true, overflowOnly: true },
      slots: { default: '<p tabindex="0">分类 · 标题</p>' },
      global: {
        stubs: {
          TTooltip: { name: 'TTooltip', props: ['visible'], template: '<div><slot /></div>' },
        },
      },
    })
    const title = wrapper.get('p').element
    Object.defineProperty(title, 'scrollWidth', { configurable: true, value: 100 })
    Object.defineProperty(title, 'clientWidth', { configurable: true, value: 100 })
    const tooltip = wrapper.getComponent({ name: 'TTooltip' })
    const trigger = wrapper.get('.base-tooltip')
    await trigger.trigger('mouseenter')
    expect(tooltip.props('visible')).toBe(false)
    await trigger.trigger('mouseleave')
    Object.defineProperty(title, 'clientWidth', { configurable: true, value: 50 })
    await trigger.trigger('mouseenter')
    expect(tooltip.props('visible')).toBe(true)
    await trigger.trigger('mouseleave')
    await trigger.trigger('focusin')
    expect(tooltip.props('visible')).toBe(true)
    await trigger.trigger('keydown', { key: 'Escape' })
    expect(tooltip.props('visible')).toBe(false)
    wrapper.unmount()
  })

  it('悬停及键盘聚焦均可查看提示，离开鼠标时仍保留聚焦提示，Escape关闭', async () => {
    const wrapper = mount(BaseTooltip, {
      props: { content: '完整备注' },
      slots: { default: '<button type="button">备注</button>' },
      global: {
        stubs: {
          TTooltip: { name: 'TTooltip', props: ['visible'], template: '<div><slot /></div>' },
        },
      },
    })
    const tooltip = wrapper.getComponent({ name: 'TTooltip' })
    const trigger = wrapper.get('.base-tooltip')
    expect(tooltip.props('visible')).toBe(false)
    await trigger.trigger('mouseenter')
    expect(tooltip.props('visible')).toBe(true)
    await trigger.trigger('focusin')
    await trigger.trigger('mouseleave')
    expect(tooltip.props('visible')).toBe(true)
    await trigger.trigger('keydown', { key: 'Escape' })
    expect(tooltip.props('visible')).toBe(false)
    await trigger.trigger('focusin')
    await trigger.trigger('focusout')
    expect(tooltip.props('visible')).toBe(false)
    wrapper.unmount()
  })
})
