<script setup lang="ts">
import { computed } from 'vue';
import { Hammer, MapPin, Swords, Trophy } from '@lucide/vue';
import type { ClassId, EquipSlot } from '@/core/types';
import { SLOT_LABELS } from '@/data/constants';
import EquipmentIcon from '@/components/EquipmentIcon.vue';
import type { SetCodexEntry, SetCodexPiece, SetProgress } from './setCodexData';

const props = defineProps<{
  entry: SetCodexEntry;
  progress: SetProgress;
  classId: ClassId;
  /** 玩家拥有的全部装备定义 ID（背包 + 穿戴），由视图统一构建一次。 */
  ownedDefIds: ReadonlySet<string>;
}>();

const emit = defineEmits<{ (e: 'jump-craft'): void }>();

function pieceOwned(piece: SetCodexPiece): boolean {
  return piece.altDefIds.some((id) => props.ownedDefIds.has(id));
}

const ownedSlots = computed(() => {
  const slots = new Set<EquipSlot>();
  for (const piece of props.entry.pieces) {
    if (pieceOwned(piece)) slots.add(piece.slot);
  }
  return slots;
});

const bonusStates = computed(() =>
  props.entry.bonuses.map((bonus) => ({
    ...bonus,
    active: props.progress.equippedPieces >= bonus.pieces,
    missing: Math.max(0, bonus.pieces - props.progress.equippedPieces),
  })),
);

const nextBonus = computed(() => bonusStates.value.find((b) => !b.active) ?? null);

const craftableCount = computed(() => {
  if (!props.entry.craft || props.progress.fragmentCount === null) return 0;
  return Math.floor(props.progress.fragmentCount / props.entry.craft.cost);
});

const craftRatio = computed(() => {
  if (!props.entry.craft || props.progress.fragmentCount === null) return 0;
  return Math.min(1, (props.progress.fragmentCount % props.entry.craft.cost) / props.entry.craft.cost);
});

const baseUrl = import.meta.env.BASE_URL;
</script>

<template>
  <section class="set-card" :class="[`g-${entry.group}`, { complete: progress.complete }]">
    <header class="set-head">
      <span class="set-title">
        <small>{{ entry.subtitle }}</small>
        <strong>
          {{ entry.name }}
          <em v-if="entry.legacy" class="tag legacy">绝版</em>
          <em v-if="entry.arenaOnly" class="tag arena"><Swords :size="9" />仅竞技场</em>
        </strong>
      </span>
      <span class="set-progress" :class="{ full: progress.complete }">
        <template v-if="progress.complete">集齐</template>
        <template v-else>{{ progress.ownedPieces }}/{{ progress.totalPieces }}</template>
      </span>
    </header>

    <div class="pieces" role="list" :aria-label="`${entry.name}部位收集`">
      <span
        v-for="piece in entry.pieces"
        :key="piece.slot"
        class="piece"
        :class="{ missing: !ownedSlots.has(piece.slot) }"
        role="listitem"
        :aria-label="SLOT_LABELS[piece.slot] + (ownedSlots.has(piece.slot) ? '，已获得' : '，未获得')"
      >
        <EquipmentIcon :def="piece.def" :class-id="classId" size="md" decorative />
        <small>{{ SLOT_LABELS[piece.slot] }}</small>
        <i v-if="!ownedSlots.has(piece.slot)" class="miss-chip">缺</i>
      </span>
    </div>

    <ul class="bonuses" :aria-label="`${entry.name}套装效果`">
      <li v-for="bonus in bonusStates" :key="bonus.pieces" :class="{ active: bonus.active }">
        <b>{{ bonus.pieces }}件</b>
        <span class="bonus-copy">
          <strong>{{ bonus.label }}</strong>
          <small>{{ bonus.description }}</small>
        </span>
        <em v-if="bonus.active" class="on">生效中</em>
        <em v-else-if="nextBonus && bonus.pieces === nextBonus.pieces" class="next">
          再穿 {{ bonus.missing }} 件
        </em>
      </li>
    </ul>

    <button
      v-if="entry.craft && progress.fragmentCount !== null"
      type="button"
      class="craft-row"
      :aria-label="`前往套装合成，${entry.craft.fragmentName}${progress.fragmentCount} 个`"
      @click="emit('jump-craft')"
    >
      <img :src="`${baseUrl}${entry.craft.fragmentIcon}`" alt="" class="frag-icon" />
      <span class="craft-copy">
        <strong>{{ entry.craft.fragmentName }} ×{{ progress.fragmentCount }}</strong>
        <span class="craft-bar" aria-hidden="true">
          <i :style="{ transform: `scaleX(${craftRatio})` }" />
        </span>
      </span>
      <span class="craft-cta">
        <Hammer :size="11" />
        {{ craftableCount > 0 ? `可合成 ${craftableCount} 件` : `${entry.craft.cost} 个合 1 件` }}
      </span>
    </button>

    <p v-if="entry.completionTitle" class="completion" :class="{ earned: progress.complete }">
      <Trophy :size="11" />
      <template v-if="progress.complete">已获得称号「{{ entry.completionTitle }}」与专属徽记</template>
      <template v-else>集齐 8 件获得称号「{{ entry.completionTitle }}」与专属徽记</template>
    </p>

    <p class="source">
      <MapPin :size="10" aria-hidden="true" />
      <span>
        <template v-for="(line, i) in entry.sourceLines" :key="i"
          >{{ line }}<br v-if="i < entry.sourceLines.length - 1"
        /></template>
      </span>
    </p>
  </section>
