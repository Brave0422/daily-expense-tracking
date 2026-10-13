/**
 * @author Brave
 * @date 2026-10-10T20:51:49+08:00
 * @description 流水创建、编辑与查询接口，负责请求发送、查询参数序列化和响应解包。
 */

import type { ApiResponse } from './common.types'
import { apiClient } from './http'
import type {
  CreateTransactionBody,
  DailyTransactionsQuery,
  DailyTransactionsResult,
  MonthlySummaryQuery,
  MonthlySummaryResult,
  UpdateTransactionBody,
} from './transaction.types'

/**
 * POST /transactions：创建流水及已有标签关联，成功后调用方刷新账单。
 * @param body - 符合 CreateTransactionBody 的创建请求，金额和日期使用字符串
 * @returns 创建完成后无返回数据；失败时抛出接口错误
 */
export async function createTransaction(body: CreateTransactionBody): Promise<void> {
  await apiClient.post<ApiResponse<void>>('/transactions', body)
}

/**
 * PATCH /transactions/:id：完整更新可编辑字段及标签关联，成功后调用方刷新账单。
 * @param transactionId - 当前用户需要编辑的流水id
 * @param body - 符合 UpdateTransactionBody 的完整请求，不包含流水类型
 * @returns 编辑完成后无返回数据；失败时抛出接口错误
 */
export async function updateTransaction(
  transactionId: number,
  body: UpdateTransactionBody,
): Promise<void> {
  await apiClient.patch<ApiResponse<void>>(`/transactions/${transactionId}`, body)
}

/**
 * GET /transactions/daily：查询完整月总览、筛选合计与日明细。
 * @param query - 月份及已启用的筛选参数，金额单位为元
 * @param signal - 取消被更新条件替代的查询
 * @returns 后端按日期及录入顺序排列的结果，不在前端重排或重新求和
 */
export async function getDailyTransactions(
  query: DailyTransactionsQuery,
  signal?: AbortSignal,
): Promise<DailyTransactionsResult> {
  const response = await apiClient.get<ApiResponse<DailyTransactionsResult>>(
    '/transactions/daily',
    {
      params: query,
      // Nest 查询转换器接收重复的 categoryIds/tagIds 参数，不接收带方括号的键名。
      paramsSerializer: { indexes: null },
      signal,
    },
  )
  return response.data.data
}

/**
 * GET /transactions/monthly-summary：查询完整年总览、筛选合计与月分类汇总。
 * @param query - 年份及类型、分类、金额条件，不包含日明细专用筛选
 * @param signal - 取消被更新条件或展示模式替代的查询
 * @returns 后端按月份及分类顺序排列的结果，金额不在前端重新求和
 */
export async function getMonthlySummary(
  query: MonthlySummaryQuery,
  signal?: AbortSignal,
): Promise<MonthlySummaryResult> {
  const response = await apiClient.get<ApiResponse<MonthlySummaryResult>>(
    '/transactions/monthly-summary',
    {
      params: query,
      paramsSerializer: { indexes: null },
      signal,
    },
  )
  return response.data.data
}
