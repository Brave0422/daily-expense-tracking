<script setup lang="ts">
/**
 * @author Brave
 * @date 2026-09-27T18:34:34+08:00
 * @description 标签新增与编辑弹窗，负责名称校验、提交状态和成功反馈。
 */

import { computed, ref, watch } from 'vue'
import { Button as TButton, Dialog as TDialog, MessagePlugin } from 'tdesign-vue-next'

import { createTag, updateTag } from '@/api/tag.api'
import type { UserTag } from '@/api/tag.types'
import { normalizeApiError } from '@/api/http'

type TagFormMode = 'create' | 'edit'

interface Props {
  mode: TagFormMode
  tag: UserTag | null
  visible: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'submit-success': []
  'update:visible': [visible: boolean]
}>()

const name = ref('')
const nameError = ref('')
const formMessage = ref('')
const isSubmitting = ref(false)

const dialogVisible = computed({
  get: () => props.visible,
  set: (visible: boolean) => {
    if (!isSubmitting.value) {
      emit('update:visible', visible)
    }
  },
})
const isCreateMode = computed(() => props.mode === 'create')
const dialogTitle = computed(() => (isCreateMode.value ? '添加标签' : '编辑标签'))

function resetForm(): void {
  name.value = ''
  nameError.value = ''
  formMessage.value = ''
}

function initializeForm(): void {
  resetForm()
  if (!isCreateMode.value && props.tag) {
    name.value = props.tag.name
  }
}

function validateName(): boolean {
  const trimmedName = name.value.trim()
  if (!trimmedName) {
    nameError.value = '请输入标签名称'
    return false
  }
  if (trimmedName.length > 50) {
    nameError.value = '标签名称不能超过50个字符'
    return false
  }

  nameError.value = ''
  return true
}

async function handleSubmit(): Promise<void> {
  formMessage.value = ''
  if (!validateName()) {
    return
  }

  if (!isCreateMode.value && !props.tag) {
    formMessage.value = '缺少待编辑的标签信息，请关闭弹窗后重试'
    return
  }

  isSubmitting.value = true
  let isSubmitted = false
  try {
    const body = { name: name.value.trim() }
    if (isCreateMode.value) {
      await createTag(body)
      await MessagePlugin.success('标签添加成功')
    } else if (props.tag) {
      await updateTag(props.tag.id, body)
      await MessagePlugin.success('标签编辑成功')
    }
    isSubmitted = true
  } catch (error) {
    formMessage.value = normalizeApiError(
      error,
      isCreateMode.value ? '标签添加失败，请稍后重试' : '标签编辑失败，请稍后重试',
    ).message
  } finally {
    isSubmitting.value = false
  }

  if (isSubmitted) {
    emit('submit-success')
    dialogVisible.value = false
  }
}

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      initializeForm()
    } else if (!isSubmitting.value) {
      resetForm()
    }
  },
)
</script>

<template>
  <TDialog
    v-model:visible="dialogVisible"
    :close-btn="!isSubmitting"
    :close-on-overlay-click="!isSubmitting"
    dialog-class-name="tag-form-dialog"
    :footer="false"
    :header="dialogTitle"
    width="460px"
  >
    <form class="tag-form" novalidate @submit.prevent="handleSubmit">
      <div class="tag-form__field">
        <label for="tag-name">标签名称</label>
        <input
          id="tag-name"
          v-model="name"
          :aria-invalid="Boolean(nameError)"
          :disabled="isSubmitting"
          maxlength="50"
          placeholder="请输入标签名称"
          type="text"
          @input="nameError = ''"
        />
        <p v-if="nameError" class="tag-form__error" role="alert">{{ nameError }}</p>
      </div>

      <p v-if="formMessage" class="tag-form__message" role="alert">{{ formMessage }}</p>

      <div class="tag-form__actions">
        <TButton
          :disabled="isSubmitting"
          theme="default"
          type="button"
          @click="dialogVisible = false"
        >
          取消
        </TButton>
        <TButton class="app-confirm-button" :loading="isSubmitting" theme="primary" type="submit">
          确认
        </TButton>
      </div>
    </form>
  </TDialog>
</template>

<style scoped>
.tag-form {
  display: grid;
  gap: 18px;
  padding-top: 4px;
}

.tag-form__field {
  display: grid;
  gap: 8px;
}

.tag-form__field label {
  color: var(--color-text);
  font-size: 14px;
  font-weight: 600;
}

.tag-form__field input {
  width: 100%;
  min-height: 46px;
  padding: 0 14px;
  color: var(--color-text);
  background: #f8f9fa;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  outline: 0;
  transition:
    background-color 0.2s,
    border-color 0.2s,
    box-shadow 0.2s;
}

.tag-form__field input:focus {
  background: var(--color-surface);
  border-color: var(--color-primary-active);
  box-shadow: 0 0 0 3px rgb(255 230 57 / 20%);
}

.tag-form__field input[aria-invalid='true'] {
  border-color: var(--color-danger);
}

.tag-form__field input:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

.tag-form__error,
.tag-form__message {
  margin: 0;
  color: var(--color-danger);
  font-size: 12px;
  line-height: 1.5;
}

.tag-form__message {
  padding: 10px 12px;
  background: #fff2f1;
  border-radius: 10px;
}

.tag-form__actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 4px;
}

/* 弹窗挂载到 body，通过唯一业务类限制圆角覆盖范围。 */
:global(.tag-form-dialog.t-dialog) {
  border-radius: 18px;
}
</style>
