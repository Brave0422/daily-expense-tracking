<script setup lang="ts">
/**
 * @author Brave
 * @date 2026-10-14T12:48:33+08:00
 * @description 单个统计卡片的独立筛选、首次加载、刷新失败、空态与数据区域。
 */
import { computed, ref } from 'vue'
import {
  DatePickerPanel as TDatePickerPanel,
  Loading as TLoading,
  Popup as TPopup,
} from 'tdesign-vue-next'
import type { StatisticsPanelKind, StatisticsPeriodType } from '@/api/statistics.types'
import BaseIcon from '@/components/base/BaseIcon.vue'
import BaseTooltip from '@/components/base/BaseTooltip.vue'
import { formatAmount } from '@/utils/money'
import { useStatistics } from '../composables/useStatistics'
import { formatStatisticsPeriod, isValidStatisticsPeriod } from '../statistics-view.util'
import StatisticsRanking from './StatisticsRanking.vue'
import StatisticsProportion from './StatisticsProportion.vue'
import StatisticsTrend from './StatisticsTrend.vue'
const props = defineProps<{ kind: StatisticsPanelKind; title: string; eyebrow: string }>()
const {
  type,
  categoryLevel,
  periodType,
  period,
  order,
  result,
  categoryResult,
  trendResult,
  isLoading,
  errorMessage,
  refresh,
  updateType,
  updateCategoryLevel,
  updatePeriodType,
  updatePeriod,
  toggleOrder,
} = useStatistics(props.kind)
const isDatePickerOpen = ref(false)
const periodLabel = computed(() => formatStatisticsPeriod(period.value))
const periodSwitchLabel = computed(() =>
  periodType.value === 'month' ? '切换到年统计' : '切换到月统计',
)
const datePickerLabel = computed(() => (periodType.value === 'month' ? '选择月份' : '选择年份'))
const sortLabel = computed(() =>
  order.value === 'desc' ? '金额降序，点击切换为升序' : '金额升序，点击切换为降序',
)
const resultContext = computed(() => {
  const data = result.value
  if (!data) return ''
  const level =
    'categoryLevel' in data ? ` · ${data.categoryLevel === 1 ? '一级' : '二级'}分类` : ''
  const sorting = 'order' in data ? ` · ${data.order === 'desc' ? '降序' : '升序'}` : ''
  return `${formatStatisticsPeriod(data.period)} · ${data.type === 'expense' ? '支出' : '收入'}${level}${sorting}`
})
const emptyLabel = computed(
  () => `所选周期暂无有效${result.value?.type === 'income' ? '收入' : '支出'}记录`,
)
/**
 * 确认单选日期后关闭面板；相同周期由查询状态忽略。
 * @param value 日期组件返回的 YYYY-MM 或 YYYY
 * @returns 无返回值
 */
function handlePeriodChange(value: unknown): void {
  if (typeof value !== 'string' || !isValidStatisticsPeriod(value, periodType.value)) return
  isDatePickerOpen.value = false
  updatePeriod(value)
}
/**
 * 切换周期时关闭旧日期面板，避免保留不匹配的选择粒度。
 * @param value 月或年
 * @returns 无返回值
 */
function handlePeriodTypeChange(value: StatisticsPeriodType): void {
  if (value === periodType.value) return
  isDatePickerOpen.value = false
  updatePeriodType(value)
}
/**
 * 限定可选日期及比较边界，避免客户端选中服务端无法查询的周期。
 * @param date 日期组件传入的日期、时间戳或字符串
 * @returns 日期不可用时为 true
 */
