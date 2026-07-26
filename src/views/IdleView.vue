<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import { abbr } from '@/core/format';
import { usePlayerStore } from '@/stores/player';
import { useStageStore } from '@/stores/stage';
import { requireChapter, requireRegionOfChapter } from '@/data/regions';
import { requireMonster } from '@/data/monsters';
import { requireEquipment } from '@/data/equipment';
import { requireItem } from '@/data/items';
import { unlockedVisualSkills, type VisualSkill } from '@/data/skills';
import StageSelect from '@/components/StageSelect.vue';
import ClassArtwork from '@/components/ClassArtwork.vue';
import MonsterArtwork from '@/components/MonsterArtwork.vue';
import EquipmentIcon from '@/components/EquipmentIcon.vue';
import ItemIcon from '@/components/ItemIcon.vue';

const player = usePlayerStore();
const stage = useStageStore();
const showStages = ref(false);
const casting = ref(false);
let castTimer = 0;

const region = computed(() => requireRegionOfChapter(stage.current.chapterId));
const chapter = computed(() => requireChapter(stage.current.chapterId));
const chapterMapUrl = computed(() => `${import.meta.env.BASE_URL}${chapter.value.mapAsset}`);

/** 本关出现的怪物，做一个简单的「战场」展示 */
const monsters = computed(() => {
  const ids = new Set<string>();
  for (const w of stage.current.waves) for (const m of w.monsters) ids.add(m.id);
  return [...ids].map((id) => requireMonster(id));
});
/** BOSS / 精英关优先展示该关最重要的敌人，不再永远显示第一只小怪。 */
const target = computed(
  () =>
    monsters.value.find((monster) => monster.type === 'boss') ??
    monsters.value.find((monster) => monster.type === 'elite') ??
    monsters.value[0]!,
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
  const skills = unlockedVisualSkills(p.classId, p.level);
  if (skills.length === 0) return null;
  return skills[Math.floor((pulse.id - 1) / 3) % skills.length]!;
});

const activeEffectUrl = computed(() =>
  activeVisualSkill.value
    ? `${import.meta.env.BASE_URL}${activeVisualSkill.value.effectAsset}`
    : null,
);

watch(
  () => stage.battlePulse?.id,
  (pulseId) => {
    if (!pulseId || !activeVisualSkill.value) return;
    casting.value = true;
    clearTimeout(castTimer);
    castTimer = window.setTimeout(() => (casting.value = false), 720);
  },
);

onUnmounted(() => clearTimeout(castTimer));

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
        <img class="arena-map" :src="chapterMapUrl" alt="" aria-hidden="true" />
        <span class="arena-shade" />
        <div class="hero-slot">
          <div
            class="avatar-big"
            :class="{ fighting: stage.canIdle && !casting, casting: casting }"
          >
            <ClassArtwork
              v-if="player.player"
              :class-id="player.player.classId"
              variant="battle"
              :action="casting ? 'cast' : 'idle'"
            />
          </div>
          <div class="hero-name">{{ player.player?.name }}</div>
        </div>

        <div class="vs">⚔</div>

        <div class="mob-list">
          <div class="enemy-stage" :class="'enemy-' + target.type">
            <div
              :key="`${target.id}-${stage.battlePulse?.id ?? 0}`"
              class="enemy-art"
              :class="{ hit: !!stage.battlePulse }"
            >
              <MonsterArtwork :monster="target" />
              <span v-if="target.type !== 'normal'" class="target-tag">
                {{ target.type === 'boss' ? 'BOSS' : '精英' }}
              </span>
            </div>
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
          </div>
          <div class="mob-grid">
            <div v-for="m in monsters.slice(0, 4)" :key="m!.id" class="mob">
              <MonsterArtwork :monster="m!" variant="thumb" />
              <span class="mob-name">{{ m!.name }}</span>
              <span v-if="m!.type !== 'normal'" class="mob-tag">
                {{ m!.type === 'boss' ? 'B' : '精' }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="activeVisualSkill && activeEffectUrl && stage.battlePulse"
        :key="stage.battlePulse.id"
        class="spell-fx"
        :class="`kind-${activeVisualSkill.visualKind}`"
        aria-hidden="true"
      >
        <img :src="activeEffectUrl" alt="" draggable="false" />
        <span v-for="n in 6" :key="n" class="fx-particle" />
        <span class="spell-name">{{ activeVisualSkill.name }}</span>
      </div>

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
  overflow: hidden;
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
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 112px;
  overflow: hidden;
  padding: 6px;
  border: 1px solid rgb(255 255 255 / 82%);
  border-radius: var(--r);
}

