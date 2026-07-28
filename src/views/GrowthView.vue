<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref } from 'vue';
import { abbr } from '@/core/format';
import {
  isAffectionStoryUnlocked,
  type AffectionMood,
} from '@/core/affection';
import type { EquipmentInstance, EquipSlot, Stats } from '@/core/types';
import { useInventoryStore } from '@/stores/inventory';
import { usePlayerStore } from '@/stores/player';
import { useSettingsStore } from '@/stores/settings';
import { CLASS_INFO, SLOT_LABELS, STAT_LABELS } from '@/data/constants';
import {
  affectionMemoryDialogue,
  requireAffectionCharacter,
  requireAffectionStory,
} from '@/data/affection';
import { AFFECTION_RULES } from '@/data/affectionRules';
import {
  affectionEquipmentForClass,
  requireAffectionEquipment,
} from '@/data/affectionEquipment';
import { visualSkillsFor } from '@/data/skills';
import EquipDetail from '@/components/EquipDetail.vue';
import CharacterShowcase from '@/components/CharacterShowcase.vue';
import CharacterAppearance from '@/components/CharacterAppearance.vue';
import ClassSwitchModal from '@/components/ClassSwitchModal.vue';
import EnhancePanel from '@/components/EnhancePanel.vue';
import SkillIcon from '@/components/SkillIcon.vue';
import AffectionPanel from '@/components/affection/AffectionPanel.vue';
import AffectionStoryModal from '@/components/affection/AffectionStoryModal.vue';
import AffectionEquipmentGallery from '@/components/affection/AffectionEquipmentGallery.vue';
import { triggerHaptic } from '@/ui/haptics';

const inventory = useInventoryStore();
const player = usePlayerStore();
const settings = useSettingsStore();
const detail = ref<EquipmentInstance | null>(null);
const feedback = ref('');
const classSwitchOpen = ref(false);
const classSwitchBusy = ref(false);
const interactionBusyId = ref<string | null>(null);
const affectionFeedback = ref<{
  tone: 'success' | 'notice' | 'reward';
  text: string;
} | null>(null);
const activeStoryId = ref<string | null>(null);
const storyBusy = ref(false);
const storyFeedback = ref<string | null>(null);
const galleryOpen = ref(false);
const selectedAffectionEquipmentId = ref<string | null>(null);
const galleryRef = ref<HTMLElement | null>(null);
let feedbackTimer = 0;
let affectionFeedbackTimer = 0;

const equipped = computed(() => inventory.equipped);
const visualSkills = computed(() => (player.player ? visualSkillsFor(player.player.classId) : []));
const affectionCharacter = computed(() =>
  player.player ? requireAffectionCharacter(player.player.classId) : null,
);
const affectionProgress = computed(() => player.affectionProgress);
const affectionTier = computed(() => player.affectionTier);
const nextAffectionTier = computed(() => {
  const tier = affectionTier.value;
  if (!tier) return null;
  const tierIndex = AFFECTION_RULES.tiers.findIndex((entry) => entry.id === tier.id);
  return AFFECTION_RULES.tiers[tierIndex + 1] ?? null;
});
const affectionStoryViews = computed(() => {
  const character = affectionCharacter.value;
  const progress = affectionProgress.value;
  if (!character || !progress) return [];
  return character.stories.map((story) => ({
    story,
    unlocked: isAffectionStoryUnlocked(progress, story),
    completed: progress.completedStoryIds.includes(story.id),
  }));
});
const activeStory = computed(() => {
  const classId = player.player?.classId;
  return classId && activeStoryId.value
    ? requireAffectionStory(classId, activeStoryId.value)
    : null;
});
const activeStoryReplay = computed(
  () =>
    Boolean(
      activeStory.value &&
        affectionProgress.value?.completedStoryIds.includes(activeStory.value.id),
    ),
);
const activeStoryMemory = computed(() =>
  activeStory.value && affectionProgress.value
    ? affectionMemoryDialogue(activeStory.value, affectionProgress.value.choiceHistory)
    : [],
);
const affectionEquipmentItems = computed(() => {
  const classId = player.player?.classId;
  const progress = affectionProgress.value;
  const level = player.player?.level;
  if (!classId || !progress || !level) return [];
  const equippedIds = new Set(
    Object.values(equipped.value ?? {})
      .filter((instance): instance is EquipmentInstance => instance !== null)
      .map((instance) => instance.defId),
  );
  return affectionEquipmentForClass(classId).map((entry) => ({
    id: entry.definition.id,
    name: entry.definition.name,
    slotLabel: SLOT_LABELS[entry.definition.slot],
    iconAsset: entry.definition.icon,
    owned: progress.discoveredGearIds.includes(entry.definition.id),
    equipped: equippedIds.has(entry.definition.id),
    eligible:
      progress.points >= entry.unlockPoints && level >= entry.definition.level,
    requiredPoints: entry.unlockPoints,
    effectText: entry.definition.uniqueEffect ?? '与她共同珍藏的心虹装备。',
    flavorText: entry.flavorText,
    setNodeText: `心虹珍藏 ${entry.collectionIndex + 1}/10 · Lv${entry.definition.level}`,
  }));
});

