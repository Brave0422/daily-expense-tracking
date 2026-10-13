<script setup lang="ts">
/**
 * @author Brave
 * @date 2026-09-27T18:34:34+08:00
 * @description 配置管理与流水共用标签弹窗；流水模式只校验草稿并确认同名复用，配置模式直接保存。
 */

import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Button as TButton, Dialog as TDialog, MessagePlugin } from 'tdesign-vue-next'

import { checkTagName, createTag, updateTag } from '@/api/tag.api'
import type { TagDraftSelection, UserTag } from '@/api/tag.types'
import { normalizeApiError } from '@/api/http'

type TagFormMode = 'create' | 'edit'

interface Props {
  mode: TagFormMode
  tag?: UserTag | null
  visible: boolean
  draft?: boolean
  selectedTags?: UserTag[]
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'submit-success': []
  'draft-success': [selection: TagDraftSelection]
  'update:visible': [visible: boolean]
}>()

const name = ref('')
const nameError = ref('')
const formMessage = ref('')
const isSubmitting = ref(false)
const pendingReuseTag = ref<UserTag | null>(null)
let requestSequence = 0
let isActive = true

const dialogVisible = computed({
  get: () => props.visible,
  set: (visible: boolean) => {
    if (!isSubmitting.value && !pendingReuseTag.value) {
      emit('update:visible', visible)
    }
  },
})
const isCreateMode = computed(() => props.mode !== 'edit')
const dialogTitle = computed(() => (isCreateMode.value ? '添加标签' : '编辑标签'))

function resetForm(): void {
  name.value = ''
  nameError.value = ''
  formMessage.value = ''
  pendingReuseTag.value = null
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
  if (Array.from(trimmedName).length > 50) {
    nameError.value = '标签名称不能超过50个字符'
    return false
  }

  nameError.value = ''
  return true
}

async function handleSubmit(): Promise<void> {
  if (isSubmitting.value || pendingReuseTag.value || !props.visible) return
  formMessage.value = ''
  if (!validateName()) {
    return
  }

  if (!isCreateMode.value && !props.tag) {
    formMessage.value = '缺少待编辑的标签信息，请关闭弹窗后重试'
    return
  }

  isSubmitting.value = true
  const sequence = ++requestSequence
  const mode = props.mode
  const editingTag = props.tag
  let isSubmitted = false
  try {
    const body = { name: name.value.trim() }
    if (props.draft) {
      const otherTags =
        props.selectedTags?.filter((tag) => mode !== 'edit' || tag.id !== editingTag?.id) ?? []
      if (otherTags.some((tag) => tag.name === body.name)) {
        nameError.value = '当前流水已添加该标签'
        return
      }
      // 原标签名称未变时保留其关联，包括历史归档标签；编辑草稿不改全局标签。
      if (mode === 'edit' && editingTag && editingTag.id > 0 && editingTag.name === body.name) {
        completeDraft({
          name: body.name,
          existingTag: editingTag,
        })
        return
      }
      const existingTag = await checkTagName(body)
      if (!isActive || sequence !== requestSequence) return
      if (existingTag && otherTags.some((tag) => tag.id === existingTag.id)) {
        nameError.value = '当前流水已添加该标签'
        return
      }
      if (existingTag) pendingReuseTag.value = existingTag
      else completeDraft({ name: body.name })
      return
    } else if (mode === 'create') {
      await createTag(body)
    } else if (editingTag) {
      await updateTag(editingTag.id, body)
    }
    isSubmitted = true
  } catch (error) {
    if (isActive && sequence === requestSequence) {
      formMessage.value = normalizeApiError(
        error,
        mode === 'edit' ? '标签编辑失败，请稍后重试' : '标签添加失败，请稍后重试',
      ).message
    }
  } finally {
    if (isActive && sequence === requestSequence) isSubmitting.value = false
  }

  if (isSubmitted && isActive && sequence === requestSequence) {
    emit('submit-success')
    dialogVisible.value = false
    await MessagePlugin.success(mode === 'edit' ? '标签编辑成功' : '标签添加成功')
  }
}

/** 仅向流水表单提交草稿，不创建标签、改名或展示保存成功消息。 */
function completeDraft(selection: TagDraftSelection): void {
  pendingReuseTag.value = null
  emit('draft-success', selection)
  emit('update:visible', false)
}

/** 用户明确确认后才把已有标签纳入流水草稿。 */
function handleConfirmReuse(): void {
  const tag = pendingReuseTag.value
  if (!tag || isSubmitting.value) return
  completeDraft({ name: tag.name, existingTag: tag })
}

watch(
  () => [props.visible, props.mode, props.tag, props.draft] as const,
  ([visible]) => {
    requestSequence += 1
    isSubmitting.value = false
    if (visible) {
      initializeForm()
    } else {
      resetForm()
    }
  },
  { immediate: true },
)
onBeforeUnmount(() => {
  isActive = false
  requestSequence += 1
})
</script>

<template>
  <TDialog
    v-model:visible="dialogVisible"
    :close-btn="!isSubmitting && !pendingReuseTag"
    :close-on-overlay-click="!isSubmitting && !pendingReuseTag"
    :close-on-esc-keydown="!isSubmitting && !pendingReuseTag"
    dialog-class-name="tag-form-dialog"
    :footer="false"
    :header="dialogTitle"
    width="460px"
  >
    <form class="tag-form" novalidate @submit.prevent.stop="handleSubmit">
      <div class="tag-form__field">
        <label for="tag-name">标签名称</label>
        <input
          id="tag-name"
          v-model="name"
          :aria-invalid="Boolean(nameError)"
          :disabled="isSubmitting || Boolean(pendingReuseTag)"
          placeholder="请输入标签名称"
          type="text"
          @input="nameError = ''"
        />
        <p v-if="nameError" class="tag-form__error" role="alert">{{ nameError }}</p>
      </div>

      <p v-if="formMessage" class="tag-form__message" role="alert">{{ formMessage }}</p>

      <div class="tag-form__actions">
        <TButton
          :disabled="isSubmitting || Boolean(pendingReuseTag)"
          theme="default"
          type="button"
          @click="dialogVisible = false"
        >
          取消
        </TButton>
        <TButton
          class="app-confirm-button"
          :loading="isSubmitting"
          :disabled="Boolean(pendingReuseTag)"
          theme="primary"
          type="submit"
        >
          确认
        </TButton>
      </div>
    </form>
  </TDialog>
  <TDialog
    :visible="Boolean(pendingReuseTag)"
    header="使用已有标签"
    :footer="false"
    width="420px"
    @close="pendingReuseTag = null"
  >
    <div class="tag-reuse-dialog">
      <p>已经存在同名标签“{{ pendingReuseTag?.name }}”，确认继续使用吗？</p>
      <div class="tag-form__actions tag-reuse-dialog__actions">
        <TButton theme="default" type="button" @click="pendingReuseTag = null">取消</TButton>
        <TButton
          class="app-confirm-button"
          theme="primary"
          type="button"
          @click="handleConfirmReuse"
          >继续使用</TButton
        >
      </div>
    </div>
  </TDialog>
</template>

<style scoped>
.tag-form {
  display: grid;
  gap: 18px;
  padding-top: 4px;
}
.tag-reuse-dialog p {
  margin: 0 0 20px;
  line-height: 1.7;
  overflow-wrap: anywhere;
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
