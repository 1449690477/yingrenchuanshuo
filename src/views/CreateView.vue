<script setup lang="ts">
import { ref } from 'vue';
import type { ClassId } from '@/core/types';
import { CLASS_INFO } from '@/data/constants';
import { CLASS_VISUALS } from '@/data/classVisuals';
import { usePlayerStore } from '@/stores/player';
import { useUiStore } from '@/stores/ui';
import ClassArtwork from '@/components/ClassArtwork.vue';

const player = usePlayerStore();
const ui = useUiStore();
const name = ref('');
const picked = ref<ClassId>('swordsman');
const busy = ref(false);

const classes: ClassId[] = ['swordsman', 'witch', 'shaman'];

async function start() {
  if (busy.value) return;
  busy.value = true;
  await player.create(name.value, picked.value);
  ui.setTab('idle');
  busy.value = false;
}
</script>

<template>
  <div class="create scroll-y">
    <header class="hero row-in">
      <div class="logo">樱刃传说</div>
      <p class="tagline">挂着自动打 · 回来收装备</p>
    </header>

    <section class="portrait-stage row-in" style="--row-delay: 70ms" :class="`class-${picked}`">
      <div class="magic-ring ring-one" />
      <div class="magic-ring ring-two" />
      <ClassArtwork :class-id="picked" variant="preview" />
      <span v-if="!CLASS_VISUALS[picked].portrait" class="art-pending">角色立绘制作中</span>
      <span v-else class="art-ready">正式立绘已实装</span>
    </section>

    <section class="block row-in" style="--row-delay: 140ms">
      <label class="label">给你的少女起个名字</label>
      <input
        v-model="name"
        class="input"
        type="text"
        maxlength="8"
        placeholder="不填就叫「无名少女」"
      />
    </section>

    <section class="block row-in" style="--row-delay: 210ms">
      <label class="label">选择职业</label>
      <div class="classes">
        <button
          v-for="c in classes"
          :key="c"
          class="cls"
          :class="{ on: picked === c }"
          @click="picked = c"
        >
          <ClassArtwork :class-id="c" variant="thumb" />
          <span class="cls-name">{{ CLASS_INFO[c].name }}</span>
          <span class="cls-role">{{ CLASS_INFO[c].role }}</span>
        </button>
      </div>
      <p class="desc">{{ CLASS_INFO[picked].desc }}</p>
    </section>

    <button
      class="btn btn-pink go row-in"
      style="--row-delay: 280ms"
      :disabled="busy"
      @click="start"
    >
      {{ busy ? '创建中…' : '开始冒险' }}
    </button>

    <p class="note row-in" style="--row-delay: 340ms">
      存档保存在这台设备的浏览器里。建议在「更多」页定期导出备份。
    </p>
  </div>
</template>

<style scoped>
.create {
  height: 100dvh;
  padding: calc(var(--sat) + 20px) 20px calc(var(--sab) + 24px);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.hero {
  text-align: center;
}

.logo {
  font-size: 30px;
  font-weight: 800;
  letter-spacing: 2px;
  background: linear-gradient(120deg, var(--pink-deep), var(--blue-deep));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.tagline {
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-mid);
}

.portrait-stage {
  position: relative;
  height: 224px;
  flex-shrink: 0;
  overflow: hidden;
  background:
    radial-gradient(circle at 50% 68%, rgb(255 255 255 / 92%) 0 22%, transparent 46%),
    linear-gradient(145deg, var(--blue-soft), var(--pink-soft));
  border: 1px solid rgb(255 255 255 / 80%);
  border-radius: 28px;
  box-shadow: var(--shadow);
}

.portrait-stage :deep(.is-preview) {
  z-index: 2;
  padding: 4px 46px 0;
  filter: drop-shadow(0 12px 12px rgb(74 103 143 / 16%));
}

.portrait-stage.class-witch :deep(.portrait) {
  animation: portrait-float 3.4s ease-in-out infinite;
}

.portrait-stage.class-swordsman :deep(.portrait) {
  animation: swordsman-ready 3.2s ease-in-out infinite;
}

.portrait-stage.class-shaman :deep(.portrait) {
  animation: shaman-breathe 3.8s ease-in-out infinite;
}

.magic-ring {
  position: absolute;
  z-index: 1;
  border: 1px solid rgb(255 255 255 / 76%);
  border-radius: 50%;
}

.ring-one {
  width: 170px;
  height: 170px;
  left: calc(50% - 85px);
  bottom: -82px;
  box-shadow: 0 0 0 13px rgb(255 255 255 / 18%);
}

.ring-two {
  width: 52px;
  height: 52px;
  right: 26px;
  top: 24px;
  border-style: dashed;
  animation: ring-spin 14s linear infinite;
}

.art-pending,
.art-ready {
  position: absolute;
  z-index: 3;
  right: 12px;
  bottom: 10px;
  padding: 4px 8px;
  font-size: 9px;
  font-weight: 700;
  color: var(--text-dim);
  background: rgb(255 255 255 / 78%);
  border: 1px solid rgb(255 255 255 / 90%);
  border-radius: 999px;
  backdrop-filter: blur(5px);
}

.art-ready {
  color: var(--blue-deep);
}

@keyframes portrait-float {
  0%,
  100% {
    transform: translateY(2px);
  }
  50% {
    transform: translateY(-4px);
  }
}

@keyframes swordsman-ready {
  0%,
  100% {
    transform: translateY(1px) rotate(-0.25deg);
  }
  50% {
    transform: translateY(-3px) rotate(0.25deg);
  }
}

@keyframes shaman-breathe {
  0%,
  100% {
    transform: translateY(2px);
    filter: drop-shadow(0 0 0 rgb(142 132 226 / 0%));
  }
  50% {
    transform: translateY(-4px);
    filter: drop-shadow(0 5px 8px rgb(142 132 226 / 20%));
  }
}

@keyframes ring-spin {
  to {
    transform: rotate(360deg);
  }
}

.block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-mid);
}

.input {
  width: 100%;
  padding: 12px 14px;
  font-size: 15px;
  color: var(--text);
  background: var(--panel);
  border: 1px solid var(--line-strong);
  border-radius: var(--r);
  outline: none;
  -webkit-user-select: text;
  user-select: text;
}

.input:focus {
  border-color: var(--pink);
  box-shadow: 0 0 0 3px var(--pink-soft);
}

.classes {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.cls {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 8px 5px 9px;
  background: var(--panel);
  border: 2px solid var(--line);
  border-radius: var(--r);
  transition:
    transform var(--t-mid) var(--ease-spring),
    border-color var(--t-mid) var(--ease-soft),
    background-color var(--t-mid) var(--ease-soft),
    box-shadow var(--t-mid) var(--ease-soft);
}

.cls:active {
  transform: scale(0.94);
}

.cls.on {
  border-color: var(--pink);
  background: var(--pink-soft);
  transform: translateY(-2px);
  box-shadow: var(--shadow);
}

.cls-name {
  font-size: 14px;
  font-weight: 700;
}

.cls-role {
  font-size: 9px;
  line-height: 1.3;
  color: var(--text-dim);
  text-align: center;
}

.desc {
  padding: 10px 12px;
  font-size: 12px;
  line-height: 1.7;
  color: var(--text-mid);
  background: var(--blue-soft);
  border-radius: var(--r-sm);
}

.go {
  margin-top: auto;
  padding: 14px;
  font-size: 16px;
}

.note {
  font-size: 10px;
  line-height: 1.6;
  color: var(--text-dim);
  text-align: center;
}
</style>