const statRows = computed(() => {
  const s = player.finalStats;
  return (Object.keys(s) as (keyof Stats)[]).map((k) => ({
    key: k,
    label: STAT_LABELS[k],
    value: fmt(k, s[k]),
  }));
});

function fmt(key: keyof Stats, v: number): string {
  if (key === 'critRate' || key === 'critDmg') return v.toFixed(1) + '%';
  if (key === 'spd') return v.toFixed(2);
  return abbr(Math.round(v));
}

function announce(message: string): void {
  feedback.value = message;
  clearTimeout(feedbackTimer);
  feedbackTimer = window.setTimeout(() => (feedback.value = ''), 2_200);
}

function announceAffection(
  text: string,
  tone: 'success' | 'notice' | 'reward' = 'success',
): void {
  affectionFeedback.value = { text, tone };
  clearTimeout(affectionFeedbackTimer);
  affectionFeedbackTimer = window.setTimeout(() => {
    affectionFeedback.value = null;
  }, tone === 'reward' ? 5_200 : 4_000);
}

function prefersReducedMotion(): boolean {
  return Boolean(
    settings.settings?.reduceMotion ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  );
}

function vibrate(cue: AffectionMood | 'prismatic-drop'): void {
  triggerHaptic(cue, settings.settings?.haptics ?? false, prefersReducedMotion());
}

function open(slot: EquipSlot): void {
  const instance = equipped.value?.[slot] ?? null;
  if (instance) {
    detail.value = instance;
    return;
  }
  announce(`${SLOT_LABELS[slot]}槽还是空的，可在背包中选择该部位装备。`);
}

function equipBest(): void {
  const count = inventory.equipBest();
  announce(count > 0 ? `已替换 ${count} 件更强装备，角色外观同步更新。` : '当前已是最优装备。');
}

async function interactWithCharacter(interactionId: string): Promise<void> {
  const classId = player.player?.classId;
  const interaction = affectionCharacter.value?.interactions.find(
    (entry) => entry.id === interactionId,
  );
  if (!classId || !interaction || interactionBusyId.value) return;

  interactionBusyId.value = interactionId;
  try {
    const result = await player.interactWithCharacter(classId, interactionId);
    if (!result.ok) {
      const message =
        result.reason === 'daily-limit'
          ? '今天的有效互动已经完成，明早 04:00 再来陪她吧。'
          : result.reason === 'interaction-locked'
            ? '先完成对应的心动篇章，她才会把这个小秘密交给你。'
            : '当前存档还未准备好，请返回首页重新进入角色。';
      announceAffection(message, 'notice');
      return;
    }

    vibrate(interaction.mood);
    const line = interaction.lines[(result.totalInteractions - 1) % interaction.lines.length];
    const response = `“${line}” +${result.gainedPoints} 心意`;
    if (result.gearReward) {
      const reward = requireAffectionEquipment(result.gearReward.defId);
      vibrate('prismatic-drop');
      selectedAffectionEquipmentId.value = reward.definition.id;
      galleryOpen.value = true;
      announceAffection(
        `${response} ✦ 心虹珍藏「${reward.definition.name}」回应了这份心意，已自动锁定。`,
        'reward',
      );
      await nextTick();
      galleryRef.value?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      return;
    }
    announceAffection(response);
  } finally {
    interactionBusyId.value = null;
  }
}

