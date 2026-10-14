/**
 * @author Brave
 * @date 2026-10-14T12:48:33+08:00
 * @description 流水统计接口契约，元金额与百分比保持后端两位小数字符串。
 */
import type { CategoryLevel, CategoryType } from './category.types'

export type StatisticsPeriodType = 'month' | 'year'
export type StatisticsOrder = 'asc' | 'desc'
export type StatisticsPanelKind = 'ranking' | 'proportion' | 'trend'
export interface StatisticsTypeQuery {
  type: CategoryType
}
export interface MonthlyStatisticsQuery extends StatisticsTypeQuery {
  month: string
}
export interface YearlyStatisticsQuery extends StatisticsTypeQuery {
  year: string
}
export interface MonthlyCategoryQuery extends MonthlyStatisticsQuery {
  categoryLevel: CategoryLevel
}
export interface YearlyCategoryQuery extends YearlyStatisticsQuery {
  categoryLevel: CategoryLevel
}
export interface MonthlyRankingQuery extends MonthlyCategoryQuery {
  order: StatisticsOrder
}
export interface YearlyRankingQuery extends YearlyCategoryQuery {
  order: StatisticsOrder
}
export interface CategoryStatisticsItem {
  categoryId: number
  name: string
  iconKey: string
  backgroundColor: string
  parent: { categoryId: number; name: string } | null
  amount: string
  /**
   * 百分比值，例如 12.50 表示 12.50%，用于文案及排行进度条。
   */
  percentage: string
}
export interface CategoryStatisticsResult {
  period: string
  periodType: StatisticsPeriodType
  type: CategoryType
  categoryLevel: CategoryLevel
  transactionCount: number
  totalAmount: string
  items: CategoryStatisticsItem[]
}
export interface CategoryRankingResult extends CategoryStatisticsResult {
  order: StatisticsOrder
}
export interface TransactionTrendResult {
  period: string
  periodType: StatisticsPeriodType
  type: CategoryType
  transactionCount: number
  totalAmount: string
  previousPeriod: string
  previousTotalAmount: string
  changeRate: string | null
  changeStatus: 'increase' | 'decrease' | 'unchanged' | 'new'
  series: { date: string; amount: string }[]
}
export type StatisticsResult =
  CategoryStatisticsResult | CategoryRankingResult | TransactionTrendResult
