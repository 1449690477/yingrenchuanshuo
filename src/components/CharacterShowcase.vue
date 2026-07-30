<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import { abbr } from '@/core/format';
import type { ClassId, EquipmentInstance, EquipSlot } from '@/core/types';
import { CLASS_INFO, SLOT_LABELS } from '@/data/constants';
import { requireEquipment } from '@/data/equipment';
import { equipmentPresentation } from '@/data/equipmentPresentation';
import { BOUTIQUE_THEMES } from '@/data/boutique';
import {
  BASIC_ATTACK_EFFECTS,
  resolveCharacterAppearance,
  type CharacterAction,
  type EquippedRecord,
} from '@/data/characterAppearance';
import { visualSkillsFor, type VisualSkill } from '@/data/skills';
import CharacterAppearance from './CharacterAppearance.vue';
import EquipmentIcon from './EquipmentIcon.vue';
import SkillIcon from './SkillIcon.vue';

const props = defineProps<{
  name: string;
  classId: ClassId;
  level: number;
  cp: number;
  equipped: EquippedRecord | null;
}>();

const emit = defineEmits<{
  selectSlot: [slot: EquipSlot];
  equipBest: [];
  switchClass: [];
  previewInteract: [kind: 'greet' | 'pose' | 'celebrate'];
}>();

const leftSlots: readonly EquipSlot[] = ['weapon', 'necklace', 'bracelet', 'ring'];
const rightSlots: readonly EquipSlot[] = ['head', 'body', 'belt', 'shoes'];
const action = ref<CharacterAction>('idle');
const actionSequence = ref(0);
const activeSkill = ref<VisualSkill | null>(null);
const showBasicEffect = ref(false);
const reactionText = ref('');
const lastPreview = ref<'greet' | 'pose' | 'celebrate'>('greet');
let previewTimer = 0;

const previewLines: Record<ClassId, Readonly<Record<'greet' | 'pose' | 'celebrate', string>>> = {
  swordsman: {
    greet: '准备好了吗？动作预览随时可以开始。',
    pose: '这套装备的活动范围也确认过了。',
    celebrate: '胜利姿势——先提前练习一次。',
  },
  witch: {
    greet: '魔力检查完毕，要看哪一种动作？',
    pose: '星光会配合衣摆一起转动哦。',
    celebrate: '胜利烟花，先小小地试放一下～',
  },
  shaman: {
    greet: '灵火已经就位，可以开始预览。',
    pose: '铃音与衣饰的动作很合拍。',
    celebrate: '愿这份胜利的喜悦被好好记住。',
  },
  catkin: {
    greet: '搭档，动作预览准备好啦！',
    pose: '这套装备很灵活，看我转一圈。',
    celebrate: '胜利！先练一次帅气的击掌姿势。',
  },
};

const skills = computed(() => visualSkillsFor(props.classId));
const appearance = computed(() =>
  resolveCharacterAppearance(props.classId, props.level, props.equipped),
);
const characterKey = computed(
  () => `${appearance.value.signature}:${appearance.value.growthTier.id}:${actionSequence.value}`,
);
const boutiqueTheme = computed(() =>
  appearance.value.activeBoutiqueTheme
    ? BOUTIQUE_THEMES[appearance.value.activeBoutiqueTheme]
    : null,
);
const forgeStageLabel = computed(
  () =>
    ({
      original: '',
      gleam: '微光锻造',
      radiant: '辉光锻造',
      starforged: '星铸锻造',
      sakura: '樱华锻造',
    })[appearance.value.forgeStage],
);
const effectUrl = computed(() => {
  if (activeSkill.value) return `${import.meta.env.BASE_URL}${activeSkill.value.effectAsset}`;
  if (showBasicEffect.value) {
    return `${import.meta.env.BASE_URL}${BASIC_ATTACK_EFFECTS[props.classId]}`;
  }
  return null;
});

function instanceOf(slot: EquipSlot): EquipmentInstance | null {
  return props.equipped?.[slot] ?? null;
}

function equipmentName(slot: EquipSlot): string {
  const instance = instanceOf(slot);
  return instance
    ? equipmentPresentation(requireEquipment(instance.defId), props.classId).name
    : `空的${SLOT_LABELS[slot]}槽`;
}

function play(nextAction: CharacterAction, skill: VisualSkill | null = null): void {
  clearTimeout(previewTimer);
  action.value = nextAction;
  activeSkill.value = skill;
  showBasicEffect.value = nextAction === 'attack';
  actionSequence.value += 1;
  reactionText.value = '';
  if (nextAction === 'idle') return;
  previewTimer = window.setTimeout(
    () => {
      action.value = 'idle';
      activeSkill.value = null;
      showBasicEffect.value = false;
      actionSequence.value += 1;
    },
    skill ? 980 : 760,
  );
}

