<script setup lang="ts">
import { computed, ref } from 'vue';
import { abbr } from '@/core/format';
import { battleMonsterIdAt } from '@/core/battleVisual';
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

const player = usePlayerStore();
const inventory = useInventoryStore();
const stage = useStageStore();
const showStages = ref(false);

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

/**
 * 视觉目标严格跟随波次顺序：推关阶段用累计击杀数，已通关挂机则用击杀脉冲循环。
 * 它只改变画面，不改动 M2 的收益与伤害公式。
 */
const visualMonsterCursor = computed(() =>
  stage.cleared ? (stage.battlePulse?.id ?? 0) : stage.kills,
);
const target = computed(() =>
  requireMonster(battleMonsterIdAt(stage.current, visualMonsterCursor.value)),
);
const supportMonsters = computed(() =>
  monsters.value.filter((monster) => monster.id !== target.value.id).slice(0, 2),
);
const hpPercent = computed(() => Math.max(1, (1 - stage.battleProgress) * 100));

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
    <button class="stage-bar" @click="showStages = true">
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
        v-if="player.player"
        :class-id="player.player.classId"
        :level="player.player.level"
        :equipped="inventory.equipped"
        :player-name="player.player.name"
        :monster="target"
        :support-monsters="supportMonsters"
        :background-url="battleMapUrl"
        :active="stage.canIdle"
        :hp-percent="hpPercent"
        :status-text="stage.canIdle ? '自动战斗中' : '战斗已暂停'"
        :progress-text="
          stage.cleared ? `${stage.kps.toFixed(2)} 只/秒` : `${stage.kills}/${stage.killTarget}`
        "
        :pulse="stage.battlePulse"
        :skill="activeVisualSkill"
        :effect-url="activeEffectUrl"
        :drop="recentDrop"
      />
      <div v-if="stage.cleared" class="cleared">✓ 本关已通关，可继续挂机刷材料</div>
    </section>

    <section class="loot card">
      <div class="loot-head">掉落</div>
      <div v-if="stage.lootLog.length === 0" class="loot-empty">还没有掉落，稍等一下…</div>
      <TransitionGroup v-else name="drop" tag="div" class="loot-list scroll-y">
        <div v-for="e in stage.lootLog" :key="e.id" class="loot-row">
          <EquipmentIcon v-if="e.isEquipment" :def="requireEquipment(e.itemId)" size="sm" />
          <ItemIcon v-else :item="requireItem(e.itemId)" />
          <span class="loot-name" :class="'q-' + e.quality">
            {{ e.name }}
          </span>
          <span class="loot-count num">×{{ e.count }}</span>
        </div>
      </TransitionGroup>
    </section>

    <StageSelect v-if="showStages" @close="showStages = false" />
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
  text-align: center;
  color: var(--success);
  background: #eafaf1;
  border-radius: var(--r-sm);
}

.loot {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 12px;
}

.loot-head {
  margin-bottom: 6px;
  font-size: 11px;
  color: var(--text-dim);
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
  gap: 2px;
}

.loot-row {
  display: flex;
  align-items: center;
  gap: 7px;
  min-height: 38px;
  padding: 3px 6px;
  font-size: 12px;
  border-radius: 6px;
}

.loot-row:nth-child(odd) {
  background: var(--panel-2);
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

.drop-enter-from {
  opacity: 0;
  transform: translateX(-10px);
}

.drop-enter-active {
  transition: all 0.22s;
}
</style>
