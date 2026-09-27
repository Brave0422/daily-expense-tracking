/**
 * @author Brave
 * @date 2026-09-27T18:40:04+08:00
 * @description 标签展示项测试，验证编辑与删除入口互不串联。
 */

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import TagListItem from '@/views/configuration/components/TagListItem.vue'

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
})
