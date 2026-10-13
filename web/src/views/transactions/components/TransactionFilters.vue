<script setup lang="ts">
/**
 * @author Brave
 * @date 2026-10-10T20:54:40+08:00
 * @description 账单筛选卡片，按展示模式启用条件，加载历史分类标签并展示只读筛选合计。
 */

import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Cascader as TCascader, Checkbox as TCheckbox, Select as TSelect } from 'tdesign-vue-next'
import { getUserCategories } from '@/api/category.api'
import type { UserCategory, UserCategoryTreeItem } from '@/api/category.types'
import { normalizeApiError } from '@/api/http'
import { getUserTags } from '@/api/tag.api'
import type { UserTag } from '@/api/tag.types'
import type {
  TransactionFilters,
  TransactionFilterTotals,
  TransactionDisplayMode,
  TransactionTypeFilter,
} from '@/api/transaction.types'
import BaseIcon from '@/components/base/BaseIcon.vue'
import CategoryIcon from '@/components/business/CategoryIcon.vue'
import { formatAmount } from '@/utils/money'

interface CategoryOption {
  value: number | string
  label: string
  children?: CategoryOption[]
}
const props = defineProps<{
  mode: TransactionDisplayMode
  filters: TransactionFilters
  totals: TransactionFilterTotals | null
  amountError: string
  isRefreshing: boolean
  isStale: boolean
  hasFailed: boolean
  hasFilters: boolean
  tagsRevision?: number
}>()
const emit = defineEmits<{
  'update:filters': [filters: TransactionFilters]
  search: []
  reset: []
}>()
const TYPE_OPTIONS: readonly { value: TransactionTypeFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'expense', label: '支出' },
  { value: 'income', label: '收入' },
]
const expenseCategories = ref<UserCategoryTreeItem[]>([])
const incomeCategories = ref<UserCategoryTreeItem[]>([])
const tags = ref<UserTag[]>([])
const isCategoriesLoading = ref(false)
const isTagsLoading = ref(false)
const categoryError = ref('')
const tagError = ref('')
let isActive = true
let tagsSequence = 0

const isDailyFiltersDisabled = computed(() => props.mode === 'monthly')
const categoryById = computed(
  () =>
    new Map(
      [...expenseCategories.value, ...incomeCategories.value]
        .flatMap((category) => [category, ...category.children])
        .map((category) => [category.id, category]),
    ),
)

/** 按后端顺序构建分类树，归档项保留并作为可选历史条件。 */
function createCategoryOptions(categories: UserCategoryTreeItem[]): CategoryOption[] {
  return categories.map((category) => ({
    value: category.id,
    label: `${category.name}${category.archived ? '（已归档）' : ''}`,
    ...(category.children.length
      ? {
          children: category.children.map((child) => ({
            value: child.id,
            label: `${child.name}${child.archived ? '（已归档）' : ''}`,
          })),
        }
      : {}),
  }))
}
const categoryOptions = computed<CategoryOption[]>(() => {
  const expense = createCategoryOptions(expenseCategories.value)
  const income = createCategoryOptions(incomeCategories.value)
  if (props.filters.type === 'expense') return expense
  if (props.filters.type === 'income') return income
  return [
    { value: 'expense', label: '支出', children: expense },
    { value: 'income', label: '收入', children: income },
  ].filter((group) => group.children.length)
})
const tagOptions = computed(() =>
  tags.value.map((tag) => ({
    value: tag.id,
    label: `${tag.name}${tag.archived ? '（已归档）' : ''}`,
  })),
)
const totalsStatus = computed(() => {
  if (props.isRefreshing) return '刷新中…'
  if (props.hasFailed) return '刷新失败，保留上次结果'
  if (props.isStale) return '条件未应用，显示上次结果'
  return ''
})

/** 提交新的筛选草稿，不直接修改父组件状态。 */
function updateField<Key extends keyof TransactionFilters>(
  key: Key,
  value: TransactionFilters[Key],
): void {
  if (isDailyFiltersDisabled.value && (key === 'title' || key === 'tagIds' || key === 'remark'))
    return
  emit('update:filters', { ...props.filters, [key]: value })
}
/** 切换类型时一次性清除不匹配的分类，避免发送中间无效条件。 */
function handleTypeChange(type: TransactionTypeFilter): void {
  if (type === props.filters.type) return
  emit('update:filters', {
    ...props.filters,
    type,
    categoryIds: props.filters.categoryIds.filter(
      (id) => type === 'all' || categoryById.value.get(id)?.type === type,
    ),
  })
}
/** 根分组仅用于展开；只提交用户分类 ID。 */
function handleCategoryChange(value: unknown): void {
  const ids = Array.isArray(value) ? value.filter((id): id is number => typeof id === 'number') : []
  updateField('categoryIds', [...new Set(ids)])
}
/** 标签搜索仅过滤选项，实际查询始终使用已选标签 ID。 */
function handleTagChange(value: unknown): void {
  const ids = Array.isArray(value) ? value.filter((id): id is number => typeof id === 'number') : []
  updateField('tagIds', [...new Set(ids)])
}
function findCategory(value: unknown): UserCategory | undefined {
  return typeof value === 'number' ? categoryById.value.get(value) : undefined
}
function handleTextInput(key: 'title' | 'remark' | 'minAmount' | 'maxAmount', event: Event): void {
  if (event.target instanceof HTMLInputElement) updateField(key, event.target.value)
}

