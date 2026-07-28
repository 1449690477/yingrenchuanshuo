<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import {
  CalendarDays,
  Check,
  Crown,
  Gem,
  LockKeyhole,
  Map,
  ShieldCheck,
  Sparkles,
  Swords,
  TowerControl,
  UsersRound,
} from '@lucide/vue';
import type { EquipSlot } from '@/core/types';
import {
  isEquipmentDungeonStageUnlocked,
  type EquipmentDungeonClearRecord,
} from '@/core/equipmentDungeon';
import { abbr } from '@/core/format';
import { CLASS_INFO, QUALITY_LABELS, SLOT_LABELS } from '@/data/constants';
import { requireEquipment } from '@/data/equipment';
import {
  EQUIPMENT_DUNGEON_PORTALS,
  equipmentDungeonDropsForClass,
  equipmentDungeonStagesForSlot,
} from '@/data/equipmentDungeons';
import {
  EQUIPMENT_DUNGEON_TIERS,
  type EquipmentDungeonTierId,
} from '@/data/equipmentDungeonGear';
import { EQUIPMENT_DUNGEON_RULES } from '@/data/equipmentDungeonRules';
import { requireEquipmentDungeonSet } from '@/data/equipmentDungeonSets';
import { emptyEquipped } from '@/save/schema';
import { useGameStore, type EquipmentDungeonRunResult } from '@/stores/game';
import EquipmentDungeonBattle from '@/components/EquipmentDungeonBattle.vue';
import EquipmentIcon from '@/components/EquipmentIcon.vue';
import SystemArtwork from '@/components/SystemArtwork.vue';

type PlayedResult = Extract<EquipmentDungeonRunResult, { ok: true }>;

const game = useGameStore();
const selectedSlot = ref<EquipSlot>('weapon');
const selectedTierId = ref<EquipmentDungeonTierId>('azure');
const battleResult = ref<PlayedResult | null>(null);
const challengeButton = ref<HTMLButtonElement | null>(null);
const notice = ref('');

const planned = [
  {
    name: '日常材料副本',
    when: 'M4-4',
    desc: '周一到周日轮换，定向刷强化材料',
    icon: CalendarDays,
  },
  { name: '无尽塔', when: 'M6-4', desc: '爬塔，层数上排行榜', icon: TowerControl },
  {
    name: '世界 BOSS',
    when: 'M8-1',
    desc: '每日定时两场，全服伤害排名',
    icon: Crown,
  },
  {
    name: '公会团本',
    when: 'M8-5',
    desc: '成员各自打，伤害累加到共享血条',
    icon: UsersRound,
  },
] as const;

const portal = computed(
  () => EQUIPMENT_DUNGEON_PORTALS.find((candidate) => candidate.slot === selectedSlot.value)!,
);
const slotStages = computed(() => equipmentDungeonStagesForSlot(selectedSlot.value));
const stage = computed(
  () => slotStages.value.find((candidate) => candidate.tierId === selectedTierId.value)!,
);
const playerLevel = computed(() => game.player?.level ?? 1);
const classId = computed(() => game.player?.classId ?? 'swordsman');
const dungeonState = computed(() => game.save?.equipmentDungeon ?? null);
const equipped = computed(() => game.save?.equipped ?? emptyEquipped());
const reduceMotion = computed(() => game.save?.settings.reduceMotion ?? false);
const clearedCount = computed(() =>
  dungeonState.value ? Object.keys(dungeonState.value.records).length : 0,
);
const currentRecord = computed<EquipmentDungeonClearRecord | null>(
  () => dungeonState.value?.records[stage.value.id] ?? null,
);
const unlocked = computed(
  () =>
    dungeonState.value !== null &&
    isEquipmentDungeonStageUnlocked(stage.value, dungeonState.value, playerLevel.value),
);
const drops = computed(() =>
  equipmentDungeonDropsForClass(stage.value, classId.value).map(requireEquipment),
);
const previousStage = computed(() =>
  stage.value.previousStageId
    ? slotStages.value.find((candidate) => candidate.id === stage.value.previousStageId)
    : null,
);
const cpRatio = computed(() =>
  stage.value.recommendCP > 0 ? game.cp / stage.value.recommendCP : 1,
);
const cpPercent = computed(() => Math.min(100, Math.max(5, cpRatio.value * 100)));
const currentTier = computed(
  () => EQUIPMENT_DUNGEON_TIERS.find((tier) => tier.id === selectedTierId.value)!,
);
const currentSet = computed(() => requireEquipmentDungeonSet(currentTier.value.setId));
const currentSetProgress = computed(
  () =>
    game.equipmentSetResolution.sets.find(
      (activeSet) => activeSet.definition.id === currentSet.value.id,
    )?.equippedPieces ?? 0,
);
const challengeDisabled = computed(
  () => !unlocked.value || game.equipmentDungeonRemaining <= 0 || battleResult.value !== null,
);
const lockCopy = computed(() => {
  if (playerLevel.value < stage.value.unlockLevel) {
    return `角色达到 Lv${stage.value.unlockLevel} 后开放`;
  }
  if (previousStage.value && !dungeonState.value?.records[previousStage.value.id]) {
    return `先首通同部位「${previousStage.value.name}」`;
  }
  if (game.equipmentDungeonRemaining <= 0) {
    return '今日 3 次奖励已领取，明日 04:00 恢复';
  }
  if (cpRatio.value < 0.75) {
    return '可以挑战，但战力偏低；失败不会扣次数';
  }
  return currentRecord.value
    ? `胜利必得 1 件${QUALITY_LABELS[stage.value.quality]}${SLOT_LABELS[stage.value.slot]}`
    : `首通必得 2 件${QUALITY_LABELS[stage.value.quality]}${SLOT_LABELS[stage.value.slot]}`;
});

