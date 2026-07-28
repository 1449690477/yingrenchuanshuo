<script setup lang="ts">
import { computed, ref } from 'vue';
import { ChevronDown, Sparkles } from '@lucide/vue';
import { abbr } from '@/core/format';
import { battleVitalsAtProgress } from '@/core/battleVisual';
import { aggregateLootEntries, type LootDisplayCategory } from '@/core/lootGrouping';
import { averageSkillMultiplier, makeMonster, makePlayer } from '@/core/progression';
import { useInventoryStore } from '@/stores/inventory';
import { usePlayerStore } from '@/stores/player';
import { useStageStore } from '@/stores/stage';
import { requireChapter, requireRegionOfChapter } from '@/data/regions';
import { requireMonster } from '@/data/monsters';
import { requireEquipment } from '@/data/equipment';
import { requireItem } from '@/data/items';
import { QUALITY_LABELS, QUALITY_ORDER, QUALITY_RANK } from '@/data/constants';
import StageSelect from '@/components/StageSelect.vue';
import BattleScene from '@/components/BattleScene.vue';
import EquipmentIcon from '@/components/EquipmentIcon.vue';
import ItemIcon from '@/components/ItemIcon.vue';
import EncounterPanel from '@/components/EncounterPanel.vue';

const player = usePlayerStore();
const inventory = useInventoryStore();
const stage = useStageStore();
const showStages = ref(false);
const showEncounters = ref(false);
const collapsedLoot = ref<Record<LootDisplayCategory, boolean>>({
  equipment: false,
  material: false,
  consumable: false,
  fragment: false,
  currency: false,
});

const lootCategoryLabels: Record<LootDisplayCategory, string> = {
  equipment: '装备',
  material: '材料',
  consumable: '消耗品',
  fragment: '碎片',
  currency: '货币',
};

/** 品质中文名，用于最新掉落聚焦与好货统计。 */
const qualityLabels: Readonly<Record<string, string>> = QUALITY_LABELS;
const highValueQualityOrder = [...QUALITY_ORDER]
  .filter((quality) => QUALITY_RANK[quality] >= QUALITY_RANK.epic)
  .reverse();

/** 挂机窗口底部的实时统计条（纯展示，数据全部来自 store 现有字段）。 */
const idleStats = computed(() => [
  { label: '击杀进度', value: stage.cleared ? '已通关' : `${stage.kills}/${stage.killTarget}` },
  { label: '击杀速度', value: `${stage.kps.toFixed(2)} 只/秒` },
  { label: '本轮掉落', value: `${stage.lootLog.length} 件` },
  { label: '战力对比', value: `${Math.round(stage.cpRatio * 100)}%` },
]);

/** 掉落日志里史诗以上好货的数量分布，一眼看出这波挂机缘不缘。 */
const qualitySummary = computed(() => {
  const counts = new Map<string, number>();
  for (const e of stage.lootLog) counts.set(e.quality, (counts.get(e.quality) ?? 0) + 1);
  return highValueQualityOrder
    .filter((q) => counts.has(q))
    .map((q) => ({ quality: q, count: counts.get(q) ?? 0, label: qualityLabels[q] ?? q }));
});

const groupedLoot = computed(() =>
  aggregateLootEntries(
    stage.lootLog.map((entry) => ({
      ...entry,
      category: entry.isEquipment
        ? ('equipment' as const)
        : (requireItem(entry.itemId).kind as LootDisplayCategory),
    })),
  ),
);
const allLootCollapsed = computed(
  () =>
    groupedLoot.value.length > 0 && groupedLoot.value.every((g) => collapsedLoot.value[g.category]),
);

function toggleAllLoot(): void {
  const next = !allLootCollapsed.value;
  for (const group of groupedLoot.value) collapsedLoot.value[group.category] = next;
}

