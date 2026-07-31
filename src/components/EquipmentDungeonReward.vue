<script setup lang="ts">
import { computed, ref } from 'vue';
import { ChevronRight, Gift, Sparkles } from '@lucide/vue';
import type { ClassId, EquipmentInstance, Quality } from '@/core/types';
import { AFFIX_LABELS, EQUIPMENT_BASE_ROLL_TIERS, QUALITY_LABELS } from '@/data/constants';
import { requireEquipment } from '@/data/equipment';
import { equipmentDisplayPresentation } from '@/data/equipmentPresentation';
import EquipmentIcon from './EquipmentIcon.vue';
import EquipDetail from './EquipDetail.vue';

const props = defineProps<{
  instances: readonly EquipmentInstance[];
  classId: ClassId;
  firstClear: boolean;
  reduceMotion: boolean;
}>();

/**
 * 胚子档阈值从 EQUIPMENT_BASE_ROLL_TIERS 推导（稳定/精工/奇迹），
 * 绝不手写数字 —— 掉率表是唯一权威，这里只是它的读者（docs/66 §4.3）。
 */
type BlankGrade = (typeof EQUIPMENT_BASE_ROLL_TIERS)[number]['id'];
const ROLL_TIER_MIN = Object.fromEntries(
  EQUIPMENT_BASE_ROLL_TIERS.map((tier) => [tier.id, tier.min]),
) as Record<BlankGrade, number>;

function blankGradeOf(baseRollPermille: number): BlankGrade {
  if (baseRollPermille >= ROLL_TIER_MIN.miracle) return 'miracle';
  if (baseRollPermille >= ROLL_TIER_MIN.refined) return 'refined';
  return 'steady';
}

const rewards = computed(() =>
  props.instances.map((instance) => ({
    instance,
    definition: requireEquipment(instance.defId),
    presentation: equipmentDisplayPresentation(requireEquipment(instance.defId), props.classId),
    blankGrade: blankGradeOf(instance.baseRollPermille),
  })),
);

/** 掉落卡可点：直接弹完整详情（可比可穿），让结算窗口从「只能看」变成「值得点」 */
const detail = ref<EquipmentInstance | null>(null);

/**
 * 高品质掉落才配拿到额外的揭晓演出。
 *
 * 副本每天能打 3 次，蓝装是常态、神话是惊喜。
 * 如果每一件都金光四射，真正稀有的那件反而没了分量 ——
 * 稀缺感是靠对比撑起来的，不是靠特效堆出来的。
 */
const PRIZE_QUALITIES = new Set<Quality>(['legendary', 'mythic', 'prismatic', 'divine']);
function isPrize(quality: Quality): boolean {
  return PRIZE_QUALITIES.has(quality);
}
const hasPrize = computed(() =>
  rewards.value.some(({ definition }) => isPrize(definition.quality)),
);

/**
 * 奇迹显影（docs/66 §4.3）：胚子档是掉落里唯一的变量奖励，
 * 2% 的奇迹档必须在一屏扫视中可读 —— 与品质档的 prize 演出并列，
 * 互相独立（普通品质也可能 roll 出奇迹胚子，那同样是心跳）。
 * 只做「出了」的正向峰；稳定档保持安静，稀缺感靠对比撑起来。
 */
const hasMiracle = computed(() => rewards.value.some(({ blankGrade }) => blankGrade === 'miracle'));
</script>

