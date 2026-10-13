<script setup lang="ts">
/**
 * @author Brave
 * @date 2026-09-20T15:28:28+08:00
 * @description 账单列表页，新增编辑流水、切换日明细与月汇总，展示周期合计及完整请求状态。
 */

import { computed, ref } from 'vue'
import {
  DatePickerPanel as TDatePickerPanel,
  Loading as TLoading,
  Popup as TPopup,
} from 'tdesign-vue-next'
import BaseIcon from '@/components/base/BaseIcon.vue'
import BaseTooltip from '@/components/base/BaseTooltip.vue'
import type { DailyTransactionItem } from '@/api/transaction.types'
import { formatAmount, formatBalance, isZeroAmount } from '@/utils/money'
import TransactionDailyList from './components/TransactionDailyList.vue'
import TransactionFormDialog from './components/TransactionFormDialog.vue'
import TransactionFilters from './components/TransactionFilters.vue'
import TransactionMonthlyList from './components/TransactionMonthlyList.vue'
import { useTransactions } from './composables/useTransactions'

const {
  mode,
  period,
  filters,
  result,
  dailyResult,
  monthlyResult,
  resultType,
  isLoading,
  isRefreshing,
  errorMessage,
  amountError,
  hasCurrentPeriod,
  hasPeriodTransactions,
  hasFilters,
  isResultStale,
  refresh,
  updateFilters,
  updatePeriod,
  toggleMode,
  resetFilters,
} = useTransactions()
const isDatePickerOpen = ref(false)
const isFormDialogOpen = ref(false)
const editingTransaction = ref<DailyTransactionItem | null>(null)
const tagsRevision = ref(0)

function formatPeriod(period: string): string {
  const [year, monthNumber] = period.split('-')
  return monthNumber ? `${year}年${Number(monthNumber)}月` : `${year}年`
}
const periodLabel = computed(() =>
  formatPeriod(hasCurrentPeriod.value && result.value ? result.value.period : period.value),
)
const periodPrefix = computed(() => (mode.value === 'daily' ? '本月' : '本年'))
const switchLabel = computed(() => (mode.value === 'daily' ? '切换到月汇总' : '切换到日明细'))
const dateUnit = computed(() => (mode.value === 'daily' ? '月份' : '年份'))
const displayedMode = computed(() =>
  dailyResult.value ? 'daily' : monthlyResult.value ? 'monthly' : mode.value,
)
const listLabel = computed(() => (displayedMode.value === 'daily' ? '日明细' : '月汇总'))
const recordCount = computed(
  () => dailyResult.value?.days.reduce((count, day) => count + day.transactions.length, 0) ?? 0,
)
const balanceClass = computed(() => {
  const balance = result.value?.totals.balance
  if (!balance || isZeroAmount(balance)) return 'amount-neutral'
  return balance.startsWith('-') ? 'amount-expense' : 'amount-income'
})
const resultStatus = computed(() => {
  if (isRefreshing.value) {
    return result.value && !hasCurrentPeriod.value
      ? `正在加载${periodLabel.value}，下方暂时显示${formatPeriod(result.value.period)}的上次结果`
      : '正在刷新账单与筛选合计…'
  }
  if (errorMessage.value)
    return `加载失败：${errorMessage.value}${result.value ? `；下方保留${formatPeriod(result.value.period)}的上次成功结果` : ''}`
  if (amountError.value)
    return `金额条件有误，查询已暂停${result.value ? `；下方保留${formatPeriod(result.value.period)}的上次成功结果` : ''}`
  if (isResultStale.value) return '筛选条件尚未应用，下方显示上次结果'
  return ''
})
function handlePeriodChange(value: unknown): void {
  if (typeof value === 'string') {
    updatePeriod(value)
    isDatePickerOpen.value = false
  }
}
function handleModeChange(): void {
  isDatePickerOpen.value = false
  toggleMode()
}
/**
 * 打开默认新增表单，并清理上一次的编辑目标。
 * @returns 无返回值
 */