/** 两棵分类树同时加载；可独立重试，不阻断流水与标签查询。 */
async function loadCategories(): Promise<void> {
  if (isCategoriesLoading.value) return
  isCategoriesLoading.value = true
  categoryError.value = ''
  try {
    const [expense, income] = await Promise.all([
      getUserCategories('expense', true),
      getUserCategories('income', true),
    ])
    if (!isActive) return
    expenseCategories.value = expense
    incomeCategories.value = income
  } catch (error) {
    if (isActive) categoryError.value = normalizeApiError(error, '分类加载失败').message
  } finally {
    if (isActive) isCategoriesLoading.value = false
  }
}
/** 首次启用和流水添加标签后加载全部历史标签，较旧响应不能覆盖新选项。 */
async function loadTags(): Promise<void> {
  const sequence = ++tagsSequence
  isTagsLoading.value = true
  tagError.value = ''
  try {
    const data = await getUserTags(true)
    if (isActive && sequence === tagsSequence) tags.value = data
  } catch (error) {
    if (isActive && sequence === tagsSequence)
      tagError.value = normalizeApiError(error, '标签加载失败').message
  } finally {
    if (isActive && sequence === tagsSequence) isTagsLoading.value = false
  }
}
watch(() => props.tagsRevision, loadTags)
onMounted(() => {
  void loadCategories()
  void loadTags()
})
onBeforeUnmount(() => {
  isActive = false
})
</script>