<template>
  <section class="reward-panel" :class="{ 'reduced-motion': reduceMotion }" aria-live="polite">
    <span v-if="(hasPrize || hasMiracle) && !reduceMotion" class="reward-burst" aria-hidden="true">
      <i v-for="index in 8" :key="index" :style="{ '--spark-index': index }">✦</i>
    </span>
    <header>
      <span class="gift-mark"><Gift :size="18" aria-hidden="true" /></span>
      <span>
        <strong>{{ firstClear ? '首通收藏入库！' : '本次定向掉落' }}</strong>
        <small>{{
          firstClear
            ? '首通额外赠送一次同表掉落；两件胚子与词条均已真实掷出。'
            : '胚子与剩余词条已真实掷出，可在背包继续比较。'
        }}</small>
      </span>
    </header>

    <div class="reward-list">
      <button
        v-for="({ instance, definition, presentation, blankGrade }, index) in rewards"
        :key="instance.uid"
        type="button"
        class="reward-item"
        :class="[
          `quality-${definition.quality}`,
          {
            'is-prize': isPrize(definition.quality),
            'is-miracle': blankGrade === 'miracle',
            'is-refined': blankGrade === 'refined',
          },
        ]"
        :style="{ '--card-index': index }"
        :aria-label="`查看${presentation.name}详情`"
        @click="detail = instance"
      >
        <span
          v-if="blankGrade === 'miracle' && !reduceMotion"
          class="miracle-shine"
          aria-hidden="true"
        />
        <EquipmentIcon
          :def="definition"
          :class-id="classId"
          :enhance="instance.enhance"
          :locked="instance.locked"
          size="lg"
          decorative
        />
        <div class="reward-copy">
          <span class="quality-line">
            <Sparkles :size="12" aria-hidden="true" />
            {{ QUALITY_LABELS[definition.quality] }}
            <b v-if="blankGrade === 'miracle'" class="blank-ribbon miracle">
              <Sparkles :size="9" aria-hidden="true" />奇迹胚子
            </b>
            <b v-else-if="blankGrade === 'refined'" class="blank-ribbon refined">精工胚子</b>
          </span>
          <strong>{{ presentation.name }}</strong>
          <small>基础胚子 {{ (instance.baseRollPermille / 10).toFixed(1) }}%</small>
          <div class="affix-pills">
            <span v-for="affix in definition.fixedAffixes ?? []" :key="`fixed-${affix.key}`">
              定向 · {{ AFFIX_LABELS[affix.key] }}
            </span>
            <span v-for="affix in instance.affixes" :key="`random-${affix.key}`">
              随机 · {{ AFFIX_LABELS[affix.key] }}
            </span>
          </div>
        </div>
        <span class="reward-more" aria-hidden="true">
          <ChevronRight :size="15" />
        </span>
      </button>
    </div>

    <Teleport to="body">
      <Transition name="modal-pop">
        <EquipDetail
          v-if="detail"
          :inst="detail"
          from="bag"
          :allow-advanced-actions="false"
          @close="detail = null"
        />
      </Transition>
    </Teleport>
  </section>
</template>

<style scoped>
.reward-panel {
  position: relative;
  display: grid;
  gap: 10px;
  padding: 12px;
  overflow: hidden;
  background:
    radial-gradient(circle at 50% -15%, rgb(255 230 155 / 58%), transparent 48%),
    linear-gradient(155deg, rgb(255 255 255 / 98%), rgb(255 244 249 / 96%));
  border: 1px solid rgb(255 255 255 / 85%);
  border-radius: 18px;
  box-shadow:
    inset 0 0 0 1px rgb(255 190 215 / 22%),
    0 12px 26px rgb(89 73 118 / 16%);
}

header {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 9px;
}

header > span:last-child {
  display: grid;
  gap: 2px;
}

header strong {
  font-size: 13px;
  color: var(--text);
}

header small,
.reward-copy small {
  font-size: 10px;
  line-height: 1.45;
  color: var(--text-dim);
}

