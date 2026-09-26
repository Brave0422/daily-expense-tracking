/**
 * @author Brave
 * @date 2026-09-20T15:23:51+08:00
 * @description 鉴权全局状态，仅在内存保存 Access Token 并管理会话恢复与退出。
 */

import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import {
  login as loginRequest,
  logout as logoutRequest,
  refreshSession,
  register as registerRequest,
} from '@/api/auth.api'
import type { LoginBody, RegisterBody } from '@/api/auth.types'
import { normalizeApiError } from '@/api/http'

type SessionRestoreStatus = 'pending' | 'authenticated' | 'anonymous' | 'expired'

export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref<string | null>(null)
  const isInitialized = ref(false)
  const sessionRestoreStatus = ref<SessionRestoreStatus>('pending')
  const isAuthenticated = computed(() => accessToken.value !== null)
  const hasExpiredSession = computed(() => sessionRestoreStatus.value === 'expired')
  let initializePromise: Promise<void> | null = null

  /**
   * 更新内存中的 Access Token。
   * @param token - 登录或刷新接口返回的短期访问令牌
   */
  function setAccessToken(token: string): void {
    accessToken.value = token
    sessionRestoreStatus.value = 'authenticated'
  }

  /** 清除前端内存会话，不主动撤销服务端 Session。 */
  function clearSession(): void {
    accessToken.value = null
    sessionRestoreStatus.value = 'anonymous'
  }

  /**
   * 应用首次导航前尝试用 HttpOnly Refresh Cookie 恢复会话。
   * @returns 初始化完成后结束；未登录属于正常状态，不向页面抛错
   */
  async function initialize(): Promise<void> {
    if (isInitialized.value) {
      return
    }

    if (!initializePromise) {
      initializePromise = (async () => {
        try {
          const data = await refreshSession()
          setAccessToken(data.accessToken)
        } catch (error) {
          clearSession()
          const requestError = normalizeApiError(error)
          if (requestError.statusCode === 401 && requestError.message === '登录状态已失效') {
            sessionRestoreStatus.value = 'expired'
          }
        } finally {
          isInitialized.value = true
        }
      })().finally(() => {
        initializePromise = null
      })
    }

    await initializePromise
  }

  /**
   * 登录并把服务端返回的 Access Token 保存到内存。
   * @param body - 清洗并校验后的登录参数
   */
  async function login(body: LoginBody): Promise<void> {
    const data = await loginRequest(body)
    setAccessToken(data.accessToken)
    isInitialized.value = true
  }

  /**
   * 注册账号并立即建立登录会话。
   * @param body - 清洗并校验后的注册参数
   */
  async function register(body: RegisterBody): Promise<void> {
    await registerRequest(body)
    await login({ email: body.email, password: body.password })
  }

  /**
   * 服务端退出成功后清除本地会话。
   * @throws 网络或服务端退出失败时保留当前会话并向调用层抛错
   */
  async function logout(): Promise<void> {
    await logoutRequest()
    clearSession()
  }

  return {
    accessToken,
    hasExpiredSession,
    isAuthenticated,
    isInitialized,
    clearSession,
    initialize,
    login,
    logout,
    register,
    setAccessToken,
  }
})