<template>
  <aside class="transaction-filters" aria-labelledby="transaction-filters-heading">
    <header class="transaction-filters__header">
      <span class="transaction-filters__eyebrow">FILTERS</span>
      <h1 id="transaction-filters-heading">筛选账单</h1>
      <p>{{ props.hasFilters ? '正在按条件筛选账单' : '暂无筛选条件' }}</p>
    </header>
    <!-- 内容独立滚动，底部重置按钮保持可见 -->
    <form
      class="transaction-filters__scroll"
      aria-label="账单筛选"
      @submit.prevent="emit('search')"
    >
      <fieldset class="filter-field">
        <legend>类型</legend>
        <div class="filter-type" role="group" aria-label="流水类型">
          <button
            v-for="option in TYPE_OPTIONS"
            :key="option.value"
            type="button"
            :aria-pressed="props.filters.type === option.value"
            :class="{ 'filter-type__active': props.filters.type === option.value }"
            @click="handleTypeChange(option.value)"
          >
            {{ option.label }}
          </button>
        </div>
      </fieldset>
      <div class="filter-field">
        <label id="transaction-category-label">分类</label>
        <TCascader
          :value="props.filters.categoryIds"
          :options="categoryOptions"
          multiple
          check-strictly
          filterable
          clearable
          :show-all-levels="false"
          :min-collapsed-num="1"
          :loading="isCategoriesLoading"
          :disabled="isCategoriesLoading || Boolean(categoryError)"
          aria-labelledby="transaction-category-label"
          placeholder="选择分类（支持多选）"
          empty="暂无可选分类"
          @change="handleCategoryChange"
        >
          <template #option="{ item, onChange }">
            <TCheckbox
              v-if="typeof item.value === 'number'"
              :checked="props.filters.categoryIds.includes(item.value)"
              class="category-option"
              @change="onChange"
              @click.stop
            >
              <CategoryIcon
                v-if="findCategory(item.value)"
                :icon-key="findCategory(item.value)?.iconKey ?? ''"
                :background-color="findCategory(item.value)?.backgroundColor ?? ''"
                :size="23"
              />
              <span class="category-option__label" :title="String(item.label)">{{
                item.label
              }}</span>
            </TCheckbox>
            <span v-else class="category-option__group">{{ item.label }}</span>
          </template>
        </TCascader>
        <p v-if="categoryError" class="filter-field__error" role="alert">
          {{ categoryError }}
          <button type="button" class="filter-retry" @click="loadCategories">重试</button>
        </p>
      </div>
      <div class="filter-field" :class="{ 'filter-field--disabled': isDailyFiltersDisabled }">
        <label for="transaction-title">标题</label>
        <div class="filter-input">
          <BaseIcon name="search" :size="17" />
          <input
            id="transaction-title"
            :value="props.filters.title"
            type="search"
            maxlength="50"
            :disabled="isDailyFiltersDisabled"
            :placeholder="isDailyFiltersDisabled ? '仅日明细可用' : '搜索标题'"
            @input="handleTextInput('title', $event)"
          />
        </div>
      </div>
      <div class="filter-field" :class="{ 'filter-field--disabled': isDailyFiltersDisabled }">
        <label id="transaction-tag-label">标签</label>
        <TSelect
          :value="props.filters.tagIds"
          :options="tagOptions"
          multiple
          filterable
          clearable
          :min-collapsed-num="1"
          :loading="isTagsLoading"
          :disabled="isDailyFiltersDisabled || isTagsLoading || Boolean(tagError)"
          aria-labelledby="transaction-tag-label"
          :placeholder="isDailyFiltersDisabled ? '仅日明细可用' : '搜索并选择标签'"
          empty="暂无匹配标签"
          @change="handleTagChange"
          @enter="!isDailyFiltersDisabled && emit('search')"
        >
          <template #prefixIcon
            ><BaseIcon class="filter-tag-icon" name="tag" :size="17"
          /></template>
        </TSelect>
        <p v-if="tagError" class="filter-field__error" role="alert">
          {{ tagError }}
          <button
            type="button"
            class="filter-retry"
            :disabled="isDailyFiltersDisabled"
            @click="loadTags"
          >
            重试
          </button>
        </p>
      </div>
      <div class="filter-field" :class="{ 'filter-field--disabled': isDailyFiltersDisabled }">
        <label for="transaction-remark">备注</label>
        <div class="filter-input">
          <BaseIcon name="remark" :size="17" />
          <input
            id="transaction-remark"
            :value="props.filters.remark"
            type="search"
            maxlength="100"
            :disabled="isDailyFiltersDisabled"
            :placeholder="isDailyFiltersDisabled ? '仅日明细可用' : '搜索备注'"
            @input="handleTextInput('remark', $event)"
          />
        </div>
      </div>
      <fieldset class="filter-field">
        <legend>金额区间</legend>
        <div class="filter-amounts">
          <input
            :value="props.filters.minAmount"
            aria-label="最低金额"
            :aria-invalid="Boolean(props.amountError)"
            :aria-describedby="props.amountError ? 'transaction-amount-error' : undefined"
            type="text"
            inputmode="decimal"
            placeholder="最低金额"
            @input="handleTextInput('minAmount', $event)"
          />
          <span aria-hidden="true">—</span>
          <input
            :value="props.filters.maxAmount"
            aria-label="最高金额"
            :aria-invalid="Boolean(props.amountError)"
            :aria-describedby="props.amountError ? 'transaction-amount-error' : undefined"
            type="text"
            inputmode="decimal"
            placeholder="最高金额"
            @input="handleTextInput('maxAmount', $event)"
          />
        </div>
        <p
          v-if="props.amountError"
          id="transaction-amount-error"
          class="filter-field__error"
          role="alert"
        >
          {{ props.amountError }}
        </p>
      </fieldset>
      <!-- 合计只读，完全使用接口结果 -->
      <section
        class="filter-totals"
        aria-labelledby="filter-totals-heading"
        :aria-busy="props.isRefreshing"
      >
        <h2 id="filter-totals-heading">筛选结果合计</h2>
        <p v-if="totalsStatus" class="filter-totals__status" role="status">{{ totalsStatus }}</p>
        <dl>
          <div>
            <dt>支出</dt>
            <dd class="amount-expense" data-testid="filter-expense">
              {{ props.totals ? `¥ ${formatAmount(props.totals.expense)}` : '—' }}
            </dd>
          </div>
          <div>
            <dt>收入</dt>
            <dd class="amount-income" data-testid="filter-income">
              {{ props.totals ? `¥ ${formatAmount(props.totals.income)}` : '—' }}
            </dd>
          </div>
        </dl>
      </section>
      <button class="filter-submit" type="submit" tabindex="-1" aria-hidden="true">查询</button>
    </form>
    <footer class="transaction-filters__footer">
      <button class="transaction-button filter-reset" type="button" @click="emit('reset')">
        重置筛选
      </button>
    </footer>
  </aside>
</template>

