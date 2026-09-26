<script setup lang="ts">
/**
 * @author Brave
 * @date 2026-09-26T16:08:48+08:00
 * @description 分类管理卡片，负责收支切换、分类树加载、弹窗编排及逻辑删除反馈。
 */

import { computed, onMounted, reactive, ref } from 'vue'
import { Button as TButton, Dialog as TDialog, MessagePlugin } from 'tdesign-vue-next'

import { deleteCategory, getUserCategories } from '@/api/category.api'
import type { CategoryType, UserCategory, UserCategoryTreeItem } from '@/api/category.types'
import { normalizeApiError } from '@/api/http'
import BaseIcon from '@/components/base/BaseIcon.vue'

import CategoryFormDialog from './CategoryFormDialog.vue'
import CategoryIcon from './CategoryIcon.vue'

const activeType = ref<CategoryType>('expense')
const categoriesByType = reactive<Record<CategoryType, UserCategoryTreeItem[]>>({
  expense: [],
  income: [],
})
const isLoadingByType = reactive<Record<CategoryType, boolean>>({
  expense: false,
  income: false,
})
const hasLoadedByType = reactive<Record<CategoryType, boolean>>({
  expense: false,
  income: false,
})
const loadErrorByType = reactive<Record<CategoryType, string>>({
  expense: '',
  income: '',
})
const expandedCategoryIds = ref<Set<number>>(new Set())

const isFormVisible = ref(false)
const formMode = ref<'create' | 'edit'>('create')
const editingCategory = ref<UserCategory | null>(null)

const isDeleteDialogVisible = ref(false)
const deletingCategory = ref<UserCategory | null>(null)
const deletingParentName = ref('')
const isDeleting = ref(false)
const deleteError = ref('')
const deleteDialogVisible = computed({
  get: () => isDeleteDialogVisible.value,
  set: (visible: boolean) => {
    if (visible) {
      isDeleteDialogVisible.value = true
      return
    }
    handleCloseDelete()
  },
})

const requestSequenceByType: Record<CategoryType, number> = {
  expense: 0,
  income: 0,
}

const visibleCategories = computed(() => categoriesByType[activeType.value])
const isLoading = computed(() => isLoadingByType[activeType.value])
const loadError = computed(() => loadErrorByType[activeType.value])
const deleteTargetDescription = computed(() => {
  if (!deletingCategory.value) {
    return ''
  }

  const categoryName = `“${deletingCategory.value.name}”`
  return deletingCategory.value.level === 2
    ? `${categoryName}分类（父类：${deletingParentName.value}）`
    : `${categoryName}分类`
})

/**
 * 加载指定收支类型的分类树，并阻止较旧请求覆盖较新结果。
 * @param type - 需要加载的支出或收入分类类型
 */
async function loadCategories(type: CategoryType): Promise<void> {
  const currentSequence = ++requestSequenceByType[type]
  isLoadingByType[type] = true
  loadErrorByType[type] = ''

  try {
    const categories = await getUserCategories(type)
    if (currentSequence !== requestSequenceByType[type]) {
      return
    }
    categoriesByType[type] = categories
    hasLoadedByType[type] = true
  } catch (error) {
    if (currentSequence === requestSequenceByType[type]) {
      loadErrorByType[type] = normalizeApiError(error, '分类加载失败，请稍后重试').message
    }
  } finally {
    if (currentSequence === requestSequenceByType[type]) {
      isLoadingByType[type] = false
    }
  }
}

async function handleTypeChange(type: CategoryType): Promise<void> {
  if (activeType.value === type) {
    return
  }

  activeType.value = type
  expandedCategoryIds.value = new Set()
  await loadCategories(type)
}

function handleToggleCategory(category: UserCategoryTreeItem): void {
  if (category.children.length === 0) {
    return
  }

  const nextExpandedIds = new Set(expandedCategoryIds.value)
  if (nextExpandedIds.has(category.id)) {
    nextExpandedIds.delete(category.id)
  } else {
    nextExpandedIds.add(category.id)
  }
  expandedCategoryIds.value = nextExpandedIds
}

async function handleOpenCreate(): Promise<void> {
  formMode.value = 'create'
  editingCategory.value = null
  isFormVisible.value = true

  if (!hasLoadedByType.expense && !isLoadingByType.expense) {
    await loadCategories('expense')
  }
}

function handleOpenEdit(category: UserCategory): void {
  formMode.value = 'edit'
  editingCategory.value = category
  isFormVisible.value = true
}

