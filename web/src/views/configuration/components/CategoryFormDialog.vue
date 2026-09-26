<script setup lang="ts">
/**
 * @author Brave
 * @date 2026-09-26T16:08:48+08:00
 * @description 分类新增与编辑弹窗，负责动态表单、图标选择、字段校验和提交反馈。
 */

import { computed, ref, watch } from 'vue'
import { Button as TButton, Dialog as TDialog, MessagePlugin } from 'tdesign-vue-next'

import { createCategory, getCategoryIcons, updateCategory } from '@/api/category.api'
import type {
  CategoryIconOption,
  CategoryLevel,
  CategoryType,
  UserCategory,
  UserCategoryTreeItem,
} from '@/api/category.types'
import { normalizeApiError } from '@/api/http'

import CategoryIconPickerDialog from './CategoryIconPickerDialog.vue'

type CategoryFormMode = 'create' | 'edit'

interface Props {
  category: UserCategory | null
  mode: CategoryFormMode
  parentCategories: UserCategoryTreeItem[]
  visible: boolean
}

interface CategoryFormErrors {
  iconKey?: string
  name?: string
  parentId?: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'submit-success': [type: CategoryType]
  'update:visible': [visible: boolean]
}>()

const name = ref('')
const type = ref<CategoryType>('expense')
const level = ref<CategoryLevel>(1)
const parentId = ref<number | null>(null)
const iconKey = ref('')
const errors = ref<CategoryFormErrors>({})
const formMessage = ref('')
const isSubmitting = ref(false)
const isIconPickerVisible = ref(false)
const iconOptions = ref<CategoryIconOption[]>([])
const isLoadingIcons = ref(false)
const iconLoadError = ref('')

const dialogVisible = computed({
  get: () => props.visible,
  set: (visible: boolean) => {
    if (!isSubmitting.value) {
      emit('update:visible', visible)
    }
  },
})
const dialogTitle = computed(() => (props.mode === 'create' ? '新增分类' : '编辑分类'))
const isCreateMode = computed(() => props.mode === 'create')

function resetForm(): void {
  name.value = ''
  type.value = 'expense'
  level.value = 1
  parentId.value = null
  iconKey.value = ''
  errors.value = {}
  formMessage.value = ''
  isIconPickerVisible.value = false
}

function initializeForm(): void {
  resetForm()
  if (props.mode === 'edit' && props.category) {
    name.value = props.category.name
    type.value = props.category.type
    level.value = props.category.level
    parentId.value = props.category.parentId
    iconKey.value = props.category.iconKey
  }
}

function handleTypeChange(nextType: CategoryType): void {
  if (type.value === nextType || isSubmitting.value) {
    return
  }

  type.value = nextType
  level.value = 1
  parentId.value = null
  errors.value.parentId = undefined
}

function handleLevelChange(nextLevel: CategoryLevel): void {
  if (isSubmitting.value || (type.value === 'income' && nextLevel === 2)) {
    return
  }

  level.value = nextLevel
  if (nextLevel === 1) {
    parentId.value = null
    errors.value.parentId = undefined
  }
}

function handleParentChange(event: Event): void {
  const value = (event.target as HTMLSelectElement).value
  parentId.value = value ? Number(value) : null
  errors.value.parentId = undefined
}

function validateForm(): boolean {
  const nextErrors: CategoryFormErrors = {}
  const trimmedName = name.value.trim()

  if (!trimmedName) {
    nextErrors.name = '请输入分类名称'
  } else if (trimmedName.length > 50) {
    nextErrors.name = '分类名称不能超过50个字符'
  }

  if (!iconKey.value) {
    nextErrors.iconKey = '请选择分类图标'
  }

  if (isCreateMode.value && level.value === 2 && parentId.value === null) {
    nextErrors.parentId = '请选择所属父类'
  }

  errors.value = nextErrors
  return Object.keys(nextErrors).length === 0
}

async function loadIconOptions(): Promise<void> {
  if (isLoadingIcons.value) {
    return
  }

  isLoadingIcons.value = true
  iconLoadError.value = ''
  try {
    iconOptions.value = await getCategoryIcons()
  } catch (error) {
    iconLoadError.value = normalizeApiError(error, '图标库加载失败，请稍后重试').message
  } finally {
    isLoadingIcons.value = false
  }
}

async function handleOpenIconPicker(): Promise<void> {
  if (isSubmitting.value) {
    return
  }

  isIconPickerVisible.value = true
  if (iconOptions.value.length === 0) {
    await loadIconOptions()
  }
}

