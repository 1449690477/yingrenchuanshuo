<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { Castle, Coins, Layers, ShoppingBag, Sparkles, Users } from '@lucide/vue';
import { abbr, duration } from '@/core/format';
import { usePlayerStore } from '@/stores/player';
import { useSettingsStore } from '@/stores/settings';
import type { SaveData } from '@/save/schema';
import { downloadSave, importFromJson } from '@/save/storage';
import ShopView from '@/views/ShopView.vue';
import GuildView from '@/views/GuildView.vue';
import SetCodexView from '@/views/SetCodexView.vue';
import CollapsibleCard from '@/components/CollapsibleCard.vue';
import SaveIntegrityCard from '@/components/SaveIntegrityCard.vue';

const player = usePlayerStore();
const settings = useSettingsStore();
const fileInput = ref<HTMLInputElement | null>(null);
const msg = ref<{ text: string; ok: boolean } | null>(null);
const confirmReset = ref(false);
const pendingImport = ref<SaveData | null>(null);
const showShop = ref(false);
const shopLeaving = ref(false);
const shopEntryButton = ref<HTMLButtonElement | null>(null);
const showGuild = ref(false);
const guildLeaving = ref(false);
const guildEntryButton = ref<HTMLButtonElement | null>(null);
const showCodex = ref(false);
const codexLeaving = ref(false);
const codexEntryButton = ref<HTMLButtonElement | null>(null);
const shopSceneUrl = `${import.meta.env.BASE_URL}assets/shops/sakura-boutique.webp`;

const stats = computed(() => settings.saveData?.stats ?? null);

function doExport() {
  if (!settings.saveData) return;
  downloadSave(settings.saveData);
  say('已导出存档文件，请妥善保存', true);
}

function pickFile() {
  fileInput.value?.click();
}

function openShop() {
  shopLeaving.value = false;
  showShop.value = true;
}

function closeShop() {
  shopLeaving.value = true;
  showShop.value = false;
}

function openGuild() {
  guildLeaving.value = false;
  showGuild.value = true;
}

function closeGuild() {
  guildLeaving.value = true;
  showGuild.value = false;
}

function openCodex() {
  codexLeaving.value = false;
  showCodex.value = true;
}

function closeCodex() {
  codexLeaving.value = true;
  showCodex.value = false;
}

function updateHaptics(event: Event) {
  settings.setHaptics((event.currentTarget as HTMLInputElement).checked);
}

async function afterShopLeave() {
  shopLeaving.value = false;
  await nextTick();
  shopEntryButton.value?.focus();
}

async function afterGuildLeave() {
  guildLeaving.value = false;
  await nextTick();
  guildEntryButton.value?.focus();
}

