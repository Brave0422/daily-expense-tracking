<script setup lang="ts">
/**
 * @author Brave
 * @date 2026-10-14T12:48:33+08:00
 * @description 左侧总额及ECharts饼图与右侧分类图例，用金额绘制全部扇区并按分类ID稳定配色。
 */
import { computed, ref } from 'vue'
import type { CategoryStatisticsResult } from '@/api/statistics.types'
import { formatAmount } from '@/utils/money'
import { getCategoryChartColor, getCategoryTooltip } from '../statistics-view.util'
import { useStatisticsChart } from '../composables/useStatisticsChart'
import { createCategoryProportionOption } from '../statistics-chart-options'
const props = defineProps<{ result: CategoryStatisticsResult }>()
const chartElement = ref<HTMLElement | null>(null)
const chartOption = computed(() => createCategoryProportionOption(props.result, chartElement.value))
const { showItemTooltip, clearItemTooltip } = useStatisticsChart(chartElement, chartOption)
</script>
<template>
  <div class="proportion-content">
    <div class="proportion-visual">
      <div class="proportion-total">
        <span>{{ props.result.type === 'expense' ? '总支出' : '总收入' }}</span>
        <strong :class="`amount-${props.result.type}`"
          >¥ {{ formatAmount(props.result.totalAmount) }}</strong
        >
      </div>
      <div class="proportion-chart-area">
        <div class="proportion-chart">
          <!-- ECharts负责实心扇区、原生高亮和Tooltip -->
          <div
            ref="chartElement"
            class="proportion-chart__canvas"
            role="img"
            aria-label="分类金额饼图"
          />
        </div>
      </div>
    </div>
    <div class="proportion-directory">
      <!-- 总额固定在左侧图表区域顶部，右侧图例独立滚动并与饼图保持相同顺序 -->
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
            <span class="proportion-legend__name" :title="item.name">{{ item.name }}</span>
            <span class="proportion-legend__percentage">{{ item.percentage }}%</span>
          </span>
        </li>
      </ul>
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
  grid-template-columns: minmax(145px, 1.25fr) minmax(0, 1fr);
  gap: 12px;
  min-height: 0;
  align-items: center;
  height: 100%;
}
.proportion-visual,
.proportion-directory {
  display: flex;
  flex-direction: column;
  align-self: stretch;
  min-height: 0;
  min-width: 0;
}
.proportion-directory {
  padding-top: 16px;
}
.proportion-chart-area {
  display: grid;
  flex: 1;
  min-height: 0;
  place-items: center;
}
.proportion-total {
  display: flex;
  flex: none;
  flex-direction: column;
  gap: 8px;
  padding: 24px 0 10px;
}
.proportion-total span {
  color: var(--color-text-secondary);
  font-size: 12px;
}
.proportion-total strong {
  font-size: clamp(23px, 2.1vw, 34px);
  overflow-wrap: anywhere;
  font-variant-numeric: tabular-nums;
  line-height: 1.25;
}
.proportion-legend {
  flex: 1;
  min-height: 0;
  padding: 0 4px 0 0;
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
.proportion-legend__percentage {
  flex: none;
  color: var(--color-text-secondary);
  font-size: 10px;
}
.proportion-chart {
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
</style>
