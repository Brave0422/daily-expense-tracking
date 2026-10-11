/**
 * @author Brave
 * @date 2026-10-10T20:51:49+08:00
 * @description 日明细与月汇总查询契约，共用周期及分组合计，金额使用十进制字符串。
 */

import type { CategoryType } from './category.types'

export type TransactionTypeFilter = 'all' | CategoryType
export type TransactionDisplayMode = 'daily' | 'monthly'

export interface TransactionQueryFilters {
  type?: CategoryType
  /** 用户分类 ID；支出一级分类表示其全部二级分类。 */
  categoryIds?: number[]
  /** 非负金额，最多 13 位整数和 2 位小数，单位：元。 */
  minAmount?: string
  maxAmount?: string
}

export interface DailyTransactionsQuery extends TransactionQueryFilters {
  /** 查询一个自然月，格式为 YYYY-MM。 */
  month: string
  /** 多个标签按任一匹配筛选。 */
  tagIds?: number[]
  title?: string
  remark?: string
}

export interface MonthlySummaryQuery extends TransactionQueryFilters {
  /** 查询一个自然年，格式为 YYYY；不接受标题、标签和备注字段。 */
  year: string
}

export interface TransactionFilters {
  type: TransactionTypeFilter
  categoryIds: number[]
  title: string
  tagIds: number[]
  remark: string
  minAmount: string
  maxAmount: string
}

export interface TransactionCategory {
  id: number
  name: string
  iconKey: string
  backgroundColor: string
  archived: boolean
}

export interface TransactionTag {
  id: number
  name: string
  archived: boolean
}

export interface DailyTransactionItem {
  id: number
  type: CategoryType
  amount: string
  title: string | null
  remark: string | null
  occurredDate: string
  category: {
    primary: TransactionCategory
    secondary: TransactionCategory | null
  }
  tags: TransactionTag[]
}

export interface TransactionFilterTotals {
  expense: string
  income: string
}

export interface TransactionTotals extends TransactionFilterTotals {
  /** 后端精确计算的收入减支出。 */
  balance: string
}

export interface TransactionGroupTotals {
  /** 当前分组匹配筛选条件的收支，直接使用后端金额。 */
  expenseTotal: string
  incomeTotal: string
}

export interface DailyTransactionGroup extends TransactionGroupTotals {
  date: string
  transactions: DailyTransactionItem[]
}

export interface TransactionPeriodSummary {
  /** 日明细为 YYYY-MM，月汇总为 YYYY，空结果仍返回所查询周期。 */
  period: string
  totals: TransactionTotals
  filterTotals: TransactionFilterTotals
}

export interface DailyTransactionsResult extends TransactionPeriodSummary {
  days: DailyTransactionGroup[]
}

export interface CategorySummaryItem extends TransactionCategory {
  amount: string
}

export interface ExpenseCategorySummary extends CategorySummaryItem {
  children: CategorySummaryItem[]
}

export interface MonthlySummaryGroup extends TransactionGroupTotals {
  /** 1 至 12，与外层 period 的年份共同确定月份。 */
  month: number
  expenseCategories: ExpenseCategorySummary[]
  incomeCategories: CategorySummaryItem[]
}

export interface MonthlySummaryResult extends TransactionPeriodSummary {
  months: MonthlySummaryGroup[]
}