async function afterCodexLeave() {
  codexLeaving.value = false;
  await nextTick();
  codexEntryButton.value?.focus();
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
    <div
      class="more-content"
      :inert="showShop || shopLeaving || showGuild || guildLeaving || showCodex || codexLeaving"
      :aria-hidden="
        showShop || shopLeaving || showGuild || guildLeaving || showCodex || codexLeaving
          ? 'true'
          : undefined
      "
    >
      <button
        ref="shopEntryButton"
        type="button"
        class="boutique-entry"
        :style="{ backgroundImage: `url(${shopSceneUrl})` }"
        aria-label="进入樱花珍品店"
        @click="openShop"
      >
        <span class="boutique-shade" />
        <span class="boutique-copy">
          <small><Sparkles :size="11" />35 件珍品 · 喵喵专属纸箱套</small>
          <strong>樱花珍品店</strong>
          <span>紫 · 金 · 红洛丽塔系列，支持试穿、专属互动与攻击换肤。</span>
          <em><Coins :size="11" />只收分解与挂机获得的金币</em>
        </span>
        <span class="boutique-cta" aria-hidden="true">
          <ShoppingBag :size="15" />
          进入小店
        </span>
      </button>
      <button
        ref="guildEntryButton"
        type="button"
        class="guild-entry"
        aria-label="进入樱庭公会"
        @click="openGuild"
      >
        <span class="guild-entry-crest"><Castle :size="24" /></span>
        <span class="guild-entry-copy">
          <small>异步共享世界 · 不影响挂机</small>
          <strong>樱庭公会</strong>
          <span>和旅伴共同挑战每周首领，首版只积累荣誉与据点故事。</span>
        </span>
        <span class="guild-entry-cta" aria-hidden="true">
          <Users :size="15" />
          进入公会
        </span>
      </button>
      <button
        ref="codexEntryButton"
        type="button"
        class="codex-entry"
        aria-label="进入套装图鉴"
        @click="openCodex"
      >
        <span class="codex-entry-crest"><Layers :size="24" /></span>
        <span class="codex-entry-copy">
          <small>已集齐 · 缺哪件 · 从哪掉</small>
          <strong>套装图鉴</strong>
          <span>区域、副本、竞技场共 8 套套装的收集进度与获取途径一览。</span>
        </span>
        <span class="codex-entry-cta" aria-hidden="true">
          <Layers :size="15" />
          打开图鉴
        </span>
      </button>

      <CollapsibleCard title="游戏数据" persist-key="more.stats">
        <template #peek>
          <span class="peek-note">击杀 / 时长 / 金币</span>
        </template>
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
      </CollapsibleCard>

      <CollapsibleCard title="互动体验" persist-key="more.haptics">
        <template #peek>
          <span class="peek-note">{{
            settings.settings?.haptics ? '心情震动已开' : '心情震动已关'
          }}</span>
        </template>
        <label class="setting-row">
          <span class="setting-copy">
            <strong>角色心情震动</strong>
            <small>点击互动、作出剧情选择或获得心虹珍藏时，用不同短震回应心情。</small>
            <em>仅在支持震动的手机浏览器中生效；系统“减少动态效果”开启时会自动停用。</em>
          </span>
          <input
            type="checkbox"
            :checked="settings.settings?.haptics ?? false"
            aria-label="角色心情震动"
            @change="updateHaptics"
          />
          <span class="setting-switch" aria-hidden="true"><i /></span>
        </label>
      </CollapsibleCard>

      <CollapsibleCard title="存档管理" persist-key="more.save" :default-open="false">
        <template #peek>
          <span class="peek-note">导出备份 · 导入存档</span>
        </template>
        <p v-if="settings.saveError" class="save-error">自动存档失败：{{ settings.saveError }}</p>
        <SaveIntegrityCard />
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
            将覆盖当前角色，导入「{{ pendingImport.player.name }}」Lv.{{
              pendingImport.player.level
            }}
            的进度。
          </p>
          <div class="btns compact">
            <button class="btn btn-plain f" @click="pendingImport = null">取消</button>
            <button class="btn btn-pink f" @click="confirmImport">确认覆盖</button>
          </div>
        </div>
        <input
          ref="fileInput"
          type="file"
          accept="application/json,.json"
          hidden
          @change="onFile"
        />
      </CollapsibleCard>

      <CollapsibleCard title="危险操作" persist-key="more.danger" :default-open="false">
        <template #peek>
          <span class="peek-note danger-peek">删除存档，重新开始</span>
        </template>
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
      </CollapsibleCard>

      <CollapsibleCard title="旅途计划" persist-key="more.roadmap" :default-open="false">
        <template #peek>
          <span class="peek-note">来信 · 成就 · 日常委托 · 宠物</span>
        </template>
        <div class="chips">
          <span class="chip">旅途来信 · 筹备中</span>
          <span class="chip">成就纪念册 · 筹备中</span>
          <span class="chip">日常委托 · 筹备中</span>
          <span class="chip">宠物协战 · 筹备中</span>
        </div>
      </CollapsibleCard>

      <p class="ver">樱刃传说 · 二版</p>

      <Transition name="toast-up">
        <div v-if="msg" class="toast" :class="{ bad: !msg.ok }">{{ msg.text }}</div>
      </Transition>
    </div>

    <Transition name="page-up" @after-leave="afterShopLeave">
      <ShopView v-if="showShop" @close="closeShop" />
    </Transition>

    <Transition name="page-up" @after-leave="afterGuildLeave">
      <GuildView v-if="showGuild" @close="closeGuild" />
    </Transition>

    <Transition name="page-up" @after-leave="afterCodexLeave">
      <SetCodexView v-if="showCodex" @close="closeCodex" />
    </Transition>
  </div>
</template>

<style scoped>
.more {
  /* 同 .dungeon：锁高会被 flex 负空间压扁子卡，min-height 保底、交给 main 滚动 */
  min-height: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
  position: relative;
}

.more-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.boutique-entry {
  position: relative;
  min-height: 150px;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 9px;
  width: 100%;
  overflow: hidden;
  padding: 12px;
  color: #fff;
  text-align: left;
  background-position: center 56%;
  background-size: cover;
  border: 1px solid rgb(255 255 255 / 75%);
  border-radius: var(--r);
  box-shadow: 0 8px 18px rgb(67 50 76 / 16%);
  transition:
    transform var(--t-fast) var(--ease-spring),
    box-shadow var(--t-mid) var(--ease-soft);
}

.boutique-entry:active {
  transform: scale(0.985);
}

@media (hover: hover) and (pointer: fine) {
  .boutique-entry:hover {
    box-shadow: 0 12px 26px rgb(67 50 76 / 24%);
  }
}

.boutique-shade {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, rgb(42 32 50 / 72%), rgb(42 32 50 / 18%));
}

