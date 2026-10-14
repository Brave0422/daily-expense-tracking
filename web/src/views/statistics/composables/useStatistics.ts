/**
 * @author Brave
 * @date 2026-10-14T12:48:33+08:00
 * @description 每个统计板块独立的条件、月份记忆、查询序号、取消和旧结果状态。
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import * as statisticsApi from '@/api/statistics.api'
import { normalizeApiError } from '@/api/http'
import type { CategoryLevel, CategoryType } from '@/api/category.types'
import type {
  StatisticsPanelKind,
  StatisticsPeriodType,
  StatisticsOrder,
  StatisticsResult,
} from '@/api/statistics.types'
import { isValidStatisticsPeriod } from '../statistics-view.util'

/**
 * 创建本页面实例独立的板块查询状态；失败保留上次成功响应并注明条件。
 * @param kind 排行、占比或趋势，各自仅调用需要的接口和参数
 * @returns 响应式条件、已成功结果、加载和错误状态及更新事件
 */
export function useStatistics(kind: StatisticsPanelKind) {
  const now = new Date()
  const currentYear = String(now.getFullYear())
  const currentMonth = `${currentYear}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const type = ref<CategoryType>('expense')
  const categoryLevel = ref<CategoryLevel>(2)
  const periodType = ref<StatisticsPeriodType>('month')
  const period = ref(currentMonth)
  const order = ref<StatisticsOrder>('desc')
  const result = ref<StatisticsResult | null>(null)
  const isLoading = ref(false)
  const errorMessage = ref('')
  const monthByYear = new Map([[currentYear, currentMonth]])
  let lastExpenseLevel: CategoryLevel = 2
  let requestSequence = 0
  let controller: AbortController | null = null
  let isActive = true
  const categoryResult = computed(() =>
    result.value && 'items' in result.value ? result.value : null,
  )
  const trendResult = computed(() =>
    result.value && 'series' in result.value ? result.value : null,
  )

  /**
   * 快照当前条件并发送单个合法查询，较旧成功、异常和 finally 均不能覆盖新请求。
   * @returns 异步刷新结束，失败写入本板块错误状态并保留旧结果
   */
  async function refresh(): Promise<void> {
    if (!isActive) return
    controller?.abort()
    controller = new AbortController()
    const sequence = ++requestSequence
    const signal = controller.signal
    isLoading.value = true
    errorMessage.value = ''
    try {
      let data: StatisticsResult
      if (periodType.value === 'month') {
        const query = { month: period.value, type: type.value }
        data =
          kind === 'ranking'
            ? await statisticsApi.getMonthlyCategoryRanking(
                { ...query, categoryLevel: categoryLevel.value, order: order.value },
                signal,
              )
            : kind === 'proportion'
              ? await statisticsApi.getMonthlyCategoryProportion(
                  { ...query, categoryLevel: categoryLevel.value },
                  signal,
                )
              : await statisticsApi.getMonthlyTransactionTrend(query, signal)
      } else {
        const query = { year: period.value, type: type.value }
        data =
          kind === 'ranking'
            ? await statisticsApi.getYearlyCategoryRanking(
                { ...query, categoryLevel: categoryLevel.value, order: order.value },
                signal,
              )
            : kind === 'proportion'
              ? await statisticsApi.getYearlyCategoryProportion(
                  { ...query, categoryLevel: categoryLevel.value },
                  signal,
                )
              : await statisticsApi.getYearlyTransactionTrend(query, signal)
      }
      if (isActive && sequence === requestSequence) result.value = data
    } catch (error) {
      // 主动取消的 Axios 错误也可能被 HTTP 层转换；以本请求 signal 判断是否应提示。
      if (isActive && sequence === requestSequence && !signal.aborted)
        errorMessage.value = normalizeApiError(error, '统计加载失败，请重新加载').message
    } finally {
      if (isActive && sequence === requestSequence) isLoading.value = false
    }
  }
  /**
   * 切换类型时原子更新收入一级约束，回到支出恢复该板块原层级。
   * @param nextType 收入或支出
   * @returns 无返回值，仅新类型触发一次查询
   */
  function updateType(nextType: CategoryType): void {
    if (nextType === type.value) return
    if (type.value === 'expense') lastExpenseLevel = categoryLevel.value
    type.value = nextType
    categoryLevel.value = nextType === 'income' ? 1 : lastExpenseLevel
    void refresh()
  }
  /**
   * 修改分类汇总粒度，收入二级及重复点击不产生查询。
   * @param level 一级或二级
   * @returns 无返回值
   */
  function updateCategoryLevel(level: CategoryLevel): void {
    if (
      kind === 'trend' ||
      level === categoryLevel.value ||
      (type.value === 'income' && level === 2)
    )
      return
    categoryLevel.value = level
    lastExpenseLevel = level
    void refresh()
  }
  /**
   * 切换自然月或年，保留年份并按年份记忆月值。
   * @param nextPeriodType 月或年
   * @returns 无返回值，联动完成后只查询一次
   */
  function updatePeriodType(nextPeriodType: StatisticsPeriodType): void {
    if (nextPeriodType === periodType.value) return
    const year = period.value.slice(0, 4)
    if (periodType.value === 'month') monthByYear.set(year, period.value)
    const nextPeriod =
      nextPeriodType === 'year'
        ? year
        : (monthByYear.get(year) ??
          `${year}-${year === currentYear ? currentMonth.slice(5) : '12'}`)
    if (!isValidStatisticsPeriod(nextPeriod, nextPeriodType)) return
    periodType.value = nextPeriodType
    period.value = nextPeriod
    void refresh()
  }
  /**
   * 确认合法周期，记忆所选月份；相同选择和取消均不查询。
   * @param nextPeriod YYYY-MM 或 YYYY 选择值
   * @returns 无返回值
   */
  function updatePeriod(nextPeriod: string): void {
    if (nextPeriod === period.value || !isValidStatisticsPeriod(nextPeriod, periodType.value))
      return
    period.value = nextPeriod
    if (periodType.value === 'month') monthByYear.set(nextPeriod.slice(0, 4), nextPeriod)
    void refresh()
  }
  /**
   * @returns 无返回值，切换排行金额方向并保留所有其他条件
   */
  function toggleOrder(): void {
    if (kind !== 'ranking') return
    order.value = order.value === 'desc' ? 'asc' : 'desc'
    void refresh()
  }
  onMounted(refresh)
  onBeforeUnmount(() => {
    // 页面离开使所有已发出结果失效，同时尽力终止网络请求。
    isActive = false
    requestSequence += 1
    controller?.abort()
  })
  return {
    type,
    categoryLevel,
    periodType,
    period,
    order,
    result,
    categoryResult,
    trendResult,
    isLoading,
    errorMessage,
    refresh,
    updateType,
    updateCategoryLevel,
    updatePeriodType,
    updatePeriod,
    toggleOrder,
  }
}
