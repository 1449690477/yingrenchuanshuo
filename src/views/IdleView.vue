<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { BookOpen, ChevronDown, Gift, Sparkles, Zap } from '@lucide/vue';
import { abbr } from '@/core/format';
import { battleVitalsAtProgress } from '@/core/battleVisual';
import { aggregateLootEntries, type LootDisplayCategory } from '@/core/lootGrouping';
import { makeMonster, makePlayer } from '@/core/progression';
import { useGameStore } from '@/stores/game';
import { useInventoryStore } from '@/stores/inventory';
import { usePlayerStore } from '@/stores/player';
import { useStageStore } from '@/stores/stage';
import { idleEfficiencyPresentation } from '@/ui/idleEfficiencyPresentation';
import { requireChapter, requireRegionOfChapter } from '@/data/regions';
import { requireMonster } from '@/data/monsters';
import { requireEquipment } from '@/data/equipment';
import { equipmentDisplayPresentation } from '@/data/equipmentPresentation';
import { requireItem } from '@/data/items';
import {
  QUALITY_LABELS,
  QUALITY_ORDER,
  QUALITY_RANK,
  STAMINA_RECOVER_SECONDS,
} from '@/data/constants';
import { useNowTick } from '@/ui/useNowTick';
import StageSelect from '@/components/StageSelect.vue';
import BattleScene from '@/components/BattleScene.vue';
import EquipmentIcon from '@/components/EquipmentIcon.vue';
import ItemIcon from '@/components/ItemIcon.vue';
import EncounterPanel from '@/components/EncounterPanel.vue';
import EncounterJournalPanel from '@/components/EncounterJournalPanel.vue';
import CollapsibleCard from '@/components/CollapsibleCard.vue';
import EquipDetail from '@/components/EquipDetail.vue';
import ItemPeekSheet from '@/components/ItemPeekSheet.vue';
import EquipmentAdvancementPanel from '@/components/EquipmentAdvancementPanel.vue';
import ReforgeStudio from '@/components/reforge/ReforgeStudio.vue';
import type { EquipmentInstance } from '@/core/types';
import type { ItemDef } from '@/data/items';

const player = usePlayerStore();
const game = useGameStore();
const activeClassId = computed(() => {
  const classId = player.player?.classId;
  if (!classId) throw new Error('[挂机页错误] 存档未载入，无法解析装备职业外观');
  return classId;
});
const inventory = useInventoryStore();
const stage = useStageStore();
const showStages = ref(false);
const showEncounters = ref(false);
const showEncounterJournal = ref(false);

// ─────────── K2 · 挑战体力（docs/57）：当前关未通关才消耗，已通关不显示任何体力元素 ───────────
const staminaNow = useNowTick(30_000);

/** 当前关的挑战体力核算。跳秒驱动恢复倒计时刷新；体力由 store 实时恢复。 */
const challengeCost = computed(() => {
  void staminaNow.value;
  return game.evaluateStageEntry(stage.current.id).cost;
});

/** 当前关未通关且体力充足：按钮上显示「挑战 ⚡6」。 */
const showChallengeCost = computed(
  () => !stage.cleared && challengeCost.value.ok && challengeCost.value.cost > 0,
);

/** 体力不足：置灰 + 显示还需多久。 */
const staminaBlocked = computed(() => !stage.cleared && !challengeCost.value.ok);

/** 距可挑战的分钟数：下一点恢复 + 剩余缺口 × 恢复间隔。 */
const staminaMinutes = computed(() => {
  const cost = challengeCost.value;
  const missing = Math.max(1, cost.cost - cost.stamina);
  return Math.max(
    1,
    Math.ceil((cost.nextPointInSeconds + (missing - 1) * STAMINA_RECOVER_SECONDS) / 60),
  );
});

/**
 * 掉落面板默认开合：矮屏（手机占绝大多数）默认收起成速览条，
 * 高屏（平板/桌面信箱）默认展开。玩家手动切换后由 CollapsibleCard 记忆。
 */
const lootDefaultOpen =
  typeof window !== 'undefined' &&
  !window.matchMedia?.('(max-height: 740px)').matches &&
  !window.matchMedia?.('(max-width: 350px)').matches;

const collapsedLoot = ref<Record<LootDisplayCategory, boolean>>({
  equipment: false,
  material: false,
  consumable: false,
  fragment: false,
  currency: false,
});

const lootCategoryLabels: Record<LootDisplayCategory, string> = {
  equipment: '装备',
  material: '材料',
  consumable: '消耗品',
  fragment: '碎片',
  currency: '货币',
};

/** 品质中文名，用于最新掉落聚焦与好货统计。 */
const qualityLabels: Readonly<Record<string, string>> = QUALITY_LABELS;
const highValueQualityOrder = [...QUALITY_ORDER]
  .filter((quality) => QUALITY_RANK[quality] >= QUALITY_RANK.epic)
  .reverse();

/** 挂机窗口底部的实时统计条（纯展示，数据全部来自 store 现有字段）。 */
const idleStats = computed(() => [
  { label: '击杀进度', value: stage.cleared ? '已通关' : `${stage.kills}/${stage.killTarget}` },
  { label: '击杀速度', value: `${stage.kps.toFixed(2)} 只/秒` },
  { label: '本轮掉落', value: `${stage.lootLog.length} 件` },
  { label: '战力参考', value: `${Math.round(stage.cpRatio * 100)}%` },
]);

/** 掉落日志里史诗以上好货的数量分布，一眼看出这波挂机缘不缘。 */
const qualitySummary = computed(() => {
  const counts = new Map<string, number>();
  for (const e of stage.lootLog) counts.set(e.quality, (counts.get(e.quality) ?? 0) + 1);
  return highValueQualityOrder
    .filter((q) => counts.has(q))
    .map((q) => ({ quality: q, count: counts.get(q) ?? 0, label: qualityLabels[q] ?? q }));
});

