<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue';
import { Check, RefreshCw, Save, ShieldCheck, Sparkles, Trash2, Zap } from '@lucide/vue';
import { EQUIPMENT_PRESET_IDS, type EquipmentPresetId } from '@/core/equipmentPresets';
import { CLASS_INFO, SLOT_LABELS, SLOT_ORDER } from '@/data/constants';
import { requireEquipment } from '@/data/equipment';
import { equipmentDisplayPresentation } from '@/data/equipmentPresentation';
import { WEAPON_ELEMENT_LABELS } from '@/data/weaponElements';
import { useInventoryStore } from '@/stores/inventory';
import { usePlayerStore } from '@/stores/player';

const inventory = useInventoryStore();
const player = usePlayerStore();
const BASE = import.meta.env.BASE_URL;
const feedback = ref('');
const confirmDeleteId = ref<EquipmentPresetId | null>(null);
let feedbackTimer = 0;

const state = computed(() => inventory.equipmentPresets);
const currentClassId = computed(() => player.player?.classId ?? null);
const hasAnyPreset = computed(() => state.value.presets.length > 0);
const autoSwitch = computed(() => state.value.autoSwitch);

const cards = computed(() =>
  EQUIPMENT_PRESET_IDS.map((id, index) => {
    const preset = state.value.presets.find((candidate) => candidate.id === id) ?? null;
    const slots = preset ? SLOT_ORDER.filter((slot) => preset.equipmentUids[slot] !== null) : [];
    const missingCount = preset
      ? slots.filter((slot) => !inventory.ownedEquipment(preset.equipmentUids[slot]!)).length
      : 0;
    const weapon = preset?.equipmentUids.weapon
      ? inventory.ownedEquipment(preset.equipmentUids.weapon)
      : null;
    const definition = weapon ? requireEquipment(weapon.defId) : null;
    const presentation =
      definition && preset ? equipmentDisplayPresentation(definition, preset.classId) : null;
    return {
      id,
      number: index + 1,
      preset,
      slots,
      missingCount,
      weaponName: presentation?.name ?? '未保存武器',
      weaponIcon: presentation?.icon ?? null,
      elementLabel:
        definition?.slot === 'weapon' ? WEAPON_ELEMENT_LABELS[definition.element] : null,
      currentClass: preset?.classId === currentClassId.value,
    };
  }),
);

function announce(message: string): void {
  feedback.value = message;
  window.clearTimeout(feedbackTimer);
  feedbackTimer = window.setTimeout(() => {
    feedback.value = '';
  }, 3_200);
}

function reasonText(reason: string): string {
  const labels: Record<string, string> = {
    'no-save': '角色存档还没有载入。',
    'empty-loadout': '当前一件装备都没穿，先穿好再保存。',
    'preset-not-found': '这套预设还没有保存。',
    'class-mismatch': '这套预设属于另一个职业，请先切换角色。',
    'duplicate-uid': '预设里出现了重复装备，请重新保存。',
    'missing-equipment': '预设中的装备已经不在账号里，无法半套换装。',
    'wrong-slot': '预设中的装备部位不匹配，请重新保存。',
    'level-locked': '当前等级不足以穿戴这套装备。',
    'profession-locked': '预设中含有其他职业的专属装备。',
  };
  return labels[reason] ?? '这套预设暂时无法使用。';
}

function saveCurrent(id: EquipmentPresetId): void {
  confirmDeleteId.value = null;
  const result = inventory.captureEquipmentPreset(id);
  if (!result.ok) {
    announce(reasonText(result.reason));
    return;
  }
  announce(`方案 ${id.at(-1)} 已保存，当前八槽快照已记录，方案装备已加入保护。`);
}

function applyPreset(id: EquipmentPresetId): void {
  confirmDeleteId.value = null;
  const result = inventory.applyEquipmentPreset(id);
  if (!result.ok) {
    announce(reasonText(result.reason));
    return;
  }
  announce(
    result.changedSlots > 0
      ? `已切换方案 ${id.at(-1)}，更换 ${result.changedSlots} 个部位。`
      : `当前已经是方案 ${id.at(-1)}。`,
  );
}

