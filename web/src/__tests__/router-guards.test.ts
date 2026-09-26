/**
 * @author Brave
 * @date 2026-09-20T15:30:16+08:00
 * @description 路由鉴权守卫测试，覆盖未登录拦截、登录后回跳和访客页限制。
 */

import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { login, refreshSession, register } from '@/api/auth.api'
import type { AccessTokenData, LoginBody, RegisterBody } from '@/api/auth.types'
import { ApiRequestError } from '@/api/http'
import { setupRouterGuards } from '@/router/guards'
import { useAuthStore } from '@/stores/auth.store'

vi.mock('@/api/auth.api', () => ({
  login: vi.fn<(body: LoginBody) => Promise<AccessTokenData>>(),
  logout: vi.fn<() => Promise<void>>(),
  register: vi.fn<(body: RegisterBody) => Promise<boolean>>(),
  refreshSession: vi
    .fn<() => Promise<AccessTokenData>>()
    .mockRejectedValue(new Error('no session')),
}))

/**
 * 创建包含访客页和受保护页的内存路由。
 * @returns 用于守卫单元测试的独立路由实例
 */
function createTestRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/login',
        name: 'login',
        component: { template: '<div>login</div>' },
        meta: { guestOnly: true },
      },
      {
        path: '/records',
        name: 'records',
        component: { template: '<div>records</div>' },
        meta: { requiresAuth: true },
      },
    ],
  })
}

describe('router guards', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(login).mockReset()
    vi.mocked(register).mockReset()
    vi.mocked(refreshSession).mockReset()
    vi.mocked(refreshSession).mockRejectedValue(new Error('no session'))
  })

  it('redirects unauthenticated users to login and preserves destination', async () => {
    const router = createTestRouter()
    setupRouterGuards(router, useAuthStore())

    await router.push('/records')

    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.query.redirect).toBe('/records')
  })

  it('allows authenticated users to open protected pages', async () => {
    const router = createTestRouter()
    const authStore = useAuthStore()
    await authStore.initialize()
    authStore.setAccessToken('access-token')
    setupRouterGuards(router, authStore)

    await router.push('/records')

    expect(router.currentRoute.value.name).toBe('records')
  })

  it('restores the session before opening a protected page', async () => {
    vi.mocked(refreshSession).mockResolvedValueOnce({ accessToken: 'restored-access-token' })
    const router = createTestRouter()
    const authStore = useAuthStore()
    setupRouterGuards(router, authStore)

    await router.push('/records')

    expect(refreshSession).toHaveBeenCalledTimes(1)
    expect(authStore.accessToken).toBe('restored-access-token')
    expect(router.currentRoute.value.name).toBe('records')
  })

  it('marks an expired refresh session when redirecting to login', async () => {
    vi.mocked(refreshSession).mockRejectedValueOnce(new ApiRequestError('登录状态已失效', 401))
    const router = createTestRouter()
    setupRouterGuards(router, useAuthStore())

    await router.push('/records')

    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.query).toEqual({
      reason: 'session-expired',
      redirect: '/records',
    })
  })

  it('shares one refresh request across concurrent session initialization', async () => {
    let resolveRefresh: ((data: AccessTokenData) => void) | undefined
    vi.mocked(refreshSession).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRefresh = resolve
        }),
    )
    const authStore = useAuthStore()

    const firstInitialization = authStore.initialize()
    const secondInitialization = authStore.initialize()
    resolveRefresh?.({ accessToken: 'restored-access-token' })
    await Promise.all([firstInitialization, secondInitialization])

    expect(refreshSession).toHaveBeenCalledTimes(1)
    expect(authStore.accessToken).toBe('restored-access-token')
  })

  it('registers and logs the new user in immediately', async () => {
    const body: RegisterBody = {
      email: 'new-user@example.com',
      password: '123456',
      code: '123456',
    }
    vi.mocked(register).mockResolvedValueOnce(true)
    vi.mocked(login).mockResolvedValueOnce({ accessToken: 'new-user-access-token' })
    const authStore = useAuthStore()

    await authStore.register(body)

    expect(register).toHaveBeenCalledWith(body)
    expect(login).toHaveBeenCalledWith({
      email: body.email,
      password: body.password,
    })
    expect(authStore.accessToken).toBe('new-user-access-token')
    expect(authStore.isAuthenticated).toBe(true)
  })

  it('redirects authenticated users away from guest pages', async () => {
    const router = createTestRouter()
    const authStore = useAuthStore()
    await authStore.initialize()
    authStore.setAccessToken('access-token')
    setupRouterGuards(router, authStore)

    await router.push('/login')

    expect(router.currentRoute.value.name).toBe('records')
  })
})
