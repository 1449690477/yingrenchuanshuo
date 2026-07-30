<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { ArrowUp, Backpack, Coins, Lock, LockOpen, PackageOpen, ShieldCheck, X } from '@lucide/vue';
import { planBulkDecompose, planBulkLock } from '@/core/bag';
import { decomposeGold } from '@/core/economy';
import { abbr } from '@/core/format';
import type { EquipmentInstance, Quality } from '@/core/types';
import { useInventoryStore } from '@/stores/inventory';
import { usePlayerStore } from '@/stores/player';
import { requireEquipment } from '@/data/equipment';
import { equipmentDisplayPresentation } from '@/data/equipmentPresentation';
import { equipmentAdvancementOption as resolveEquipmentAdvancementOption } from '@/data/equipmentAdvancement';
import { requireItem } from '@/data/items';
import { QUALITY_LABELS, SLOT_LABELS } from '@/data/constants';
import EquipDetail from '@/components/EquipDetail.vue';
import CrimsonForgePanel from '@/components/CrimsonForgePanel.vue';
import EquipmentAdvancementPanel from '@/components/EquipmentAdvancementPanel.vue';
import EquipmentIcon from '@/components/EquipmentIcon.vue';
import ItemIcon from '@/components/ItemIcon.vue';
import SystemArtwork from '@/components/SystemArtwork.vue';
import SetCodexView from '@/views/SetCodexView.vue';
import { buildSetCodex } from '@/components/setCodex/setCodexData';

const inventory = useInventoryStore();
const player = usePlayerStore();
const activeClassId = computed(() => {
  const classId = player.player?.classId;
  if (!classId) throw new Error('[背包错误] 存档未载入，无法解析装备职业外观');
  return classId;
});
const tab = ref<'equip' | 'item'>('equip');
const detail = ref<EquipmentInstance | null>(null);
const advancement = ref<EquipmentInstance | null>(null);
const toast = ref('');
const salvageBurst = ref(false);
const showCodex = ref(false);
/** 全套数（区域 + 副本 + 竞技场）由装配层实算，不写死。 */
const setCodexTotal = computed(() => buildSetCodex(activeClassId.value).length);

function openCodex() {
  showCodex.value = true;
}

function closeCodex() {
  showCodex.value = false;
}
const decomposeOpen = ref(false);
const decomposeSnapshot = ref<EquipmentInstance[]>([]);
const selectedQualities = ref<Quality[]>(['common', 'fine']);
const includeEnhanced = ref(false);
const highRiskConfirmed = ref(false);
const decomposeSheet = ref<HTMLElement | null>(null);
const decomposeCloseButton = ref<HTMLButtonElement | null>(null);
let decomposeReturnFocus: HTMLElement | null = null;

const lockOpen = ref(false);
const lockSnapshot = ref<EquipmentInstance[]>([]);
const lockMode = ref<'lock' | 'unlock'>('lock');
// 默认对齐新的自动上锁门槛（传说及以上），玩家最常做的就是补锁或清理这一档
const lockQualities = ref<Quality[]>(['legendary', 'mythic']);
const lockSheet = ref<HTMLElement | null>(null);
const lockCloseButton = ref<HTMLButtonElement | null>(null);
let lockReturnFocus: HTMLElement | null = null;

const QUALITY_OPTIONS: readonly {
  quality: Quality;
  colorLabel: string;
  hint: string;
}[] = [
  { quality: 'common', colorLabel: '白', hint: '普通' },
  { quality: 'fine', colorLabel: '绿', hint: '精良' },
  { quality: 'rare', colorLabel: '蓝', hint: '稀有' },
  { quality: 'epic', colorLabel: '紫', hint: '史诗' },
  { quality: 'legendary', colorLabel: '橙', hint: '传说' },
  { quality: 'mythic', colorLabel: '红', hint: '神话' },
  { quality: 'prismatic', colorLabel: '虹', hint: '心虹珍藏' },
  { quality: 'divine', colorLabel: '金', hint: '圣器' },
];

const HIGH_RISK_QUALITIES: ReadonlySet<Quality> = new Set([
  'epic',
  'legendary',
  'mythic',
  'prismatic',
  'divine',
]);

/**
 * 滚动分页。
 *
 * 背包可能堆到上万件，一次性渲染成 DOM 会把浏览器卡死（真出过这个事故）。
 * 但早先用「硬上限 150 件」的做法有个明显缺陷：第 151 件之后玩家**根本看不到**，
 * 只能靠一键分解盲操作。
 *
 * 现在改成滚动加载：先渲染一屏，滚到底部再追加一页。
 * 既不会一次性压垮渲染，玩家也能翻到背包里的每一件装备。
 */
const PAGE_SIZE = 60;
const renderCount = ref(PAGE_SIZE);
/** 滚动哨兵，进入视口即加载下一页 */
const sentinel = ref<HTMLElement | null>(null);
let observer: IntersectionObserver | null = null;

/** 装备总数。只读长度，不做任何战力计算。 */
const equipCount = computed(() => inventory.bag?.equipment.length ?? 0);

