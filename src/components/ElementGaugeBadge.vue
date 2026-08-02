<script setup lang="ts">
/**
 * 元素印记徽章（docs/83 批 1 感知层）。
 *
 * 战斗 HUD 上的目标元素 + 克制关系小标签；stacks（0~3）由批 3 接入
 * elementGauge 后提供——未提供时不渲染层数（不伪造不存在的机制）。
 * 展示文案全部来自 elementMatchupPresentation（同一真实公式源）。
 */
import { computed } from 'vue';
import type { Element } from '@/core/types';
import { elementMatchupPresentation } from '@/ui/elementMatchupPresentation';

const props = withDefaults(
  defineProps<{
    monsterElement: Element;
    playerElement?: Element;
    /** 印记层数（批 3 提供）；undefined 时不显示层数 */
    stacks?: number;
  }>(),
  { playerElement: 'none', stacks: undefined },
);

const matchup = computed(() =>
  elementMatchupPresentation(props.playerElement, props.monsterElement),
);

const stacksText = computed(() =>
  props.stacks === undefined ? null : `印记 ×${props.stacks}`,
);
</script>

<template>
  <span class="element-gauge-badge" :aria-label="`敌人属性 ${matchup.defenderLabel}，${matchup.badge}`">
    <span class="eg-element">{{ matchup.defenderLabel }}</span>
    <span v-if="matchup.hitTag" class="eg-tag" :class="`eg-${matchup.relation}`">
      {{ matchup.hitTag }}
    </span>
    <span v-if="stacksText !== null" class="eg-stacks">{{ stacksText }}</span>
  </span>
</template>

<style scoped>
.element-gauge-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  line-height: 1;
  padding: 2px 6px;
  border-radius: 8px;
  background: rgb(255 255 255 / 72%);
  color: #3b4252;
  white-space: nowrap;
}

.eg-element {
  font-weight: 800;
}

.eg-tag.eg-advantage {
  color: #2e7d32;
}

.eg-tag.eg-disadvantage {
  color: #c62828;
}

.eg-stacks {
  color: #6a4fb5;
  font-weight: 700;
}
</style>
