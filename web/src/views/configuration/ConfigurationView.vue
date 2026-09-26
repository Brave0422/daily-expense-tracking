<script setup lang="ts">
/**
 * @author Brave
 * @date 2026-09-26T16:08:48+08:00
 * @description 配置管理页面，独立承载分类、标签事件和录入模板三个配置模块。
 */

import CategoryManagementCard from './components/CategoryManagementCard.vue'
</script>

<template>
  <section aria-label="配置管理" class="configuration-view">
    <!-- 三个配置模块为相互独立的页面区域，本期只实现最左侧分类管理 -->
    <div class="configuration-view__modules">
      <CategoryManagementCard />

      <section class="configuration-module" aria-labelledby="tag-event-title">
        <span class="configuration-module__eyebrow">TAG &amp; EVENT</span>
        <h2 id="tag-event-title">标签/事件管理</h2>
        <div class="configuration-module__placeholder" aria-hidden="true">
          <span>即将上线</span>
        </div>
      </section>

      <section class="configuration-module" aria-labelledby="template-title">
        <span class="configuration-module__eyebrow">TEMPLATE</span>
        <h2 id="template-title">录入模板管理</h2>
        <div class="configuration-module__placeholder" aria-hidden="true">
          <span>即将上线</span>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.configuration-view {
  height: calc(100vh - var(--space-page) - var(--space-page));
  min-height: 0;
  overflow: hidden;
}

.configuration-module__eyebrow {
  color: #a48f00;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.16em;
}

.configuration-view__modules {
  display: grid;
  height: 100%;
  min-height: 0;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-page);
  align-items: stretch;
  overflow: hidden;
}

.configuration-module {
  display: grid;
  height: 100%;
  min-width: 0;
  min-height: 0;
  grid-template-rows: auto auto minmax(0, 1fr);
  padding: 24px;
  overflow-y: auto;
  overscroll-behavior: contain;
  background: var(--color-surface);
  border: 1px solid rgb(230 232 236 / 80%);
  border-radius: var(--radius-card);
  box-shadow: 0 8px 30px rgb(32 33 36 / 4%);
}

.configuration-module h2 {
  margin: 7px 0 0;
  font-size: 21px;
}

.configuration-module__placeholder {
  display: grid;
  min-height: 0;
  color: #a7aab0;
  place-items: center;
}

.configuration-module__placeholder span {
  padding: 9px 14px;
  background: #f5f6f7;
  border: 1px solid #eceef0;
  border-radius: 999px;
  font-size: 13px;
}

@media (max-width: 1280px) {
  .configuration-view__modules {
    grid-template-columns: repeat(3, minmax(340px, 1fr));
    overflow-x: auto;
  }
}
</style>