const bagEquips = computed(() => {
  // 只在装备页激活时才做昂贵的评分与排序
  if (tab.value !== 'equip') return [];
  const list = inventory.bag?.equipment ?? [];
  if (list.length === 0) return [];

  // ⚠ 关键：战力只算一遍。
  // 早先写成 sort((a,b) => scoreOf(b) - scoreOf(a))，
  // 1.5 万件时 sort 会触发约 43 万次战力计算，页面直接假死。
  const scored = list.map((inst) => {
    const def = requireEquipment(inst.defId);
    return {
      inst,
      def,
      presentation: equipmentDisplayPresentation(def, activeClassId.value),
      score: scoreOf(inst),
      // 直接用已经解析出的定义做 O(1) 路线判断；不要为每一行再按 UID 扫描背包。
      canAdvance: Boolean(resolveEquipmentAdvancementOption(def)),
    };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored;
});

/** 当前已渲染的那一批 */
const visibleEquips = computed(() => bagEquips.value.slice(0, renderCount.value));

/** 还没渲染出来的数量 */
const hiddenEquipCount = computed(() => Math.max(0, bagEquips.value.length - renderCount.value));

function loadMore(): void {
  if (hiddenEquipCount.value <= 0) return;
  renderCount.value = Math.min(bagEquips.value.length, renderCount.value + PAGE_SIZE);
}

/** 切页签、清空背包或重新排序后，回到第一页 */
function resetPaging(): void {
  renderCount.value = PAGE_SIZE;
}

watch(tab, resetPaging);
// 背包件数变化（分解、掉落）也要重置，否则 renderCount 会停在旧的大数上
watch(equipCount, resetPaging);

onMounted(() => {
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) loadMore();
    },
    // 提前 200px 触发，滚动时感觉不到加载
    { rootMargin: '200px' },
  );
});

/** 哨兵元素挂载/卸载时接管观察，v-if 会反复创建销毁它 */
watch(sentinel, (el, prev) => {
  if (prev) observer?.unobserve(prev);
  if (el) observer?.observe(el);
});

onUnmounted(() => {
  observer?.disconnect();
  observer = null;
});

const bagItems = computed(() => {
  const items = inventory.bag?.items ?? {};
  return Object.entries(items)
    .filter(([, n]) => n > 0)
    .map(([id, n]) => ({ id, count: n, def: requireItem(id) }))
    .sort((a, b) => b.def.sellPrice - a.def.sellPrice);
});

const snapshotQualityCounts = computed<Record<Quality, number>>(() => {
  const counts: Record<Quality, number> = {
    common: 0,
    fine: 0,
    rare: 0,
    epic: 0,
    legendary: 0,
    mythic: 0,
    prismatic: 0,
    divine: 0,
  };
  for (const inst of decomposeSnapshot.value) {
    counts[requireEquipment(inst.defId).quality]++;
  }
  return counts;
});

const decomposePlan = computed(() =>
  planBulkDecompose(
    decomposeSnapshot.value,
    selectedQualities.value,
    includeEnhanced.value,
    (inst) => requireEquipment(inst.defId).quality,
  ),
);

const decomposeGoldPreview = computed(() =>
  decomposePlan.value.targets.reduce(
    (gold, inst) => gold + decomposeGold(requireEquipment(inst.defId), inst),
    0,
  ),
);

const hasHighRiskSelection = computed(() =>
  selectedQualities.value.some((quality) => HIGH_RISK_QUALITIES.has(quality)),
);

const canConfirmDecompose = computed(
  () =>
    decomposePlan.value.targets.length > 0 &&
    (!hasHighRiskSelection.value || highRiskConfirmed.value),
);

function scoreOf(inst: EquipmentInstance): number {
  return inventory.contributionCp(inst);
}

function openDecompose(event: MouseEvent): void {
  decomposeReturnFocus = event.currentTarget as HTMLElement;
  // 打开时固定一份快照；之后新掉落的装备不会悄悄混进本次确认。
  decomposeSnapshot.value = [...(inventory.bag?.equipment ?? [])];
  includeEnhanced.value = false;
  highRiskConfirmed.value = false;
  decomposeOpen.value = true;
}

function closeDecompose(): void {
  decomposeOpen.value = false;
}

function toggleDecomposeQuality(quality: Quality): void {
  highRiskConfirmed.value = false;
  selectedQualities.value = selectedQualities.value.includes(quality)
    ? selectedQualities.value.filter((entry) => entry !== quality)
    : [...selectedQualities.value, quality];
}

/** 穿戴中的 uid，用于批量解锁时跳过身上的装备。 */
const equippedUids = computed(() => {
  const set = new Set<string>();
  for (const inst of Object.values(inventory.equipped ?? {})) {
    if (inst) set.add(inst.uid);
  }
  return set;
});

const lockQualityCounts = computed<Record<Quality, number>>(() => {
  const counts = Object.fromEntries(QUALITY_OPTIONS.map((option) => [option.quality, 0])) as Record<
    Quality,
    number
  >;
  for (const inst of lockSnapshot.value) {
    counts[requireEquipment(inst.defId).quality]++;
  }
  return counts;
});

const lockPlan = computed(() =>
  planBulkLock(
    lockSnapshot.value,
    lockQualities.value,
    lockMode.value === 'lock',
    (inst) => requireEquipment(inst.defId).quality,
    (inst) => equippedUids.value.has(inst.uid),
  ),
);

function openLock(event: MouseEvent): void {
  lockReturnFocus = event.currentTarget as HTMLElement;
  // 与批量分解同理：打开时固定快照，之后新掉落不会混进本次确认
  lockSnapshot.value = [...(inventory.bag?.equipment ?? [])];
  lockOpen.value = true;
}

function closeLock(): void {
  lockOpen.value = false;
}

