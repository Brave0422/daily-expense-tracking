<script setup lang="ts">
/**
 * @author Brave
 * @date 2026-09-20T15:25:44+08:00
 * @description Iconfont Symbol 语义包装，将稳定业务名称映射为图标库的 Symbol ID。
 */

import { computed } from 'vue'

export type IconName =
  'records' | 'statistics' | 'management' | 'changePassword' | 'logout' | 'hide' | 'show'

const ICON_SYMBOL_ID_BY_NAME: Readonly<Record<IconName, string>> = {
  records: 'icon-home',
  statistics: 'icon-pie-chart',
  management: 'icon-wrench',
  changePassword: 'icon-change-pwd',
  logout: 'icon-exit',
  hide: 'icon-hide',
  show: 'icon-show',
}

interface Props {
  name: IconName
  size?: number
}

const props = withDefaults(defineProps<Props>(), {
  size: 24,
})

const symbolHref = computed(() => `#${ICON_SYMBOL_ID_BY_NAME[props.name]}`)
</script>

<template>
  <!-- Symbol 仅作装饰，图标语义由外层按钮或链接的 aria-label 提供 -->
  <svg
    aria-hidden="true"
    class="base-icon"
    focusable="false"
    :style="{ width: `${props.size}px`, height: `${props.size}px` }"
  >
    <use :href="symbolHref" />
  </svg>
</template>

<style scoped>
/* 图标尺寸由行内变量控制，颜色始终继承交互元素状态 */
.base-icon {
  display: inline-block;
  flex: none;
  color: inherit;
  fill: currentcolor;
  overflow: hidden;
}
</style>
