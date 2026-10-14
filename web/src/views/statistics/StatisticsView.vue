<script setup lang="ts">
/**
 * @author Brave
 * @date 2026-09-20T15:28:28+08:00
 * @description 流水统计页面，横向展示独立筛选的分类排行、分类占比与收支趋势。
 */

import StatisticsPanel from './components/StatisticsPanel.vue'
</script>

<template>
  <section class="statistics-view" aria-label="流水统计">
    <!-- 窄屏保留三板块顺序及最小宽度，排行与图例分别维护自己的纵向滚动 -->
    <div class="statistics-view__panels">
      <StatisticsPanel kind="ranking" title="分类排行" eyebrow="RANKING" />
      <StatisticsPanel kind="proportion" title="分类占比" eyebrow="PROPORTION" />
      <StatisticsPanel kind="trend" title="收支趋势" eyebrow="TREND" />
    </div>
  </section>
</template>

<style scoped>
.statistics-view {
  height: calc(100vh - var(--space-page) - var(--space-page));
  min-height: 0;
  overflow: hidden;
}
.statistics-view__panels {
  display: grid;
  height: 100%;
  min-height: 0;
  grid-template-columns: repeat(3, minmax(340px, 1fr));
  gap: var(--space-page);
  align-items: stretch;
  overflow-x: auto;
}
</style>
