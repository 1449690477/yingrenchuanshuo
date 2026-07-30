<script setup lang="ts">
/**
 * 深度阶梯面板（docs/66 §八 第 6 步 · UI ①选深度 + ③「失败不扣次数」）。
 *
 * 纯展示组件：所有判定都来自 core/equipmentDungeonDepth 的 DepthEvaluation，
 * 本组件不做任何解锁/掉率计算，只把五种状态翻译成可读文案：
 *   cleared        已突破 —— 显示稳定后胚子掉率（重刷这层的动机）
 *   next           下一层可打 —— 「首破必掉 1 件胚子」徽标 + 推荐战力（peak-end）
 *   previous-depth 锁链 —— 「先突破上一层」（深度链替代了旧的等级门槛）
 *   not-opened     区域未开放 —— 「区域 8 开放后解锁」，**不显示任何门槛数字**
 *   daily-limit    今日奖励已领完 —— 3 次/天限的是奖励不是尝试（§4.4 承重）
 *
 * 红线（docs/66 §4.3 / G-9）：本组件只做正向峰，**绝不做负向提示**
 * （红线原话与反例见 docs/66 §4.3 与 docs/40 损失厌恶条款）；奇迹显影（掉落卡演出）属后续批次，
 * 等掉落形状冻结后接，不在本组件范围内。
 */
import { computed } from 'vue';
import { Check, Hourglass, LockKeyhole, Sparkles, Swords } from '@lucide/vue';
import type { DepthEvaluation } from '@/core/equipmentDungeonDepth';
import { abbr } from '@/core/format';
import { DEPTH_PER_TIER } from '@/data/equipmentDungeonDepthRules';
import type { EquipmentDungeonTier } from '@/data/equipmentDungeonGear';

type NodeState = 'cleared' | 'next' | 'previous-depth' | 'not-opened' | 'daily-limit';

interface DepthNode {
  depth: number;
  state: NodeState;
  selectable: boolean;
  /** 稳定后胚子掉率的整数百分比；仅 cleared 展示 */
  chancePercent: number;
  /** 推荐战力（abbr 格式化）；仅 next 展示 */
  recommend: string;
  firstBreak: boolean;
}

const props = defineProps<{
  tier: EquipmentDungeonTier;
  /** 长度 = DEPTH_PER_TIER，按深度 1..N 顺序 */
  evaluations: readonly DepthEvaluation[];
  clearedDepth: number;
  selectedDepth: number;
  reduceMotion: boolean;
}>();

const emit = defineEmits<{
  select: [depth: number];
}>();

const nodes = computed<DepthNode[]>(() =>
  props.evaluations.map((evaluation, index) => {
    const depth = index + 1;
    let state: NodeState;
    if (evaluation.reason === 'not-opened') {
      state = 'not-opened';
    } else if (depth <= props.clearedDepth) {
      state = 'cleared';
    } else if (evaluation.reason === 'previous-depth') {
      state = 'previous-depth';
    } else if (evaluation.reason === 'daily-limit') {
      state = 'daily-limit';
    } else {
      state = 'next';
    }
    return {
      depth,
      state,
      selectable: evaluation.unlocked,
      chancePercent: Math.round(evaluation.blankChance * 100),
      recommend: abbr(evaluation.recommendCp),
      firstBreak: evaluation.isFirstBreak,
    };
  }),
);

/** 阶梯进度条的填充比例：已突破层数 / 总层数 */
const ladderPercent = computed(() =>
  Math.min(100, Math.round((props.clearedDepth / DEPTH_PER_TIER) * 100)),
);

function stateCopy(node: DepthNode): string {
  switch (node.state) {
    case 'cleared':
      return `胚子 ${node.chancePercent}%`;
    case 'next':
      return `推荐 ${node.recommend}`;
    case 'previous-depth':
      return '先突破上一层';
    case 'not-opened':
      // K5 同款红线：敬请期待不显示任何门槛数字（docs/57）
      return '区域 8 开放后解锁';
    case 'daily-limit':
      return '今日奖励已领完';
  }
}

function ariaLabel(node: DepthNode): string {
  const base = `深度 ${node.depth}`;
  switch (node.state) {
    case 'cleared':
      return `${base}，已突破，稳定后胚子掉率 ${node.chancePercent}%`;
    case 'next':
      return `${base}，可挑战，首破必掉 1 件胚子，推荐战力 ${node.recommend}`;
    case 'previous-depth':
      return `${base}，未解锁，先突破上一层`;
    case 'not-opened':
      return `${base}，区域 8 开放后解锁`;
    case 'daily-limit':
      return `${base}，今日奖励已领完`;
  }
}

function pick(node: DepthNode): void {
  if (node.selectable) emit('select', node.depth);
}
</script>

