<script setup lang="ts">
/**
 * @author Brave
 * @date 2026-09-26T16:08:48+08:00
 * @description 分类图标渲染组件，通过 CSS 变量应用后端返回的最终背景色。
 */

import { computed } from 'vue'

interface Props {
  backgroundColor: string
  iconKey: string
  size?: number
}

const props = withDefaults(defineProps<Props>(), {
  size: 36,
})

const iconStyle = computed(() => ({
  '--category-icon-background': props.backgroundColor,
  width: `${props.size}px`,
  height: `${props.size}px`,
}))
</script>

<template>
  <svg aria-hidden="true" class="category-icon" focusable="false" :style="iconStyle">
    <use :href="`#${props.iconKey}`" />
  </svg>
</template>

<style scoped>
.category-icon {
  display: block;
  flex: none;
  overflow: hidden;
}
</style>
