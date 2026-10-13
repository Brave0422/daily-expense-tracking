<script setup lang="ts">
/**
 * @author Brave
 * @date 2026-10-13T20:51:25+08:00
 * @description 流水删除确认弹窗，处理二次确认、重复提交保护和失败重试。
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Button as TButton, Dialog as TDialog } from 'tdesign-vue-next'
import { normalizeApiError } from '@/api/http'
import { deleteTransaction } from '@/api/transaction.api'
import type { DailyTransactionItem } from '@/api/transaction.types'
import { formatAmount } from '@/utils/money'

const props = defineProps<{
  visible: boolean
  transaction: DailyTransactionItem | null
}>()
const emit = defineEmits<{
  'update:visible': [visible: boolean]
  'submit-success': []
}>()
const isDeleting = ref(false)
const errorMessage = ref('')
let isActive = true

const dialogVisible = computed({
  get: () => props.visible,
  set: (visible: boolean) => {
    if (!isDeleting.value) emit('update:visible', visible)
  },
})
const confirmationMessage = computed(() => {
  const transaction = props.transaction
  if (!transaction) return ''
  const { primary, secondary } = transaction.category
  const label =
    transaction.title || (secondary ? `${primary.name} - ${secondary.name}` : primary.name)
  return `确定删除“${label}（¥${formatAmount(transaction.amount)}）”吗？`
})

/** 确认删除只执行一次；失败保留弹窗和原数据，成功通知页面刷新。 */
async function handleDelete(): Promise<void> {
  if (!props.transaction || isDeleting.value) return
  const transactionId = props.transaction.id
  isDeleting.value = true
  errorMessage.value = ''
  try {
    await deleteTransaction(transactionId)
    if (!isActive) return
    emit('update:visible', false)
    emit('submit-success')
  } catch (error) {
    if (isActive) errorMessage.value = normalizeApiError(error, '删除流水失败，请重试').message
  } finally {
    if (isActive) isDeleting.value = false
  }
}
watch(
  () => props.visible,
  (visible) => {
    if (visible) errorMessage.value = ''
  },
)
onBeforeUnmount(() => {
  isActive = false
})
</script>

<template>
  <TDialog
    v-model:visible="dialogVisible"
    header="删除流水"
    placement="center"
    width="440px"
    :footer="false"
    :close-btn="!isDeleting"
    :close-on-overlay-click="!isDeleting"
    :close-on-esc-keydown="!isDeleting"
  >
    <div class="transaction-delete-dialog">
      <p class="transaction-delete-dialog__target">{{ confirmationMessage }}</p>
      <p v-if="errorMessage" class="transaction-delete-dialog__error" role="alert">
        {{ errorMessage }}
      </p>
      <div class="transaction-delete-dialog__actions">
        <TButton
          :disabled="isDeleting"
          theme="default"
          type="button"
          @click="dialogVisible = false"
        >
          取消
        </TButton>
        <TButton
          :loading="isDeleting"
          :disabled="isDeleting"
          theme="danger"
          type="button"
          @click="handleDelete"
        >
          确认删除
        </TButton>
      </div>
    </div>
  </TDialog>
</template>

<style scoped>
.transaction-delete-dialog {
  display: grid;
  gap: 20px;
}
.transaction-delete-dialog p {
  margin: 0;
}
.transaction-delete-dialog__target {
  overflow-wrap: anywhere;
  line-height: 1.7;
}
.transaction-delete-dialog__error {
  padding: 10px 12px;
  background: #fff1f0;
  border-radius: 8px;
  color: var(--color-danger);
}
.transaction-delete-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
