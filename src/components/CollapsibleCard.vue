<script setup lang="ts">
import { ref } from 'vue';
import { ChevronDown } from '@lucide/vue';

/**
 * 通用折叠卡片：标题栏 + 可选速览条 + 折叠体。
 *
 * 解决主界面「无限向下延伸」的核心构件 —— 低频信息默认收成一行标题，
 * 玩家想看再点开；折叠状态按 persistKey 记进 localStorage，
 * 下次打开游戏保持玩家自己的习惯。
 *
 * 折叠动画用 grid-template-rows: 0fr ↔ 1fr，不用量高度，
 * 比 scrollHeight 方案更稳（内容高度动态变化时不会卡住）。
 */
const props = withDefaults(
  defineProps<{
    title: string;
    /** 标题右侧小字，描述当前状态（折叠/展开都可见） */
    subtitle?: string;
    /** localStorage 记忆键；不传则每次进页面都回到 defaultOpen */
    persistKey?: string;
    defaultOpen?: boolean;
  }>(),
  { subtitle: '', persistKey: '', defaultOpen: true },
);

function readPersisted(): boolean | null {
  if (!props.persistKey) return null;
  try {
    const raw = localStorage.getItem(`sakura.fold.${props.persistKey}`);
    if (raw === '1') return true;
    if (raw === '0') return false;
  } catch {
    /* 隐私模式等场景下 localStorage 不可写，静默回退默认 */
  }
  return null;
}

const open = ref(readPersisted() ?? props.defaultOpen);

function toggle(): void {
  open.value = !open.value;
  if (!props.persistKey) return;
  try {
    localStorage.setItem(`sakura.fold.${props.persistKey}`, open.value ? '1' : '0');
  } catch {
    /* 同上，记忆失败不影响当次交互 */
  }
}
</script>

<template>
  <section class="fold-card" :class="{ open }">
    <div class="fold-head">
      <button type="button" class="fold-toggle" :aria-expanded="open" @click="toggle">
        <span class="fold-lead">
          <slot name="icon" />
          <span class="fold-title">
            {{ title }}
            <small v-if="subtitle">{{ subtitle }}</small>
          </span>
        </span>
        <!-- 折叠态速览：一行摘要，让收起的卡片依然有信息量；淡入滑出而非生硬跳变 -->
        <Transition name="fold-peek">
          <span v-if="!open" class="fold-peek"><slot name="peek" /></span>
        </Transition>
        <ChevronDown :size="15" class="fold-chev" :class="{ closed: !open }" aria-hidden="true" />
      </button>
      <!-- meta 放独立容器，允许嵌自己的按钮（按钮里套按钮是非法 HTML） -->
      <span v-if="$slots.meta" class="fold-meta"><slot name="meta" /></span>
    </div>
    <div class="fold-body" :class="{ closed: !open }">
      <div class="fold-inner">
        <slot />
      </div>
    </div>
  </section>
</template>

<style scoped>
.fold-card {
  overflow: hidden;

  /*
   * 绝不接受 flex 挤压：固定高度 flex 列（如副本页）里，
   * overflow:hidden 的卡片自动最小高度为 0，会被兄弟内容压到裁断；
   * 折叠卡自己管理高度（0fr ↔ 1fr），兄弟装不下就让主滚动区滚。
   */
  flex-shrink: 0;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--r);
  box-shadow: var(--shadow-sm);
  transition: box-shadow var(--t-mid) var(--ease-soft);
}

.fold-card.open {
  box-shadow: var(--shadow-float);
}

.fold-head {
  display: flex;
  align-items: center;
  min-height: 46px;
}

.fold-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
  align-self: stretch;
  padding: 8px 12px;
  text-align: left;
  transition: background-color var(--t-fast) var(--ease-soft);
}

.fold-toggle:active {
  background: var(--panel-3);
}

.fold-lead {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex-shrink: 0;
}

.fold-title {
  display: flex;
  flex-direction: column;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: -0.01em;
  color: var(--text);
}

.fold-title small {
  font-size: 9px;
  font-weight: 400;
  color: var(--text-dim);
}

/* 速览条吃掉中间所有剩余空间，内容一律单行截断 */
.fold-peek {
  overflow: hidden;
  min-width: 0;
  flex: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 速览条淡入滑出：折叠/展开不再是硬跳变 */
.fold-peek-enter-from,
.fold-peek-leave-to {
  opacity: 0;
  transform: translateX(7px);
}

.fold-peek-enter-active,
.fold-peek-leave-active {
  transition:
    opacity var(--t-fast) ease,
    transform var(--t-fast) var(--ease-soft);
}

/* 展开时标题小字点亮成品牌粉，给「这张卡是开着的」一个安静的状态信号 */
.fold-title small {
  transition: color var(--t-mid) var(--ease-soft);
}

.fold-card.open .fold-title small {
  color: var(--pink-deep);
}

/* 有精确指针的设备（桌面/平板键鼠）给悬停反馈，触屏不受影响 */
@media (hover: hover) and (pointer: fine) {
  .fold-toggle:hover {
    background: var(--panel-2);
  }
}

.fold-meta {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  padding-right: 10px;
}

.fold-chev {
  flex-shrink: 0;
  color: var(--text-dim);
  transition: transform var(--t-mid) var(--ease-soft);
}

.fold-chev.closed {
  transform: rotate(-90deg);
}

/* 0fr ↔ 1fr 折叠动画：内容多高都能平滑开合 */
.fold-body {
  display: grid;
  grid-template-rows: 1fr;
  opacity: 1;
  transition:
    grid-template-rows var(--t-mid) var(--ease-soft),
    opacity var(--t-fast) ease;
}

.fold-body.closed {
  grid-template-rows: 0fr;
  opacity: 0;
}

.fold-inner {
  overflow: hidden;
  min-height: 0;
}

@media (prefers-reduced-motion: reduce) {
  .fold-body,
  .fold-chev,
  .fold-card,
  .fold-title small,
  .fold-peek-enter-active,
  .fold-peek-leave-active {
    transition: none;
  }
}
</style>
