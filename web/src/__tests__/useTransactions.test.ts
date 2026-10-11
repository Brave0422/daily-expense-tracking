/**
 * @author Brave
 * @date 2026-10-10T21:05:20+08:00
 * @description 双模式流水查询流程测试，覆盖周期转换、参数隔离、防抖、竞态及失败保留。
 */

import { defineComponent } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DailyTransactionsResult, MonthlySummaryResult } from '@/api/transaction.types'

const apiMock = vi.hoisted(() => ({
  getDailyTransactions: vi.fn<typeof import('@/api/transaction.api').getDailyTransactions>(),
  getMonthlySummary: vi.fn<typeof import('@/api/transaction.api').getMonthlySummary>(),
}))
vi.mock('@/api/transaction.api', () => apiMock)
import { useTransactions } from '@/views/transactions/composables/useTransactions'

function createResult(period = '2026-10'): DailyTransactionsResult {
  return {
    period,
    totals: { expense: '100.00', income: '100.00', balance: '0.00' },
    filterTotals: { expense: '100.00', income: '100.00' },
    days: [],
  }
}
function createMonthlyResult(period = '2026'): MonthlySummaryResult {
  return {
    period,
    totals: { expense: '100.00', income: '200.00', balance: '100.00' },
    filterTotals: { expense: '100.00', income: '200.00' },
    months: [],
  }
}
function deferred<T>() {
  let resolve: (value: T) => void = () => {
    throw new Error('Promise 尚未初始化')
  }
  let reject: (error: Error) => void = () => {
    throw new Error('Promise 尚未初始化')
  }
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}
const wrappers: VueWrapper[] = []
function createHarness() {
  let state: ReturnType<typeof useTransactions> | undefined
  const wrapper = mount(
    defineComponent({
      setup() {
        state = useTransactions()
        return () => null
      },
    }),
  )
  wrappers.push(wrapper)
  if (!state) throw new Error('查询状态未创建')
  return { state, wrapper }
}

