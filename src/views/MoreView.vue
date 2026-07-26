<script setup lang="ts">
import { computed, ref } from 'vue';
import { abbr, duration } from '@/core/format';
import { usePlayerStore } from '@/stores/player';
import { useSettingsStore } from '@/stores/settings';
import type { SaveData } from '@/save/schema';
import { downloadSave, importFromJson } from '@/save/storage';

const player = usePlayerStore();
const settings = useSettingsStore();
const fileInput = ref<HTMLInputElement | null>(null);
const msg = ref<{ text: string; ok: boolean } | null>(null);
const confirmReset = ref(false);
const pendingImport = ref<SaveData | null>(null);

const stats = computed(() => settings.saveData?.stats ?? null);

function doExport() {
  if (!settings.saveData) return;
  downloadSave(settings.saveData);
  say('已导出存档文件，请妥善保存', true);
}

function pickFile() {
  fileInput.value?.click();
}

async function onFile(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const data = importFromJson(text);
    pendingImport.value = data;
    say('存档校验通过，请确认是否覆盖当前进度', true);
  } catch (err) {
    say(err instanceof Error ? err.message : '导入失败，文件可能损坏了', false);
  } finally {
    input.value = '';
  }
}

function confirmImport() {
  if (!pendingImport.value) return;
  settings.importSave(pendingImport.value);
  pendingImport.value = null;
  say('存档已导入', true);
}

async function doReset() {
  await settings.reset();
  confirmReset.value = false;
}

let timer = 0;
function say(text: string, ok: boolean) {
  msg.value = { text, ok };
  clearTimeout(timer);
  timer = window.setTimeout(() => (msg.value = null), 2600);
}
</script>

<template>
  <div class="more scroll-y">
    <section class="card">
      <div class="head">游戏数据</div>
      <div v-if="stats" class="rows">
        <div class="r">
          <span>累计击杀</span><span class="num">{{ abbr(stats.totalKills) }}</span>
        </div>
        <div class="r">
          <span>累计游戏时长</span><span class="num">{{ duration(stats.totalPlaySec) }}</span>
        </div>
        <div class="r">
          <span>已通关关卡</span>
          <span class="num">{{ settings.saveData?.progress.clearedStageIds.length ?? 0 }}</span>
        </div>
        <div class="r">
          <span>金币</span><span class="num">{{ abbr(player.player?.gold ?? 0) }}</span>
        </div>
      </div>
    </section>

    <section class="card">
      <div class="head">存档管理</div>
      <p v-if="settings.saveError" class="save-error">自动存档失败：{{ settings.saveError }}</p>
      <p class="warn-note">
        存档只保存在这台设备的浏览器里。<strong>清理浏览器数据会导致存档丢失</strong>，
        建议定期导出备份。
      </p>
      <div class="btns">
        <button class="btn btn-blue f" @click="doExport">导出备份</button>
        <button class="btn btn-plain f" @click="pickFile">导入存档</button>
      </div>
      <div v-if="pendingImport" class="import-confirm">
        <p>
          将覆盖当前角色，导入「{{ pendingImport.player.name }}」Lv.{{ pendingImport.player.level }}
          的进度。
        </p>
        <div class="btns compact">
          <button class="btn btn-plain f" @click="pendingImport = null">取消</button>
          <button class="btn btn-pink f" @click="confirmImport">确认覆盖</button>
        </div>
      </div>
      <input ref="fileInput" type="file" accept="application/json,.json" hidden @change="onFile" />
    </section>

    <section class="card">
      <div class="head">危险操作</div>
      <div class="btns">
        <button v-if="!confirmReset" class="btn btn-plain f danger" @click="confirmReset = true">
          删除存档，重新开始
        </button>
        <template v-else>
          <button class="btn btn-plain f" @click="confirmReset = false">取消</button>
          <button class="btn f danger-solid" @click="doReset">确认删除</button>
        </template>
      </div>
      <p v-if="confirmReset" class="warn-note danger-text">
        这会永久删除当前角色的全部进度，无法撤销。建议先导出备份。
      </p>
    </section>

    <section class="card">
      <div class="head">即将开放</div>
      <div class="chips">
        <span class="chip">邮件 · M4-5</span>
        <span class="chip">成就 · M4-7</span>
        <span class="chip">图鉴 · M4-8</span>
        <span class="chip">排行榜 · M7-4</span>
        <span class="chip">公会 · M8-3</span>
      </div>
    </section>

    <p class="ver">樱刃传说 · 开发版 M2</p>

    <Transition name="fade">
      <div v-if="msg" class="toast" :class="{ bad: !msg.ok }">{{ msg.text }}</div>
    </Transition>
  </div>
</template>

<style scoped>
.more {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
  position: relative;
}

.head {
  padding: 10px 12px;
  font-size: 11px;
  color: var(--text-dim);
  border-bottom: 1px solid var(--line);
}

.rows {
  padding: 6px 8px;
}

.r {
  display: flex;
  justify-content: space-between;
  padding: 7px 8px;
  font-size: 12px;
  border-radius: 6px;
}

.r:nth-child(odd) {
  background: var(--panel-2);
}

.r .num {
  font-weight: 600;
}

.warn-note {
  padding: 10px 12px 0;
  font-size: 11px;
  line-height: 1.7;
  color: var(--text-mid);
}

.save-error {
  margin: 10px 12px 0;
  padding: 8px 10px;
  font-size: 11px;
  color: var(--danger);
  background: #ffeef0;
  border-radius: var(--r-sm);
}

.import-confirm {
  margin: 0 12px 12px;
  padding: 9px 10px 0;
  font-size: 11px;
  color: var(--text-mid);
  background: var(--pink-soft);
  border: 1px solid #ffd7e6;
  border-radius: var(--r-sm);
}

.btns.compact {
  padding: 8px 0 10px;
}

.danger-text {
  color: var(--danger);
}

.btns {
  display: flex;
  gap: 8px;
  padding: 10px 12px 12px;
}

.f {
  flex: 1;
  font-size: 12px;
}

.danger {
  color: var(--danger);
  border-color: #ffd7da;
}

.danger-solid {
  color: #fff;
  background: var(--danger);
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 10px 12px;
}

.chip {
  padding: 4px 10px;
  font-size: 10px;
  color: var(--text-dim);
  background: var(--panel-3);
  border-radius: 999px;
}

.ver {
  padding: 4px 0 8px;
  font-size: 10px;
  color: var(--text-dim);
  text-align: center;
}

.toast {
  position: absolute;
  left: 50%;
  bottom: 14px;
  transform: translateX(-50%);
  max-width: 90%;
  padding: 9px 16px;
  font-size: 12px;
  color: #fff;
  background: rgb(70 89 107 / 92%);
  border-radius: 999px;
  text-align: center;
  z-index: 20;
}

.toast.bad {
  background: rgb(200 70 80 / 94%);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}
</style>
