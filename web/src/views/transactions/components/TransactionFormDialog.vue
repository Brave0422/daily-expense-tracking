<script setup lang="ts">
/**
 * @author Brave
 * @date 2026-10-12T22:10:43+08:00
 * @description 新增与编辑流水共用弹窗，校验草稿、处理归档关联并提交，成功后通知页面刷新。
 */

import { computed, onBeforeUnmount, ref, watch } from 'vue'
import {
  Button as TButton,
  Cascader as TCascader,
  DatePicker as TDatePicker,
  Dialog as TDialog,
  MessagePlugin,
  Select as TSelect,
} from 'tdesign-vue-next'
import { getUserCategories } from '@/api/category.api'
import type { CategoryType, UserCategory, UserCategoryTreeItem } from '@/api/category.types'
import { normalizeApiError } from '@/api/http'
import { getUserTags } from '@/api/tag.api'
import type { UserTag } from '@/api/tag.types'
import { createTransaction, updateTransaction } from '@/api/transaction.api'
import type {
  DailyTransactionItem,
  TransactionCategory,
  UpdateTransactionBody,
} from '@/api/transaction.types'
import CategoryIcon from '@/components/business/CategoryIcon.vue'
import { isValidFilterAmount, isZeroAmount } from '@/utils/money'

interface TransactionCategoryOption {
  value: number
  label: string
  disabled?: boolean
  children?: TransactionCategoryOption[]
}

const props = defineProps<{ visible: boolean; transaction?: DailyTransactionItem | null }>()
const emit = defineEmits<{
  'update:visible': [visible: boolean]
  'submit-success': []
}>()

const type = ref<CategoryType>('expense')
const categoryId = ref<number>()
const amount = ref('')
const occurredDate = ref('')
const title = ref('')
const tagIds = ref<number[]>([])
const remark = ref('')
const errors = ref<Partial<Record<'category' | 'amount' | 'date' | 'title' | 'remark', string>>>({})
const formMessage = ref('')
const isSubmitting = ref(false)
const isOptionsLoading = ref(false)
const expenseCategories = ref<UserCategoryTreeItem[]>([])
const incomeCategories = ref<UserCategoryTreeItem[]>([])
const tags = ref<UserTag[]>([])
const expenseError = ref('')
const incomeError = ref('')
const tagError = ref('')
let optionsSequence = 0
let isActive = true

const isEditing = computed(() => Boolean(props.transaction))
const originalCategoryId = computed(() =>
  props.transaction
    ? (props.transaction.category.secondary ?? props.transaction.category.primary).id
    : undefined,
)
const originalTagIds = computed(() => new Set(props.transaction?.tags.map((tag) => tag.id) ?? []))
const dialogVisible = computed({
  get: () => props.visible,
  set: (visible: boolean) => {
    if (!isSubmitting.value) emit('update:visible', visible)
  },
})
const categoryError = computed(() =>
  type.value === 'expense' ? expenseError.value : incomeError.value,
)
const categories = computed(() =>
  (type.value === 'expense' ? expenseCategories.value : incomeCategories.value).filter(
    (category) =>
      category.level === 1 &&
      (!category.archived || category.id === props.transaction?.category.primary.id),
  ),
)
const selectableCategories = computed(() =>
  type.value === 'expense'
    ? categories.value.flatMap((category) =>
        category.children.filter(
          (child) =>
            child.level === 2 &&
            child.type === 'expense' &&
            ((!category.archived && !child.archived) || child.id === originalCategoryId.value),
        ),
      )
    : categories.value,
)
const categoryOptions = computed(() => {
  const options: TransactionCategoryOption[] =
    type.value === 'expense'
      ? categories.value
          .map((category) => ({
            value: category.id,
            label: getCategoryLabel(category),
            children: category.children
              .filter((child) => selectableCategories.value.includes(child))
              .map((child) => ({
                value: child.id,
                label: getCategoryLabel(child),
                ...(category.archived || child.archived ? { disabled: true } : {}),
              })),
          }))
          .filter((category) => category.children.length > 0)
      : categories.value.map((category) => ({
          value: category.id,
          label: getCategoryLabel(category),
          ...(category.archived ? { disabled: true } : {}),
        }))

  // 原分类从流水快照回填，选项加载期间或未返回该历史项时也保留名称和图标。
  const original = props.transaction?.category
  if (!original) return options
  const primary = categoryById.value.get(original.primary.id) ?? original.primary
  const primaryOption = options.find((option) => option.value === primary.id)
  if (type.value === 'income') {
    if (!primaryOption)
      options.push({ value: primary.id, label: getCategoryLabel(primary), disabled: true })
  } else if (original.secondary) {
    const secondary = categoryById.value.get(original.secondary.id) ?? original.secondary
    const secondaryOption = {
      value: secondary.id,
      label: getCategoryLabel(secondary),
      disabled: true,
    }
    if (primaryOption) {
      if (!primaryOption.children?.some((child) => child.value === secondary.id)) {
        primaryOption.children?.push(secondaryOption)
      }
    } else {
      options.push({
        value: primary.id,
        label: getCategoryLabel(primary),
        children: [secondaryOption],
      })
    }
  }
  return options
})
const categoryById = computed(
  () =>
    new Map<number, UserCategory | TransactionCategory>([
      ...(props.transaction
        ? [
            props.transaction.category.primary,
            ...(props.transaction.category.secondary ? [props.transaction.category.secondary] : []),
          ]
        : []
      ).map((category): [number, TransactionCategory] => [category.id, category]),
      ...categories.value
        .flatMap((category) => [category, ...category.children])
        .map((category): [number, UserCategory] => [category.id, category]),
    ]),
)
const availableTags = computed(() => {
  const byId = new Map<number, UserTag>(props.transaction?.tags.map((tag) => [tag.id, tag]) ?? [])
  for (const tag of tags.value) byId.set(tag.id, tag)
  return [...byId.values()].filter((tag) => !tag.archived || originalTagIds.value.has(tag.id))
})
const tagOptions = computed(() =>
  availableTags.value.map((tag) => ({
    value: tag.id,
    label: `${tag.name}${tag.archived ? '（已归档）' : ''}`,
    // 已选归档标签保持可移除；移除后禁用，避免被重新添加。
    ...(tag.archived && !tagIds.value.includes(tag.id) ? { disabled: true } : {}),
  })),
)