function disableDate(date: string | number | Date): boolean {
  const value = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(value.getTime())) return true
  const year = String(value.getFullYear()).padStart(4, '0')
  const formatted =
    periodType.value === 'month' ? `${year}-${String(value.getMonth() + 1).padStart(2, '0')}` : year
  return !isValidStatisticsPeriod(formatted, periodType.value)
}
</script>
<template>
  <section
    class="statistics-panel"
    :aria-labelledby="`statistics-${props.kind}-title`"
    :data-panel="props.kind"
  >
    <header class="statistics-panel__header">
      <span class="statistics-panel__eyebrow">{{ props.eyebrow }}</span>
      <h2 :id="`statistics-${props.kind}-title`">{{ props.title }}</h2>
    </header>
    <!-- 条件只驱动当前卡片；控件保持可见，列表和图例在下方独立滚动 -->
    <div class="statistics-filters">
      <div class="statistics-segment" role="group" :aria-label="`${props.title}收支类型`">
        <button type="button" :aria-pressed="type === 'expense'" @click="updateType('expense')">
          支出
        </button>
        <button type="button" :aria-pressed="type === 'income'" @click="updateType('income')">
          收入
        </button>
      </div>
      <div
        v-if="props.kind !== 'trend'"
        class="statistics-segment"
        role="group"
        :aria-label="`${props.title}分类层级`"
      >
        <button type="button" :aria-pressed="categoryLevel === 1" @click="updateCategoryLevel(1)">
          一级
        </button>
        <BaseTooltip :content="type === 'income' ? '收入只支持一级分类' : '按二级分类汇总'">
          <span :tabindex="type === 'income' ? 0 : undefined">
            <button
              type="button"
              :aria-pressed="categoryLevel === 2"
              :disabled="type === 'income'"
              @click="updateCategoryLevel(2)"
            >
              二级
            </button>
          </span>
        </BaseTooltip>
      </div>
      <BaseTooltip :content="periodSwitchLabel">
        <button
          type="button"
          class="statistics-icon-button statistics-period-toggle"
          :aria-label="periodSwitchLabel"
          @click="handlePeriodTypeChange(periodType === 'month' ? 'year' : 'month')"
        >
          <BaseIcon
            :name="periodType === 'month' ? 'yearlySummary' : 'monthlySummary'"
            :size="20"
          />
        </button>
      </BaseTooltip>
      <TPopup v-model:visible="isDatePickerOpen" trigger="click" placement="bottom-left">
        <BaseTooltip :content="datePickerLabel">
          <button
            type="button"
            class="statistics-icon-button statistics-period"
            :aria-label="`选择${props.title}${periodType === 'month' ? '月份' : '年份'}，当前${periodLabel}`"
            :aria-expanded="isDatePickerOpen"
            @keydown.esc="isDatePickerOpen = false"
          >
            <BaseIcon name="calendar" :size="20" />
          </button>
        </BaseTooltip>
        <template #content>
          <TDatePickerPanel
            :key="periodType"
            :value="period"
            :mode="periodType"
            :format="periodType === 'month' ? 'YYYY-MM' : 'YYYY'"
            :disable-date="disableDate"
            @change="handlePeriodChange"
          />
        </template>
      </TPopup>
      <span v-if="props.kind === 'ranking'" class="statistics-sort">
        <BaseTooltip :content="sortLabel">
          <button
            type="button"
            class="statistics-sort__button"
            :aria-label="sortLabel"
            @click="toggleOrder"
          >
            <BaseIcon :name="order === 'desc' ? 'sortDescending' : 'sortAscending'" :size="20" />
          </button>
        </BaseTooltip>
      </span>
    </div>
    <!-- 首次加载不展示伪造金额；刷新时旧结果保留自己的日期、类型与层级 -->
    <div
      v-if="result && (isLoading || errorMessage)"
      class="statistics-status"
      :class="{ 'statistics-status--error': errorMessage }"
      role="status"
    >
      <TLoading v-if="isLoading" size="small" />
      <span
        >{{ isLoading ? '刷新中，显示上次结果' : `刷新失败，显示上次结果：${errorMessage}`
        }}<small>{{ resultContext }}</small></span
      >
      <button v-if="errorMessage" type="button" @click="refresh">重新加载</button>
    </div>
    <div class="statistics-panel__body" :aria-busy="isLoading">
      <div v-if="!result && isLoading" class="statistics-state" role="status">
        <TLoading size="small" />
        <p>正在加载{{ props.title }}…</p>
        <div class="statistics-skeleton" aria-hidden="true"><span /><span /><span /></div>
      </div>
      <div
        v-else-if="!result && errorMessage"
        class="statistics-state statistics-state--error"
        role="alert"
      >
        <p>{{ errorMessage }}</p>
        <button type="button" @click="refresh">重新加载</button>
      </div>
      <template v-else-if="result">
        <div class="statistics-summary">
          <span>{{ resultContext }}</span
          ><span>{{ result.transactionCount }} 笔</span>
        </div>
        <StatisticsTrend v-if="trendResult" :result="trendResult" />
        <template v-else-if="categoryResult">
          <div
            v-if="props.kind === 'ranking' || categoryResult.items.length === 0"
            class="statistics-total"
          >
            <span>{{ categoryResult.type === 'expense' ? '总支出' : '总收入' }}</span>
            <strong :class="`amount-${categoryResult.type}`"
              >¥ {{ formatAmount(categoryResult.totalAmount) }}</strong
            >
          </div>
          <div v-if="categoryResult.items.length === 0" class="statistics-state">
            <BaseIcon name="emptyData" :size="88" />
            <p>{{ emptyLabel }}</p>
          </div>
          <StatisticsRanking v-else-if="props.kind === 'ranking'" :result="categoryResult" />
          <StatisticsProportion v-else :result="categoryResult" />
        </template>
      </template>
    </div>
  </section>