function handleCreateTransaction(): void {
  editingTransaction.value = null
  isFormDialogOpen.value = true
}
/**
 * 以点击记录作为编辑目标，表单内部建立独立草稿。
 * @param transaction - 当前用户点击的日明细记录
 * @returns 无返回值
 */
function handleEditTransaction(transaction: DailyTransactionItem): void {
  editingTransaction.value = transaction
  isFormDialogOpen.value = true
}
/**
 * 同步弹窗状态，关闭时清空编辑目标，下一次打开不保留旧草稿。
 * @param visible - 弹窗期望的显示状态；提交期间由表单阻止关闭
 * @returns 无返回值
 */
function handleFormVisibleChange(visible: boolean): void {
  isFormDialogOpen.value = visible
  if (!visible) editingTransaction.value = null
}

/** 流水提交成功后，刷新已保存的标签筛选选项及账单。 */
async function handleFormSuccess(): Promise<void> {
  tagsRevision.value += 1
  await refresh()
}
</script>

<template>
  <div class="transactions-view">
    <TransactionFilters
      :mode="mode"
      :filters="filters"
      :totals="result?.filterTotals ?? null"
      :amount-error="amountError"
      :is-refreshing="isRefreshing"
      :is-stale="isResultStale"
      :has-failed="Boolean(errorMessage)"
      :has-filters="hasFilters"
      :tags-revision="tagsRevision"
      @update:filters="updateFilters"
      @search="refresh"
      @reset="resetFilters"
    />
    <section class="transaction-card" :aria-label="`账单${listLabel}`">
      <!-- 周期总览固定展示，筛选只改变列表与筛选合计 -->
      <header class="transaction-overview">
        <div class="transaction-overview__period">
          <span class="transaction-overview__label">账单周期</span>
          <h2>{{ periodLabel }}</h2>
        </div>
        <dl class="transaction-overview__totals" :aria-busy="isLoading && !hasCurrentPeriod">
          <div class="transaction-overview__expense">
            <dt>{{ periodPrefix }}支出</dt>
            <dd class="amount-expense" data-testid="period-expense">
              {{ hasCurrentPeriod && result ? `¥ ${formatAmount(result.totals.expense)}` : '—' }}
            </dd>
          </div>
          <div>
            <dt>{{ periodPrefix }}收入</dt>
            <dd class="amount-income" data-testid="period-income">
              {{ hasCurrentPeriod && result ? `¥ ${formatAmount(result.totals.income)}` : '—' }}
            </dd>
          </div>
          <div>
            <dt>{{ periodPrefix }}结余</dt>
            <dd :class="balanceClass" data-testid="period-balance">
              {{ hasCurrentPeriod && result ? formatBalance(result.totals.balance) : '—' }}
            </dd>
          </div>
        </dl>
        <div class="transaction-overview__actions">
          <BaseTooltip :content="switchLabel"
            ><button
              class="transaction-button transaction-overview__icon"
              type="button"
              :aria-label="switchLabel"
              @click="handleModeChange"
            >
              <BaseIcon
                :name="mode === 'daily' ? 'monthlySummary' : 'dailyDetails'"
                :size="20"
              /></button
          ></BaseTooltip>
          <TPopup v-model:visible="isDatePickerOpen" trigger="click" placement="bottom-right">
            <BaseTooltip :content="`选择${dateUnit}`">
              <button
                class="transaction-button transaction-overview__icon"
                type="button"
                :aria-label="`选择账单${dateUnit}，当前${periodLabel}`"
                :aria-expanded="isDatePickerOpen"
                @keydown.esc="isDatePickerOpen = false"
              >
                <BaseIcon name="calendar" :size="20" />
              </button>
            </BaseTooltip>
            <template #content>
              <TDatePickerPanel
                :key="mode"
                :value="period"
                :mode="mode === 'daily' ? 'month' : 'year'"
                :format="mode === 'daily' ? 'YYYY-MM' : 'YYYY'"
                @change="handlePeriodChange"
              />
            </template>
          </TPopup>
          <BaseTooltip content="新增流水"
            ><button
              class="transaction-button transaction-overview__icon transaction-overview__add"
              type="button"
              aria-label="新增流水"
              @click="handleCreateTransaction"
            >
              <BaseIcon name="add" :size="20" /></button
          ></BaseTooltip>
        </div>
      </header>
      <div class="transaction-card__list-heading">
        <h2>{{ listLabel }}</h2>
        <span v-if="dailyResult">按发生日期倒序 · 共 {{ recordCount }} 笔记录</span>
        <span v-else-if="monthlyResult"
          >按月份倒序 · 共 {{ monthlyResult.months.length }} 个月</span
        >
      </div>
      <!-- 刷新和失败明确标记旧结果，重试保留当前模式、周期与筛选 -->
      <div
        v-if="resultStatus"
        class="transaction-status"
        :class="{ 'transaction-status--error': Boolean(errorMessage || amountError) }"
        role="status"
      >
        <TLoading v-if="isRefreshing" size="small" /><span>{{ resultStatus }}</span>
        <button
          v-if="errorMessage"
          class="transaction-button"
          type="button"
          :disabled="Boolean(amountError)"
          @click="refresh"
        >
          重新加载
        </button>
      </div>
      <div class="transaction-card__scroll" :aria-busy="isRefreshing">
        <div v-if="!result && isRefreshing" class="transaction-empty">
          <TLoading size="medium" />
          <p>正在加载账单…</p>
        </div>
        <div v-else-if="!result" class="transaction-empty">
          <BaseIcon name="emptyData" :size="82" />
          <h3>{{ errorMessage ? '账单加载失败' : '等待有效筛选条件' }}</h3>
          <p>
            {{
              errorMessage ? '请重新加载，账单周期和筛选条件已保留。' : '请检查金额区间后继续查询。'
            }}
          </p>
        </div>
        <TransactionDailyList
          v-else-if="dailyResult?.days.length"
          :days="dailyResult.days"
          :period="dailyResult.period"
          :type="resultType"
          @edit="handleEditTransaction"
        />
        <TransactionMonthlyList
          v-else-if="monthlyResult?.months.length"
          :key="monthlyResult.period"
          :months="monthlyResult.months"
          :period="monthlyResult.period"
          :type="resultType"
        />
        <div v-else-if="result" class="transaction-empty">
          <BaseIcon name="emptyData" :size="82" />
          <h3>{{ hasPeriodTransactions ? '未找到匹配记录' : '暂无账单记录' }}</h3>
          <p>
            {{
              hasPeriodTransactions
                ? '试试调整筛选条件，或重置筛选。'
                : `${formatPeriod(result.period)}还没有账单记录。`
            }}
          </p>
          <button
            v-if="hasPeriodTransactions && hasFilters"
            class="transaction-button"
            type="button"
            @click="resetFilters"
          >
            重置筛选
          </button>
          <button
            v-else-if="!hasPeriodTransactions"
            class="transaction-button"
            type="button"
            @click="handleCreateTransaction"
          >
            <BaseIcon name="add" :size="17" />新增流水
          </button>
        </div>
      </div>
    </section>
    <!-- 新增和编辑共用字段与校验；保存成功刷新当前周期、筛选列表及两种合计 -->
    <TransactionFormDialog
      :visible="isFormDialogOpen"
      :transaction="editingTransaction"
      @update:visible="handleFormVisibleChange"
      @submit-success="handleFormSuccess"
    />
  </div>
