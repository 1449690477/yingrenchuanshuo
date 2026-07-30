<script setup lang="ts">
/**
 * 烙印台（docs/58 附录 B · B-1）：选套装 → 选装备 → 选支付方式 → 确认。
 *
 * 数据一律走 store 契约（evaluateImprint / imprintEquipment /
 * unlockedImprintSetIds），UI 不复算任何校验（docs/57 §四的口径纪律）。
 *
 * 红线（docs/40）：
 *   - 材料不足只给「还差 N 个 —— 今日副本还有 X 次」指路，不给购买入口
 *   - 确认页写明「品质、词条、强化全部保留」——玩家最怕被偷改
 */
import { computed, nextTick, ref, watch } from 'vue';
import { Check, ChevronRight, Gem, LockKeyhole, ShieldCheck, Sparkles, X } from '@lucide/vue';
import type { ClassId, EquipmentInstance, EquipSlot, Quality } from '@/core/types';
import type { ImprintCost } from '@/core/equipmentImprint';
import { QUALITY_LABELS, QUALITY_RANK, SLOT_LABELS, SLOT_ORDER } from '@/data/constants';
import { requireEquipment } from '@/data/equipment';
import { equipmentDisplayPresentation } from '@/data/equipmentPresentation';
import { EQUIPMENT_DUNGEON_TIERS } from '@/data/equipmentDungeonGear';
import { requireEquipmentDungeonSet } from '@/data/equipmentDungeonSets';
import {
  IMPRINTABLE_SET_IDS,
  IMPRINT_SET_TIER,
  type ImprintableSetId,
} from '@/data/imprintRules';
import { useGameStore } from '@/stores/game';
import EquipmentIcon from '@/components/EquipmentIcon.vue';
import SystemArtwork from '@/components/SystemArtwork.vue';
import {
  IMPRINT_CORE_DISPLAY,
  IMPRINT_CRYSTAL_DISPLAY,
  imprintMaterialIconUrl,
} from './imprintDisplay';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const game = useGameStore();

const selectedSetId = ref<ImprintableSetId>(IMPRINTABLE_SET_IDS[0]);
const selectedUid = ref<string | null>(null);
const useCore = ref(false);
const justImprinted = ref<{ equipName: string; setName: string } | null>(null);
const closeButton = ref<HTMLButtonElement | null>(null);

const classId = computed<ClassId>(() => {
  const current = game.save?.player.classId;
  if (!current) throw new Error('[烙印台错误] 存档未载入，无法解析装备职业外观');
  return current;
});

interface SetCard {
  setId: ImprintableSetId;
  name: string;
  tierShortName: string;
  color: string;
  crystalName: string;
  unlocked: boolean;
  bonusLabels: readonly string[];
}

const setCards = computed<SetCard[]>(() =>
  IMPRINTABLE_SET_IDS.map((setId) => {
    const definition = requireEquipmentDungeonSet(setId);
    const tierId = IMPRINT_SET_TIER[setId];
    const tier = EQUIPMENT_DUNGEON_TIERS.find((candidate) => candidate.id === tierId);
    return {
      setId,
      name: definition.name,
      tierShortName: tier?.shortName ?? '',
      color: tier?.color ?? '#8fb8ff',
      crystalName: IMPRINT_CRYSTAL_DISPLAY[tierId].name,
      unlocked: game.unlockedImprintSetIds.includes(setId),
      bonusLabels: definition.bonuses.map((bonus) => `${bonus.pieces} 件 · ${bonus.label}`),
    };
  }),
);

/** 已解锁的套装里默认选第一个，避免玩家开局点中锁定卡 */
const firstUnlockedSetId = computed(
  () => setCards.value.find((card) => card.unlocked)?.setId ?? null,
);

interface CandidateRow {
  inst: EquipmentInstance;
  name: string;
  quality: Quality;
  slot: EquipSlot;
  level: number;
  worn: boolean;
  imprintedSetName: string | null;
}

const CANDIDATE_CAP = 40;

/**
 * 候选 = 背包 + 穿戴中，按身份条件过滤（定义级套装/固定模板/
 * 待确认洗练/已烙同款）。材料与金币不满足不在这里过滤 ——
 * 那是成本面板的事，别让玩家以为装备「不能烙」。
 */
