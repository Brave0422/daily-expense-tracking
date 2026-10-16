/**
 * @author Brave
 * @date 2026-10-14T12:48:33+08:00
 * @description 六个流水统计 GET 请求，复用登录会话、取消信号与统一响应解包。
 */
import { apiClient } from './http'
import type { ApiResponse } from './common.types'
import type {
  CategoryRankingResult,
  CategoryStatisticsResult,
  TransactionTrendResult,
  MonthlyRankingQuery,
  YearlyRankingQuery,
  MonthlyCategoryQuery,
  YearlyCategoryQuery,
  MonthlyStatisticsQuery,
  YearlyStatisticsQuery,
} from './statistics.types'

/**
 * GET /api/statistics/category-ranking/monthly，按月查询完整分类排行。
 * @param query 月份、类型、层级和排序，不提交 userId
 * @param signal 本板块的取消信号
 * @returns 异步返回月排行，金额保持元字符串
 */
export async function getMonthlyCategoryRanking(
  query: MonthlyRankingQuery,
  signal?: AbortSignal,
): Promise<CategoryRankingResult> {
  const response = await apiClient.get<ApiResponse<CategoryRankingResult>>(
    '/statistics/category-ranking/monthly',
    { params: query, signal },
  )
  return response.data.data
}
/**
 * GET /api/statistics/category-ranking/yearly，按年查询完整分类排行。
 * @param query 年份、类型、层级和排序，不含 month
 * @param signal 本板块的取消信号
 * @returns 异步返回全年排行
 */
export async function getYearlyCategoryRanking(
  query: YearlyRankingQuery,
  signal?: AbortSignal,
): Promise<CategoryRankingResult> {
  const response = await apiClient.get<ApiResponse<CategoryRankingResult>>(
    '/statistics/category-ranking/yearly',
    { params: query, signal },
  )
  return response.data.data
}
/**
 * GET /api/statistics/category-proportion/monthly，按月查询全部分类占比。
 * @param query 月份、类型和层级，不含排序
 * @param signal 本板块的取消信号
 * @returns 异步返回按后端顺序排列的分类占比
 */
export async function getMonthlyCategoryProportion(
  query: MonthlyCategoryQuery,
  signal?: AbortSignal,
): Promise<CategoryStatisticsResult> {
  const response = await apiClient.get<ApiResponse<CategoryStatisticsResult>>(
    '/statistics/category-proportion/monthly',
    { params: query, signal },
  )
  return response.data.data
}
/**
 * GET /api/statistics/category-proportion/yearly，按年查询全部分类占比。
 * @param query 年份、类型和层级，不含月份或排序
 * @param signal 本板块的取消信号
 * @returns 异步返回全年分类占比
 */
export async function getYearlyCategoryProportion(
  query: YearlyCategoryQuery,
  signal?: AbortSignal,
): Promise<CategoryStatisticsResult> {
  const response = await apiClient.get<ApiResponse<CategoryStatisticsResult>>(
    '/statistics/category-proportion/yearly',
    { params: query, signal },
  )
  return response.data.data
}
/**
 * GET /api/statistics/transaction-trend/monthly，查询完整每日轴及上月比较。
 * @param query 月份及类型，不含层级和排序
 * @param signal 本板块的取消信号
 * @returns 异步返回完整自然月趋势
 */
export async function getMonthlyTransactionTrend(
  query: MonthlyStatisticsQuery,
  signal?: AbortSignal,
): Promise<TransactionTrendResult> {
  const response = await apiClient.get<ApiResponse<TransactionTrendResult>>(
    '/statistics/transaction-trend/monthly',
    { params: query, signal },
  )
  return response.data.data
}
/**
 * GET /api/statistics/transaction-trend/yearly，查询十二个月及上年比较。
 * @param query 年份及类型，不含月份、层级和排序
 * @param signal 本板块的取消信号
 * @returns 异步返回完整自然年趋势
 */
export async function getYearlyTransactionTrend(
  query: YearlyStatisticsQuery,
  signal?: AbortSignal,
): Promise<TransactionTrendResult> {
  const response = await apiClient.get<ApiResponse<TransactionTrendResult>>(
    '/statistics/transaction-trend/yearly',
    { params: query, signal },
  )
  return response.data.data
}
