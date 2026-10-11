/**
 * @author Brave
 * @date 2026-10-10T20:51:49+08:00
 * @description 日明细查询状态与筛选流程，处理防抖、精确金额校验、竞态和失败保留。
 */

import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { normalizeApiError } from '@/api/http'
import { getDailyTransactions } from '@/api/transaction.api'
import type {
  DailyTransactionsQuery,
  DailyTransactionsResult,
  TransactionFilters,
  TransactionTypeFilter,
} from '@/api/transaction.types'
import { exceedsMaximumAmount, isValidFilterAmount, isZeroAmount } from '@/utils/money'

/** 每次重置返回独立数组，保留当前查询月份。 */
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

/** 仅提交月查询支持的有效筛选，省略全部类型、空文本及空 ID 数组。 */
function createQuery(month: string, filters: TransactionFilters): DailyTransactionsQuery {
  const query: DailyTransactionsQuery = { month }
  if (filters.type !== 'all') query.type = filters.type
  if (filters.categoryIds.length) query.categoryIds = [...filters.categoryIds]
  if (filters.tagIds.length) query.tagIds = [...filters.tagIds]
  if (filters.title.trim()) query.title = filters.title.trim()
  if (filters.remark.trim()) query.remark = filters.remark.trim()
  if (filters.minAmount.trim()) query.minAmount = filters.minAmount.trim()
  if (filters.maxAmount.trim()) query.maxAmount = filters.maxAmount.trim()
  return query
}

/**
 * 管理一个页面实例的月周期流水查询。
 * @returns 月份、筛选、最后成功结果及查询操作；旧响应无法覆盖新条件
 */
export function useDailyTransactions() {
  const today = new Date()
  const month = ref(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`)
  const filters = ref<TransactionFilters>(createDefaultFilters())
  const result = ref<DailyTransactionsResult | null>(null)
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
  const queryKey = computed(() => JSON.stringify(createQuery(month.value, filters.value)))
  const isResultStale = computed(
    () => result.value !== null && queryKey.value !== successfulQueryKey.value,
  )
  const isRefreshing = computed(() => isLoading.value || isDebouncing.value)
  const hasCurrentPeriod = computed(() => result.value?.period === month.value)
  const hasPeriodTransactions = computed(
    () =>
      result.value !== null &&
      (!isZeroAmount(result.value.totals.expense) || !isZeroAmount(result.value.totals.income)),
  )
  const hasFilters = computed(() => {
    const { month: queryMonth, ...optionalFilters } = createQuery(month.value, filters.value)
    return Boolean(queryMonth) && Object.keys(optionalFilters).length > 0
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
    const query = createQuery(month.value, filters.value)
    const currentController = new AbortController()
    controller = currentController
    isLoading.value = true
    try {
      const data = await getDailyTransactions(query, currentController.signal)
      if (sequence !== requestSequence) return
      result.value = data
      resultType.value = query.type ?? 'all'
      successfulQueryKey.value = JSON.stringify(query)
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
    const shouldQueryImmediately =
      previous.type !== nextFilters.type ||
      previous.categoryIds.join(',') !== nextFilters.categoryIds.join(',') ||
      previous.tagIds.join(',') !== nextFilters.tagIds.join(',')
    filters.value = nextFilters
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

  /** 月份切换保留有效筛选，立即查询并中止旧月份请求。 */
  function updateMonth(value: string): void {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value) || value === month.value) return
    month.value = value
    void refresh()
  }

  /** 清空全部筛选，使用当前月份重新获取完整日明细。 */
  function resetFilters(): void {
    filters.value = createDefaultFilters()
    void refresh()
  }

  onMounted(refresh)
  onBeforeUnmount(invalidateRequest)

  return {
    month,
    filters,
    result,
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
    updateMonth,
    resetFilters,
  }
}
