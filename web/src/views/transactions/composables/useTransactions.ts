/**
 * @author Brave
 * @date 2026-10-10T20:51:49+08:00
 * @description 日明细与月汇总查询流程，处理模式周期切换、防抖、精确金额校验和请求竞态。
 */

import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { normalizeApiError } from '@/api/http'
import { getDailyTransactions, getMonthlySummary } from '@/api/transaction.api'
import type {
  DailyTransactionsQuery,
  DailyTransactionsResult,
  MonthlySummaryQuery,
  MonthlySummaryResult,
  TransactionDisplayMode,
  TransactionFilters,
  TransactionQueryFilters,
  TransactionTypeFilter,
} from '@/api/transaction.types'
import { exceedsMaximumAmount, isValidFilterAmount, isZeroAmount } from '@/utils/money'

type TransactionRequest =
  { mode: 'daily'; query: DailyTransactionsQuery } | { mode: 'monthly'; query: MonthlySummaryQuery }

/** 每次重置返回独立数组，保留当前模式和周期。 */
function createDefaultFilters(): TransactionFilters {
  return {
    type: 'all',
    categoryIds: [],
    title: '',
    tagIds: [],
    remark: '',
    minAmount: '',
    maxAmount: '',
  }
}

/** 显式组装公共条件，年请求不能携带标题、标签、备注，即使它们为空。 */
function createRequest(
  mode: TransactionDisplayMode,
  period: string,
  filters: TransactionFilters,
): TransactionRequest {
  const query: TransactionQueryFilters = {}
  if (filters.type !== 'all') query.type = filters.type
  if (filters.categoryIds.length) query.categoryIds = [...filters.categoryIds]
  if (filters.minAmount.trim()) query.minAmount = filters.minAmount.trim()
  if (filters.maxAmount.trim()) query.maxAmount = filters.maxAmount.trim()
  if (mode === 'monthly') return { mode, query: { year: period, ...query } }

  const dailyQuery: DailyTransactionsQuery = { month: period, ...query }
  if (filters.tagIds.length) dailyQuery.tagIds = [...filters.tagIds]
  if (filters.title.trim()) dailyQuery.title = filters.title.trim()
  if (filters.remark.trim()) dailyQuery.remark = filters.remark.trim()
  return { mode, query: dailyQuery }
}

/**
 * 管理一个页面实例的日明细与月汇总查询。
 * @returns 模式、周期、筛选、最后成功结果及查询操作；旧响应无法覆盖新条件
 */
