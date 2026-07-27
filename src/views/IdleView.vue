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
import { battleVisualSkillFor, type VisualSkill } from '@/data/skills';
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

/**
 * M3 技能自动释放尚未接入前，视觉演出只跟随真实击杀脉冲。
 * 技能按玩家等级解锁，绝不提前展示未学会的技能；伤害仍由 M2 平均技能倍率结算。
 */
const activeVisualSkill = computed<VisualSkill | null>(() => {
  const p = player.player;
  const pulse = stage.battlePulse;
  if (!p || !pulse) return null;
  return battleVisualSkillFor(p.classId, p.level, pulse.id);
});

const activeEffectUrl = computed(() =>
  activeVisualSkill.value
    ? `${import.meta.env.BASE_URL}${activeVisualSkill.value.effectAsset}`
    : null,
);

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
        :pulse="stage.battlePulse"
        :skill="activeVisualSkill"
        :effect-url="activeEffectUrl"
        :drop="recentDrop"
      />
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
          <small>{{ stage.lootLog.length }}/40 条 · {{ groupedLoot.length }} 类</small>
        </span>
        <button v-if="groupedLoot.length" @click="toggleAllLoot">
          {{ allLootCollapsed ? '全部展开' : '全部折叠' }}
        </button>
      </div>
      <div v-if="stage.lootLog.length === 0" class="loot-empty">还没有掉落，稍等一下…</div>
      <div v-else class="loot-list scroll-y">
        <section v-for="group in groupedLoot" :key="group.category" class="loot-group">
          <button
            class="loot-group-head"
            :aria-expanded="!collapsedLoot[group.category]"
            @click="collapsedLoot[group.category] = !collapsedLoot[group.category]"
          >
            <span class="loot-category">{{ lootCategoryLabels[group.category] }}</span>
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
  min-height: 64px;
  overflow: hidden;
  padding: 11px 14px;
  background: linear-gradient(100deg, var(--blue-soft), var(--pink-soft));
  border: 1px solid var(--line);
  border-radius: var(--r);
  text-align: left;
  color: #fff;
}

/* 低频扫光：提示这条横幅是可以点的 */
.stage-bar::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: -40%;
  width: 34%;
  background: linear-gradient(100deg, transparent, rgb(255 255 255 / 22%), transparent);
  transform: skewX(-18deg);
  animation: stage-shine 5.6s var(--ease-soft) infinite;
  pointer-events: none;
}

@keyframes stage-shine {
  0%,
  62% {
    left: -40%;
  }
  82%,
  100% {
    left: 112%;
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
  color: rgb(255 255 255 / 78%);
}

.stage-name {
  font-size: 15px;
  font-weight: 700;
  text-shadow: 0 1px 4px rgb(24 38 52 / 58%);
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
  padding: 2px 6px;
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  background: rgb(255 255 255 / 18%);
  border-radius: 999px;
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
  padding: 12px;
  overflow: hidden;
}

/* 空区域铺一层极淡的樱花纹理，让留白显得有设计感 */
.loot::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    radial-gradient(circle at 88% 82%, rgb(255 190 216 / 14%) 0 5px, transparent 6px),
    radial-gradient(circle at 78% 92%, rgb(159 216 247 / 13%) 0 4px, transparent 5px),
    radial-gradient(circle at 93% 94%, rgb(255 190 216 / 11%) 0 3px, transparent 4px),
    radial-gradient(circle at 70% 78%, rgb(255 190 216 / 09%) 0 3px, transparent 4px);
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
  font-weight: 700;
  color: var(--text-mid);
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
  background: var(--panel-2);
  border: 1px solid var(--line);
  border-radius: 10px;
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
  padding: 3px 7px;
  font-size: 9px;
  font-weight: 800;
  color: var(--pink-deep);
  background: #fff0f6;
  border-radius: 999px;
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
  border-top: 1px solid var(--line);
}

.loot-row {
  display: flex;
  align-items: center;
  gap: 7px;
  min-height: 38px;
  padding: 3px 6px;
  font-size: 12px;
  border-radius: 6px;
  animation: row-in var(--t-slow) var(--ease-soft) both;
  animation-delay: var(--row-delay, 0ms);
}

/* 品质色条：一眼分辨掉落稀有度（currentColor 取自行的 q-* 类） */
.loot-row::before {
  content: '';
  flex-shrink: 0;
  width: 3px;
  height: 16px;
  margin-right: -2px;
  border-radius: 2px;
  background: currentColor;
  opacity: 0.65;
}

.loot-row:nth-child(odd) {
  background: rgb(255 255 255 / 74%);
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
  transition: all var(--t-mid) var(--ease-soft);
}
</style>
