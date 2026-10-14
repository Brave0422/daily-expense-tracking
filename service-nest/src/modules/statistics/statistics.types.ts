/**
 * @author Brave
 * @date 2026-10-14T12:40:05+08:00
 * @description 流水统计查询与响应类型，金额为人民币元、百分比为两位小数字符串。
 */
import { TransactionType } from '../transactions/enums/transaction-type-enum';

export type StatisticsPeriodType = 'month' | 'year';
export type CategoryLevel = 1 | 2;
export type StatisticsOrder = 'asc' | 'desc';
export interface CategoryStatisticsItem {
  categoryId: number;
  name: string;
  iconKey: string;
  backgroundColor: string;
  parent: { categoryId: number; name: string } | null;
  amount: string;
  percentage: string;
}
export interface CategoryStatisticsResult {
  period: string;
  periodType: StatisticsPeriodType;
  type: TransactionType;
  categoryLevel: CategoryLevel;
  transactionCount: number;
  totalAmount: string;
  items: CategoryStatisticsItem[];
}
export interface CategoryRankingResult extends CategoryStatisticsResult {
  order: StatisticsOrder;
}
export interface TransactionTrendResult {
  period: string;
  periodType: StatisticsPeriodType;
  type: TransactionType;
  transactionCount: number;
  totalAmount: string;
  previousPeriod: string;
  previousTotalAmount: string;
  changeRate: string | null;
  changeStatus: 'increase' | 'decrease' | 'unchanged' | 'new';
  series: { date: string; amount: string }[];
}