function openStory(storyId: string): void {
  const entry = affectionStoryViews.value.find((candidate) => candidate.story.id === storyId);
  if (!entry?.unlocked) return;
  activeStoryId.value = storyId;
  storyFeedback.value = null;
}

function closeStory(): void {
  if (storyBusy.value) return;
  activeStoryId.value = null;
  storyFeedback.value = null;
}

function previewStoryChoice(storyId: string, choiceId: string): void {
  const choice = requireAffectionStory(player.player!.classId, storyId).choices.find(
    (entry) => entry.id === choiceId,
  );
  if (choice) vibrate(choice.mood);
}

async function finishStory(storyId: string, choiceId: string): Promise<void> {
  const classId = player.player?.classId;
  if (!classId || storyBusy.value) return;
  if (affectionProgress.value?.completedStoryIds.includes(storyId)) {
    closeStory();
    return;
  }

  storyBusy.value = true;
  storyFeedback.value = '正在把这段回忆写进心之手札…';
  try {
    const result = await player.completeAffectionStoryChoice(classId, storyId, choiceId);
    if (!result.ok) {
      storyFeedback.value =
        result.reason === 'already-completed'
          ? '这段回忆已经珍藏过，本次重看不会重复获得心意。'
          : '这段故事暂时还没有完整解锁。';
      return;
    }
    vibrate(result.mood);
    const story = requireAffectionStory(classId, storyId);
    activeStoryId.value = null;
    storyFeedback.value = null;
    announceAffection(`已珍藏「${story.title}」，+${result.gainedPoints} 心意。`, 'success');
  } finally {
    storyBusy.value = false;
  }
}

async function toggleGallery(): Promise<void> {
  galleryOpen.value = !galleryOpen.value;
  if (!galleryOpen.value) return;
  await nextTick();
  galleryRef.value?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
}

function storyPortraitAction(mood: AffectionMood): 'idle' | 'cast' | 'victory' {
  if (mood === 'bright' || mood === 'playful') return 'victory';
  if (mood === 'shy' || mood === 'moved') return 'cast';
  return 'idle';
}

async function switchClass(target: Parameters<typeof player.switchClass>[0]): Promise<void> {
  if (classSwitchBusy.value) return;
  classSwitchBusy.value = true;
  try {
    const result = await player.switchClass(target);
    if (!result.ok) {
      announce(result.reason === 'no-save' ? '当前没有可切换的角色存档。' : '你已经是这个职业了。');
      return;
    }

    classSwitchOpen.value = false;
    const equipmentCopy =
      result.movedCount > 0
        ? `已安全收回 ${result.movedCount} 件旧职业专属装备并保持锁定${
            result.newlyLockedCount > 0 ? `，其中 ${result.newlyLockedCount} 件新增保护` : ''
          }。`
        : '当前装备无需收回。';
    announce(`已切换为 ${CLASS_INFO[target].name}，等级与全部进度完整保留。${equipmentCopy}`);
  } finally {
    classSwitchBusy.value = false;
  }
}

onUnmounted(() => {
  clearTimeout(feedbackTimer);
  clearTimeout(affectionFeedbackTimer);
});
</script>

