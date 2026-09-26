/**
 * @author Brave
 * @date 2026-09-20T15:45:17+08:00
 * @description HTTP 鉴权测试，覆盖 Bearer 注入、并发单例刷新、失败清理和登录排除规则。
 */

import axios, {
  AxiosError,
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const originalAdapter = axios.defaults.adapter
let adapterHandler: (config: InternalAxiosRequestConfig) => Promise<AxiosResponse>
const adapterMock = vi.fn<(config: InternalAxiosRequestConfig) => Promise<AxiosResponse>>(
  (config) => adapterHandler(config),
)
axios.defaults.adapter = adapterMock as AxiosAdapter

const { apiClient, configureAuthSessionBridge } = await import('@/api/http')

/**
 * 构造 Axios 适配器所需的标准响应对象。
 * @param config - 当前请求配置
 * @param data - 模拟响应数据
 * @param status - 模拟 HTTP 状态码
 * @returns 可由 Axios 拦截器继续处理的响应
 */
function createResponse<T>(
  config: InternalAxiosRequestConfig,
  data: T,
  status = 200,
): AxiosResponse<T> {
  return {
    config,
    data,
    headers: {},
    status,
    statusText: status === 200 ? 'OK' : 'Error',
  }
}

/**
 * 构造包含后端错误结构的 401 AxiosError。
 * @param config - 当前请求配置
 * @param message - 后端鉴权错误信息
 * @returns 始终拒绝的请求 Promise
 */
function rejectUnauthorized(
  config: InternalAxiosRequestConfig,
  message = '登录状态已失效',
): Promise<never> {
  const response = createResponse(config, { message, statusCode: 401 }, 401)
  return Promise.reject(new AxiosError(message, 'ERR_BAD_REQUEST', config, undefined, response))
}

describe('authenticated HTTP client', () => {
  beforeEach(() => {
    adapterMock.mockClear()
  })

  afterAll(() => {
    axios.defaults.adapter = originalAdapter
  })

  it('injects the in-memory access token as a Bearer header', async () => {
    let authorization = ''
    adapterHandler = async (config) => {
      authorization = config.headers.get('Authorization')?.toString() ?? ''
      return createResponse(config, { ok: true })
    }
    configureAuthSessionBridge({
      getAccessToken: () => 'access-token',
      setAccessToken: vi.fn<(token: string) => void>(),
      clearSession: vi.fn<() => void>(),
      handleExpiredSession: vi.fn<() => void>(),
    })

    await apiClient.get('/protected')

    expect(authorization).toBe('Bearer access-token')
  })

  it('shares one refresh request across concurrent 401 responses and replays each request once', async () => {
    let accessToken = 'expired-token'
    let refreshCount = 0
    let replayCount = 0
    adapterHandler = async (config) => {
      if (config.url === '/auth/refresh') {
        refreshCount += 1
        await new Promise((resolve) => setTimeout(resolve, 10))
        return createResponse(config, {
          data: { accessToken: 'renewed-token' },
          code: 200,
          msg: 'Token 刷新成功',
          success: true,
        })
      }

      if (config.headers.get('Authorization') === 'Bearer renewed-token') {
        replayCount += 1
        return createResponse(config, { ok: true })
      }

      return rejectUnauthorized(config)
    }
    configureAuthSessionBridge({
      getAccessToken: () => accessToken,
      setAccessToken: (token) => {
        accessToken = token
      },
      clearSession: vi.fn<() => void>(),
      handleExpiredSession: vi.fn<() => void>(),
    })

    await Promise.all([apiClient.get('/protected-a'), apiClient.get('/protected-b')])

    expect(refreshCount).toBe(1)
    expect(replayCount).toBe(2)
    expect(accessToken).toBe('renewed-token')
  })

  it('clears the session once when refresh fails', async () => {
    const clearSession = vi.fn<() => void>()
    const handleExpiredSession = vi.fn<() => void>()
    adapterHandler = (config) => rejectUnauthorized(config, 'Refresh Token 不存在，请重新登录')
    configureAuthSessionBridge({
      getAccessToken: () => 'expired-token',
      setAccessToken: vi.fn<(token: string) => void>(),
      clearSession,
      handleExpiredSession,
    })

    await expect(apiClient.get('/protected')).rejects.toThrow('Refresh Token 不存在，请重新登录')

    expect(clearSession).toHaveBeenCalledTimes(1)
    expect(handleExpiredSession).toHaveBeenCalledTimes(1)
  })

  it('does not refresh a rejected login request', async () => {
    let refreshCount = 0
    adapterHandler = (config) => {
      if (config.url === '/auth/refresh') {
        refreshCount += 1
      }
      return rejectUnauthorized(config, '用户名或密码错误')
    }
    configureAuthSessionBridge({
      getAccessToken: () => null,
      setAccessToken: vi.fn<(token: string) => void>(),
      clearSession: vi.fn<() => void>(),
      handleExpiredSession: vi.fn<() => void>(),
    })

    await expect(
      apiClient.post('/auth/login', { email: 'user@example.com', password: '123456' }),
    ).rejects.toThrow('用户名或密码错误')

    expect(refreshCount).toBe(0)
  })
})
