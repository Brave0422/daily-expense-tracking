<script setup lang="ts">
/**
 * @author Brave
 * @date 2026-10-11T15:43:36+08:00
 * @description 年周期月份及分类汇总展示，保留后端顺序与金额，提供月份和支出分类折叠。
 */

import { ref, watch } from 'vue'
import type { MonthlySummaryGroup, TransactionTypeFilter } from '@/api/transaction.types'
import CategoryIcon from '@/components/business/CategoryIcon.vue'
import { formatAmount } from '@/utils/money'

const props = defineProps<{
  months: MonthlySummaryGroup[]
  period: string
  type: TransactionTypeFilter
}>()
const expandedMonths = ref(new Set<number>())
const expandedCategories = ref(new Set<string>())

/** 首次只展开接口中的最新月份；同周期刷新保留仍存在分组的折叠状态。 */
watch(
  () => props.months.map((month) => month.month),
  (months, previousMonths) => {
    if (!previousMonths?.some((month) => months.includes(month))) {
      expandedMonths.value = new Set(months.slice(0, 1))
      expandedCategories.value = new Set()
    } else {
      expandedMonths.value = new Set(
        [...expandedMonths.value].filter((month) => months.includes(month)),
      )
      const categoryKeys = new Set(
        props.months.flatMap((month) =>
          month.expenseCategories.map((category) => `${month.month}-${category.id}`),
        ),
      )
      expandedCategories.value = new Set(
        [...expandedCategories.value].filter((key) => categoryKeys.has(key)),
      )
    }
  },
  { immediate: true },
)

/** 折叠只改变可见内容，不触发请求或重新计算合计。 */
function toggleMonth(month: number): void {
  const next = new Set(expandedMonths.value)
  if (next.has(month)) next.delete(month)
  else next.add(month)
  expandedMonths.value = next
}

/** 分类展开状态按月份隔离，同一分类在不同月份可以独立展开。 */
function toggleCategory(month: number, categoryId: number): void {
  const key = `${month}-${categoryId}`
  const next = new Set(expandedCategories.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  expandedCategories.value = next
}
</script>

<template>
  <!-- 月份和分类均按响应顺序展示，只使用后端筛选合计。 -->
  <div class="monthly-list">
    <section v-for="month in props.months" :key="month.month" class="monthly-group">
      <h3>
        <button
          class="monthly-group__heading"
          type="button"
          :aria-expanded="expandedMonths.has(month.month)"
          :aria-controls="`transaction-month-${props.period}-${month.month}`"
          @click="toggleMonth(month.month)"
        >
          <span class="monthly-group__month">
            <span
              class="monthly-chevron"
              :class="{ 'monthly-chevron--collapsed': !expandedMonths.has(month.month) }"
              aria-hidden="true"
              >▾</span
            >
            {{ month.month }}月
          </span>
          <span class="monthly-group__totals">
            <span v-if="props.type !== 'expense'" class="amount-income"
              >收入 ¥{{ formatAmount(month.incomeTotal) }}</span
            >
            <span v-if="props.type !== 'income'" class="amount-expense"
              >支出 ¥{{ formatAmount(month.expenseTotal) }}</span
            >
          </span>
        </button>
      </h3>
      <div
        v-if="expandedMonths.has(month.month)"
        :id="`transaction-month-${props.period}-${month.month}`"
        class="monthly-group__content"
      >
        <section
          v-if="props.type !== 'income' && month.expenseCategories.length"
          class="monthly-section"
          aria-label="支出分类汇总"
        >
          <h4 class="amount-expense">支出</h4>
          <ul class="monthly-categories">
            <li v-for="category in month.expenseCategories" :key="category.id">
              <button
                class="monthly-category monthly-category--expandable"
                type="button"
                :aria-expanded="expandedCategories.has(`${month.month}-${category.id}`)"
                :aria-controls="`transaction-category-${props.period}-${month.month}-${category.id}`"
                @click="toggleCategory(month.month, category.id)"
              >
                <span
                  class="monthly-chevron"
                  :class="{
                    'monthly-chevron--collapsed': !expandedCategories.has(
                      `${month.month}-${category.id}`,
                    ),
                  }"
                  aria-hidden="true"
                  >▾</span
                >
                <CategoryIcon
                  :icon-key="category.iconKey"
                  :background-color="category.backgroundColor"
                  :size="32"
                />
                <span class="monthly-category__name" :title="category.name"
                  >{{ category.name }}<small v-if="category.archived">（已归档）</small></span
                >
                <span class="monthly-category__amount amount-expense"
                  >¥ {{ formatAmount(category.amount) }}</span
                >
              </button>
              <ul
                v-if="expandedCategories.has(`${month.month}-${category.id}`)"
                :id="`transaction-category-${props.period}-${month.month}-${category.id}`"
                class="monthly-categories monthly-categories--children"
              >
                <li v-for="child in category.children" :key="child.id" class="monthly-category">
                  <CategoryIcon
                    :icon-key="child.iconKey"
                    :background-color="category.backgroundColor"
                    :size="28"
                  />
                  <span class="monthly-category__name" :title="child.name"
                    >{{ child.name }}<small v-if="child.archived">（已归档）</small></span
                  >
                  <span class="monthly-category__amount amount-expense"
                    >¥ {{ formatAmount(child.amount) }}</span
                  >
                </li>
              </ul>
            </li>
          </ul>
        </section>
        <section
          v-if="props.type !== 'expense' && month.incomeCategories.length"
          class="monthly-section"
          aria-label="收入分类汇总"
        >
          <h4 class="amount-income">收入</h4>
          <ul class="monthly-categories">
            <li
              v-for="category in month.incomeCategories"
              :key="category.id"
              class="monthly-category"
            >
              <CategoryIcon
                :icon-key="category.iconKey"
                :background-color="category.backgroundColor"
                :size="32"
              />
              <span class="monthly-category__name" :title="category.name"
                >{{ category.name }}<small v-if="category.archived">（已归档）</small></span
              >
              <span class="monthly-category__amount amount-income"
                >¥ {{ formatAmount(category.amount) }}</span
              >
            </li>
          </ul>
        </section>
      </div>
    </section>
  </div>