<template>
  <div v-if="player.player" class="growth">
    <CharacterShowcase
      :name="player.player.name"
      :class-id="player.player.classId"
      :level="player.player.level"
      :cp="player.cp"
      :equipped="equipped"
      @select-slot="open"
      @equip-best="equipBest"
      @switch-class="classSwitchOpen = true"
    />

    <Transition name="feedback">
      <div v-if="feedback" class="growth-feedback" role="status" aria-live="polite">
        {{ feedback }}
      </div>
    </Transition>

    <AffectionPanel
      v-if="affectionCharacter && affectionProgress && affectionTier"
      class="row-in"
      style="--row-delay: 30ms"
      :character="affectionCharacter"
      :progress="affectionProgress"
      :tier="affectionTier"
      :next-tier="nextAffectionTier"
      :interactions-remaining="player.affectionInteractionsRemaining"
      :stories="affectionStoryViews"
      :busy-interaction-id="interactionBusyId"
      :disabled="storyBusy"
      :feedback="affectionFeedback"
      @interact="interactWithCharacter"
      @open-story="openStory"
      @open-equipment="toggleGallery"
    />

    <Transition name="gallery-reveal">
      <div v-if="galleryOpen && affectionCharacter" ref="galleryRef" class="gallery-wrap">
        <AffectionEquipmentGallery
          :items="affectionEquipmentItems"
          :character-name="affectionCharacter.name"
          :selected-id="selectedAffectionEquipmentId"
          :accent="affectionCharacter.accent"
          :glow="affectionCharacter.glow"
          show-close
          @select="selectedAffectionEquipmentId = $event"
          @close="galleryOpen = false"
        />
      </div>
    </Transition>

    <EnhancePanel class="row-in" style="--row-delay: 40ms" />

    <section
      v-if="visualSkills.length > 0"
      class="card skills-card row-in"
      style="--row-delay: 90ms"
    >
      <div class="card-head">
        <span>{{ CLASS_INFO[player.player.classId].name }}技能演出</span>
        <span class="skill-hint">随等级解锁</span>
      </div>
      <div class="skills">
        <div
          v-for="skill in visualSkills"
          :key="skill.id"
          class="skill-row"
          :class="{ locked: player.player.level < skill.unlockLevel }"
        >
          <SkillIcon :skill="skill" :locked="player.player.level < skill.unlockLevel" />
          <span class="skill-copy">
            <span class="skill-name">{{ skill.name }}</span>
            <span class="skill-desc">{{ skill.desc }}</span>
          </span>
          <span class="skill-level">
            {{ player.player.level >= skill.unlockLevel ? '已解锁' : `Lv${skill.unlockLevel}` }}
          </span>
        </div>
      </div>
    </section>

    <!-- 属性面板 -->
    <section class="card stats-card row-in" style="--row-delay: 140ms">
      <div class="card-head"><span>属性</span></div>
      <div class="stats">
        <div v-for="r in statRows" :key="r.key" class="stat">
          <span class="s-label">{{ r.label }}</span>
          <span class="s-value num">{{ r.value }}</span>
        </div>
      </div>
    </section>

    <section class="card soon row-in" style="--row-delay: 190ms">
      <div class="card-head"><span>后续养成</span></div>
      <div class="soon-list">
        <span class="chip">技能 · M3-5</span>
        <span class="chip">洗练 · M4-6</span>
        <span class="chip">套装 · M5-1</span>
        <span class="chip">宠物 · M6-1</span>
      </div>
    </section>

    <Transition name="modal-pop">
      <EquipDetail v-if="detail" :inst="detail" from="equipped" @close="detail = null" />
    </Transition>

    <ClassSwitchModal
      v-if="classSwitchOpen"
      :current-class="player.player.classId"
      :busy="classSwitchBusy"
      @close="classSwitchOpen = false"
      @confirm="switchClass"
    />

    <AffectionStoryModal
      v-if="activeStory && affectionCharacter"
      :story="activeStory"
      :character-name="affectionCharacter.name"
      :character-accent="affectionCharacter.accent"
      :character-glow="affectionCharacter.glow"
      :memory-dialogue="activeStoryMemory"
      :busy="storyBusy"
      :feedback="storyFeedback"
      :portrait-label="`${affectionCharacter.name}身穿当前实际装备的剧情立绘`"
      :replay="activeStoryReplay"
      @close="closeStory"
      @choose="previewStoryChoice"
      @finish="finishStory"
    >
      <template #portrait="{ mood }">
        <CharacterAppearance
          class="story-character"
          :class-id="player.player.classId"
          :level="player.player.level"
          :equipped="equipped"
          :action="storyPortraitAction(mood)"
          variant="showcase"
        />
      </template>
    </AffectionStoryModal>
  </div>
