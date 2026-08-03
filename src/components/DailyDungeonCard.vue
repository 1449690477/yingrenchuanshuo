<script setup lang="ts">
import { computed } from 'vue';
import { CalendarDays, Check, LockKeyhole, Swords, Zap } from '@lucide/vue';
import { abbr } from '@/core/format';
import {
  alignDailyDungeonDay,
  canChallengeDailyDungeon,
  dailyDungeonReward,
  type DailyDungeonGateInput,
  type DailyDungeonState,
} from '@/core/dailyDungeons';
import {
  DAILY_DUNGEON_RUNS_PER_TIER,
  DAILY_DUNGEON_TIERS,
  type DailyDungeonTheme,
  type DailyDungeonTierId,
} from '@/data/dailyDungeons';
import { requireItem } from '@/data/items';
import ItemIcon from '@/components/ItemIcon.vue';

const props = defineProps<{
  /** 当日轮换主题（core dailyDungeonOfDay 结果）。 */
  theme: DailyDungeonTheme;
  /** 日常副本存档状态。 */
  state: DailyDungeonState;
  /** 当前日切 key（'YYYY-MM-DD'，业务日切口径），展示层先对齐再判定。 */
  dayKey: string;
  /** 角色等级（门禁判定）。 */
  level: number;
  /** 挑战回调：父级接线（扣体力/发奖/记次数）。 */
  onChallenge?: (tierId: DailyDungeonTierId) => void;
}>();

const alignedState = computed(() => alignDailyDungeonDay(props.state, props.dayKey));

const gate = computed<DailyDungeonGateInput>(() => ({
  level: props.level,
  clearedTierIds: alignedState.value.clearedTierIds,
  todayRuns: alignedState.value.todayRuns,
}));

function lockCopy(
  reason: 'level-locked' | 'tier-locked' | 'runs-exhausted' | 'unknown-tier',
  unlockLevel: number,
): string {
  if (reason === 'level-locked') return `角色达到 Lv${unlockLevel} 后开放`;
  if (reason === 'tier-locked') return '先通过前一档';
  if (reason === 'runs-exhausted') return '今日已挑战';
  return '';
}

const tierRows = computed(() =>
  DAILY_DUNGEON_TIERS.map((tier) => {
    const verdict = canChallengeDailyDungeon(gate.value, tier.id);
    const reward = dailyDungeonReward(props.theme.id, tier.id);
    const [materialId, materialCount] = Object.entries(reward.items)[0] ?? [null, 0];
    return {
      tier,
      can: verdict.ok,
      lock: verdict.ok ? null : lockCopy(verdict.reason, tier.unlockLevel),
      done: (alignedState.value.todayRuns[tier.id] ?? 0) >= DAILY_DUNGEON_RUNS_PER_TIER,
      material: materialId ? requireItem(materialId) : null,
      materialCount,
      gold: reward.gold,
    };
  }),
);
</script>

<template>
  <section class="daily-dungeon-card card" :style="{ '--dd-accent': theme.accent }">
    <div class="dd-head">
      <span class="dd-icon">
        <CalendarDays :size="17" aria-hidden="true" />
      </span>
      <span class="dd-copy">
        <strong>{{ theme.name }}</strong>
        <small>{{ theme.subtitle }}</small>
      </span>
    </div>

    <ul class="dd-tiers">
      <li
        v-for="row in tierRows"
        :key="row.tier.id"
        class="dd-tier"
        :class="{ done: row.done, locked: !row.can && !row.done }"
      >
        <span class="dd-tier-copy">
          <b>{{ row.tier.label }}</b>
          <small v-if="row.can && !row.done">
            体力 {{ row.tier.staminaCost }} · {{ row.material?.name ?? '' }} ×{{ row.materialCount }} ·
            金币 {{ abbr(row.gold) }}
          </small>
          <small v-else-if="row.done">今日已完成，明日 04:00 刷新</small>
          <small v-else>{{ row.lock }}</small>
        </span>
        <button
          type="button"
          class="dd-btn"
          :disabled="!row.can"
          :aria-label="`挑战${theme.name}·${row.tier.label}`"
          @click="onChallenge?.(row.tier.id)"
        >
          <Check v-if="row.done" :size="14" aria-hidden="true" />
          <LockKeyhole v-else-if="!row.can" :size="14" aria-hidden="true" />
          <template v-else>
            <Swords :size="14" aria-hidden="true" />
            挑战
          </template>
        </button>
      </li>
    </ul>

    <div class="dd-foot">
      <span class="dd-foot-note">
        <Zap :size="11" aria-hidden="true" />
        周一到周日轮换 · 每档每天 {{ DAILY_DUNGEON_RUNS_PER_TIER }} 次
      </span>
      <span v-if="theme.materialId" class="dd-foot-mat">
        <ItemIcon :item="requireItem(theme.materialId)" size="sm" />
        定向刷{{ requireItem(theme.materialId).name }}
      </span>
    </div>
  </section>
</template>

<style scoped>
.daily-dungeon-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border-radius: 14px;
  background: linear-gradient(
    160deg,
    color-mix(in srgb, var(--dd-accent) 9%, #fff),
    var(--surface-2, #faf5fa)
  );
  border: 1px solid color-mix(in srgb, var(--dd-accent) 22%, transparent);
}

.dd-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dd-icon {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 9px;
  color: var(--dd-accent);
  background: color-mix(in srgb, var(--dd-accent) 12%, #fff);
  flex: none;
}

.dd-copy {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.dd-copy strong {
  font-size: 14px;
  line-height: 1.3;
}

.dd-copy small {
  font-size: 11px;
  color: var(--text-dim, #8b7f93);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dd-tiers {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.dd-tier {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 46px;
  padding: 6px 8px 6px 10px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--dd-accent) 5%, #fff);
}

.dd-tier.done {
  opacity: 0.72;
}

.dd-tier-copy {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.dd-tier-copy b {
  font-size: 13px;
}

.dd-tier-copy small {
  font-size: 11px;
  color: var(--text-dim, #8b7f93);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dd-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 76px;
  min-height: 40px;
  padding: 0 12px;
  border: 0;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  background: var(--dd-accent);
  flex: none;
}

.dd-btn:disabled {
  color: var(--text-dim, #8b7f93);
  background: color-mix(in srgb, var(--dd-accent) 14%, #fff);
  cursor: not-allowed;
}

.dd-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

.dd-foot-note,
.dd-foot-mat {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--text-dim, #8b7f93);
}

.dd-foot-mat img {
  display: block;
}
</style>
