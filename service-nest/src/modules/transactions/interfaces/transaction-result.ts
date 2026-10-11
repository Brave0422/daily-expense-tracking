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

export interface DailyTransactionGroup {
  date: string;
  expenseTotal: string;
  incomeTotal: string;
  transactions: DailyTransactionItem[];
}

// 按月周期查询流水详情的结构
export interface DailyTransactionsResult {
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
  days: DailyTransactionGroup[];
}
