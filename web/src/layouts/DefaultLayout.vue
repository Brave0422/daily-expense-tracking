<script setup lang="ts">
/**
 * @author Brave
 * @date 2026-09-20T15:27:12+08:00
 * @description 鉴权业务页固定侧栏布局，提供导航、修改密码和安全退出入口。
 */

import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Dialog as TDialog, MessagePlugin, Tooltip as TTooltip } from 'tdesign-vue-next'

import BaseIcon, { type IconName } from '@/components/base/BaseIcon.vue'
import ChangePasswordDialog from '@/components/business/ChangePasswordDialog.vue'
import { normalizeApiError } from '@/api/http'
import { useAuthStore } from '@/stores/auth.store'

interface NavigationItem {
  icon: IconName
  label: string
  routeName: 'records' | 'statistics' | 'management'
}

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const navigationItems: readonly NavigationItem[] = [
  { icon: 'records', label: '账单列表', routeName: 'records' },
  { icon: 'statistics', label: '账单统计', routeName: 'statistics' },
  { icon: 'management', label: '分类管理', routeName: 'management' },
]

const isProfileOpen = ref(false)
const isChangePasswordVisible = ref(false)
const isLogoutDialogVisible = ref(false)
const isLoggingOut = ref(false)
const profileElement = ref<HTMLElement | null>(null)
const currentRouteName = computed(() => route.name)

/** 点击头像菜单外部时关闭菜单，不阻止当前点击继续触发导航或其他操作。 */
function handleDocumentClick(event: MouseEvent): void {
  const clickTarget = event.target
  if (clickTarget instanceof Node && profileElement.value?.contains(clickTarget)) {
    return
  }

  isProfileOpen.value = false
}

/** 关闭头像菜单并打开修改密码弹窗。 */
function handleOpenChangePassword(): void {
  isProfileOpen.value = false
  isChangePasswordVisible.value = true
}

/** 关闭头像菜单并打开退出确认弹窗。 */
function handleOpenLogout(): void {
  isProfileOpen.value = false
  isLogoutDialogVisible.value = true
}

/**
 * 先撤销服务端会话，再清理前端状态并返回登录页。
 * @returns 退出流程结束后完成；网络失败时保留当前会话并提示重试
 */
async function handleLogout(): Promise<void> {
  isLoggingOut.value = true
  try {
    await authStore.logout()
    isLogoutDialogVisible.value = false
    await router.replace({ name: 'login' })
    await MessagePlugin.success('已安全退出')
  } catch (error) {
    await MessagePlugin.error(normalizeApiError(error, '退出失败，请稍后重试').message)
  } finally {
    isLoggingOut.value = false
  }
}

onMounted(() => document.addEventListener('click', handleDocumentClick))
onBeforeUnmount(() => document.removeEventListener('click', handleDocumentClick))
</script>