</template>

<style scoped>
.monthly-list {
  display: grid;
  gap: 12px;
}
.monthly-group {
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: 12px;
}
.monthly-group h3 {
  margin: 0;
  font-size: 13px;
}
.monthly-group__heading {
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
.monthly-group__heading:is(:hover, :focus-visible),
.monthly-category--expandable:is(:hover, :focus-visible) {
  background: var(--color-primary-soft);
  border-color: var(--color-primary);
}
.monthly-group__month {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  white-space: nowrap;
}
.monthly-chevron {
  display: inline-block;
  flex: none;
  color: var(--color-icon);
  transition: transform 0.15s;
}
.monthly-chevron--collapsed {
  transform: rotate(-90deg);
}
.monthly-group__totals {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 5px 18px;
  font-size: 11px;
  font-weight: 400;
}
.monthly-group__content {
  padding: 4px 14px 14px;
}
.monthly-section h4 {
  margin: 14px 0 5px;
  font-size: 12px;
  font-weight: 600;
}
.monthly-categories {
  margin: 0;
  padding: 0;
  list-style: none;
}
.monthly-category {
  display: flex;
  width: 100%;
  min-width: 0;
  min-height: 54px;
  align-items: center;
  gap: 10px;
  padding: 10px 8px;
  border: 1px solid transparent;
  border-radius: 8px;
  text-align: left;
}
.monthly-category--expandable {
  cursor: pointer;
}
.monthly-category__name {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.monthly-category__name small {
  color: var(--color-text-secondary);
  font-size: 11px;
}
.monthly-category__amount {
  flex: none;
  font-size: 14px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.monthly-categories--children {
  margin-left: 27px;
  padding-left: 14px;
  border-left: 1px solid var(--color-border);
}
@media (max-width: 1050px) {
  .monthly-group__content {
    padding-right: 8px;
    padding-left: 8px;
  }
  .monthly-category {
    gap: 8px;
  }
  .monthly-categories--children {
    margin-left: 15px;
    padding-left: 8px;
  }
}
</style>