function toggleLockQuality(quality: Quality): void {
  lockQualities.value = lockQualities.value.includes(quality)
    ? lockQualities.value.filter((entry) => entry !== quality)
    : [...lockQualities.value, quality];
}

function confirmLock(): void {
  const plan = lockPlan.value;
  if (plan.targets.length === 0) return;
  const wantLocked = lockMode.value === 'lock';
  const changed = inventory.setLockBulk(
    plan.targets.map((inst) => inst.uid),
    wantLocked,
  );
  closeLock();
  show(`已${wantLocked ? '锁定' : '解锁'} ${changed} 件装备`);
}

function onLockKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault();
    closeLock();
    return;
  }
  if (event.key !== 'Tab' || !lockSheet.value) return;
  trapTab(event, lockSheet.value);
}

function confirmDecompose(): void {
  if (!canConfirmDecompose.value) return;

  const targetUids = decomposePlan.value.targets.map((inst) => inst.uid);
  const result = inventory.decompose(targetUids);
  if (result.reason === 'pending-affix-result') {
    closeDecompose();
    show('有装备正在等待确认洗练候选，请先采用或保留候选');
    return;
  }
  closeDecompose();
  if (result.count === 0) {
    show('这些装备已不在背包中');
    return;
  }

  playSalvageBurst();
  show(`分解 ${result.count} 件，获得 ${abbr(result.gold)} 金币`);
}

/** 把 Tab 焦点圈在弹窗内。批量分解与批量锁定共用一份实现。 */
function trapTab(event: KeyboardEvent, sheet: HTMLElement): void {
  const focusable = [
    ...sheet.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ].filter((element) => !element.hasAttribute('hidden'));
  const first = focusable[0];
  const last = focusable.at(-1);
  if (!first || !last) {
    event.preventDefault();
    return;
  }

  const active = document.activeElement;
  if (event.shiftKey && (active === first || !sheet.contains(active))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

function onDecomposeKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault();
    closeDecompose();
    return;
  }
  if (event.key !== 'Tab' || !decomposeSheet.value) return;
  trapTab(event, decomposeSheet.value);
}

function equipBest() {
  const n = inventory.equipBest();
  show(n > 0 ? `已更换 ${n} 个部位` : '当前装备已经是最优了');
}

function openAdvancement(inst: EquipmentInstance): void {
  advancement.value = inst;
}

function onEquipmentUpgraded(result: { targetName: string; cpDelta: number }): void {
  const delta =
    result.cpDelta === 0 ? '' : `，战力 ${result.cpDelta > 0 ? '+' : ''}${abbr(result.cpDelta)}`;
  show(`已升阶为 ${result.targetName}${delta}`);
}

function onCrimsonCrafted(result: { equipmentName: string }): void {
  show(`${result.equipmentName}已重铸完成，放入背包`);
}

let toastTimer = 0;
let effectTimer = 0;
let effectFrame = 0;
function show(msg: string) {
  toast.value = msg;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (toast.value = ''), 2000);
}

function playSalvageBurst() {
  salvageBurst.value = false;
  clearTimeout(effectTimer);
  window.cancelAnimationFrame(effectFrame);
  effectFrame = window.requestAnimationFrame(() => {
    salvageBurst.value = true;
    effectTimer = window.setTimeout(() => (salvageBurst.value = false), 1250);
  });
}

watch(lockOpen, async (open, wasOpen) => {
  if (open) {
    await nextTick();
    lockCloseButton.value?.focus();
  } else if (wasOpen) {
    await nextTick();
    lockReturnFocus?.focus();
    lockReturnFocus = null;
  }
});

watch(decomposeOpen, async (open, wasOpen) => {
  if (open) {
    await nextTick();
    decomposeCloseButton.value?.focus();
  } else if (wasOpen) {
    await nextTick();
    decomposeReturnFocus?.focus();
    decomposeReturnFocus = null;
  }
});

onUnmounted(() => {
  clearTimeout(toastTimer);
  clearTimeout(effectTimer);
  window.cancelAnimationFrame(effectFrame);
});
</script>