/**
 * 生成分类名称，归档项明确标记，便于识别历史关联。
 * @param category - 待展示的分类选项或流水分类快照
 * @returns 分类名称，归档时附加状态说明
 */
function getCategoryLabel(category: UserCategory | TransactionCategory): string {
  return `${category.name}${category.archived ? '（已归档）' : ''}`
}

/**
 * 新增时重置默认值，编辑时复制原记录，避免修改列表中的响应数据。
 * @returns 草稿及错误状态重置完成，无返回值
 */
function resetForm(): void {
  const today = new Date()
  const transaction = props.visible ? props.transaction : null
  type.value = transaction?.type ?? 'expense'
  categoryId.value = transaction
    ? (transaction.category.secondary ?? transaction.category.primary).id
    : undefined
  amount.value = transaction?.amount ?? ''
  occurredDate.value =
    transaction?.occurredDate ??
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  title.value = transaction?.title ?? ''
  tagIds.value = transaction?.tags.map((tag) => tag.id) ?? []
  remark.value = transaction?.remark ?? ''
  errors.value = {}
  formMessage.value = ''
}

/**
 * 每次打开重载选项；编辑时查询归档项，仅允许原关联继续保留。
 * @returns 选项加载完成后无返回值；失败显示错误，关闭或切换记录后丢弃旧响应
 */
async function loadOptions(): Promise<void> {
  const sequence = ++optionsSequence
  isOptionsLoading.value = true
  expenseError.value = ''
  incomeError.value = ''
  tagError.value = ''
  const [expense, income, tagResult] = await Promise.allSettled([
    isEditing.value
      ? type.value === 'expense'
        ? getUserCategories('expense', true)
        : Promise.resolve([])
      : getUserCategories('expense'),
    isEditing.value
      ? type.value === 'income'
        ? getUserCategories('income', true)
        : Promise.resolve([])
      : getUserCategories('income'),
    isEditing.value ? getUserTags(true) : getUserTags(),
  ])
  if (!isActive || sequence !== optionsSequence) return
  if (expense.status === 'fulfilled') expenseCategories.value = expense.value
  else expenseError.value = normalizeApiError(expense.reason, '支出分类加载失败').message
  if (income.status === 'fulfilled') incomeCategories.value = income.value
  else incomeError.value = normalizeApiError(income.reason, '收入分类加载失败').message
  if (tagResult.status === 'fulfilled') tags.value = tagResult.value
  else tagError.value = normalizeApiError(tagResult.reason, '标签加载失败').message
  isOptionsLoading.value = false
}

/**
 * 新增时切换收支类型并清空分类，编辑时类型固定。
 * @param value - 用户选择的收支类型
 * @returns 无返回值
 */