const allCandidates = computed<CandidateRow[]>(() => {
  const save = game.save;
  if (!save) return [];
  const rows: CandidateRow[] = [];
  const push = (inst: EquipmentInstance, worn: boolean): void => {
    const definition = requireEquipment(inst.defId);
    if (definition.setId) return;
    if (definition.fixedTemplate) return;
    if (inst.pendingAffixChange) return;
    if (inst.imprintSetId === selectedSetId.value) return;
    rows.push({
      inst,
      name: equipmentDisplayPresentation(definition, classId.value).name,
      quality: definition.quality,
      slot: definition.slot,
      level: definition.level,
      worn,
      imprintedSetName: inst.imprintSetId
        ? requireEquipmentDungeonSet(inst.imprintSetId).name
        : null,
    });
  };
  for (const inst of save.bag.equipment) push(inst, false);
  for (const slot of SLOT_ORDER) {
    const worn = save.equipped[slot];
    if (worn) push(worn, true);
  }
  return rows.sort(
    (a, b) =>
      QUALITY_RANK[b.quality] - QUALITY_RANK[a.quality] ||
      b.inst.enhance - a.inst.enhance ||
      b.inst.baseRollPermille - a.inst.baseRollPermille,
  );
});

const candidates = computed(() => allCandidates.value.slice(0, CANDIDATE_CAP));

const selectedRow = computed(
  () => allCandidates.value.find((row) => row.inst.uid === selectedUid.value) ?? null,
);

const evaluation = computed(() =>
  selectedUid.value
    ? game.evaluateImprint(selectedUid.value, selectedSetId.value, useCore.value)
    : null,
);

const selectedSetCard = computed(
  () => setCards.value.find((card) => card.setId === selectedSetId.value) ?? null,
);

/** 各 reason 的人话指路文案（docs/58 附录 B · B-1 验收：全分支覆盖） */
const REASON_COPY: Record<string, string> = {
  'set-not-imprintable': '这个套装不能烙印',
  'set-locked': '首通该档任意入口后，这套装备图纸才会解锁',
  'def-set-conflict': '这件装备自带套装身份，不能再烙印别的套装',
  'fixed-template': '心虹珍藏是固定模板，不能烙印',
  'pending-affix': '有未确认的洗练候选——先去洗练坊处理完再烙印',
  'already-imprinted-same': '这件装备已经烙着这个套装了',
};

interface MaterialLine {
  key: string;
  name: string;
  iconUrl: string;
  need: number;
  owned: number;
}

const materialLines = computed<MaterialLine[]>(() => {
  const cost = evaluation.value?.cost;
  if (!cost || !cost.crystalId) return [];
  const lines: MaterialLine[] = [
    {
      key: 'crystal',
      name: crystalNameOf(cost),
      iconUrl: imprintMaterialIconUrl(cost.crystalId),
      need: cost.crystals,
      owned: evaluation.value?.owned.crystals ?? 0,
    },
  ];
  if (cost.cores > 0) {
    lines.push({
      key: 'core',
      name: IMPRINT_CORE_DISPLAY.name,
      iconUrl: imprintMaterialIconUrl(cost.coreId),
      need: cost.cores,
      owned: evaluation.value?.owned.cores ?? 0,
    });
  }
  return lines;
});

function crystalNameOf(cost: ImprintCost): string {
  const found = Object.values(IMPRINT_CRYSTAL_DISPLAY).find(
    (display) => display.id === cost.crystalId,
  );
  return found?.name ?? '烙印晶';
}

/** 材料缺口：取差得最多的那一种写进指路文案 */
const materialShortage = computed(() => {
  let worst: { name: string; lack: number } | null = null;
  for (const line of materialLines.value) {
    const lack = line.need - line.owned;
    if (lack > 0 && (!worst || lack > worst.lack)) worst = { name: line.name, lack };
  }
  return worst;
});

const goldShortage = computed(() => {
  const current = evaluation.value;
  if (!current) return 0;
  return Math.max(0, current.cost.gold - current.owned.gold);
});

