/**
 * @author Brave
 * @date 2026-10-14T12:53:48+08:00
 * @description 三板块独立查询、原子条件联动、月份记忆、取消竞态与失败保留测试。
 */
import { defineComponent } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  CategoryRankingResult,
  CategoryStatisticsResult,
  StatisticsPanelKind,
  TransactionTrendResult,
} from '@/api/statistics.types'
const apiMock = vi.hoisted(() => ({
  getMonthlyCategoryRanking:
    vi.fn<typeof import('@/api/statistics.api').getMonthlyCategoryRanking>(),
  getYearlyCategoryRanking: vi.fn<typeof import('@/api/statistics.api').getYearlyCategoryRanking>(),
  getMonthlyCategoryProportion:
    vi.fn<typeof import('@/api/statistics.api').getMonthlyCategoryProportion>(),
  getYearlyCategoryProportion:
    vi.fn<typeof import('@/api/statistics.api').getYearlyCategoryProportion>(),
  getMonthlyTransactionTrend:
    vi.fn<typeof import('@/api/statistics.api').getMonthlyTransactionTrend>(),
  getYearlyTransactionTrend:
    vi.fn<typeof import('@/api/statistics.api').getYearlyTransactionTrend>(),
}))
vi.mock('@/api/statistics.api', () => apiMock)
import { useStatistics } from '@/views/statistics/composables/useStatistics'

/**
 * @param period 所选周期
 * @returns 空分类汇总，用于状态及请求测试
 */
function categoryResult(period = '2026-10'): CategoryStatisticsResult {
  return {
    period,
    periodType: period.length === 4 ? 'year' : 'month',
    type: 'expense',
    categoryLevel: 2,
    transactionCount: 0,
    totalAmount: '0.00',
    items: [],
  }
}
/**
 * @returns 手动控制完成顺序的 Promise 及完成方法
 */
function deferred<T>() {
  let resolve: (value: T) => void = () => {
    throw new Error('未初始化')
  }
  let reject: (error: Error) => void = () => {
    throw new Error('未初始化')
  }
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}
const wrappers: VueWrapper[] = []
/**
 * @param kind 独立板块类型
 * @returns 已挂载的 composable 状态及可卸载测试容器
 */
