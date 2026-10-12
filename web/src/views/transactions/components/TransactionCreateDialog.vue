<script setup lang="ts">
/**
 * @author Brave
 * @date 2026-10-12T22:10:43+08:00
 * @description 新增流水弹窗，加载可用分类标签、校验录入信息并提交，成功后通知页面刷新。
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
import { createTransaction } from '@/api/transaction.api'
import CategoryIcon from '@/components/business/CategoryIcon.vue'
import { isValidFilterAmount, isZeroAmount } from '@/utils/money'

const props = defineProps<{ visible: boolean }>()
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
    (category) => !category.archived && category.level === 1,
  ),
)
const selectableCategories = computed(() =>
  type.value === 'expense'
    ? categories.value.flatMap((category) =>
        category.children.filter(
          (child) => !child.archived && child.level === 2 && child.type === 'expense',
        ),
      )
    : categories.value,
)
const categoryOptions = computed(() =>
  type.value === 'expense'
    ? categories.value
        .map((category) => ({
          value: category.id,
          label: category.name,
          children: category.children
            .filter((child) => selectableCategories.value.includes(child))
            .map((child) => ({ value: child.id, label: child.name })),
        }))
        .filter((category) => category.children.length > 0)
    : categories.value.map((category) => ({ value: category.id, label: category.name })),
)
const categoryById = computed(
  () =>
    new Map<number, UserCategory>(
      categories.value
        .flatMap((category) => [category, ...category.children])
        .map((category) => [category.id, category]),
    ),
)
const tagOptions = computed(() => tags.value.map((tag) => ({ value: tag.id, label: tag.name })))

/** 每次打开使用本地自然日期，补录日期按原字符串提交。 */
function resetForm(): void {
  const today = new Date()
  type.value = 'expense'
  categoryId.value = undefined
  amount.value = ''
  occurredDate.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  title.value = ''
  tagIds.value = []
  remark.value = ''
  errors.value = {}
  formMessage.value = ''
}

/** 每次打开重载未归档选项，关闭或重新打开后丢弃旧请求结果。 */
async function loadOptions(): Promise<void> {
  const sequence = ++optionsSequence
  isOptionsLoading.value = true
  expenseError.value = ''
  incomeError.value = ''
  tagError.value = ''
  const [expense, income, tagResult] = await Promise.allSettled([
    getUserCategories('expense'),
    getUserCategories('income'),
    getUserTags(),
  ])
  if (!isActive || sequence !== optionsSequence) return
  if (expense.status === 'fulfilled') expenseCategories.value = expense.value
  else expenseError.value = normalizeApiError(expense.reason, '支出分类加载失败').message
  if (income.status === 'fulfilled') incomeCategories.value = income.value
  else incomeError.value = normalizeApiError(income.reason, '收入分类加载失败').message
  if (tagResult.status === 'fulfilled') tags.value = tagResult.value.filter((tag) => !tag.archived)
  else tagError.value = normalizeApiError(tagResult.reason, '标签加载失败').message
  isOptionsLoading.value = false
}

function handleTypeChange(value: CategoryType): void {
  if (isSubmitting.value || value === type.value) return
  type.value = value
  categoryId.value = undefined
  errors.value.category = ''
}
function handleCategoryChange(value: unknown): void {
  categoryId.value = typeof value === 'number' ? value : undefined
  errors.value.category = ''
}
function handleDateChange(value: unknown): void {
  occurredDate.value = typeof value === 'string' ? value : ''
  errors.value.date = ''
}
function handleTagChange(value: unknown): void {
  tagIds.value = Array.isArray(value)
    ? [...new Set(value.filter((id): id is number => typeof id === 'number'))]
    : []
}

/** 与后端保持金额精度、真实日期及 Unicode 字符长度约束。 */
function validateForm(): boolean {
  const nextErrors: typeof errors.value = {}
  if (!selectableCategories.value.some((category) => category.id === categoryId.value)) {
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

/** 提交期间阻止重复提交及关闭；失败保留草稿，成功交给页面刷新当前查询。 */
async function handleSubmit(): Promise<void> {
  if (isSubmitting.value || isOptionsLoading.value) return
  formMessage.value = ''
  if (!validateForm() || categoryId.value === undefined || categoryError.value) return
  isSubmitting.value = true
  let isSubmitted = false
  try {
    await createTransaction({
      type: type.value,
      categoryId: categoryId.value,
      amount: amount.value.trim(),
      occurredDate: occurredDate.value,
      title: title.value.trim() || null,
      tagIds: [...tagIds.value],
      remark: remark.value.trim() || null,
    })
    isSubmitted = true
  } catch (error) {
    if (isActive) formMessage.value = normalizeApiError(error, '创建流水失败，请重试').message
  } finally {
    if (isActive) isSubmitting.value = false
  }
  if (isSubmitted && isActive) {
    dialogVisible.value = false
    emit('submit-success')
    await MessagePlugin.success('流水创建成功')
  }
}

watch(
  () => props.visible,
  (visible) => {
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
    header="新增流水"
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
        <div class="transaction-form__segments" role="group" aria-label="流水类型">
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
        <label id="create-transaction-category-label">分类 <span>*</span></label>
        <TCascader
          :value="categoryId"
          :options="categoryOptions"
          :loading="isOptionsLoading"
          :disabled="isSubmitting || isOptionsLoading || Boolean(categoryError)"
          :check-strictly="false"
          clearable
          filterable
          aria-labelledby="create-transaction-category-label"
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
          <label for="create-transaction-amount">金额（元） <span>*</span></label>
          <input
            id="create-transaction-amount"
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
          <label id="create-transaction-date-label">发生日期 <span>*</span></label>
          <TDatePicker
            :value="occurredDate"
            format="YYYY-MM-DD"
            value-type="YYYY-MM-DD"
            :disabled="isSubmitting"
            clearable
            aria-labelledby="create-transaction-date-label"
            @change="handleDateChange"
          />
          <p v-if="errors.date" class="transaction-form__error" role="alert">{{ errors.date }}</p>
        </div>
      </div>
      <div class="transaction-form__field">
        <label for="create-transaction-title">标题</label>
        <input
          id="create-transaction-title"
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
        <label id="create-transaction-tags-label">标签</label>
        <TSelect
          :value="tagIds"
          :options="tagOptions"
          multiple
          clearable
          filterable
          :loading="isOptionsLoading"
          :disabled="isSubmitting || isOptionsLoading || Boolean(tagError)"
          aria-labelledby="create-transaction-tags-label"
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
        <label for="create-transaction-remark">备注</label>
        <textarea
          id="create-transaction-remark"
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