const reasonCopy = computed(() => {
  const current = evaluation.value;
  if (!current || current.ok) return '';
  if (current.reason === 'materials' && materialShortage.value) {
    return `还差 ${materialShortage.value.lack} 个${materialShortage.value.name} —— 今日副本还有 ${game.equipmentDungeonRemaining} 次`;
  }
  if (current.reason === 'gold') {
    return `金币不足 —— 还差 ${goldShortage.value}，挂机一会儿就够了`;
  }
  return REASON_COPY[current.reason] ?? '暂时不能烙印';
});

const confirmDisabled = computed(() => !evaluation.value?.ok);

function selectSet(setId: ImprintableSetId): void {
  selectedSetId.value = setId;
  // 换套装后重筛候选（已烙同款的会被新套装放行），已选装备仍然有效就保留
  if (
    selectedUid.value &&
    !allCandidates.value.some((row) => row.inst.uid === selectedUid.value)
  ) {
    selectedUid.value = null;
  }
}

function selectEquipment(uid: string): void {
  selectedUid.value = selectedUid.value === uid ? null : uid;
}

function confirmImprint(): void {
  if (!selectedUid.value || !evaluation.value?.ok) return;
  const equipName = selectedRow.value?.name ?? '';
  const setName = selectedSetCard.value?.name ?? '';
  const done = game.imprintEquipment(selectedUid.value, selectedSetId.value, useCore.value);
  if (done) {
    justImprinted.value = { equipName, setName };
    selectedUid.value = null;
  }
}

function keepGoing(): void {
  justImprinted.value = null;
  void nextTick(() => closeButton.value?.focus());
}