<template>
  <div class="bag">
    <div class="tabs">
      <button class="t" :class="{ on: tab === 'equip' }" @click="tab = 'equip'">
        <!-- 用 equipCount 而不是 bagEquips.length：后者会触发全量战力计算，
             而这个标签是常驻渲染的，挂机时每次掉落都会重算一遍 -->
        装备 <span class="n num">{{ equipCount }}</span>
      </button>
      <button class="t" :class="{ on: tab === 'item' }" @click="tab = 'item'">
        材料 <span class="n num">{{ bagItems.length }}</span>
      </button>
    </div>

    <div v-if="tab === 'equip'" class="actions">
      <button class="btn btn-pink sm" @click="equipBest">一键穿戴最优</button>
      <button class="btn btn-plain sm" @click="openLock">批量锁定</button>
      <button class="btn btn-plain sm" @click="openDecompose">批量分解</button>
    </div>

    <div class="list scroll-y" :class="{ 'equip-list': tab === 'equip' }">
      <template v-if="tab === 'equip'">
        <p v-if="equipCount === 0" class="empty">
          <Backpack class="empty-icon" :size="27" :stroke-width="1.8" aria-hidden="true" />
          背包空空的，去挂机打点装备吧～
        </p>
        <div
          v-for="(row, i) in visibleEquips"
          :key="row.inst.uid"
          class="equip-row-shell"
          :class="{ 'has-advance': row.canAdvance }"
          :style="{ '--row-delay': `${Math.min(i, 9) * 32}ms` }"
        >
          <button
            class="row equip-row row-clickable"
            :class="'q-accent-' + row.def.quality"
            :data-equip-uid="row.inst.uid"
            @click="detail = row.inst"
          >
            <EquipmentIcon
              :def="row.def"
              :class-id="activeClassId"
              :enhance="row.inst.enhance"
              :locked="row.inst.locked"
            />
            <span class="mid">
              <span class="name-line">
                <span class="name" :class="'q-' + row.def.quality">
                  {{ row.presentation.name }}
                  <span v-if="row.inst.enhance > 0" class="enh">+{{ row.inst.enhance }}</span>
                </span>
                <span v-if="row.inst.pendingAffixChange" class="pending-affix-badge">
                  洗练待确认
                </span>
              </span>
              <span class="sub">
                {{ SLOT_LABELS[row.def.slot] }} · {{ QUALITY_LABELS[row.def.quality] }} · Lv{{
                  row.def.level
                }}
              </span>
            </span>
            <span class="cp">
              <span class="cp-label">战力</span>
              <span class="num">{{ abbr(row.score) }}</span>
            </span>
          </button>
          <button
            v-if="row.canAdvance"
            type="button"
            class="advance-quick"
            :aria-label="`升阶 ${row.presentation.name}`"
            @click="openAdvancement(row.inst)"
          >
            <ArrowUp :size="16" :stroke-width="2.3" aria-hidden="true" />
            <span>升阶</span>
          </button>
        </div>

        <!--
          滚动哨兵：进入视口即加载下一页。
          放在列表末尾，靠 IntersectionObserver 的 rootMargin 提前 200px 触发，
          玩家滚动时感觉不到分页边界。
        -->
        <div v-if="hiddenEquipCount > 0" ref="sentinel" class="load-more">
          <span class="load-dots" aria-hidden="true"><i /><i /><i /></span>
          <span>正在载入更多（还有 {{ abbr(hiddenEquipCount) }} 件）</span>
        </div>

        <p v-else-if="equipCount > PAGE_SIZE" class="more-hint">
          已显示全部 <b class="num">{{ abbr(equipCount) }}</b> 件。
          <br />
          背包太满会拖慢游戏，建议用上面的「批量分解」按品质清理。
        </p>
      </template>

      <template v-else>
        <section class="set-atlas" aria-labelledby="set-atlas-title">
          <header class="set-atlas-head">
            <span>
              <small>定向套装 · 缺件与来源</small>
              <strong id="set-atlas-title">套装图鉴</strong>
            </span>
            <span class="atlas-side">
              <em>3 套</em>
              <button type="button" class="atlas-all" @click="openCodex">
                全部 {{ setCodexTotal }} 套 →
              </button>
            </span>
          </header>
          <CrimsonForgePanel recipe-id="craft_set_crimson" @crafted="onCrimsonCrafted" />
          <CrimsonForgePanel recipe-id="craft_set_shadow" @crafted="onCrimsonCrafted" />
          <CrimsonForgePanel recipe-id="craft_set_bloodmoon" @crafted="onCrimsonCrafted" />
        </section>
        <p v-if="bagItems.length === 0" class="empty">
          <PackageOpen class="empty-icon" :size="27" :stroke-width="1.8" aria-hidden="true" />
          还没有材料。
        </p>
        <div
          v-for="(it, i) in bagItems"
          :key="it.id"
          class="row static"
          :style="{ '--row-delay': `${Math.min(i, 9) * 32}ms` }"
        >
          <ItemIcon :item="it.def" size="md" />
          <span class="mid">
            <span class="name" :class="'q-' + it.def.tier">
              {{ it.def.name }}
            </span>
            <span class="sub">{{ it.def.desc }}</span>
          </span>
          <span class="cp num">×{{ abbr(it.count) }}</span>
        </div>
      </template>
    </div>

    <Transition name="toast-up">
      <div v-if="toast" class="toast">{{ toast }}</div>
    </Transition>

    <Transition name="salvage-pop">
      <div v-if="salvageBurst" class="salvage-burst" aria-live="polite">
        <SystemArtwork kind="salvage" class="salvage-art" />
        <span class="salvage-copy">星屑回收完成</span>
        <i class="salvage-particle p1" />
        <i class="salvage-particle p2" />
        <i class="salvage-particle p3" />
      </div>
    </Transition>

    <Transition name="modal-pop">
      <EquipDetail v-if="detail" :inst="detail" from="bag" @close="detail = null" />
    </Transition>

    <EquipmentAdvancementPanel
      v-if="advancement"
      :inst="advancement"
      @close="advancement = null"
      @upgraded="onEquipmentUpgraded"
    />

    <Transition name="page-up">
      <SetCodexView v-if="showCodex" @close="closeCodex" />
    </Transition>

    <Teleport to="body">
      <Transition name="modal-pop">
        <div v-if="decomposeOpen" class="overlay decompose-overlay" @click.self="closeDecompose">
          <section
            ref="decomposeSheet"
            class="decompose-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="decompose-title"
            aria-describedby="decompose-note"
            @keydown="onDecomposeKeydown"
          >
            <header class="decompose-head">
              <SystemArtwork kind="salvage" class="decompose-art" />
              <span>
                <small>星屑回收工坊</small>
                <h2 id="decompose-title">批量分解装备</h2>
              </span>
              <button
                ref="decomposeCloseButton"
                class="decompose-close"
                aria-label="关闭批量分解"
                @click="closeDecompose"
              >
                <X :size="18" aria-hidden="true" />
              </button>
            </header>

            <p id="decompose-note" class="decompose-note">
              选择本次要分解的品质。蓝色及以上已开放，但不会默认选中。
            </p>

            <div class="quality-picker" aria-label="选择分解品质">
              <button
                v-for="option in QUALITY_OPTIONS"
                :key="option.quality"
                type="button"
                class="quality-choice"
                :class="[
                  `quality-${option.quality}`,
                  { selected: selectedQualities.includes(option.quality) },
                ]"
                :aria-pressed="selectedQualities.includes(option.quality)"
                @click="toggleDecomposeQuality(option.quality)"
              >
                <i class="quality-dot" aria-hidden="true" />
                <span>
                  <strong>{{ option.colorLabel }}装</strong>
                  <small>{{ option.hint }}</small>
                </span>
                <em class="num">{{ snapshotQualityCounts[option.quality] }}</em>
              </button>
            </div>

            <label class="protection-toggle">
              <input
                v-model="includeEnhanced"
                type="checkbox"
                @change="highRiskConfirmed = false"
              />
              <span>
                <strong>包含已强化装备</strong>
                <small>默认保护所有 +1 及以上装备</small>
              </span>
            </label>

            <div class="protection-copy">
              <ShieldCheck :size="17" aria-hidden="true" />
              <span>
                待确认洗练候选与锁定装备始终保护
                <small>
                  本次跳过 {{ decomposePlan.protectedPending }} 件待确认装备、{{
                    decomposePlan.protectedLocked
                  }}
                  件锁定装备、{{ decomposePlan.protectedEnhanced }}
                  件强化装备
                </small>
              </span>
            </div>

            <label v-if="hasHighRiskSelection" class="risk-confirm">
              <input v-model="highRiskConfirmed" type="checkbox" />
              <span>
                <strong>我确认分解选中的紫 / 橙 / 红 / 虹 / 金装备</strong>
                <small>高品质装备很难获得，请先锁定想保留的装备。</small>
              </span>
            </label>

            <footer class="decompose-preview">
              <span>
                <small>预计回收</small>
                <strong class="num">{{ decomposePlan.targets.length }} 件</strong>
              </span>
              <span class="gold-preview">
                <small>预计获得</small>
                <strong class="num"><Coins :size="14" />{{ abbr(decomposeGoldPreview) }}</strong>
              </span>
              <button
                type="button"
                class="confirm-decompose"
                :disabled="!canConfirmDecompose"
                @click="confirmDecompose"
              >
                {{
                  decomposePlan.targets.length === 0
                    ? '暂无可分解装备'
                    : hasHighRiskSelection && !highRiskConfirmed
                      ? '请先确认高品质风险'
                      : `确认分解 ${decomposePlan.targets.length} 件`
                }}
              </button>
            </footer>
          </section>
        </div>
      </Transition>
    </Teleport>

    <Teleport to="body">
      <Transition name="modal-pop">
        <div v-if="lockOpen" class="overlay decompose-overlay" @click.self="closeLock">
          <section
            ref="lockSheet"
            class="decompose-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lock-title"
            aria-describedby="lock-note"
            @keydown="onLockKeydown"
          >
            <header class="decompose-head">
              <SystemArtwork kind="salvage" class="decompose-art" />
              <span>
                <small>装备保护</small>
                <h2 id="lock-title">批量锁定 / 解锁</h2>
              </span>
              <button
                ref="lockCloseButton"
                class="decompose-close"
                aria-label="关闭批量锁定"
                @click="closeLock"
              >
                <X :size="18" aria-hidden="true" />
              </button>
            </header>

            <p id="lock-note" class="decompose-note">
              锁定的装备不会被批量分解，也不会被背包满时的自动清理带走。
            </p>

            <div class="lock-mode" role="group" aria-label="选择操作">
              <button
                type="button"
                :class="{ active: lockMode === 'lock' }"
                :aria-pressed="lockMode === 'lock'"
                @click="lockMode = 'lock'"
              >
                <Lock :size="15" aria-hidden="true" />
                批量锁定
              </button>
              <button
                type="button"
                :class="{ active: lockMode === 'unlock' }"
                :aria-pressed="lockMode === 'unlock'"
                @click="lockMode = 'unlock'"
              >
                <LockOpen :size="15" aria-hidden="true" />
                批量解锁
              </button>
            </div>

            <div class="quality-picker" aria-label="选择品质">
              <button
                v-for="option in QUALITY_OPTIONS"
                :key="option.quality"
                type="button"
                class="quality-choice"
                :class="[
                  `quality-${option.quality}`,
                  { selected: lockQualities.includes(option.quality) },
                ]"
                :aria-pressed="lockQualities.includes(option.quality)"
                @click="toggleLockQuality(option.quality)"
              >
                <i class="quality-dot" aria-hidden="true" />
                <span>
                  <strong>{{ option.colorLabel }}装</strong>
                  <small>{{ option.hint }}</small>
                </span>
                <em class="num">{{ lockQualityCounts[option.quality] }}</em>
              </button>
            </div>

            <div class="protection-copy">
              <ShieldCheck :size="17" aria-hidden="true" />
              <span>
                传说及以上掉落时已自动锁定
                <small>
                  本次跳过 {{ lockPlan.alreadyInState }} 件已是该状态的装备<template
                    v-if="lockPlan.skippedEquipped > 0"
                  >
                    、{{ lockPlan.skippedEquipped }} 件穿戴中的装备</template
                  >
                </small>
              </span>
            </div>

            <footer class="decompose-preview">
              <span>
                <small>本次{{ lockMode === 'lock' ? '锁定' : '解锁' }}</small>
                <strong class="num">{{ lockPlan.targets.length }} 件</strong>
              </span>
              <button
                type="button"
                class="confirm-decompose"
                :disabled="lockPlan.targets.length === 0"
                @click="confirmLock"
              >
                {{
                  lockPlan.targets.length === 0
                    ? '没有需要改动的装备'
                    : `确认${lockMode === 'lock' ? '锁定' : '解锁'} ${lockPlan.targets.length} 件`
                }}
              </button>
            </footer>
          </section>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.set-atlas {
  grid-column: 1 / -1;
  display: grid;
  gap: 9px;
}