function handleSelectIcon(selectedIconKey: string): void {
  iconKey.value = selectedIconKey
  errors.value.iconKey = undefined
}

async function handleSubmit(): Promise<void> {
  formMessage.value = ''
  if (!validateForm()) {
    return
  }

  if (!isCreateMode.value && !props.category) {
    formMessage.value = '缺少待编辑的分类信息，请关闭弹窗后重试'
    return
  }

  const trimmedName = name.value.trim()
  isSubmitting.value = true
  let submittedType: CategoryType | null = null
  try {
    if (isCreateMode.value) {
      await createCategory({
        type: type.value,
        name: trimmedName,
        iconKey: iconKey.value,
        ...(level.value === 2 && parentId.value !== null ? { parentId: parentId.value } : {}),
      })
      await MessagePlugin.success('分类创建成功')
    } else if (props.category) {
      await updateCategory({
        id: props.category.id,
        name: trimmedName,
        iconKey: iconKey.value,
      })
      await MessagePlugin.success('分类编辑成功')
    }

    submittedType = type.value
  } catch (error) {
    formMessage.value = normalizeApiError(
      error,
      isCreateMode.value ? '分类创建失败，请稍后重试' : '分类编辑失败，请稍后重试',
    ).message
  } finally {
    isSubmitting.value = false
  }

  if (submittedType) {
    emit('submit-success', submittedType)
    dialogVisible.value = false
  }
}

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      initializeForm()
    } else if (!isSubmitting.value) {
      resetForm()
    }
  },
)
</script>

<template>
  <TDialog
    v-model:visible="dialogVisible"
    :close-btn="!isSubmitting"
    :close-on-overlay-click="!isSubmitting"
    dialog-class-name="category-form-dialog"
    :footer="false"
    :header="dialogTitle"
    width="520px"
  >
    <form class="category-form" novalidate @submit.prevent="handleSubmit">
      <div class="category-form__field">
        <label for="category-name">分类名称</label>
        <input
          id="category-name"
          v-model="name"
          :aria-invalid="Boolean(errors.name)"
          :disabled="isSubmitting"
          maxlength="50"
          placeholder="请输入分类名称"
          type="text"
        />
        <p v-if="errors.name" class="category-form__error" role="alert">{{ errors.name }}</p>
      </div>

      <fieldset v-if="isCreateMode" class="category-form__field category-form__fieldset">
        <legend>分类类型</legend>
        <div class="category-form__segments">
          <button
            :aria-pressed="type === 'expense'"
            :disabled="isSubmitting"
            type="button"
            @click="handleTypeChange('expense')"
          >
            支出
          </button>
          <button
            :aria-pressed="type === 'income'"
            :disabled="isSubmitting"
            type="button"
            @click="handleTypeChange('income')"
          >
            收入
          </button>
        </div>
      </fieldset>

      <fieldset v-if="isCreateMode" class="category-form__field category-form__fieldset">
        <legend>分类等级</legend>
        <div class="category-form__segments">
          <button
            :aria-pressed="level === 1"
            :disabled="isSubmitting"
            type="button"
            @click="handleLevelChange(1)"
          >
            一级分类
          </button>
          <button
            :aria-pressed="level === 2"
            :disabled="isSubmitting || type === 'income'"
            type="button"
            @click="handleLevelChange(2)"
          >
            二级分类
          </button>
        </div>
      </fieldset>

      <div v-if="isCreateMode && type === 'expense' && level === 2" class="category-form__field">
        <label for="category-parent">所属父类</label>
        <div class="category-form__select-control">
          <select
            id="category-parent"
            :aria-invalid="Boolean(errors.parentId)"
            :disabled="isSubmitting || props.parentCategories.length === 0"
            :value="parentId ?? ''"
            @change="handleParentChange"
          >
            <option disabled value="">请选择一级分类</option>
            <option
              v-for="parentCategory in props.parentCategories"
              :key="parentCategory.id"
              :value="parentCategory.id"
            >
              {{ parentCategory.name }}
            </option>
          </select>
          <span aria-hidden="true" class="category-form__select-arrow" />
        </div>
        <p v-if="errors.parentId" class="category-form__error" role="alert">
          {{ errors.parentId }}
        </p>
        <p v-else-if="props.parentCategories.length === 0" class="category-form__hint">
          暂无可选一级分类，请先创建一级分类。
        </p>
      </div>

      <div class="category-form__field">
        <span class="category-form__label">分类图标</span>
        <button
          class="category-form__icon-value"
          :class="{ 'category-form__icon-value--empty': !iconKey }"
          :disabled="isSubmitting"
          type="button"
          @click="handleOpenIconPicker"
        >
          {{ iconKey || '选择图标' }}
        </button>
        <p v-if="errors.iconKey" class="category-form__error" role="alert">
          {{ errors.iconKey }}
        </p>
      </div>

      <p v-if="formMessage" class="category-form__message" role="alert">{{ formMessage }}</p>

      <div class="category-form__actions">
        <TButton
          :disabled="isSubmitting"
          theme="default"
          type="button"
          @click="dialogVisible = false"
        >
          取消
        </TButton>
        <TButton class="app-confirm-button" :loading="isSubmitting" theme="primary" type="submit">
          确认
        </TButton>
      </div>
    </form>

    <CategoryIconPickerDialog
      v-model:visible="isIconPickerVisible"
      :error="iconLoadError"
      :icons="iconOptions"
      :is-loading="isLoadingIcons"
      :selected-icon-key="iconKey"
      @confirm="handleSelectIcon"
      @retry="loadIconOptions"
    />
  </TDialog>
