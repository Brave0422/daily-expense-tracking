<script setup lang="ts">
/**
 * @author Brave
 * @date 2026-10-14T12:48:33+08:00
 * @description 收支总额、整期比较及ECharts绘制的完整自然周期响应式柱状图。
 */
import { computed, ref } from 'vue'
import type { TransactionTrendResult } from '@/api/statistics.types'
import { formatAmount } from '@/utils/money'
import { useStatisticsChart } from '../composables/useStatisticsChart'
import { createTransactionTrendOption } from '../statistics-chart-options'
const props = defineProps<{ result: TransactionTrendResult }>()
const chartElement = ref<HTMLElement | null>(null)
const chartOption = computed(() => createTransactionTrendOption(props.result, chartElement.value))
useStatisticsChart(chartElement, chartOption)
const comparison = computed(() => {
  const prefix = props.result.periodType === 'month' ? '较上月' : '较上年'
  const status = props.result.changeStatus
  if (status === 'new') return `${prefix}新增`
  if (status === 'unchanged') return `${prefix}持平 0.00%`
  return `${prefix} ${status === 'increase' ? '↑' : '↓'} ${(props.result.changeRate ?? '0.00').replace(/^-/, '')}%`
})
const comparisonClass = computed(() => {
  if (props.result.changeStatus === 'unchanged') return ''
  // 按 PRD 的收支惯例配色；支出增加为绿色，收入增加为红色。
  const isIncreasing = props.result.changeStatus !== 'decrease'
  const isGreen = props.result.type === 'expense' ? isIncreasing : !isIncreasing
  return isGreen ? 'trend-comparison--green' : 'trend-comparison--red'
})
</script>
<template>
  <div class="trend-content">
    <!-- 比较始终使用后端状态，下降只保留箭头，不重复显示负号 -->
    <div class="trend-overview">
      <div class="trend-overview__total">
        <span>{{ props.result.type === 'expense' ? '支出总额' : '收入总额' }}</span>
        <strong :class="`amount-${props.result.type}`"
          >¥ {{ formatAmount(props.result.totalAmount) }}</strong
        >
      </div>
      <span
        class="trend-comparison"
        :class="comparisonClass"
        :title="`${props.result.previousPeriod}：¥ ${formatAmount(props.result.previousTotalAmount)}`"
        >{{ comparison }}</span
      >
    </div>
    <p v-if="props.result.transactionCount === 0" class="trend-empty">所选周期暂无有效记录</p>
    <!-- 传入全部时间点，由ECharts处理柱子、坐标轴、网格线及轴Tooltip -->
    <div ref="chartElement" class="trend-chart" role="img" aria-label="收支金额柱状图" />
  </div>
</template>
<style scoped>
.amount-expense {
  color: #249e68;
}
.amount-income {
  color: #e34d59;
}
.trend-content {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
}
.trend-overview {
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 14px;
  margin-top: 24px;
}
.trend-overview__total {
  min-width: 0;
  max-width: 100%;
}
.trend-overview__total > span {
  font-size: 12px;
  color: var(--color-text-secondary);
}
.trend-overview__total strong {
  display: block;
  margin-top: 8px;
  font-size: clamp(23px, 2.1vw, 34px);
  line-height: 1.25;
  overflow-wrap: anywhere;
  font-variant-numeric: tabular-nums;
}
.trend-comparison {
  margin-bottom: 4px;
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.trend-comparison--green {
  color: #249e68;
}
.trend-comparison--red {
  color: #e34d59;
}
.trend-empty {
  color: var(--color-text-secondary);
  font-size: 12px;
  margin: 15px 0 0;
}
.trend-chart {
  display: block;
  width: 100%;
  min-height: 160px;
  flex: 1;
}
</style>