.set-atlas-head {
  display: flex;
  align-items: end;
  justify-content: space-between;
  padding: 2px 4px;
}

.atlas-side {
  display: flex;
  align-items: center;
  gap: 6px;
}

.atlas-side em {
  font-size: 9px;
  font-style: normal;
  color: var(--text-dim);
}

.atlas-all {
  min-height: 32px;
  padding: 4px 12px;
  font-size: 9px;
  font-weight: 800;
  color: #78405f;
  background: #fff;
  border: 1px solid #ffd9e7;
  border-radius: 999px;
  box-shadow: 0 3px 8px rgb(192 74 119 / 12%);
  transition: transform var(--t-fast) var(--ease-spring);
}

.atlas-all:active {
  transform: scale(0.95);
}

.set-atlas-head small,
.set-atlas-head strong {
  display: block;
}

.set-atlas-head small {
  font-size: 8px;
  color: var(--text-dim);
}

.set-atlas-head strong {
  margin-top: 2px;
  font-family: var(--font-display);
  font-size: 14px;
  color: #665362;
}

.set-atlas-head em {
  padding: 4px 8px;
  font-size: 8px;
  font-style: normal;
  font-weight: 800;
  color: #7868ad;
  background: rgb(238 232 255 / 76%);
  border-radius: 999px;
}