.gift-mark {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  color: #fff;
  background: linear-gradient(145deg, #ff8bad, #a886ef);
  border-radius: 12px;
  box-shadow: 0 5px 12px rgb(219 105 157 / 28%);
}

.reward-list {
  position: relative;
  z-index: 1;
  display: grid;
  gap: 8px;
}

.reward-item {
  --reward-color: var(--q-rare);
  display: flex;
  align-items: center;
  gap: 11px;
  width: 100%;
  min-width: 0;
  padding: 9px;
  text-align: left;
  background: rgb(255 255 255 / 76%);
  border: 1px solid color-mix(in srgb, var(--reward-color) 28%, white);
  border-radius: 15px;
  transition: background-color var(--t-fast) var(--ease-soft);
}

.reward-item:active {
  background: rgb(255 255 255 / 96%);
}

/* 右缘的小箭头：告诉玩家这张卡可以点开看详情 */
.reward-more {
  display: grid;
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  place-items: center;
  color: var(--reward-color);
  background: color-mix(in srgb, var(--reward-color) 10%, white);
  border-radius: 50%;
}

.quality-epic {
  --reward-color: var(--q-epic);
}

.quality-legendary {
  --reward-color: var(--q-legendary);
}

.quality-mythic {
  --reward-color: var(--q-mythic);
}

.quality-prismatic {
  --reward-color: var(--q-prismatic);
  background:
    radial-gradient(circle at 8% 20%, rgb(255 169 214 / 20%), transparent 34%),
    linear-gradient(120deg, rgb(255 255 255 / 96%), rgb(238 249 255 / 92%), rgb(255 242 250 / 94%));
}

.quality-divine {
  --reward-color: var(--q-divine);
}

.reward-copy {
  display: grid;
  flex: 1;
  gap: 3px;
  min-width: 0;
}

.reward-copy > strong {
  overflow: hidden;
  font-size: 12px;
  color: var(--reward-color);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quality-line {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 10px;
  font-weight: 800;
  color: var(--reward-color);
}

.quality-line b {
  padding: 1px 5px;
  margin-left: 3px;
  font-size: 9px;
  color: #b16513;
  background: #fff1c8;
  border-radius: 999px;
}

.affix-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
}

.affix-pills span {
  padding: 2px 5px;
  font-size: 9px;
  color: var(--text-mid);
  background: color-mix(in srgb, var(--reward-color) 9%, white);
  border-radius: 999px;
}

.reward-burst {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.reward-burst i {
  --angle: calc(var(--spark-index) * 45deg);
  position: absolute;
  top: 48%;
  left: 50%;
  color: #ffd76c;
  font-size: 10px;
  opacity: 0;
  animation: reward-spark 1.4s ease-out both;
  animation-delay: calc(var(--spark-index) * 45ms);
}

@keyframes reward-spark {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) rotate(var(--angle)) translateX(8px) scale(0.4);
  }
  28% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) rotate(var(--angle)) translateX(115px) scale(1.15);
  }
}

@media (prefers-reduced-motion: reduce) {
  .reward-burst {
    display: none;
  }
}

.reward-panel.reduced-motion .reward-burst {
  display: none;
}

/* ── 逐张揭晓 ── */

/*
 * 卡片依次浮上来，而不是一次性平铺。
 * 首通会掉两件，同时出现的话玩家的目光没有落点；
 * 错开 140ms 就能形成「一件、又一件」的节奏。
 */
.reward-item {
  animation: reward-card-in 0.44s var(--ease-out-back, cubic-bezier(0.2, 1.25, 0.4, 1)) both;
  animation-delay: calc(var(--card-index, 0) * 140ms);
}