/** 图标 404（codex 正式图标未交付前）时退成首字符占位，不让破图流出 */
function onIconError(event: Event): void {
  const img = event.target as HTMLImageElement;
  img.style.display = 'none';
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    emit('close');
    return;
  }
  if (event.key !== 'Tab') return;
  const sheet = event.currentTarget as HTMLElement;
  const focusables = Array.from(
    sheet.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input, [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((el) => el.offsetParent !== null);
  if (focusables.length === 0) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    justImprinted.value = null;
    if (firstUnlockedSetId.value) selectedSetId.value = firstUnlockedSetId.value;
    void nextTick(() => closeButton.value?.focus());
  },
  { immediate: true },
);
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-pop">
      <div v-if="props.open" class="imprint-overlay" @click.self="emit('close')">
        <section
          class="imprint-sheet"
          role="dialog"
          aria-modal="true"
          aria-labelledby="imprint-title"
          @keydown="onKeydown"
        >
          <header class="imprint-head">
            <SystemArtwork kind="dungeon" class="imprint-art" />
            <span>
              <small>套装烙印</small>
              <h2 id="imprint-title">烙印台</h2>
            </span>
            <button
              ref="closeButton"
              class="imprint-close"
              aria-label="关闭烙印台"
              @click="emit('close')"
            >
              <X :size="18" aria-hidden="true" />
            </button>
          </header>

          <!-- 成功态 -->
          <div v-if="justImprinted" class="imprint-success" role="status">
            <Sparkles :size="30" aria-hidden="true" />
            <strong>烙印成功！</strong>
            <p>
              {{ justImprinted.equipName }} 已烙上「{{ justImprinted.setName }}」，
              品质、词条、强化原样保留。
            </p>
            <div class="success-actions">
              <button type="button" class="ghost-button" @click="keepGoing">继续烙印</button>
              <button type="button" class="primary-button" @click="emit('close')">完成</button>
            </div>
          </div>

          <template v-else>
            <!-- STEP 1 · 选套装 -->
            <section class="bench-block">
              <header class="block-heading">
                <span><small>STEP 1</small><strong>选择套装图纸</strong></span>
                <em>首通对应档任意入口解锁</em>
              </header>
              <div class="set-grid">
                <button
                  v-for="card in setCards"
                  :key="card.setId"
                  type="button"
                  class="set-card"
                  :class="{ active: card.setId === selectedSetId, locked: !card.unlocked }"
                  :style="{ '--set-color': card.color }"
                  :disabled="!card.unlocked"
                  :aria-pressed="card.setId === selectedSetId"
                  :aria-label="
                    card.unlocked ? card.name : `${card.name}，首通${card.tierShortName}档任意入口解锁`
                  "
                  @click="selectSet(card.setId)"
                >
                  <span class="set-name">
                    <LockKeyhole v-if="!card.unlocked" :size="12" aria-hidden="true" />
                    <Gem v-else :size="12" aria-hidden="true" />
                    {{ card.name }}
                  </span>
                  <small v-if="!card.unlocked">首通{{ card.tierShortName }}档解锁</small>
                  <small v-else>{{ card.bonusLabels[0] ?? '' }}</small>
                </button>
              </div>
            </section>

            <!-- STEP 2 · 选装备 -->
            <section class="bench-block">
              <header class="block-heading">
                <span><small>STEP 2</small><strong>选择要烙印的装备</strong></span>
                <em>普通装备才能烙</em>
              </header>
              <p v-if="allCandidates.length === 0" class="empty-copy">
                背包里还没有可烙印的装备——各区域普通掉落的装备都可以烙印；
                套装装、绯焰、圣痕与心虹珍藏自带身份，不能烙。
              </p>
              <div v-else class="equip-list">
                <button
                  v-for="row in candidates"
                  :key="row.inst.uid"
                  type="button"
                  class="equip-row"
                  :class="{ active: row.inst.uid === selectedUid }"
                  :aria-pressed="row.inst.uid === selectedUid"
                  @click="selectEquipment(row.inst.uid)"
                >
                  <EquipmentIcon
                    :def="requireEquipment(row.inst.defId)"
                    :class-id="classId"
                    :enhance="row.inst.enhance"
                    :locked="row.inst.locked"
                    size="sm"
                    decorative
                  />
                  <span class="equip-copy">
                    <strong>{{ row.name }}</strong>
                    <small>
                      {{ QUALITY_LABELS[row.quality] }} · {{ SLOT_LABELS[row.slot] }} · Lv{{
                        row.level
                      }}<template v-if="row.inst.enhance > 0"> · 强化 +{{ row.inst.enhance }}</template>
                    </small>
                  </span>
                  <em v-if="row.worn" class="worn-tag">穿戴中</em>
                  <em v-if="row.imprintedSetName" class="imprinted-tag">
                    已烙 · {{ row.imprintedSetName }}
                  </em>
                  <Check v-if="row.inst.uid === selectedUid" :size="14" class="row-check" />
                </button>
                <p v-if="allCandidates.length > CANDIDATE_CAP" class="more-copy">
                  共 {{ allCandidates.length }} 件可烙印，按品质从高到低显示前 {{ CANDIDATE_CAP }} 件
                </p>
              </div>
            </section>

            <template v-if="selectedRow">
              <!-- STEP 3 · 支付方式 -->
              <section class="bench-block">
                <header class="block-heading">
                  <span><small>STEP 3</small><strong>选择支付方式</strong></span>
                  <em>星纹核给坏运气兜底</em>
                </header>
                <div class="pay-grid" role="group" aria-label="支付方式">
                  <button
                    type="button"
                    :class="{ active: !useCore }"
                    :aria-pressed="!useCore"
                    @click="useCore = false"
                  >
                    <strong>{{ selectedSetCard?.crystalName }} ×6</strong>
                    <small>常规路径</small>
                  </button>
                  <button
                    type="button"
                    :class="{ active: useCore }"
                    :aria-pressed="useCore"
                    @click="useCore = true"
                  >
                    <strong>{{ IMPRINT_CORE_DISPLAY.name }} ×1 + 晶 ×2</strong>
                    <small>兜底路径</small>
                  </button>
                </div>
              </section>

              <!-- 成本与确认 -->
              <section class="cost-card">
                <div class="cost-lines">
                  <span
                    v-for="line in materialLines"
                    :key="line.key"
                    class="cost-line"
                    :class="{ short: line.owned < line.need }"
                  >
                    <span class="mat-icon">
                      <img
                        :src="line.iconUrl"
                        alt=""
                        draggable="false"
                        @error="onIconError"
                      />
                      <i aria-hidden="true">{{ line.name.slice(0, 1) }}</i>
                    </span>
                    {{ line.name }}
                    <b>{{ line.owned }} / {{ line.need }}</b>
                  </span>
                  <span class="cost-line" :class="{ short: goldShortage > 0 }">
                    <span class="mat-icon gold-icon"><i aria-hidden="true">金</i></span>
                    金币
                    <b>{{ evaluation?.owned.gold ?? 0 }} / {{ evaluation?.cost.gold ?? 0 }}</b>
                  </span>
                </div>

                <p class="preserve-copy">
                  <ShieldCheck :size="13" aria-hidden="true" />
                  烙印只写入套装归属 —— 品质、词条、强化全部保留
                </p>
                <p v-if="reasonCopy" class="reason-copy" role="status">{{ reasonCopy }}</p>

                <button
                  type="button"
                  class="primary-button confirm-button"
                  :disabled="confirmDisabled"
                  @click="confirmImprint"
                >
                  <Sparkles :size="15" aria-hidden="true" />
                  确认烙印「{{ selectedSetCard?.name }}」
                  <ChevronRight :size="14" aria-hidden="true" />
                </button>
              </section>
            </template>
            <p v-else-if="allCandidates.length > 0" class="pick-hint" role="status">
              点选一件装备，这里会列出烙印成本
            </p>
          </template>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.imprint-overlay {
  position: fixed;
  inset: 0;
  z-index: 140;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: calc(14px + var(--sat)) 14px calc(14px + var(--sab));
  background: rgb(45 52 68 / 52%);
  backdrop-filter: blur(6px);
}

