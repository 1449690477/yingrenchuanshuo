<script setup lang="ts">
/**
 * 外观体检预览页（dev only，不进入生产构建）。
 *
 * 遍历 EQUIPMENT 注册表按外观分组，用真实 CharacterAppearance 组件渲染
 * 全部套装 × 五职业的穿戴矩阵，配合浏览器截图逐套核对图层位置。
 */
import { computed } from 'vue';
import type { ClassId, EquipmentDef, EquipmentInstance, EquipSlot } from '@/core/types';
import { CLASS_IDS } from '@/core/types';
import { EQUIPMENT } from '@/data/equipment';
import { BOUTIQUE_THEME_LIST } from '@/data/boutique';
import { EQUIPMENT_DUNGEON_TIERS } from '@/data/equipmentDungeonGear';
import { ENHANCE_MAX } from '@/data/constants';
import CharacterAppearance from '@/components/CharacterAppearance.vue';

const allEquipment = Object.values(EQUIPMENT);

function instance(def: EquipmentDef, index: number): EquipmentInstance {
  return {
    uid: `preview-${def.id}-${index}`,
    defId: def.id,
    enhance: 0,
    baseRollPermille: 1000,
    enhanceGainPermille: Array.from({ length: ENHANCE_MAX }, () => 0),
    enhanceLuck: {},
    affixes: [],
    reforgeResonance: 0,
    locked: false,
  };
}

/** 从注册表找一件能穿在 targetClass 身上、且外观为 appearanceId 的装备。 */
function findGear(
  appearanceId: string,
  targetClass: ClassId,
  slot?: EquipSlot,
): EquipmentDef | null {
  const match = (def: EquipmentDef, appearance: string) =>
    def.appearanceId === appearance &&
    (slot === undefined || def.slot === slot) &&
    (!def.classId || def.classId === targetClass);
  // 商店武器/职业专属件的 appearanceId 带职业后缀，先精确匹配再尝试拼接职业后缀
  const candidates = allEquipment.filter((def) => match(def, appearanceId));
  const withClassSuffix = allEquipment.filter((def) =>
    match(def, `${appearanceId}-${targetClass}`),
  );
  const all = [...candidates, ...withClassSuffix];
  // 职业专属优先，其次任意通用件
  return all.find((def) => def.classId === targetClass) ?? all[0] ?? null;
}

type EquippedMap = Partial<Record<EquipSlot, EquipmentInstance>>;

interface PreviewCell {
  classId: ClassId;
  equipped: EquippedMap | null;
  note?: string;
}

interface PreviewRow {
  title: string;
  subtitle: string;
  cells: PreviewCell[];
}

const VISIBLE_SLOTS: readonly EquipSlot[] = ['body', 'shoes', 'head', 'weapon'];

function suiteCells(appearancePrefix: string): PreviewCell[] {
  return CLASS_IDS.map((classId) => {
    const equipped: EquippedMap = {};
    let count = 0;
    for (const slot of VISIBLE_SLOTS) {
      const def = findGear(`${appearancePrefix}-${slot}`, classId, slot);
      if (def) {
        equipped[slot] = instance(def, count);
        count += 1;
      }
    }
    return { classId, equipped: count > 0 ? equipped : null };
  });
}

function singleSlotCells(appearanceId: string, slot: EquipSlot): PreviewCell[] {
  return CLASS_IDS.map((classId) => {
    const def = findGear(appearanceId, classId, slot);
    return { classId, equipped: def ? { [slot]: instance(def, 0) } : null };
  });
}

