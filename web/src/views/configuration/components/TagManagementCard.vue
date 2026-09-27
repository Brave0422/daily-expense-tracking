<script setup lang="ts">
/**
 * @author Brave
 * @date 2026-09-27T18:34:34+08:00
 * @description 标签管理卡片，负责标签列表搜索、增改弹窗编排及逻辑删除反馈。
 */

import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Button as TButton, Dialog as TDialog, MessagePlugin } from 'tdesign-vue-next'

import { deleteTag, getUserTags, searchUserTags } from '@/api/tag.api'
import type { UserTag } from '@/api/tag.types'
import { normalizeApiError } from '@/api/http'
import BaseIcon from '@/components/base/BaseIcon.vue'

import TagFormDialog from './TagFormDialog.vue'
import TagListItem from './TagListItem.vue'

const SEARCH_DEBOUNCE_MS = 300

const tags = ref<UserTag[]>([])
const isLoading = ref(false)
const loadError = ref('')
const searchKeyword = ref('')
const activeSearchKey = ref('')
const isFormVisible = ref(false)
const formMode = ref<'create' | 'edit'>('create')
const editingTag = ref<UserTag | null>(null)
const isDeleteDialogVisible = ref(false)
const deletingTag = ref<UserTag | null>(null)
const isDeleting = ref(false)
const deleteError = ref('')
let requestSequence = 0
let searchTimerId: number | null = null

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
const isSearchActive = computed(() => activeSearchKey.value.length > 0)

function clearSearchTimer(): void {
  if (searchTimerId !== null) {
    window.clearTimeout(searchTimerId)
    searchTimerId = null
  }
}

/** 按关键词加载标签，并阻止较旧请求覆盖最新列表。 */
async function loadTags(key = ''): Promise<void> {
  const normalizedKey = key.trim()
  const currentSequence = ++requestSequence
  activeSearchKey.value = normalizedKey
  isLoading.value = true
  loadError.value = ''

  try {
    const result = normalizedKey ? await searchUserTags(normalizedKey) : await getUserTags()
    if (currentSequence === requestSequence) {
      tags.value = result
    }
  } catch (error) {
    if (currentSequence === requestSequence) {
      loadError.value = normalizeApiError(
        error,
        normalizedKey ? '标签搜索失败，请稍后重试' : '标签加载失败，请稍后重试',
      ).message
    }
  } finally {
    if (currentSequence === requestSequence) {
      isLoading.value = false
    }
  }
}

function handleSearchInput(event: Event): void {
  const value = (event.target as HTMLInputElement).value
  searchKeyword.value = value
  clearSearchTimer()

  // 输入一旦变化，立即让在途旧请求失效，等待防抖结束后加载最新关键词。
  requestSequence += 1
  loadError.value = ''
  searchTimerId = window.setTimeout(async () => {
    searchTimerId = null
    await loadTags(value)
  }, SEARCH_DEBOUNCE_MS)
}

async function handleSearchSubmit(): Promise<void> {
  clearSearchTimer()
  await loadTags(searchKeyword.value)
}

async function handleRetry(): Promise<void> {
  clearSearchTimer()
  await loadTags(searchKeyword.value)
}

function handleOpenCreate(): void {
  formMode.value = 'create'
  editingTag.value = null
  isFormVisible.value = true
}

function handleOpenEdit(tag: UserTag): void {
  formMode.value = 'edit'
  editingTag.value = tag
  isFormVisible.value = true
}

async function handleFormSuccess(): Promise<void> {
  clearSearchTimer()
  await loadTags(searchKeyword.value)
}

function handleOpenDelete(tag: UserTag): void {
  deletingTag.value = tag
  deleteError.value = ''
  isDeleteDialogVisible.value = true
}

function handleCloseDelete(): void {
  if (isDeleting.value) {
    return
  }

  isDeleteDialogVisible.value = false
  deletingTag.value = null
  deleteError.value = ''
}

async function handleDelete(): Promise<void> {
  const tag = deletingTag.value
  if (!tag || isDeleting.value) {
    return
  }

  isDeleting.value = true
  deleteError.value = ''
  let isDeleted = false
  try {
    await deleteTag(tag.id)
    isDeleted = true
    await MessagePlugin.success('标签删除成功')
  } catch (error) {
    deleteError.value = normalizeApiError(error, '标签删除失败，请稍后重试').message
  } finally {
    isDeleting.value = false
  }

  if (isDeleted) {
    handleCloseDelete()
    clearSearchTimer()
    await loadTags(searchKeyword.value)
  }
}

onMounted(async () => {
  await loadTags()
})

onBeforeUnmount(() => {
  clearSearchTimer()
  requestSequence += 1
})
</script>