const groupedLoot = computed(() =>
  aggregateLootEntries(
    stage.lootLog.map((entry) => {
      const presentation = entry.isEquipment
        ? equipmentDisplayPresentation(requireEquipment(entry.itemId), activeClassId.value)
        : null;
      return {
        ...entry,
        name: presentation?.name ?? entry.name,
        category: entry.isEquipment
          ? ('equipment' as const)
          : (requireItem(entry.itemId).kind as LootDisplayCategory),
      };
    }),
  ),
);
const allLootCollapsed = computed(
  () =>
    groupedLoot.value.length > 0 && groupedLoot.value.every((g) => collapsedLoot.value[g.category]),
);

function toggleAllLoot(): void {
  const next = !allLootCollapsed.value;
  for (const group of groupedLoot.value) collapsedLoot.value[group.category] = next;
}

const region = computed(() => requireRegionOfChapter(stage.current.chapterId));
const chapter = computed(() => requireChapter(stage.current.chapterId));
const chapterMapUrl = computed(() => `${import.meta.env.BASE_URL}${chapter.value.mapAsset}`);
const battleMapUrl = computed(() => `${import.meta.env.BASE_URL}${chapter.value.battleAsset}`);

/** 本关怪物图鉴，用于挑选当前目标之外的纵深陪衬。 */
const monsters = computed(() => {
  const ids = new Set<string>();
  for (const w of stage.current.waves) for (const m of w.monsters) ids.add(m.id);
  return [...ids].map((id) => requireMonster(id));
});

/** 目标由 store 在结算前绑定，击杀演出结束后才切换下一只，避免旧伤害打到新怪。 */
const target = computed(() => requireMonster(stage.battleTargetId));
const supportMonsters = computed(() =>
  monsters.value.filter((monster) => monster.id !== target.value.id).slice(0, 2),
);
const battleVitals = computed(() => {
  const currentPlayer = player.player;
  if (!currentPlayer) return null;
  return battleVitalsAtProgress(
    makePlayer(
      currentPlayer.name,
      currentPlayer.level,
      player.finalStats,
      player.playerCombatElement,
      player.equipCombatBonuses,
    ),
    makeMonster(target.value),
    stage.battleProgress,
    player.playerSkillMultiplier,
    player.playerOnHitTriggers,
  );
});

const recentDrop = computed(() => {
  const entry = stage.lootLog[0];
  if (!entry) return null;
  const presentation = entry.isEquipment
    ? equipmentDisplayPresentation(requireEquipment(entry.itemId), activeClassId.value)
    : null;
  const asset = presentation?.icon ?? requireItem(entry.itemId).icon;
  return {
    id: entry.id,
    itemId: entry.itemId,
    isEquipment: entry.isEquipment,
    count: entry.count,
    name: presentation?.name ?? entry.name,
    quality: entry.quality,
    assetUrl: `${import.meta.env.BASE_URL}${asset}`,
  };
});

/** 真实承伤结算给出的效率提示；推荐战力只保留为右侧参考值。 */
const efficiencyStatus = computed(() => idleEfficiencyPresentation(stage.battleEfficiency));

/* ── 第二轮：掉落互动化 ── */

/** 挂机窗口眉部的战利品流水线：最近 6 件，新货在最左。 */
const lootFeed = computed(() =>
  stage.lootLog.slice(0, 6).map((entry) => {
    const presentation = entry.isEquipment
      ? equipmentDisplayPresentation(requireEquipment(entry.itemId), activeClassId.value)
      : null;
    return {
      id: entry.id,
      itemId: entry.itemId,
      name: presentation?.name ?? entry.name,
      count: entry.count,
      quality: entry.quality,
      isEquipment: entry.isEquipment,
      assetUrl: `${import.meta.env.BASE_URL}${
        presentation?.icon ?? requireItem(entry.itemId).icon
      }`,
    };
  }),
);

/** 掉落日志满员提示：40 条之后最旧的记录会被冲掉，别让玩家误以为丢装备了。 */
const LOOT_LOG_DISPLAY_MAX = 40;
const lootSubtitle = computed(() =>
  stage.lootLog.length >= LOOT_LOG_DISPLAY_MAX
    ? `${LOOT_LOG_DISPLAY_MAX}/${LOOT_LOG_DISPLAY_MAX} 条 · 旧记录正被冲掉`
    : `${stage.lootLog.length}/${LOOT_LOG_DISPLAY_MAX} 条 · ${groupedLoot.value.length} 类`,
);

const selectedEquip = ref<EquipmentInstance | null>(null);
const advancement = ref<EquipmentInstance | null>(null);
const reforgeUid = ref<string | null>(null);
const peekItem = ref<{ def: ItemDef; owned: number } | null>(null);
const lootNotice = ref<string | null>(null);
let noticeTimer = 0;

function notice(text: string): void {
  lootNotice.value = text;
  clearTimeout(noticeTimer);
  noticeTimer = window.setTimeout(() => (lootNotice.value = null), 2200);
}

async function openReforgeFromDetail(uid: string): Promise<void> {
  selectedEquip.value = null;
  await nextTick();
  reforgeUid.value = uid;
}

async function openAdvancementFromDetail(uid: string): Promise<void> {
  selectedEquip.value = null;
  await nextTick();
  advancement.value = inventory.ownedEquipment(uid);
  if (!advancement.value) notice('这件装备已经变化，请重新选择');
}

function onEquipmentUpgraded(result: { targetName: string; cpDelta: number }): void {
  const delta =
    result.cpDelta === 0 ? '' : `，战力 ${result.cpDelta > 0 ? '+' : ''}${abbr(result.cpDelta)}`;
  notice(`已升阶为 ${result.targetName}${delta}`);
}

/**
 * 点开一件掉落：装备找背包里同定义的最新实例弹详情；
 * 材料/货币弹轻量速览。实例不在背包（已分解/出售）时给一句兜底提示。
 */
function openLootEntry(entry: { itemId: string; isEquipment: boolean; count: number }): void {
  if (entry.isEquipment) {
    const list = inventory.bag?.equipment ?? [];
    let found: EquipmentInstance | null = null;
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i].defId === entry.itemId) {
        found = list[i];
        break;
      }
    }
    if (found) {
      peekItem.value = null;
      selectedEquip.value = found;
    } else {
      notice('这件装备已不在背包（可能已分解或出售）');
    }
    return;
  }
  selectedEquip.value = null;
  peekItem.value = {
    def: requireItem(entry.itemId),
    owned: inventory.bag?.items[entry.itemId] ?? entry.count,
  };
}
</script>

