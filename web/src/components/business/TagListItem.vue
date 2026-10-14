<script setup lang="ts">
/**
 * @author Brave
 * @date 2026-09-27T18:34:34+08:00
 * @description 共用标签展示项，负责名称截断提示、可选编辑入口和独立移除操作。
 */

import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Tooltip as TTooltip } from 'tdesign-vue-next'

import type { UserTag } from '@/api/tag.types'
import BaseIcon from '@/components/base/BaseIcon.vue'

interface Props {
  tag: UserTag
  editable?: boolean
  disabled?: boolean
  maxWidth?: number
}

const props = withDefaults(defineProps<Props>(), {
  editable: true,
  disabled: false,
  maxWidth: 300,
})
const emit = defineEmits<{
  delete: [tag: UserTag]
  edit: [tag: UserTag]
}>()

const tagNameElement = ref<HTMLElement | null>(null)
const isNameOverflowing = ref(false)
const tagLabel = computed(() => `${props.tag.name}${props.tag.archived ? '（已归档）' : ''}`)
let resizeObserver: ResizeObserver | null = null

/** 根据实际渲染宽度判断标签名称是否需要完整内容提示。 */
function updateNameOverflow(): void {
  const element = tagNameElement.value
  isNameOverflowing.value = Boolean(element && element.scrollWidth > element.clientWidth)
}

onMounted(async () => {
  await nextTick()
  updateNameOverflow()

  if (typeof ResizeObserver !== 'undefined' && tagNameElement.value) {
    resizeObserver = new ResizeObserver(updateNameOverflow)
    resizeObserver.observe(tagNameElement.value)
  }
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
})

watch(tagLabel, async () => {
  await nextTick()
  updateNameOverflow()
})
</script>

<template>
  <li
    class="tag-list-item"
    :class="{ 'tag-list-item--disabled': props.disabled }"
    :style="{ maxWidth: `${props.maxWidth}px` }"
  >
    <component
      :is="props.editable ? 'button' : 'span'"
      :aria-label="props.editable ? `编辑标签 ${props.tag.name}` : undefined"
      class="tag-list-item__content"
      :class="{ 'tag-list-item__content--editable': props.editable }"
      :type="props.editable ? 'button' : undefined"
      :disabled="props.editable ? props.disabled : undefined"
      @click="props.editable && !props.disabled && emit('edit', props.tag)"
    >
      <TTooltip :content="tagLabel" :disabled="!isNameOverflowing" placement="top" theme="light">
        <span ref="tagNameElement" class="tag-list-item__name">{{ tagLabel }}</span>
      </TTooltip>
    </component>

    <button
      :aria-label="`删除标签 ${props.tag.name}`"
      class="tag-list-item__delete"
      title="删除"
      type="button"
      :disabled="props.disabled"
      @click.stop="emit('delete', props.tag)"
    >
      <BaseIcon name="tagClose" :size="18" />
    </button>
  </li>
</template>

<style scoped>
.tag-list-item {
  display: flex;
  width: fit-content;
  max-width: 300px;
  min-width: 0;
  min-height: 38px;
  align-items: center;
  background: #f8f9fa;
  border: 1px solid var(--color-border);
  border-radius: 11px;
  transition:
    background-color 0.2s,
    border-color 0.2s,
    box-shadow 0.2s;
}

.tag-list-item:not(.tag-list-item--disabled):hover,
.tag-list-item:not(.tag-list-item--disabled):focus-within {
  background: var(--color-primary-soft);
  border-color: var(--color-primary-active);
  box-shadow: 0 4px 12px rgb(32 33 36 / 8%);
}

.tag-list-item__content {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  align-self: stretch;
  padding: 8px 5px 8px 12px;
  color: var(--color-text);
  text-align: left;
  background: transparent;
  border: 0;
}

.tag-list-item__content--editable {
  cursor: pointer;
}

.tag-list-item__name {
  display: block;
  min-width: 0;
  overflow: hidden;
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tag-list-item__delete {
  display: grid;
  width: 27px;
  height: 27px;
  flex: none;
  padding: 0;
  margin-right: 1px;
  color: var(--color-danger);
  background: transparent;
  border: 0;
  border-radius: 50%;
  cursor: pointer;
  place-items: center;
}

.tag-list-item button:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}
</style>