<template>
  <section class="tag-card" aria-labelledby="tag-card-title">
    <header class="tag-card__top">
      <div class="tag-card__heading">
        <div>
          <span class="tag-card__eyebrow">TAG</span>
          <h2 id="tag-card-title">标签管理</h2>
        </div>
        <span class="tag-card__count">{{ tags.length }} 个标签</span>
      </div>

      <form class="tag-card__toolbar" role="search" @submit.prevent="handleSearchSubmit">
        <label class="tag-card__search" for="tag-search-keyword">
          <BaseIcon name="search" :size="17" />
          <input
            id="tag-search-keyword"
            autocomplete="off"
            maxlength="50"
            placeholder="搜索标签"
            type="search"
            :value="searchKeyword"
            @input="handleSearchInput"
          />
        </label>

        <div class="tag-card__add-area">
          <button class="tag-card__add-button" type="button" @click="handleOpenCreate">
            <BaseIcon name="add" :size="18" />
            <span>添加标签</span>
          </button>
        </div>
      </form>
    </header>

    <!-- 标签展示区固定占用剩余高度，仅该区域承接列表滚动。 -->
    <div class="tag-card__content">
      <div v-if="isLoading" class="tag-card__state" role="status">
        <span class="tag-card__spinner" aria-hidden="true" />
        {{ isSearchActive ? '正在搜索标签...' : '正在加载标签...' }}
      </div>

      <div v-else-if="loadError" class="tag-card__state tag-card__state--error" role="alert">
        <p>{{ loadError }}</p>
        <TButton theme="default" type="button" @click="handleRetry">重新加载</TButton>
      </div>

      <div v-else-if="tags.length === 0" class="tag-card__state">
        <BaseIcon class="tag-card__empty-icon" name="emptyData" :size="64" />
        <p>{{ isSearchActive ? '未找到匹配标签' : '暂无标签' }}</p>
        <button v-if="!isSearchActive" type="button" @click="handleOpenCreate">
          添加第一个标签
        </button>
      </div>

      <ul v-else class="tag-list">
        <TagListItem
          v-for="tag in tags"
          :key="tag.id"
          :tag="tag"
          @delete="handleOpenDelete"
          @edit="handleOpenEdit"
        />
      </ul>
    </div>

    <TagFormDialog
      v-model:visible="isFormVisible"
      :mode="formMode"
      :tag="editingTag"
      @submit-success="handleFormSuccess"
    />

    <TDialog
      v-model:visible="deleteDialogVisible"
      :close-btn="!isDeleting"
      :close-on-overlay-click="!isDeleting"
      dialog-class-name="tag-delete-dialog"
      :footer="false"
      header="删除标签"
      width="440px"
    >
      <div class="tag-delete-dialog__content">
        <p>
          确定要删除“<strong class="tag-delete-dialog__target">{{ deletingTag?.name }}</strong
          >”标签吗？
        </p>
        <p v-if="deleteError" class="tag-delete-dialog__error" role="alert">
          {{ deleteError }}
        </p>
        <div class="tag-delete-dialog__actions">
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
.tag-card {
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

.tag-card__top {
  flex: none;
}

.tag-card__heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}

.tag-card__eyebrow {
  color: #a48f00;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.16em;
}

.tag-card__heading h2 {
  margin: 7px 0 0;
  font-size: 21px;
}

.tag-card__count {
  flex: none;
  color: var(--color-text-secondary);
  font-size: 12px;
}

.tag-card__toolbar {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 22px;
}

.tag-card__search {
  display: flex;
  min-width: 0;
  min-height: 38px;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  color: var(--color-icon);
  background: #f8f9fa;
  border: 1px solid var(--color-border);
  border-radius: 11px;
  cursor: text;
  transition:
    background-color 0.2s,
    border-color 0.2s,
    box-shadow 0.2s;
}

.tag-card__search:focus-within {
  background: var(--color-surface);
  border-color: var(--color-primary-active);
  box-shadow: 0 0 0 3px rgb(255 230 57 / 20%);
}

.tag-card__search input {
  width: 100%;
  min-width: 0;
  padding: 0;
  color: var(--color-text-secondary);
  background: transparent;
  border: 0;
  outline: 0;
  cursor: text;
}

.tag-card__search input::placeholder {
  color: #a9acb2;
  opacity: 1;
}

.tag-card__search input::-webkit-search-cancel-button {
  cursor: pointer;
}

.tag-card__add-area {
  display: flex;
  justify-content: flex-end;
}

.tag-card__add-button {
  display: flex;
  min-width: 112px;
  min-height: 38px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 12px;
  color: #514700;
  font-size: 13px;
  font-weight: 600;
  background: var(--color-primary-soft);
  border: 1px solid var(--color-primary);
  border-radius: 9px;
  cursor: pointer;
}

.tag-card__add-button:hover {
  background: var(--color-primary);
}

.tag-card__content {
  min-height: 0;
  flex: 1;
  margin-top: 20px;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
}

.tag-card__state {
  display: grid;
  min-height: 100%;
  align-content: center;
  justify-items: center;
  gap: 12px;
  color: var(--color-text-secondary);
  font-size: 14px;
  text-align: center;
}

.tag-card__state p {
  margin: 0;
}

.tag-card__state--error {
  color: var(--color-danger);
}

.tag-card__state > button {
  padding: 0;
  color: #8b7900;
  background: transparent;
  border: 0;
  cursor: pointer;
  text-decoration: underline;
}

.tag-card__spinner {
  width: 28px;
  height: 28px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary-active);
  border-radius: 50%;
  animation: tag-spin 0.8s linear infinite;
}

.tag-card__empty-icon {
  margin-bottom: 2px;
}

.tag-list {
  display: flex;
  align-content: flex-start;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 14px 10px;
  padding: 6px 8px 24px 2px;
  margin: 0;
  list-style: none;
}

.tag-delete-dialog__content {
  display: grid;
  gap: 12px;
}

.tag-delete-dialog__content p {
  margin: 0;
  line-height: 1.7;
}

.tag-delete-dialog__target {
  font-weight: 700;
}

.tag-delete-dialog__error {
  padding: 10px 12px;
  color: var(--color-danger);
  font-size: 13px;
  background: #fff2f1;
  border-radius: 10px;
}

.tag-delete-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 8px;
}

/* 弹窗挂载到 body，通过唯一业务类限制圆角覆盖范围。 */
:global(.tag-delete-dialog.t-dialog) {
  border-radius: 18px;
}

@keyframes tag-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