.arena-map,
.arena-shade {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.arena-map {
  object-fit: cover;
  object-position: center 48%;
}

.arena-shade {
  background: linear-gradient(90deg, rgb(255 255 255 / 58%), rgb(255 255 255 / 34%));
  backdrop-filter: blur(0.5px);
}

.hero-slot,
.vs,
.mob-list {
  position: relative;
  z-index: 1;
}

.hero-slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.avatar-big {
  width: 72px;
  height: 100px;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 22px;
  background:
    radial-gradient(circle at 50% 76%, #fff 0 20%, transparent 42%),
    linear-gradient(145deg, var(--blue-soft), var(--pink-soft));
  border: 1.5px solid rgb(255 180 210 / 78%);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 65%);
}

.avatar-big.fighting {
  animation: bob 2.2s ease-in-out infinite;
}

.avatar-big.casting {
  animation: cast-lunge 0.72s ease-out both;
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

@keyframes cast-lunge {
  0%,
  100% {
    transform: translateX(0) scale(1);
  }
  32% {
    transform: translateX(5px) scale(1.05) rotate(1.5deg);
  }
}

.hero-name {
  font-size: 11px;
  font-weight: 600;
  color: #33465b;
  text-shadow: 0 1px 2px #fff;
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

.enemy-stage {
  display: flex;
  align-items: center;
  min-height: 90px;
  padding: 3px 6px 3px 2px;
  background:
    radial-gradient(circle at 26% 72%, #fff 0 18%, transparent 42%),
    linear-gradient(145deg, #fff7fb, var(--pink-soft));
  border: 1px solid #ffd7e6;
  border-radius: var(--r-sm);
}

.enemy-stage.enemy-elite {
  background: linear-gradient(145deg, #f9fbff, #edf5ff);
  border-color: #cbe4f8;
}

.enemy-stage.enemy-boss {
  background: linear-gradient(145deg, #fffaf2, #fff0dd);
  border-color: #ffd39d;
}

.enemy-art {
  position: relative;
  display: grid;
  place-items: center;
  width: 88px;
  height: 84px;
  flex-shrink: 0;
}

.enemy-art.hit {
  animation: enemy-hit 0.34s ease-out;
}

.target-tag {
  position: absolute;
  left: 4px;
  bottom: 2px;
  padding: 1px 5px;
  font-size: 7px;
  font-weight: 800;
  color: #fff;
  background: var(--q-legendary);
  border-radius: 999px;
}

.target {
  position: relative;
  flex: 1;
  min-width: 0;
  padding: 6px 9px 8px;
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

@keyframes enemy-hit {
  0%,
  100% {
    transform: translateX(0) scale(1);
    filter: brightness(1);
  }
  35% {
    transform: translateX(4px) scale(0.95);
    filter: brightness(1.18);
  }
}

.spell-fx {
  position: absolute;
  z-index: 8;
  right: 2px;
  top: 35px;
  width: 166px;
  height: 150px;
  pointer-events: none;
}

.spell-fx img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 4px 7px rgb(129 93 157 / 20%));
}

.kind-projectile img {
  animation: fireball-cast 0.78s ease-out both;
}

.kind-ring img {
  animation: ring-cast 0.86s ease-out both;
}

.kind-lightning img {
  animation: lightning-cast 0.72s ease-out both;
}

.kind-slash img {
  animation: slash-cast 0.64s ease-out both;
}

.kind-arc img {
  animation: arc-cast 0.78s ease-out both;
}

.kind-flame img {
  animation: flame-cast 0.8s ease-out both;
}

.spell-name {
  position: absolute;
  right: 15px;
  bottom: 10px;
  padding: 2px 7px;
  font-size: 9px;
  font-weight: 800;
  color: var(--pink-deep);
  background: rgb(255 255 255 / 82%);
  border-radius: 999px;
  animation: spell-label 0.85s ease-out both;
}

.kind-lightning .spell-name {
  color: var(--blue-deep);
}

.kind-slash .spell-name,
.kind-arc .spell-name {
  color: #526fae;
}

.kind-flame .spell-name {
  color: #e25f63;
}

.fx-particle {
  --dx: 0px;
  --dy: -28px;
  position: absolute;
  left: 52%;
  top: 53%;
  width: 7px;
  height: 7px;
  background: var(--pink);
  border: 1px solid #fff;
  border-radius: 2px;
  transform: rotate(45deg);
  animation: particle-pop 0.76s ease-out both;
}

.fx-particle:nth-of-type(2) {
  --dx: 44px;
  --dy: -24px;
  animation-delay: 0.05s;
}

.fx-particle:nth-of-type(3) {
  --dx: 52px;
  --dy: 18px;
  width: 5px;
  height: 5px;
  background: var(--blue);
  animation-delay: 0.09s;
}

.fx-particle:nth-of-type(4) {
  --dx: -44px;
  --dy: 25px;
  animation-delay: 0.04s;
}

.fx-particle:nth-of-type(5) {
  --dx: -48px;
  --dy: -20px;
  width: 5px;
  height: 5px;
  background: var(--gold);
  animation-delay: 0.11s;
}

.fx-particle:nth-of-type(6) {
  --dx: 8px;
  --dy: 42px;
  background: #c7bdff;
  animation-delay: 0.08s;
}

@keyframes fireball-cast {
  0% {
    opacity: 0;
    transform: translate(-78px, 22px) scale(0.24) rotate(-18deg);
  }
  48% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate(4px, 0) scale(0.94) rotate(2deg);
  }
}

@keyframes ring-cast {
  0% {
    opacity: 0;
    transform: scale(0.18) rotate(-55deg);
  }
  45% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: scale(1.18) rotate(18deg);
  }
}

@keyframes lightning-cast {
  0% {
    opacity: 0;
    transform: translateY(-30px) scaleY(1.24) scaleX(0.75);
  }
  24%,
  48% {
    opacity: 1;
    filter: brightness(1.22) drop-shadow(0 0 8px rgb(137 151 255 / 60%));
  }
  100% {
    opacity: 0;
    transform: translateY(2px) scale(1.06);
  }
}

@keyframes slash-cast {
  0% {
    opacity: 0;
    transform: translate(-28px, 18px) scale(0.48) rotate(-15deg);
  }
  32% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate(5px, -3px) scale(1.06) rotate(2deg);
  }
}

@keyframes arc-cast {
  0% {
    opacity: 0;
    transform: translateX(-22px) scale(0.38) rotate(-20deg);
  }
  42% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translateX(6px) scale(1.14) rotate(8deg);
  }
}

@keyframes flame-cast {
  0% {
    opacity: 0;
    transform: translateY(24px) scale(0.38);
    filter: brightness(1.4);
  }
  34%,
  60% {
    opacity: 1;
    filter: brightness(1.12) drop-shadow(0 0 8px rgb(255 132 136 / 58%));
  }
  100% {
    opacity: 0;
    transform: translateY(-5px) scale(1.08);
  }
}

@keyframes particle-pop {
  0% {
    opacity: 0;
    transform: translate(0, 0) rotate(45deg) scale(0.2);
  }
  35% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate(var(--dx), var(--dy)) rotate(130deg) scale(1);
  }
}

@keyframes spell-label {
  0%,
  100% {
    opacity: 0;
    transform: translateY(4px);
  }
  26%,
  68% {
    opacity: 1;
    transform: translateY(0);
  }
}

.mob {
  display: flex;
  align-items: center;
  gap: 3px;
  min-width: 0;
  padding: 2px 5px 2px 2px;
  font-size: 9px;
  background: var(--panel-3);
  border-radius: 10px;
}

.mob-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3px;
}

.mob-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mob-tag {
  margin-left: auto;
  font-size: 8px;
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
