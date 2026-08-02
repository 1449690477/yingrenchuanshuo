<script setup lang="ts">
/**
 * 主动技能编成（M3-5b 的「配四栏」）。
 *
 * ## 三个状态必须在界面上分得开
 *
 * 存档层把「没编排过」与「明确清空」存成了两件事（`player.activeSkillIds`
 * 不存在 vs `[]`）。**界面不能把它们又合并回去**：玩家把四栏清空后若显示成
 * 「未编排」，他下次打开会以为自己没改过，然后困惑于为什么上场不放技能。
 *
 * · **未编排** ⇒ 跟随职业默认顺序，且**会随升级自动带上新解锁的技能**；
 * · **已清空** ⇒ 玩家明确要求不带主动技，只有普攻与被动；
 * · **自定义** ⇒ 玩家自己排的，**不再自动跟随默认表**。
 *
 * ## 第一次改动会「固化」当前编成
 *
 * 未编排状态下点任意技能，会把当前默认编成materialize成自定义。这是刻意的：
 * 玩家开始自己排了，就该由他说了算。**代价是不再自动跟随默认顺序**，所以
 * 「恢复默认」必须一直可用 —— 它把状态还原成「没编排过」（emit `undefined`），
 * 而不是把默认技能再排一遍。两者对**日后**的行为完全不同。
 *
 * 合法性判定不在这里：一律走 `core/skillSlots.ts`，与服务端同一个判定点。
 */
import { computed } from 'vue';
import type { ClassId } from '@/core/types';
import {
  ACTIVE_SKILL_SLOTS,
  resolveActiveSkillSlots,
  selectableActiveSkillIds,
} from '@/core/skillSlots';
import { skillsFor } from '@/data/skills';
import SkillIcon from '@/components/SkillIcon.vue';

const props = defineProps<{
  classId: ClassId;
  level: number;
  /** 玩家已保存的编排；`undefined` = 从没编排过，`[]` = 明确清空。 */
  modelValue?: readonly string[];
}>();

const emit = defineEmits<{
  (event: 'update:modelValue', value: string[] | undefined): void;
}>();

const skillById = computed(
  () => new Map(skillsFor(props.classId).map((skill) => [skill.id, skill])),
);

/** 当前实际上场的编成（未编排时即职业默认顺序）。 */
const resolved = computed(() =>
  resolveActiveSkillSlots(props.classId, props.level, props.modelValue),
);

/** 该等级下所有可选的主动技。 */
const selectable = computed(() => selectableActiveSkillIds(props.classId, props.level));

const isCustom = computed(() => props.modelValue !== undefined);
const isCleared = computed(() => props.modelValue !== undefined && props.modelValue.length === 0);

const stateLabel = computed(() => {
  if (isCleared.value) return '已清空 · 本次不带主动技';
  if (isCustom.value) return '自定义编成';
  return '未编排 · 跟随默认';
});

const stateHint = computed(() => {
  if (isCleared.value) return '你明确清空了技能栏，上场只有普攻与被动。';
  if (isCustom.value) return '由你自己编排，升级解锁的新技能不会自动进栏。';
  return '跟随职业默认顺序，升级解锁新技能会自动补进来。';
});

/** 编辑的起点：已编排就用玩家的，没编排过则先固化当前默认编成。 */
function currentDraft(): string[] {
  return props.modelValue !== undefined ? [...props.modelValue] : [...resolved.value.selected];
}

function isEquipped(skillId: string): boolean {
  return resolved.value.selected.includes(skillId);
}

function toggle(skillId: string): void {
  const draft = currentDraft();
  const at = draft.indexOf(skillId);
  if (at >= 0) {
    draft.splice(at, 1);
  } else {
    if (draft.length >= ACTIVE_SKILL_SLOTS) return;
    draft.push(skillId);
  }
  emit('update:modelValue', draft);
}

function removeSlot(index: number): void {
  const draft = currentDraft();
  draft.splice(index, 1);
  emit('update:modelValue', draft);
}

/** 还原成「从没编排过」——不是把默认技能再排一遍，两者日后行为不同。 */
function restoreDefault(): void {
  emit('update:modelValue', undefined);
}

function clearAll(): void {
  emit('update:modelValue', []);
}

const slots = computed(() =>
  Array.from({ length: ACTIVE_SKILL_SLOTS }, (_, index) => {
    const skillId = resolved.value.selected[index];
    return { index, skillId, skill: skillId ? skillById.value.get(skillId) : undefined };
  }),
);
</script>