.imprint-sheet {
  display: grid;
  gap: 12px;
  width: min(100%, 390px);
  max-height: 100%;
  padding: 14px;
  overflow-y: auto;
  color: var(--text);
  background:
    radial-gradient(circle at 12% 0%, rgb(255 210 231 / 38%), transparent 34%),
    linear-gradient(180deg, #fffdfd 0%, #fff7fb 100%);
  border: 1px solid rgb(255 255 255 / 88%);
  border-radius: 24px 24px 18px 18px;
  box-shadow: 0 24px 70px rgb(36 43 60 / 32%);
}

.imprint-head {
  display: grid;
  grid-template-columns: 50px 1fr 44px;
  align-items: center;
  gap: 9px;
}

.imprint-art {
  width: 50px;
  height: 50px;
  filter: drop-shadow(0 6px 10px rgb(100 146 179 / 20%));
}

.imprint-head small {
  display: block;
  margin-bottom: 1px;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--pink-deep);
}

.imprint-head h2 {
  margin: 0;
  font-size: 17px;
}

.imprint-close {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  justify-self: end;
  color: var(--text-mid);
  background: rgb(255 255 255 / 72%);
  border: 1px solid rgb(255 190 215 / 40%);
  border-radius: 12px;
}

.bench-block {
  display: grid;
  gap: 8px;
}

.block-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.block-heading small {
  display: block;
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 0.1em;
  color: var(--pink-deep);
}

.block-heading strong {
  font-size: 12px;
}

.block-heading em {
  font-size: 9px;
  font-style: normal;
  color: var(--text-dim);
}

.set-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 7px;
}

.set-card {
  display: grid;
  gap: 3px;
  padding: 9px 10px;
  text-align: left;
  background: rgb(255 255 255 / 76%);
  border: 1.5px solid color-mix(in srgb, var(--set-color) 30%, white);
  border-radius: 14px;
  transition:
    border-color var(--t-fast) var(--ease-soft),
    box-shadow var(--t-fast) var(--ease-soft);
}

.set-card.active {
  border-color: var(--set-color);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--set-color) 30%, transparent);
}

.set-card.locked {
  opacity: 0.55;
}

.set-name {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 800;
  color: color-mix(in srgb, var(--set-color) 72%, #3a3f52);
}

.set-card small {
  font-size: 9px;
  color: var(--text-dim);
}

.empty-copy,
.more-copy,
.pick-hint {
  margin: 0;
  font-size: 10px;
  line-height: 1.55;
  color: var(--text-dim);
}

.equip-list {
  display: grid;
  gap: 6px;
  max-height: 220px;
  padding-right: 2px;
  overflow-y: auto;
}

.equip-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
  padding: 6px 8px;
  text-align: left;
  background: rgb(255 255 255 / 76%);
  border: 1.5px solid rgb(255 190 215 / 24%);
  border-radius: 13px;
}

