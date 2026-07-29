<script setup lang="ts">
import { computed } from 'vue';

/**
 * R1 共享剧情舞台层：好感弹窗与奇遇面板共用的一套场景呈现。
 * - 底层同图 cover + 高斯模糊压暗铺满舞台（竖屏无黑带）；
 * - 上层 contain 完整呈现 3:2 构图（不再裁切人物）；
 * - breathe：20s 缓速推近拉远，静止画面也有呼吸感；
 * - 氛围粒子：按场景图 slug 自动匹配（雨/萤火/星空/波光/花瓣/光尘/
 *   星糖闪/咖啡蒸汽/灯屑），也可显式指定或关闭；
 * - 图换时 dip 淡入；zoomed（进入回应/CG）时轻微推近强调；
 * - reduced-motion：呼吸与粒子全部静止或隐藏。
 */

const AMBIENCE_KINDS = [
  'petals',
  'dust',
  'shimmer',
  'fireflies',
  'rain',
  'stars',
  'sparkle',
  'steam',
  'lantern',
] as const;
type AmbienceKind = (typeof AMBIENCE_KINDS)[number];

const props = withDefaults(
  defineProps<{
    src: string;
    /** 高潮 CG 承载叙事信息时给读屏的简短描述；其余场景留空（纯装饰）。 */
    alt?: string;
    breathe?: boolean;
    /** 'auto' 按 slug 检测；'none' 关闭；或显式指定一种氛围。 */
    ambience?: 'auto' | 'none' | AmbienceKind;
    /** 进入回应/CG 阶段时轻微推近，强调「这一刻值得定格」。 */
    zoomed?: boolean;
  }>(),
  { alt: '', breathe: true, ambience: 'auto', zoomed: false },
);

function detectKind(src: string): AmbienceKind {
  if (/rain|teahouse/.test(src)) return 'rain';
  if (/firefly/.test(src)) return 'fireflies';
  if (/meteor|planetarium|rooftop|night/.test(src)) return 'stars';
  if (/lakeside/.test(src)) return 'shimmer';
  if (/lantern/.test(src)) return 'lantern';
  if (/starcandy/.test(src)) return 'sparkle';
  if (/workshop|coffee/.test(src)) return 'steam';
  if (/shrine|sakura/.test(src)) return 'petals';
  return 'dust';
}

const kind = computed<AmbienceKind | null>(() => {
  if (props.ambience === 'none') return null;
  // 显式指定的氛围先做运行时校验，写错了就退回 slug 检测，绝不黑屏
  if (props.ambience !== 'auto' && (AMBIENCE_KINDS as readonly string[]).includes(props.ambience)) {
    return props.ambience;
  }
  return detectKind(props.src);
});

const PARTICLE_COUNT = 14;

/** 每颗粒子的确定性散布：位置/延迟/时长只取决于序号，SSR 无随机。 */
function particleStyle(index: number): Record<string, string> {
  return {
    left: `${(index * 67 + 11) % 100}%`,
    animationDelay: `${(((index * 83) % 60) / 10).toFixed(1)}s`,
    animationDuration: `${(5.5 + ((index * 37) % 45) / 10).toFixed(1)}s`,
  };
}
</script>

<template>
  <span class="scene-layer">
    <img class="scene-fill" :src="src" alt="" aria-hidden="true" />
    <span class="art-frame" :class="{ breathe, zoomed }">
      <img
        :key="src"
        class="scene-art"
        :src="src"
        :alt="alt"
        :aria-hidden="alt ? undefined : 'true'"
      />
    </span>
    <span v-if="kind" class="ambience" :class="`kind-${kind}`" aria-hidden="true">
      <i v-for="n in PARTICLE_COUNT" :key="n" :style="particleStyle(n - 1)" />
    </span>
  </span>
</template>

<style scoped>
.scene-layer {
  position: absolute;
  inset: 0;
  z-index: -5;
  overflow: hidden;
  pointer-events: none;
}

