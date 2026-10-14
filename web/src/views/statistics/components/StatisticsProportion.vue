<script setup lang="ts">
/**
 * @author Brave
 * @date 2026-10-14T12:48:33+08:00
 * @description 分类图例与ECharts环形图，用金额绘制全部扇区并按分类ID稳定配色。
 */
import { computed, ref } from 'vue'
import type { CategoryStatisticsResult } from '@/api/statistics.types'
import { formatAmount } from '@/utils/money'
import { getCategoryChartColor, getCategoryTooltip, getCategoryPath } from '../statistics-view.util'
import { useStatisticsChart } from '../composables/useStatisticsChart'
import { createCategoryProportionOption } from '../statistics-chart-options'
const props = defineProps<{ result: CategoryStatisticsResult }>()
const chartElement = ref<HTMLElement | null>(null)
const chartOption = computed(() => createCategoryProportionOption(props.result, chartElement.value))
const { showItemTooltip, clearItemTooltip } = useStatisticsChart(chartElement, chartOption)
const amountFontSize = computed(() => {
  const length = formatAmount(props.result.totalAmount).length + 2
  // cqw 随实际环形图容器缩放，窄卡片上避免货币符号和金额挤到不同行。
  return `clamp(9px, ${60 / (length * 0.7)}cqw, 19px)`
})
</script>
<template>
  <div class="proportion-content">
    <!-- 图例独立滚动，顺序及集合与后端和环形图完全一致 -->
    <ul class="proportion-legend" aria-label="分类占比图例">
      <li v-for="(item, index) in props.result.items" :key="item.categoryId">
        <span
          tabindex="0"
          class="proportion-legend__item"
          :aria-label="getCategoryTooltip(item)"
          @mouseenter="showItemTooltip(index)"
          @mouseleave="clearItemTooltip"
          @focus="showItemTooltip(index)"
          @blur="clearItemTooltip"
          @keydown.esc="clearItemTooltip"
        >
          <i
            :style="{ backgroundColor: getCategoryChartColor(item.categoryId) }"
            aria-hidden="true"
          />
          <span class="proportion-legend__name" :title="getCategoryPath(item)"
            >{{ item.name }}<small v-if="item.parent">{{ item.parent.name }}</small></span
          >
          <span class="proportion-legend__percentage">{{ item.percentage }}%</span>
        </span>
      </li>
    </ul>
    <div class="proportion-chart">
      <!-- ECharts负责扇区、原生高亮和Tooltip；中心金额保留精确字符串展示 -->
      <div
        ref="chartElement"
        class="proportion-chart__canvas"
        role="img"
        aria-label="分类金额环形图"
      />
      <div class="proportion-chart__center">
        <span>{{ props.result.type === 'expense' ? '总支出' : '总收入' }}</span>
        <strong :class="`amount-${props.result.type}`" :style="{ fontSize: amountFontSize }"
          >¥ {{ formatAmount(props.result.totalAmount) }}</strong
        >
      </div>
    </div>
  </div>
</template>
<style scoped>
.amount-expense {
  color: #249e68;
}
.amount-income {
  color: #e34d59;
}
.proportion-content {
  flex: 1;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(145px, 1.25fr);
  gap: 12px;
  min-height: 0;
  align-items: center;
  height: 100%;
}
.proportion-legend {
  align-self: stretch;
  min-height: 0;
  padding: 12px 4px 0 0;
  margin: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  list-style: none;
}
.proportion-legend__item {
  display: flex;
  gap: 7px;
  align-items: center;
  min-width: 0;
  padding: 12px 0;
  border-bottom: 1px solid #f1f2f4;
}
.proportion-legend__item i {
  width: 7px;
  height: 7px;
  flex: none;
  border-radius: 50%;
}
.proportion-legend__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}
.proportion-legend__name small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 10px;
  color: var(--color-text-secondary);
  margin-top: 3px;
}
.proportion-legend__percentage {
  flex: none;
  color: var(--color-text-secondary);
  font-size: 10px;
}
.proportion-chart {
  container-type: inline-size;
  aspect-ratio: 1;
  width: 100%;
  position: relative;
  min-width: 0;
}
.proportion-chart__canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.proportion-chart__center {
  position: absolute;
  inset: 28% 20%;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.proportion-chart__center span {
  color: var(--color-text-secondary);
  font-size: 11px;
}
.proportion-chart__center strong {
  max-width: 100%;
  text-align: center;
  overflow-wrap: anywhere;
  font-variant-numeric: tabular-nums;
  line-height: 1.4;
}
</style>