<template>
  <div class="loadout">
    <p class="state" :class="{ cleared: isCleared, custom: isCustom && !isCleared }">
      <span class="state-label">{{ stateLabel }}</span>
      <span class="state-hint">{{ stateHint }}</span>
    </p>

    <ol class="slots">
      <li v-for="slot in slots" :key="slot.index" class="slot" :class="{ empty: !slot.skillId }">
        <template v-if="slot.skill">
          <SkillIcon :skill="slot.skill" />
          <span class="slot-name">{{ slot.skill.name }}</span>
          <button
            type="button"
            class="slot-remove"
            :aria-label="`移出 ${slot.skill.name}`"
            @click="removeSlot(slot.index)"
          >
            ×
          </button>
        </template>
        <template v-else-if="slot.skillId">
          <span class="slot-name unknown">{{ slot.skillId }}</span>
          <button
            type="button"
            class="slot-remove"
            :aria-label="`移出 ${slot.skillId}`"
            @click="removeSlot(slot.index)"
          >
            ×
          </button>
        </template>
        <span v-else class="slot-name placeholder">空栏位</span>
      </li>
    </ol>

    <div class="actions">
      <button type="button" class="act" :disabled="!isCustom" @click="restoreDefault">
        恢复默认
      </button>
      <button type="button" class="act" :disabled="isCleared" @click="clearAll">全部清空</button>
    </div>

    <p v-if="selectable.length === 0" class="none">这个等级还没有可用的主动技能。</p>
    <ul v-else class="picker">
      <li v-for="skillId in selectable" :key="skillId">
        <button
          type="button"
          class="pick"
          :class="{ on: isEquipped(skillId) }"
          :aria-pressed="isEquipped(skillId)"
          :disabled="!isEquipped(skillId) && resolved.selected.length >= ACTIVE_SKILL_SLOTS"
          @click="toggle(skillId)"
        >
          <SkillIcon v-if="skillById.get(skillId)" :skill="skillById.get(skillId)!" />
          <span class="pick-copy">
            <span class="pick-name">{{ skillById.get(skillId)?.name ?? skillId }}</span>
            <span class="pick-desc">{{ skillById.get(skillId)?.desc ?? '' }}</span>
          </span>
          <span class="pick-mark">{{ isEquipped(skillId) ? '已上阵' : '上阵' }}</span>
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
/* 移动端优先：一切纵向排布，绝不让页面本身出现横向滚动。 */
.loadout {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.state {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 8px 10px;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.04);
}
.state.custom {
  background: rgba(255, 179, 209, 0.18);
}
.state.cleared {
  background: rgba(255, 138, 138, 0.18);
}
.state-label {
  font-weight: 600;
  font-size: 13px;
}
.state-hint {
  font-size: 11px;
  opacity: 0.75;
  line-height: 1.4;
}

.slots {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.slot {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  padding: 6px 8px;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.04);
}
.slot.empty {
  border: 1px dashed rgba(0, 0, 0, 0.18);
  background: transparent;
}
.slot-name {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.slot-name.placeholder {
  opacity: 0.5;
}
.slot-name.unknown {
  opacity: 0.7;
  font-style: italic;
}
.slot-remove {
  flex: none;
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.1);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
}

.actions {
  display: flex;
  gap: 8px;
}
.act {
  flex: 1;
  min-width: 0;
  min-height: 44px;
  padding: 7px 8px;
  border: 0;
  border-radius: 9px;
  background: rgba(0, 0, 0, 0.06);
  font-size: 12px;
  cursor: pointer;
}
.act:disabled {
  opacity: 0.4;
  cursor: default;
}

.picker {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.pick {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
  padding: 6px 8px;
  border: 0;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.04);
  text-align: left;
  cursor: pointer;
}
.pick.on {
  background: rgba(255, 179, 209, 0.28);
}
.pick:disabled {
  opacity: 0.45;
  cursor: default;
}
.pick-copy {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  gap: 1px;
}
.pick-name {
  font-size: 12px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pick-desc {
  font-size: 11px;
  opacity: 0.7;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pick-mark {
  flex: none;
  font-size: 11px;
  opacity: 0.8;
}

.none {
  margin: 0;
  font-size: 12px;
  opacity: 0.7;
}
</style>