export function useTransactions() {
  const today = new Date()
  const mode = ref<TransactionDisplayMode>('daily')
  const period = ref(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`)
  const filters = ref<TransactionFilters>(createDefaultFilters())
  const result = ref<DailyTransactionsResult | MonthlySummaryResult | null>(null)
  const resultType = ref<TransactionTypeFilter>('all')
  const isLoading = ref(false)
  const isDebouncing = ref(false)
  const errorMessage = ref('')
  const successfulQueryKey = ref('')
  let requestSequence = 0
  let controller: AbortController | null = null
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  const amountError = computed(() => {
    const min = filters.value.minAmount.trim()
    const max = filters.value.maxAmount.trim()
    if (!isValidFilterAmount(min) || !isValidFilterAmount(max)) {
      return '金额必须为非负数，最多13位整数和2位小数'
    }
    return min && max && exceedsMaximumAmount(min, max) ? '最小金额不能大于最大金额' : ''
  })
  const request = computed(() => createRequest(mode.value, period.value, filters.value))
  const queryKey = computed(() => JSON.stringify(request.value))
  // 保留成功响应的结构，跨模式刷新或失败时仍能正确展示旧列表。
  const dailyResult = computed(() => (result.value && 'days' in result.value ? result.value : null))
  const monthlyResult = computed(() =>
    result.value && 'months' in result.value ? result.value : null,
  )
  const isResultStale = computed(
    () => result.value !== null && queryKey.value !== successfulQueryKey.value,
  )
  const isRefreshing = computed(() => isLoading.value || isDebouncing.value)
  const hasCurrentPeriod = computed(
    () =>
      result.value?.period === period.value &&
      (mode.value === 'daily' ? dailyResult.value !== null : monthlyResult.value !== null),
  )
  const hasPeriodTransactions = computed(
    () =>
      result.value !== null &&
      (!isZeroAmount(result.value.totals.expense) || !isZeroAmount(result.value.totals.income)),
  )
  const hasFilters = computed(() => {
    return Object.keys(request.value.query).length > 1
  })

  /** 条件一改变就作废旧请求，包括防抖等待中和校验失败时。 */
  function invalidateRequest(): void {
    requestSequence += 1
    controller?.abort()
    controller = null
    isLoading.value = false
    if (debounceTimer !== null) clearTimeout(debounceTimer)
    debounceTimer = null
    isDebouncing.value = false
  }

  /** 使用当前条件查询；失败保留最后成功的列表和两种合计。 */
  async function refresh(): Promise<void> {
    invalidateRequest()
    errorMessage.value = ''
    if (amountError.value) return

    const sequence = requestSequence
    const currentRequest = request.value
    const currentController = new AbortController()
    controller = currentController
    isLoading.value = true
    try {
      const data =
        currentRequest.mode === 'daily'
          ? await getDailyTransactions(currentRequest.query, currentController.signal)
          : await getMonthlySummary(currentRequest.query, currentController.signal)
      if (sequence !== requestSequence) return
      result.value = data
      resultType.value = currentRequest.query.type ?? 'all'
      successfulQueryKey.value = JSON.stringify(currentRequest)
    } catch (error) {
      if (sequence !== requestSequence || currentController.signal.aborted) return
      errorMessage.value = normalizeApiError(error, '账单加载失败，请重试').message
    } finally {
      if (sequence === requestSequence) {
        isLoading.value = false
        controller = null
      }
    }
  }

  /** 文本和金额延迟 300ms；类型、分类、标签立即查询并取消待执行防抖。 */
  function updateFilters(nextFilters: TransactionFilters): void {
    const previous = filters.value
    const enabledFilters =
      mode.value === 'monthly' ? { ...nextFilters, title: '', tagIds: [], remark: '' } : nextFilters
    const nextQueryKey = JSON.stringify(createRequest(mode.value, period.value, enabledFilters))
    const shouldQueryImmediately =
      previous.type !== enabledFilters.type ||
      previous.categoryIds.join(',') !== enabledFilters.categoryIds.join(',') ||
      previous.tagIds.join(',') !== enabledFilters.tagIds.join(',')
    const hasQueryChanged = nextQueryKey !== queryKey.value
    filters.value = enabledFilters
    if (!hasQueryChanged) return
    invalidateRequest()
    errorMessage.value = ''
    if (amountError.value) return
    if (shouldQueryImmediately) {
      void refresh()
      return
    }
    isDebouncing.value = true
    debounceTimer = setTimeout(() => {
      void refresh()
    }, 300)
  }

  /** 月份或年份切换保留有效筛选，立即查询并中止旧周期请求。 */
  function updatePeriod(value: string): void {
    const pattern = mode.value === 'daily' ? /^\d{4}-(0[1-9]|1[0-2])$/ : /^\d{4}$/
    if (!pattern.test(value) || value === period.value) return
    period.value = value
    void refresh()
  }

  /** 模式切换先取消待执行查询，清除日明细专用条件，再按产品规则转换周期。 */
  function toggleMode(): void {
    invalidateRequest()
    if (mode.value === 'daily') {
      period.value = period.value.slice(0, 4)
      filters.value = { ...filters.value, title: '', tagIds: [], remark: '' }
      mode.value = 'monthly'
    } else {
      const now = new Date()
      const monthNumber = period.value === String(now.getFullYear()) ? now.getMonth() + 1 : 12
      period.value = `${period.value}-${String(monthNumber).padStart(2, '0')}`
      mode.value = 'daily'
    }
    void refresh()
  }

  /** 清空全部筛选，按当前模式与周期重新查询。 */
  function resetFilters(): void {
    filters.value = createDefaultFilters()
    void refresh()
  }

  onMounted(refresh)
  onBeforeUnmount(invalidateRequest)

  return {
    mode,
    period,
    filters,
    result,
    dailyResult,
    monthlyResult,
    resultType,
    isLoading,
    isRefreshing,
    errorMessage,
    amountError,
    hasCurrentPeriod,
    hasPeriodTransactions,
    hasFilters,
    isResultStale,
    refresh,
    updateFilters,
    updatePeriod,
    toggleMode,
    resetFilters,
  }
}
