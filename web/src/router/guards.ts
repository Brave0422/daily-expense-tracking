/**
 * @author Brave
 * @date 2026-09-20T15:23:51+08:00
 * @description 路由鉴权守卫，等待会话恢复并处理访客页与业务页跳转。
 */

import type { Router } from 'vue-router'

import type { useAuthStore } from '@/stores/auth.store'

declare module 'vue-router' {
  interface RouteMeta {
    guestOnly?: boolean
    requiresAuth?: boolean
  }
}

type AuthStore = ReturnType<typeof useAuthStore>

/**
 * 注册全局鉴权守卫，并确保首次路由判定前已完成会话恢复。
 * @param router - 当前应用路由实例
 * @param authStore - 应用鉴权状态；守卫只控制前端导航，真实权限仍由服务端校验
 */
export function setupRouterGuards(router: Router, authStore: AuthStore): void {
  router.beforeEach(async (to) => {
    if (!authStore.isInitialized) {
      await authStore.initialize()
    }

    if (to.meta.requiresAuth && !authStore.isAuthenticated) {
      return {
        name: 'login',
        query: {
          redirect: to.fullPath,
          ...(authStore.hasExpiredSession ? { reason: 'session-expired' } : {}),
        },
      }
    }

    if (to.meta.guestOnly && authStore.isAuthenticated) {
      return { name: 'records' }
    }

    return true
  })
}
