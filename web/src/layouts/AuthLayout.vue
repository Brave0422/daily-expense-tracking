<script setup lang="ts">
/**
 * @author Brave
 * @date 2026-09-20T15:25:44+08:00
 * @description 登录、注册和密码重置页面的居中品牌布局。
 */

import BaseIcon from '@/components/base/BaseIcon.vue'

interface Props {
  description: string
  title: string
}

const props = defineProps<Props>()
</script>

<template>
  <main class="auth-layout">
    <!-- 纯装饰背景不参与辅助技术语义 -->
    <div class="auth-layout__glow auth-layout__glow--top" />
    <div class="auth-layout__glow auth-layout__glow--bottom" />
    <section class="auth-layout__content" aria-labelledby="auth-page-title">
      <!-- 所有访客页共享的产品品牌区 -->
      <div class="auth-layout__brand" aria-label="每日记账">
        <span class="auth-layout__brand-icon"><BaseIcon name="records" :size="30" /></span>
        <span>每日记账</span>
      </div>
      <!-- 标题由布局提供，具体鉴权表单通过默认插槽注入 -->
      <div class="auth-card">
        <header class="auth-card__header">
          <p class="auth-card__eyebrow">DAILY EXPENSE</p>
          <h1 id="auth-page-title" class="auth-card__title">{{ props.title }}</h1>
          <p class="auth-card__description">{{ props.description }}</p>
        </header>
        <slot />
      </div>
    </section>
  </main>
</template>

<style scoped>
/* 全屏居中舞台与主题色环境光 */
.auth-layout {
  position: relative;
  display: grid;
  min-height: 100vh;
  padding: 48px 20px;
  overflow: hidden;
  place-items: center;
  background:
    radial-gradient(circle at 20% 20%, rgb(255 230 57 / 16%), transparent 32%),
    linear-gradient(145deg, #f6f7f8 0%, #eff0f2 100%);
}

.auth-layout__content {
  position: relative;
  z-index: 1;
  width: min(100%, 440px);
}

/* 品牌标识与本地 Iconfont 图标 */
.auth-layout__brand {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-bottom: 22px;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.auth-layout__brand-icon {
  display: grid;
  width: 46px;
  height: 46px;
  color: var(--color-text);
  background: var(--color-primary);
  border-radius: 15px;
  place-items: center;
  box-shadow: 0 10px 24px rgb(222 197 0 / 22%);
}

.auth-layout__glow {
  position: absolute;
  width: 280px;
  height: 280px;
  background: rgb(255 230 57 / 13%);
  border-radius: 50%;
  filter: blur(2px);
}

.auth-layout__glow--top {
  top: -120px;
  right: 8%;
}

.auth-layout__glow--bottom {
  bottom: -160px;
  left: 6%;
}

/* 插槽内容需要共享卡片边界，因此 :deep 仅限定在当前布局根节点下 */
:deep(.auth-card) {
  padding: 36px;
  background: var(--color-surface);
  border: 1px solid rgb(255 255 255 / 70%);
  border-radius: var(--radius-auth-card);
  box-shadow: var(--shadow-card);
}

:deep(.auth-card__header) {
  margin-bottom: 28px;
}

.auth-card__eyebrow {
  margin: 0 0 10px;
  color: #a48f00;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.18em;
}

.auth-card__title {
  margin: 0;
  font-size: 30px;
  line-height: 1.25;
}

.auth-card__description {
  margin: 10px 0 0;
  color: var(--color-text-secondary);
  font-size: 14px;
  line-height: 1.7;
}

/* 小视口从顶部开始布局，防止较高表单被垂直裁切 */
@media (max-width: 800px) {
  .auth-layout {
    place-items: start center;
  }
}
</style>