function deletePreset(id: EquipmentPresetId): void {
  if (confirmDeleteId.value !== id) {
    confirmDeleteId.value = id;
    announce(`再点一次“清空”确认删除方案 ${id.at(-1)}。`);
    return;
  }
  confirmDeleteId.value = null;
  if (inventory.deleteEquipmentPreset(id)) {
    announce(`方案 ${id.at(-1)} 已清空；装备保护锁保持不变。`);
  }
}

function toggleAutoSwitch(): void {
  const next = !autoSwitch.value;
  if (inventory.setEquipmentPresetAutoSwitch(next)) {
    announce(
      next
        ? '已开启：进入属性关前会自动选择克制武器预设。'
        : '已关闭自动切换，关卡将保持当前装备。',
    );
  }
}

onUnmounted(() => window.clearTimeout(feedbackTimer));
</script>

<template>
  <section class="preset-panel" aria-labelledby="equipment-preset-title">
    <div class="preset-glow preset-glow-pink" aria-hidden="true" />
    <div class="preset-glow preset-glow-blue" aria-hidden="true" />
    <header class="preset-head">
      <span class="preset-sigil" aria-hidden="true"><Sparkles :size="17" /></span>
      <span class="preset-heading">
        <strong id="equipment-preset-title">星衣方案</strong>
        <small>三套完整装备快照 · 一键换装</small>
      </span>
      <button
        type="button"
        class="auto-switch"
        :class="{ on: autoSwitch }"
        role="switch"
        :aria-checked="autoSwitch"
        :disabled="!hasAnyPreset && !autoSwitch"
        aria-label="按关卡属性自动切换装备预设"
        @click="toggleAutoSwitch"
      >
        <Zap :size="12" aria-hidden="true" />
        <span>属性自动切换</span>
        <i aria-hidden="true"><b /></i>
      </button>
    </header>

    <p class="preset-tip">
      <ShieldCheck :size="13" aria-hidden="true" />
      保存会自动锁定方案装备；属性关只在整套校验通过后换装，不会半套替换。
    </p>

    <div class="preset-list">
      <article
        v-for="card in cards"
        :key="card.id"
        class="preset-card"
        :class="{ empty: !card.preset, foreign: card.preset && !card.currentClass }"
      >
        <span class="preset-number num">0{{ card.number }}</span>
        <span class="weapon-orb" :class="{ placeholder: !card.weaponIcon }">
          <img v-if="card.weaponIcon" :src="`${BASE}${card.weaponIcon}`" alt="" />
          <RefreshCw v-else :size="18" aria-hidden="true" />
        </span>
        <span class="preset-copy">
          <span class="preset-name">
            <template v-if="card.preset">
              {{ CLASS_INFO[card.preset.classId].name }} · 方案 {{ card.number }}
            </template>
            <template v-else>空白方案 {{ card.number }}</template>
          </span>
          <span v-if="card.preset" class="preset-meta">
            <b>{{ card.weaponName }}</b>
            <em v-if="card.elementLabel">{{ card.elementLabel }}</em>
            <em :class="{ broken: card.missingCount > 0 }">
              {{
                card.missingCount > 0 ? `缺少 ${card.missingCount} 件` : `${card.slots.length}/8 件`
              }}
            </em>
          </span>
          <span v-else class="preset-meta">穿好一套后保存，空槽也会被记住</span>
          <span v-if="card.preset" class="slot-dots" aria-hidden="true">
            <i
              v-for="slot in SLOT_ORDER"
              :key="slot"
              :class="{ filled: card.preset.equipmentUids[slot] }"
              :title="SLOT_LABELS[slot]"
            />
          </span>
        </span>
        <span class="preset-actions">
          <button
            type="button"
            class="action save-action"
            :aria-label="`${card.preset ? '覆盖' : '保存'}方案 ${card.number}`"
            @click="saveCurrent(card.id)"
          >
            <Save :size="13" aria-hidden="true" />
            {{ card.preset ? '覆盖' : '保存当前' }}
          </button>
          <button
            v-if="card.preset"
            type="button"
            class="action apply-action"
            :disabled="!card.currentClass || card.missingCount > 0"
            :aria-label="`穿戴方案 ${card.number}`"
            @click="applyPreset(card.id)"
          >
            <Check :size="13" aria-hidden="true" />
            穿戴
          </button>
          <button
            v-if="card.preset"
            type="button"
            class="delete-action"
            :class="{ confirming: confirmDeleteId === card.id }"
            :aria-label="`清空方案 ${card.number}`"
            @click="deletePreset(card.id)"
          >
            <Trash2 :size="13" aria-hidden="true" />
          </button>
        </span>
      </article>
    </div>

    <Transition name="preset-feedback">
      <p v-if="feedback" class="preset-feedback" role="status" aria-live="polite">
        {{ feedback }}
      </p>
    </Transition>
  </section>