</template>

<style scoped>
/* 卡片占满可用视口，只在各自内容区滚动。 */
.transactions-view {
  display: flex;
  height: calc(100dvh - 2 * var(--space-page));
  min-width: 0;
  gap: var(--space-page);
}
.transactions-view :deep(.transaction-filters),
.transaction-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
}
.transaction-card {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
  padding: 18px;
}
.transaction-overview {
  display: flex;
  flex: none;
  align-items: center;
  gap: 24px;
  padding: 24px 20px;
  background: linear-gradient(110deg, #fffbe6, #fff 60%);
  border: 1px solid #f1ecd1;
  border-radius: 14px;
}
.transaction-overview__period {
  flex: none;
}
.transaction-overview__label,
.transaction-overview dt {
  color: var(--color-text-secondary);
  font-size: 12px;
}
.transaction-overview h2 {
  margin: 7px 0 0;
  font-size: 23px;
  font-weight: 700;
  white-space: nowrap;
}
.transaction-overview__totals {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-wrap: wrap;
  align-items: end;
  gap: 14px 26px;
  margin: 0;
}
.transaction-overview__totals > div {
  min-width: 0;
}
.transaction-overview dd {
  margin: 7px 0 0;
  overflow-wrap: anywhere;
  font-size: 17px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.transaction-overview__expense dd {
  font-size: 31px;
  line-height: 1.2;
}
.transaction-overview__actions {
  display: flex;
  flex: none;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}
.transaction-overview__icon {
  display: flex;
  width: 38px;
  height: 38px;
  align-items: center;
  justify-content: center;
}
.transaction-overview__add {
  background: var(--color-primary);
  border-color: var(--color-primary);
}
.transaction-card__list-heading {
  display: flex;
  flex: none;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  padding: 22px 3px 12px;
}
.transaction-card__list-heading h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}
.transaction-card__list-heading > span {
  color: var(--color-text-secondary);
  font-size: 11px;
}
.transaction-status {
  display: flex;
  flex: none;
  align-items: center;
  gap: 9px;
  margin-bottom: 12px;
  padding: 10px 12px;
  color: #806d00;
  background: #fffbe6;
  border-radius: 8px;
  font-size: 12px;
}
.transaction-status > span {
  min-width: 0;
  flex: 1;
  overflow-wrap: anywhere;
}
.transaction-status--error {
  color: var(--color-danger);
  background: #fff3f1;
}
.transaction-status button {
  flex: none;
  padding: 5px 9px;
}
.transaction-card__scroll {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
}
.transaction-empty {
  display: flex;
  height: 100%;
  min-height: 210px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 13px;
  padding: 24px;
  text-align: center;
}
.transaction-empty > .base-icon {
  color: #bdc1c8;
}
.transaction-empty h3 {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
}
.transaction-empty p {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 13px;
}
.transaction-empty button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 16px;
  font-size: 13px;
}
/* 共用金额颜色和按钮状态，作用于页面及其私有子组件。 */
.transactions-view :deep(.amount-expense) {
  color: #249e68;
}
.transactions-view :deep(.amount-income) {
  color: #e34d59;
}
.transactions-view :deep(.amount-neutral) {
  color: var(--color-text-secondary);
}
.transactions-view :deep(.transaction-button) {
  border: 1px solid var(--color-border);
  border-radius: 9px;
  color: var(--color-icon);
  cursor: pointer;
  transition:
    background 0.15s,
    border-color 0.15s,
    color 0.15s;
}
.transactions-view :deep(.transaction-button:not(:disabled):is(:hover, :focus-visible)) {
  color: var(--color-text);
  background: var(--color-primary-soft);
  border-color: var(--color-primary);
}
.transactions-view :deep(.transaction-button:disabled) {
  opacity: 0.42;
  cursor: not-allowed;
}
@media (max-width: 1350px) {
  .transaction-overview {
    flex-wrap: wrap;
    gap: 16px 20px;
    padding: 20px 16px;
  }
  .transaction-overview__totals {
    flex-basis: calc(100% - 190px);
    gap: 10px 20px;
  }
}
@media (max-width: 1050px) {
  .transaction-card {
    padding: 14px;
  }
  .transaction-overview h2 {
    font-size: 20px;
  }
  .transaction-overview__expense dd {
    font-size: 25px;
  }
  .transaction-overview__totals {
    flex-basis: 100%;
  }
  .transaction-overview {
    position: relative;
    padding-top: 56px;
  }
  .transaction-overview__actions {
    position: absolute;
    top: 12px;
    right: 12px;
  }
}
</style>