<template>
  <div
    class="depth-panel"
    :class="{ 'motion-off': reduceMotion }"
    :data-reduce-motion="reduceMotion ? 'true' : 'false'"
    :style="{ '--tier-color': tier.color, '--tier-glow': tier.glow }"
  >
    <header class="depth-head">
      <span class="depth-title">
        <Sparkles :size="12" aria-hidden="true" />
        <strong>深度阶梯</strong>
      </span>
      <span class="depth-progress">当前深度 {{ clearedDepth }}/{{ DEPTH_PER_TIER }}</span>
      <span class="depth-chip">
        <Swords :size="10" aria-hidden="true" />
        失败不扣次数
      </span>
    </header>

    <div class="depth-ladder" aria-hidden="true">
      <i :style="{ width: `${ladderPercent}%` }"></i>
    </div>

    <ol class="depth-nodes" role="group" aria-label="选择挑战深度">
      <li v-for="node in nodes" :key="node.depth">
        <button
          type="button"
          class="depth-node"
          :class="[node.state, { active: node.depth === selectedDepth }]"
          :data-state="node.state"
          :disabled="!node.selectable"
          :aria-pressed="node.depth === selectedDepth"
          :aria-label="ariaLabel(node)"
          @click="pick(node)"
        >
          <span v-if="!reduceMotion && node.state === 'next'" class="node-particles" aria-hidden="true">
            <i v-for="index in 3" :key="index" :style="{ '--particle-index': index }">✦</i>
          </span>
          <span class="node-icon" aria-hidden="true">
            <Check v-if="node.state === 'cleared'" :size="12" />
            <Sparkles v-else-if="node.state === 'next'" :size="12" />
            <LockKeyhole v-else-if="node.state === 'previous-depth'" :size="11" />
            <Hourglass v-else :size="11" />
          </span>
          <strong>深度 {{ node.depth }}</strong>
          <small>{{ stateCopy(node) }}</small>
          <em v-if="node.state === 'next' && node.firstBreak" class="first-break">
            首破必掉 1 件胚子
          </em>
        </button>
      </li>
    </ol>

    <footer class="depth-foot">
      失败不扣次数、不推保底 —— 冲深度是免费的；每日 3 次限的是奖励，不是尝试。
    </footer>
  </div>
</template>

<style scoped>
.depth-panel {
  --tier-color: var(--pink-deep);
  --tier-glow: var(--pink-soft);
  position: relative;
  margin-top: 10px;
  padding: 10px 10px 8px;
  background: linear-gradient(160deg, #fff 0%, var(--panel-2) 100%);
  border: 1px solid color-mix(in srgb, var(--tier-color) 22%, #e4e7f0);
  border-radius: 16px;
  box-shadow: 0 8px 20px color-mix(in srgb, var(--tier-color) 8%, transparent);
  animation: depth-in 0.45s var(--ease-spring);
  overflow: hidden;
}

@keyframes depth-in {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.985);
  }
}

.depth-head {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.depth-title {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--tier-color);
}

.depth-title strong {
  font-size: 11px;
  letter-spacing: 0.04em;
}

.depth-progress {
  margin-left: auto;
  font-size: 9px;
  font-weight: 700;
  color: var(--text-dim);
  font-variant-numeric: tabular-nums;
}

.depth-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 3px 7px;
  font-size: 8px;
  font-weight: 800;
  color: var(--pink-deep);
  background: var(--pink-soft);
  border: 1px solid color-mix(in srgb, var(--pink) 45%, white);
  border-radius: 999px;
}

/* ── 阶梯进度条：已突破的部分常亮，流光扫过表示「还能往上爬」 ── */
.depth-ladder {
  position: relative;
  height: 4px;
  margin: 8px 2px 9px;
  background: var(--panel-3);
  border-radius: 999px;
  overflow: hidden;
}

.depth-ladder i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--pink), var(--tier-color), var(--tier-glow), var(--tier-color));
  background-size: 220% 100%;
  transition: width 0.6s var(--ease-spring);
  animation: ladder-flow 3.2s linear infinite;
}

@keyframes ladder-flow {
  to {
    background-position: -220% 0;
  }
}

