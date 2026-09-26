<script setup lang="ts">
/**
 * @author Brave
 * @date 2026-09-26T16:08:48+08:00
 * @description 分类图标选择弹窗，展示只读图标库并提交用户当前选中的 iconKey。
 */

import { computed, ref, watch } from 'vue'
import { Button as TButton, Dialog as TDialog } from 'tdesign-vue-next'

import type { CategoryIconOption } from '@/api/category.types'

import CategoryIcon from './CategoryIcon.vue'

interface Props {
  error?: string
  icons: CategoryIconOption[]
  isLoading?: boolean
  selectedIconKey: string
  visible: boolean
}

const props = withDefaults(defineProps<Props>(), {
  error: '',
  isLoading: false,
})

const emit = defineEmits<{
  confirm: [iconKey: string]
  retry: []
  'update:visible': [visible: boolean]
}>()

const draftIconKey = ref('')

const dialogVisible = computed({
  get: () => props.visible,
  set: (visible: boolean) => emit('update:visible', visible),
})

function handleConfirm(): void {
  if (!draftIconKey.value) {
    return
  }

  emit('confirm', draftIconKey.value)
  dialogVisible.value = false
}

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      draftIconKey.value = props.selectedIconKey
    }
  },
)
</script>

<template>
  <TDialog
    v-model:visible="dialogVisible"
    dialog-class-name="category-icon-picker-dialog"
    :footer="false"
    header="选择图标"
    width="680px"
  >
    <div class="icon-picker">
      <div v-if="props.isLoading" class="icon-picker__state" role="status">
        <span class="icon-picker__spinner" aria-hidden="true" />
        正在加载图标库...
      </div>

      <div
        v-else-if="props.error"
        class="icon-picker__state icon-picker__state--error"
        role="alert"
      >
        <p>{{ props.error }}</p>
        <TButton theme="default" type="button" @click="emit('retry')">重新加载</TButton>
      </div>

      <div v-else-if="props.icons.length === 0" class="icon-picker__state">暂无可选图标</div>

      <div v-else class="icon-picker__grid" role="listbox" aria-label="分类图标">
        <button
          v-for="icon in props.icons"
          :key="icon.iconKey"
          :aria-label="`选择图标 ${icon.iconKey}`"
          :aria-selected="draftIconKey === icon.iconKey"
          class="icon-picker__option"
          :class="{ 'icon-picker__option--selected': draftIconKey === icon.iconKey }"
          role="option"
          type="button"
          @click="draftIconKey = icon.iconKey"
        >
          <CategoryIcon
            :background-color="icon.backgroundColor"
            :icon-key="icon.iconKey"
            :size="42"
          />
        </button>
      </div>

      <div class="icon-picker__actions">
        <TButton theme="default" type="button" @click="dialogVisible = false">取消</TButton>
        <TButton
          class="app-confirm-button icon-picker__confirm-button"
          :disabled="!draftIconKey"
          theme="primary"
          type="button"
          @click="handleConfirm"
        >
          确定
        </TButton>
      </div>
    </div>
  </TDialog>
</template>

<style scoped>
.icon-picker {
  display: grid;
  gap: 20px;
}

.icon-picker__grid {
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  gap: 10px;
  max-height: 390px;
  padding: 4px;
  overflow-y: auto;
}

.icon-picker__option {
  display: grid;
  aspect-ratio: 1;
  padding: 8px;
  background: #f7f8f9;
  border: 2px solid transparent;
  border-radius: 14px;
  cursor: pointer;
  place-items: center;
  transition:
    border-color 0.2s,
    background-color 0.2s,
    transform 0.2s;
}

.icon-picker__option:hover {
  background: var(--color-primary-soft);
  transform: translateY(-1px);
}

.icon-picker__option--selected {
  background: var(--color-primary-soft);
  border-color: var(--color-primary-active);
}

.icon-picker__state {
  display: grid;
  min-height: 220px;
  align-content: center;
  justify-items: center;
  gap: 14px;
  color: var(--color-text-secondary);
  text-align: center;
}

.icon-picker__state p {
  margin: 0;
}

.icon-picker__state--error {
  color: var(--color-danger);
}

.icon-picker__spinner {
  width: 30px;
  height: 30px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary-active);
  border-radius: 50%;
  animation: icon-picker-spin 0.8s linear infinite;
}

.icon-picker__actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

/* 未选择图标时使用与项目常规禁用按钮一致的中性灰，不保留品牌蓝色。 */
.icon-picker__confirm-button.t-button:disabled,
.icon-picker__confirm-button.t-button.t-is-disabled {
  color: #a9acb2;
  background: #f3f4f5;
  border-color: var(--color-border);
  opacity: 1;
}

/* 弹窗挂载到 body，通过唯一业务类限制圆角覆盖范围。 */
:global(.category-icon-picker-dialog.t-dialog) {
  border-radius: 18px;
}

@keyframes icon-picker-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
