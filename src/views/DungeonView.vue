<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import {
  CalendarDays,
  Check,
  ChevronDown,
  Crown,
  Gem,
  Hourglass,
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
import {
  CLASS_INFO,
  EQUIPMENT_BASE_ROLL_TIERS,
  QUALITY_LABELS,
  SLOT_LABELS,
} from '@/data/constants';
import { requireEquipment } from '@/data/equipment';
import { equipmentDisplayPresentation } from '@/data/equipmentPresentation';
import {
  EQUIPMENT_DUNGEON_PORTALS,
  equipmentDungeonDropsForClass,
  equipmentDungeonStagesForSlot,
} from '@/data/equipmentDungeons';
import {
  EQUIPMENT_DUNGEON_TIERS,
  type EquipmentDungeonTier,
  type EquipmentDungeonTierId,
} from '@/data/equipmentDungeonGear';
import { EQUIPMENT_DUNGEON_RULES } from '@/data/equipmentDungeonRules';
import { requireEquipmentDungeonSet } from '@/data/equipmentDungeonSets';
import { emptyEquipped } from '@/save/schema';
import { useGameStore, type EquipmentDungeonRunResult } from '@/stores/game';
import EquipmentDungeonBattle from '@/components/EquipmentDungeonBattle.vue';
import EquipmentIcon from '@/components/EquipmentIcon.vue';
import SystemArtwork from '@/components/SystemArtwork.vue';
import CollapsibleCard from '@/components/CollapsibleCard.vue';
import ImprintBench from '@/components/imprint/ImprintBench.vue';
import {
  IMPRINT_CORE_DISPLAY,
  IMPRINT_CRYSTAL_DISPLAY,
  imprintMaterialIconUrl,
} from '@/components/imprint/imprintDisplay';
import { IMPRINT_BATCH_ACTIVE } from '@/ui/imprintActivation';
import { prefersCompactLayout, useFold } from '@/ui/useFold';
import DungeonDepthPanel from '@/components/dungeon/DungeonDepthPanel.vue';
import { DEPTH_PER_TIER, EQUIPMENT_DUNGEON_DEPTH_ANCHORS } from '@/data/equipmentDungeonDepthRules';
import { DUNGEON_DEPTH_UI_ACTIVE } from '@/ui/dungeonDepthActivation';

type PlayedResult = Extract<EquipmentDungeonRunResult, { ok: true }>;

const game = useGameStore();
const selectedSlot = ref<EquipSlot>('weapon');
const selectedTierId = ref<EquipmentDungeonTierId>('azure');
const battleResult = ref<PlayedResult | null>(null);
const challengeButton = ref<HTMLButtonElement | null>(null);
const notice = ref('');
const pendingNotice = ref('');
const systemReduceMotion = ref(false);
let motionPreference: MediaQueryList | null = null;

/**
 * 第三轮折叠化：矮屏默认把低频配置区收起来，让关卡卡尽量进首屏。
 * 挑战配置（STEP1+2）与未来计划用 CollapsibleCard；
 * 套装/掉落块有自己的渐变视觉，用 useFold 只折叠内容、不套卡壳。
 */
const compactLayout = prefersCompactLayout();
const configDefaultOpen = !compactLayout;
const dropsDefaultOpen = !compactLayout;
const { open: setOpen, toggle: toggleSetFold } = useFold('dungeon.set', !compactLayout);
const { open: dropOpen, toggle: toggleDropFold } = useFold('dungeon.drops', dropsDefaultOpen);

const planned = [
  {
    name: '日常材料副本',
    when: '筹备中',
    desc: '周一到周日轮换，定向刷强化材料',
    icon: CalendarDays,
  },
  { name: '无尽塔', when: '筹备中', desc: '爬塔，层数上排行榜', icon: TowerControl },
  {
    name: '世界 BOSS',
    when: '筹备中',
    desc: '每日定时两场，全服伤害排名',
    icon: Crown,
  },
  {
    name: '公会团本',
    when: '筹备中',
    desc: '成员各自打，伤害累加到共享血条',
    icon: UsersRound,
  },
] as const;

const portal = computed(() =>
  EQUIPMENT_DUNGEON_PORTALS.find((candidate) => candidate.slot === selectedSlot.value)!,
);
const slotStages = computed(() => equipmentDungeonStagesForSlot(selectedSlot.value));
const stage = computed(() =>
  slotStages.value.find((candidate) => candidate.tierId === selectedTierId.value)!,
);
const playerLevel = computed(() => game.player?.level ?? 1);
const classId = computed(() => {
  const currentClassId = game.player?.classId;
  if (!currentClassId) throw new Error('[装备副本错误] 存档未载入，无法解析装备职业外观');
  return currentClassId;
});
const dungeonState = computed(() => game.save?.equipmentDungeon ?? null);
const equipped = computed(() => game.save?.equipped ?? emptyEquipped());
const reduceMotion = computed(() => game.save?.settings.reduceMotion ?? false);
const effectiveReduceMotion = computed(() => reduceMotion.value || systemReduceMotion.value);
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
const currentTier = computed(() =>
  EQUIPMENT_DUNGEON_TIERS.find((tier) => tier.id === selectedTierId.value)!,
);

/**
 * K5（docs/57）：crimson 档「区域 7 开放后解锁」。
 * comingSoon 标记由 claude 在 equipmentDungeonGear.ts 的 EQUIPMENT_DUNGEON_TIERS 添加；
 * 防御式读取，字段落地后自动生效。敬请期待卡不显示门槛数字、不可点击——
 * 下调门槛会让神话品质提前两个版本出现，打乱阶梯（docs/56 方案⑥）。
 */
function tierComingSoon(tierId: EquipmentDungeonTierId): boolean {
  const tier = EQUIPMENT_DUNGEON_TIERS.find((candidate) => candidate.id === tierId);
  return Boolean(tier && (tier as EquipmentDungeonTier & { comingSoon?: boolean }).comingSoon);
}
const currentSet = computed(() => requireEquipmentDungeonSet(currentTier.value.setId));
const currentSetProgress = computed(
  () =>
    game.equipmentSetResolution.sets.find(
      (activeSet) => activeSet.definition.id === currentSet.value.id,
    )?.equippedPieces ?? 0,
);
const challengeDisabled = computed(() => {
  if (battleResult.value !== null) return true;
  // 深度已接通：可否挑战由 core 的四类 reason 决定，不再一律禁用
  if (depthUiActive) return !currentDepthEvaluation.value?.unlocked;
  return !unlocked.value || game.equipmentDungeonRemaining <= 0;
});
const lockCopy = computed(() => {
  if (depthUiActive) {
    const evaluation = currentDepthEvaluation.value;
    if (!evaluation) return '';
    /*
     * 四类 reason 各给一句人话。**优先级由 core 决定**
     * （not-opened > previous-depth > daily-limit > ok），
     * UI 只做文案映射，不重新判定 —— 两处判定必然分叉。
     */
    if (evaluation.reason === 'not-opened') return '区域 8 开放后解锁';
    if (evaluation.reason === 'previous-depth') return `先通过第 ${selectedDepth.value - 1} 层`;
    if (evaluation.reason === 'daily-limit') return '今日次数已用完，明日 04:00 恢复';
    // 失败不扣次数是承重设计（docs/66 §4.4）：玩家不知道就不敢冲深层
    return evaluation.isFirstBreak
      ? '首次突破必得 1 件胚子 · 失败不扣次数'
      : '胜利有几率获得胚子 · 失败不扣次数';
  }
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

// ─────────── 烙印（docs/58 附录 B · B-1/B-2，激活批次上线） ───────────

/** 烙印台入口与材料掉落预览共用同一个激活开关（src/ui/imprintActivation.ts） */
const imprintActive = IMPRINT_BATCH_ACTIVE;
const imprintBenchOpen = ref(false);
const imprintEntryButton = ref<HTMLButtonElement | null>(null);
const unlockedImprintCount = computed(() => game.unlockedImprintSetIds.length);

/** B-2：激活后掉落预览改材料——数量口径照 docs/58 §3.2/§3.3，不自己发明 */
const imprintMaterialDrops = computed(() => {
  const crystal = IMPRINT_CRYSTAL_DISPLAY[selectedTierId.value];
  return [
    {
      id: crystal.id,
      name: crystal.name,
      iconUrl: imprintMaterialIconUrl(crystal.id),
      amount: '胜利 ×2~3',
      note: '烙印本档套装',
    },
    {
      id: IMPRINT_CORE_DISPLAY.id,
      name: IMPRINT_CORE_DISPLAY.name,
      iconUrl: imprintMaterialIconUrl(IMPRINT_CORE_DISPLAY.id),
      amount: '每 6 胜保底 ×1',
      note: '任意套装通用',
    },
  ];
});

function openImprintBench(): void {
  imprintBenchOpen.value = true;
}

function closeImprintBench(): void {
  imprintBenchOpen.value = false;
  void nextTick(() => imprintEntryButton.value?.focus());
}

/** 材料图标 404（正式图标未交付前）时退成首字符占位 */
function onImprintIconError(event: Event): void {
  (event.target as HTMLImageElement).style.display = 'none';
}

// ─────────── 深度阶梯（docs/66 §八 第 6 步 · 已直连 store） ───────────

/**
 * 深度 UI 激活开关（src/ui/dungeonDepthActivation.ts）。
 *
 * 数据源**已直连 game store**（进度 / 评估 / 挑战三件套）。
 * 难度标定门禁已经通过，开关现为 true；若未来需要紧急回滚，只关闭展示，
 * 已写入存档的深度进度仍保持单调，不做回退迁移。
 */
const depthUiActive = DUNGEON_DEPTH_UI_ACTIVE;

/**
 * 深度进度直连 store（8d683cd 起）。
 *
 * 存档 v16 起 `equipmentDungeon.depth` 是**真实字段**，不再从 records 推导 ——
 * 迁移已把旧档按同一条口径（该档有任一部位首通 ⇒ depth=1，绝不伪造更高深度）
 * 写进存档；现在生产和测试都直连同一个 core 评估函数，不再保留第二套适配器。
 */
const depthProgress = computed(() => (depthUiActive ? game.equipmentDungeonDepth : {}));

/** 当前档已突破的最高深度；0 = 一层未破 */
const clearedDepth = computed(() => depthProgress.value[selectedTierId.value] ?? 0);

/** 当前档实际开放的层数（crimson 现在只开 d1，docs/66 §七） */
const openDepths = computed(() => EQUIPMENT_DUNGEON_DEPTH_ANCHORS[selectedTierId.value].openDepths);

const selectedDepth = ref(1);

/** 对当前档逐层（1..5）求一次完整评估，全部判定都在 core 纯函数里 */
const depthEvaluations = computed(() => {
  if (!depthUiActive) return [];
  return Array.from({ length: DEPTH_PER_TIER }, (_, index) =>
    // playerLevel / contentTopLevel / attemptsRemaining 都由 store 内部从存档取，
    // UI 不再自己传 —— 少一处可能对不上的口径。
    game.evaluateDungeonDepth(selectedTierId.value, index + 1),
  );
});

/** 当前选中层的评估；深度未激活时为 null，调用方按 null 走旧分支 */
const currentDepthEvaluation = computed(() =>
  depthUiActive ? (depthEvaluations.value[selectedDepth.value - 1] ?? null) : null,
);

// 换档（含初始化）时把选中层收回到该档「下一层可打」的位置
watch(
  selectedTierId,
  (tierId) => {
    selectedDepth.value = Math.min(
      (depthProgress.value[tierId] ?? 0) + 1,
      EQUIPMENT_DUNGEON_DEPTH_ANCHORS[tierId].openDepths,
    );
  },
  { immediate: true },
);

// 刚突破一层后，若玩家还指着旧前沿则顺推到新一层；手动回选已破层重刷时不动
watch(clearedDepth, (cleared, previous) => {
  if (cleared > previous && selectedDepth.value === previous + 1) {
    selectedDepth.value = Math.min(cleared + 1, openDepths.value);
  }
});

/**
 * 留痕（docs/66 §4.3）：当前持有的奇迹胚子数，从背包与身上推导 ——
 * 持有口径（分解不追责），阈值从掉率表推导，绝不手写数字。
 * 0 时面板整行不渲染（「0」是一种嘲讽，不给）。
 */
const MIRACLE_ROLL_MIN = EQUIPMENT_BASE_ROLL_TIERS.find((tier) => tier.id === 'miracle')!.min;
const miracleBlankCount = computed(() => {
  const save = game.save;
  if (!save) return 0;
  const inBag = save.bag.equipment.filter(
    (instance) => instance.baseRollPermille >= MIRACLE_ROLL_MIN,
  ).length;
  const equippedCount = Object.values(save.equipped).filter(
    (instance) => instance !== null && instance.baseRollPermille >= MIRACLE_ROLL_MIN,
  ).length;
  return inBag + equippedCount;
});

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
  pendingNotice.value = '';
  /*
   * 深度激活时按「部位 + 档位 + 深度」发起，**不自己拼关卡 id** ——
   * 那层转换在 store 里（拼错只会得到 unknown-stage，排查成本高得多）。
   */
  const result = depthUiActive
    ? game.runEquipmentDungeonDepth(stage.value.slot, selectedTierId.value, selectedDepth.value)
    : game.runEquipmentDungeon(stage.value.id);
  if (!result.ok) {
    notice.value =
      result.reason === 'depth-not-opened'
        ? '这一层尚未开放'
        : result.reason === 'previous-depth-locked'
          ? `先通过第 ${selectedDepth.value - 1} 层`
          : result.reason === 'level-locked'
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
  pendingNotice.value = result.win
    ? `获得 ${result.instances
        .map(
          (instance) =>
            equipmentDisplayPresentation(requireEquipment(instance.defId), classId.value).name,
        )
        .join('、')}`
    : '挑战失败：次数、保底与随机序列均未消耗';
}

function closeBattle(): void {
  battleResult.value = null;
  notice.value = pendingNotice.value;
  pendingNotice.value = '';
  void nextTick(() => challengeButton.value?.focus());
}

function syncSystemMotionPreference(event?: MediaQueryListEvent): void {
  systemReduceMotion.value = event?.matches ?? motionPreference?.matches ?? false;
}

onMounted(() => {
  game.refreshEquipmentDungeon();
  motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  syncSystemMotionPreference();
  motionPreference.addEventListener('change', syncSystemMotionPreference);
});

onUnmounted(() => {
  motionPreference?.removeEventListener('change', syncSystemMotionPreference);
  motionPreference = null;
});
</script>

<template>
  <div class="dungeon scroll-y" :class="{ 'reduced-motion': effectiveReduceMotion }">
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

    <!-- 挑战配置折叠卡：收起时一行读完当前选择，展开才两步挑选 -->
    <CollapsibleCard
      class="config-fold"
      title="挑战配置"
      subtitle="STEP 1 部位 · STEP 2 品质"
      persist-key="dungeon.config"
      :default-open="configDefaultOpen"
    >
      <template #peek>
        <span class="config-peek">
          {{ SLOT_LABELS[selectedSlot] }} · {{ QUALITY_LABELS[stage.quality] }}
          <template v-if="depthUiActive">深度 {{ selectedDepth }}</template>
          <template v-else>Lv{{ stage.unlockLevel }}</template>
        </span>
      </template>
      <div class="config-body">
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
          <div class="tier-tabs" role="group" aria-label="装备副本品质难度">
            <button
              v-for="candidate in slotStages"
              :key="candidate.id"
              class="tier-tab"
              :class="[
                `quality-${candidate.quality}`,
                {
                  active: candidate.tierId === selectedTierId,
                  cleared: dungeonState?.records[candidate.id],
                  'coming-soon': tierComingSoon(candidate.tierId),
                  locked:
                    !tierComingSoon(candidate.tierId) &&
                    (!dungeonState ||
                      !isEquipmentDungeonStageUnlocked(candidate, dungeonState, playerLevel)),
                },
              ]"
              type="button"
              :disabled="tierComingSoon(candidate.tierId)"
              :aria-pressed="candidate.tierId === selectedTierId"
              :aria-label="
                tierComingSoon(candidate.tierId)
                  ? `${QUALITY_LABELS[candidate.quality]}，区域 7 开放后解锁`
                  : `${QUALITY_LABELS[candidate.quality]} Lv${candidate.unlockLevel}${
                      !dungeonState ||
                      !isEquipmentDungeonStageUnlocked(candidate, dungeonState, playerLevel)
                        ? '，未解锁'
                        : dungeonState.records[candidate.id]
                          ? '，已首通'
                          : ''
                    }`
              "
              @click="selectTier(candidate.tierId)"
            >
              <span class="tier-gem">
                <Hourglass v-if="tierComingSoon(candidate.tierId)" :size="12" aria-hidden="true" />
                <LockKeyhole
                  v-else-if="
                    !dungeonState ||
                    !isEquipmentDungeonStageUnlocked(candidate, dungeonState, playerLevel)
                  "
                  :size="12"
                  aria-hidden="true"
                />
                <Gem v-else :size="13" aria-hidden="true" />
              </span>
              <strong>{{ QUALITY_LABELS[candidate.quality] }}</strong>
              <!-- K5：敬请期待卡不显示门槛数字（docs/57） -->
              <small v-if="tierComingSoon(candidate.tierId)">区域 7 开放后解锁</small>
              <small v-else>Lv{{ candidate.unlockLevel }}</small>
              <Check
                v-if="!tierComingSoon(candidate.tierId) && dungeonState?.records[candidate.id]"
                :size="11"
                aria-label="已首通"
              />
            </button>
          </div>
          <!-- 深度阶梯：开关仅供紧急回滚展示，数据与挑战始终走真实 store。 -->
          <DungeonDepthPanel
            v-if="depthUiActive"
            :tier="currentTier"
            :evaluations="depthEvaluations"
            :cleared-depth="clearedDepth"
            :selected-depth="selectedDepth"
            :reduce-motion="effectiveReduceMotion"
            :miracle-count="miracleBlankCount"
            @select="selectedDepth = $event"
          />
        </section>
      </div>
    </CollapsibleCard>

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
            {{ depthUiActive ? '深度挑战' : currentRecord ? '再次挑战' : '首通挑战' }}
          </button>
        </div>
        <p v-if="notice" class="notice" role="status">{{ notice }}</p>

        <div class="set-block">
          <button
            type="button"
            class="block-toggle"
            :aria-expanded="setOpen"
            @click="toggleSetFold"
          >
            <span>
              <small>套装共鸣</small>
              <strong>{{ currentSet.name }}</strong>
            </span>
            <em>已穿戴 {{ currentSetProgress }} / 8</em>
            <ChevronDown
              :size="13"
              class="toggle-chev"
              :class="{ closed: !setOpen }"
              aria-hidden="true"
            />
          </button>
          <div class="fold-grid" :class="{ closed: !setOpen }">
            <div class="fold-inner">
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
          </div>
        </div>

        <div class="drop-block">
          <button
            type="button"
            class="block-toggle"
            :aria-expanded="dropOpen"
            @click="toggleDropFold"
          >
            <span>
              <small>{{
                imprintActive ? '当前档可掉落材料' : `当前 ${CLASS_INFO[classId].name} 可掉落`
              }}</small>
              <strong>{{ imprintActive ? '烙印材料' : `${drops.length} 件定向候选` }}</strong>
            </span>
            <em>{{ currentTier.shortName }}</em>
            <ChevronDown
              :size="13"
              class="toggle-chev"
              :class="{ closed: !dropOpen }"
              aria-hidden="true"
            />
          </button>
          <div class="fold-grid" :class="{ closed: !dropOpen }">
            <div class="fold-inner">
              <!-- B-2：激活批次后副本掉材料不掉整装（docs/58 §3.3） -->
              <div v-if="imprintActive" class="drop-list material-list">
                <article v-for="material in imprintMaterialDrops" :key="material.id">
                  <span class="material-icon">
                    <img
                      :src="material.iconUrl"
                      alt=""
                      draggable="false"
                      @error="onImprintIconError"
                    />
                    <i aria-hidden="true">{{ material.name.slice(0, 1) }}</i>
                  </span>
                  <span>
                    <strong>{{ material.name }}</strong>
                    <small>{{ material.amount }} · {{ material.note }}</small>
                  </span>
                </article>
                <p class="material-first-clear">
                  首通本入口额外 {{ IMPRINT_CRYSTAL_DISPLAY[selectedTierId].name }} ×4，
                  并解锁本档套装图纸
                </p>
              </div>
              <div v-else class="drop-list">
                <article v-for="definition in drops" :key="definition.id">
                  <EquipmentIcon :def="definition" :class-id="classId" size="lg" decorative />
                  <span>
                    <strong>{{ equipmentDisplayPresentation(definition, classId).name }}</strong>
                    <small>{{ definition.uniqueEffect }}</small>
                  </span>
                </article>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- B-1：烙印台入口（激活批次上线；普通装备烙上副本套装归属） -->
    <section v-if="imprintActive" class="imprint-entry card">
      <span class="imprint-entry-copy">
        <small>套装烙印</small>
        <strong>烙印台</strong>
        <span>把普通装备烙上副本套装——品质、词条、强化全部保留</span>
      </span>
      <button
        ref="imprintEntryButton"
        type="button"
        class="imprint-entry-button"
        @click="openImprintBench"
      >
        <Sparkles :size="15" aria-hidden="true" />
        打开烙印台
        <em v-if="unlockedImprintCount > 0">已解锁 {{ unlockedImprintCount }} 套图纸</em>
        <em v-else>首通副本解锁图纸</em>
      </button>
    </section>

    <CollapsibleCard
      class="future-fold"
      title="其他副本计划"
      subtitle="NEXT"
      persist-key="dungeon.future"
      :default-open="false"
    >
      <template #peek>
        <span class="config-peek">日常材料 · 无尽塔 · 世界 BOSS…</span>
      </template>
      <div class="future-body">
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
      </div>
    </CollapsibleCard>

    <EquipmentDungeonBattle
      v-if="battleResult && game.save"
      :result="battleResult"
      :class-id="game.save.player.classId"
      :level="game.save.player.level"
      :equipped="equipped"
      :player-max-hp="game.finalStats.hp"
      :reduce-motion="effectiveReduceMotion"
      @close="closeBattle"
    />

    <ImprintBench v-if="game.save" :open="imprintBenchOpen" @close="closeImprintBench" />
  </div>
</template>

<style scoped>
.dungeon {
  /*
   * main 才是页面滚动容器。锁死 height: 100% 会让 overflow:hidden 的子卡
   * 在内容超高时被 flex 负空间压扁裁断（部位网格曾因此只剩一行半）；
   * 用 min-height 保底撑满一屏，装不下的交给 main 滚动。
   */
  min-height: 100%;
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

.section-block {
  display: grid;
  gap: 7px;
}

/* 挑战配置折叠卡的内部留白：两个 STEP 块保持原来的呼吸感 */
.config-body,
.future-body {
  display: grid;
  gap: 10px;
  padding: 2px 12px 13px;
}

.config-peek {
  overflow: hidden;
  font-size: 10px;
  font-weight: 700;
  color: var(--blue-deep);
  text-overflow: ellipsis;
  white-space: nowrap;
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
  transition:
    transform var(--t-fast) var(--ease-spring),
    box-shadow var(--t-fast),
    border-color var(--t-fast),
    filter var(--t-fast),
    opacity var(--t-fast);
}

.tier-tab:active {
  transform: scale(0.94);
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

/* K5 敬请期待卡：暗色但留一点绯红轮廓——「未来会来」，不是「不存在」 */
.tier-tab.coming-soon {
  color: rgb(214 172 190 / 88%);
  background: linear-gradient(150deg, #3d2b38, #2b2233);
  border-color: rgb(255 79 114 / 30%);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 6%);
  cursor: default;
}

.tier-tab.coming-soon .tier-gem {
  color: rgb(255 209 220 / 90%);
  background: rgb(255 79 114 / 16%);
}

.tier-tab.coming-soon > small {
  color: rgb(214 172 190 / 62%);
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
  background: linear-gradient(
    145deg,
    color-mix(in srgb, var(--quality) 65%, white),
    var(--quality)
  );
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
  background: radial-gradient(
    circle at 80% 50%,
    color-mix(in srgb, var(--tier-color) 35%, transparent),
    transparent 31%
  );
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
  background: radial-gradient(
    ellipse,
    color-mix(in srgb, var(--tier-color) 72%, white),
    transparent 67%
  );
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
    radial-gradient(
      circle at 92% 0%,
      color-mix(in srgb, var(--tier-color) 18%, transparent),
      transparent 45%
    ),
    linear-gradient(145deg, rgb(255 255 255 / 92%), rgb(250 247 255 / 88%));
  border: 1px solid color-mix(in srgb, var(--tier-color) 22%, #e6e5f0);
  border-radius: 14px;
}

.block-toggle {
  display: flex;
  width: 100%;
  align-items: end;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 6px;
  margin: -4px -6px;
  text-align: left;
  border-radius: 10px;
  transition: background-color var(--t-mid) var(--ease-soft);
}

.block-toggle:active {
  background: color-mix(in srgb, var(--tier-color) 8%, white);
}

.block-toggle > span {
  display: grid;
  gap: 1px;
}

.block-toggle small {
  font-size: 8px;
  color: var(--text-dim);
}

.set-block .block-toggle strong {
  font-size: 11px;
  color: color-mix(in srgb, var(--tier-color) 74%, #574760);
}

.drop-block .block-toggle strong {
  font-size: 10px;
}

.toggle-chev {
  flex-shrink: 0;
  align-self: center;
  color: var(--text-dim);
  transition: transform var(--t-mid) var(--ease-soft);
}

.toggle-chev.closed {
  transform: rotate(-90deg);
}

/* 0fr ↔ 1fr 折叠动画：块内容多高都平滑开合 */
.fold-grid {
  display: grid;
  grid-template-rows: 1fr;
  opacity: 1;
  transition:
    grid-template-rows var(--t-mid) var(--ease-soft),
    opacity var(--t-fast) ease;
}

.fold-grid.closed {
  grid-template-rows: 0fr;
  opacity: 0;
}

.fold-inner {
  overflow: hidden;
  min-height: 0;
}

.set-block .block-toggle em {
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

.drop-block .block-toggle {
  align-items: center;
}

.drop-block .block-toggle small {
  font-size: 7px;
}

.drop-block .block-toggle em {
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

/* B-2 · 材料掉落预览（激活批次） */

.material-icon {
  position: relative;
  display: grid;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  place-items: center;
  overflow: hidden;
  background:
    radial-gradient(circle at 32% 24%, rgb(255 255 255 / 95%), transparent 42%),
    linear-gradient(145deg, #fff, #eef2f6);
  border: 1.5px solid color-mix(in srgb, var(--tier-color) 55%, white);
  border-radius: 12px;
}

.material-icon img {
  position: absolute;
  z-index: 1;
  width: 92%;
  height: 92%;
  object-fit: contain;
}

.material-icon i {
  font-size: 14px;
  font-style: normal;
  font-weight: 800;
  color: var(--tier-color);
}

.material-first-clear {
  margin: 2px 0 0;
  font-size: 9px;
  line-height: 1.5;
  color: var(--text-dim);
}

/* B-1 · 烙印台入口卡（激活批次） */

.imprint-entry {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 13px;
  background:
    radial-gradient(circle at 92% -30%, rgb(190 220 255 / 45%), transparent 46%),
    linear-gradient(150deg, rgb(255 255 255 / 97%), rgb(250 244 255 / 94%));
  border: 1px solid rgb(255 255 255 / 85%);
  border-radius: 18px;
}

.imprint-entry-copy {
  display: grid;
  flex: 1;
  gap: 2px;
  min-width: 0;
}

.imprint-entry-copy small {
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: var(--pink-deep);
}

.imprint-entry-copy strong {
  font-size: 14px;
}

.imprint-entry-copy span {
  font-size: 9px;
  line-height: 1.5;
  color: var(--text-dim);
}

.imprint-entry-button {
  display: grid;
  flex-shrink: 0;
  gap: 2px;
  justify-items: center;
  padding: 9px 12px;
  font-size: 12px;
  font-weight: 800;
  color: #fff;
  background: linear-gradient(135deg, #ff8bad, #a886ef);
  border-radius: 14px;
  box-shadow: 0 8px 18px rgb(219 105 157 / 30%);
}

.imprint-entry-button em {
  font-size: 8px;
  font-style: normal;
  font-weight: 600;
  opacity: 0.85;
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

/* ── 小屏手机适配：压缩 banner 与次数卡的纵向占用 ── */
@media (max-height: 740px) {
  .banner {
    min-height: 104px;
    padding: 12px 118px 12px 13px;
  }

  .banner-art {
    width: 116px;
    height: 116px;
  }

  .daily-card {
    padding: 8px 12px;
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

.dungeon.reduced-motion :is(.banner-art, .banner-glow, .stage-particles i, .future-row) {
  animation: none;
}

.dungeon.reduced-motion
  :is(
    .portal-button,
    .tier-tab,
    .attempts i,
    .power-track i,
    .challenge-button,
    .fold-grid,
    .toggle-chev
  ) {
  transition: none;
}

@media (prefers-reduced-motion: reduce) {
  .banner-art,
  .banner-glow,
  .stage-particles i,
  .future-row {
    animation: none;
  }

  .portal-button,
  .tier-tab,
  .attempts i,
  .power-track i,
  .challenge-button,
  .fold-grid,
  .toggle-chev {
    transition: none;
  }
}
</style>