const region = computed(() => requireRegionOfChapter(stage.current.chapterId));
const chapter = computed(() => requireChapter(stage.current.chapterId));
const chapterMapUrl = computed(() => `${import.meta.env.BASE_URL}${chapter.value.mapAsset}`);
const battleMapUrl = computed(() => `${import.meta.env.BASE_URL}${chapter.value.battleAsset}`);

/** 本关怪物图鉴，用于挑选当前目标之外的纵深陪衬。 */
const monsters = computed(() => {
  const ids = new Set<string>();
  for (const w of stage.current.waves) for (const m of w.monsters) ids.add(m.id);
  return [...ids].map((id) => requireMonster(id));
});

/** 目标由 store 在结算前绑定，击杀演出结束后才切换下一只，避免旧伤害打到新怪。 */
const target = computed(() => requireMonster(stage.battleTargetId));
const supportMonsters = computed(() =>
  monsters.value.filter((monster) => monster.id !== target.value.id).slice(0, 2),
);
const battleVitals = computed(() => {
  const currentPlayer = player.player;
  if (!currentPlayer) return null;
  return battleVitalsAtProgress(
    makePlayer(currentPlayer.name, currentPlayer.level, player.finalStats),
    makeMonster(target.value),
    stage.battleProgress,
    averageSkillMultiplier(currentPlayer.level),
  );
});

const recentDrop = computed(() => {
  const entry = stage.lootLog[0];
  if (!entry) return null;
  const asset = entry.isEquipment
    ? requireEquipment(entry.itemId).icon
    : requireItem(entry.itemId).icon;
  return {
    id: entry.id,
    name: entry.name,
    quality: entry.quality,
    assetUrl: `${import.meta.env.BASE_URL}${asset}`,
  };
});

/** 战力提示。宁可提示得保守，也不要让玩家白挂。 */
const cpWarn = computed(() => {
  if (stage.cpRatio >= 1) return null;
  if (stage.cpRatio >= 0.8) return { level: 'ok', text: '战力略低，效率会慢一些' };
  if (stage.cpRatio >= 0.6) return { level: 'mid', text: '战力不足，建议先提升装备' };
  return { level: 'stop', text: '战力过低，已停止挂机，换低一点的关卡吧' };
});
</script>