const assetUrl = (asset: string) => `${import.meta.env.BASE_URL}${asset}`;

function selectSlot(slot: EquipSlot): void {
  selectedSlot.value = slot;
  notice.value = '';
}

function selectTier(tierId: EquipmentDungeonTierId): void {
  selectedTierId.value = tierId;
  notice.value = '';
}

function challenge(): void {
  notice.value = '';
  const result = game.runEquipmentDungeon(stage.value.id);
  if (!result.ok) {
    notice.value =
      result.reason === 'level-locked'
        ? `需要 Lv${stage.value.unlockLevel}`
        : result.reason === 'previous-tier-locked'
          ? '前一档还没有首通'
          : result.reason === 'daily-limit'
            ? '今天的 3 次奖励已领完'
            : result.reason === 'unknown-stage'
              ? '副本配置不存在，请检查内容表'
              : '存档尚未载入';
    return;
  }
  battleResult.value = result;
  notice.value = result.win
    ? `获得 ${result.instances.map((instance) => requireEquipment(instance.defId).name).join('、')}`
    : '挑战失败：次数、保底与随机序列均未消耗';
}

function closeBattle(): void {
  battleResult.value = null;
  void nextTick(() => challengeButton.value?.focus());
}

onMounted(() => game.refreshEquipmentDungeon());
</script>

