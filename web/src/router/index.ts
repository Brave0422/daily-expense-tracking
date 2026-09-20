/**
 * @author Brave
 * @date 2026-09-18T17:49:29+08:00
 * @description 应用路由配置，声明访客页、鉴权布局与业务占位页。
 */

import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    // 未登录用户访问的鉴权页面。
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/auth/LoginView.vue'),
      meta: { guestOnly: true },
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('@/views/auth/RegisterView.vue'),
      meta: { guestOnly: true },
    },
    {
      path: '/forgot-password',
      name: 'forgot-password',
      component: () => import('@/views/auth/ForgotPasswordView.vue'),
      meta: { guestOnly: true },
    },
    // 登录后的业务页面统一使用固定侧栏布局。
    {
      path: '/',
      component: () => import('@/layouts/DefaultLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        { path: '', redirect: { name: 'records' } },
        {
          path: 'records',
          name: 'records',
          component: () => import('@/views/records/RecordsView.vue'),
        },
        {
          path: 'statistics',
          name: 'statistics',
          component: () => import('@/views/statistics/StatisticsView.vue'),
        },
        {
          path: 'management',
          name: 'management',
          component: () => import('@/views/management/ManagementView.vue'),
        },
      ],
    },
    // 未知地址回到默认业务页，再由鉴权守卫决定是否进入登录页。
    {
      path: '/:pathMatch(.*)*',
      redirect: { name: 'records' },
    },
  ],
})

export default router
