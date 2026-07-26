<script setup lang="ts">
import { computed, ref } from 'vue';
import { abbr } from '@/core/format';
import { usePlayerStore } from '@/stores/player';
import { useStageStore } from '@/stores/stage';
import { requireChapter, requireRegionOfChapter } from '@/data/regions';
import { requireMonster } from '@/data/monsters';
import StageSelect from '@/components/StageSelect.vue';

const player = usePlayerStore();
const stage = useStageStore();
const showStages = ref(false);

const region = computed(() => requireRegionOfChapter(stage.current.chapterId));
const chapter = computed(() => requireChapter(stage.current.chapterId));

/** 本关出现的怪物，做一个简单的「战场」展示 */
const monsters = computed(() => {
  const ids = new Set<string>();
  for (const w of stage.current.waves) for (const m of w.monsters) ids.add(m.id);
  return [...ids].map((id) => requireMonster(id));
});
const target = computed(() => monsters.value[0]!);
const hpPercent = computed(() => Math.max(1, (1 - stage.battleProgress) * 100));

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

    <section class="battle card">
      <div class="battle-head">
        <span>{{ stage.canIdle ? '战斗中…' : '已暂停' }}</span>
        <span class="kps num">
          {{
            stage.cleared ? `${stage.kps.toFixed(2)} 只/秒` : `${stage.kills}/${stage.killTarget}`
          }}
        </span>
      </div>

      <div class="arena">
        <div class="hero-slot">
          <div class="avatar-big" :class="{ fighting: stage.canIdle }">🌸</div>
          <div class="hero-name">{{ player.player?.name }}</div>
        </div>

        <div class="vs">⚔</div>

        <div class="mob-list">
          <div class="target">
            <div class="target-line">
              <span>{{ target.name }}</span>
              <span class="num">Lv.{{ target.level }}</span>
            </div>
            <div class="hpbar">
              <div class="hpbar-fill" :style="{ width: hpPercent + '%' }" />
            </div>
            <Transition name="damage">
              <span v-if="stage.battlePulse" :key="stage.battlePulse.id" class="damage num">
                -{{ abbr(stage.battlePulse.damage) }}
                <small v-if="stage.battlePulse.kills > 1">×{{ stage.battlePulse.kills }}</small>
              </span>
            </Transition>
          </div>
          <div v-for="m in monsters.slice(0, 4)" :key="m!.id" class="mob">
            <span class="mob-dot" :class="'t-' + m!.type" />
            <span class="mob-name">{{ m!.name }}</span>
            <span v-if="m!.type !== 'normal'" class="mob-tag">
              {{ m!.type === 'boss' ? 'BOSS' : '精英' }}
            </span>
          </div>
        </div>
      </div>

      <div v-if="stage.cleared" class="cleared">✓ 本关已通关，可继续挂机刷材料</div>
    </section>

    <section class="loot card">
      <div class="loot-head">掉落</div>
      <div v-if="stage.lootLog.length === 0" class="loot-empty">还没有掉落，稍等一下…</div>
      <TransitionGroup v-else name="drop" tag="div" class="loot-list scroll-y">
        <div v-for="e in stage.lootLog" :key="e.id" class="loot-row">
          <span class="loot-name" :class="'q-' + e.quality">
            {{ e.isEquipment ? '⚔' : '◆' }} {{ e.name }}
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
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 11px 14px;
  background: linear-gradient(100deg, var(--blue-soft), var(--pink-soft));
  border: 1px solid var(--line);
  border-radius: var(--r);
  text-align: left;
}

.stage-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.region {
  font-size: 10px;
  color: var(--text-dim);
}

.stage-name {
  font-size: 15px;
  font-weight: 700;
}

.stage-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.lv {
  font-size: 11px;
  font-weight: 600;
  color: var(--blue-deep);
}

.chev {
  font-size: 11px;
  font-weight: 600;
  color: var(--pink-deep);
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
  padding: 12px;
}

.battle-head {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
  font-size: 11px;
  color: var(--text-dim);
}

.kps {
  font-weight: 600;
  color: var(--blue-deep);
}

.arena {
  display: flex;
  align-items: center;
  gap: 10px;
}

.hero-slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.avatar-big {
  width: 56px;
  height: 56px;
  display: grid;
  place-items: center;
  font-size: 28px;
  border-radius: 50%;
  background: linear-gradient(140deg, #fff, var(--pink-soft));
  border: 2px solid var(--pink);
}

.avatar-big.fighting {
  animation: bob 2.2s ease-in-out infinite;
}

@keyframes bob {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-5px);
  }
}

.hero-name {
  font-size: 11px;
  font-weight: 600;
}

.vs {
  font-size: 14px;
  color: var(--text-dim);
}

.mob-list {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.target {
  position: relative;
  padding: 6px 9px 8px;
  background: var(--pink-soft);
  border: 1px solid #ffd7e6;
  border-radius: var(--r-sm);
}

.target-line {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
  font-size: 10px;
  font-weight: 600;
}

.hpbar {
  height: 6px;
  overflow: hidden;
  background: #fff;
  border-radius: 999px;
}

.hpbar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--pink-deep), var(--pink));
  border-radius: inherit;
  transition: width 0.24s linear;
}

.damage {
  position: absolute;
  right: 12px;
  top: -4px;
  color: var(--danger);
  font-size: 13px;
  font-weight: 800;
  text-shadow: 0 1px #fff;
  pointer-events: none;
}

.damage small {
  font-size: 9px;
}

.damage-enter-from {
  opacity: 0;
  transform: translateY(8px) scale(0.85);
}

.damage-enter-active {
  transition: all 0.18s ease-out;
}

.damage-leave-to {
  opacity: 0;
  transform: translateY(-14px);
}

.damage-leave-active {
  transition: all 0.6s ease-in;
}

.mob {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 9px;
  font-size: 11px;
  background: var(--panel-3);
  border-radius: 999px;
}

.mob-dot {
  width: 6px;
  height: 6px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--q-common);
}
.mob-dot.t-elite {
  background: var(--q-rare);
}
.mob-dot.t-boss {
  background: var(--q-legendary);
}

.mob-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mob-tag {
  margin-left: auto;
  font-size: 9px;
  font-weight: 700;
  color: var(--q-legendary);
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
  justify-content: space-between;
  padding: 4px 6px;
  font-size: 12px;
  border-radius: 6px;
}

.loot-row:nth-child(odd) {
  background: var(--panel-2);
}

.loot-name {
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
