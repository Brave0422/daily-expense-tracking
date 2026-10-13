/**
 * @author Brave
 * @date 2026-10-10T21:05:20+08:00
 * @description 流水接口测试，验证创建编辑删除请求、查询解包、取消信号及数组参数编码。
 */

import axios, { type AxiosRequestConfig } from 'axios'
import { describe, expect, it, vi } from 'vitest'
const apiMock = vi.hoisted(() => ({
  get: vi.fn<(url: string, config?: AxiosRequestConfig) => Promise<{ data: { data: unknown } }>>(),
  post: vi.fn<(url: string, body: unknown) => Promise<unknown>>(),
  patch: vi.fn<(url: string, body: unknown) => Promise<unknown>>(),
  delete: vi.fn<(url: string) => Promise<unknown>>(),
}))
vi.mock('@/api/http', () => ({ apiClient: apiMock }))
import {
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getDailyTransactions,
  getMonthlySummary,
} from '@/api/transaction.api'
import { getUserCategories } from '@/api/category.api'
import { getUserTags } from '@/api/tag.api'

describe('transaction query api', () => {
  it('删除使用归档路径、空请求体且不依赖响应数据，错误交给弹窗处理', async () => {
    apiMock.delete.mockResolvedValue({ data: { code: 200, success: true } })
    await expect(deleteTransaction(101)).resolves.toBeUndefined()
    expect(apiMock.delete).toHaveBeenCalledWith('/transactions/101/archive')
    const error = new Error('流水记录不存在')
    apiMock.delete.mockRejectedValueOnce(error)
    await expect(deleteTransaction(101)).rejects.toBe(error)
  })
  it('创建请求使用约定路径并保留金额与日期字符串，不要求响应数据', async () => {
    const body = {
      type: 'expense' as const,
      categoryId: 2,
      amount: '9999999999999.99',
      occurredDate: '2026-10-12',
      title: null,
      tagIds: [3, 4],
      remark: null,
    }
    apiMock.post.mockResolvedValue({ data: { code: 200, success: true } })
    await expect(createTransaction(body)).resolves.toBeUndefined()
    expect(apiMock.post).toHaveBeenCalledWith('/transactions', body)
  })
  it('编辑使用路径id与完整六个字段，不提交流水类型或依赖响应数据', async () => {
    const body = {
      categoryId: 2,
      amount: '9999999999999.99',
      occurredDate: '2024-02-29',
      title: null,
      tagIds: [],
      remark: null,
    }
    apiMock.patch.mockResolvedValue({ data: { code: 200, success: true } })
    await expect(updateTransaction(101, body)).resolves.toBeUndefined()
    expect(apiMock.patch).toHaveBeenCalledWith('/transactions/101', body)
  })
  it('编辑请求失败时将错误交给表单处理', async () => {
    const error = new Error('流水记录不存在')
    apiMock.patch.mockRejectedValueOnce(error)
    await expect(
      updateTransaction(101, {
        categoryId: 2,
        amount: '1.00',
        occurredDate: '2026-10-13',
        title: null,
        tagIds: [],
        remark: null,
      }),
    ).rejects.toBe(error)
  })
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
  it('年查询使用monthly-summary路径、字符串period和兼容Nest的分类参数编码', async () => {
    const result = { period: '2025', months: [] }
    apiMock.get.mockResolvedValue({ data: { data: result } })
    const signal = new AbortController().signal
    const query = { year: '2025', categoryIds: [1, 2], minAmount: '0.01' }
    await expect(getMonthlySummary(query, signal)).resolves.toEqual(result)
    expect(apiMock.get).toHaveBeenCalledWith('/transactions/monthly-summary', {
      params: query,
      paramsSerializer: { indexes: null },
      signal,
    })
    const url = axios.getUri({
      url: '/transactions/monthly-summary',
      params: query,
      paramsSerializer: { indexes: null },
    })
    const params = new URL(url, 'http://localhost').searchParams
    expect(params.get('year')).toBe('2025')
    expect(params.getAll('categoryIds')).toEqual(['1', '2'])
    for (const name of ['title', 'tagIds', 'remark', 'month']) expect(params.has(name)).toBe(false)
  })
})