function previewSkill(skill: VisualSkill): void {
  if (props.level < skill.unlockLevel) return;
  play(skill.characterAction, skill);
}

function previewInteraction(kind: 'greet' | 'pose' | 'celebrate' = 'greet'): void {
  clearTimeout(previewTimer);
  lastPreview.value = kind;
  const themeLines = boutiqueTheme.value?.interactionLines ?? [];
  reactionText.value =
    themeLines[kind === 'greet' ? 0 : kind === 'pose' ? 1 : 2] ?? previewLines[props.classId][kind];
  action.value = kind === 'greet' ? 'react' : kind === 'pose' ? 'cast' : 'victory';
  activeSkill.value = null;
  showBasicEffect.value = false;
  actionSequence.value += 1;
  emit('previewInteract', kind);
  previewTimer = window.setTimeout(() => {
    action.value = 'idle';
    reactionText.value = '';
    actionSequence.value += 1;
  }, 1_250);
}

watch(
  () => props.classId,
  () => {
    clearTimeout(previewTimer);
    action.value = 'idle';
    activeSkill.value = null;
    showBasicEffect.value = false;
    reactionText.value = '';
    lastPreview.value = 'greet';
    actionSequence.value += 1;
  },
);

onUnmounted(() => clearTimeout(previewTimer));
</script>

<template>
  <section class="character-showcase card">
    <header class="showcase-head">
      <span class="identity">
        <strong>{{ name }}</strong>
        <span>{{ CLASS_INFO[classId].name }} · Lv.{{ level }}</span>
      </span>
      <span class="power">
        <small>战力</small>
        <strong class="num">{{ abbr(cp) }}</strong>
      </span>
      <span class="head-actions">
        <button type="button" class="switch-button" @click="emit('switchClass')">切换角色</button>
        <button type="button" class="best-button" @click="emit('equipBest')">一键最优</button>
      </span>
    </header>

    <div class="growth-status">
      <span class="tier-badge">{{ appearance.growthTier.label }}</span>
      <span>{{ appearance.equippedCount }}/8 已装备</span>
      <span>{{ appearance.visibleEquippedCount }}/4 外观部位已变化</span>
      <span v-if="forgeStageLabel" class="forge-badge">{{ forgeStageLabel }}</span>
      <span v-if="boutiqueTheme" class="boutique-badge">{{ boutiqueTheme.shortName }}特效</span>
    </div>

    <div class="paper-doll-layout">
      <div class="side-slots left-slots">
        <button
          v-for="slot in leftSlots"
          :key="slot"
          class="showcase-slot"
          :class="{ empty: !instanceOf(slot) }"
          :aria-label="`${SLOT_LABELS[slot]}：${equipmentName(slot)}`"
          @click="emit('selectSlot', slot)"
        >
          <EquipmentIcon
            v-if="instanceOf(slot)"
            :def="requireEquipment(instanceOf(slot)!.defId)"
            :class-id="classId"
            :enhance="instanceOf(slot)!.enhance"
            size="sm"
            decorative
          />
          <span v-else class="empty-glyph" aria-hidden="true">{{ SLOT_LABELS[slot][0] }}</span>
          <small>{{ SLOT_LABELS[slot] }}</small>
          <b v-if="instanceOf(slot)?.enhance" class="enhance-mark">
            +{{ instanceOf(slot)!.enhance }}
          </b>
        </button>
      </div>

      <button
        class="character-stage"
        :aria-label="`预览${name}的问候动作，不增加心意；${appearance.ariaLabel}`"
        @click="previewInteraction('greet')"
      >
        <span class="stage-backdrop" aria-hidden="true" />
        <CharacterAppearance
          :key="characterKey"
          :class-id="classId"
          :level="level"
          :equipped="equipped"
          :action="action"
          variant="showcase"
        />
        <span v-if="reactionText" class="reaction-bubble" aria-live="polite">
          {{ reactionText }}
        </span>
        <span v-else class="touch-hint">轻触预览动作</span>

        <span
          v-if="effectUrl"
          :key="`${actionSequence}-effect`"
          class="preview-effect"
          :class="[
            activeSkill ? `kind-${activeSkill.visualKind}` : 'kind-basic',
            `effect-${classId}`,
          ]"
          aria-hidden="true"
        >
          <img :src="effectUrl" alt="" draggable="false" />
          <i v-for="n in 7" :key="n" />
        </span>
      </button>

      <div class="side-slots right-slots">
        <button
          v-for="slot in rightSlots"
          :key="slot"
          class="showcase-slot"
          :class="{ empty: !instanceOf(slot) }"
          :aria-label="`${SLOT_LABELS[slot]}：${equipmentName(slot)}`"
          @click="emit('selectSlot', slot)"
        >
          <EquipmentIcon
            v-if="instanceOf(slot)"
            :def="requireEquipment(instanceOf(slot)!.defId)"
            :class-id="classId"
            :enhance="instanceOf(slot)!.enhance"
            size="sm"
            decorative
          />
          <span v-else class="empty-glyph" aria-hidden="true">{{ SLOT_LABELS[slot][0] }}</span>
          <small>{{ SLOT_LABELS[slot] }}</small>
          <b v-if="instanceOf(slot)?.enhance" class="enhance-mark">
            +{{ instanceOf(slot)!.enhance }}
          </b>
        </button>
      </div>
    </div>

    <div class="interaction-panel">
      <span class="preview-copy">
        <strong>动作试演</strong>
        <small>不增加心意</small>
      </span>
      <button :class="{ active: lastPreview === 'greet' }" @click="previewInteraction('greet')">
        问候动作
      </button>
      <button :class="{ active: lastPreview === 'pose' }" @click="previewInteraction('pose')">
        {{ boutiqueTheme ? boutiqueTheme.interactionName : '展示' }}
      </button>
      <button
        :class="{ active: lastPreview === 'celebrate' }"
        @click="previewInteraction('celebrate')"
      >
        胜利动作
      </button>
    </div>

    <div class="action-strip" aria-label="角色动作与技能预览">
      <button :class="{ active: action === 'idle' }" @click="play('idle')">
        <span aria-hidden="true">♡</span>
        <small>待机</small>
      </button>
      <button :class="{ active: showBasicEffect }" @click="play('attack')">
        <span aria-hidden="true">✦</span>
        <small>普攻</small>
      </button>
      <button
        v-for="skill in skills"
        :key="skill.id"
        class="skill-action"
        :class="{ active: activeSkill?.id === skill.id }"
        :disabled="level < skill.unlockLevel"
        :aria-label="
          level < skill.unlockLevel
            ? `${skill.name}，等级 ${skill.unlockLevel} 解锁`
            : `预览${skill.name}`
        "
        @click="previewSkill(skill)"
      >
        <SkillIcon :skill="skill" :locked="level < skill.unlockLevel" />
        <small>{{ level < skill.unlockLevel ? `Lv${skill.unlockLevel}` : skill.name }}</small>
      </button>
    </div>
  </section>