</template>

<style scoped>
.set-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  background: var(--panel);
  border: 1px solid var(--hairline);
  border-radius: var(--r);
  box-shadow: 0 6px 16px rgb(67 50 76 / 8%);
}

.set-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.set-title {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.set-title small {
  font-size: 9px;
  color: var(--text-dim);
}

.set-title strong {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 15px;
}

.tag {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px 7px;
  font-size: 8px;
  font-style: normal;
  font-weight: 700;
  border-radius: 999px;
}

.tag.legacy {
  color: #8a6d3b;
  background: #f7ecd4;
  border: 1px solid #eed9ac;
}

.tag.arena {
  color: #6d5bd0;
  background: #ece9fb;
  border: 1px solid #d4c9f2;
}

.set-progress {
  flex-shrink: 0;
  min-width: 44px;
  padding: 5px 10px;
  font-size: 11px;
  font-weight: 800;
  color: var(--text-mid);
  text-align: center;
  background: var(--panel-3);
  border-radius: 999px;
}

.set-progress.full {
  color: #fff;
  background: linear-gradient(120deg, #ff8fb4, #b48ae0);
  box-shadow: 0 4px 10px rgb(255 143 180 / 35%);
}

.pieces {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 6px;
}

.piece {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  min-width: 0;
}

.piece small {
  font-size: 8px;
  color: var(--text-dim);
}

.piece.missing :deep(.equipment-icon) {
  filter: grayscale(0.9);
  opacity: 0.45;
}

.miss-chip {
  position: absolute;
  top: -3px;
  right: -1px;
  padding: 1px 4px;
  font-size: 7px;
  font-style: normal;
  font-weight: 800;
  color: #9aa3b2;
  background: #eef1f6;
  border: 1px solid #dde2ec;
  border-radius: 6px;
}

.bonuses {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.bonuses li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 9px;
  background: var(--panel-2);
  border: 1px solid transparent;
  border-radius: var(--r-sm);
}

.bonuses li.active {
  background: linear-gradient(120deg, rgb(255 236 244 / 90%), rgb(240 235 255 / 90%));
  border-color: #ffd3e3;
}

.bonuses b {
  flex-shrink: 0;
  min-width: 30px;
  font-size: 10px;
  color: var(--text-dim);
}

.bonuses li.active b {
  color: #d24f7e;
}

.bonus-copy {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  flex: 1;
}

.bonus-copy strong {
  font-size: 11px;
}

.bonus-copy small {
  font-size: 9px;
  line-height: 1.4;
  color: var(--text-mid);
}

.bonuses em {
  flex-shrink: 0;
  font-size: 8px;
  font-style: normal;
  font-weight: 700;
}

.bonuses .on {
  color: #d24f7e;
}

.bonuses .next {
  color: #7c6fd0;
}

.craft-row {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 44px;
  padding: 7px 9px;
  text-align: left;
  background: var(--pink-soft);
  border: 1px solid #ffd9e7;
  border-radius: var(--r-sm);
  transition: transform var(--t-fast) var(--ease-spring);
}

.craft-row:active {
  transform: scale(0.985);
}

.frag-icon {
  width: 34px;
  height: 34px;
  object-fit: contain;
}

.craft-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.craft-copy strong {
  font-size: 11px;
}

.craft-bar {
  height: 5px;
  overflow: hidden;
  background: rgb(255 255 255 / 80%);
  border-radius: 999px;
}

.craft-bar i {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #ff9bbe, #b48ae0);
  border-radius: 999px;
  transform-origin: left;
  transition: transform var(--t-mid) var(--ease-soft);
}

.craft-cta {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 5px 9px;
  font-size: 9px;
  font-weight: 800;
  color: #c04a77;
  background: #fff;
  border-radius: 999px;
  box-shadow: 0 3px 8px rgb(192 74 119 / 18%);
  white-space: nowrap;
}

.completion {
  display: flex;
  align-items: center;
  gap: 5px;
  margin: 0;
  padding: 7px 9px;
  font-size: 10px;
  color: var(--text-mid);
  background: var(--panel-2);
  border-radius: var(--r-sm);
}

.completion.earned {
  color: #8a5a12;
  background: linear-gradient(120deg, #fdf3d7, #fce8ee);
  border: 1px solid #f2d98f;
}

.source {
  display: flex;
  align-items: flex-start;
  gap: 5px;
  margin: 0;
  font-size: 9px;
  line-height: 1.55;
  color: var(--text-dim);
}

.source svg {
  flex-shrink: 0;
  margin-top: 2px;
}
</style>
