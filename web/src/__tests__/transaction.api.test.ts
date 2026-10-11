/**
 * @author Brave
 * @date 2026-10-10T21:05:20+08:00
 * @description 流水查询接口测试，验证响应解包、取消信号及兼容 Nest 的数组参数编码。
 */

import axios, { type AxiosRequestConfig } from 'axios'
import { describe, expect, it, vi } from 'vitest'
const apiMock = vi.hoisted(() => ({
  get: vi.fn<(url: string, config?: AxiosRequestConfig) => Promise<{ data: { data: unknown } }>>(),
}))
vi.mock('@/api/http', () => ({ apiClient: apiMock }))
import { getDailyTransactions } from '@/api/transaction.api'
import { getUserCategories } from '@/api/category.api'
import { getUserTags } from '@/api/tag.api'

describe('transaction query api', () => {
  it('解包月结果并使用重复键而非带方括号数组参数', async () => {
    const result = { period: '2026-10', days: [] }
    apiMock.get.mockResolvedValue({ data: { data: result } })
    const signal = new AbortController().signal
    const query = { month: '2026-10', categoryIds: [1, 2], tagIds: [3, 4], minAmount: '0.01' }
    await expect(getDailyTransactions(query, signal)).resolves.toEqual(result)
    expect(apiMock.get).toHaveBeenCalledWith('/transactions/daily', {
      params: query,
      paramsSerializer: { indexes: null },
      signal,
    })
    const url = axios.getUri({
      url: '/transactions/daily',
      params: query,
      paramsSerializer: { indexes: null },
    })
    const params = new URL(url, 'http://localhost').searchParams
    expect(params.getAll('categoryIds')).toEqual(['1', '2'])
    expect(params.getAll('tagIds')).toEqual(['3', '4'])
    expect(params.get('minAmount')).toBe('0.01')
    expect(url).not.toContain('%5B')
  })
  it('显式请求包含已归档分类与标签，默认接口行为保持兼容', async () => {
    apiMock.get.mockResolvedValue({ data: { data: [] } })
    await getUserCategories('expense', true)
    await getUserTags(true)
    expect(apiMock.get).toHaveBeenCalledWith('/categories/getUserCategories', {
      params: { type: 'expense', includeArchived: true },
    })
    expect(apiMock.get).toHaveBeenCalledWith('/tags', { params: { includeArchived: true } })
  })
})