async function handleFormSuccess(type: CategoryType): Promise<void> {
  activeType.value = type
  await loadCategories(type)
}

function handleOpenDelete(category: UserCategory, parentName = ''): void {
  deletingCategory.value = category
  deletingParentName.value = parentName
  deleteError.value = ''
  isDeleteDialogVisible.value = true
}

function handleCloseDelete(): void {
  if (isDeleting.value) {
    return
  }

  isDeleteDialogVisible.value = false
  deletingCategory.value = null
  deletingParentName.value = ''
  deleteError.value = ''
}

async function handleDelete(): Promise<void> {
  const category = deletingCategory.value
  if (!category || isDeleting.value) {
    return
  }

  isDeleting.value = true
  deleteError.value = ''
  let isDeleted = false
  try {
    await deleteCategory(category.id)
    isDeleted = true
    await MessagePlugin.success('分类删除成功')
  } catch (error) {
    deleteError.value = normalizeApiError(error, '分类删除失败，请稍后重试').message
  } finally {
    isDeleting.value = false
  }

  if (isDeleted) {
    handleCloseDelete()
    await loadCategories(category.type)
  }
}

onMounted(() => loadCategories('expense'))
</script>

<template>
  <section class="category-card" aria-labelledby="category-card-title">
    <header class="category-card__top">
      <div class="category-card__heading">
        <div>
          <span class="category-card__eyebrow">CATEGORY</span>
          <h2 id="category-card-title">分类管理</h2>
        </div>
        <span class="category-card__count">{{ visibleCategories.length }} 个一级分类</span>
      </div>

      <!-- 左侧切换、中间新增、右侧重置固定为三个等宽操作区 -->
      <div class="category-card__toolbar">
        <div class="category-card__type-switch" aria-label="分类类型">
          <button
            :aria-pressed="activeType === 'expense'"
            type="button"
            @click="handleTypeChange('expense')"
          >
            支出
          </button>
          <button
            :aria-pressed="activeType === 'income'"
            type="button"
            @click="handleTypeChange('income')"
          >
            收入
          </button>
        </div>

        <button class="category-card__toolbar-button" type="button" @click="handleOpenCreate">
          <BaseIcon name="add" :size="18" />
          <span>新增分类</span>
        </button>

        <button
          aria-label="重置分类功能暂不可用"
          class="category-card__toolbar-button"
          disabled
          title="重置分类功能开发中"
          type="button"
        >
          重置分类
        </button>
      </div>
    </header>

    <!-- 分类展示区固定占用剩余高度，仅该区域承接列表滚动。 -->
    <div class="category-card__content">
      <div v-if="isLoading" class="category-card__state" role="status">
        <span class="category-card__spinner" aria-hidden="true" />
        正在加载{{ activeType === 'expense' ? '支出' : '收入' }}分类...
      </div>

      <div
        v-else-if="loadError"
        class="category-card__state category-card__state--error"
        role="alert"
      >
        <p>{{ loadError }}</p>
        <TButton theme="default" type="button" @click="loadCategories(activeType)">
          重新加载
        </TButton>
      </div>

      <div v-else-if="visibleCategories.length === 0" class="category-card__state">
        <span class="category-card__empty-mark">+</span>
        <p>暂无{{ activeType === 'expense' ? '支出' : '收入' }}分类</p>
        <button type="button" @click="handleOpenCreate">创建第一个分类</button>
      </div>

      <ul v-else class="category-list">
        <li v-for="category in visibleCategories" :key="category.id" class="category-list__group">
          <div class="category-item category-item--parent">
            <button
              :aria-expanded="
                category.children.length > 0 ? expandedCategoryIds.has(category.id) : undefined
              "
              class="category-item__content"
              :class="{ 'category-item__content--static': category.children.length === 0 }"
              type="button"
              @click="handleToggleCategory(category)"
            >
              <span
                v-if="category.children.length > 0"
                aria-hidden="true"
                class="category-item__chevron"
                :class="{
                  'category-item__chevron--expanded': expandedCategoryIds.has(category.id),
                }"
              >
                ›
              </span>
              <span v-else class="category-item__chevron-placeholder" />
              <CategoryIcon
                :background-color="category.backgroundColor"
                :icon-key="category.iconKey"
                :size="36"
              />
              <span class="category-item__name">{{ category.name }}</span>
            </button>

            <div class="category-item__actions">
              <button
                :aria-label="`编辑分类 ${category.name}`"
                class="category-item__action"
                title="编辑"
                type="button"
                @click="handleOpenEdit(category)"
              >
                <BaseIcon name="edit" :size="18" />
              </button>
              <span
                :aria-label="`分类 ${category.name} 的拖拽排序功能暂不可用`"
                aria-disabled="true"
                class="category-item__action category-item__action--disabled"
                role="img"
                title="拖拽排序功能开发中"
              >
                <BaseIcon name="reorder" :size="18" />
              </span>
              <button
                :aria-label="`删除分类 ${category.name}`"
                class="category-item__action category-item__action--danger"
                title="删除"
                type="button"
                @click="handleOpenDelete(category)"
              >
                <BaseIcon name="delete" :size="18" />
              </button>
            </div>
          </div>

          <ul
            v-if="category.children.length > 0 && expandedCategoryIds.has(category.id)"
            class="category-list__children"
          >
            <li v-for="child in category.children" :key="child.id" class="category-item">
              <div class="category-item__content category-item__content--child">
                <CategoryIcon
                  :background-color="child.backgroundColor"
                  :icon-key="child.iconKey"
                  :size="32"
                />
                <span class="category-item__name">{{ child.name }}</span>
              </div>

              <div class="category-item__actions">
                <button
                  :aria-label="`编辑分类 ${child.name}`"
                  class="category-item__action"
                  title="编辑"
                  type="button"
                  @click="handleOpenEdit(child)"
                >
                  <BaseIcon name="edit" :size="17" />
                </button>
                <span
                  :aria-label="`分类 ${child.name} 的拖拽排序功能暂不可用`"
                  aria-disabled="true"
                  class="category-item__action category-item__action--disabled"
                  role="img"
                  title="拖拽排序功能开发中"
                >
                  <BaseIcon name="reorder" :size="17" />
                </span>
                <button
                  :aria-label="`删除分类 ${child.name}`"
                  class="category-item__action category-item__action--danger"
                  title="删除"
                  type="button"
                  @click="handleOpenDelete(child, category.name)"
                >
                  <BaseIcon name="delete" :size="17" />
                </button>
              </div>
            </li>
          </ul>
        </li>
      </ul>
    </div>

    <CategoryFormDialog
      v-model:visible="isFormVisible"
      :category="editingCategory"
      :mode="formMode"
      :parent-categories="categoriesByType.expense"
      @submit-success="handleFormSuccess"
    />

    <TDialog
      v-model:visible="deleteDialogVisible"
      :close-btn="!isDeleting"
      :close-on-overlay-click="!isDeleting"
      dialog-class-name="category-delete-dialog"
      :footer="false"
      header="删除分类"
      width="440px"
    >
      <div class="delete-dialog">
        <p>
          确定要删除<strong class="delete-dialog__target">{{ deleteTargetDescription }}</strong
          >吗？
        </p>
        <p class="delete-dialog__hint">删除后，该分类将不能再用于新账单。</p>
        <p v-if="deleteError" class="delete-dialog__error" role="alert">{{ deleteError }}</p>
        <div class="delete-dialog__actions">
          <TButton :disabled="isDeleting" theme="default" type="button" @click="handleCloseDelete">
            取消
          </TButton>
          <TButton :loading="isDeleting" theme="danger" type="button" @click="handleDelete">
            确认删除
          </TButton>
        </div>
      </div>
    </TDialog>
  </section>