<template>
  <div class="dungeon scroll-y">
    <section class="banner">
      <div class="banner-copy">
        <span class="eyebrow">镜界装备回廊 · 已开放</span>
        <strong>缺哪个部位，就去对应的门户</strong>
        <span>8 张主题地图、32 档挑战、80 件蓝紫橙红装备；失败不扣次数。</span>
        <span class="collection-progress">
          <Gem :size="12" aria-hidden="true" />
          已首通 {{ clearedCount }} / 32
        </span>
      </div>
      <SystemArtwork kind="dungeon" class="banner-art" />
      <span class="banner-glow" aria-hidden="true"></span>
    </section>

    <section class="daily-card card">
      <div class="daily-title">
        <span class="daily-icon"><CalendarDays :size="17" aria-hidden="true" /></span>
        <span>
          <strong>今日奖励次数</strong>
          <small>八个门户账号共享 · 北京时间 04:00 重置</small>
        </span>
      </div>
      <div class="attempts" :aria-label="`今日剩余 ${game.equipmentDungeonRemaining} 次`">
        <i
          v-for="index in EQUIPMENT_DUNGEON_RULES.dailyClears"
          :key="index"
          :class="{ used: index > game.equipmentDungeonRemaining }"
        >
          ✦
        </i>
        <b>{{ game.equipmentDungeonRemaining }} / {{ EQUIPMENT_DUNGEON_RULES.dailyClears }}</b>
      </div>
    </section>

    <section class="section-block">
      <header class="section-heading">
        <span>
          <small>STEP 1</small>
          <strong>选择定向部位</strong>
        </span>
        <em>8 座独立主题门户</em>
      </header>
      <div class="portal-grid">
        <button
          v-for="candidate in EQUIPMENT_DUNGEON_PORTALS"
          :key="candidate.id"
          class="portal-button"
          :class="{ active: candidate.slot === selectedSlot }"
          :style="{ '--portal-accent': candidate.accent }"
          type="button"
          :aria-pressed="candidate.slot === selectedSlot"
          @click="selectSlot(candidate.slot)"
        >
          <span class="portal-symbol">{{ SLOT_LABELS[candidate.slot].slice(0, 1) }}</span>
          <span>
            <strong>{{ SLOT_LABELS[candidate.slot] }}</strong>
            <small>{{ candidate.shortName }}</small>
          </span>
          <Check
            v-if="dungeonState?.records[`equipment_${candidate.slot}_crimson`]"
            :size="13"
            class="portal-check"
            aria-label="红色档已首通"
          />
        </button>
      </div>
    </section>

    <section class="section-block">
      <header class="section-heading">
        <span>
          <small>STEP 2</small>
          <strong>选择品质难度</strong>
        </span>
        <em>同部位逐档首通解锁</em>
      </header>
      <div class="tier-tabs" role="tablist" aria-label="装备副本品质难度">
        <button
          v-for="candidate in slotStages"
          :key="candidate.id"
          class="tier-tab"
          :class="[
            `quality-${candidate.quality}`,
            {
              active: candidate.tierId === selectedTierId,
              cleared: dungeonState?.records[candidate.id],
              locked:
                !dungeonState ||
                !isEquipmentDungeonStageUnlocked(candidate, dungeonState, playerLevel),
            },
          ]"
          type="button"
          role="tab"
          :aria-selected="candidate.tierId === selectedTierId"
          @click="selectTier(candidate.tierId)"
        >
          <span class="tier-gem">
            <LockKeyhole
              v-if="
                !dungeonState ||
                !isEquipmentDungeonStageUnlocked(candidate, dungeonState, playerLevel)
              "
              :size="12"
              aria-hidden="true"
            />
            <Gem v-else :size="13" aria-hidden="true" />
          </span>
          <strong>{{ QUALITY_LABELS[candidate.quality] }}</strong>
          <small>Lv{{ candidate.unlockLevel }}</small>
          <Check v-if="dungeonState?.records[candidate.id]" :size="11" aria-label="已首通" />
        </button>
      </div>
    </section>

    <section
      class="stage-card"
      :class="[`quality-${stage.quality}`, { locked: !unlocked }]"
      :style="{
        '--accent': portal.accent,
        '--tier-color': currentTier.color,
        '--stage-map': `url('${assetUrl(stage.mapAsset)}')`,
        '--map-position': stage.objectPosition,
      }"
    >
      <div class="stage-map">
        <header>
          <span class="stage-kicker">
            <Map :size="12" aria-hidden="true" />
            {{ portal.name }}
          </span>
          <span v-if="currentRecord" class="clear-mark">
            <ShieldCheck :size="12" aria-hidden="true" />
            已通关 {{ currentRecord.clears }} 次
          </span>
        </header>

        <div class="keeper-copy">
          <small>{{ stage.subtitle }}</small>
          <strong>{{ portal.keeperName }}</strong>
          <span>{{ portal.lore }}</span>
        </div>

        <img
          class="keeper-art"
          :src="assetUrl(stage.encounters[1].asset)"
          :alt="`${portal.keeperName}守关怪物立绘`"
          draggable="false"
        />
        <span class="keeper-ring" aria-hidden="true"></span>
        <div class="stage-particles" aria-hidden="true">
          <i v-for="index in 9" :key="index" :style="{ '--particle-index': index }">✦</i>
        </div>
      </div>

      <div class="stage-details">
        <div class="power-row">
          <span>
            <small>我的战力</small>
            <strong>{{ abbr(game.cp) }}</strong>
          </span>
          <div class="power-track" :class="{ risky: cpRatio < 0.75 }">
            <i :style="{ width: `${cpPercent}%` }"></i>
          </div>
          <span>
            <small>推荐战力</small>
            <strong>{{ abbr(stage.recommendCP) }}</strong>
          </span>
        </div>

        <div class="rules-row">
          <span><Swords :size="12" />两波自动实战</span>
          <span><ShieldCheck :size="12" />失败不扣次数</span>
          <span><Sparkles :size="12" />双款 3 次内补偿</span>
        </div>

        <div class="set-block">
          <header>
            <span>
              <small>套装共鸣</small>
              <strong>{{ currentSet.name }}</strong>
            </span>
            <em>已穿戴 {{ currentSetProgress }} / 8</em>
          </header>
          <div class="set-bonuses">
            <span
              v-for="bonus in currentSet.bonuses"
              :key="bonus.pieces"
              :class="{ active: currentSetProgress >= bonus.pieces }"
            >
              <b>{{ bonus.pieces }} 件 · {{ bonus.label }}</b>
              <small>{{ bonus.description }}</small>
            </span>
          </div>
        </div>

        <div class="drop-block">
          <header>
            <span>
              <small>当前 {{ CLASS_INFO[classId].name }} 可掉落</small>
              <strong>{{ drops.length }} 件定向候选</strong>
            </span>
            <em>{{ currentTier.shortName }}</em>
          </header>
          <div class="drop-list">
            <article v-for="definition in drops" :key="definition.id">
              <EquipmentIcon :def="definition" size="lg" decorative />
              <span>
                <strong>{{ definition.name }}</strong>
                <small>{{ definition.uniqueEffect }}</small>
              </span>
            </article>
          </div>
        </div>

        <div class="challenge-bar">
          <span class="challenge-note" :class="{ warning: !unlocked || cpRatio < 0.75 }">
            <LockKeyhole v-if="!unlocked" :size="12" aria-hidden="true" />
            <Sparkles v-else :size="12" aria-hidden="true" />
            {{ lockCopy }}
          </span>
          <button
            ref="challengeButton"
            class="challenge-button"
            type="button"
            :disabled="challengeDisabled"
            @click="challenge"
          >
            <Swords :size="16" aria-hidden="true" />
            {{ currentRecord ? '再次挑战' : '首通挑战' }}
          </button>
        </div>
        <p v-if="notice" class="notice" role="status">{{ notice }}</p>
      </div>
    </section>

    <section class="future-block">
      <header class="section-heading">
        <span>
          <small>NEXT</small>
          <strong>其他副本计划</strong>
        </span>
        <em>装备副本不再是占位</em>
      </header>
      <div
        v-for="(item, index) in planned"
        :key="item.name"
        class="future-row card"
        :style="{ '--row-delay': `${40 + index * 45}ms` }"
      >
        <span class="future-icon">
          <component :is="item.icon" :size="17" :stroke-width="2" aria-hidden="true" />
        </span>
        <span class="future-copy">
          <strong>{{ item.name }}</strong>
          <small>{{ item.desc }}</small>
        </span>
        <em>{{ item.when }}</em>
      </div>
    </section>

    <EquipmentDungeonBattle
      v-if="battleResult && game.save"
      :result="battleResult"
      :class-id="game.save.player.classId"
      :level="game.save.player.level"
      :equipped="equipped"
      :player-max-hp="game.finalStats.hp"
      :reduce-motion="reduceMotion"
      @close="closeBattle"
    />
  </div>