@keyframes reward-card-in {
  0% {
    opacity: 0;
    transform: translateY(14px) scale(0.96);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/*
 * 传说及以上再加一层光晕呼吸，普通掉落保持安静。
 *
 * 用 box-shadow 而不是垫一层伪元素：卡片因为有入场动画（transform）
 * 已经形成层叠上下文，此时 z-index:-1 的伪元素会盖在卡片白底之上，
 * 把整张卡染成金粉色 —— 想要的是描边发光，不是整块变色。
 */
.reward-item.is-prize {
  animation:
    reward-card-in 0.44s var(--ease-out-back, cubic-bezier(0.2, 1.25, 0.4, 1)) both,
    prize-halo 1.8s ease-in-out calc(var(--card-index, 0) * 140ms + 0.3s) 2;
}

@keyframes prize-halo {
  0%,
  100% {
    box-shadow: 0 0 0 rgb(255 214 132 / 0%);
  }
  50% {
    box-shadow:
      0 0 0 2px rgb(255 214 132 / 65%),
      0 0 18px rgb(255 154 204 / 55%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .reward-item,
  .reward-item.is-prize {
    animation: none;
    opacity: 1;
  }

  /* 动效关掉了，但「这件是好东西」的信息要留住 */
  .reward-item.is-prize {
    box-shadow: 0 0 0 2px rgb(255 214 132 / 55%);
  }
}

.reward-panel.reduced-motion .reward-item,
.reward-panel.reduced-motion .reward-item.is-prize {
  animation: none;
  opacity: 1;
}

.reward-panel.reduced-motion .reward-item.is-prize {
  box-shadow: 0 0 0 2px rgb(255 214 132 / 55%);
}

/* 极窄屏（≤350px）：收紧留白，保证词条胶囊不挤出卡片 */
@media (max-width: 350px) {
  .reward-panel {
    padding: 10px;
  }

  .reward-item {
    gap: 8px;
    padding: 8px;
  }

  .reward-copy > strong {
    font-size: 11px;
  }

  .reward-more {
    width: 20px;
    height: 20px;
  }
}

/* ── 奇迹显影（docs/66 §4.3）：胚子档演出，与品质档 prize 并列且独立 ── */

/* 奇迹胚子 ribbon：渐变金底，一屏扫视即可读 */
.blank-ribbon {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 1px 6px;
  margin-left: 3px;
  font-size: 9px;
  border-radius: 999px;
}

.blank-ribbon.miracle {
  color: #fff;
  background: linear-gradient(135deg, #f2b53c, #ff8a3c);
  box-shadow: 0 2px 7px rgb(242 181 60 / 45%);
}

.blank-ribbon.refined {
  color: #6d5bb0;
  background: #ece6ff;
}

/* 奇迹卡：金边常亮（动效关掉时信息也不丢）+ 两轮金色 halo */
.reward-item.is-miracle {
  border-color: rgb(242 181 60 / 70%);
  box-shadow:
    0 0 0 1px rgb(242 181 60 / 45%),
    0 4px 16px rgb(242 181 60 / 22%);
  animation:
    reward-card-in 0.44s var(--ease-out-back, cubic-bezier(0.2, 1.25, 0.4, 1)) both,
    miracle-halo 1.9s ease-in-out calc(var(--card-index, 0) * 140ms + 0.3s) 2;
}

@keyframes miracle-halo {
  0%,
  100% {
    box-shadow:
      0 0 0 1px rgb(242 181 60 / 45%),
      0 4px 16px rgb(242 181 60 / 22%);
  }
  50% {
    box-shadow:
      0 0 0 3px rgb(255 206 92 / 80%),
      0 0 26px rgb(255 166 60 / 60%);
  }
}

/* 扫过卡面的一道光带：奇迹的「老虎机那一下」，扫两轮即停 */
.miracle-shine {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  overflow: hidden;
  pointer-events: none;
}

.miracle-shine::before {
  content: '';
  position: absolute;
  top: -30%;
  bottom: -30%;
  left: -40%;
  width: 34%;
  background: linear-gradient(
    100deg,
    transparent,
    rgb(255 236 170 / 75%),
    rgb(255 255 255 / 90%),
    rgb(255 236 170 / 75%),
    transparent
  );
  transform: skewX(-18deg);
  animation: miracle-sweep 1.5s ease-in-out calc(var(--card-index, 0) * 140ms + 0.2s) 2 both;
}

@keyframes miracle-sweep {
  0% {
    left: -40%;
  }
  100% {
    left: 130%;
  }
}

/* 精工卡：淡紫银描边 + 一轮轻 halo，不抢奇迹的戏 */
.reward-item.is-refined {
  border-color: rgb(150 126 220 / 50%);
  animation:
    reward-card-in 0.44s var(--ease-out-back, cubic-bezier(0.2, 1.25, 0.4, 1)) both,
    refined-halo 1.6s ease-in-out calc(var(--card-index, 0) * 140ms + 0.3s) 1;
}

@keyframes refined-halo {
  0%,
  100% {
    box-shadow: 0 0 0 rgb(150 126 220 / 0%);
  }
  50% {
    box-shadow:
      0 0 0 2px rgb(150 126 220 / 45%),
      0 0 14px rgb(150 126 220 / 30%);
  }
}

/* 奇迹卡需要容纳绝对定位的光带 */
.reward-item {
  position: relative;
  overflow: hidden;
}

/* 减弱动效：动画全停，但金边/紫边与 ribbon 保留 —— 「这件是好东西」的信息不丢 */
@media (prefers-reduced-motion: reduce) {
  .reward-item.is-miracle,
  .reward-item.is-refined {
    animation: none;
  }

  .miracle-shine {
    display: none;
  }
}

.reward-panel.reduced-motion .reward-item.is-miracle,
.reward-panel.reduced-motion .reward-item.is-refined {
  animation: none;
}

.reward-panel.reduced-motion .miracle-shine {
  display: none;
}
</style>
