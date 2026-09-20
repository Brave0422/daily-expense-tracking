<script setup lang="ts">
/**
 * @author Brave
 * @date 2026-09-20T15:25:44+08:00
 * @description 本地 Iconfont 语义包装，只暴露业务图标名并继承当前文字颜色。
 */

import { computed } from 'vue'

export type IconName = 'records' | 'statistics' | 'management'

interface Props {
  name: IconName
  size?: number
}

const props = withDefaults(defineProps<Props>(), {
  size: 24,
})

const iconClass = computed(() => `expense-icon--${props.name}`)
</script>

<template>
  <!-- 字形仅作装饰，图标语义由外层按钮或链接的 aria-label 提供 -->
  <span
    aria-hidden="true"
    class="expense-iconfont base-icon"
    :class="iconClass"
    :style="{ fontSize: `${props.size}px` }"
  />
</template>

<style scoped>
/* 图标尺寸由行内变量控制，颜色始终继承交互元素状态 */
.base-icon {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  color: inherit;
}
</style>
