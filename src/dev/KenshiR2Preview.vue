<script setup lang="ts">
/**
 * 樱酱 R2 发布前混穿体检页（dev only，不进入生产入口）。
 *
 * 三组都通过真实 EquipmentDef -> resolveCharacterAppearance -> CharacterAppearance
 * 主流程渲染，用来证明整身 replacement 无内置鞋且异主题独立鞋仍能真实变化。
 */
import type { EquipmentDef, EquipmentInstance, EquipSlot } from '@/core/types';
import { ENHANCE_MAX } from '@/data/constants';
import { EQUIPMENT } from '@/data/equipment';
import CharacterAppearance from '@/components/CharacterAppearance.vue';

type EquippedMap = Partial<Record<EquipSlot, EquipmentInstance>>;

interface MixedCase {
  title: string;
  description: string;
  equipped: EquippedMap;
}

function requireGear(appearanceId: string, slot: EquipSlot): EquipmentDef {
  const gear = Object.values(EQUIPMENT).find(
    (definition) =>
      definition.appearanceId === appearanceId &&
      definition.slot === slot &&
      (!definition.classId || definition.classId === 'kenshi'),
  );
  if (!gear) throw new Error(`[樱酱R2混穿] 找不到 ${appearanceId}/${slot}`);
  return gear;
}

function instance(definition: EquipmentDef, index: number): EquipmentInstance {
  return {
    uid: `kenshi-r2-mixed-${index}-${definition.id}`,
    defId: definition.id,
    enhance: 0,
    baseRollPermille: 1000,
    enhanceGainPermille: Array.from({ length: ENHANCE_MAX }, () => 0),
    enhanceLuck: {},
    affixes: [],
    reforgeResonance: 0,
    locked: false,
  };
}

function mixedCase(
  title: string,
  description: string,
  bodyAppearance: string,
  shoesAppearance: string,
  offset: number,
): MixedCase {
  return {
    title,
    description,
    equipped: {
      body: instance(requireGear(bodyAppearance, 'body'), offset),
      shoes: instance(requireGear(shoesAppearance, 'shoes'), offset + 1),
    },
  };
}

const cases: readonly MixedCase[] = [
  mixedCase('普通区域混穿', 'R1 整身 + R7 独立鞋', 'r1-body', 'r7-shoes', 0),
  mixedCase(
    '精品主题混穿',
    '莓霜整身 + 绯夜独立鞋',
    'boutique-berry-cream-body',
    'boutique-rose-night-shoes',
    2,
  ),
  mixedCase(
    '副本异档混穿',
    '苍蓝整身 + 赤红独立鞋',
    'dungeon-azure-body',
    'dungeon-crimson-shoes',
    4,
  ),
];
</script>

<template>
  <main class="page">
    <header>
      <span class="eyebrow">R2 RELEASE QA</span>
      <h1>樱酱整身 × 独立鞋</h1>
      <p>真实外观解析主流程；每张卡都故意混穿异主题鞋。</p>
    </header>

    <section class="case-grid" aria-label="樱酱混穿验收矩阵">
      <article v-for="item in cases" :key="item.title" class="case-card">
        <div class="stage">
          <CharacterAppearance
            class-id="kenshi"
            :level="52"
            :equipped="item.equipped as never"
            variant="showcase"
            action="idle"
            reduce-motion
          />
        </div>
        <div class="copy">
          <h2>{{ item.title }}</h2>
          <p>{{ item.description }}</p>
          <span>无双鞋 · 鞋型可见变化</span>
        </div>
      </article>
    </section>
  </main>
</template>

<style scoped>
:global(*) {
  box-sizing: border-box;
}

:global(html),
:global(body),
:global(#app) {
  min-width: 0;
  min-height: 100%;
  margin: 0;
}

:global(html) {
  scrollbar-width: none;
}

:global(html::-webkit-scrollbar) {
  display: none;
}

:global(body) {
  overflow-x: hidden;
  background:
    radial-gradient(circle at 12% 0%, rgb(183 229 255 / 70%), transparent 34%),
    linear-gradient(165deg, #f8fbff, #fff4fa 65%, #f2f0ff);
  color: #24324a;
  font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

.page {
  width: min(100%, 430px);
  min-height: 100dvh;
  margin: 0 auto;
  padding: max(18px, env(safe-area-inset-top)) 14px max(18px, env(safe-area-inset-bottom));
}

header {
  padding: 4px 4px 14px;
}

.eyebrow {
  color: #5889c7;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.18em;
}

h1 {
  margin: 4px 0 3px;
  color: #273b65;
  font-size: 22px;
}

header p,
.copy p {
  margin: 0;
  color: #71809a;
  font-size: 11px;
}

.case-grid {
  display: grid;
  gap: 10px;
}

.case-card {
  display: grid;
  grid-template-columns: 112px minmax(0, 1fr);
  align-items: center;
  min-width: 0;
  padding: 8px 10px;
  overflow: hidden;
  border: 1px solid rgb(150 194 235 / 45%);
  border-radius: 18px;
  background: rgb(255 255 255 / 83%);
  box-shadow: 0 8px 22px rgb(91 126 180 / 11%);
}

.stage {
  width: 102px;
  height: 136px;
  margin-inline: auto;
}

.stage :deep(.character-appearance) {
  width: 100%;
  height: 100%;
}

.copy {
  min-width: 0;
  padding-left: 8px;
}

.copy h2 {
  margin: 0 0 4px;
  color: #344d7a;
  font-size: 15px;
}

.copy span {
  display: inline-block;
  margin-top: 9px;
  padding: 4px 7px;
  border-radius: 999px;
  background: #e7f5ff;
  color: #4075a8;
  font-size: 10px;
  font-weight: 700;
}

@media (max-width: 340px) {
  .page {
    padding-inline: 10px;
  }

  .case-card {
    grid-template-columns: 98px minmax(0, 1fr);
    padding-inline: 7px;
  }

  .stage {
    width: 92px;
    height: 124px;
  }
}
</style>
