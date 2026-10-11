<script setup lang="ts">
/**
 * @author Brave
 * @date 2026-10-10T21:12:17+08:00
 * @description TDesign 提示包装，同时支持鼠标悬停与键盘聚焦查看完整内容。
 */

import { computed, ref } from 'vue'
import { Tooltip as TTooltip } from 'tdesign-vue-next'

defineOptions({ inheritAttrs: false })
const props = withDefaults(defineProps<{ content: string; block?: boolean }>(), { block: false })
const isHovered = ref(false)
const isFocused = ref(false)
const isVisible = computed(() => isHovered.value || isFocused.value)

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
      class="base-tooltip"
      :class="{ 'base-tooltip--block': props.block }"
      @mouseenter="isHovered = true"
      @mouseleave="isHovered = false"
      @focusin="isFocused = true"
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