function handleTypeChange(value: CategoryType): void {
  if (isEditing.value || isSubmitting.value || value === type.value) return
  type.value = value
  categoryId.value = undefined
  errors.value.category = ''
}
/**
 * 更新分类草稿，已归档原分类移除后不能重新选择。
 * @param value - 级联选择器返回的分类id或空值
 * @returns 无返回值
 */
function handleCategoryChange(value: unknown): void {
  if (isSubmitting.value) return
  if (
    typeof value === 'number' &&
    categoryById.value.get(value)?.archived &&
    categoryId.value !== value
  )
    return
  categoryId.value = typeof value === 'number' ? value : undefined
  errors.value.category = ''
}
/**
 * 保留日期选择器返回的自然日期字符串，不转换为时间点。
 * @param value - YYYY-MM-DD 字符串或清空值
 * @returns 无返回值
 */
function handleDateChange(value: unknown): void {
  if (isSubmitting.value) return
  occurredDate.value = typeof value === 'string' ? value : ''
  errors.value.date = ''
}
/**
 * 去重标签集合，只接受可用标签或当前仍保留的原归档标签。
 * @param value - 多选控件返回的标签id数组或清空值
 * @returns 无返回值
 */
function handleTagChange(value: unknown): void {
  if (isSubmitting.value) return
  tagIds.value = Array.isArray(value)
    ? [
        ...new Set(
          value.filter(
            (id): id is number =>
              typeof id === 'number' &&
              availableTags.value.some(
                (tag) => tag.id === id && (!tag.archived || tagIds.value.includes(id)),
              ),
          ),
        ),
      ]
    : []
}

/**
 * 与后端保持金额精度、真实日期及 Unicode 字符长度约束，允许保留原分类。
 * @returns true 表示表单可提交；false 时更新字段错误信息
 */
function validateForm(): boolean {
  const nextErrors: typeof errors.value = {}
  if (
    !(originalCategoryId.value !== undefined && categoryId.value === originalCategoryId.value) &&
    !selectableCategories.value.some((category) => category.id === categoryId.value)
  ) {
    nextErrors.category = type.value === 'expense' ? '请选择支出二级分类' : '请选择收入一级分类'
  }
  const value = amount.value.trim()
  if (!value || !isValidFilterAmount(value) || isZeroAmount(value)) {
    nextErrors.amount = '金额必须大于0，最多13位整数和2位小数'
  }
  const dateValue = occurredDate.value
  const date = new Date(`${dateValue}T00:00:00.000Z`)
  if (
    !/^[1-9]\d{3}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(dateValue) ||
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== dateValue
  ) {
    nextErrors.date = '请选择有效的发生日期'
  }
  if (Array.from(title.value.trim()).length > 50) nextErrors.title = '标题不能超过50个字符'
  if (Array.from(remark.value.trim()).length > 100) nextErrors.remark = '备注不能超过100个字符'
  errors.value = nextErrors
  return Object.keys(nextErrors).length === 0
}

/**
 * 提交完整表单；编辑请求省略 type，使用打开弹窗时的原流水id。
 * @returns 成功时关闭并通知页面刷新；失败保留草稿，提交期间阻止重复操作
 */
async function handleSubmit(): Promise<void> {
  if (isSubmitting.value || isOptionsLoading.value) return
  formMessage.value = ''
  if (!validateForm() || categoryId.value === undefined || categoryError.value) return
  isSubmitting.value = true
  const transaction = props.transaction
  const isEditSubmission = Boolean(transaction)
  let isSubmitted = false
  try {
    const body: UpdateTransactionBody = {
      categoryId: categoryId.value,
      amount: amount.value.trim(),
      occurredDate: occurredDate.value,
      title: title.value.trim() || null,
      tagIds: [...tagIds.value],
      remark: remark.value.trim() || null,
    }
    // 显式构造六个可编辑字段，避免将只读类型或记录归属提交给 PATCH 接口。
    if (transaction) await updateTransaction(transaction.id, body)
    else await createTransaction({ type: type.value, ...body })
    isSubmitted = true
  } catch (error) {
    if (isActive)
      formMessage.value = normalizeApiError(
        error,
        isEditSubmission ? '编辑流水失败，请重试' : '创建流水失败，请重试',
      ).message
  } finally {
    if (isActive) isSubmitting.value = false
  }
  if (isSubmitted && isActive) {
    dialogVisible.value = false
    emit('submit-success')
    await MessagePlugin.success(isEditSubmission ? '流水编辑成功' : '流水创建成功')
  }
}