.depth-nodes {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 5px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.depth-node {
  position: relative;
  display: grid;
  justify-items: center;
  gap: 2px;
  min-height: 64px;
  padding: 6px 2px 5px;
  color: var(--text-mid);
  background: #fff;
  border: 1px solid color-mix(in srgb, var(--tier-color) 16%, #e4e7f0);
  border-radius: 12px;
  cursor: pointer;
  transition:
    transform var(--t-fast) var(--ease-spring),
    box-shadow var(--t-fast),
    border-color var(--t-fast),
    filter var(--t-fast),
    opacity var(--t-fast);
}

.depth-node:active:not(:disabled) {
  transform: scale(0.93);
}

.depth-node > strong {
  font-size: 9px;
}

.depth-node > small {
  font-size: 7px;
  color: var(--text-dim);
  text-align: center;
  line-height: 1.25;
}

.node-icon {
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  color: var(--tier-color);
  background: color-mix(in srgb, var(--tier-glow) 40%, white);
  border-radius: 999px;
}

/* 已突破：档位色描边 + 淡光，✓ 表示这层已是可重刷的资产 */
.depth-node.cleared {
  color: var(--tier-color);
  border-color: color-mix(in srgb, var(--tier-color) 45%, white);
  background: linear-gradient(165deg, #fff, color-mix(in srgb, var(--tier-glow) 22%, white));
}

.depth-node.cleared > small {
  color: color-mix(in srgb, var(--tier-color) 78%, var(--text-dim));
  font-weight: 700;
}

/* 下一层可打：脉冲辉光 + 粒子，是整张面板的视觉焦点 */
.depth-node.next {
  color: var(--tier-color);
  border-color: color-mix(in srgb, var(--tier-color) 68%, white);
  box-shadow: 0 0 0 0 color-mix(in srgb, var(--tier-color) 40%, transparent);
  animation: node-pulse 2.1s ease-out infinite;
}

@keyframes node-pulse {
  0% {
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--tier-color) 38%, transparent);
  }
  70% {
    box-shadow: 0 0 0 7px transparent;
  }
  100% {
    box-shadow: 0 0 0 0 transparent;
  }
}

.depth-node.next .node-icon {
  color: #fff;
  background: linear-gradient(135deg, var(--pink), var(--tier-color));
  box-shadow: 0 3px 8px color-mix(in srgb, var(--tier-color) 35%, transparent);
}

.node-particles {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.node-particles i {
  position: absolute;
  left: calc(18% + var(--particle-index) * 26%);
  bottom: 30%;
  font-size: 7px;
  font-style: normal;
  color: var(--tier-color);
  opacity: 0;
  animation: node-float 2.4s calc(var(--particle-index) * 0.55s) ease-in-out infinite;
}

@keyframes node-float {
  0% {
    opacity: 0;
    transform: translateY(4px) scale(0.7);
  }
  35% {
    opacity: 0.95;
  }
  100% {
    opacity: 0;
    transform: translateY(-14px) scale(1.05);
  }
}

.first-break {
  padding: 1px 5px;
  font-size: 7px;
  font-weight: 800;
  font-style: normal;
  color: #fff;
  background: linear-gradient(135deg, var(--pink), var(--pink-deep));
  border-radius: 999px;
  box-shadow: 0 2px 6px color-mix(in srgb, var(--pink-deep) 30%, transparent);
}

/* 选中：粉色实边 + 抬升，档位色保持不变 */
.depth-node.active {
  border-color: var(--pink-deep);
  box-shadow: 0 5px 14px color-mix(in srgb, var(--pink-deep) 22%, transparent);
  transform: translateY(-1px);
}

/* 锁链 / 未开放 / 次数尽：压暗但保留层级，不可点 */
.depth-node:disabled {
  cursor: default;
}

.depth-node.previous-depth {
  filter: grayscale(0.5);
  opacity: 0.6;
}

.depth-node.daily-limit {
  filter: grayscale(0.3);
  opacity: 0.72;
}

/* 区域未开放：照 K5 敬请期待卡的暗色处理 ——「未来会来」，不是「不存在」 */
.depth-node.not-opened {
  color: rgb(214 172 190 / 88%);
  background: linear-gradient(150deg, #3d2b38, #2b2233);
  border-color: rgb(255 79 114 / 28%);
}

.depth-node.not-opened .node-icon {
  color: rgb(255 209 220 / 90%);
  background: rgb(255 79 114 / 16%);
}

.depth-node.not-opened > small {
  color: rgb(214 172 190 / 62%);
}

.depth-foot {
  margin-top: 8px;
  font-size: 8px;
  line-height: 1.5;
  color: var(--text-dim);
  text-align: center;
}

/* 减弱动效：停掉所有动画，粒子在模板层就不渲染 */
.motion-off .depth-ladder i,
.motion-off .depth-node.next {
  animation: none;
}

.motion-off.depth-panel {
  animation: none;
}

/* 窄屏适配（320px 档）：压缩留白与字号，五层仍保持一屏可读 */
@media (max-width: 340px) {
  .depth-panel {
    padding: 8px 7px 7px;
    border-radius: 14px;
  }

  .depth-nodes {
    gap: 3px;
  }

  .depth-node {
    min-height: 58px;
    padding: 5px 1px 4px;
  }

  .depth-node > strong {
    font-size: 8px;
  }

  .depth-node > small {
    font-size: 6.5px;
  }

  .first-break {
    font-size: 6px;
    padding: 1px 4px;
  }

  .depth-foot {
    font-size: 7.5px;
  }
}
</style>
