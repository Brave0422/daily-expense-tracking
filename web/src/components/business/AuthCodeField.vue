<script setup lang="ts">
/**
 * @author Brave
 * @date 2026-09-20T15:25:44+08:00
 * @description 邮箱验证码输入与发送组件，处理 60 秒倒计时和邮箱变更失效。
 */

import { computed, onBeforeUnmount, ref, watch } from 'vue'

import { sendVerificationCode } from '@/api/auth.api'
import type { SendVerificationCodeBody, VerificationPurpose } from '@/api/auth.types'
import { ApiRequestError, normalizeApiError } from '@/api/http'
import { loginSchema, normalizeEmail, validateForm } from '@/utils/auth-validation'

interface Props {
  disabled?: boolean
  email?: string
  error?: string
  id: string
  modelValue: string
  purpose: VerificationPurpose
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  email: '',
  error: '',
})

const emit = defineEmits<{
  'send-error': [message: string]
  'send-success': []
  'update:modelValue': [value: string]
}>()

const countdownSeconds = ref(0)
const isSending = ref(false)
const sentEmail = ref<string | null>(null)
let countdownTimer: ReturnType<typeof setInterval> | null = null

const sendButtonText = computed(() => {
  if (isSending.value) {
    return '发送中...'
  }
  return countdownSeconds.value > 0 ? `${countdownSeconds.value}s 后重发` : '发送验证码'
})

/** 清理验证码倒计时及其定时器，避免组件卸载后继续更新状态。 */
function stopCountdown(): void {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
  countdownSeconds.value = 0
}

/**
 * 按服务端或默认冷却时间启动整秒倒计时。
 * @param seconds - 重发等待时间，单位：秒；小数会向上取整
 */
function startCountdown(seconds: number): void {
  stopCountdown()
  countdownSeconds.value = Math.max(1, Math.ceil(seconds))
  countdownTimer = setInterval(() => {
    countdownSeconds.value -= 1
    if (countdownSeconds.value <= 0) {
      stopCountdown()
    }
  }, 1000)
}

/**
 * 发送当前业务用途的验证码；公共场景会先校验邮箱。
 * @returns 请求完成后结束；失败信息通过 send-error 交给所属表单展示
 */
async function handleSendCode(): Promise<void> {
  if (isSending.value || countdownSeconds.value > 0 || props.disabled) {
    return
  }

  let requestBody: SendVerificationCodeBody
  if (props.purpose === 'change_password') {
    requestBody = { purpose: props.purpose }
  } else {
    const validation = validateForm(loginSchema.pick({ email: true }), { email: props.email })
    if (!validation.isValid) {
      emit('send-error', validation.errors.email ?? '请输入正确的邮箱地址')
      return
    }
    requestBody = {
      email: normalizeEmail(props.email),
      purpose: props.purpose,
    }
  }

  isSending.value = true
  try {
    await sendVerificationCode(requestBody)
    sentEmail.value = 'email' in requestBody ? requestBody.email : null
    startCountdown(60)
    emit('send-success')
  } catch (error) {
    const apiError = normalizeApiError(error, '验证码发送失败，请稍后重试')
    if (apiError instanceof ApiRequestError && apiError.retryAfterSeconds) {
      sentEmail.value = 'email' in requestBody ? requestBody.email : null
      startCountdown(apiError.retryAfterSeconds)
    }
    emit('send-error', apiError.message)
  } finally {
    isSending.value = false
  }
}

/**
 * 过滤非数字字符并限制验证码为六位。
 * @param event - 验证码输入框的原生输入事件
 */
function handleInput(event: Event): void {
  const inputValue = (event.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 6)
  emit('update:modelValue', inputValue)
}

// 已发送验证码后修改邮箱会使原验证码失效，因此同时清空输入与倒计时。
watch(
  () => props.email,
  (email) => {
    if (
      props.purpose !== 'change_password' &&
      sentEmail.value &&
      normalizeEmail(email) !== sentEmail.value
    ) {
      sentEmail.value = null
      stopCountdown()
      emit('update:modelValue', '')
    }
  },
)

onBeforeUnmount(stopCountdown)
</script>

<template>
  <!-- 验证码输入和发送按钮组成一个不可拆分的业务字段 -->
  <div class="code-field">
    <label class="code-field__label" :for="props.id">邮箱验证码</label>
    <div class="code-field__row">
      <input
        :id="props.id"
        autocomplete="one-time-code"
        class="code-field__input"
        inputmode="numeric"
        maxlength="6"
        placeholder="6 位数字验证码"
        :value="props.modelValue"
        @input="handleInput"
      />
      <button
        class="code-field__button"
        :disabled="props.disabled || isSending || countdownSeconds > 0"
        type="button"
        @click="handleSendCode"
      >
        {{ sendButtonText }}
      </button>
    </div>
    <p v-if="props.error" class="code-field__error" role="alert">{{ props.error }}</p>
  </div>
</template>

<style scoped>
/* 字段标题与输入/发送按钮双列结构 */
.code-field {
  display: grid;
  gap: 8px;
}

.code-field__label {
  font-size: 14px;
  font-weight: 600;
}

.code-field__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 116px;
  gap: 10px;
}

/* 输入框沿用鉴权表单的聚焦视觉反馈 */
.code-field__input,
.code-field__button {
  min-height: 46px;
  border-radius: 12px;
}

.code-field__input {
  width: 100%;
  padding: 0 14px;
  color: var(--color-text);
  background: #f8f9fa;
  border: 1px solid var(--color-border);
  outline: 0;
}

.code-field__input:focus {
  background: var(--color-surface);
  border-color: var(--color-primary-active);
  box-shadow: 0 0 0 3px rgb(255 230 57 / 20%);
}

/* 发送按钮用主题浅色区分普通表单输入，冷却期禁止再次触发 */
.code-field__button {
  padding: 0 12px;
  color: var(--color-text);
  font-size: 13px;
  font-weight: 600;
  background: var(--color-primary-soft);
  border: 1px solid var(--color-primary);
  cursor: pointer;
}

.code-field__button:hover:not(:disabled) {
  background: var(--color-primary);
}

.code-field__button:disabled {
  color: #97999d;
  background: #f1f2f4;
  border-color: #e2e4e7;
  cursor: not-allowed;
}

/* 字段级错误只描述验证码本身，发送失败由父表单展示 */
.code-field__error {
  margin: 0;
  color: var(--color-danger);
  font-size: 12px;
}
</style>
