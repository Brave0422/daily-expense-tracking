/**
 * @author Brave
 * @date 2026-09-18T17:49:29+08:00
 * @description 前端应用初始化入口，装配图标、状态、鉴权桥接、路由和全局样式。
 */
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import 'tdesign-vue-next/es/style/index.css'

import App from './App.vue'
import { configureAuthSessionBridge } from './api/http'
import { loadIconfontSymbols } from './plugins/iconfont-symbol'
import router from './router'
import { setupRouterGuards } from './router/guards'
import { useAuthStore } from './stores/auth.store'
import './styles/main.css'

loadIconfontSymbols()

const app = createApp(App)
const pinia = createPinia()

/**
 * Access Token 刷新彻底失败时，将受保护页面送回登录页并保留原目标地址。
 * @returns 导航完成后结束；访客页不触发跳转
 */
async function handleExpiredSession(): Promise<void> {
  const currentRoute = router.currentRoute.value
  if (currentRoute.meta.requiresAuth) {
    await router.replace({
      name: 'login',
      query: { redirect: currentRoute.fullPath },
    })
  }
}

// 先激活 Pinia，使路由守卫和 HTTP 桥接可以共享同一个鉴权 Store。
app.use(pinia)

const authStore = useAuthStore(pinia)
setupRouterGuards(router, authStore)

// HTTP 层通过桥接读写会话，不直接依赖 Pinia 或路由实例。
configureAuthSessionBridge({
  getAccessToken: () => authStore.accessToken,
  setAccessToken: (accessToken) => authStore.setAccessToken(accessToken),
  clearSession: () => authStore.clearSession(),
  handleExpiredSession,
})

// 路由在桥接完成后启动，确保首次导航能够安全恢复会话。
app.use(router)

app.mount('#app')