</template>

<style scoped>
.character-showcase {
  overflow: hidden;
  background:
    radial-gradient(circle at 50% 42%, rgb(255 255 255 / 88%), transparent 38%),
    linear-gradient(145deg, #fff5fa, #eef8ff 52%, #fff9ed);
  border-color: rgb(255 255 255 / 92%);
  box-shadow:
    inset 0 0 0 1px rgb(144 181 211 / 13%),
    0 9px 24px rgb(84 84 113 / 12%);
}

.showcase-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 8px;
  min-height: 56px;
  padding: 8px 10px;
  background: rgb(255 255 255 / 66%);
  border-bottom: 1px solid var(--line);
}

.identity {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.identity strong {
  overflow: hidden;
  font-size: 15px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.identity span,
.power small {
  font-size: 9px;
  color: var(--text-dim);
}

.power {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.power strong {
  color: var(--blue-deep);
  font-size: 15px;
}

.best-button {
  min-width: 64px;
  min-height: 44px;
  padding: 0 10px;
  font-size: 10px;
  font-weight: 800;
  color: #fff;
  background: linear-gradient(145deg, #fa84ae, #7dbce9);
  border: 1px solid rgb(255 255 255 / 75%);
  border-radius: 13px;
  box-shadow: 0 4px 9px rgb(115 137 181 / 20%);
}

.head-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.switch-button {
  min-width: 70px;
  min-height: 44px;
  padding: 0 9px;
  font-size: 10px;
  font-weight: 800;
  color: var(--blue-deep);
  background: rgb(238 248 255 / 92%);
  border: 1px solid #c8e4f5;
  border-radius: 13px;
  box-shadow: 0 4px 9px rgb(77 123 158 / 9%);
}

.switch-button:active,
.best-button:active {
  transform: scale(0.96);
}

@media (max-width: 350px) {
  .showcase-head {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .head-actions {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: 1fr 1fr;
  }

  .switch-button,
  .best-button {
    width: 100%;
  }
}

.growth-status {
  min-height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 4px 8px;
  font-size: 8px;
  color: var(--text-dim);
  background: rgb(255 255 255 / 48%);
}

.tier-badge {
  padding: 2px 7px;
  font-weight: 800;
  color: var(--pink-deep);
  background: var(--pink-soft);
  border-radius: 999px;
}

.boutique-badge {
  padding: 2px 6px;
  font-weight: 800;
  color: #8d496f;
  background: linear-gradient(120deg, #ffe8f2, #fff2c9);
  border-radius: 999px;
}

.forge-badge {
  padding: 2px 6px;
  font-weight: 800;
  color: #5b69a4;
  background: linear-gradient(120deg, #eaf7ff, #f5ecff);
  border-radius: 999px;
}

.paper-doll-layout {
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr) 56px;
  align-items: stretch;
  gap: 3px;
  min-height: 304px;
  padding: 4px 7px 0;
}

.side-slots {
  z-index: 4;
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  gap: 3px;
  padding: 7px 0 10px;
}

.showcase-slot {
  position: relative;
  min-width: 52px;
  min-height: 59px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 1px;
  padding: 3px;
  color: var(--text-mid);
  background: rgb(255 255 255 / 82%);
  border: 1px solid rgb(188 205 222 / 68%);
  border-radius: 13px;
  box-shadow: 0 4px 9px rgb(77 93 120 / 9%);
  transition:
    transform var(--t-fast) var(--ease-spring),
    border-color var(--t-mid) ease,
    box-shadow var(--t-mid) ease;
}

.showcase-slot:active {
  border-color: rgb(232 155 190 / 78%);
  box-shadow:
    inset 0 2px 6px rgb(127 95 127 / 10%),
    0 2px 5px rgb(77 93 120 / 8%);
  transform: scale(0.9);
}

.showcase-slot.empty {
  color: var(--text-dim);
  background: rgb(239 244 249 / 72%);
  border-style: dashed;
}

.showcase-slot small {
  max-width: 47px;
  overflow: hidden;
  font-size: 8px;
  line-height: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty-glyph {
  width: 31px;
  height: 31px;
  display: grid;
  place-items: center;
  font-size: 11px;
  background: rgb(255 255 255 / 58%);
  border: 1px dashed var(--line-strong);
  border-radius: 10px;
}

.enhance-mark {
  position: absolute;
  top: 2px;
  right: 4px;
  font-size: 8px;
  color: var(--q-legendary);
}

.character-stage {
  isolation: isolate;
  position: relative;
  min-width: 0;
  min-height: 304px;
  /* 弧形只属于背景层；这里若裁剪，会把右上角的互动对话一起削掉。 */
  overflow: visible;
  padding: 0;
  border-radius: 49% 49% 20px 20px;
  transition: transform var(--t-fast) var(--ease-spring);
}

.character-stage:active {
  transform: scale(0.985);
}

.stage-backdrop {
  position: absolute;
  z-index: -1;
  inset: 8% 1% 3%;
  background:
    radial-gradient(circle at 50% 37%, rgb(255 255 255 / 90%), transparent 33%),
    radial-gradient(ellipse at 50% 86%, rgb(126 200 238 / 17%), transparent 54%);
  border: 1px solid rgb(255 255 255 / 72%);
  border-radius: 49% 49% 20px 20px;
  box-shadow: inset 0 -20px 28px rgb(105 156 199 / 8%);
}

.character-stage :deep(.character-appearance) {
  position: absolute;
  inset: 0;
}

.touch-hint {
  position: absolute;
  z-index: 9;
  left: 50%;
  bottom: 4px;
  padding: 2px 8px;
  font-size: 8px;
  color: var(--text-dim);
  background: rgb(255 255 255 / 75%);
  border-radius: 999px;
  transform: translateX(-50%);
}

.reaction-bubble {
  position: absolute;
  z-index: 10;
  top: 19%;
  right: 1%;
  max-width: 116px;
  padding: 6px 8px;
  font-size: 9px;
  line-height: 1.35;
  color: var(--pink-deep);
  background: rgb(255 255 255 / 93%);
  border: 1px solid #ffd0df;
  border-radius: 12px 12px 4px 12px;
  box-shadow: 0 4px 9px rgb(72 82 104 / 13%);
  animation: bubble-in 0.22s ease-out;
}

.preview-effect {
  position: absolute;
  z-index: 8;
  right: -7%;
  top: 30%;
  width: 68%;
  aspect-ratio: 1;
  pointer-events: none;
}

.preview-effect > img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 2px 7px rgb(101 95 152 / 33%));
  animation: showcase-effect 0.86s ease-out both;
}

.preview-effect.kind-heal,
.preview-effect.kind-ring,
.preview-effect.kind-summon {
  right: 16%;
  top: 20%;
}

.preview-effect.kind-basic {
  right: -2%;
  top: 37%;
  width: 56%;
}

.preview-effect i {
  --dx: 34px;
  --dy: -25px;
  position: absolute;
  left: 52%;
  top: 53%;
  width: 5px;
  height: 5px;
  background: #ff9fc2;
  border: 1px solid #fff;
  border-radius: 50%;
  animation: showcase-particle 0.74s ease-out both;
}

.preview-effect i:nth-of-type(2) {
  --dx: -38px;
  --dy: -20px;
  background: #96d4ff;
}

.preview-effect i:nth-of-type(3) {
  --dx: 42px;
  --dy: 19px;
  background: #ffe49d;
}

.preview-effect i:nth-of-type(4) {
  --dx: -29px;
  --dy: 31px;
}

.preview-effect i:nth-of-type(5) {
  --dx: 5px;
  --dy: -43px;
  background: #c4b3ff;
}

.preview-effect i:nth-of-type(6) {
  --dx: -46px;
  --dy: 7px;
  background: #fff;
}

.preview-effect i:nth-of-type(7) {
  --dx: 20px;
  --dy: 39px;
  background: #96d4ff;
}

.interaction-panel {
  display: grid;
  grid-template-columns: minmax(72px, 1fr) repeat(3, minmax(58px, auto));
  align-items: center;
  gap: 4px;
  padding: 6px 7px;
  background: rgb(255 255 255 / 52%);
  border-top: 1px solid rgb(222 229 239 / 72%);
}

.interaction-panel button {
  min-height: 44px;
  padding: 4px 7px;
  font-size: 8px;
  font-weight: 800;
  color: var(--text-mid);
  background: rgb(255 255 255 / 76%);
  border: 1px solid var(--line);
  border-radius: 11px;
  transition:
    transform var(--t-fast) var(--ease-spring),
    background var(--t-mid) ease,
    border-color var(--t-mid) ease;
}

.interaction-panel button:active {
  transform: scale(0.92);
}

.interaction-panel button.active {
  color: var(--pink-deep);
  background: #fff0f6;
  border-color: #ffc5da;
}

.preview-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-right: 3px;
}

.preview-copy strong {
  font-size: 8px;
  color: var(--text-mid);
}

.preview-copy small {
  font-size: 7px;
  color: var(--text-dim);
}

.action-strip {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 4px;
  padding: 7px;
  background: rgb(255 255 255 / 64%);
  border-top: 1px solid var(--line);
}

.action-strip > button {
  min-width: 0;
  min-height: 53px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 3px 1px;
  color: var(--text-mid);
  background: rgb(245 248 252 / 84%);
  border: 1px solid var(--line);
  border-radius: 11px;
  transition:
    transform var(--t-fast) var(--ease-spring),
    background var(--t-mid) ease,
    border-color var(--t-mid) ease;
}

.action-strip > button:active:not(:disabled) {
  transform: scale(0.9);
}

.action-strip > button.active {
  color: var(--pink-deep);
  background: #fff2f7;
  border-color: #ffc4d8;
  box-shadow: 0 0 0 2px rgb(255 188 213 / 16%);
}

.action-strip > button:disabled {
  opacity: 0.54;
}

.action-strip > button > span {
  font-size: 19px;
  line-height: 1;
}

.action-strip small {
  max-width: 100%;
  overflow: hidden;
  font-size: 7px;
  line-height: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.skill-action :deep(.skill-icon) {
  width: 31px;
  height: 31px;
  border-radius: 10px;
}

@keyframes bubble-in {
  from {
    opacity: 0;
    transform: translateY(5px) scale(0.9);
  }
}

@keyframes showcase-effect {
  0% {
    opacity: 0;
    transform: scale(0.2) rotate(-18deg);
  }
  38%,
  68% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: scale(1.12) rotate(5deg);
  }
}

@keyframes showcase-particle {
  0% {
    opacity: 0;
    transform: translate(0) scale(0.3);
  }
  38% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate(var(--dx), var(--dy)) scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .reaction-bubble,
  .preview-effect,
  .preview-effect i {
    animation: none !important;
  }

  .switch-button,
  .best-button {
    transition: none;
  }
}
</style>
