/**
 * @author Brave
 * @date 2026-10-10T20:51:49+08:00
 * @description 月周期流水查询契约，金额使用十进制字符串，业务日期不含时间。
 */

import type { CategoryType } from './category.types'

export type TransactionTypeFilter = 'all' | CategoryType

export interface DailyTransactionsQuery {
  /** 查询一个自然月，格式为 YYYY-MM。 */
  month: string
  type?: CategoryType
  /** 用户分类 ID；支出一级分类表示其全部二级分类。 */
  categoryIds?: number[]
  /** 多个标签按任一匹配筛选。 */
  tagIds?: number[]
  title?: string
  remark?: string
  /** 非负金额，最多 13 位整数和 2 位小数，单位：元。 */
  minAmount?: string
  maxAmount?: string
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

export interface DailyTransactionGroup {
  date: string
  expenseTotal: string
  incomeTotal: string
  transactions: DailyTransactionItem[]
}

export interface DailyTransactionsResult {
  period: string
  totals: TransactionTotals
  filterTotals: TransactionFilterTotals
  days: DailyTransactionGroup[]
}