<template>
  <div class="idle">
    <button class="stage-bar row-clickable" @click="showStages = true">
      <img class="stage-map" :src="chapterMapUrl" :alt="`${chapter.name}章节场景`" />
      <span class="stage-map-shade" />
      <span class="stage-info">
        <span class="region">{{ region.name }} · {{ chapter.name }}</span>
        <span class="stage-name">{{ stage.current.name }}</span>
      </span>
      <span class="stage-right">
        <!-- K2：当前关未通关才显示挑战体力；已通关恒 0 不显示（docs/57） -->
        <span v-if="showChallengeCost" class="stage-cost">
          挑战
          <Zap :size="10" :stroke-width="2.4" aria-hidden="true" />
          {{ challengeCost.cost }}
        </span>
        <span v-else-if="staminaBlocked" class="stage-cost blocked">
          <Zap :size="10" :stroke-width="2.4" aria-hidden="true" />
          {{ challengeCost.stamina }}/{{ challengeCost.cost }}
        </span>
        <span class="lv num">Lv.{{ stage.current.level }}</span>
        <span class="chev">切换 ›</span>
      </span>
    </button>

    <div class="efficiency-row" :class="efficiencyStatus.level">
      <span class="efficiency-copy">
        <strong class="num">战斗效率 {{ efficiencyStatus.percent }}%</strong>
        <small v-if="efficiencyStatus.detail">· {{ efficiencyStatus.detail }}</small>
      </span>
      <span class="efficiency-reference">
        战力参考
        <b class="num">{{ abbr(player.cp) }} / {{ abbr(stage.current.recommendCP) }}</b>
      </span>
    </div>

    <section class="battle">
      <!-- 挂机窗口外框：状态灯 + 标题 + 进度发丝条 + 统计条，只做容器装饰，不动 BattleScene 内部 -->
      <div class="idle-window" :class="{ running: stage.canIdle }">
        <div class="window-chrome">
          <span class="status-dot" :class="{ running: stage.canIdle }" aria-hidden="true" />
          <span class="window-title">挂机战斗</span>
          <span class="window-state" :class="{ running: stage.canIdle && !staminaBlocked }">
            {{
              staminaBlocked
                ? `体力恢复中 · ${staminaMinutes} 分钟后可挑战`
                : stage.canIdle
                  ? '自动战斗中'
                  : '已暂停'
            }}
          </span>
        </div>
        <!-- 发丝级击杀进度：贴在窗口眉下，余光一扫就知道这波推到哪了 -->
        <div class="wave-track" aria-hidden="true">
          <span
            class="wave-fill"
            :class="{ cleared: stage.cleared }"
            :style="{
              transform: `scaleX(${stage.cleared ? 1 : Math.max(0.02, stage.kills / stage.killTarget)})`,
            }"
          />
        </div>
        <!-- 战利品流水线：最新掉落在最左，新货滑入弹跳；点图标直接看详情 -->
        <TransitionGroup v-if="lootFeed.length" name="feed" tag="div" class="loot-feed">
          <button
            v-for="item in lootFeed"
            :key="item.id"
            type="button"
            class="feed-chip"
            :class="['q-' + item.quality, { eq: item.isEquipment }]"
            :aria-label="`查看${item.name}`"
            @click="openLootEntry(item)"
          >
            <img :src="item.assetUrl" :alt="item.name" draggable="false" />
          </button>
        </TransitionGroup>
        <BattleScene
          v-if="player.player && battleVitals"
          :class-id="player.player.classId"
          :level="player.player.level"
          :equipped="inventory.equipped"
          :player-name="player.player.name"
          :monster="target"
          :support-monsters="supportMonsters"
          :background-url="battleMapUrl"
          :active="stage.canIdle"
          :vitals="battleVitals"
          :status-text="stage.canIdle ? '自动战斗中' : '战斗已暂停'"
          :progress-text="
            stage.cleared ? `${stage.kps.toFixed(2)} 只/秒` : `${stage.kills}/${stage.killTarget}`
          "
          :wave-ratio="stage.cleared ? undefined : stage.kills / stage.killTarget"
          :beats="stage.battleBeats"
          :pulse="stage.battlePulse"
          :drop="recentDrop"
        />
        <div class="idle-stats">
          <div v-for="s in idleStats" :key="s.label" class="stat">
            <span class="stat-value num">{{ s.value }}</span>
            <span class="stat-label">{{ s.label }}</span>
          </div>
        </div>
      </div>
      <div v-if="stage.cleared" class="cleared">✓ 本关已通关，可继续挂机刷材料</div>
    </section>

    <button
      v-if="stage.pendingEncounters.length > 0"
      class="encounter-entry"
      @click="showEncounters = true"
    >
      <span class="encounter-icon"><Sparkles :size="16" aria-hidden="true" /></span>
      <span><strong>旅途中出现了奇遇</strong><small>不会打断挂机，有空再处理</small></span>
      <b class="num">{{ stage.pendingEncounters.length }}</b>
      <i>查看 ›</i>
    </button>

    <button
      v-if="stage.encounterJournal.length > 0"
      type="button"
      class="encounter-entry journal-entry"
      @click="showEncounterJournal = true"
    >
      <span class="encounter-icon"><BookOpen :size="17" aria-hidden="true" /></span>
      <span><strong>旅途手札</strong><small>重温同行者与你说过的话</small></span>
      <b class="num">{{ stage.encounterJournal.length }}</b>
      <i>打开 ›</i>
    </button>
    <!-- 掉落面板：折叠卡片。收起时是一条「最新一件 + 好货统计」速览，展开后是分组清单 -->
    <CollapsibleCard
      class="loot"
      title="最近掉落"
      :subtitle="lootSubtitle"
      persist-key="lootPanel"
      :default-open="lootDefaultOpen"
    >
      <template #icon>
        <span class="loot-sigil" aria-hidden="true"><Gift :size="13" /></span>
      </template>
      <template #peek>
        <span v-if="recentDrop" class="peek-drop">
          <img class="peek-icon" :src="recentDrop.assetUrl" :alt="recentDrop.name" />
          <span class="peek-name" :class="'q-' + recentDrop.quality">{{ recentDrop.name }}</span>
        </span>
        <span v-else class="peek-empty">等待第一件战利品…</span>
        <span v-for="q in qualitySummary" :key="q.quality" class="q-chip" :class="'q-' + q.quality"
          >{{ q.label }}×{{ q.count }}</span
        >
      </template>

      <div class="loot-body">
        <div class="loot-toolbar">
          <small>
            史诗以上好货
            <template v-if="qualitySummary.length === 0">暂无</template>
            <span
              v-for="q in qualitySummary"
              :key="q.quality"
              class="q-chip"
              :class="'q-' + q.quality"
              >{{ q.label }}×{{ q.count }}</span
            >
          </small>
          <button v-if="groupedLoot.length" type="button" @click="toggleAllLoot">
            {{ allLootCollapsed ? '全部展开' : '全部折叠' }}
          </button>
        </div>
        <!-- 最新掉落聚焦：可点，直接弹出详情 -->
        <button
          v-if="recentDrop"
          :key="recentDrop.id"
          type="button"
          class="loot-spot"
          :class="'q-' + recentDrop.quality"
          :aria-label="`查看${recentDrop.name}详情`"
          @click="openLootEntry(recentDrop)"
        >
          <span class="spot-tag">✨ 最新掉落</span>
          <img class="spot-icon" :src="recentDrop.assetUrl" :alt="recentDrop.name" />
          <span class="spot-name" :class="'q-' + recentDrop.quality">{{ recentDrop.name }}</span>
          <span class="spot-quality" :class="'q-' + recentDrop.quality">{{
            qualityLabels[recentDrop.quality] ?? recentDrop.quality
          }}</span>
        </button>
        <div v-if="stage.lootLog.length === 0" class="loot-empty">
          <Gift :size="22" aria-hidden="true" />
          <strong>战利品正在路上</strong>
          <small>挂机击败魔物后，掉落会实时出现在这里</small>
        </div>
        <div v-else class="loot-list scroll-y">
          <section v-for="group in groupedLoot" :key="group.category" class="loot-group">
            <button
              class="loot-group-head"
              :aria-expanded="!collapsedLoot[group.category]"
              @click="collapsedLoot[group.category] = !collapsedLoot[group.category]"
            >
              <span class="loot-category" :class="'cat-' + group.category">{{
                lootCategoryLabels[group.category]
              }}</span>
              <span class="loot-summary">
                {{ group.distinctCount }} 种 · 共 {{ group.totalCount }} 件
              </span>
              <ChevronDown
                :size="14"
                :class="{ folded: collapsedLoot[group.category] }"
                aria-hidden="true"
              />
            </button>
            <Transition name="loot-fold">
              <div v-if="!collapsedLoot[group.category]" class="loot-items">
                <button
                  v-for="(e, i) in group.items"
                  :key="e.itemId"
                  type="button"
                  class="loot-row"
                  :class="'q-' + e.quality"
                  :style="{ '--row-delay': `${Math.min(i, 8) * 28}ms` }"
                  :aria-label="`查看${e.name}详情`"
                  @click="openLootEntry(e)"
                >
                  <EquipmentIcon
                    v-if="e.isEquipment"
                    :def="requireEquipment(e.itemId)"
                    :class-id="activeClassId"
                    size="sm"
                  />
                  <ItemIcon v-else :item="requireItem(e.itemId)" />
                  <span class="loot-name" :class="'q-' + e.quality">{{ e.name }}</span>
                  <span class="loot-count num">×{{ e.count }}</span>
                </button>
              </div>
            </Transition>
          </section>
        </div>
      </div>
    </CollapsibleCard>

    <!-- 掉落详情：装备走完整详情（可比可穿），材料走轻量速览 -->
    <Transition name="modal-pop">
      <EquipDetail
        v-if="selectedEquip"
        :inst="selectedEquip"
        from="bag"
        @close="selectedEquip = null"
        @request-reforge="openReforgeFromDetail"
        @request-advancement="openAdvancementFromDetail"
      />
    </Transition>
    <ItemPeekSheet
      v-if="peekItem"
      :item="peekItem.def"
      :owned="peekItem.owned"
      @close="peekItem = null"
    />
    <EquipmentAdvancementPanel
      v-if="advancement"
      :inst="advancement"
      @close="advancement = null"
      @upgraded="onEquipmentUpgraded"
    />

    <Teleport to="body">
      <ReforgeStudio v-if="reforgeUid" :initial-uid="reforgeUid" @close="reforgeUid = null" />
    </Teleport>

    <Transition name="toast-up">
      <div v-if="lootNotice" class="loot-toast">{{ lootNotice }}</div>
    </Transition>

    <!-- 合并：保留 UI 打磨的 modal-pop 过渡，同时接入奇遇面板并统一用同一套过渡 -->
    <Transition name="modal-pop">
      <StageSelect v-if="showStages" @close="showStages = false" />
    </Transition>

    <Transition name="modal-pop">
      <EncounterPanel v-if="showEncounters" @close="showEncounters = false" />
    </Transition>
    <Transition name="modal-pop">
      <EncounterJournalPanel v-if="showEncounterJournal" @close="showEncounterJournal = false" />
    </Transition>
  </div>
