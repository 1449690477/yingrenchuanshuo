<script setup lang="ts">
/**
 * SakuraField —— 全局氛围粒子层
 *
 * 在整个应用背景上飘落的樱花花瓣与光斑，纯 CSS 动画，零 JS 开销。
 * 位于内容之下（z-index: 0），不拦截任何点击。
 * 与战斗场景里的花瓣不同：这里更稀、更慢、更淡，只是氛围陪衬。
 */
const PETALS = 8 as const;
const ORBS = 2 as const;
</script>

<template>
  <div class="sakura-field" aria-hidden="true">
    <i v-for="n in PETALS" :key="`p${n}`" class="petal" :class="`petal-${n}`" />
    <b v-for="n in ORBS" :key="`o${n}`" class="orb" :class="`orb-${n}`" />
  </div>
</template>

<style scoped>
.sakura-field {
  position: absolute;
  z-index: -1;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

/* ── 樱花花瓣：大小、起点、漂移、时长全部错开，避免机械感 ── */
.petal {
  --x: 8%;
  --drift: 34px;
  --dur: 13s;
  --size: 7px;
  --tilt: 0deg;
  position: absolute;
  left: var(--x);
  top: calc(var(--size) * -2);
  width: var(--size);
  height: calc(var(--size) * 1.35);
  opacity: 0;
  background: linear-gradient(160deg, #ffd3e4, #ffabc9);
  border-radius: 78% 22% 68% 32%;
  box-shadow: inset 0 0 2px rgb(255 255 255 / 65%);
  animation: sakura-fall var(--dur) linear infinite;
}

.petal:nth-of-type(odd) {
  background: linear-gradient(160deg, #ffe4ef, #ffc2d8);
}

.petal-1 {
  --x: 4%;
  --drift: 42px;
  --dur: 12s;
  --size: 6px;
  animation-delay: -2.2s;
}
.petal-2 {
  --x: 12%;
  --drift: -30px;
  --dur: 15s;
  --size: 8px;
  animation-delay: -7.5s;
}
.petal-3 {
  --x: 21%;
  --drift: 26px;
  --dur: 11s;
  --size: 5px;
  animation-delay: -4.8s;
}
.petal-4 {
  --x: 30%;
  --drift: -44px;
  --dur: 16.5s;
  --size: 7px;
  animation-delay: -11s;
}
.petal-5 {
  --x: 38%;
  --drift: 36px;
  --dur: 13.5s;
  --size: 6px;
  animation-delay: -1.2s;
}
.petal-6 {
  --x: 47%;
  --drift: -24px;
  --dur: 14.5s;
  --size: 9px;
  animation-delay: -8.9s;
}
.petal-7 {
  --x: 55%;
  --drift: 46px;
  --dur: 12.5s;
  --size: 5px;
  animation-delay: -5.6s;
}
.petal-8 {
  --x: 63%;
  --drift: -38px;
  --dur: 17s;
  --size: 7px;
  animation-delay: -13.4s;
}
@keyframes sakura-fall {
  0% {
    opacity: 0;
    transform: translate3d(0, -12px, 0) rotate(0deg) scale(0.8);
  }
  8%,
  78% {
    opacity: 0.55;
  }
  50% {
    transform: translate3d(calc(var(--drift) * 0.4), 46dvh, 0) rotate(200deg) scale(1);
  }
  100% {
    opacity: 0;
    transform: translate3d(var(--drift), 96dvh, 0) rotate(420deg) scale(0.86);
  }
}

/* ── 柔光斑：慢慢游移的大色块，让背景“活”起来 ── */
.orb {
  position: absolute;
  width: 36vmax;
  height: 36vmax;
  border-radius: 50%;
  filter: blur(30px);
  opacity: 0.13;
  mix-blend-mode: screen;
}

.orb-1 {
  left: -18%;
  top: -14%;
  background: radial-gradient(circle, #ffd6e7, transparent 62%);
  animation: orb-drift-1 26s ease-in-out infinite;
}

.orb-2 {
  right: -22%;
  top: 32%;
  background: radial-gradient(circle, #cdeaff, transparent 62%);
  animation: orb-drift-2 32s ease-in-out infinite;
}

@keyframes orb-drift-1 {
  0%,
  100% {
    transform: translate(0, 0) scale(1);
  }
  50% {
    transform: translate(9vmax, 7vmax) scale(1.12);
  }
}

@keyframes orb-drift-2 {
  0%,
  100% {
    transform: translate(0, 0) scale(1);
  }
  50% {
    transform: translate(-8vmax, -6vmax) scale(0.92);
  }
}

@media (prefers-reduced-motion: reduce) {
  .petal,
  .orb {
    animation: none;
  }

  .petal {
    opacity: 0.18;
  }
}
</style>
