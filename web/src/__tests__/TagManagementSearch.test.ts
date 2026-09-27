/**
 * @author Brave
 * @date 2026-09-27T21:17:54+08:00
 * @description 标签搜索交互测试，验证防抖、关键词规范化、立即搜索和空结果状态。
 */

import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const apiMocks = vi.hoisted(() => ({
  deleteTag: vi.fn(),
  getUserTags: vi.fn(),
  searchUserTags: vi.fn(),
}))

vi.mock('@/api/tag.api', () => ({
  deleteTag: apiMocks.deleteTag,
  getUserTags: apiMocks.getUserTags,
  searchUserTags: apiMocks.searchUserTags,
}))

import TagManagementCard from '@/views/configuration/components/TagManagementCard.vue'

const globalStubs = {
  TagFormDialog: true,
  TagListItem: {
    props: ['tag'],
    template: '<li>{{ tag.name }}</li>',
  },
  TButton: { template: '<button type="button"><slot /></button>' },
  TDialog: { template: '<div><slot /></div>' },
}

describe('tag management search', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    apiMocks.getUserTags.mockResolvedValue([])
    apiMocks.searchUserTags.mockResolvedValue([])
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it('输入关键词300ms后使用去除首尾空格的key搜索', async () => {
    apiMocks.searchUserTags.mockResolvedValue([{ id: 1, name: '深圳聚餐' }])
    const wrapper = mount(TagManagementCard, { global: { stubs: globalStubs } })
    await flushPromises()

    await wrapper.get('input[type="search"]').setValue('  聚餐  ')
    vi.advanceTimersByTime(299)
    await flushPromises()
    expect(apiMocks.searchUserTags).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    await flushPromises()
    expect(apiMocks.searchUserTags).toHaveBeenCalledExactlyOnceWith('聚餐')
    expect(wrapper.text()).toContain('深圳聚餐')

    wrapper.unmount()
  })

  it('回车立即搜索并取消尚未触发的防抖任务', async () => {
    const wrapper = mount(TagManagementCard, { global: { stubs: globalStubs } })
    await flushPromises()

    await wrapper.get('input[type="search"]').setValue('请客')
    await wrapper.get('form[role="search"]').trigger('submit')
    await flushPromises()

    expect(apiMocks.searchUserTags).toHaveBeenCalledExactlyOnceWith('请客')

    vi.advanceTimersByTime(300)
    await flushPromises()
    expect(apiMocks.searchUserTags).toHaveBeenCalledOnce()

    wrapper.unmount()
  })

  it('搜索无结果时展示匹配为空状态且不显示新增入口', async () => {
    const wrapper = mount(TagManagementCard, { global: { stubs: globalStubs } })
    await flushPromises()

    await wrapper.get('input[type="search"]').setValue('不存在')
    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(wrapper.text()).toContain('未找到匹配标签')
    expect(wrapper.text()).not.toContain('添加第一个标签')

    wrapper.unmount()
  })

  it('清空关键词后恢复获取全部标签且不调用搜索接口', async () => {
    const wrapper = mount(TagManagementCard, { global: { stubs: globalStubs } })
    await flushPromises()

    await wrapper.get('input[type="search"]').setValue('   ')
    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(apiMocks.getUserTags).toHaveBeenCalledTimes(2)
    expect(apiMocks.searchUserTags).not.toHaveBeenCalled()

    wrapper.unmount()
  })
})
