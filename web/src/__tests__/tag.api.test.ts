/**
 * @author Brave
 * @date 2026-09-27T18:40:04+08:00
 * @description 标签接口测试，验证列表解包及增删改请求路径与参数。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const apiClientMock = vi.hoisted(() => ({
  delete: vi.fn(),
  get: vi.fn(),
  patch: vi.fn(),
  post: vi.fn(),
}))

vi.mock('@/api/http', () => ({ apiClient: apiClientMock }))

import { createTag, deleteTag, getUserTags, updateTag } from '@/api/tag.api'

describe('tag api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('解包当前用户标签列表', async () => {
    const tags = [
      { id: 1, name: '聚餐' },
      { id: 2, name: '2026年9月20日去深圳南山区游乐园玩' },
    ]
    apiClientMock.get.mockResolvedValue({ data: { data: tags } })

    await expect(getUserTags()).resolves.toEqual(tags)
    expect(apiClientMock.get).toHaveBeenCalledWith('/tags')
  })

  it('使用后端约定的路径提交标签增删改请求', async () => {
    apiClientMock.post.mockResolvedValue(undefined)
    apiClientMock.patch.mockResolvedValue(undefined)
    apiClientMock.delete.mockResolvedValue(undefined)

    await createTag({ name: '请客' })
    await updateTag(7, { name: '聚餐' })
    await deleteTag(7)

    expect(apiClientMock.post).toHaveBeenCalledWith('/tags', { name: '请客' })
    expect(apiClientMock.patch).toHaveBeenCalledWith('/tags/7', { name: '聚餐' })
    expect(apiClientMock.delete).toHaveBeenCalledWith('/tags/7/archive')
  })
})
