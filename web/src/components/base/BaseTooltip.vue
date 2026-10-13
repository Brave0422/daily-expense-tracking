<script setup lang="ts">
/**
 * @author Brave
 * @date 2026-10-10T21:12:17+08:00
 * @description TDesign 提示包装，支持鼠标和键盘触发及仅在文本截断时显示完整内容。
 */

import { computed, ref } from 'vue'
import { Tooltip as TTooltip } from 'tdesign-vue-next'

defineOptions({ inheritAttrs: false })
const props = withDefaults(
  defineProps<{ content: string; block?: boolean; overflowOnly?: boolean }>(),
  { block: false, overflowOnly: false },
)
const triggerElement = ref<HTMLElement | null>(null)
const isHovered = ref(false)
const isFocused = ref(false)
const isOverflowing = ref(false)
const isVisible = computed(
  () => (isHovered.value || isFocused.value) && (!props.overflowOnly || isOverflowing.value),
)

/** 每次交互时读取实际文本宽度，布局或内容变化后仍只提示被截断的内容。 */
function updateOverflow(): void {
  const element = triggerElement.value?.firstElementChild
  isOverflowing.value = Boolean(element && element.scrollWidth > element.clientWidth)
}

function handleMouseEnter(): void {
  updateOverflow()
  isHovered.value = true
}

function handleFocusIn(): void {
  updateOverflow()
  isFocused.value = true
}

function handleEscape(): void {
  isHovered.value = false
  isFocused.value = false
}
</script>

<template>
  <TTooltip
    v-bind="$attrs"
    :content="props.content"
    :visible="isVisible"
    :overlay-inner-style="{ maxWidth: '360px', whiteSpace: 'normal', overflowWrap: 'anywhere' }"
  >
    <span
      ref="triggerElement"
      class="base-tooltip"
      :class="{ 'base-tooltip--block': props.block }"
      @mouseenter="handleMouseEnter"
      @mouseleave="isHovered = false"
      @focusin="handleFocusIn"
      @focusout="isFocused = false"
      @keydown.esc="handleEscape"
    >
      <slot />
    </span>
  </TTooltip>
</template>

<style scoped>
.base-tooltip {
  display: inline-flex;
  min-width: 0;
  max-width: 100%;
  vertical-align: middle;
}
.base-tooltip--block {
  display: block;
  width: 100%;
}
</style>
