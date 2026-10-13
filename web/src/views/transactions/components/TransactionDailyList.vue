<script setup lang="ts">
/**
 * @author Brave
 * @date 2026-10-10T20:54:40+08:00
 * @description 日流水分组与记录展示，提供折叠、标签备注提示和编辑删除入口。
 */

import { computed, ref, watch } from 'vue'
import { Popup as TPopup } from 'tdesign-vue-next'
import type {
  DailyTransactionItem,
  DailyTransactionGroup,
  TransactionTypeFilter,
} from '@/api/transaction.types'
import BaseIcon from '@/components/base/BaseIcon.vue'
import BaseTooltip from '@/components/base/BaseTooltip.vue'
import CategoryIcon from '@/components/business/CategoryIcon.vue'
import { formatAmount } from '@/utils/money'

const props = defineProps<{
  days: DailyTransactionGroup[]
  period: string
  type: TransactionTypeFilter
}>()
const emit = defineEmits<{
  edit: [transaction: DailyTransactionItem]
  delete: [transaction: DailyTransactionItem]
}>()
const collapsedDates = ref(new Set<string>())
const openTransactionId = ref<number | null>(null)
const visibleTransactionIds = computed(
  () => new Set(props.days.flatMap((day) => day.transactions.map((transaction) => transaction.id))),
)

/** 使用自然日期计算星期，避免 YYYY-MM-DD 按 UTC 解析带来跨日偏移。 */
function formatDay(date: string): string {
  const [year = 0, month = 0, day = 0] = date.split('-').map(Number)
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  return `${month}月${day}日，周${weekdays[new Date(year, month - 1, day).getDay()]}`
}
function getCategoryPath(transaction: DailyTransactionItem): string {
  const { primary, secondary } = transaction.category
  return secondary ? `${primary.name} - ${secondary.name}` : primary.name
}
function getTransactionLabel(transaction: DailyTransactionItem): string {
  const path = getCategoryPath(transaction)
  return transaction.title ? `${path} · ${transaction.title}` : path
}
function toggleDate(date: string): void {
  const next = new Set(collapsedDates.value)
  if (next.has(date)) next.delete(date)
  else next.add(date)
  collapsedDates.value = next
  openTransactionId.value = null
}
function handlePopupVisibleChange(id: number, isVisible: boolean): void {
  if (isVisible) openTransactionId.value = id
  else if (openTransactionId.value === id) openTransactionId.value = null
}
/**
 * 关闭操作浮层并交给页面编辑当前记录，不触发日期分组折叠。
 * @param transaction - 用户点击的完整流水记录，用于回填编辑草稿
 * @returns 无返回值
 */
function handleEditTransaction(transaction: DailyTransactionItem): void {
  openTransactionId.value = null
  emit('edit', transaction)
}
/** 关闭操作浮层并交给页面确认删除，不触发日期分组折叠。 */
function handleDeleteTransaction(transaction: DailyTransactionItem): void {
  openTransactionId.value = null
  emit('delete', transaction)
}
watch(
  () => props.period,
  () => {
    collapsedDates.value = new Set()
    openTransactionId.value = null
  },
)
watch(visibleTransactionIds, (ids) => {
  if (openTransactionId.value !== null && !ids.has(openTransactionId.value))
    openTransactionId.value = null
})
</script>