</template>
<style scoped>
.amount-expense {
  color: #249e68;
}
.amount-income {
  color: #e34d59;
}
.statistics-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 0;
  min-height: 0;
  padding: 24px;
  background: var(--color-surface);
  border: 1px solid rgb(230 232 236 / 80%);
  border-radius: var(--radius-card);
  box-shadow: 0 8px 30px rgb(32 33 36 / 4%);
  overflow: hidden;
}
.statistics-panel__eyebrow {
  color: #a48f00;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.16em;
}
.statistics-panel__header h2 {
  margin: 7px 0 22px;
  font-size: 21px;
}
.statistics-filters {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 9px 8px;
  flex: none;
  padding-bottom: 19px;
  border-bottom: 1px solid #edf0f3;
}
.statistics-segment {
  display: inline-flex;
  flex: none;
  height: 38px;
  align-items: center;
  padding: 3px;
  background: #f3f4f6;
  border-radius: 9px;
}
.statistics-segment button {
  display: inline-flex;
  height: 32px;
  align-items: center;
  justify-content: center;
  padding: 0 9px;
  color: var(--color-text-secondary);
  border: 0;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
}
.statistics-segment button[aria-pressed='true'] {
  background: var(--color-primary);
  color: var(--color-text);
  font-weight: 600;
}
.statistics-segment button:disabled {
  cursor: not-allowed;
  color: #b7bbc3;
}
.statistics-icon-button {
  display: grid;
  width: 38px;
  height: 38px;
  padding: 0;
  place-items: center;
  color: var(--color-text);
  background: var(--color-primary-soft);
  border: 1px solid var(--color-primary);
  border-radius: 9px;
  cursor: pointer;
  transition: background 0.15s;
}
.statistics-icon-button:is(:hover, :focus-visible) {
  background: var(--color-primary);
}
.statistics-sort {
  margin-left: auto;
}
.statistics-sort__button {
  display: grid;
  width: 34px;
  height: 34px;
  padding: 0;
  place-items: center;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  color: var(--color-text-secondary);
  font-size: 12px;
}
.statistics-panel button:focus-visible,
.statistics-panel [tabindex='0']:focus-visible {
  outline: 2px solid var(--color-primary-active);
  outline-offset: 2px;
}
.statistics-status {
  display: flex;
  flex: none;
  align-items: center;
  gap: 7px;
  padding: 10px;
  margin-top: 12px;
  border-radius: 8px;
  color: var(--color-text-secondary);
  background: #fff9dc;
  font-size: 11px;
  line-height: 1.6;
}
.statistics-status > span {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}
.statistics-status small {
  display: block;
}
.statistics-status--error {
  background: #fff1f0;
  color: var(--color-danger);
}
.statistics-status button,
.statistics-state button {
  flex: none;
  padding: 6px 9px;
  border: 1px solid var(--color-border);
  border-radius: 7px;
  background: white;
  cursor: pointer;
  font-size: 12px;
}
.statistics-panel__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}
.statistics-summary {
  display: flex;
  flex: none;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
  padding-top: 16px;
  color: #9398a1;
  font-size: 10px;
  line-height: 1.5;
}
.statistics-summary span:first-child {
  min-width: 0;
  overflow-wrap: anywhere;
}
.statistics-summary span:last-child {
  flex: none;
}
.statistics-total {
  display: flex;
  gap: 10px;
  align-items: baseline;
  justify-content: space-between;
  padding: 17px 0 8px;
}
.statistics-total > span {
  flex: none;
  color: var(--color-text-secondary);
  font-size: 12px;
}
.statistics-total strong {
  min-width: 0;
  font-size: 18px;
  overflow-wrap: anywhere;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.statistics-state {
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 10px;
  min-height: 0;
  color: #9a9ea6;
  text-align: center;
  font-size: 12px;
}
.statistics-state p {
  margin: 0;
  overflow-wrap: anywhere;
  line-height: 1.6;
}
.statistics-state--error {
  color: var(--color-danger);
}
.statistics-skeleton {
  display: grid;
  width: 85%;
  gap: 18px;
  margin-top: 20px;
}
.statistics-skeleton span {
  height: 30px;
  border-radius: 7px;
  background: #f1f3f5;
}
</style>
