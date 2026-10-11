/**
 * @author Brave
 * @date 2026-10-10 19:18:24
 * @description 流水相关数据的类型接口
 */

import { TransactionType } from '../enums/transaction-type-enum';

// 分类
export interface CategoryResponseItem {
  id: number;
  name: string;
  iconKey: string;
  backgroundColor: string;
  archived: boolean;
}

// 标签
export interface TagResponseItem {
  id: number;
  name: string;
  archived: boolean;
}

// 单条流水详情
export interface DailyTransactionItem {
  id: number;
  type: TransactionType;
  amount: string;
  title: string | null;
  remark: string | null;
  occurredDate: string;
  category: {
    primary: CategoryResponseItem;
    secondary: CategoryResponseItem | null;
  };
  tags: TagResponseItem[];
}

// 日的流水汇总
export interface DailyTransactionGroup extends TransactionGroupTotals {
  date: string;
  transactions: DailyTransactionItem[];
}

// 整个周期的收支汇总
export interface TransactionPeriodSummary {
  period: string;
  totals: {
    expense: string;
    income: string;
    balance: string;
  };
  filterTotals: {
    expense: string;
    income: string;
  };
}

// 分组的收支汇总
export interface TransactionGroupTotals {
  expenseTotal: string;
  incomeTotal: string;
}

// 按月周期查询流水详情的结构
export interface DailyTransactionsResult extends TransactionPeriodSummary {
  days: DailyTransactionGroup[];
}

// 按年周期查询月分类汇总
export interface MonthlySummaryResult extends TransactionPeriodSummary {
  months: MonthlySummaryGroup[];
}

// 月流水汇总
export interface MonthlySummaryGroup extends TransactionGroupTotals {
  month: number;
  expenseCategories: ExpenseCategorySummary[];
  incomeCategories: CategorySummaryItem[];
}

// 单个分类下的金额汇总
export interface CategorySummaryItem extends CategoryResponseItem {
  amount: string;
}

// 月流水的分类详情
export interface ExpenseCategorySummary extends CategorySummaryItem {
  children: CategorySummaryItem[];
}