<template>
  <!-- 保持接口顺序，折叠分组不影响合计 -->
  <div class="daily-list">
    <section v-for="day in props.days" :key="day.date" class="daily-group">
      <h3>
        <button
          class="daily-group__heading"
          type="button"
          :aria-expanded="!collapsedDates.has(day.date)"
          :aria-controls="`transaction-day-${day.date}`"
          @click="toggleDate(day.date)"
        >
          <span class="daily-group__date"
            ><span
              class="daily-group__chevron"
              :class="{ 'daily-group__chevron--collapsed': collapsedDates.has(day.date) }"
              aria-hidden="true"
              >▾</span
            >{{ formatDay(day.date) }}</span
          >
          <span class="daily-group__totals">
            <span v-if="props.type !== 'expense'" class="amount-income"
              >收入 ¥{{ formatAmount(day.incomeTotal) }}</span
            >
            <span v-if="props.type !== 'income'" class="amount-expense"
              >支出 ¥{{ formatAmount(day.expenseTotal) }}</span
            >
          </span>
        </button>
      </h3>
      <ul
        v-show="!collapsedDates.has(day.date)"
        :id="`transaction-day-${day.date}`"
        class="daily-group__records"
      >
        <li v-for="transaction in day.transactions" :key="transaction.id" class="transaction-row">
          <CategoryIcon
            :icon-key="(transaction.category.secondary ?? transaction.category.primary).iconKey"
            :background-color="transaction.category.primary.backgroundColor"
            :size="36"
          />
          <div class="transaction-row__description">
            <BaseTooltip :content="getTransactionLabel(transaction)" block overflow-only>
              <p class="transaction-row__title" tabindex="0">
                <span>{{ getCategoryPath(transaction) }}</span
                ><template v-if="transaction.title"
                  ><span class="transaction-row__separator"> · </span
                  ><strong>{{ transaction.title }}</strong></template
                >
              </p>
            </BaseTooltip>
            <div v-if="transaction.tags.length" class="transaction-row__tags" aria-label="流水标签">
              <BaseTooltip v-for="tag in transaction.tags" :key="tag.id" :content="tag.name">
                <span class="transaction-row__tag" tabindex="0" :aria-label="`标签：${tag.name}`"
                  ><BaseIcon name="tag" :size="17"
                /></span>
              </BaseTooltip>
            </div>
          </div>
          <div class="transaction-row__actions">
            <BaseTooltip v-if="transaction.remark" :content="transaction.remark">
              <span
                class="transaction-row__remark"
                tabindex="0"
                :aria-label="`备注：${transaction.remark}`"
                ><BaseIcon name="remark" :size="17"
              /></span>
            </BaseTooltip>
            <span
              class="transaction-row__amount"
              :class="transaction.type === 'expense' ? 'amount-expense' : 'amount-income'"
              >{{ transaction.type === 'expense' ? '-' : '+' }} ¥{{
                formatAmount(transaction.amount)
              }}</span
            >
            <TPopup
              :visible="openTransactionId === transaction.id"
              trigger="click"
              placement="bottom-right"
              @visible-change="handlePopupVisibleChange(transaction.id, $event)"
            >
              <BaseTooltip content="更多操作"
                ><button
                  type="button"
                  class="transaction-button transaction-row__more"
                  :aria-label="`更多操作：${getTransactionLabel(transaction)}`"
                  :aria-expanded="openTransactionId === transaction.id"
                  @keydown.esc="openTransactionId = null"
                >
                  <BaseIcon name="more" :size="20" /></button
              ></BaseTooltip>
              <template #content>
                <div class="transaction-row__menu" aria-label="流水操作">
                  <button
                    type="button"
                    class="transaction-button"
                    aria-label="编辑流水"
                    @click.stop="handleEditTransaction(transaction)"
                  >
                    <BaseIcon name="transactionEdit" :size="20" />
                  </button>
                  <button
                    type="button"
                    class="transaction-button transaction-row__delete"
                    aria-label="删除流水"
                    @click.stop="handleDeleteTransaction(transaction)"
                  >
                    <BaseIcon name="transactionDelete" :size="20" />
                  </button>
                </div>
              </template>
            </TPopup>
          </div>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.daily-list {
  display: grid;
  gap: 12px;
}
.daily-group {
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: 12px;
}
.daily-group h3 {
  margin: 0;
  font-size: 13px;
}
.daily-group__heading {
  display: flex;
  width: 100%;
  min-width: 0;
  min-height: 43px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  background: #f5f6f8;
  border: 1px solid transparent;
  cursor: pointer;
}
.daily-group__heading:is(:hover, :focus-visible) {
  background: var(--color-primary-soft);
  border-color: var(--color-primary);
}
.daily-group__date {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  white-space: nowrap;
}
.daily-group__chevron {
  display: inline-block;
  color: var(--color-icon);
  transition: transform 0.15s;
}
.daily-group__chevron--collapsed {
  transform: rotate(-90deg);
}
.daily-group__totals {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 5px 18px;
  font-size: 16px;
  font-weight: 700;
}
.daily-group__records {
  margin: 0;
  padding: 0;
  list-style: none;
}
.transaction-row {
  display: flex;
  min-width: 0;
  min-height: 68px;
  align-items: center;
  gap: 13px;
  padding: 12px 14px;
}
.transaction-row + .transaction-row {
  border-top: 1px solid #f1f2f4;
}
.transaction-row__description {
  min-width: 0;
  flex: 1;
}
.transaction-row__title {
  display: block;
  width: 100%;
  margin: 0;
  overflow: hidden;
  font-size: 13px;
  line-height: 1.6;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.transaction-row__title > span:first-child {
  color: var(--color-text-secondary);
}
.transaction-row__title strong {
  font-weight: 600;
}
.transaction-row__separator {
  color: #9a9ea6;
}
.transaction-row__tags {
  display: flex;
  gap: 5px;
  margin-top: 3px;
  overflow-x: auto;
}
.transaction-row__tag {
  display: inline-flex;
  flex: none;
  color: #9a7b08;
  cursor: default;
}
.transaction-row__actions {
  display: flex;
  flex: none;
  align-items: center;
  gap: 13px;
}
.transaction-row__remark {
  display: inline-flex;
  color: var(--color-icon);
  cursor: default;
}
.transaction-row__amount {
  font-size: 14px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.transaction-row__more {
  width: 31px;
  height: 31px;
}
/* 浮层挂载到 body，不能依赖页面祖先选择器。 */
.transaction-row__menu {
  display: flex;
  gap: 7px;
  padding: 2px;
}
.transaction-row__menu button {
  display: flex;
  width: 33px;
  height: 33px;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-primary);
  border-radius: 8px;
  color: var(--color-text);
  background: var(--color-primary-soft);
  cursor: pointer;
}
.transaction-row__menu button:is(:hover, :focus-visible) {
  background: var(--color-primary);
  border-color: var(--color-primary);
}
/* 禁用按钮保留图标颜色，仅以鼠标状态表示暂不可操作。 */
.transaction-row__menu button:disabled {
  cursor: not-allowed;
}
.transaction-row__menu .transaction-row__delete {
  color: #ff2525;
}
@media (max-width: 1050px) {
  .transaction-row {
    gap: 8px;
    padding-right: 10px;
    padding-left: 10px;
  }
  .transaction-row__actions {
    gap: 8px;
  }
}
</style>
