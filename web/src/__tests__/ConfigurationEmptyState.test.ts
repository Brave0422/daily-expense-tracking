/**
 * @author Brave
 * @date 2026-09-27T18:42:46+08:00
 * @description 配置管理空状态测试，验证分类与标签使用统一缺省图标及对应文案。
 */

import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const apiMocks = vi.hoisted(() => ({
  deleteCategory: vi.fn(),
  deleteTag: vi.fn(),
  getUserCategories: vi.fn(),
  getUserTags: vi.fn(),
}))

vi.mock('@/api/category.api', () => ({
  deleteCategory: apiMocks.deleteCategory,
  getUserCategories: apiMocks.getUserCategories,
}))
vi.mock('@/api/tag.api', () => ({
  deleteTag: apiMocks.deleteTag,
  getUserTags: apiMocks.getUserTags,
}))

import CategoryManagementCard from '@/views/configuration/components/CategoryManagementCard.vue'
import TagManagementCard from '@/views/configuration/components/TagManagementCard.vue'

const globalStubs = {
  CategoryFormDialog: true,
  TagFormDialog: true,
  TButton: { template: '<button type="button"><slot /></button>' },
  TDialog: { template: '<div><slot /></div>' },
}

describe('configuration empty states', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('分类为空时展示缺省图标和当前类型文案', async () => {
    apiMocks.getUserCategories.mockResolvedValue([])
    const wrapper = mount(CategoryManagementCard, { global: { stubs: globalStubs } })

    await flushPromises()

    expect(wrapper.text()).toContain('暂无支出分类')
    expect(wrapper.get('.category-card__empty-icon use').attributes('href')).toBe(
      '#icon-queshengye_zanwushuju',
    )
  })

  it('标签为空时展示缺省图标和暂无标签文案', async () => {
    apiMocks.getUserTags.mockResolvedValue([])
    const wrapper = mount(TagManagementCard, { global: { stubs: globalStubs } })

    await flushPromises()

    expect(wrapper.text()).toContain('暂无标签')
    expect(wrapper.get('.tag-card__empty-icon use').attributes('href')).toBe(
      '#icon-queshengye_zanwushuju',
    )
  })
})