watch(
  () => [props.visible, props.transaction] as const,
  ([visible]) => {
    optionsSequence += 1
    if (visible) {
      resetForm()
      expenseCategories.value = []
      incomeCategories.value = []
      tags.value = []
      void loadOptions()
    } else if (!isSubmitting.value) {
      resetForm()
    }
  },
  { immediate: true },
)
onBeforeUnmount(() => {
  isActive = false
  optionsSequence += 1
})
</script>

<template>
  <TDialog
    v-model:visible="dialogVisible"
    :header="isEditing ? '编辑流水' : '新增流水'"
    placement="center"
    width="560px"
    :footer="false"
    :close-btn="!isSubmitting"
    :close-on-overlay-click="!isSubmitting"
    :close-on-esc-keydown="!isSubmitting"
  >
    <form class="transaction-form" novalidate @submit.prevent="handleSubmit">
      <!-- 收支类型与分类严格对应，支出父分类仅供展开 -->
      <fieldset class="transaction-form__type" :disabled="isSubmitting">
        <legend>类型</legend>
        <p v-if="isEditing" class="transaction-form__readonly-type">
          <strong>{{ type === 'expense' ? '支出' : '收入' }}</strong>
          <span>创建后不可修改</span>
        </p>
        <div v-else class="transaction-form__segments" role="group" aria-label="流水类型">
          <button
            type="button"
            :aria-pressed="type === 'expense'"
            @click="handleTypeChange('expense')"
          >
            支出
          </button>
          <button
            type="button"
            :aria-pressed="type === 'income'"
            @click="handleTypeChange('income')"
          >
            收入
          </button>
        </div>
      </fieldset>
      <div class="transaction-form__field">
        <label id="transaction-form-category-label">分类 <span>*</span></label>
        <TCascader
          :value="categoryId"
          :options="categoryOptions"
          :loading="isOptionsLoading"
          :disabled="isSubmitting || isOptionsLoading || Boolean(categoryError)"
          :check-strictly="false"
          clearable
          filterable
          aria-labelledby="transaction-form-category-label"
          :placeholder="type === 'expense' ? '选择支出二级分类' : '选择收入一级分类'"
          empty="暂无可选分类"
          @change="handleCategoryChange"
        >
          <template #option="{ item }">
            <span class="transaction-form__category-option">
              <CategoryIcon
                v-if="categoryById.get(item.value)"
                :icon-key="categoryById.get(item.value)?.iconKey ?? ''"
                :background-color="categoryById.get(item.value)?.backgroundColor ?? ''"
                :size="23"
              />
              <span>{{ item.label }}</span>
            </span>
          </template>
        </TCascader>
        <p v-if="errors.category" class="transaction-form__error" role="alert">
          {{ errors.category }}
        </p>
        <p v-if="categoryError" class="transaction-form__error" role="alert">
          {{ categoryError }}
          <button type="button" :disabled="isSubmitting || isOptionsLoading" @click="loadOptions">
            重试
          </button>
        </p>
        <p v-else-if="!isOptionsLoading && !categoryOptions.length" class="transaction-form__hint">
          暂无可用分类，请先在配置管理中添加{{ type === 'expense' ? '支出二级' : '收入一级' }}分类。
        </p>
      </div>
      <!-- 金额保持文本精度，发生日期使用单日选择器 -->
      <div class="transaction-form__row">
        <div class="transaction-form__field">
          <label for="transaction-form-amount">金额（元） <span>*</span></label>
          <input
            id="transaction-form-amount"
            v-model="amount"
            type="text"
            inputmode="decimal"
            placeholder="请输入金额"
            :disabled="isSubmitting"
            :aria-invalid="Boolean(errors.amount)"
            @input="errors.amount = ''"
          />
          <p v-if="errors.amount" class="transaction-form__error" role="alert">
            {{ errors.amount }}
          </p>
        </div>
        <div class="transaction-form__field">
          <label id="transaction-form-date-label">发生日期 <span>*</span></label>
          <TDatePicker
            :value="occurredDate"
            format="YYYY-MM-DD"
            value-type="YYYY-MM-DD"
            :disabled="isSubmitting"
            clearable
            aria-labelledby="transaction-form-date-label"
            @change="handleDateChange"
          />
          <p v-if="errors.date" class="transaction-form__error" role="alert">{{ errors.date }}</p>
        </div>
      </div>
      <div class="transaction-form__field">
        <label for="transaction-form-title">标题</label>
        <input
          id="transaction-form-title"
          v-model="title"
          type="text"
          placeholder="选填，最多50个字符"
          :disabled="isSubmitting"
          :aria-invalid="Boolean(errors.title)"
          @input="errors.title = ''"
        />
        <p v-if="errors.title" class="transaction-form__error" role="alert">{{ errors.title }}</p>
      </div>
      <div class="transaction-form__field">
        <label id="transaction-form-tags-label">标签</label>
        <TSelect
          :value="tagIds"
          :options="tagOptions"
          multiple
          clearable
          filterable
          :loading="isOptionsLoading"
          :disabled="isSubmitting || isOptionsLoading || Boolean(tagError)"
          aria-labelledby="transaction-form-tags-label"
          placeholder="选填，搜索并选择标签"
          empty="暂无可选标签"
          @change="handleTagChange"
        />
        <p v-if="tagError" class="transaction-form__error" role="alert">
          {{ tagError }}
          <button type="button" :disabled="isSubmitting || isOptionsLoading" @click="loadOptions">
            重试
          </button>
        </p>
      </div>
      <div class="transaction-form__field">
        <label for="transaction-form-remark">备注</label>
        <textarea
          id="transaction-form-remark"
          v-model="remark"
          rows="3"
          placeholder="选填，最多100个字符"
          :disabled="isSubmitting"
          :aria-invalid="Boolean(errors.remark)"
          @input="errors.remark = ''"
        />
        <p v-if="errors.remark" class="transaction-form__error" role="alert">{{ errors.remark }}</p>
      </div>
      <p v-if="formMessage" class="transaction-form__error" role="alert">{{ formMessage }}</p>
      <div class="transaction-form__actions">
        <TButton
          type="button"
          theme="default"
          :disabled="isSubmitting"
          @click="dialogVisible = false"
          >取消</TButton
        >
        <TButton
          class="app-confirm-button"
          type="submit"
          theme="primary"
          :loading="isSubmitting"
          :disabled="isOptionsLoading || Boolean(categoryError) || !categoryOptions.length"
          >确认</TButton
        >
      </div>
    </form>
  </TDialog>
