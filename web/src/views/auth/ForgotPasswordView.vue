<script setup lang="ts">
/**
 * @author Brave
 * @date 2026-09-20T15:28:28+08:00
 * @description 忘记密码页面，通过邮箱验证码重置账号密码。
 */

import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Button as TButton, MessagePlugin } from 'tdesign-vue-next'

import { resetPassword } from '@/api/auth.api'
import { normalizeApiError } from '@/api/http'
import BaseFormField from '@/components/base/BaseFormField.vue'
import AuthCodeField from '@/components/business/AuthCodeField.vue'
import AuthLayout from '@/layouts/AuthLayout.vue'
import {
  type FieldErrors,
  normalizeEmail,
  resetPasswordSchema,
  validateForm,
} from '@/utils/auth-validation'

const router = useRouter()
const email = ref('')
const code = ref('')
const newPassword = ref('')
const errors = ref<FieldErrors>({})
const formMessage = ref('')
const isSubmitting = ref(false)

/**
 * 校验邮箱验证码并提交新密码。
 * @returns 重置流程完成后结束；成功时跳转登录页
 */
async function handleSubmit(): Promise<void> {
  formMessage.value = ''
  const validation = validateForm(resetPasswordSchema, {
    email: normalizeEmail(email.value),
    code: code.value,
    newPassword: newPassword.value,
  })
  errors.value = validation.errors

  if (!validation.isValid || !validation.data) {
    return
  }

  isSubmitting.value = true
  try {
    await resetPassword(validation.data)
    await MessagePlugin.success('密码已重置，请重新登录')
    await router.replace({ name: 'login' })
  } catch (error) {
    formMessage.value = normalizeApiError(error, '密码重置失败，请稍后重试').message
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <AuthLayout description="验证邮箱后设置一个新的登录密码。" title="重置密码">
    <!-- 访客重置密码表单 -->
    <form class="auth-form" novalidate @submit.prevent="handleSubmit">
      <BaseFormField
        id="reset-email"
        v-model="email"
        autocomplete="email"
        :error="errors.email"
        inputmode="email"
        label="邮箱"
        placeholder="name@example.com"
        type="email"
      />
      <AuthCodeField
        id="reset-code"
        v-model="code"
        :disabled="isSubmitting"
        :email="email"
        :error="errors.code"
        purpose="reset_password"
        @send-error="formMessage = $event"
        @send-success="formMessage = ''"
      />
      <BaseFormField
        id="reset-new-password"
        v-model="newPassword"
        autocomplete="new-password"
        :error="errors.newPassword"
        label="新密码"
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
        {{ isSubmitting ? '重置中...' : '重置密码' }}
      </TButton>
      <!-- 返回登录入口 -->
      <div class="auth-form__links">
        <span>想起密码了？</span>
        <RouterLink class="auth-form__link" to="/login">返回登录</RouterLink>
      </div>
    </form>
  </AuthLayout>
</template>