</template>

<style scoped>
.dungeon {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-bottom: max(8px, env(safe-area-inset-bottom));
}

.banner {
  position: relative;
  min-height: 126px;
  padding: 16px 130px 16px 16px;
  overflow: hidden;
  background:
    radial-gradient(circle at 75% 10%, rgb(255 255 255 / 80%), transparent 34%),
    linear-gradient(118deg, #e7f5ff, #fff0f7 63%, #f0eaff);
  border: 1px solid rgb(255 255 255 / 86%);
  border-radius: var(--r);
  box-shadow: 0 9px 25px rgb(95 110 153 / 10%);
}

.banner-copy {
  position: relative;
  z-index: 3;
  display: grid;
  gap: 4px;
  color: var(--text-mid);
  font-size: 10px;
  line-height: 1.55;
}

.banner-copy > strong {
  max-width: 205px;
  font-size: 15px;
  color: var(--text);
}

.eyebrow {
  width: fit-content;
  padding: 2px 7px;
  font-size: 8px;
  font-weight: 800;
  color: #805fbd;
  background: rgb(255 255 255 / 75%);
  border-radius: 999px;
}

.collection-progress {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  gap: 3px;
  padding: 3px 8px;
  margin-top: 2px;
  font-weight: 800;
  color: #fff;
  background: linear-gradient(90deg, #78b4ef, #a985e4);
  border-radius: 999px;
}

.banner-art {
  position: absolute;
  z-index: 2;
  right: -1px;
  bottom: -9px;
  width: 136px;
  height: 136px;
  animation: portal-float 3.5s ease-in-out infinite;
}

.banner-glow {
  position: absolute;
  right: 26px;
  bottom: 4px;
  width: 92px;
  height: 18px;
  background: rgb(135 166 241 / 22%);
  border-radius: 50%;
  filter: blur(6px);
  animation: portal-glow 2.3s ease-in-out infinite;
}

.card {
  background: rgb(255 255 255 / 92%);
  border: 1px solid rgb(228 232 245 / 92%);
  border-radius: var(--r);
}

.daily-card {
  display: flex;
  min-height: 62px;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
}

.daily-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.daily-title > span:last-child {
  display: grid;
  gap: 2px;
}

.daily-title strong {
  font-size: 12px;
}

.daily-title small {
  font-size: 8px;
  color: var(--text-dim);
}

.daily-icon {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  color: #fff;
  background: linear-gradient(145deg, #ff8cac, #8f91e8);
  border-radius: 12px;
}

.attempts {
  display: flex;
  align-items: center;
  gap: 3px;
}

.attempts i {
  display: grid;
  width: 22px;
  height: 22px;
  place-items: center;
  color: #fff;
  font-size: 10px;
  font-style: normal;
  background: linear-gradient(145deg, #ff8db0, #a783eb);
  border-radius: 8px;
  box-shadow: 0 3px 8px rgb(193 104 165 / 20%);
  transition:
    opacity var(--t-fast),
    transform var(--t-fast);
}

.attempts i.used {
  color: #aab0c0;
  background: #edf0f5;
  box-shadow: none;
  opacity: 0.65;
  transform: scale(0.88);
}

.attempts b {
  margin-left: 3px;
  font-size: 10px;
  color: var(--text-mid);
}

.section-block,
.future-block {
  display: grid;
  gap: 7px;
}

.section-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 8px;
  padding: 0 3px;
}

.section-heading > span {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.section-heading small {
  font-size: 7px;
  font-weight: 900;
  letter-spacing: 0.08em;
  color: var(--pink-deep);
}

.section-heading strong {
  font-size: 12px;
}

.section-heading em {
  font-size: 8px;
  font-style: normal;
  color: var(--text-dim);
}

.portal-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
}

.portal-button {
  --portal-accent: #8ab6ee;
  position: relative;
  display: grid;
  min-width: 0;
  min-height: 70px;
  place-items: center;
  gap: 3px;
  padding: 7px 3px;
  color: var(--text-mid);
  background: linear-gradient(150deg, #fff, color-mix(in srgb, var(--portal-accent) 8%, white));
  border: 1px solid color-mix(in srgb, var(--portal-accent) 22%, #e4e8f2);
  border-radius: 14px;
  transition:
    transform var(--t-fast) var(--ease-spring),
    box-shadow var(--t-fast),
    border-color var(--t-fast);
}

.portal-button:active {
  transform: scale(0.96);
}

.portal-button.active {
  color: color-mix(in srgb, var(--portal-accent) 72%, #4d4564);
  border-color: color-mix(in srgb, var(--portal-accent) 70%, white);
  box-shadow:
    0 6px 14px color-mix(in srgb, var(--portal-accent) 18%, transparent),
    inset 0 0 0 1px rgb(255 255 255 / 80%);
}

.portal-button > span:nth-child(2) {
  display: grid;
  min-width: 0;
  gap: 1px;
  text-align: center;
}

.portal-button strong {
  font-size: 10px;
}

.portal-button small {
  overflow: hidden;
  font-size: 7px;
  color: var(--text-dim);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.portal-symbol {
  display: grid;
  width: 29px;
  height: 29px;
  place-items: center;
  font-size: 11px;
  font-weight: 900;
  color: #fff;
  background: linear-gradient(
    145deg,
    color-mix(in srgb, var(--portal-accent) 75%, white),
    var(--portal-accent)
  );
  border-radius: 10px;
}

.portal-check {
  position: absolute;
  top: 5px;
  right: 5px;
  color: #58b895;
}

.tier-tabs {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
}

.tier-tab {
  --quality: var(--q-rare);
  position: relative;
  display: grid;
  min-height: 57px;
  place-items: center;
  gap: 1px;
  padding: 5px 2px;
  color: var(--text-mid);
  background: #fff;
  border: 1px solid color-mix(in srgb, var(--quality) 18%, #e4e7f0);
  border-radius: 13px;
}

.tier-tab.quality-epic {
  --quality: var(--q-epic);
}

.tier-tab.quality-legendary {
  --quality: var(--q-legendary);
}

.tier-tab.quality-mythic {
  --quality: var(--q-mythic);
}

.tier-tab.active {
  color: var(--quality);
  border-color: color-mix(in srgb, var(--quality) 70%, white);
  box-shadow: 0 5px 13px color-mix(in srgb, var(--quality) 17%, transparent);
}

.tier-tab.locked {
  filter: grayscale(0.45);
  opacity: 0.66;
}

.tier-tab > strong {
  font-size: 10px;
}

.tier-tab > small {
  font-size: 7px;
  color: var(--text-dim);
}

.tier-tab > svg:last-child {
  position: absolute;
  top: 4px;
  right: 4px;
  color: #62bd99;
}

.tier-gem {
  display: grid;
  width: 22px;
  height: 22px;
  place-items: center;
  color: #fff;
  background: linear-gradient(145deg, color-mix(in srgb, var(--quality) 65%, white), var(--quality));
  border-radius: 8px;
}

.stage-card {
  --accent: #ff8eb3;
  --tier-color: #599cf1;
  flex-shrink: 0;
  overflow: hidden;
  background: #fff;
  border: 1px solid color-mix(in srgb, var(--tier-color) 25%, #e6e8f1);
  border-radius: 20px;
  box-shadow: 0 12px 28px color-mix(in srgb, var(--tier-color) 10%, transparent);
}

.stage-map {
  position: relative;
  min-height: 264px;
  overflow: hidden;
  color: #fff;
  background:
    linear-gradient(100deg, rgb(26 32 59 / 68%), transparent 61%),
    linear-gradient(180deg, transparent 45%, rgb(28 29 55 / 45%)),
    var(--stage-map) var(--map-position) / cover no-repeat;
  isolation: isolate;
}

.stage-map::before {
  position: absolute;
  z-index: -1;
  inset: 0;
  content: '';
  background: radial-gradient(circle at 80% 50%, color-mix(in srgb, var(--tier-color) 35%, transparent), transparent 31%);
}

.stage-map > header {
  position: relative;
  z-index: 4;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 11px 12px;
}

.stage-kicker,
.clear-mark {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 4px 7px;
  font-size: 8px;
  font-weight: 800;
  background: rgb(34 31 60 / 42%);
  border: 1px solid rgb(255 255 255 / 34%);
  border-radius: 999px;
  backdrop-filter: blur(5px);
}

.clear-mark {
  color: #d6ffec;
}

.keeper-copy {
  position: absolute;
  z-index: 4;
  bottom: 18px;
  left: 13px;
  display: grid;
  width: 47%;
  gap: 4px;
  text-shadow: 0 2px 8px rgb(26 24 52 / 55%);
}

.keeper-copy small {
  font-size: 8px;
  color: #fff0b9;
}

.keeper-copy strong {
  font-size: 15px;
}

.keeper-copy span {
  font-size: 9px;
  line-height: 1.55;
  opacity: 0.88;
}

.keeper-art {
  position: absolute;
  z-index: 3;
  right: 1%;
  bottom: -4%;
  width: 58%;
  height: 90%;
  object-fit: contain;
  object-position: 50% 100%;
  filter: drop-shadow(0 10px 11px rgb(27 27 53 / 28%));
}

.keeper-ring {
  position: absolute;
  z-index: 2;
  right: 8%;
  bottom: 7px;
  width: 43%;
  height: 28px;
  background: radial-gradient(ellipse, color-mix(in srgb, var(--tier-color) 72%, white), transparent 67%);
  border: 1px solid color-mix(in srgb, var(--tier-color) 65%, white);
  border-radius: 50%;
  opacity: 0.72;
}

.stage-particles i {
  --angle: calc(var(--particle-index) * 40deg);
  position: absolute;
  z-index: 2;
  right: calc(8% + (var(--particle-index) % 3) * 12%);
  bottom: calc(16% + (var(--particle-index) % 4) * 15%);
  color: color-mix(in srgb, var(--tier-color) 55%, white);
  font-size: calc(7px + (var(--particle-index) % 3) * 2px);
  font-style: normal;
  animation: stage-spark calc(2.4s + (var(--particle-index) % 3) * 0.4s) ease-in-out infinite;
  animation-delay: calc(var(--particle-index) * -170ms);
}

.stage-card.locked .stage-map {
  filter: saturate(0.48);
}

.stage-details {
  display: grid;
  gap: 10px;
  padding: 12px;
}

.power-row {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 9px;
}

.power-row > span {
  display: grid;
  gap: 1px;
}

.power-row > span:last-child {
  text-align: right;
}

.power-row small {
  font-size: 7px;
  color: var(--text-dim);
}

.power-row strong {
  font-size: 11px;
}

.power-track {
  height: 7px;
  overflow: hidden;
  background: #edf0f5;
  border-radius: 999px;
}

.power-track i {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #70cde9, #a886e8);
  border-radius: inherit;
  transition: width var(--t-mid) var(--ease-soft);
}

.power-track.risky i {
  background: linear-gradient(90deg, #f2b65e, #ee849e);
}

.rules-row {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.rules-row span {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 4px 7px;
  font-size: 8px;
  color: var(--text-mid);
  background: #f4f5fb;
  border-radius: 999px;
}

.set-block {
  display: grid;
  gap: 7px;
  padding: 9px;
  background:
    radial-gradient(circle at 92% 0%, color-mix(in srgb, var(--tier-color) 18%, transparent), transparent 45%),
    linear-gradient(145deg, rgb(255 255 255 / 92%), rgb(250 247 255 / 88%));
  border: 1px solid color-mix(in srgb, var(--tier-color) 22%, #e6e5f0);
  border-radius: 14px;
}

.set-block > header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 8px;
}

.set-block > header > span {
  display: grid;
  gap: 1px;
}

.set-block header small {
  font-size: 8px;
  color: var(--text-dim);
}

.set-block header strong {
  font-size: 11px;
  color: color-mix(in srgb, var(--tier-color) 74%, #574760);
}

.set-block header em {
  padding: 3px 7px;
  font-size: 8px;
  font-style: normal;
  font-weight: 800;
  color: color-mix(in srgb, var(--tier-color) 76%, #544b63);
  background: color-mix(in srgb, var(--tier-color) 10%, white);
  border-radius: 999px;
}

.set-bonuses {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 5px;
}

.set-bonuses > span {
  display: grid;
  gap: 1px;
  min-width: 0;
  padding: 6px 7px;
  color: #9b9aaa;
  background: rgb(242 242 247 / 74%);
  border: 1px dashed #d7d7e2;
  border-radius: 10px;
}

.set-bonuses > span.active {
  color: color-mix(in srgb, var(--tier-color) 76%, #4d4658);
  background: color-mix(in srgb, var(--tier-color) 10%, white);
  border: 1px solid color-mix(in srgb, var(--tier-color) 30%, white);
  box-shadow: inset 0 0 10px color-mix(in srgb, var(--tier-color) 8%, transparent);
}

.set-bonuses b {
  overflow: hidden;
  font-size: 8px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.set-bonuses small {
  overflow: hidden;
  font-size: 7px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.drop-block {
  display: grid;
  gap: 8px;
  padding: 10px;
  background: linear-gradient(145deg, #fafbff, color-mix(in srgb, var(--tier-color) 5%, white));
  border: 1px solid color-mix(in srgb, var(--tier-color) 12%, #ebedf4);
  border-radius: 15px;
}

.drop-block > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.drop-block > header > span {
  display: grid;
  gap: 1px;
}

.drop-block header small {
  font-size: 7px;
  color: var(--text-dim);
}

.drop-block header strong {
  font-size: 10px;
}

.drop-block header em {
  padding: 3px 6px;
  font-size: 7px;
  font-style: normal;
  font-weight: 800;
  color: var(--tier-color);
  background: color-mix(in srgb, var(--tier-color) 9%, white);
  border-radius: 999px;
}

.drop-list {
  display: grid;
  gap: 7px;
}

.drop-list article {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
}

.drop-list article > span {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.drop-list article strong {
  overflow: hidden;
  font-size: 10px;
  color: var(--tier-color);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.drop-list article small {
  display: -webkit-box;
  overflow: hidden;
  font-size: 8px;
  color: var(--text-dim);
  line-height: 1.45;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.challenge-bar {
  display: grid;
  gap: 7px;
}

.challenge-note {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 8px;
  color: #5e9b83;
}

.challenge-note.warning {
  color: #b77b48;
}

.challenge-button {
  display: flex;
  min-height: 46px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 900;
  color: #fff;
  background: linear-gradient(
    100deg,
    color-mix(in srgb, var(--tier-color) 78%, #ff7fa7),
    color-mix(in srgb, var(--tier-color) 75%, #8876dc)
  );
  border: 1px solid rgb(255 255 255 / 65%);
  border-radius: 14px;
  box-shadow: 0 8px 17px color-mix(in srgb, var(--tier-color) 25%, transparent);
  transition:
    transform var(--t-fast) var(--ease-spring),
    filter var(--t-fast);
}

.challenge-button:active:not(:disabled) {
  transform: scale(0.97);
}

.challenge-button:disabled {
  cursor: not-allowed;
  filter: grayscale(0.7);
  opacity: 0.55;
  box-shadow: none;
}

.notice {
  padding: 7px 9px;
  margin: 0;
  font-size: 8px;
  color: #72566e;
  background: #fff2f7;
  border-radius: 9px;
}

.future-block {
  margin-top: 2px;
}

.future-row {
  display: flex;
  min-height: 52px;
  align-items: center;
  gap: 9px;
  padding: 8px 10px;
  animation: row-in 360ms var(--ease-soft) both;
  animation-delay: var(--row-delay);
}

.future-icon {
  display: grid;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  place-items: center;
  color: var(--blue-deep);
  background: linear-gradient(145deg, var(--blue-soft), var(--pink-soft));
  border-radius: 10px;
}

.future-copy {
  display: grid;
  flex: 1;
  min-width: 0;
  gap: 2px;
}

.future-copy strong {
  font-size: 10px;
}

.future-copy small {
  overflow: hidden;
  font-size: 8px;
  color: var(--text-dim);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.future-row > em {
  padding: 3px 7px;
  font-size: 7px;
  font-style: normal;
  font-weight: 800;
  color: var(--blue-deep);
  background: var(--blue-soft);
  border-radius: 999px;
}

@keyframes portal-float {
  50% {
    transform: translateY(-4px);
  }
}

@keyframes portal-glow {
  50% {
    opacity: 1;
    transform: scaleX(1.12);
  }
}

@keyframes stage-spark {
  0%,
  100% {
    opacity: 0.25;
    transform: translateY(4px) scale(0.75);
  }
  50% {
    opacity: 0.95;
    transform: translateY(-8px) scale(1.15);
  }
}

@keyframes row-in {
  from {
    opacity: 0;
    transform: translateY(5px);
  }
}

@media (width <= 340px) {
  .banner {
    padding-right: 108px;
  }

  .banner-art {
    width: 118px;
    height: 118px;
  }

  .portal-grid {
    gap: 4px;
  }

  .portal-button {
    min-height: 65px;
  }

  .keeper-copy {
    width: 52%;
  }

  .keeper-art {
    right: -5%;
    width: 61%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .banner-art,
  .banner-glow,
  .stage-particles i,
  .future-row {
    animation: none;
  }

  .portal-button,
  .attempts i,
  .power-track i,
  .challenge-button {
    transition: none;
  }
}
</style>
