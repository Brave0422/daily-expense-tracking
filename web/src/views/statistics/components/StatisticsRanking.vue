<script setup lang="ts">
/**
 * @author Brave
 * @date 2026-10-14T12:48:33+08:00
 * @description 分类排行行、前三强调与相对于整个周期总额的进度条。
 */
import type { CategoryStatisticsResult } from '@/api/statistics.types'
import CategoryIcon from '@/components/business/CategoryIcon.vue'
import BaseTooltip from '@/components/base/BaseTooltip.vue'
import { formatAmount } from '@/utils/money'
import { getCategoryPath } from '../statistics-view.util'
const props = defineProps<{ result: CategoryStatisticsResult }>()
</script>
<template>
  <!-- 使用后端顺序，升序下的前三名代表金额最小的三个分类 -->
  <ol class="ranking-list" aria-label="分类金额排行">
    <li v-for="(item, index) in props.result.items" :key="item.categoryId" class="ranking-row">
      <span class="ranking-row__rank" :class="`ranking-row__rank--${index + 1}`">{{
        index + 1
      }}</span>
      <CategoryIcon :icon-key="item.iconKey" :background-color="item.backgroundColor" :size="32" />
      <div class="ranking-row__content">
        <div class="ranking-row__heading">
          <BaseTooltip :content="getCategoryPath(item)" block>
            <span class="ranking-row__name" tabindex="0">{{ item.name }}</span>
          </BaseTooltip>
          <BaseTooltip :content="`¥ ${formatAmount(item.amount)}`">
            <strong class="ranking-row__amount" :class="`amount-${props.result.type}`" tabindex="0"
              >¥ {{ formatAmount(item.amount) }}</strong
            >
          </BaseTooltip>
        </div>
        <span v-if="item.parent" class="ranking-row__parent">{{ item.parent.name }}</span>
        <div
          class="ranking-row__progress"
          role="progressbar"
          :aria-label="`${getCategoryPath(item)}占比`"
          :aria-valuenow="Number(item.percentage)"
          :aria-valuemin="0"
          :aria-valuemax="100"
        >
          <span :style="{ width: `${item.percentage}%` }" />
        </div>
      </div>
      <span class="ranking-row__percentage">{{ item.percentage }}%</span>
    </li>
  </ol>
</template>
<style scoped>
.amount-expense {
  color: #249e68;
}
.amount-income {
  color: #e34d59;
}
.ranking-list {
  flex: 1;
  min-height: 0;
  margin: 0;
  padding: 0 4px 0 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  list-style: none;
}
.ranking-row {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
  padding: 17px 0;
  border-bottom: 1px solid #f1f2f4;
}
.ranking-row:last-child {
  border-bottom: 0;
}
.ranking-row__rank {
  display: grid;
  flex: none;
  width: 22px;
  height: 26px;
  place-items: center;
  color: #92969d;
  font-size: 13px;
  font-weight: 700;
  border-radius: 7px;
}
.ranking-row__rank--1 {
  color: #866400;
  background: #fff3ab;
}
.ranking-row__rank--2 {
  color: #697383;
  background: #eaf0f7;
}
.ranking-row__rank--3 {
  color: #a06c46;
  background: #f5e8dc;
}
.ranking-row__content {
  flex: 1;
  min-width: 0;
}
.ranking-row__heading {
  display: flex;
  min-width: 0;
  align-items: baseline;
  justify-content: space-between;
  gap: 5px;
}
.ranking-row__heading > :first-child {
  flex: 1;
  min-width: 0;
}
.ranking-row__heading > :last-child {
  max-width: 64%;
}
.ranking-row__name {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 600;
}
.ranking-row__amount {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  font-variant-numeric: tabular-nums;
}
.ranking-row__parent {
  display: block;
  margin-top: 3px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 10px;
  color: var(--color-text-secondary);
}
.ranking-row__progress {
  height: 5px;
  margin-top: 9px;
  overflow: hidden;
  background: #edf0f3;
  border-radius: 4px;
}
.ranking-row__progress span {
  display: block;
  height: 100%;
  background: var(--color-primary);
  border-radius: inherit;
}
.ranking-row__percentage {
  flex: none;
  width: 49px;
  text-align: right;
  font-size: 11px;
  color: var(--color-text-secondary);
  font-variant-numeric: tabular-nums;
}
</style>