<template>
  <div class="idle">
    <button class="stage-bar row-clickable" @click="showStages = true">
      <img class="stage-map" :src="chapterMapUrl" :alt="`${chapter.name}章节场景`" />
      <span class="stage-map-shade" />
      <span class="stage-info">
        <span class="region">{{ region.name }} · {{ chapter.name }}</span>
        <span class="stage-name">{{ stage.current.name }}</span>
      </span>
      <span class="stage-right">
        <span class="lv num">Lv.{{ stage.current.level }}</span>
        <span class="chev">切换 ›</span>
      </span>
    </button>

    <div v-if="cpWarn" class="warn" :class="cpWarn.level">
      <span>{{ cpWarn.text }}</span>
      <span class="warn-num num">
        {{ abbr(player.cp) }} / {{ abbr(stage.current.recommendCP) }}
      </span>
    </div>

    <section class="battle">
      <!-- 挂机窗口外框：状态灯 + 标题 + 统计条，只做容器装饰，不动 BattleScene 内部 -->
      <div class="idle-window" :class="{ running: stage.canIdle }">
        <div class="window-chrome">
          <span class="status-dot" :class="{ running: stage.canIdle }" aria-hidden="true" />
          <span class="window-title">挂机战斗</span>
          <span class="window-state" :class="{ running: stage.canIdle }">
            {{ stage.canIdle ? '自动战斗中' : '已暂停' }}
          </span>
        </div>
        <BattleScene
          v-if="player.player && battleVitals"
          :class-id="player.player.classId"
          :level="player.player.level"
          :equipped="inventory.equipped"
          :player-name="player.player.name"
          :monster="target"
          :support-monsters="supportMonsters"
          :background-url="battleMapUrl"
          :active="stage.canIdle"
          :vitals="battleVitals"
          :status-text="stage.canIdle ? '自动战斗中' : '战斗已暂停'"
          :progress-text="
            stage.cleared ? `${stage.kps.toFixed(2)} 只/秒` : `${stage.kills}/${stage.killTarget}`
          "
          :wave-ratio="stage.cleared ? undefined : stage.kills / stage.killTarget"
          :beats="stage.battleBeats"
          :pulse="stage.battlePulse"
          :drop="recentDrop"
        />
        <div class="idle-stats">
          <div v-for="s in idleStats" :key="s.label" class="stat">
            <span class="stat-value num">{{ s.value }}</span>
            <span class="stat-label">{{ s.label }}</span>
          </div>
        </div>
      </div>
      <div v-if="stage.cleared" class="cleared">✓ 本关已通关，可继续挂机刷材料</div>
    </section>

    <button
      v-if="stage.pendingEncounters.length > 0"
      class="encounter-entry"
      @click="showEncounters = true"
    >
      <span class="encounter-icon"><Sparkles :size="16" aria-hidden="true" /></span>
      <span><strong>旅途中出现了奇遇</strong><small>不会打断挂机，有空再处理</small></span>
      <b class="num">{{ stage.pendingEncounters.length }}</b>
      <i>查看 ›</i>
    </button>

    <section class="loot card">
      <div class="loot-head">
        <span>
          最近掉落
          <small>
            {{ stage.lootLog.length }}/40 条 · {{ groupedLoot.length }} 类
            <span
              v-for="q in qualitySummary"
              :key="q.quality"
              class="q-chip"
              :class="'q-' + q.quality"
              >{{ q.label }}×{{ q.count }}</span
            >
          </small>
        </span>
        <button v-if="groupedLoot.length" @click="toggleAllLoot">
          {{ allLootCollapsed ? '全部展开' : '全部折叠' }}
        </button>
      </div>
      <!-- 最新掉落聚焦：key 随掉落 id 变化，每次出新货重播入场动画 -->
      <div
        v-if="recentDrop"
        :key="recentDrop.id"
        class="loot-spot"
        :class="'q-' + recentDrop.quality"
      >
        <span class="spot-tag">✨ 最新掉落</span>
        <img class="spot-icon" :src="recentDrop.assetUrl" :alt="recentDrop.name" />
        <span class="spot-name" :class="'q-' + recentDrop.quality">{{ recentDrop.name }}</span>
        <span class="spot-quality" :class="'q-' + recentDrop.quality">{{
          qualityLabels[recentDrop.quality] ?? recentDrop.quality
        }}</span>
      </div>
      <div v-if="stage.lootLog.length === 0" class="loot-empty">还没有掉落，稍等一下…</div>
      <div v-else class="loot-list scroll-y">
        <section v-for="group in groupedLoot" :key="group.category" class="loot-group">
          <button
            class="loot-group-head"
            :aria-expanded="!collapsedLoot[group.category]"
            @click="collapsedLoot[group.category] = !collapsedLoot[group.category]"
          >
            <span class="loot-category" :class="'cat-' + group.category">{{
              lootCategoryLabels[group.category]
            }}</span>
            <span class="loot-summary">
              {{ group.distinctCount }} 种 · 共 {{ group.totalCount }} 件
            </span>
            <ChevronDown
              :size="14"
              :class="{ folded: collapsedLoot[group.category] }"
              aria-hidden="true"
            />
          </button>
          <Transition name="loot-fold">
            <div v-if="!collapsedLoot[group.category]" class="loot-items">
              <div
                v-for="(e, i) in group.items"
                :key="e.itemId"
                class="loot-row"
                :class="'q-' + e.quality"
                :style="{ '--row-delay': `${Math.min(i, 8) * 28}ms` }"
              >
                <EquipmentIcon v-if="e.isEquipment" :def="requireEquipment(e.itemId)" size="sm" />
                <ItemIcon v-else :item="requireItem(e.itemId)" />
                <span class="loot-name" :class="'q-' + e.quality">{{ e.name }}</span>
                <span class="loot-count num">×{{ e.count }}</span>
              </div>
            </div>
          </Transition>
        </section>
      </div>
    </section>

    <!-- 合并：保留 UI 打磨的 modal-pop 过渡，同时接入奇遇面板并统一用同一套过渡 -->
    <Transition name="modal-pop">
      <StageSelect v-if="showStages" @close="showStages = false" />
    </Transition>

    <Transition name="modal-pop">
      <EncounterPanel v-if="showEncounters" @close="showEncounters = false" />
    </Transition>
  </div>