.equip-row.active {
  border-color: var(--pink-deep);
  box-shadow: 0 0 0 2px rgb(255 154 204 / 25%);
}

.equip-copy {
  display: grid;
  flex: 1;
  gap: 1px;
  min-width: 0;
}

.equip-copy strong {
  overflow: hidden;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.equip-copy small {
  font-size: 9px;
  color: var(--text-dim);
}

.worn-tag,
.imprinted-tag {
  flex-shrink: 0;
  padding: 2px 6px;
  font-size: 8px;
  font-style: normal;
  border-radius: 999px;
}

.worn-tag {
  color: #2f7d4f;
  background: #dcf5e5;
}

.imprinted-tag {
  color: #7a5bc9;
  background: #ece5ff;
}

.row-check {
  flex-shrink: 0;
  color: var(--pink-deep);
}

.pay-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 7px;
}

.pay-grid button {
  display: grid;
  gap: 2px;
  padding: 8px 10px;
  text-align: left;
  background: rgb(255 255 255 / 76%);
  border: 1.5px solid rgb(255 190 215 / 24%);
  border-radius: 13px;
}

.pay-grid button.active {
  border-color: var(--pink-deep);
  box-shadow: 0 0 0 2px rgb(255 154 204 / 25%);
}

.pay-grid strong {
  font-size: 11px;
}

.pay-grid small {
  font-size: 9px;
  color: var(--text-dim);
}

.cost-card {
  display: grid;
  gap: 9px;
  padding: 11px;
  background:
    radial-gradient(circle at 88% -20%, rgb(190 220 255 / 40%), transparent 42%),
    rgb(255 255 255 / 82%);
  border: 1px solid rgb(255 190 215 / 34%);
  border-radius: 16px;
}

.cost-lines {
  display: grid;
  gap: 6px;
}

.cost-line {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 11px;
}

.cost-line b {
  margin-left: auto;
  font-size: 11px;
}

.cost-line.short b {
  color: #c2463f;
}

.mat-icon {
  position: relative;
  display: grid;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  place-items: center;
  overflow: hidden;
  background: linear-gradient(145deg, #fff, #eef2f6);
  border: 1px solid rgb(160 180 220 / 45%);
  border-radius: 8px;
}

.mat-icon img {
  position: absolute;
  z-index: 1;
  width: 92%;
  height: 92%;
  object-fit: contain;
}

.mat-icon i {
  font-size: 10px;
  font-style: normal;
  font-weight: 800;
  color: #6d7fa0;
}

.gold-icon i {
  color: #b16513;
}

.preserve-copy {
  display: flex;
  align-items: center;
  gap: 5px;
  margin: 0;
  font-size: 10px;
  font-weight: 700;
  color: #2f7d4f;
}

.reason-copy {
  margin: 0;
  font-size: 10px;
  font-weight: 700;
  line-height: 1.5;
  color: #c2463f;
}

.primary-button,
.ghost-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 11px;
  font-size: 13px;
  font-weight: 800;
  border-radius: 14px;
}

.primary-button {
  color: #fff;
  background: linear-gradient(135deg, #ff8bad, #a886ef);
  box-shadow: 0 8px 18px rgb(219 105 157 / 32%);
}

.primary-button:disabled {
  opacity: 0.45;
  box-shadow: none;
}

.ghost-button {
  color: var(--text-mid);
  background: rgb(255 255 255 / 80%);
  border: 1px solid rgb(255 190 215 / 40%);
}

.imprint-success {
  display: grid;
  gap: 8px;
  justify-items: center;
  padding: 22px 12px;
  text-align: center;
}

.imprint-success > svg {
  color: #e0a83c;
}

.imprint-success strong {
  font-size: 15px;
}

.imprint-success p {
  margin: 0;
  font-size: 11px;
  line-height: 1.6;
  color: var(--text-mid);
}

.success-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  width: 100%;
  margin-top: 6px;
}

/* 320×568：列表再矮一点，保证确认区不进二屏 */
@media (max-height: 620px) {
  .equip-list {
    max-height: 150px;
  }

  .imprint-sheet {
    gap: 9px;
  }
}
</style>