</template>

<style scoped>
.idle {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 10px;
  /*
   * main 才是页面的滚动容器。这里只保证空内容时至少撑满一屏；
   * 不能锁死 height: 100%，否则掉落卡展开后会参与负空间收缩，
   * 最终整张卡被压成 1px，玩家反而看不到可点击的掉落。
   */
  min-height: 100%;
}

.stage-bar {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 68px;
  overflow: hidden;
  padding: 12px 14px;
  background: linear-gradient(100deg, var(--blue-soft), var(--pink-soft));
  border: 1px solid rgb(255 255 255 / 80%);
  border-radius: 18px;
  text-align: left;
  color: #fff;
  box-shadow: var(--shadow-float);
  transition:
    transform var(--t-fast) var(--ease-spring),
    box-shadow var(--t-mid) var(--ease-soft);
}

.stage-bar:active {
  transform: scale(0.985);
}

/* 低频扫光提示关卡横幅可点击；只移动合成层，不触发布局重排。 */
.stage-bar::after {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 34%;
  content: '';
  background: linear-gradient(100deg, transparent, rgb(255 255 255 / 22%), transparent);
  pointer-events: none;
  animation: stage-shine 5.6s var(--ease-soft) infinite;
}

@keyframes stage-shine {
  0%,
  62% {
    transform: translate3d(-130%, 0, 0) skewX(-18deg);
  }
  82%,
  100% {
    transform: translate3d(430%, 0, 0) skewX(-18deg);
  }
}