</template>

<style scoped>
.idle {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
  min-height: 0;
}

.stage-bar {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 68px;
  overflow: hidden;
  padding: 12px 14px;
  background: linear-gradient(100deg, var(--blue-soft), var(--pink-soft));
  border: 1px solid rgb(255 255 255 / 80%);
  border-radius: 18px;
  text-align: left;
  color: #fff;
  box-shadow: var(--shadow-float);
  transition:
    transform var(--t-fast) var(--ease-spring),
    box-shadow var(--t-mid) var(--ease-soft);
}

.stage-bar:active {
  transform: scale(0.985);
}

/* 低频扫光提示关卡横幅可点击；只移动合成层，不触发布局重排。 */
.stage-bar::after {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 34%;
  content: '';
  background: linear-gradient(100deg, transparent, rgb(255 255 255 / 22%), transparent);
  pointer-events: none;
  animation: stage-shine 5.6s var(--ease-soft) infinite;
}

@keyframes stage-shine {
  0%,
  62% {
    transform: translate3d(-130%, 0, 0) skewX(-18deg);
  }
  82%,
  100% {
    transform: translate3d(430%, 0, 0) skewX(-18deg);
  }
}

.stage-map,
.stage-map-shade {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.stage-map {
  object-fit: cover;
  object-position: center 48%;
}

.stage-map-shade {
  background: linear-gradient(90deg, rgb(39 54 73 / 72%), rgb(39 54 73 / 24%));
}

.stage-info {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.region {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: rgb(255 255 255 / 82%);
  text-shadow: 0 1px 3px rgb(24 38 52 / 45%);
}

.stage-name {
  font-size: 18px;
  font-weight: 800;
  letter-spacing: -0.02em;
  text-shadow:
    0 1px 3px rgb(24 38 52 / 52%),
    0 3px 10px rgb(24 38 52 / 30%);
}

.stage-right {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.lv {
  padding: 4px 9px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.01em;
  color: #fff;
  background: rgb(255 255 255 / 22%);
  border: 1px solid rgb(255 255 255 / 34%);
  border-radius: 999px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 28%),
    0 2px 6px rgb(24 38 52 / 18%);
  backdrop-filter: blur(6px) saturate(1.3);
  -webkit-backdrop-filter: blur(6px) saturate(1.3);
}

.chev {
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 1px 4px rgb(24 38 52 / 58%);
}

.warn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px;
  font-size: 11px;
  border-radius: var(--r-sm);
}

.warn.ok {
  color: #8a7330;
  background: #fff6e0;
}
.warn.mid {
  color: #a3591c;
  background: #ffeed6;
}
.warn.stop {
  color: #a33b43;
  background: #ffe4e6;
}

.warn-num {
  flex-shrink: 0;
  font-weight: 700;
}

.battle {
  position: relative;
  overflow: visible;
  padding: 0;
}

/* ── 挂机窗口外框：给战斗场景套一层带状态灯与统计条的窗口 ── */
.idle-window {
  overflow: hidden;
  background: rgb(255 255 255 / 72%);
  border: 1px solid rgb(255 255 255 / 85%);
  border-radius: 20px;
  box-shadow: var(--shadow-float);
  backdrop-filter: blur(8px) saturate(1.15);
  -webkit-backdrop-filter: blur(8px) saturate(1.15);
  transition: box-shadow var(--t-mid) var(--ease-soft);
}

/* 挂机运行时窗口边缘有极淡的呼吸光晕，一眼知道机器在转。 */
.idle-window.running {
  animation: window-breathe 3.2s var(--ease-soft) infinite;
}

@keyframes window-breathe {
  0%,
  100% {
    box-shadow: var(--shadow-float);
  }
  50% {
    box-shadow:
      var(--shadow-float),
      0 0 22px rgb(245 121 159 / 30%);
  }
}

.window-chrome {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 9px 13px 7px;
}

.status-dot {
  width: 8px;
  height: 8px;
  flex-shrink: 0;
  background: #b6bec8;
  border-radius: 50%;
}

.status-dot.running {
  background: var(--success, #3fae7a);
  box-shadow: 0 0 0 0 rgb(63 174 122 / 45%);
  animation: dot-blink 1.8s ease-out infinite;
}

@keyframes dot-blink {
  0% {
    box-shadow: 0 0 0 0 rgb(63 174 122 / 45%);
  }
  70% {
    box-shadow: 0 0 0 7px rgb(63 174 122 / 0%);
  }
  100% {
    box-shadow: 0 0 0 0 rgb(63 174 122 / 0%);
  }
}

.window-title {
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.06em;
  color: var(--text);
}

.window-state {
  margin-left: auto;
  padding: 2px 9px;
  font-size: 9px;
  font-weight: 700;
  color: var(--text-dim);
  background: rgb(244 246 249 / 90%);
  border-radius: 999px;
}

.window-state.running {
  color: var(--pink-deep);
  background: #fff0f6;
  border: 1px solid rgb(245 121 159 / 22%);
}

.idle-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  padding: 8px 13px 11px;
  border-top: 1px solid var(--hairline);
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  min-width: 0;
}

.stat-value {
  overflow: hidden;
  max-width: 100%;
  font-size: 12px;
  font-weight: 800;
  color: var(--text);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stat-label {
  font-size: 9px;
  letter-spacing: 0.05em;
  color: var(--text-dim);
}

/* ── 掉落面板：最新掉落聚焦 + 好货统计 ── */
.q-chip {
  margin-left: 5px;
  font-weight: 700;
}

.loot-spot {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  padding: 7px 10px;
  background: linear-gradient(100deg, rgb(255 240 246 / 92%), rgb(255 255 255 / 88%));
  border: 1px solid rgb(245 121 159 / 26%);
  border-radius: 13px;
  box-shadow: 0 3px 10px rgb(245 121 159 / 14%);
  animation: spot-pop 0.5s var(--ease-out-back) both;
}

/* 好货聚焦行用品质色勾边，传说以上一眼锁定。 */
.loot-spot.q-epic {
  border-color: rgb(171 111 224 / 45%);
  box-shadow: 0 3px 12px rgb(171 111 224 / 20%);
}
.loot-spot.q-legendary {
  border-color: rgb(255 154 60 / 50%);
  box-shadow: 0 3px 12px rgb(255 154 60 / 24%);
}
.loot-spot.q-mythic {
  border-color: rgb(255 107 122 / 50%);
  box-shadow: 0 3px 12px rgb(255 107 122 / 24%);
}
.loot-spot.q-prismatic {
  border-color: rgb(205 93 218 / 58%);
  box-shadow:
    0 3px 12px rgb(205 93 218 / 22%),
    0 0 10px rgb(84 185 240 / 16%);
}
.loot-spot.q-divine {
  border-color: rgb(232 172 31 / 55%);
  box-shadow: 0 3px 12px rgb(232 172 31 / 26%);
}

@keyframes spot-pop {
  0% {
    opacity: 0;
    transform: translateY(-7px) scale(0.96);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.spot-tag {
  flex-shrink: 0;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.03em;
  color: var(--pink-deep);
}

.spot-icon {
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  object-fit: contain;
  filter: drop-shadow(0 2px 3px rgb(24 38 52 / 18%));
}

.spot-name {
  overflow: hidden;
  min-width: 0;
  flex: 1;
  font-size: 12px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.spot-quality {
  flex-shrink: 0;
  font-size: 9px;
  font-weight: 800;
}

.cleared {
  margin-top: 10px;
  padding: 6px;
  font-size: 10px;
  font-weight: 700;
  text-align: center;
  color: var(--success);
  background: linear-gradient(90deg, #eafaf1, #f2fcf5, #eafaf1);
  border: 1px solid #c2ecd3;
  border-radius: var(--r-sm);
  animation: cleared-pop 0.5s var(--ease-out-back) both;
}

@keyframes cleared-pop {
  0% {
    opacity: 0;
    transform: translateY(-8px) scale(0.94);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.encounter-entry {
  display: grid;
  grid-template-columns: auto 1fr auto auto;
  align-items: center;
  gap: 8px;
  min-height: 46px;
  padding: 7px 10px;
  text-align: left;
  color: var(--text-mid);
  background: linear-gradient(100deg, #fff4f8, var(--blue-soft));
  border: 1px solid #f3d9e7;
  border-radius: var(--r);
  box-shadow: var(--shadow-sm);
}

.encounter-icon {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  color: var(--pink-deep);
  background: #fff;
  border-radius: 50%;
}

.encounter-entry > span:nth-child(2) {
  display: flex;
  min-width: 0;
  flex-direction: column;
}
.encounter-entry strong {
  font-size: 11px;
  color: var(--text);
}
.encounter-entry small {
  font-size: 8px;
  color: var(--text-dim);
}
.encounter-entry b {
  display: grid;
  min-width: 22px;
  height: 22px;
  place-items: center;
  font-size: 10px;
  color: #fff;
  background: var(--pink-deep);
  border-radius: 999px;
}
.encounter-entry i {
  font-size: 9px;
  font-style: normal;
  color: var(--blue-deep);
}

.loot {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 13px;
  overflow: hidden;
  border: 1px solid var(--hairline);
  border-radius: 18px;
  box-shadow: var(--shadow-float);
}

/* 极淡的樱花纹理只填补留白，不影响掉落内容与点击。 */
.loot::after {
  position: absolute;
  inset: 0;
  content: '';
  background-image:
    radial-gradient(circle at 88% 82%, rgb(255 190 216 / 14%) 0 5px, transparent 6px),
    radial-gradient(circle at 78% 92%, rgb(159 216 247 / 13%) 0 4px, transparent 5px),
    radial-gradient(circle at 93% 94%, rgb(255 190 216 / 11%) 0 3px, transparent 4px),
    radial-gradient(circle at 70% 78%, rgb(255 190 216 / 9%) 0 3px, transparent 4px);
  pointer-events: none;
}

.loot > * {
  position: relative;
  z-index: 1;
}

.loot-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
  font-size: 11px;
  color: var(--text-dim);
}

.loot-head > span {
  display: flex;
  flex-direction: column;
  gap: 1px;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: -0.01em;
  color: var(--text);
}

.loot-head small {
  font-size: 8px;
  font-weight: 400;
  color: var(--text-dim);
}

.loot-head button {
  min-height: 34px;
  padding: 0 9px;
  font-size: 9px;
  color: var(--blue-deep);
  background: var(--blue-soft);
  border-radius: 10px;
}

.loot-empty {
  padding: 16px;
  font-size: 11px;
  text-align: center;
  color: var(--text-dim);
}

.loot-list {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.loot-group {
  overflow: hidden;
  flex-shrink: 0;
  background: rgb(255 255 255 / 82%);
  border: 1px solid var(--hairline);
  border-radius: 14px;
  box-shadow: var(--shadow-ambient);
}

.loot-group-head {
  width: 100%;
  min-height: 38px;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 7px;
  padding: 5px 8px;
  text-align: left;
}

.loot-category {
  padding: 3px 8px;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.03em;
  color: var(--pink-deep);
  background: #fff0f6;
  border: 1px solid rgb(245 121 159 / 20%);
  border-radius: 999px;
}

/* iOS 分组列表式的分类色：一眼区分掉落类型。 */
.loot-category.cat-material {
  color: #2f7fc4;
  background: #e9f5ff;
  border-color: rgb(63 163 232 / 20%);
}

.loot-category.cat-consumable {
  color: #1f9c78;
  background: #e8faf3;
  border-color: rgb(143 224 200 / 30%);
}

.loot-category.cat-fragment {
  color: #9a6b1c;
  background: #fff6dd;
  border-color: rgb(255 200 96 / 34%);
}

.loot-category.cat-currency {
  color: #b0582e;
  background: #ffeee4;
  border-color: rgb(255 180 84 / 30%);
}

.loot-summary {
  font-size: 9px;
  color: var(--text-dim);
}

.loot-group-head svg {
  color: var(--text-dim);
  transition: transform 0.18s ease;
}

.loot-group-head svg.folded {
  transform: rotate(-90deg);
}

.loot-items {
  padding: 0 4px 4px;
  border-top: 1px solid var(--hairline);
}

.loot-row {
  display: flex;
  align-items: center;
  gap: 7px;
  min-height: 38px;
  padding: 3px 6px;
  font-size: 12px;
  border-radius: 8px;
  animation: loot-row-pop 0.42s var(--ease-ios) both;
  animation-delay: var(--row-delay, 0ms);
}

@keyframes loot-row-pop {
  0% {
    opacity: 0;
    transform: translateY(6px) scale(0.98);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* 紫装以上的掉落行带品质色柔光底，扫一眼就知道出了好货。 */
.loot-row.q-epic {
  background: linear-gradient(90deg, rgb(171 111 224 / 10%), transparent 72%);
}

.loot-row.q-legendary {
  background: linear-gradient(90deg, rgb(255 154 60 / 12%), transparent 72%);
}

.loot-row.q-mythic {
  background: linear-gradient(90deg, rgb(255 107 122 / 12%), transparent 72%);
}

.loot-row.q-prismatic {
  background: linear-gradient(
    90deg,
    rgb(255 107 157 / 11%),
    rgb(85 185 243 / 9%) 44%,
    transparent 78%
  );
}

.loot-row.q-divine {
  background: linear-gradient(90deg, rgb(232 172 31 / 14%), transparent 72%);
}

/* currentColor 来自行上的品质类，形成紧凑的稀有度提示。 */
.loot-row::before {
  width: 3px;
  height: 16px;
  margin-right: -2px;
  flex-shrink: 0;
  content: '';
  background: currentColor;
  border-radius: 2px;
  opacity: 0.65;
}

.loot-row:nth-child(odd):not(.q-epic):not(.q-legendary):not(.q-mythic):not(.q-prismatic):not(
    .q-divine
  ) {
  background: rgb(247 250 253 / 80%);
}

.loot-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.loot-count {
  flex-shrink: 0;
  color: var(--text-dim);
}

.loot-fold-enter-from,
.loot-fold-leave-to {
  opacity: 0;
  transform: translateY(-5px);
}

.loot-fold-enter-active,
.loot-fold-leave-active {
  transition:
    opacity var(--t-mid) var(--ease-soft),
    transform var(--t-mid) var(--ease-soft);
}

@media (prefers-reduced-motion: reduce) {
  .stage-bar::after,
  .status-dot.running,
  .idle-window.running {
    animation: none;
  }

  .cleared,
  .loot-row,
  .loot-spot {
    animation: none;
  }

  .loot-group-head svg {
    transition: none;
  }

  .loot-fold-enter-from,
  .loot-fold-leave-to {
    transform: none;
  }

  .loot-fold-enter-active,
  .loot-fold-leave-active {
    transition: none;
  }
}
</style>