<template>
  <div class="default-layout">
    <!-- 固定侧栏：头像菜单和三个一级业务入口 -->
    <aside class="default-layout__sidebar" aria-label="主要导航">
      <!-- 账户操作菜单 -->
      <div ref="profileElement" class="default-layout__profile">
        <button
          aria-label="打开用户菜单"
          :aria-expanded="isProfileOpen"
          class="default-layout__avatar"
          type="button"
          @click="isProfileOpen = !isProfileOpen"
        >
          账
        </button>
        <div v-if="isProfileOpen" class="profile-menu" role="menu">
          <button role="menuitem" type="button" @click="handleOpenChangePassword">
            <BaseIcon name="changePassword" :size="18" />
            <span>修改密码</span>
          </button>
          <button
            class="profile-menu__danger"
            role="menuitem"
            type="button"
            @click="handleOpenLogout"
          >
            <BaseIcon name="logout" :size="18" />
            <span>退出登录</span>
          </button>
        </div>
      </div>

      <!-- Iconfont 导航：默认灰色，当前路由使用主题色 -->
      <nav class="default-layout__navigation">
        <TTooltip
          v-for="item in navigationItems"
          :key="item.routeName"
          :content="item.label"
          placement="right"
        >
          <RouterLink
            :aria-label="item.label"
            class="default-layout__nav-link"
            :class="{ 'default-layout__nav-link--active': currentRouteName === item.routeName }"
            :to="{ name: item.routeName }"
          >
            <BaseIcon :name="item.icon" :size="25" />
          </RouterLink>
        </TTooltip>
      </nav>
    </aside>

    <!-- 鉴权业务子路由出口 -->
    <main class="default-layout__content">
      <RouterView />
    </main>

    <!-- 账户安全相关弹窗 -->
    <ChangePasswordDialog v-model:visible="isChangePasswordVisible" />

    <TDialog
      v-model:visible="isLogoutDialogVisible"
      cancel-btn="取消"
      :close-btn="!isLoggingOut"
      :close-on-overlay-click="!isLoggingOut"
      :confirm-btn="{ content: '退出登录', loading: isLoggingOut, disabled: isLoggingOut }"
      header="确认退出登录？"
      @confirm="handleLogout"
    >
      <p class="logout-dialog__text">退出后需要重新输入邮箱和密码才能访问账单数据。</p>
      <p v-if="isLoggingOut" class="logout-dialog__status">正在安全退出...</p>
    </TDialog>
  </div>
</template>

<style scoped>
/* 业务页整体布局 */
.default-layout {
  min-height: 100vh;
}

.default-layout__sidebar {
  position: fixed;
  z-index: 20;
  top: var(--space-page);
  bottom: var(--space-page);
  left: var(--space-page);
  display: flex;
  width: 72px;
  flex-direction: column;
  align-items: center;
  padding: 14px 9px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
}

/* 头像与右侧弹出菜单 */
.default-layout__profile {
  position: relative;
}

.default-layout__avatar {
  display: grid;
  width: 44px;
  height: 44px;
  padding: 0;
  color: #403900;
  font-size: 17px;
  font-weight: 700;
  background: var(--color-primary);
  border: 0;
  border-radius: 50%;
  cursor: pointer;
  place-items: center;
}

.default-layout__avatar:hover {
  background: var(--color-primary-hover);
}

.profile-menu {
  position: absolute;
  top: 0;
  left: 56px;
  display: grid;
  width: 148px;
  overflow: hidden;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  box-shadow: 0 12px 30px rgb(32 33 36 / 13%);
}

.profile-menu button {
  display: flex;
  align-items: center;
  gap: 9px;
  min-height: 42px;
  padding: 0 16px;
  font-size: 14px;
  text-align: left;
  background: transparent;
  border: 0;
  cursor: pointer;
}

.profile-menu button:hover {
  background: #f5f6f7;
}

.profile-menu__danger {
  color: var(--color-danger);
}

/* 业务导航图标默认灰色，激活态继承主题色 */
.default-layout__navigation {
  display: grid;
  gap: 14px;
  margin-top: 58px;
}

.default-layout__nav-link {
  display: grid;
  width: 46px;
  height: 46px;
  color: var(--color-icon);
  text-decoration: none;
  border: 1px solid transparent;
  border-radius: 14px;
  place-items: center;
  transition:
    color 0.2s,
    background-color 0.2s,
    border-color 0.2s;
}

.default-layout__nav-link:hover:not(.default-layout__nav-link--active) {
  color: #696d73;
  background: #f6f7f8;
}

.default-layout__nav-link--active {
  color: var(--color-primary);
  background: #303238;
  border-color: #303238;
}

/* 主内容为固定侧栏预留宽度和页面边距 */
.default-layout__content {
  min-height: 100vh;
  margin-left: 88px;
  padding: var(--space-page);
}

/* 退出确认状态 */
.logout-dialog__text {
  margin: 0;
  color: var(--color-text-secondary);
  line-height: 1.7;
}

.logout-dialog__status {
  margin: 12px 0 0;
  color: #8b7900;
  font-size: 13px;
}
</style>
