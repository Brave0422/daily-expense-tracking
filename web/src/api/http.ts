/**
 * @author Brave
 * @date 2026-09-20T15:23:51+08:00
 * @description Axios 实例与鉴权刷新协调，负责开发代理接入、Bearer 注入、单例刷新和错误归一化。
 */

import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'

import type { AccessTokenData } from './auth.types'
import type { ApiErrorResponse, ApiResponse } from './common.types'

declare module 'axios' {
  interface AxiosRequestConfig {
    skipAuthRefresh?: boolean
  }
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'
const REFRESH_EXCLUDED_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/resetPassword',
]

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  hasRetriedAfterRefresh?: boolean
}

interface AuthSessionBridge {
  /** 读取当前内存中的 Access Token。 */
  getAccessToken: () => string | null
  /** 写入刷新或登录获得的 Access Token。 */
  setAccessToken: (accessToken: string) => void
  /** 清除当前页面会话，不处理服务端状态。 */
  clearSession: () => void
  /** 会话彻底失效后的页面跳转回调。 */
  handleExpiredSession: () => Promise<void> | void
}

let authSessionBridge: AuthSessionBridge | null = null
let refreshPromise: Promise<string> | null = null

/** 包含 HTTP 状态和验证码冷却时间的页面请求错误。 */
export class ApiRequestError extends Error {
  /** HTTP 状态码；网络错误时不存在。 */
  readonly statusCode?: number
  /** 服务端要求等待的验证码重发秒数。 */
  readonly retryAfterSeconds?: number

  /**
   * 创建统一请求错误。
   * @param message - 可向用户展示的错误信息
   * @param statusCode - HTTP 状态码
   * @param retryAfterSeconds - 验证码重发等待时间，单位：秒
   */
  constructor(message: string, statusCode?: number, retryAfterSeconds?: number) {
    super(message)
    this.name = 'ApiRequestError'
    this.statusCode = statusCode
    this.retryAfterSeconds = retryAfterSeconds
  }
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
  withCredentials: true,
})

const refreshClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
  withCredentials: true,
})

/**
 * 注入前端会话读写能力，避免 HTTP 层直接依赖 Pinia 与路由。
 * @param bridge - Access Token 和会话失效处理桥接
 */
export function configureAuthSessionBridge(bridge: AuthSessionBridge): void {
  authSessionBridge = bridge
}

/**
 * 将未知请求异常转换为页面可安全展示的错误。
 * @param error - Axios 或其他未知异常
 * @param fallbackMessage - 无后端消息时使用的兜底文案
 * @returns 统一 API 错误
 */
export function normalizeApiError(
  error: unknown,
  fallbackMessage = '请求失败，请稍后重试',
): ApiRequestError {
  if (error instanceof ApiRequestError) {
    return error
  }

  if (!axios.isAxiosError<ApiErrorResponse>(error)) {
    return new ApiRequestError(error instanceof Error ? error.message : fallbackMessage)
  }

  const responseData = error.response?.data
  const rawMessage = responseData?.message
  const message = Array.isArray(rawMessage)
    ? rawMessage.join('；')
    : (rawMessage ?? responseData?.error ?? fallbackMessage)

  return new ApiRequestError(
    message,
    error.response?.status ?? responseData?.statusCode,
    responseData?.retryAfterSeconds,
  )
}

/**
 * 判断失败请求是否属于禁止自动刷新的鉴权入口。
 * @param config - 发生 401 的原请求配置
 * @returns true 表示直接返回原错误，避免刷新循环或访客请求误刷新
 */
function isRefreshExcluded(config: InternalAxiosRequestConfig): boolean {
  return (
    config.skipAuthRefresh === true ||
    REFRESH_EXCLUDED_PATHS.some((path) => config.url?.includes(path))
  )
}

/**
 * 使用独立客户端和 HttpOnly Cookie 请求新的 Access Token。
 * @returns 新的 Access Token，同时同步到前端内存会话
 * @throws 刷新响应缺少 Token 时抛出 ApiRequestError
 */
async function requestNewAccessToken(): Promise<string> {
  const response = await refreshClient.post<ApiResponse<AccessTokenData>>('/auth/refresh')
  const accessToken = response.data.data.accessToken

  if (!accessToken) {
    throw new ApiRequestError('刷新登录状态失败，请重新登录')
  }

  authSessionBridge?.setAccessToken(accessToken)
  return accessToken
}

/**
 * 获取当前刷新任务；并发 401 共享同一个 Promise，避免 Refresh Token 轮换冲突。
 * @returns 当前或新建的 Access Token 刷新任务
 */
function getRefreshPromise(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = requestNewAccessToken()
      .catch(async (error: unknown) => {
        authSessionBridge?.clearSession()
        await authSessionBridge?.handleExpiredSession()
        throw normalizeApiError(error, '登录状态已失效，请重新登录')
      })
      .finally(() => {
        refreshPromise = null
      })
  }

  return refreshPromise
}

// 请求阶段只读取内存 Token，禁止把凭据写入浏览器持久化存储。
apiClient.interceptors.request.use((config) => {
  const accessToken = authSessionBridge?.getAccessToken()
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

// 响应阶段统一处理一次性重放；刷新失败后由桥接回调清理状态并跳转登录页。
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorResponse>) => {
    const config = error.config as RetryableRequestConfig | undefined
    const shouldRefresh =
      error.response?.status === 401 &&
      config !== undefined &&
      !config.hasRetriedAfterRefresh &&
      !isRefreshExcluded(config)

    if (!shouldRefresh || !config) {
      return Promise.reject(normalizeApiError(error))
    }

    config.hasRetriedAfterRefresh = true
    const accessToken = await getRefreshPromise()
    config.headers.Authorization = `Bearer ${accessToken}`
    return apiClient(config)
  },
)