.bag {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
  min-height: 0;
  position: relative;
}

.tabs {
  display: flex;
  gap: 6px;
}

.t {
  flex: 1;
  padding: 9px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-mid);
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 999px;
  transition:
    color var(--t-mid) var(--ease-soft),
    border-color var(--t-mid) var(--ease-soft),
    transform var(--t-fast) var(--ease-spring);
}

.t:active {
  transform: scale(0.95);
}

.t.on {
  color: var(--text-on-color);
  background: linear-gradient(135deg, #ffb0d0, var(--pink-deep));
  border-color: transparent;
}

.n {
  font-size: 11px;
  opacity: 0.8;
}

.actions {
  display: flex;
  gap: 6px;
}

.sm {
  flex: 1;
  padding: 8px;
  font-size: 12px;
}

.list {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-auto-rows: min-content;
  align-content: start;
  gap: 6px;
}

.list.equip-list {
  grid-template-columns: 1fr;
  gap: 7px;
}

.load-more {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 18px 12px 26px;
  font-size: 11px;
  color: var(--text-dim);
}

.load-dots {
  display: inline-flex;
  gap: 3px;
}

.load-dots i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--pink);
  animation: load-bounce 1s ease-in-out infinite;
}

.load-dots i:nth-child(2) {
  animation-delay: 0.15s;
}

.load-dots i:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes load-bounce {
  0%,
  100% {
    opacity: 0.3;
    transform: translateY(0);
  }
  50% {
    opacity: 1;
    transform: translateY(-4px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .load-dots i {
    animation: none;
  }
}

.more-hint {
  padding: 14px 12px 22px;
  font-size: 11px;
  line-height: 1.8;
  text-align: center;
  color: var(--text-dim);
}

.more-hint b {
  color: var(--pink-deep);
}

.empty {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 30px 10px;
  font-size: 12px;
  text-align: center;
  color: var(--text-dim);
}

.empty-icon {
  color: var(--pink-deep);
  filter: opacity(85%);
  animation: empty-bob 2.6s ease-in-out infinite;
}

@keyframes empty-bob {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-4px);
  }
}

.row {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 8px;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--r);
  text-align: left;
  animation: row-in var(--t-slow) var(--ease-soft) both;
  animation-delay: var(--row-delay, 0ms);
}

.row.static {
  cursor: default;
}

.equip-row-shell {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 6px;
}

.equip-row-shell.has-advance {
  grid-template-columns: minmax(0, 1fr) 52px;
}

.equip-row {
  width: 100%;
  min-height: 66px;
  padding: 7px 9px;
}

.advance-quick {
  min-width: 0;
  min-height: 66px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 3px;
  padding: 6px 3px;
  font-size: 9px;
  font-weight: 800;
  color: #8d5576;
  background:
    radial-gradient(circle at 50% 9%, rgb(255 255 255 / 92%), transparent 34%),
    linear-gradient(155deg, rgb(255 238 247 / 92%), rgb(232 247 255 / 88%));
  border: 1px solid rgb(226 191 213 / 68%);
  border-radius: var(--r);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 88%),
    0 4px 12px rgb(112 145 174 / 8%);
  animation: row-in var(--t-slow) var(--ease-soft) both;
  animation-delay: var(--row-delay, 0ms);
  transition:
    transform var(--t-fast) var(--ease-spring),
    border-color var(--t-mid) ease,
    box-shadow var(--t-mid) ease;
}