.stage-map,
.stage-map-shade {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.stage-map {
  object-fit: cover;
  object-position: center 48%;
}

.stage-map-shade {
  background: linear-gradient(90deg, rgb(39 54 73 / 72%), rgb(39 54 73 / 24%));
}

.stage-info {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.region {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: rgb(255 255 255 / 82%);
  text-shadow: 0 1px 3px rgb(24 38 52 / 45%);
}

.stage-name {
  font-size: 18px;
  font-weight: 800;
  letter-spacing: -0.02em;
  text-shadow:
    0 1px 3px rgb(24 38 52 / 52%),
    0 3px 10px rgb(24 38 52 / 30%);
}

.stage-right {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

/* K2 挑战体力 chip：贴在关卡条右侧，与 Lv 徽章同一视觉层级 */
.stage-cost {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 3px 8px;
  font-size: 9px;
  font-weight: 700;
  color: #8a5a1d;
  background: rgb(255 247 230 / 92%);
  border-radius: 999px;
  box-shadow: 0 2px 6px rgb(80 60 30 / 12%);
  white-space: nowrap;
}

.stage-cost.blocked {
  color: #a04444;
  background: rgb(255 238 238 / 94%);
}

.lv {
  padding: 4px 9px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.01em;
  color: #fff;
  background: rgb(255 255 255 / 22%);
  border: 1px solid rgb(255 255 255 / 34%);
  border-radius: 999px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 28%),
    0 2px 6px rgb(24 38 52 / 18%);
  backdrop-filter: blur(6px) saturate(1.3);
  -webkit-backdrop-filter: blur(6px) saturate(1.3);
}

.chev {
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 1px 4px rgb(24 38 52 / 58%);
}

.efficiency-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid transparent;
  border-radius: var(--r-sm);
}

.efficiency-row.smooth {
  color: #2f8059;
  background: #eaf8f0;
  border-color: #c8ead7;
}

.efficiency-row.strained {
  color: #806b21;
  background: #fff7dc;
  border-color: #f0df9d;
}

.efficiency-row.pressured {
  color: #a45a24;
  background: #fff0df;
  border-color: #f0c79f;
}

.efficiency-copy {
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 4px;
  line-height: 1.35;
}

.efficiency-copy strong {
  font-size: 12px;
  white-space: nowrap;
}

.efficiency-copy small {
  font-size: 10px;
  font-weight: 700;
}

.efficiency-reference {
  display: flex;
  align-items: flex-end;
  flex-direction: column;
  flex-shrink: 0;
  color: var(--text-dim);
  font-size: 8px;
  line-height: 1.25;
}

.efficiency-reference b {
  color: currentcolor;
  font-size: 10px;
}

@media (width <= 350px) {
  .efficiency-row {
    grid-template-columns: 1fr;
    gap: 3px;
  }

  .efficiency-reference {
    align-items: center;
    flex-direction: row;
    gap: 4px;
  }
}

.battle {
  position: relative;
  overflow: visible;
  padding: 0;
}

/* ── 挂机窗口外框：给战斗场景套一层带状态灯与统计条的窗口 ── */
.idle-window {
  overflow: hidden;
  background: rgb(255 255 255 / 72%);
  border: 1px solid rgb(255 255 255 / 85%);
  border-radius: 20px;
  box-shadow: var(--shadow-float);
  backdrop-filter: blur(8px) saturate(1.15);
  -webkit-backdrop-filter: blur(8px) saturate(1.15);
  transition: box-shadow var(--t-mid) var(--ease-soft);
}

/* 挂机运行时窗口边缘有极淡的呼吸光晕，一眼知道机器在转。 */
.idle-window.running {
  animation: window-breathe 3.2s var(--ease-soft) infinite;
}

@keyframes window-breathe {
  0%,
  100% {
    box-shadow: var(--shadow-float);
  }
  50% {
    box-shadow:
      var(--shadow-float),
      0 0 22px rgb(245 121 159 / 30%);
  }
}

.window-chrome {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 9px 13px 7px;
}

.status-dot {
  width: 8px;
  height: 8px;
  flex-shrink: 0;
  background: #b6bec8;
  border-radius: 50%;
}

.status-dot.running {
  background: var(--success, #3fae7a);
  box-shadow: 0 0 0 0 rgb(63 174 122 / 45%);
  animation: dot-blink 1.8s ease-out infinite;
}

@keyframes dot-blink {
  0% {
    box-shadow: 0 0 0 0 rgb(63 174 122 / 45%);
  }
  70% {
    box-shadow: 0 0 0 7px rgb(63 174 122 / 0%);
  }
  100% {
    box-shadow: 0 0 0 0 rgb(63 174 122 / 0%);
  }
}

.window-title {
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.06em;
  color: var(--text);
}

.window-state {
  margin-left: auto;
  padding: 2px 9px;
  font-size: 9px;
  font-weight: 700;
  color: var(--text-dim);
  background: rgb(244 246 249 / 90%);
  border-radius: 999px;
}

.window-state.running {
  color: var(--pink-deep);
  background: #fff0f6;
  border: 1px solid rgb(245 121 159 / 22%);
}

/* 发丝级击杀进度条：贴在窗口眉下，不打断画面也能读出推进度 */
.wave-track {
  overflow: hidden;
  height: 3px;
  margin: 0 13px;
  background: rgb(70 89 107 / 8%);
  border-radius: 999px;
}

.wave-fill {
  display: block;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, var(--blue), var(--pink));
  border-radius: inherit;
  transform-origin: left center;
  transition: transform 0.45s var(--ease-soft);
}

.wave-fill.cleared {
  background: linear-gradient(90deg, #63c98e, #8fe0c8);
}

/* ── 战利品流水线：窗口眉部的最近掉落图标流 ── */
.loot-feed {
  display: flex;
  align-items: center;
  gap: 5px;
  overflow: hidden;
  padding: 5px 13px 3px;
}

.feed-chip {
  display: grid;
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  place-items: center;
  background: rgb(255 255 255 / 88%);
  border: 1.5px solid currentcolor;
  border-radius: 9px;
  box-shadow: 0 2px 6px rgb(53 69 91 / 10%);
  transition: transform var(--t-fast) var(--ease-spring);
}

.feed-chip:active {
  transform: scale(0.88);
}

/* 装备图标比方角材料多一道内发光，扫一眼能分清 */
.feed-chip.eq {
  box-shadow:
    0 2px 6px rgb(53 69 91 / 10%),
    inset 0 0 6px color-mix(in srgb, currentcolor 22%, transparent);
}

.feed-chip img {
  width: 18px;
  height: 18px;
  object-fit: contain;
  filter: drop-shadow(0 1px 2px rgb(24 38 52 / 18%));
}

/* 新货从最左弹进来，其余顺势右移让位 */
.feed-enter-from {
  opacity: 0;
  transform: translateX(-12px) scale(0.6);
}

.feed-enter-active {
  transition:
    opacity var(--t-mid) var(--ease-soft),
    transform var(--t-slow) var(--ease-out-back);
}

.feed-leave-to {
  opacity: 0;
  transform: scale(0.6);
}

.feed-leave-active {
  transition:
    opacity var(--t-fast) ease,
    transform var(--t-fast) ease;
}

.feed-move {
  transition: transform var(--t-mid) var(--ease-soft);
}

.idle-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0;
  margin-top: 2px;
  padding: 7px 13px 10px;
  border-top: 1px solid var(--hairline);
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  min-width: 0;
}

/* 统计格之间的发丝分隔，四宫格读起来像一整条仪表带 */
.stat + .stat {
  border-left: 1px solid var(--hairline);
}

.stat-value {
  overflow: hidden;
  max-width: 100%;
  font-size: 12px;
  font-weight: 800;
  color: var(--text);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stat-label {
  font-size: 9px;
  letter-spacing: 0.05em;
  color: var(--text-dim);
}

/* ── 掉落面板：最新掉落聚焦 + 好货统计 ── */
.q-chip {
  margin-left: 5px;
  font-weight: 700;
}

.loot-spot {
  position: relative;
  display: flex;
  overflow: hidden;
  align-items: center;
  gap: 8px;
  width: 100%;
  margin-bottom: 8px;
  padding: 7px 10px;
  text-align: left;
  background: linear-gradient(100deg, rgb(255 240 246 / 92%), rgb(255 255 255 / 88%));
  border: 1px solid rgb(245 121 159 / 26%);
  border-radius: 13px;
  box-shadow: 0 3px 10px rgb(245 121 159 / 14%);
  animation: spot-pop 0.5s var(--ease-out-back) both;
}

/* 传说以上的聚焦行带低频扫光，好货自己会说话 */
.loot-spot.q-legendary::after,
.loot-spot.q-mythic::after,
.loot-spot.q-prismatic::after,
.loot-spot.q-divine::after {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 42%;
  content: '';
  background: linear-gradient(100deg, transparent, rgb(255 255 255 / 42%), transparent);
  pointer-events: none;
  animation: spot-shine 3.2s var(--ease-soft) infinite;
}

@keyframes spot-shine {
  0%,
  55% {
    transform: translate3d(-120%, 0, 0) skewX(-16deg);
  }
  85%,
  100% {
    transform: translate3d(340%, 0, 0) skewX(-16deg);
  }
}

/* 好货聚焦行用品质色勾边，传说以上一眼锁定。 */
.loot-spot.q-epic {
  border-color: rgb(171 111 224 / 45%);
  box-shadow: 0 3px 12px rgb(171 111 224 / 20%);
}
.loot-spot.q-legendary {
  border-color: rgb(255 154 60 / 50%);
  box-shadow: 0 3px 12px rgb(255 154 60 / 24%);
}
.loot-spot.q-mythic {
  border-color: rgb(255 107 122 / 50%);
  box-shadow: 0 3px 12px rgb(255 107 122 / 24%);
}
.loot-spot.q-prismatic {
  border-color: rgb(205 93 218 / 58%);
  box-shadow:
    0 3px 12px rgb(205 93 218 / 22%),
    0 0 10px rgb(84 185 240 / 16%);
}
.loot-spot.q-divine {
  border-color: rgb(232 172 31 / 55%);
  box-shadow: 0 3px 12px rgb(232 172 31 / 26%);
}

@keyframes spot-pop {
  0% {
    opacity: 0;
    transform: translateY(-7px) scale(0.96);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.spot-tag {
  flex-shrink: 0;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.03em;
  color: var(--pink-deep);
}

.spot-icon {
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  object-fit: contain;
  filter: drop-shadow(0 2px 3px rgb(24 38 52 / 18%));
}

.spot-name {
  overflow: hidden;
  min-width: 0;
  flex: 1;
  font-size: 12px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.spot-quality {
  flex-shrink: 0;
  font-size: 9px;
  font-weight: 800;
}

.cleared {
  margin-top: 10px;
  padding: 6px;
  font-size: 10px;
  font-weight: 700;
  text-align: center;
  color: var(--success);
  background: linear-gradient(90deg, #eafaf1, #f2fcf5, #eafaf1);
  border: 1px solid #c2ecd3;
  border-radius: var(--r-sm);
  animation: cleared-pop 0.5s var(--ease-out-back) both;
}

@keyframes cleared-pop {
  0% {
    opacity: 0;
    transform: translateY(-8px) scale(0.94);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.encounter-entry {
  display: grid;
  grid-template-columns: auto 1fr auto auto;
  align-items: center;
  gap: 8px;
  min-height: 48px;
  padding: 7px 10px;
  text-align: left;
  color: var(--text-mid);
  background: linear-gradient(100deg, #fff4f8, var(--blue-soft));
  border: 1px solid #f3d9e7;
  border-radius: var(--r);
  box-shadow: var(--shadow-sm);
  transition:
    transform var(--t-fast) var(--ease-spring),
    box-shadow var(--t-mid) var(--ease-soft);
}

.encounter-entry:active {
  transform: scale(0.98);
}

.encounter-icon {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  color: var(--pink-deep);
  background: #fff;
  border-radius: 50%;
}

.encounter-entry > span:nth-child(2) {
  display: flex;
  min-width: 0;
  flex-direction: column;
}
.encounter-entry strong {
  font-size: 0.875rem;
  color: var(--text);
}
.encounter-entry small {
  font-size: 0.75rem;
  color: var(--text-dim);
}
.encounter-entry b {
  display: grid;
  min-width: 22px;
  height: 22px;
  place-items: center;
  font-size: 10px;
  color: #fff;
  background: var(--pink-deep);
  border-radius: 999px;
}
.encounter-entry i {
  font-size: 0.75rem;
  font-style: normal;
  color: var(--blue-deep);
}

.journal-entry {
  background: linear-gradient(100deg, #f4fbff, #fff5fa);
  border-color: #dcecf7;
}
.journal-entry .encounter-icon {
  color: var(--blue-deep);
  background: #fff;
}
.journal-entry b {
  background: linear-gradient(135deg, var(--blue), var(--pink));
}
/*
 * 掉落面板现在是 CollapsibleCard：卡片外壳（边框/圆角/投影）由它提供，
 * 这里只管「内容多长就多高」的 flex 行为与樱花纹理。
 */
.loot {
  position: relative;
  /* 展开内容交给 main 滚动，掉落卡自身绝不因一屏放不下而被压扁。 */
  flex: 0 0 auto;
  min-height: 0;
}

/* 极淡的樱花纹理只填补留白，不影响掉落内容与点击。 */
.loot::after {
  position: absolute;
  inset: 0;
  content: '';
  background-image:
    radial-gradient(circle at 88% 82%, rgb(255 190 216 / 14%) 0 5px, transparent 6px),
    radial-gradient(circle at 78% 92%, rgb(159 216 247 / 13%) 0 4px, transparent 5px),
    radial-gradient(circle at 93% 94%, rgb(255 190 216 / 11%) 0 3px, transparent 4px),
    radial-gradient(circle at 70% 78%, rgb(255 190 216 / 9%) 0 3px, transparent 4px);
  pointer-events: none;
}

.loot > * {
  position: relative;
  z-index: 1;
}

.loot-sigil {
  display: grid;
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  place-items: center;
  color: #fff;
  background: linear-gradient(145deg, #ffb4d1, #f5799f);
  border: 1px solid rgb(255 255 255 / 88%);
  border-radius: 8px;
  box-shadow: 0 3px 8px rgb(245 121 159 / 24%);
}

/* 折叠态速览：最新一件 + 好货 chips，一行读完这轮的收获 */
.peek-drop {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  vertical-align: middle;
}

.peek-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  object-fit: contain;
  filter: drop-shadow(0 1px 2px rgb(24 38 52 / 18%));
}

.peek-name {
  overflow: hidden;
  max-width: 108px;
  font-size: 11px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.peek-empty {
  font-size: 10px;
  color: var(--text-dim);
}

.peek-drop + .q-chip,
.q-chip + .q-chip {
  margin-left: 4px;
}

.loot-body {
  padding: 0 clamp(10px, 3.2vw, 13px) clamp(10px, 3.2vw, 13px);
}

.loot-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 7px;
  padding-top: 2px;
  border-top: 1px solid var(--hairline);
}

.loot-toolbar small {
  overflow: hidden;
  font-size: 9px;
  color: var(--text-dim);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.loot-toolbar button {
  min-height: 30px;
  flex-shrink: 0;
  padding: 0 9px;
  font-size: 9px;
  color: var(--blue-deep);
  background: var(--blue-soft);
  border-radius: 10px;
  transition:
    transform var(--t-fast) var(--ease-spring),
    background-color var(--t-mid) var(--ease-soft);
}

.loot-toolbar button:active {
  transform: scale(0.92);
  background: #d9ecfd;
}

.loot-empty {
  display: flex;
  align-items: center;
  flex-direction: column;
  gap: 3px;
  padding: 18px 16px;
  color: var(--text-dim);
  text-align: center;
}

.loot-empty svg {
  margin-bottom: 2px;
  color: var(--pink);
  opacity: 0.75;
}

.loot-empty strong {
  font-size: 12px;
  font-weight: 800;
  color: var(--text-mid);
}

.loot-empty small {
  font-size: 10px;
}

/* 兜底轻提示：装备已不在背包等情况 */
.loot-toast {
  position: absolute;
  bottom: 14px;
  left: 50%;
  z-index: 30;
  max-width: 88%;
  padding: 8px 15px;
  font-size: 11px;
  color: #fff;
  text-align: center;
  background: rgb(70 89 107 / 92%);
  border-radius: 999px;
  transform: translateX(-50%);
}

/*
 * 展开态的清单限高内滚：掉落再多也不把页面顶长，
 * 小屏手机上滚动发生在卡片内部而不是整页。
 */
.loot-list {
  display: flex;
  max-height: min(42vh, 360px);
  flex-direction: column;
  gap: 5px;
}

.loot-group {
  overflow: hidden;
  flex-shrink: 0;
  background: rgb(255 255 255 / 82%);
  border: 1px solid var(--hairline);
  border-radius: 14px;
  box-shadow: var(--shadow-ambient);
}

.loot-group-head {
  width: 100%;
  min-height: 38px;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 7px;
  padding: 5px 8px;
  text-align: left;
  border-radius: 9px;
  transition: background-color var(--t-mid) var(--ease-soft);
}

.loot-group-head:active {
  background: var(--panel-3);
}

.loot-category {
  padding: 3px 8px;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.03em;
  color: var(--pink-deep);
  background: #fff0f6;
  border: 1px solid rgb(245 121 159 / 20%);
  border-radius: 999px;
}

/* iOS 分组列表式的分类色：一眼区分掉落类型。 */
.loot-category.cat-material {
  color: #2f7fc4;
  background: #e9f5ff;
  border-color: rgb(63 163 232 / 20%);
}

.loot-category.cat-consumable {
  color: #1f9c78;
  background: #e8faf3;
  border-color: rgb(143 224 200 / 30%);
}

.loot-category.cat-fragment {
  color: #9a6b1c;
  background: #fff6dd;
  border-color: rgb(255 200 96 / 34%);
}

.loot-category.cat-currency {
  color: #b0582e;
  background: #ffeee4;
  border-color: rgb(255 180 84 / 30%);
}

.loot-summary {
  font-size: 9px;
  color: var(--text-dim);
}

.loot-group-head svg {
  color: var(--text-dim);
  transition: transform 0.18s ease;
}

.loot-group-head svg.folded {
  transform: rotate(-90deg);
}

.loot-items {
  padding: 0 4px 4px;
  border-top: 1px solid var(--hairline);
}

.loot-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: clamp(6px, 2vw, 9px);
  width: 100%;
  min-height: 40px;
  padding: 4px clamp(6px, 2vw, 9px) 4px 11px;
  font-size: clamp(11px, 3.1vw, 12.5px);
  text-align: left;
  cursor: pointer;
  background: linear-gradient(
    100deg,
    color-mix(in srgb, currentcolor 7%, transparent),
    transparent 46%
  );
  border-radius: 10px;
  animation: loot-row-pop 0.42s var(--ease-ios) both;
  animation-delay: var(--row-delay, 0ms);
}

/*
 * 品质色条。
 *
 * 原本整行只有名字带颜色，一屏十几条扫下来全是灰底白字，
 * 稀有的那件和普通材料在余光里毫无区别。左侧一道 3px 的色条
 * 成本最低 —— 不占宽度、不抢名字的注意力，却能让「这行不一样」
 * 在扫视时立刻成立。currentcolor 直接继承 .q-* 已有的品质色，
 * 不需要再写一遍七种品质的分支。
 */
.loot-row::before {
  position: absolute;
  top: 8px;
  bottom: 8px;
  left: 3px;
  width: 3px;
  content: '';
  background: currentcolor;
  border-radius: 999px;
  opacity: 0.55;
}

.loot-row:active {
  background: linear-gradient(
    100deg,
    color-mix(in srgb, currentcolor 13%, transparent),
    transparent 52%
  );
}

@keyframes loot-row-pop {
  0% {
    opacity: 0;
    transform: translateY(6px) scale(0.98);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* 紫装以上的掉落行带品质色柔光底，扫一眼就知道出了好货。 */
.loot-row.q-epic {
  background: linear-gradient(90deg, rgb(171 111 224 / 10%), transparent 72%);
}

.loot-row.q-legendary {
  background: linear-gradient(90deg, rgb(255 154 60 / 12%), transparent 72%);
}

.loot-row.q-mythic {
  background: linear-gradient(90deg, rgb(255 107 122 / 12%), transparent 72%);
}

.loot-row.q-prismatic {
  background: linear-gradient(
    90deg,
    rgb(255 107 157 / 11%),
    rgb(85 185 243 / 9%) 44%,
    transparent 78%
  );
}

.loot-row.q-divine {
  background: linear-gradient(90deg, rgb(232 172 31 / 14%), transparent 72%);
}

/* currentColor 来自行上的品质类，形成紧凑的稀有度提示。 */
.loot-row::before {
  width: 3px;
  height: 16px;
  margin-right: -2px;
  flex-shrink: 0;
  content: '';
  background: currentColor;
  border-radius: 2px;
  opacity: 0.65;
}

.loot-row:nth-child(odd):not(.q-epic):not(.q-legendary):not(.q-mythic):not(.q-prismatic):not(
    .q-divine
  ) {
  background: rgb(247 250 253 / 80%);
}

.loot-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 数量做成药丸：右端有了固定形状，长短不一的数字才不会显得参差 */
.loot-count {
  flex-shrink: 0;
  padding: 2px 7px;
  font-size: 0.92em;
  font-weight: 700;
  color: var(--text-mid);
  background: color-mix(in srgb, currentcolor 8%, rgb(255 255 255 / 72%));
  border-radius: 999px;
}

.loot-fold-enter-from,
.loot-fold-leave-to {
  opacity: 0;
  transform: translateY(-5px);
}

.loot-fold-enter-active,
.loot-fold-leave-active {
  transition:
    opacity var(--t-mid) var(--ease-soft),
    transform var(--t-mid) var(--ease-soft);
}

/* ── 小屏手机适配：压缩纵向占用，首屏尽量看到战斗画面 + 掉落速览 ── */
@media (max-height: 740px) {
  .idle {
    gap: 8px;
  }

  .stage-bar {
    min-height: 56px;
    padding: 9px 12px;
  }

  .stage-name {
    font-size: 16px;
  }

  .efficiency-row {
    padding: 6px 10px;
  }

  .idle-stats {
    padding: 5px 13px 8px;
  }

  .loot-list {
    max-height: min(38vh, 320px);
  }
}

@media (max-width: 350px) {
  .idle {
    gap: 8px;
  }

  .stage-bar {
    min-height: 54px;
  }

  .window-chrome {
    padding: 7px 11px 6px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .stage-bar::after,
  .status-dot.running,
  .idle-window.running,
  .loot-spot::after {
    animation: none;
  }

  .cleared,
  .loot-row,
  .loot-spot {
    animation: none;
  }

  .wave-fill,
  .feed-chip,
  .loot-group-head svg {
    transition: none;
  }

  .feed-enter-from,
  .feed-leave-to,
  .loot-fold-enter-from,
  .loot-fold-leave-to {
    transform: none;
  }

  .feed-enter-active,
  .feed-leave-active,
  .feed-move,
  .loot-fold-enter-active,
  .loot-fold-leave-active {
    transition: none;
  }
}
</style>