<style scoped>
.transaction-filters {
  display: flex;
  width: 276px;
  min-width: 0;
  flex: none;
  flex-direction: column;
  overflow: hidden;
}
.transaction-filters__header {
  padding: 23px 20px 15px;
}
.transaction-filters__eyebrow {
  color: #947c00;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1.5px;
}
.transaction-filters__header h1 {
  margin: 4px 0 6px;
  font-size: 21px;
  font-weight: 700;
}
.transaction-filters__header p {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 12px;
}
.transaction-filters__scroll {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  padding: 4px 20px 20px;
}
.filter-field {
  min-width: 0;
  margin: 0 0 19px;
  padding: 0;
  border: 0;
}
.filter-field > label,
.filter-field legend {
  display: block;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
}
.filter-type {
  display: flex;
  padding: 3px;
  background: #f3f4f6;
  border-radius: 12px;
}
.filter-type button {
  min-width: 0;
  flex: 1;
  padding: 7px 0;
  border: 1px solid transparent;
  border-radius: 9px;
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: 12px;
  transition:
    background 0.15s,
    border-color 0.15s;
}
.filter-type .filter-type__active {
  color: var(--color-text);
  background: var(--color-primary);
  font-weight: 600;
}
.filter-input {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 7px;
  padding: 0 10px;
  color: var(--color-icon);
  border: 1px solid var(--color-border);
  border-radius: 8px;
}
.filter-input:focus-within {
  border-color: var(--color-primary);
}
/* 分类和标签的组件库输入容器与标题框保持相同尺寸。 */
.transaction-filters :deep(.t-input) {
  height: 38px;
  border-radius: 8px;
}
.filter-input input {
  width: 100%;
  min-width: 0;
  height: 36px;
  border: 0;
  outline: none;
  color: var(--color-text);
  background: transparent;
  font-size: 12px;
}
.filter-input input::placeholder,
.filter-amounts input::placeholder {
  color: #9a9ea6;
}
.filter-tag-icon {
  color: #9a7b08;
}
/* 年周期保留控件位置，禁用字段与图标使用统一灰色。 */
.filter-field--disabled > label,
.filter-field--disabled .filter-input,
.filter-field--disabled .filter-tag-icon,
.filter-field--disabled input {
  color: #b7bbc3;
}
.filter-field--disabled .filter-input {
  background: #f3f4f6;
}
.filter-field--disabled input {
  cursor: not-allowed;
}
.filter-field--disabled :deep(.t-select-input__wrap .t-input) {
  background: #f3f4f6;
}
.filter-amounts {
  display: flex;
  align-items: center;
  gap: 7px;
}
.filter-amounts > span {
  color: #b7bbc3;
  font-size: 12px;
}
.filter-amounts input {
  width: 0;
  min-width: 0;
  height: 36px;
  flex: 1;
  padding: 0 7px;
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 12px;
  text-align: center;
}
.filter-amounts input[aria-invalid='true'] {
  border-color: var(--color-danger);
}
.filter-field__error {
  margin: 7px 0 0;
  color: var(--color-danger);
  font-size: 12px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.filter-retry {
  margin-left: 6px;
  padding: 1px 4px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text);
  cursor: pointer;
}
.filter-retry:not(:disabled):is(:hover, :focus-visible) {
  background: var(--color-primary-soft);
  border-color: var(--color-primary);
}
.filter-retry:disabled {
  opacity: 0.42;
  cursor: not-allowed;
}
.filter-totals {
  margin-top: 29px;
}
.filter-totals h2 {
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 600;
}
.filter-totals__status {
  margin: -3px 0 8px;
  color: var(--color-text-secondary);
  font-size: 11px;
}
.filter-totals dl {
  display: grid;
  gap: 8px;
  margin: 0;
}
.filter-totals dl > div {
  display: flex;
  min-width: 0;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  padding: 15px 12px;
  background: #f5f6f8;
  border-radius: 10px;
}
.filter-totals dt {
  flex: none;
  font-size: 12px;
}
.filter-totals dd {
  margin: 0;
  overflow-wrap: anywhere;
  font-size: 17px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  text-align: right;
}
.transaction-filters__footer {
  padding: 14px 20px 20px;
}
.filter-reset {
  width: 100%;
  min-height: 38px;
  font-size: 13px;
  font-weight: 600;
}
.filter-submit {
  display: none;
}
.category-option {
  max-width: 260px;
}
.category-option :deep(.t-checkbox__label) {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
}
.category-option__label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.category-option__group {
  padding: 0 7px;
  font-weight: 600;
}
@media (max-width: 1050px) {
  .transaction-filters {
    width: 242px;
  }
  .transaction-filters__header,
  .transaction-filters__scroll,
  .transaction-filters__footer {
    padding-right: 16px;
    padding-left: 16px;
  }
}
</style>
