/**
 * @author Brave
 * @date 2026-09-27T18:40:04+08:00
 * @description 标签展示项测试，验证编辑与删除入口互不串联。
 */

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import TagListItem from '@/components/business/TagListItem.vue'

describe('TagListItem', () => {
  it('分别派发编辑和删除事件', async () => {
    const tag = { id: 7, name: '聚餐' }
    const wrapper = mount(TagListItem, {
      props: { tag },
      global: {
        stubs: {
          TTooltip: { template: '<span><slot /></span>' },
        },
      },
    })
    const buttons = wrapper.findAll('button')

    await buttons[0]?.trigger('click')
    expect(wrapper.emitted('edit')).toEqual([[tag]])

    await buttons[1]?.trigger('click')
    expect(wrapper.emitted('delete')).toEqual([[tag]])
    expect(wrapper.emitted('edit')).toHaveLength(1)
  })

  it('流水标签仅提供移除入口，名称溢出时显示完整提示', async () => {
    const tag = { id: 8, name: '新西兰旅行的全部相关消费', archived: true }
    const wrapper = mount(TagListItem, {
      props: { tag, editable: false, maxWidth: 200 },
      global: {
        stubs: {
          TTooltip: {
            name: 'TTooltip',
            props: ['content', 'disabled'],
            template: '<span><slot /></span>',
          },
        },
      },
    })
    const name = wrapper.get('.tag-list-item__name').element
    Object.defineProperties(name, { scrollWidth: { value: 300 }, clientWidth: { value: 100 } })
    await wrapper.setProps({ tag: { ...tag, name: `${tag.name}明细` } })
    await wrapper.vm.$nextTick()
    expect(wrapper.get('li').attributes('style')).toContain('max-width: 200px')
    expect(wrapper.getComponent({ name: 'TTooltip' }).props()).toMatchObject({
      content: `${tag.name}明细（已归档）`,
      disabled: false,
    })
    expect(wrapper.findAll('button')).toHaveLength(1)
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('delete')).toHaveLength(1)
    expect(wrapper.emitted('edit')).toBeUndefined()
    wrapper.unmount()
  })
})