</template>

<style scoped>
.transaction-form {
  display: grid;
  max-height: calc(100dvh - 160px);
  overflow-y: auto;
  gap: 18px;
  padding-right: 4px;
}
.transaction-form__field {
  display: grid;
  min-width: 0;
  gap: 8px;
}
.transaction-form__field label,
.transaction-form__type legend {
  color: var(--color-text);
  font-size: 14px;
  font-weight: 600;
}
.transaction-form__field label > span {
  color: var(--color-danger);
}
.transaction-form__type {
  margin: 0;
  padding: 0;
  border: 0;
}
.transaction-form__type legend {
  margin-bottom: 8px;
}
.transaction-form__segments {
  display: flex;
  padding: 4px;
  background: #f4f5f7;
  border-radius: 10px;
}
.transaction-form__segments button {
  flex: 1;
  padding: 8px;
  color: var(--color-text-secondary);
  cursor: pointer;
  border: 0;
  border-radius: 8px;
  background: transparent;
}
.transaction-form__segments button[aria-pressed='true'] {
  color: var(--color-text);
  background: var(--color-primary);
  font-weight: 600;
}
.transaction-form__segments button:disabled {
  cursor: default;
}
.transaction-form__readonly-type {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 12px;
}
.transaction-form__readonly-type strong {
  padding: 8px 22px;
  color: var(--color-text);
  background: var(--color-primary-soft);
  border-radius: 8px;
  font-size: 14px;
}
.transaction-form__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.transaction-form__field input,
.transaction-form__field textarea {
  width: 100%;
  padding: 10px 12px;
  color: var(--color-text);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  outline: none;
}
.transaction-form__field textarea {
  resize: vertical;
}
.transaction-form__field input:focus,
.transaction-form__field textarea:focus {
  border-color: var(--color-primary-active);
}
.transaction-form__field input:disabled,
.transaction-form__field textarea:disabled {
  background: #f4f5f7;
}
.transaction-form__category-option {
  display: flex;
  align-items: center;
  gap: 8px;
}
.transaction-form__error,
.transaction-form__hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
}
.transaction-form__error {
  color: var(--color-danger);
}
.transaction-form__hint {
  color: var(--color-text-secondary);
}
.transaction-form__error button {
  padding: 0;
  color: inherit;
  background: transparent;
  border: 0;
  text-decoration: underline;
  cursor: pointer;
}
.transaction-form__actions {
  position: sticky;
  bottom: 0;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 12px;
  background: var(--color-surface);
}
@media (max-width: 560px) {
  .transaction-form__row {
    grid-template-columns: 1fr;
  }
}
</style>