</template>

<style scoped>
.category-form {
  display: grid;
  gap: 18px;
  padding-top: 4px;
}

.category-form__field {
  display: grid;
  gap: 8px;
}

.category-form__field label,
.category-form__label,
.category-form__fieldset legend {
  color: var(--color-text);
  font-size: 14px;
  font-weight: 600;
}

.category-form__field input,
.category-form__field select,
.category-form__icon-value {
  width: 100%;
  min-height: 46px;
  padding: 0 14px;
  color: var(--color-text);
  background: #f8f9fa;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  outline: 0;
  transition:
    border-color 0.2s,
    box-shadow 0.2s,
    background-color 0.2s;
}

.category-form__field input:focus,
.category-form__field select:focus,
.category-form__icon-value:focus-visible {
  background: var(--color-surface);
  border-color: var(--color-primary-active);
  box-shadow: 0 0 0 3px rgb(255 230 57 / 20%);
}

.category-form__field input[aria-invalid='true'],
.category-form__field select[aria-invalid='true'] {
  border-color: var(--color-danger);
}

/* 使用自定义箭头为所属父类下拉框保留稳定的右侧间距。 */
.category-form__select-control {
  position: relative;
}

.category-form__select-control select {
  padding-right: 48px;
  appearance: none;
}

.category-form__select-arrow {
  position: absolute;
  top: 50%;
  right: 20px;
  width: 7px;
  height: 7px;
  border-right: 2px solid var(--color-text-secondary);
  border-bottom: 2px solid var(--color-text-secondary);
  pointer-events: none;
  transform: translateY(-70%) rotate(45deg);
}

.category-form__select-control select:disabled + .category-form__select-arrow {
  opacity: 0.45;
}

.category-form__fieldset {
  padding: 0;
  margin: 0;
  border: 0;
}

.category-form__fieldset legend {
  margin-bottom: 8px;
}

.category-form__segments {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  padding: 4px;
  background: #f1f2f4;
  border-radius: 13px;
}

.category-form__segments button {
  min-height: 40px;
  color: var(--color-text-secondary);
  background: transparent;
  border: 0;
  border-radius: 10px;
  cursor: pointer;
}

.category-form__segments button[aria-pressed='true'] {
  color: var(--color-text);
  font-weight: 700;
  background: var(--color-primary);
  box-shadow: 0 3px 10px rgb(32 33 36 / 8%);
}

.category-form__segments button:disabled {
  color: #b4b7bc;
  cursor: not-allowed;
  box-shadow: none;
}

.category-form__icon-value {
  overflow: hidden;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 13px;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.category-form__icon-value--empty {
  color: #8b7900;
  font-family: inherit;
  font-weight: 600;
  text-align: center;
  background: var(--color-primary-soft);
  border-color: var(--color-primary);
}

.category-form__field input:disabled,
.category-form__field select:disabled,
.category-form__icon-value:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

.category-form__error,
.category-form__hint,
.category-form__message {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
}

.category-form__error,
.category-form__message {
  color: var(--color-danger);
}

.category-form__hint {
  color: var(--color-text-secondary);
}

.category-form__message {
  padding: 10px 12px;
  background: #fff2f1;
  border-radius: 10px;
}

.category-form__actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 4px;
}

/* 弹窗挂载到 body，通过唯一业务类限制圆角覆盖范围。 */
:global(.category-form-dialog.t-dialog) {
  border-radius: 18px;
}
</style>
