<script setup lang="ts">
/**
 * @author Brave
 * @date 2026-09-20T15:28:28+08:00
 * @description 登录页面，校验账号密码并支持鉴权拦截后的安全回跳。
 */

import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Button as TButton, MessagePlugin } from 'tdesign-vue-next'

import { normalizeApiError } from '@/api/http'
import BaseFormField from '@/components/base/BaseFormField.vue'
import AuthLayout from '@/layouts/AuthLayout.vue'
import { useAuthStore } from '@/stores/auth.store'
import {
  type FieldErrors,
  loginSchema,
  normalizeEmail,
  validateForm,
} from '@/utils/auth-validation'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const email = ref('')
const password = ref('')
const errors = ref<FieldErrors>({})
const formMessage = ref('')
const isSubmitting = ref(false)

onMounted(async () => {
  if (route.query.reason === 'session-expired') {
    await MessagePlugin.warning('登录已失效，请重新登录')
  }
})

/**
 * 读取并校验登录前保存的站内目标地址，阻止协议相对 URL 跳转。
 * @returns 安全的站内路径；无有效目标时返回账单列表页
 */
function getSafeRedirect(): string {
  const redirectQuery = route.query.redirect
  const redirect = Array.isArray(redirectQuery) ? redirectQuery[0] : redirectQuery
  return typeof redirect === 'string' && redirect.startsWith('/') && !redirect.startsWith('//')
    ? redirect
    : '/records'
}

/**
 * 校验并提交登录表单，成功后回到原目标页面。
 * @returns 登录与导航完成后结束
 */
async function handleSubmit(): Promise<void> {
  formMessage.value = ''
  const validation = validateForm(loginSchema, {
    email: normalizeEmail(email.value),
    password: password.value,
  })
  errors.value = validation.errors

  if (!validation.isValid || !validation.data) {
    return
  }

  isSubmitting.value = true
  try {
    await authStore.login(validation.data)
    await router.replace(getSafeRedirect())
    await MessagePlugin.success('登录成功')
  } catch (error) {
    formMessage.value = normalizeApiError(error, '登录失败，请稍后重试').message
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <AuthLayout description="登录后继续记录和查看你的日常收支。" title="欢迎回来">
    <!-- 邮箱密码登录表单 -->
    <form class="auth-form" novalidate @submit.prevent="handleSubmit">
      <BaseFormField
        id="login-email"
        v-model="email"
        autocomplete="email"
        :error="errors.email"
        inputmode="email"
        label="邮箱"
        placeholder="name@example.com"
        type="email"
      />
      <BaseFormField
        id="login-password"
        v-model="password"
        autocomplete="current-password"
        :error="errors.password"
        label="密码"
        :maxlength="20"
        placeholder="6–20 位密码"
        type="password"
      />
      <p v-if="formMessage" class="auth-form__message" role="alert">{{ formMessage }}</p>
      <TButton
        class="app-confirm-button auth-form__submit"
        :loading="isSubmitting"
        theme="primary"
        type="submit"
        block
      >
        {{ isSubmitting ? '登录中...' : '登录' }}
      </TButton>
      <!-- 访客辅助入口 -->
      <div class="auth-form__links">
        <RouterLink class="auth-form__link" to="/register">创建账号</RouterLink>
        <RouterLink class="auth-form__link" to="/forgot-password">忘记密码？</RouterLink>
      </div>
    </form>
  </AuthLayout>
</template>
