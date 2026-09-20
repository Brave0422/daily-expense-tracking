/**
 * @author Brave
 * @date 2026-09-20T15:30:16+08:00
 * @description 路由鉴权守卫测试，覆盖未登录拦截、登录后回跳和访客页限制。
 */

import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AccessTokenData, LoginBody } from '@/api/auth.types'
import { setupRouterGuards } from '@/router/guards'
import { useAuthStore } from '@/stores/auth.store'

vi.mock('@/api/auth.api', () => ({
  login: vi.fn<(body: LoginBody) => Promise<AccessTokenData>>(),
  logout: vi.fn<() => Promise<void>>(),
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
      { path: '/login', name: 'login', component: { template: '<div>login</div>' }, meta: { guestOnly: true } },
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
