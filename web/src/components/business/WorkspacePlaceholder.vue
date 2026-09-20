<script setup lang="ts">
/**
 * @author Brave
 * @date 2026-09-20T15:27:12+08:00
 * @description 列表和统计页共享的搜索区与数据区占位结构。
 */

interface Props {
  description: string
  title: string
}

const props = defineProps<Props>()
</script>

<template>
  <div class="workspace-placeholder">
    <!-- 后续承载账单查询条件的左侧搜索区 -->
    <aside class="workspace-placeholder__panel workspace-placeholder__filters">
      <span class="workspace-placeholder__kicker">FILTERS</span>
      <h1>{{ props.title }}</h1>
      <p>{{ props.description }}</p>
      <div class="workspace-placeholder__search" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </aside>
    <!-- 后续承载列表或图表的弹性数据区 -->
    <section class="workspace-placeholder__panel workspace-placeholder__data" aria-label="数据展示区域">
      <div class="workspace-placeholder__empty-mark">¥</div>
      <h2>功能即将上线</h2>
      <p>当前版本已完成页面结构与鉴权流程，业务数据将在后续迭代中接入。</p>
    </section>
  </div>
</template>

<style scoped>
/* PC 双栏工作区，搜索区固定宽度、数据区占据剩余空间 */
.workspace-placeholder {
  display: grid;
  grid-template-columns: minmax(260px, 320px) minmax(0, 1fr);
  gap: var(--space-page);
  min-height: calc(100vh - 32px);
}

.workspace-placeholder__panel {
  background: var(--color-surface);
  border: 1px solid rgb(230 232 236 / 80%);
  border-radius: var(--radius-card);
  box-shadow: 0 8px 30px rgb(32 33 36 / 4%);
}

/* 左侧搜索区占位骨架 */
.workspace-placeholder__filters {
  padding: 32px 28px;
}

.workspace-placeholder__kicker {
  color: #a48f00;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.16em;
}

.workspace-placeholder__filters h1 {
  margin: 12px 0 10px;
  font-size: 28px;
}

.workspace-placeholder__filters p,
.workspace-placeholder__data p {
  color: var(--color-text-secondary);
  font-size: 14px;
  line-height: 1.7;
}

.workspace-placeholder__search {
  display: grid;
  gap: 12px;
  margin-top: 34px;
}

.workspace-placeholder__search span {
  display: block;
  height: 42px;
  background: #f5f6f7;
  border: 1px solid #eceef0;
  border-radius: 11px;
}

.workspace-placeholder__search span:last-child {
  width: 52%;
  background: var(--color-primary-soft);
  border-color: var(--color-primary);
}

/* 右侧数据区空状态 */
.workspace-placeholder__data {
  display: grid;
  align-content: center;
  justify-items: center;
  padding: 48px;
  text-align: center;
}

.workspace-placeholder__empty-mark {
  display: grid;
  width: 72px;
  height: 72px;
  margin-bottom: 20px;
  color: #6f6200;
  font-size: 30px;
  font-weight: 700;
  background: var(--color-primary-soft);
  border-radius: 24px;
  place-items: center;
}

.workspace-placeholder__data h2 {
  margin: 0;
  font-size: 20px;
}

.workspace-placeholder__data p {
  max-width: 420px;
  margin: 10px 0 0;
}

/* 窄桌面下改为纵向排列，仍保留 PC 导航结构 */
@media (max-width: 1023px) {
  .workspace-placeholder {
    grid-template-columns: 1fr;
  }

  .workspace-placeholder__data {
    min-height: 420px;
  }
}
</style>