.advance-quick svg {
  padding: 3px;
  color: #fff;
  background: linear-gradient(135deg, #87d8f2, #e88eb8);
  border-radius: 50%;
  box-sizing: content-box;
  box-shadow: 0 4px 9px rgb(217 119 168 / 21%);
}

.advance-quick:active {
  border-color: rgb(220 139 181 / 72%);
  box-shadow: inset 0 2px 7px rgb(127 95 127 / 12%);
  transform: scale(0.93) rotate(-1deg);
}

/* 左边品质色条让玩家不打开详情也能快速筛选稀有装备。 */
.q-accent-common {
  box-shadow: inset 3px 0 0 var(--q-common);
}

.q-accent-fine {
  box-shadow: inset 3px 0 0 var(--q-fine);
}

.q-accent-rare {
  box-shadow: inset 3px 0 0 var(--q-rare);
}

.q-accent-epic {
  box-shadow: inset 3px 0 0 var(--q-epic);
}

.q-accent-legendary {
  box-shadow: inset 3px 0 0 var(--q-legendary);
}

.q-accent-mythic {
  box-shadow: inset 3px 0 0 var(--q-mythic);
}

.q-accent-prismatic {
  box-shadow:
    inset 3px 0 0 var(--q-prismatic),
    inset 0 1px 0 rgb(86 190 241 / 20%);
}

.q-accent-divine {
  box-shadow: inset 3px 0 0 var(--q-divine);
}

.mid {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.name-line {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 5px;
}

.name {
  flex: 1;
  min-width: 0;
  font-size: 11px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pending-affix-badge {
  flex: none;
  padding: 1px 5px;
  font-size: 8px;
  font-weight: 700;
  line-height: 1.4;
  color: #8c4b00;
  background: rgb(255 211 105 / 35%);
  border: 1px solid rgb(232 164 32 / 45%);
  border-radius: 999px;
}

.enh {
  font-size: 11px;
  color: var(--q-legendary);
}

.sub {
  font-size: 9px;
  color: var(--text-dim);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cp {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 1px;
  font-size: 10px;
  font-weight: 700;
  color: var(--blue-deep);
}

.cp-label {
  font-size: 8px;
  font-weight: 500;
  color: var(--text-dim);
}

.toast {
  position: absolute;
  left: 50%;
  bottom: 16px;
  transform: translateX(-50%);
  padding: 9px 16px;
  font-size: 12px;
  color: #fff;
  background: rgb(70 89 107 / 92%);
  border-radius: 999px;
  white-space: nowrap;
  z-index: 20;
}

.salvage-burst {
  position: absolute;
  top: 42%;
  left: 50%;
  z-index: 25;
  width: 174px;
  height: 174px;
  display: grid;
  place-items: center;
  pointer-events: none;
  transform: translate(-50%, -50%);
  filter: drop-shadow(0 12px 22px rgb(74 111 142 / 24%));
}

.salvage-art {
  width: 148px;
  height: 148px;
}

.salvage-copy {
  position: absolute;
  bottom: -6px;
  padding: 5px 12px;
  font-size: 10px;
  font-weight: 800;
  color: #fff;
  background: linear-gradient(120deg, var(--blue-deep), var(--pink-deep));
  border: 2px solid #fff;
  border-radius: 999px;
  box-shadow: var(--shadow);
}

.salvage-particle {
  position: absolute;
  width: 7px;
  height: 7px;
  background: #ffb6d2;
  border: 1px solid #fff;
  transform: rotate(45deg);
  box-shadow: 0 0 8px #ff9dc2;
}

.p1 {
  top: 20px;
  left: 17px;
}

.p2 {
  top: 8px;
  right: 23px;
  background: #8ce5f7;
}

.p3 {
  right: 7px;
  bottom: 35px;
  background: #ffd476;
}

.salvage-pop-enter-active {
  animation: salvage-in 0.32s cubic-bezier(0.2, 1.5, 0.4, 1);
}

.salvage-pop-leave-active {
  transition:
    opacity 0.22s,
    transform 0.22s;
}

.salvage-pop-leave-to {
  opacity: 0;
  transform: translate(-50%, -54%) scale(0.92);
}

.decompose-overlay {
  position: fixed;
  z-index: 140;
  align-items: end;
  padding: calc(14px + var(--sat)) 14px calc(14px + var(--sab));
  background: rgb(45 52 68 / 52%);
  backdrop-filter: blur(6px);
}

.decompose-sheet {
  width: min(100%, 390px);
  max-height: 100%;
  overflow-y: auto;
  padding: 14px;
  color: var(--text);
  background:
    radial-gradient(circle at 12% 0%, rgb(255 210 231 / 38%), transparent 34%),
    linear-gradient(180deg, #fffdfd 0%, #fff7fb 100%);
  border: 1px solid rgb(255 255 255 / 88%);
  border-radius: 24px 24px 18px 18px;
  box-shadow: 0 24px 70px rgb(36 43 60 / 32%);
}

.decompose-head {
  display: grid;
  grid-template-columns: 50px 1fr 44px;
  align-items: center;
  gap: 9px;
}

.decompose-art {
  width: 50px;
  height: 50px;
  filter: drop-shadow(0 6px 10px rgb(100 146 179 / 20%));
}

.decompose-head span {
  min-width: 0;
}

.decompose-head small {
  display: block;
  margin-bottom: 1px;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--pink-deep);
}

.decompose-head h2 {
  margin: 0;
  font-size: 17px;
  color: var(--text);
}

.decompose-close {
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  color: var(--text-mid);
  background: rgb(255 255 255 / 78%);
  border: 1px solid var(--line);
  border-radius: 50%;
}

.decompose-note {
  margin: 8px 1px 10px;
  font-size: 11px;
  line-height: 1.55;
  color: var(--text-dim);
}

.quality-picker {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 7px;
}

.quality-choice {
  min-width: 0;
  min-height: 44px;
  display: grid;
  grid-template-columns: 10px 1fr auto;
  align-items: center;
  gap: 7px;
  padding: 8px 9px;
  text-align: left;
  color: var(--text-mid);
  background: rgb(255 255 255 / 72%);
  border: 1px solid var(--line);
  border-radius: 12px;
  transition:
    transform var(--t-fast) var(--ease-spring),
    border-color var(--t-mid) ease,
    box-shadow var(--t-mid) ease;
}

.quality-choice:active {
  transform: scale(0.96);
}

.lock-mode {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 10px;
}

.lock-mode button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 9px 6px;
  color: var(--text-mid);
  font-size: 12px;
  font-weight: 700;
  background: rgb(255 255 255 / 70%);
  border: 1px solid var(--line);
  border-radius: 11px;
}

.lock-mode button.active {
  color: #8d4770;
  background: linear-gradient(160deg, #fff0f7, #f2f8ff);
  border-color: #edb8d3;
}

.quality-choice.selected {
  color: var(--text);
  border-color: var(--quality-color);
  box-shadow:
    inset 0 0 0 1px var(--quality-color),
    0 5px 14px color-mix(in srgb, var(--quality-color) 17%, transparent);
}

.quality-choice > span {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.quality-choice strong {
  font-size: 11px;
}

.quality-choice small {
  font-size: 8px;
  color: var(--text-dim);
}

.quality-choice em {
  min-width: 24px;
  padding: 2px 5px;
  font-size: 9px;
  font-style: normal;
  text-align: center;
  color: var(--text-dim);
  background: rgb(242 241 247 / 88%);
  border-radius: 999px;
}

.quality-dot {
  width: 9px;
  height: 9px;
  background: var(--quality-color);
  border: 1px solid rgb(255 255 255 / 88%);
  border-radius: 50%;
  box-shadow: 0 0 8px var(--quality-color);
}

.quality-common {
  --quality-color: var(--q-common);
}

.quality-fine {
  --quality-color: var(--q-fine);
}

.quality-rare {
  --quality-color: var(--q-rare);
}

.quality-epic {
  --quality-color: var(--q-epic);
}

.quality-legendary {
  --quality-color: var(--q-legendary);
}

.quality-mythic {
  --quality-color: var(--q-mythic);
}

.quality-prismatic {
  --quality-color: var(--q-prismatic);
}

.quality-prismatic .quality-dot {
  background: var(--q-prismatic-gradient);
}

.quality-divine {
  --quality-color: var(--q-divine);
}

.protection-toggle,
.risk-confirm {
  margin-top: 9px;
  display: flex;
  align-items: flex-start;
  gap: 9px;
  padding: 9px 10px;
  font-size: 11px;
  color: var(--text);
  background: rgb(255 255 255 / 68%);
  border: 1px solid var(--line);
  border-radius: 12px;
}

.protection-toggle input,
.risk-confirm input {
  width: 16px;
  height: 16px;
  flex: 0 0 auto;
  margin: 1px 0 0;
  accent-color: var(--pink-deep);
}

.protection-toggle span,
.risk-confirm span {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.protection-toggle small,
.risk-confirm small,
.protection-copy small {
  font-size: 9px;
  line-height: 1.4;
  color: var(--text-dim);
}

.protection-copy {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 7px;
  padding: 7px 9px;
  font-size: 10px;
  font-weight: 700;
  color: var(--blue-deep);
  background: rgb(231 248 253 / 72%);
  border-radius: 10px;
}

.protection-copy > span {
  display: flex;
  flex-direction: column;
}

.risk-confirm {
  color: #8d3f59;
  background: rgb(255 237 243 / 84%);
  border-color: rgb(239 144 177 / 42%);
}

.decompose-preview {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 7px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--line);
}

.decompose-preview > span {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 7px 9px;
  background: rgb(255 255 255 / 72%);
  border-radius: 10px;
}

.decompose-preview small {
  font-size: 8px;
  color: var(--text-dim);
}

.decompose-preview strong {
  font-size: 12px;
}

.gold-preview {
  align-items: flex-end;
}

.gold-preview strong {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #b87c15;
}

.confirm-decompose {
  grid-column: 1 / -1;
  min-height: 44px;
  padding: 9px 12px;
  font-size: 12px;
  font-weight: 800;
  color: #fff;
  background: linear-gradient(135deg, var(--blue-deep), var(--pink-deep));
  border: 0;
  border-radius: 13px;
  box-shadow: 0 8px 18px rgb(223 105 155 / 22%);
}

.confirm-decompose:disabled {
  color: var(--text-dim);
  background: #eceaf0;
  box-shadow: none;
}

@keyframes salvage-in {
  from {
    opacity: 0;
    transform: translate(-50%, -44%) scale(0.52) rotate(-8deg);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1) rotate(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .salvage-pop-enter-active {
    animation: none;
  }

  .empty-icon {
    animation: none;
  }

  .quality-choice {
    transition: none;
  }

  .advance-quick {
    animation: none;
    transition: none;
  }
}
</style>