.boutique-copy {
  position: relative;
  z-index: 1;
  max-width: 238px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  text-shadow: 0 1px 5px rgb(33 24 40 / 70%);
}

.boutique-copy small,
.boutique-copy em {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 9px;
  font-style: normal;
}

.boutique-copy strong {
  font-size: 18px;
}

.boutique-copy > span {
  font-size: 10px;
  line-height: 1.45;
}

.boutique-cta {
  position: relative;
  z-index: 1;
  min-width: 94px;
  min-height: 46px;
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 0 10px;
  font-size: 10px;
  font-weight: 800;
  color: #78405f;
  background: rgb(255 247 250 / 94%);
  border: 1px solid rgb(255 255 255 / 92%);
  border-radius: 14px;
  box-shadow: 0 5px 12px rgb(49 37 57 / 20%);
}

.peek-note {
  font-size: 10px;
  color: var(--text-dim);
}

/* 展开后内容与标题栏之间一道发丝线，保持原来卡片头的分隔感 */
:deep(.fold-inner) > :first-child {
  border-top: 1px solid var(--hairline);
}

.danger-peek {
  color: var(--danger);
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

.setting-row {
  min-height: 88px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 52px;
  align-items: center;
  gap: 10px;
  padding: 11px 12px 12px;
  cursor: pointer;
}

.setting-copy {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.setting-copy strong {
  font-size: 12px;
}

.setting-copy small,
.setting-copy em {
  font-size: 9px;
  font-style: normal;
  line-height: 1.55;
  color: var(--text-mid);
}

.setting-copy em {
  font-size: 8px;
  color: var(--text-dim);
}

.setting-row input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  opacity: 0;
}

.setting-switch {
  position: relative;
  width: 52px;
  height: 30px;
  justify-self: end;
  background: #dce1e8;
  border: 1px solid #cfd6df;
  border-radius: 999px;
  box-shadow: inset 0 1px 2px rgb(53 65 78 / 12%);
  transition:
    background-color var(--t-fast) var(--ease-soft),
    border-color var(--t-fast) var(--ease-soft);
}

.setting-switch i {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 22px;
  height: 22px;
  background: #fff;
  border-radius: 50%;
  box-shadow: 0 2px 6px rgb(42 53 65 / 22%);
  transition: transform var(--t-fast) var(--ease-spring);
}

.setting-row input:checked + .setting-switch {
  background: linear-gradient(120deg, #ff7da7, #ab87de);
  border-color: #f38cb0;
}

.setting-row input:checked + .setting-switch i {
  transform: translateX(22px);
}

.setting-row input:focus-visible + .setting-switch {
  outline: 3px solid rgb(255 126 168 / 28%);
  outline-offset: 3px;
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

/* 小店横幅低频扫光，用位移动画提示入口可点击。 */
.boutique-shade::after {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 36%;
  content: '';
  background: linear-gradient(100deg, transparent, rgb(255 255 255 / 16%), transparent);
  pointer-events: none;
  animation: boutique-shine 6.4s var(--ease-soft) infinite;
}

@keyframes boutique-shine {
  0%,
  62% {
    transform: translate3d(-130%, 0, 0) skewX(-18deg);
  }
  84%,
  100% {
    transform: translate3d(420%, 0, 0) skewX(-18deg);
  }
}

.guild-entry {
  position: relative;
  min-height: 6.5rem;
  display: grid;
  grid-template-columns: 2.8rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.65rem;
  width: 100%;
  overflow: hidden;
  padding: 0.8rem;
  color: #fff;
  text-align: left;
  background:
    radial-gradient(circle at 82% 20%, rgb(255 255 255 / 22%), transparent 28%),
    linear-gradient(135deg, #6f9fbe, #86b4cf 52%, #df89ab);
  border: 1px solid rgb(255 255 255 / 78%);
  border-radius: var(--r);
  box-shadow: 0 0.5rem 1.1rem rgb(68 100 126 / 15%);
  transition: transform var(--t-fast) var(--ease-spring);
}

.guild-entry:active {
  transform: scale(0.985);
}

.guild-entry-crest {
  width: 2.8rem;
  height: 2.8rem;
  display: grid;
  place-items: center;
  color: #7383a0;
  background: rgb(255 255 255 / 92%);
  border-radius: 0.85rem;
  box-shadow: 0 0.3rem 0.7rem rgb(43 68 90 / 18%);
}

.guild-entry-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.12rem;
  text-shadow: 0 1px 4px rgb(38 57 73 / 45%);
}

.guild-entry-copy small {
  font-size: 0.66rem;
  opacity: 0.85;
}
.guild-entry-copy strong {
  font-size: 1rem;
}
.guild-entry-copy > span {
  font-size: 0.72rem;
  line-height: 1.45;
  opacity: 0.9;
}

.guild-entry-cta {
  min-width: 5.2rem;
  min-height: 2.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  padding: 0 0.55rem;
  font-size: 0.72rem;
  font-weight: 800;
  color: #6b6178;
  background: rgb(255 255 255 / 92%);
  border-radius: 0.75rem;
  white-space: nowrap;
}

.codex-entry {
  position: relative;
  min-height: 6.5rem;
  display: grid;
  grid-template-columns: 2.8rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.65rem;
  width: 100%;
  overflow: hidden;
  padding: 0.8rem;
  color: #fff;
  text-align: left;
  background:
    radial-gradient(circle at 18% 88%, rgb(255 255 255 / 20%), transparent 30%),
    linear-gradient(135deg, #9a8ad4, #8fb4e8 52%, #e89cc0);
  border: 1px solid rgb(255 255 255 / 78%);
  border-radius: var(--r);
  box-shadow: 0 0.5rem 1.1rem rgb(122 100 160 / 16%);
  transition: transform var(--t-fast) var(--ease-spring);
}

.codex-entry:active {
  transform: scale(0.985);
}

.codex-entry-crest {
  width: 2.8rem;
  height: 2.8rem;
  display: grid;
  place-items: center;
  color: #7a6cad;
  background: rgb(255 255 255 / 92%);
  border-radius: 0.85rem;
  box-shadow: 0 0.3rem 0.7rem rgb(80 64 120 / 18%);
}

.codex-entry-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.12rem;
  text-shadow: 0 1px 4px rgb(64 50 96 / 45%);
}

.codex-entry-copy small {
  font-size: 0.66rem;
  opacity: 0.85;
}
.codex-entry-copy strong {
  font-size: 1rem;
}
.codex-entry-copy > span {
  font-size: 0.72rem;
  line-height: 1.45;
  opacity: 0.9;
}

.codex-entry-cta {
  min-width: 5.2rem;
  min-height: 2.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  padding: 0 0.55rem;
  font-size: 0.72rem;
  font-weight: 800;
  color: #6b6178;
  background: rgb(255 255 255 / 92%);
  border-radius: 0.75rem;
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  .boutique-shade::after {
    animation: none;
  }
}

@media (max-width: 340px) {
  .boutique-entry {
    min-height: 146px;
    padding: 11px;
  }

  .boutique-cta {
    min-width: 82px;
    padding-inline: 7px;
  }

  .guild-entry,
  .codex-entry {
    grid-template-columns: 2.6rem minmax(0, 1fr) 5.3rem;
    gap: 0.45rem;
    padding: 0.7rem;
  }

  .guild-entry-crest,
  .codex-entry-crest {
    width: 2.6rem;
    height: 2.6rem;
  }

  .guild-entry-cta,
  .codex-entry-cta {
    min-width: 5.3rem;
    padding-inline: 0.35rem;
  }
}
</style>