</template>

<style scoped>
.growth {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-bottom: 4px;
}

.growth-feedback {
  position: sticky;
  z-index: 20;
  top: 6px;
  align-self: center;
  max-width: calc(100% - 22px);
  margin: -4px 0 -2px;
  padding: 7px 12px;
  font-size: 10px;
  color: #fff;
  text-align: center;
  background: rgb(51 68 91 / 92%);
  border: 1px solid rgb(255 255 255 / 34%);
  border-radius: 999px;
  box-shadow: 0 5px 12px rgb(46 52 70 / 20%);
}

.gallery-wrap {
  scroll-margin-top: 10px;
}

.story-character {
  width: 100%;
  height: 100%;
  filter: drop-shadow(0 10px 14px rgb(37 37 58 / 24%));
}

.feedback-enter-from,
.feedback-leave-to {
  opacity: 0;
  transform: translateY(-5px);
}

.feedback-enter-active,
.feedback-leave-active {
  transition: all 0.2s ease;
}

.gallery-reveal-enter-active,
.gallery-reveal-leave-active {
  transition:
    opacity 0.24s var(--ease-soft),
    transform 0.3s var(--ease-spring);
}

.gallery-reveal-enter-from,
.gallery-reveal-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.985);
}

.skill-hint {
  font-size: 9px;
  color: var(--blue-deep);
}

.skills {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 9px;
}

.skill-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px;
  background: linear-gradient(100deg, #fff8fb, #f5f8ff);
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
}

.skill-row.locked {
  background: var(--panel-2);
}

.skill-copy {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.skill-name {
  font-size: 12px;
  font-weight: 700;
}

.skill-desc {
  overflow: hidden;
  color: var(--text-dim);
  font-size: 9px;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.skill-level {
  flex-shrink: 0;
  padding: 2px 6px;
  font-size: 9px;
  font-weight: 700;
  color: var(--pink-deep);
  background: var(--pink-soft);
  border-radius: 999px;
}

.locked .skill-level {
  color: var(--text-dim);
  background: var(--panel-3);
}

/* ── 卡片通用 ── */
.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  font-size: 11px;
  color: var(--text-dim);
  border-bottom: 1px solid var(--line);
}

/* ── 属性 ── */
.stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1px;
  padding: 8px;
}

.stat {
  display: flex;
  justify-content: space-between;
  padding: 6px 8px;
  font-size: 12px;
  border-radius: 6px;
}

.stat:nth-child(4n + 1),
.stat:nth-child(4n + 2) {
  background: var(--panel-2);
}

.s-label {
  color: var(--text-mid);
}

.s-value {
  font-weight: 600;
}

.soon-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 10px;
}

.chip {
  padding: 4px 10px;
  font-size: 10px;
  color: var(--text-dim);
  background: var(--panel-3);
  border-radius: 999px;
}

@media (prefers-reduced-motion: reduce) {
  .feedback-enter-active,
  .feedback-leave-active,
  .gallery-reveal-enter-active,
  .gallery-reveal-leave-active {
    transition: none;
  }
}
</style>
