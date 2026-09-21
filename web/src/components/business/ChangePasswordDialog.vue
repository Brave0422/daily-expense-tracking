<script setup lang="ts">
/**
 * @author Brave
 * @date 2026-09-20T15:27:12+08:00
 * @description 登录态修改密码弹窗，处理验证码发送、校验与后端提交。
 */

import { computed, ref, watch } from 'vue'
import { Button as TButton, Dialog as TDialog, MessagePlugin } from 'tdesign-vue-next'

import { changePassword } from '@/api/auth.api'
import { normalizeApiError } from '@/api/http'
import BaseFormField from '@/components/base/BaseFormField.vue'
import AuthCodeField from '@/components/business/AuthCodeField.vue'
import { changePasswordSchema, type FieldErrors, validateForm } from '@/utils/auth-validation'

interface Props {
  visible: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:visible': [visible: boolean]
}>()

const code = ref('')
const newPassword = ref('')
const errors = ref<FieldErrors>({})
const formMessage = ref('')
const isSubmitting = ref(false)

const dialogVisible = computed({
  get: () => props.visible,
  set: (visible: boolean) => emit('update:visible', visible),
})

/** 清空弹窗草稿和错误，防止再次打开时暴露上次输入。 */
function resetForm(): void {
  code.value = ''
  newPassword.value = ''
  errors.value = {}
  formMessage.value = ''
}

/**
 * 校验修改密码草稿并提交当前登录用户的新密码。
 * @returns 提交完成后结束；成功关闭弹窗，失败保留草稿供用户修正
 */
async function handleSubmit(): Promise<void> {
  formMessage.value = ''
  const validation = validateForm(changePasswordSchema, {
    code: code.value,
    newPassword: newPassword.value,
  })
  errors.value = validation.errors

  if (!validation.isValid || !validation.data) {
    return
  }

  isSubmitting.value = true
  try {
    await changePassword({
      code: validation.data.code,
      newPassword: validation.data.newPassword,
    })
    dialogVisible.value = false
    await MessagePlugin.success('密码修改成功')
  } catch (error) {
    formMessage.value = normalizeApiError(error, '密码修改失败，请稍后重试').message
  } finally {
    isSubmitting.value = false
  }
}

// 弹窗关闭后再清理表单，保留提交失败时用户已输入的内容。
watch(
  () => props.visible,
  (visible) => {
    if (!visible) {
      resetForm()
    }
  },
)
</script>

<template>
  <!-- 登录态账户安全弹窗 -->
  <TDialog
    v-model:visible="dialogVisible"
    :close-on-overlay-click="!isSubmitting"
    :footer="false"
    header="修改密码"
    width="460px"
  >
    <!-- 修改密码表单：服务端根据登录态将验证码发送到注册邮箱 -->
    <form class="change-password-form" novalidate @submit.prevent="handleSubmit">
      <p class="change-password-form__hint">验证码将发送到当前账号的注册邮箱。</p>
      <AuthCodeField
        id="change-password-code"
        v-model="code"
        :disabled="isSubmitting"
        :error="errors.code"
        purpose="change_password"
        @send-error="formMessage = $event"
        @send-success="formMessage = ''"
      />
      <BaseFormField
        id="change-password-new-password"
        v-model="newPassword"
        autocomplete="new-password"
        :error="errors.newPassword"
        label="新密码"
        :maxlength="20"
        placeholder="6–20 位密码"
        type="password"
      />
      <p v-if="formMessage" class="auth-form__message" role="alert">{{ formMessage }}</p>
      <!-- 提交期间禁用关闭操作，避免重复请求或状态丢失 -->
      <div class="change-password-form__actions">
        <TButton
          :disabled="isSubmitting"
          theme="default"
          type="button"
          @click="dialogVisible = false"
        >
          取消
        </TButton>
        <TButton class="app-confirm-button" :loading="isSubmitting" theme="primary" type="submit">
          确认修改
        </TButton>
      </div>
    </form>
  </TDialog>
</template>

<style scoped>
/* 弹窗内表单沿用鉴权页面的纵向节奏 */
.change-password-form {
  display: grid;
  gap: 18px;
  padding-top: 4px;
}

.change-password-form__hint {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 13px;
}

/* 操作区与 TDesign 弹窗默认按钮顺序保持一致 */
.change-password-form__actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 4px;
}
</style>