const allRows = computed<PreviewRow[]>(() => {
  const result: PreviewRow[] = [];

  for (const theme of BOUTIQUE_THEME_LIST) {
    result.push({
      title: `商店 · ${theme.name}`,
      subtitle: `boutique-${theme.id}（全套可见槽）`,
      cells: suiteCells(`boutique-${theme.id}`),
    });
    // 帽饰单穿行：只叠 head，专门核对帽位
    result.push({
      title: `${theme.name} · 只戴帽`,
      subtitle: `boutique-${theme.id}-head（base + head）`,
      cells: singleSlotCells(`boutique-${theme.id}-head`, 'head'),
    });
    result.push({
      title: `${theme.name} · 只穿鞋`,
      subtitle: `boutique-${theme.id}-shoes（base-noshoes + shoes）`,
      cells: singleSlotCells(`boutique-${theme.id}-shoes`, 'shoes'),
    });
    result.push({
      title: `${theme.name} · 只穿裙`,
      subtitle: `boutique-${theme.id}-body（老四职业 base + body；樱酱整身 replacement）`,
      cells: singleSlotCells(`boutique-${theme.id}-body`, 'body'),
    });
    result.push({
      title: `${theme.name} · 只持武`,
      subtitle: `boutique-${theme.id}-weapon（base + weapon）`,
      cells: singleSlotCells(`boutique-${theme.id}-weapon`, 'weapon'),
    });
  }

  for (const regionId of ['r1', 'r2', 'r3', 'r4', 'r5']) {
    result.push({
      title: `区域 · ${regionId}`,
      subtitle: `${regionId}-body/head/weapon`,
      cells: suiteCells(regionId),
    });
    result.push({
      title: `区域 ${regionId} · 只戴头`,
      subtitle: `${regionId}-head`,
      cells: singleSlotCells(`${regionId}-head`, 'head'),
    });
  }

  result.push({
    title: '区域 · r5 绯焰六件套',
    subtitle: 'r5-set-body/head/weapon',
    cells: suiteCells('r5-set'),
  });
  result.push({
    title: '区域 r5 绯焰套 · 只持武',
    subtitle: 'r5-set-weapon（剑 / 杖 / 扇 / 爪）',
    cells: singleSlotCells('r5-set-weapon', 'weapon'),
  });

  for (const tier of EQUIPMENT_DUNGEON_TIERS) {
    result.push({
      title: `副本 · ${tier.setName}`,
      subtitle: `dungeon-${tier.id}（replacement + head/weapon）`,
      cells: suiteCells(`dungeon-${tier.id}`),
    });
  }

  return result;
});

/** ?rows=0,3,7 只渲染指定行：截图时避免整页 250+ 图并发导致部分图层未载完。 */
const rows = computed<PreviewRow[]>(() => {
  const params = new URLSearchParams(window.location.search);
  const filter = params.get('rows');
  if (!filter) return allRows.value;
  const picked = new Set(
    filter
      .split(',')
      .map((entry) => Number.parseInt(entry, 10))
      .filter((entry) => Number.isFinite(entry)),
  );
  return allRows.value.filter((_, index) => picked.has(index));
});

const CLASS_LABEL: Record<ClassId, string> = {
  swordsman: '剑士',
  witch: '魔女',
  shaman: '萨满',
  catkin: '喵喵',
  kenshi: '樱酱',
};
</script>

<template>
  <div class="preview-page">
    <header class="page-head">
      <h1>外观体检矩阵（dev only）</h1>
      <p>每格 200×300，真实 CharacterAppearance 组件渲染；BASE 与线上一致。</p>
    </header>

    <section v-for="row in rows" :key="row.title" class="preview-row">
      <h2>
        {{ row.title }} <small>{{ row.subtitle }}</small>
      </h2>
      <div class="cell-grid">
        <figure v-for="cell in row.cells" :key="cell.classId" class="cell">
          <div class="stage">
            <CharacterAppearance
              v-if="cell.equipped"
              :class-id="cell.classId"
              :level="20"
              :equipped="cell.equipped as never"
              variant="showcase"
              action="idle"
              reduce-motion
            />
            <span v-else class="skip">无此职业件</span>
          </div>
          <figcaption>{{ CLASS_LABEL[cell.classId] }}</figcaption>
        </figure>
      </div>
    </section>
  </div>
</template>

<style scoped>
.preview-page {
  padding: 16px;
  color: #26303f;
  font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

.page-head h1 {
  margin: 0;
  font-size: 18px;
}

.page-head p {
  margin: 4px 0 0;
  color: #7a8494;
  font-size: 11px;
}

.preview-row {
  margin-top: 18px;
  padding: 10px 12px 14px;
  background: #fff;
  border: 1px solid #dfe5ee;
  border-radius: 12px;
}

.preview-row h2 {
  margin: 0 0 10px;
  font-size: 14px;
}

.preview-row h2 small {
  margin-left: 8px;
  color: #8a93a5;
  font-size: 10px;
  font-weight: 400;
}

.cell-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.cell {
  margin: 0;
  text-align: center;
}

.stage {
  position: relative;
  width: 200px;
  height: 300px;
  overflow: hidden;
  background: radial-gradient(circle at 50% 88%, #ffffff 0%, #f4f7fc 62%, #e8eef7 100%);
  border: 1px solid #dfe5ee;
  border-radius: 10px;
}

.skip {
  position: absolute;
  inset: 0;
  display: grid;
  color: #a3abba;
  font-size: 11px;
  place-items: center;
}

.cell figcaption {
  margin-top: 4px;
  color: #59637a;
  font-size: 11px;
}
</style>