</template>

<style scoped>
.category-card {
  display: flex;
  height: 100%;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  padding: 24px;
  overflow: hidden;
  background: var(--color-surface);
  border: 1px solid rgb(230 232 236 / 80%);
  border-radius: var(--radius-card);
  box-shadow: 0 8px 30px rgb(32 33 36 / 4%);
}

.category-card__top {
  flex: none;
}

.category-card__content {
  min-height: 0;
  flex: 1;
  margin-top: 20px;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
}

.category-card__heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}

.category-card__eyebrow {
  color: #a48f00;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.16em;
}

.category-card__heading h2 {
  margin: 7px 0 0;
  font-size: 21px;
}

.category-card__count {
  flex: none;
  color: var(--color-text-secondary);
  font-size: 12px;
}

.category-card__toolbar {
  display: grid;
  grid-template-columns: minmax(112px, 1fr) minmax(112px, 1fr) minmax(92px, 1fr);
  gap: 8px;
  margin-top: 22px;
}

.category-card__type-switch {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  padding: 3px;
  background: #f1f2f4;
  border-radius: 11px;
}

.category-card__type-switch button,
.category-card__toolbar-button {
  min-height: 38px;
  border-radius: 9px;
}

.category-card__type-switch button {
  padding: 0 8px;
  color: var(--color-text-secondary);
  background: transparent;
  border: 0;
  cursor: pointer;
}

