<script setup lang="ts">
import { ref } from 'vue';
import type { ClassId } from '@/core/types';
import { CLASS_INFO } from '@/data/constants';
import { usePlayerStore } from '@/stores/player';

const player = usePlayerStore();
const name = ref('');
const picked = ref<ClassId>('swordsman');
const busy = ref(false);

const classes: ClassId[] = ['swordsman', 'witch', 'shaman'];

// 三职业的占位形象。正式立绘见 ROADMAP M12-3。
const emoji: Record<ClassId, string> = {
  swordsman: '🗡️',
  witch: '🔮',
  shaman: '🌿',
};

async function start() {
  if (busy.value) return;
  busy.value = true;
  await player.create(name.value, picked.value);
  busy.value = false;
}
</script>

<template>
  <div class="create scroll-y">
    <header class="hero">
      <div class="logo">樱刃传说</div>
      <p class="tagline">挂着自动打 · 回来收装备</p>
    </header>

    <section class="block">
      <label class="label">给你的少女起个名字</label>
      <input
        v-model="name"
        class="input"
        type="text"
        maxlength="8"
        placeholder="不填就叫「无名少女」"
      />
    </section>

    <section class="block">
      <label class="label">选择职业</label>
      <div class="classes">
        <button
          v-for="c in classes"
          :key="c"
          class="cls"
          :class="{ on: picked === c }"
          @click="picked = c"
        >
          <span class="cls-face">{{ emoji[c] }}</span>
          <span class="cls-name">{{ CLASS_INFO[c].name }}</span>
          <span class="cls-role">{{ CLASS_INFO[c].role }}</span>
        </button>
      </div>
      <p class="desc">{{ CLASS_INFO[picked].desc }}</p>
    </section>

    <button class="btn btn-pink go" :disabled="busy" @click="start">
      {{ busy ? '创建中…' : '开始冒险' }}
    </button>

    <p class="note">存档保存在这台设备的浏览器里。建议在「更多」页定期导出备份。</p>
  </div>
</template>

<style scoped>
.create {
  height: 100dvh;
  padding: calc(var(--sat) + 28px) 20px calc(var(--sab) + 24px);
  display: flex;
  flex-direction: column;
  gap: 20px;
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
  padding: 14px 6px;
  background: var(--panel);
  border: 2px solid var(--line);
  border-radius: var(--r);
  transition: all 0.16s;
}

.cls.on {
  border-color: var(--pink);
  background: var(--pink-soft);
  transform: translateY(-2px);
  box-shadow: var(--shadow);
}

.cls-face {
  font-size: 26px;
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
