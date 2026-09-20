<script setup lang="ts">
/**
 * @author Brave
 * @date 2026-09-20T15:28:28+08:00
 * @description 注册页面，发送注册验证码并创建新账号。
 */

import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Button as TButton, MessagePlugin } from 'tdesign-vue-next'

import { register } from '@/api/auth.api'
import { normalizeApiError } from '@/api/http'
import BaseFormField from '@/components/base/BaseFormField.vue'
import AuthCodeField from '@/components/business/AuthCodeField.vue'
import AuthLayout from '@/layouts/AuthLayout.vue'
import {
  type FieldErrors,
  normalizeEmail,
  registerSchema,
  validateForm,
} from '@/utils/auth-validation'

const router = useRouter()
const email = ref('')
const code = ref('')
const password = ref('')
const errors = ref<FieldErrors>({})
const formMessage = ref('')
const isSubmitting = ref(false)

/**
 * 校验邮箱、验证码和密码并创建账号。
 * @returns 注册完成后结束；成功时跳转登录页
 */
async function handleSubmit(): Promise<void> {
  formMessage.value = ''
  const validation = validateForm(registerSchema, {
    email: normalizeEmail(email.value),
    code: code.value,
    password: password.value,
  })
  errors.value = validation.errors

  if (!validation.isValid || !validation.data) {
    return
  }

  isSubmitting.value = true
  try {
    await register(validation.data)
    await MessagePlugin.success('注册成功，请登录')
    await router.replace({ name: 'login' })
  } catch (error) {
    formMessage.value = normalizeApiError(error, '注册失败，请稍后重试').message
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <AuthLayout description="使用邮箱验证码创建你的记账账号。" title="创建账号">
    <!-- 邮箱验证码注册表单 -->
    <form class="auth-form" novalidate @submit.prevent="handleSubmit">
      <BaseFormField
        id="register-email"
        v-model="email"
        autocomplete="email"
        :error="errors.email"
        inputmode="email"
        label="邮箱"
        placeholder="name@example.com"
        type="email"
      />
      <AuthCodeField
        id="register-code"
        v-model="code"
        :disabled="isSubmitting"
        :email="email"
        :error="errors.code"
        purpose="register"
        @send-error="formMessage = $event"
        @send-success="formMessage = ''"
      />
      <BaseFormField
        id="register-password"
        v-model="password"
        autocomplete="new-password"
        :error="errors.password"
        label="密码"
        :maxlength="20"
        placeholder="6–20 位密码"
        type="password"
      />
      <p v-if="formMessage" class="auth-form__message" role="alert">{{ formMessage }}</p>
      <TButton class="auth-form__submit" :loading="isSubmitting" theme="primary" type="submit" block>
        {{ isSubmitting ? '注册中...' : '注册' }}
      </TButton>
      <!-- 返回已有账号登录入口 -->
      <div class="auth-form__links">
        <span>已有账号？</span>
        <RouterLink class="auth-form__link" to="/login">返回登录</RouterLink>
      </div>
    </form>
  </AuthLayout>
</template>