describe('useTransactions', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-10T12:00:00+08:00'))
    apiMock.getDailyTransactions.mockReset().mockResolvedValue(createResult())
    apiMock.getMonthlySummary
      .mockReset()
      .mockImplementation(async (query) => createMonthlyResult(query.year))
  })
  afterEach(() => {
    wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('首次查询当前月份，加载前不把未知合计显示为零，结余为零仍有流水', async () => {
    const { state } = createHarness()
    expect(state.result.value).toBeNull()
    expect(state.isLoading.value).toBe(true)
    expect(apiMock.getDailyTransactions).toHaveBeenCalledWith(
      { month: '2026-10' },
      expect.any(AbortSignal),
    )
    await flushPromises()
    expect(state.hasPeriodTransactions.value).toBe(true)
  })

  it('文本与金额延迟300ms并去除首尾空格，回车对应的立即刷新取消延迟任务', async () => {
    const { state } = createHarness()
    await flushPromises()
    state.updateFilters({
      ...state.filters.value,
      title: '  聚餐  ',
      remark: '  朋友  ',
      minAmount: ' 0.01 ',
    })
    vi.advanceTimersByTime(299)
    expect(apiMock.getDailyTransactions).toHaveBeenCalledTimes(1)
    expect(state.isResultStale.value).toBe(true)
    await state.refresh()
    expect(apiMock.getDailyTransactions).toHaveBeenLastCalledWith(
      { month: '2026-10', title: '聚餐', remark: '朋友', minAmount: '0.01' },
      expect.any(AbortSignal),
    )
    vi.advanceTimersByTime(300)
    expect(apiMock.getDailyTransactions).toHaveBeenCalledTimes(2)
  })

  it('类型、分类、标签立即查询并取消待执行文本任务', async () => {
    const { state } = createHarness()
    await flushPromises()
    state.updateFilters({ ...state.filters.value, title: '电脑' })
    state.updateFilters({ ...state.filters.value, type: 'expense', categoryIds: [2], tagIds: [3] })
    expect(apiMock.getDailyTransactions).toHaveBeenLastCalledWith(
      { month: '2026-10', type: 'expense', categoryIds: [2], tagIds: [3], title: '电脑' },
      expect.any(AbortSignal),
    )
    vi.advanceTimersByTime(300)
    expect(apiMock.getDailyTransactions).toHaveBeenCalledTimes(2)
  })

  it('精确校验大金额区间；格式错误或最小值更大时暂停查询', async () => {
    const { state } = createHarness()
    await flushPromises()
    state.updateFilters({
      ...state.filters.value,
      minAmount: '9999999999999.99',
      maxAmount: '9999999999999.98',
    })
    expect(state.amountError.value).toBe('最小金额不能大于最大金额')
    await state.refresh()
    expect(apiMock.getDailyTransactions).toHaveBeenCalledTimes(1)
    state.updateFilters({ ...state.filters.value, minAmount: '1.001', maxAmount: '' })
    expect(state.amountError.value).toContain('最多13位整数和2位小数')
    vi.advanceTimersByTime(300)
    expect(apiMock.getDailyTransactions).toHaveBeenCalledTimes(1)
    state.updateFilters({ ...state.filters.value, minAmount: '', maxAmount: '0' })
    vi.advanceTimersByTime(300)
    await flushPromises()
    expect(apiMock.getDailyTransactions).toHaveBeenLastCalledWith(
      { month: '2026-10', maxAmount: '0' },
      expect.any(AbortSignal),
    )
  })

  it('月份切换中旧响应及其finally都不能覆盖新请求', async () => {
    const first = deferred<DailyTransactionsResult>()
    const second = deferred<DailyTransactionsResult>()
    apiMock.getDailyTransactions
      .mockReset()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
    const { state } = createHarness()
    const signal = apiMock.getDailyTransactions.mock.calls[0]?.[1]
    if (!signal) throw new Error('查询未传入取消信号')
    state.updatePeriod('2026-09')
    expect(signal.aborted).toBe(true)
    first.resolve(createResult())
    await flushPromises()
    expect(state.result.value).toBeNull()
    expect(state.isLoading.value).toBe(true)
    second.resolve(createResult('2026-09'))
    await flushPromises()
    expect(state.result.value?.period).toBe('2026-09')
    expect(state.isLoading.value).toBe(false)
  })

  it('防抖等待或非法金额条件一出现就作废旧请求', async () => {
    const pending = deferred<DailyTransactionsResult>()
    apiMock.getDailyTransactions.mockReturnValueOnce(pending.promise)
    const { state } = createHarness()
    state.updateFilters({ ...state.filters.value, title: '新条件' })
    state.updateFilters({ ...state.filters.value, minAmount: '-1' })
    pending.resolve(createResult())
    await flushPromises()
    expect(state.result.value).toBeNull()
    expect(state.isLoading.value).toBe(false)
    vi.advanceTimersByTime(300)
    expect(apiMock.getDailyTransactions).toHaveBeenCalledTimes(1)
  })

  it('筛选失败保留上次成功结果，两种合计与列表一同重试', async () => {
    const { state } = createHarness()
    await flushPromises()
    apiMock.getDailyTransactions.mockRejectedValueOnce(new Error('连接失败'))
    state.updateFilters({ ...state.filters.value, type: 'expense' })
    await flushPromises()
    expect(state.errorMessage.value).toBe('连接失败')
    expect(state.result.value).toEqual(createResult())
    expect(state.isResultStale.value).toBe(true)
    apiMock.getDailyTransactions.mockResolvedValueOnce({
      ...createResult(),
      filterTotals: { expense: '100.00', income: '0.00' },
    })
    await state.refresh()
    expect(state.result.value?.filterTotals.income).toBe('0.00')
    expect(state.result.value?.totals.income).toBe('100.00')
    expect(state.errorMessage.value).toBe('')
    expect(state.isResultStale.value).toBe(false)
  })

  it('重置清空全部筛选，保留当前月份，并省略空参数', async () => {
    const { state } = createHarness()
    await flushPromises()
    state.updatePeriod('2025-12')
    state.updateFilters({
      type: 'income',
      categoryIds: [1],
      tagIds: [2],
      title: '标题',
      remark: '备注',
      minAmount: '1',
      maxAmount: '2',
    })
    state.resetFilters()
    expect(state.period.value).toBe('2025-12')
    expect(state.hasFilters.value).toBe(false)
    expect(apiMock.getDailyTransactions).toHaveBeenLastCalledWith(
      { month: '2025-12' },
      expect.any(AbortSignal),
    )
  })

  it('卸载取消请求及防抖任务，迟到失败不写入状态', async () => {
    const pending = deferred<DailyTransactionsResult>()
    apiMock.getDailyTransactions.mockReturnValueOnce(pending.promise)
    const { state, wrapper } = createHarness()
    const signal = apiMock.getDailyTransactions.mock.calls[0]?.[1]
    if (!signal) throw new Error('查询未传入取消信号')
    state.updateFilters({ ...state.filters.value, title: '查询' })
    wrapper.unmount()
    pending.reject(new Error('迟到失败'))
    vi.advanceTimersByTime(300)
    await flushPromises()
    expect(signal.aborted).toBe(true)
    expect(apiMock.getDailyTransactions).toHaveBeenCalledTimes(1)
    expect(state.errorMessage.value).toBe('')
  })

  it('转年模式取消日筛选防抖，清空专用条件并仅保留类型、分类和金额参数', async () => {
    const { state } = createHarness()
    await flushPromises()
    state.updateFilters({
      ...state.filters.value,
      type: 'expense',
      categoryIds: [2],
      tagIds: [3],
    })
    state.updateFilters({
      ...state.filters.value,
      title: '待查询标题',
      remark: '待查询备注',
      minAmount: ' 0.01 ',
      maxAmount: '100',
    })
    state.toggleMode()
    expect(state.mode.value).toBe('monthly')
    expect(state.period.value).toBe('2026')
    expect(state.filters.value).toMatchObject({ title: '', tagIds: [], remark: '' })
    expect(apiMock.getMonthlySummary).toHaveBeenLastCalledWith(
      { year: '2026', type: 'expense', categoryIds: [2], minAmount: '0.01', maxAmount: '100' },
      expect.any(AbortSignal),
    )
    vi.advanceTimersByTime(300)
    await flushPromises()
    expect(apiMock.getDailyTransactions).toHaveBeenCalledTimes(2)
    expect(apiMock.getMonthlySummary).toHaveBeenCalledTimes(1)
    expect(state.monthlyResult.value?.period).toBe('2026')
    expect(state.dailyResult.value).toBeNull()

    state.updateFilters({
      ...state.filters.value,
      title: '禁用标题',
      tagIds: [9],
      remark: '禁用备注',
    })
    vi.advanceTimersByTime(300)
    expect(state.filters.value).toMatchObject({ title: '', tagIds: [], remark: '' })
    expect(apiMock.getMonthlySummary).toHaveBeenCalledTimes(1)
    expect(state.isResultStale.value).toBe(false)
  })

  it('返回当年日明细使用当前月，其他年份使用12月，清空的日筛选不恢复', async () => {
    const { state } = createHarness()
    await flushPromises()
    state.updatePeriod('2026-03')
    state.updateFilters({ ...state.filters.value, title: '旧标题', type: 'income' })
    state.toggleMode()
    state.toggleMode()
    expect(state.period.value).toBe('2026-10')
    expect(apiMock.getDailyTransactions).toHaveBeenLastCalledWith(
      { month: '2026-10', type: 'income' },
      expect.any(AbortSignal),
    )
    state.toggleMode()
    state.updatePeriod('2025')
    state.toggleMode()
    expect(state.period.value).toBe('2025-12')
    expect(state.filters.value.title).toBe('')
    expect(apiMock.getDailyTransactions).toHaveBeenLastCalledWith(
      { month: '2025-12', type: 'income' },
      expect.any(AbortSignal),
    )
    await flushPromises()
  })

  it('日请求迟到不能覆盖年模式，年请求迟到也不能覆盖切回后的日模式', async () => {
    const daily = deferred<DailyTransactionsResult>()
    const monthly = deferred<MonthlySummaryResult>()
    const latest = deferred<DailyTransactionsResult>()
    apiMock.getDailyTransactions
      .mockReset()
      .mockReturnValueOnce(daily.promise)
      .mockReturnValueOnce(latest.promise)
    apiMock.getMonthlySummary.mockReturnValueOnce(monthly.promise)
    const { state } = createHarness()
    const dailySignal = apiMock.getDailyTransactions.mock.calls[0]?.[1]
    state.toggleMode()
    expect(dailySignal?.aborted).toBe(true)
    daily.resolve(createResult())
    await flushPromises()
    expect(state.result.value).toBeNull()
    expect(state.isLoading.value).toBe(true)
    const monthlySignal = apiMock.getMonthlySummary.mock.calls[0]?.[1]
    state.toggleMode()
    expect(monthlySignal?.aborted).toBe(true)
    monthly.resolve(createMonthlyResult())
    await flushPromises()
    expect(state.result.value).toBeNull()
    expect(state.isLoading.value).toBe(true)
    latest.resolve(createResult())
    await flushPromises()
    expect(state.dailyResult.value).toEqual(createResult())
    expect(state.monthlyResult.value).toBeNull()
    expect(state.isLoading.value).toBe(false)
  })

  it('年查询失败保留旧结果，重试与重置保留年模式及年份，金额仍防抖和校验', async () => {
    const { state } = createHarness()
    await flushPromises()
    apiMock.getMonthlySummary.mockRejectedValueOnce(new Error('年查询失败'))
    state.toggleMode()
    await flushPromises()
    expect(state.errorMessage.value).toBe('年查询失败')
    expect(state.dailyResult.value).toEqual(createResult())
    expect(state.hasCurrentPeriod.value).toBe(false)
    await state.refresh()
    state.updatePeriod('2025')
    await flushPromises()
    state.updateFilters({ ...state.filters.value, minAmount: '10', maxAmount: '1' })
    const requestCount = apiMock.getMonthlySummary.mock.calls.length
    vi.advanceTimersByTime(300)
    expect(state.amountError.value).toBe('最小金额不能大于最大金额')
    expect(apiMock.getMonthlySummary).toHaveBeenCalledTimes(requestCount)
    state.updateFilters({ ...state.filters.value, maxAmount: '100' })
    vi.advanceTimersByTime(299)
    expect(apiMock.getMonthlySummary).toHaveBeenCalledTimes(requestCount)
    vi.advanceTimersByTime(1)
    await flushPromises()
    expect(apiMock.getMonthlySummary).toHaveBeenLastCalledWith(
      { year: '2025', minAmount: '10', maxAmount: '100' },
      expect.any(AbortSignal),
    )
    state.resetFilters()
    await flushPromises()
    expect(state.mode.value).toBe('monthly')
    expect(state.period.value).toBe('2025')
    expect(state.hasFilters.value).toBe(false)
    expect(apiMock.getMonthlySummary).toHaveBeenLastCalledWith(
      { year: '2025' },
      expect.any(AbortSignal),
    )
    expect(state.result.value?.filterTotals).toEqual({ expense: '100.00', income: '200.00' })
  })
})