.scene-fill,
.art-frame,
.scene-art {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

/* 竖屏信箱式：模糊同图铺底，contain 完整构图在上 */
.scene-fill {
  object-fit: cover;
  object-position: center 32%;
  filter: blur(24px) brightness(0.78) saturate(1.1);
  transform: scale(1.15);
}

.art-frame {
  display: block;
}

/* 呼吸：20s 缓速推近拉远（与 dip/回应推近分层，互不打架） */
.art-frame.breathe {
  animation: scene-breathe 20s ease-in-out infinite alternate;
}

@keyframes scene-breathe {
  from {
    transform: scale(1);
  }
  to {
    transform: scale(1.035);
  }
}

.scene-art {
  object-fit: contain;
  object-position: center 40%;
  animation: scene-dip 0.55s ease-out;
  transition:
    opacity 0.35s ease,
    transform 1.5s ease;
}

.art-frame.zoomed .scene-art {
  transform: scale(1.025);
}

@keyframes scene-dip {
  from {
    opacity: 0;
    transform: scale(1.04);
  }
}

/* ── 氛围粒子：14 颗确定性散布的小东西，让场景自己会呼吸 ── */
.ambience {
  position: absolute;
  inset: 0;
}

.ambience i {
  position: absolute;
  opacity: 0;
}

/* 光尘（默认）：暖阳里的浮尘，慢慢往上飘 */
.kind-dust i {
  bottom: -4%;
  width: 3px;
  height: 3px;
  background: #ffe9c2;
  border-radius: 50%;
  animation-name: dust-rise;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}

@keyframes dust-rise {
  8% {
    opacity: 0.55;
  }
  88% {
    opacity: 0.35;
  }
  100% {
    top: -4%;
    opacity: 0;
  }
}

/* 樱吹雪：旋着往下落 */
.kind-petals i {
  top: -5%;
  width: 7px;
  height: 6px;
  background: #ffc7dd;
  border-radius: 62% 38% 60% 40%;
  animation-name: petal-fall;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}

@keyframes petal-fall {
  0% {
    transform: translateX(0) rotate(0deg);
    opacity: 0;
  }
  10% {
    opacity: 0.85;
  }
  50% {
    transform: translateX(16px) rotate(160deg);
  }
  100% {
    top: 104%;
    transform: translateX(-10px) rotate(320deg);
    opacity: 0.5;
  }
}

/* 湖面波光：蓝色的碎光一闪一闪 */
.kind-shimmer i,
.kind-stars i,
.kind-sparkle i {
  top: auto;
  bottom: auto;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  animation-name: glint-twinkle;
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
}

.kind-shimmer i {
  top: 52%;
  background: #bfe9ff;
  box-shadow: 0 0 6px #9fdcff;
}

.kind-stars i {
  top: 18%;
  background: #fff;
  box-shadow: 0 0 5px #cfe0ff;
}

.kind-sparkle i {
  top: 30%;
  background: #ffd873;
  box-shadow: 0 0 7px #ffe9a8;
}

@keyframes glint-twinkle {
  0%,
  100% {
    opacity: 0.08;
    transform: scale(0.7);
  }
  50% {
    opacity: 0.9;
    transform: scale(1.25);
  }
}

/* 流萤：拎着灯慢慢晃 */
.kind-fireflies i {
  top: 45%;
  width: 4px;
  height: 4px;
  background: #d8ffb0;
  border-radius: 50%;
  box-shadow: 0 0 8px #c2ff8a;
  animation-name: firefly-wander;
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
  animation-direction: alternate;
}

@keyframes firefly-wander {
  0% {
    transform: translate(0, 0);
    opacity: 0.15;
  }
  35% {
    opacity: 0.9;
  }
  100% {
    transform: translate(22px, -18px);
    opacity: 0.3;
  }
}

/* 雨：细线斜着织下来 */
.kind-rain i {
  top: -8%;
  width: 1px;
  height: 13px;
  background: linear-gradient(180deg, transparent, rgb(190 216 255 / 75%));
  border-radius: 1px;
  animation-name: rain-fall;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}

@keyframes rain-fall {
  0% {
    opacity: 0;
    transform: translateX(0);
  }
  12% {
    opacity: 0.5;
  }
  100% {
    top: 104%;
    opacity: 0.15;
    transform: translateX(-14px);
  }
}

/* 咖啡蒸汽：一小团一小团往上散 */
.kind-steam i {
  bottom: -6%;
  width: 20px;
  height: 20px;
  background: radial-gradient(closest-side, rgb(255 255 255 / 45%), transparent);
  border-radius: 50%;
  animation-name: steam-rise;
  animation-timing-function: ease-in;
  animation-iteration-count: infinite;
}

@keyframes steam-rise {
  15% {
    opacity: 0.5;
  }
  100% {
    top: 30%;
    opacity: 0;
    transform: scale(1.9);
  }
}

/* 灯屑：暖橙的小火星从灯桥方向飘上来 */
.kind-lantern i {
  bottom: -3%;
  width: 3px;
  height: 3px;
  background: #ffc06a;
  border-radius: 50%;
  box-shadow: 0 0 6px #ffb34d;
  animation-name: ember-rise;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}

@keyframes ember-rise {
  10% {
    opacity: 0.85;
  }
  100% {
    top: 20%;
    opacity: 0;
    transform: translateX(10px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .art-frame.breathe {
    animation: none;
  }

  .ambience {
    display: none;
  }
}
</style>