.category-card__type-switch button[aria-pressed='true'] {
  color: var(--color-text);
  font-weight: 700;
  background: var(--color-surface);
  box-shadow: 0 2px 8px rgb(32 33 36 / 8%);
}

.category-card__toolbar-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 10px;
  color: #514700;
  font-size: 13px;
  font-weight: 600;
  background: var(--color-primary-soft);
  border: 1px solid var(--color-primary);
  cursor: pointer;
}

.category-card__toolbar-button:hover:not(:disabled) {
  background: var(--color-primary);
}

.category-card__toolbar-button:disabled {
  color: #a9acb2;
  background: #f3f4f5;
  border-color: var(--color-border);
  cursor: not-allowed;
}

.category-card__state {
  display: grid;
  min-height: 100%;
  align-content: center;
  justify-items: center;
  gap: 12px;
  color: var(--color-text-secondary);
  font-size: 14px;
  text-align: center;
}

.category-card__state p {
  margin: 0;
}

.category-card__state--error {
  color: var(--color-danger);
}

.category-card__spinner {
  width: 28px;
  height: 28px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary-active);
  border-radius: 50%;
  animation: category-spin 0.8s linear infinite;
}

.category-card__empty-mark {
  display: grid;
  width: 58px;
  height: 58px;
  color: #776900;
  font-size: 30px;
  background: var(--color-primary-soft);
  border-radius: 18px;
  place-items: center;
}

.category-card__state > button {
  padding: 0;
  color: #8b7900;
  background: transparent;
  border: 0;
  cursor: pointer;
  text-decoration: underline;
}

.category-list,
.category-list__children {
  padding: 0;
  margin: 0;
  list-style: none;
}

.category-list {
  display: grid;
  gap: 13px;
  padding-bottom: 24px;
}

.category-list__group {
  overflow: hidden;
  background: #f8f9fa;
  border: 1px solid #eceef0;
  border-radius: 13px;
}

.category-item {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  min-height: 56px;
  padding: 8px 10px;
}

.category-item--parent {
  min-height: 62px;
}

.category-item__content {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 9px;
  padding: 0;
  text-align: left;
  background: transparent;
  border: 0;
  cursor: pointer;
}

.category-item__content--static {
  cursor: default;
}

.category-item__content--child {
  padding-left: 28px;
  cursor: default;
}

.category-item__chevron {
  flex: none;
  width: 12px;
  color: var(--color-text-secondary);
  font-size: 22px;
  line-height: 1;
  transform: rotate(0deg);
  transition: transform 0.2s;
}

.category-item__chevron--expanded {
  transform: rotate(90deg);
}

.category-item__chevron-placeholder {
  width: 12px;
  flex: none;
}

.category-item__name {
  overflow: hidden;
  color: var(--color-text);
  font-size: 14px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.category-item__actions {
  display: flex;
  flex: none;
  align-items: center;
  gap: 2px;
}

.category-item__action {
  display: grid;
  width: 31px;
  height: 31px;
  padding: 0;
  color: var(--color-icon);
  background: transparent;
  border: 0;
  border-radius: 9px;
  cursor: pointer;
  place-items: center;
}

.category-item__action:hover {
  color: var(--color-text);
  background: var(--color-surface);
}

.category-item__action--danger:hover {
  color: var(--color-danger);
  background: #fff2f1;
}

.category-item__action--danger {
  color: var(--color-danger);
}

.category-item__action--disabled {
  color: #c3c6ca;
  cursor: not-allowed;
  user-select: none;
}

.category-item__action--disabled:hover {
  color: #c3c6ca;
  background: transparent;
}

.category-list__children {
  border-top: 1px solid #eceef0;
}

.category-list__children .category-item + .category-item {
  border-top: 1px solid #eceef0;
}

.delete-dialog {
  display: grid;
  gap: 12px;
}

.delete-dialog p {
  margin: 0;
  line-height: 1.7;
}

.delete-dialog__target {
  font-weight: 700;
}

.delete-dialog__hint {
  color: var(--color-text-secondary);
  font-size: 13px;
}

.delete-dialog__error {
  padding: 10px 12px;
  color: var(--color-danger);
  font-size: 13px;
  background: #fff2f1;
  border-radius: 10px;
}

.delete-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 8px;
}

/* 弹窗挂载到 body，通过唯一业务类限制圆角覆盖范围。 */
:global(.category-delete-dialog.t-dialog) {
  border-radius: 18px;
}

@keyframes category-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