</template>

<style scoped>
.preset-panel {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  padding: 16px;
  border: 1px solid rgb(255 255 255 / 82%);
  border-radius: 24px;
  background:
    linear-gradient(
      145deg,
      rgb(255 255 255 / 92%),
      rgb(249 244 255 / 82%) 48%,
      rgb(235 248 255 / 88%)
    ),
    rgb(255 255 255 / 85%);
  box-shadow:
    0 13px 34px rgb(97 105 151 / 13%),
    inset 0 1px 0 white;
  backdrop-filter: blur(18px) saturate(1.15);
}

.preset-glow {
  position: absolute;
  z-index: -1;
  width: 150px;
  height: 150px;
  border-radius: 50%;
  filter: blur(8px);
  opacity: 0.38;
  pointer-events: none;
}

.preset-glow-pink {
  top: -90px;
  left: -30px;
  background: #ffc6de;
}
.preset-glow-blue {
  right: -70px;
  bottom: -90px;
  background: #b9eaff;
}

.preset-head {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
}
.preset-sigil {
  display: grid;
  flex: 0 0 34px;
  height: 34px;
  place-items: center;
  border-radius: 12px;
  color: #fff;
  background: linear-gradient(145deg, #ff9fc3, #9fcdfd);
  box-shadow: 0 7px 15px rgb(237 137 185 / 24%);
}
.preset-heading {
  display: grid;
  min-width: 0;
}
.preset-heading strong {
  color: #51485f;
  font-size: 15px;
  letter-spacing: 0.02em;
}
.preset-heading small {
  margin-top: 2px;
  color: #a496aa;
  font-size: 10px;
}

.auto-switch {
  display: flex;
  min-height: 36px;
  margin-left: auto;
  padding: 6px 8px;
  align-items: center;
  gap: 5px;
  border: 1px solid #eadfea;
  border-radius: 13px;
  color: #948797;
  background: rgb(255 255 255 / 65%);
  font-size: 10px;
  transition:
    transform 140ms ease,
    border-color 160ms ease,
    background 160ms ease;
}
.auto-switch i {
  position: relative;
  width: 26px;
  height: 15px;
  border-radius: 9px;
  background: #e8e1ea;
}
.auto-switch i b {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: white;
  box-shadow: 0 1px 4px rgb(80 65 90 / 18%);
  transition: transform 180ms ease;
}
.auto-switch.on {
  color: #b14f82;
  border-color: #ffc2dc;
  background: #fff4f9;
}
.auto-switch.on i {
  background: linear-gradient(90deg, #ffa6c8, #a8d8ff);
}
.auto-switch.on i b {
  transform: translateX(11px);
}
.auto-switch:disabled {
  opacity: 0.45;
}

.preset-tip {
  display: flex;
  margin: 11px 0 12px;
  align-items: flex-start;
  gap: 6px;
  color: #8d8195;
  font-size: 10px;
  line-height: 1.45;
}
.preset-tip svg {
  flex: 0 0 auto;
  margin-top: 1px;
  color: #76bea9;
}
.preset-list {
  display: grid;
  gap: 8px;
}

.preset-card {
  display: grid;
  grid-template-columns: 24px 44px minmax(0, 1fr) auto;
  min-height: 76px;
  padding: 9px 9px 9px 7px;
  align-items: center;
  gap: 7px;
  border: 1px solid rgb(226 211 230 / 78%);
  border-radius: 18px;
  background: linear-gradient(110deg, rgb(255 255 255 / 82%), rgb(255 246 251 / 72%));
  box-shadow:
    inset 0 1px 0 white,
    0 5px 14px rgb(112 94 131 / 7%);
}
.preset-card.empty {
  border-style: dashed;
  background: rgb(255 255 255 / 55%);
}
.preset-card.foreign {
  background: linear-gradient(110deg, rgb(250 249 252 / 82%), rgb(242 248 253 / 72%));
}
.preset-number {
  color: #d1bcca;
  font-size: 11px;
  font-weight: 800;
  text-align: center;
}
.weapon-orb {
  display: grid;
  width: 44px;
  height: 44px;
  place-items: center;
  overflow: hidden;
  border: 1px solid #f3cddd;
  border-radius: 15px;
  background: linear-gradient(145deg, #fff8fb, #eef8ff);
  box-shadow: inset 0 0 0 3px rgb(255 255 255 / 70%);
}
.weapon-orb img {
  width: 39px;
  height: 39px;
  object-fit: contain;
}
.weapon-orb.placeholder {
  color: #c4b7c7;
  border-color: #e6dfe8;
}
.preset-copy {
  display: grid;
  min-width: 0;
  gap: 3px;
}
.preset-name {
  overflow: hidden;
  color: #574c60;
  font-size: 12px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.preset-meta {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  color: #a093a5;
  font-size: 9px;
  font-style: normal;
}
.preset-meta b {
  max-width: 100%;
  overflow: hidden;
  color: #817185;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.preset-meta em {
  padding: 2px 5px;
  border-radius: 7px;
  color: #8e7c91;
  background: #f4edf5;
  font-style: normal;
}
.preset-meta em.broken {
  color: #bd5b72;
  background: #fff0f3;
}
.slot-dots {
  display: flex;
  gap: 3px;
}
.slot-dots i {
  width: 6px;
  height: 3px;
  border-radius: 3px;
  background: #e5dee7;
}
.slot-dots i.filled {
  background: linear-gradient(90deg, #f5a4c2, #93cef4);
  box-shadow: 0 0 5px rgb(241 156 192 / 35%);
}
.preset-actions {
  display: grid;
  grid-template-columns: minmax(52px, auto) 48px 30px;
  align-items: center;
  gap: 4px;
}
.action,
.delete-action {
  min-height: 38px;
  border-radius: 11px;
  font-size: 9px;
  transition:
    transform 130ms ease,
    box-shadow 160ms ease,
    background 160ms ease;
}
.action {
  display: inline-flex;
  padding: 6px 7px;
  align-items: center;
  justify-content: center;
  gap: 3px;
  border: 1px solid #f0d8e3;
  color: #966a81;
  background: rgb(255 255 255 / 76%);
}
.apply-action {
  border-color: #bae7e1;
  color: #448f88;
  background: #effbf9;
}
.action:disabled {
  opacity: 0.4;
}
.delete-action {
  display: grid;
  width: 30px;
  padding: 0;
  place-items: center;
  border: 1px solid transparent;
  color: #bcaebd;
  background: transparent;
}
.delete-action.confirming {
  color: #c75874;
  border-color: #ffc8d5;
  background: #fff0f4;
  animation: preset-warn 480ms ease both;
}
.auto-switch:active:not(:disabled),
.action:active:not(:disabled),
.delete-action:active:not(:disabled) {
  transform: scale(0.96);
}
.preset-feedback {
  margin: 10px 1px 0;
  padding: 8px 10px;
  border-radius: 11px;
  color: #866478;
  background: rgb(255 241 247 / 82%);
  font-size: 10px;
  line-height: 1.4;
}
.preset-feedback-enter-active,
.preset-feedback-leave-active {
  transition:
    opacity 160ms ease,
    transform 160ms ease;
}
.preset-feedback-enter-from,
.preset-feedback-leave-to {
  opacity: 0;
  transform: translateY(-3px);
}

@keyframes preset-warn {
  50% {
    transform: scale(1.08);
  }
}

@media (max-width: 350px) {
  .preset-panel {
    padding: 13px 11px;
    border-radius: 20px;
  }
  .auto-switch span {
    display: none;
  }
  .preset-card {
    grid-template-columns: 19px 38px minmax(0, 1fr);
    padding: 8px 7px 9px 5px;
  }
  .weapon-orb {
    width: 38px;
    height: 38px;
    border-radius: 13px;
  }
  .weapon-orb img {
    width: 34px;
    height: 34px;
  }
  .preset-actions {
    grid-column: 2 / -1;
    grid-template-columns: 1fr 1fr 34px;
    width: 100%;
  }
  .action,
  .delete-action {
    min-height: 40px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .auto-switch i b,
  .auto-switch,
  .action,
  .delete-action,
  .preset-feedback-enter-active,
  .preset-feedback-leave-active {
    transition: none;
  }
  .delete-action.confirming {
    animation: none;
  }
}
</style>