function createHarness(kind: StatisticsPanelKind = 'ranking') {
  let state: ReturnType<typeof useStatistics> | undefined
  const wrapper = mount(
    defineComponent({
      setup() {
        state = useStatistics(kind)
        return () => null
      },
    }),
  )
  wrappers.push(wrapper)
  if (!state) throw new Error('统计状态未初始化')
  return { state, wrapper }
}
describe('useStatistics', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-14T12:00:00+08:00'))
    apiMock.getMonthlyCategoryRanking.mockReset().mockImplementation(async (query) => ({
      ...categoryResult(query.month),
      type: query.type,
      categoryLevel: query.categoryLevel,
      order: query.order,
    }))
    apiMock.getYearlyCategoryRanking.mockReset().mockImplementation(async (query) => ({
      ...categoryResult(query.year),
      type: query.type,
      categoryLevel: query.categoryLevel,
      order: query.order,
    }))
    apiMock.getMonthlyCategoryProportion.mockReset().mockResolvedValue(categoryResult())
    apiMock.getYearlyCategoryProportion.mockReset().mockResolvedValue(categoryResult('2026'))
    const trend: TransactionTrendResult = {
      period: '2026-10',
      periodType: 'month',
      type: 'expense',
      transactionCount: 0,
      totalAmount: '0.00',
      previousPeriod: '2026-09',
      previousTotalAmount: '0.00',
      changeStatus: 'unchanged',
      changeRate: '0.00',
      series: [],
    }
    apiMock.getMonthlyTransactionTrend.mockReset().mockResolvedValue(trend)
    apiMock.getYearlyTransactionTrend
      .mockReset()
      .mockResolvedValue({ ...trend, period: '2026', periodType: 'year' })
  })
  afterEach(() => {
    wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
    vi.useRealTimers()
  })
  it('三个首次默认请求及状态独立，趋势不发送分类层级和排序', async () => {
    const ranking = createHarness().state
    const proportion = createHarness('proportion').state
    const trend = createHarness('trend').state
    expect(ranking.result.value).toBeNull()
    expect(ranking.isLoading.value).toBe(true)
    await flushPromises()
    expect(apiMock.getMonthlyCategoryRanking).toHaveBeenCalledWith(
      { month: '2026-10', type: 'expense', categoryLevel: 2, order: 'desc' },
      expect.any(AbortSignal),
    )
    expect(apiMock.getMonthlyCategoryProportion).toHaveBeenCalledWith(
      { month: '2026-10', type: 'expense', categoryLevel: 2 },
      expect.any(AbortSignal),
    )
    expect(apiMock.getMonthlyTransactionTrend).toHaveBeenCalledWith(
      { month: '2026-10', type: 'expense' },
      expect.any(AbortSignal),
    )
    ranking.updateCategoryLevel(1)
    await flushPromises()
    expect(apiMock.getMonthlyCategoryRanking).toHaveBeenCalledTimes(2)
    expect(apiMock.getMonthlyCategoryProportion).toHaveBeenCalledTimes(1)
    expect(apiMock.getMonthlyTransactionTrend).toHaveBeenCalledTimes(1)
    expect(proportion.categoryLevel.value).toBe(2)
    expect(trend.type.value).toBe('expense')
  })
  it('收入一次性切为一级，返回支出恢复本板块上次层级，重复点击不请求', async () => {
    const { state } = createHarness()
    await flushPromises()
    state.updateType('income')
    expect(apiMock.getMonthlyCategoryRanking).toHaveBeenLastCalledWith(
      { month: '2026-10', type: 'income', categoryLevel: 1, order: 'desc' },
      expect.any(AbortSignal),
    )
    state.updateCategoryLevel(2)
    state.updateType('income')
    expect(apiMock.getMonthlyCategoryRanking).toHaveBeenCalledTimes(2)
    state.updateType('expense')
    expect(state.categoryLevel.value).toBe(2)
    state.updateCategoryLevel(1)
    state.toggleOrder()
    state.updateType('income')
    state.updateType('expense')
    await flushPromises()
    expect(state.categoryLevel.value).toBe(1)
    expect(state.order.value).toBe('asc')
  })
  it('按年份记忆月份，历史新年份默认十二月，年份请求不携带 month', async () => {
    const { state } = createHarness()
    await flushPromises()
    state.updatePeriod('2025-03')
    state.updatePeriodType('year')
    expect(apiMock.getYearlyCategoryRanking).toHaveBeenLastCalledWith(
      { year: '2025', type: 'expense', categoryLevel: 2, order: 'desc' },
      expect.any(AbortSignal),
    )
    state.updatePeriodType('month')
    expect(state.period.value).toBe('2025-03')
    state.updatePeriodType('year')
    state.updatePeriod('2024')
    state.updatePeriodType('month')
    expect(state.period.value).toBe('2024-12')
    state.updatePeriodType('year')
    state.updatePeriod('2026')
    state.updatePeriodType('month')
    expect(state.period.value).toBe('2026-10')
    const callCount = apiMock.getMonthlyCategoryRanking.mock.calls.length
    state.updatePeriod('2026-10')
    state.updatePeriod('2026-13')
    state.updatePeriod('1000-01')
    expect(apiMock.getMonthlyCategoryRanking).toHaveBeenCalledTimes(callCount)
    await flushPromises()
  })
  it('旧响应、旧错误和旧 finally 均不能覆盖最新条件', async () => {
    const oldest = deferred<CategoryRankingResult>()
    const middle = deferred<CategoryRankingResult>()
    const latest = deferred<CategoryRankingResult>()
    apiMock.getMonthlyCategoryRanking
      .mockReturnValueOnce(oldest.promise)
      .mockReturnValueOnce(middle.promise)
      .mockReturnValueOnce(latest.promise)
    const { state } = createHarness()
    const firstSignal = apiMock.getMonthlyCategoryRanking.mock.calls[0]?.[1]
    state.updatePeriod('2026-09')
    state.updatePeriod('2026-08')
    expect(firstSignal?.aborted).toBe(true)
    oldest.resolve({ ...categoryResult(), order: 'desc' })
    middle.reject(new Error('旧查询失败'))
    await flushPromises()
    expect(state.result.value).toBeNull()
    expect(state.errorMessage.value).toBe('')
    expect(state.isLoading.value).toBe(true)
    latest.resolve({ ...categoryResult('2026-08'), order: 'desc' })
    await flushPromises()
    expect(state.result.value?.period).toBe('2026-08')
    expect(state.isLoading.value).toBe(false)
  })
  it('刷新失败保留原周期成功结果，重试保留当前筛选并仅请求当前板块', async () => {
    const { state } = createHarness()
    await flushPromises()
    apiMock.getMonthlyCategoryRanking.mockRejectedValueOnce(new Error('网络故障'))
    state.updatePeriod('2026-09')
    await flushPromises()
    expect(state.errorMessage.value).toBe('网络故障')
    expect(state.result.value?.period).toBe('2026-10')
    expect(state.period.value).toBe('2026-09')
    await state.refresh()
    expect(state.result.value?.period).toBe('2026-09')
    expect(state.errorMessage.value).toBe('')
    expect(apiMock.getMonthlyCategoryProportion).not.toHaveBeenCalled()
  })
  it('页面离开取消请求并忽略已销毁页面的结果', async () => {
    const pending = deferred<CategoryRankingResult>()
    apiMock.getMonthlyCategoryRanking.mockReturnValueOnce(pending.promise)
    const { state, wrapper } = createHarness()
    const signal = apiMock.getMonthlyCategoryRanking.mock.calls[0]?.[1]
    wrapper.unmount()
    expect(signal?.aborted).toBe(true)
    pending.resolve({ ...categoryResult(), order: 'desc' })
    await flushPromises()
    expect(state.result.value).toBeNull()
  })
})
