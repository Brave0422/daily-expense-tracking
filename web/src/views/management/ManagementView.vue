<script setup lang="ts">
/**
 * @author Brave
 * @date 2026-09-20T15:28:28+08:00
 * @description 分类管理占位页，为后续收支分类配置提供页面入口。
 */
</script>

<template>
  <!-- 分类管理业务占位卡片 -->
  <section class="management-view" aria-labelledby="management-title">
    <span class="management-view__kicker">MANAGEMENT</span>
    <h1 id="management-title">分类管理</h1>
    <p>收支分类、预算和账户配置功能将在后续版本中接入。</p>
    <div class="management-view__placeholder" aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  </section>
</template>

<style scoped>
/* 管理页使用单卡片结构，与列表和统计页的双栏结构区分 */
.management-view {
  min-height: calc(100vh - 32px);
  padding: 42px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  box-shadow: 0 8px 30px rgb(32 33 36 / 4%);
}

.management-view__kicker {
  color: #a48f00;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.16em;
}

.management-view h1 {
  margin: 12px 0 10px;
  font-size: 30px;
}

.management-view p {
  margin: 0;
  color: var(--color-text-secondary);
}

/* 后续分类、预算和账户配置模块的三列占位 */
.management-view__placeholder {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
  margin-top: 44px;
}

.management-view__placeholder span {
  height: 180px;
  background: linear-gradient(145deg, #f7f8f9, #f1f2f4);
  border: 1px solid #eceef0;
  border-radius: 16px;
}
</style>
