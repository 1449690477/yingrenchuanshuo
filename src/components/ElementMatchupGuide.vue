<script setup lang="ts">
import { computed } from 'vue';
import type { Element } from '@/core/types';
import { elementMatchupPresentation } from '@/ui/elementMatchupPresentation';

const props = withDefaults(
  defineProps<{
    attackerElement: Element;
    defenderElement: Element;
    context?: 'battle' | 'chapter' | 'weapon';
    compact?: boolean;
  }>(),
  {
    context: 'battle',
    compact: false,
  },
);

const matchup = computed(() =>
  elementMatchupPresentation(props.attackerElement, props.defenderElement),
);

const attackerCaption = computed(() => (props.context === 'weapon' ? '这件武器' : '我方武器'));
const defenderCaption = computed(() => (props.context === 'chapter' ? '本章敌人' : '当前敌人'));
const title = computed(() => {
  if (props.context === 'weapon') return '对当前关卡';
  if (props.context === 'chapter') return '属性预览';
  return '属性关系';
});
</script>

<template>
  <aside
    class="element-guide"
    :class="[`is-${matchup.relation}`, { compact }]"
    :aria-label="`${title}：${matchup.badge}，${matchup.detail}`"
  >
    <span class="guide-glow" aria-hidden="true" />
    <div class="guide-axis">
      <span class="guide-title">{{ title }}</span>
      <span class="element-side">
        <i class="element-sigil" :class="`el-${matchup.attacker}`" aria-hidden="true">
          {{ matchup.attackerLabel.slice(0, 1) }}
        </i>
        <span>
          <small>{{ attackerCaption }}</small>
          <b>{{ matchup.attackerLabel }}</b>
        </span>
      </span>
      <span class="axis-mark" aria-hidden="true">×</span>
      <span class="element-side enemy">
        <i class="element-sigil" :class="`el-${matchup.defender}`" aria-hidden="true">
          {{ matchup.defenderLabel.slice(0, 1) }}
        </i>
        <span>
          <small>{{ defenderCaption }}</small>
          <b>{{ matchup.defenderLabel }}</b>
        </span>
      </span>
      <strong class="relation-badge">{{ matchup.badge }}</strong>
    </div>
    <div v-if="!compact" class="guide-copy">
      <strong>{{ matchup.summary }}</strong>
      <span>{{ matchup.detail }}</span>
    </div>
    <span v-else class="compact-tip">{{ matchup.detail }}</span>
  </aside>
</template>

<style scoped>
.element-guide {
  --guide-accent: #78a9d8;
  --guide-soft: rgb(218 238 255 / 76%);
  position: relative;
  isolation: isolate;
  display: grid;
  gap: 8px;
  min-width: 0;
  padding: 10px 12px;
  overflow: hidden;
  color: #4e596d;
  background:
    linear-gradient(125deg, rgb(255 255 255 / 90%), rgb(244 250 255 / 75%)), var(--guide-soft);
  border: 1px solid color-mix(in srgb, var(--guide-accent) 26%, white);
  border-radius: 16px;
  box-shadow:
    0 8px 22px rgb(72 109 146 / 8%),
    inset 0 1px 0 rgb(255 255 255 / 92%);
  backdrop-filter: blur(14px) saturate(1.16);
}

.element-guide.is-advantage {
  --guide-accent: #f272a6;
  --guide-soft: rgb(255 224 239 / 82%);
}

.element-guide.is-disadvantage {
  --guide-accent: #9b83d9;
  --guide-soft: rgb(235 228 255 / 84%);
}

.element-guide.is-neutral {
  --guide-accent: #77a9d4;
  --guide-soft: rgb(220 239 255 / 80%);
}

.guide-glow {
  position: absolute;
  z-index: -1;
  width: 84px;
  height: 84px;
  top: -44px;
  right: 7%;
  border-radius: 50%;
  background: color-mix(in srgb, var(--guide-accent) 34%, transparent);
  filter: blur(20px);
  animation: guide-breathe 3.2s ease-in-out infinite;
}

.guide-axis {
  display: grid;
  grid-template-columns: auto minmax(72px, 1fr) 12px minmax(72px, 1fr) auto;
  align-items: center;
  gap: 7px;
  min-width: 0;
}

.guide-title {
  align-self: start;
  padding-top: 2px;
  color: #8a95a9;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.04em;
  white-space: nowrap;
}

.element-side {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.element-side > span {
  display: grid;
  min-width: 0;
  line-height: 1.08;
}

.element-side small {
  color: #97a1b4;
  font-size: 9px;
  white-space: nowrap;
}

.element-side b {
  margin-top: 3px;
  color: #526077;
  font-size: 12px;
  white-space: nowrap;
}

.element-sigil {
  display: grid;
  flex: 0 0 27px;
  width: 27px;
  height: 27px;
  place-items: center;
  color: white;
  font-size: 11px;
  font-style: normal;
  font-weight: 900;
  border: 1px solid rgb(255 255 255 / 88%);
  border-radius: 10px 12px 10px 13px;
  box-shadow:
    0 4px 10px rgb(75 91 122 / 14%),
    inset 0 1px 3px rgb(255 255 255 / 64%);
  transform: rotate(-3deg);
}

.el-fire {
  background: linear-gradient(145deg, #ff9b80, #ed5f91);
}

.el-ice {
  background: linear-gradient(145deg, #8edcf0, #689fe4);
}

.el-thunder {
  background: linear-gradient(145deg, #ccb1ff, #8d78de);
}

.el-none {
  color: #8794a8;
  background: linear-gradient(145deg, #eef3f7, #cbd6e1);
}

.axis-mark {
  color: #b4bdca;
  font-size: 11px;
  font-weight: 900;
  text-align: center;
}

.relation-badge {
  padding: 5px 8px;
  color: color-mix(in srgb, var(--guide-accent) 82%, #4d5462);
  font-size: 10px;
  line-height: 1;
  white-space: nowrap;
  background: color-mix(in srgb, var(--guide-soft) 58%, white);
  border: 1px solid color-mix(in srgb, var(--guide-accent) 28%, white);
  border-radius: 999px;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 90%);
}

.guide-copy {
  display: flex;
  align-items: baseline;
  gap: 7px;
  min-width: 0;
  padding-left: 1px;
}

.guide-copy strong {
  flex: 0 0 auto;
  color: color-mix(in srgb, var(--guide-accent) 72%, #4a5567);
  font-size: 11px;
}

.guide-copy span,
.compact-tip {
  min-width: 0;
  overflow: hidden;
  color: #7d899e;
  font-size: 10px;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.element-guide.compact {
  gap: 5px;
  padding: 8px 9px;
  border-radius: 13px;
}

.compact .guide-axis {
  grid-template-columns: auto minmax(64px, 1fr) 10px minmax(64px, 1fr) auto;
  gap: 5px;
}

.compact .guide-title {
  display: none;
}

.compact .element-sigil {
  flex-basis: 24px;
  width: 24px;
  height: 24px;
  border-radius: 9px 10px 9px 11px;
}

@keyframes guide-breathe {
  0%,
  100% {
    opacity: 0.48;
    transform: scale(0.92);
  }
  50% {
    opacity: 0.76;
    transform: scale(1.08);
  }
}

@media (max-width: 340px) {
  .guide-axis,
  .compact .guide-axis {
    grid-template-columns: minmax(66px, 1fr) 9px minmax(66px, 1fr) auto;
  }

  .guide-title {
    display: none;
  }

  .element-side small {
    font-size: 8px;
  }

  .relation-badge {
    max-width: 78px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

@media (prefers-reduced-motion: reduce) {
  .guide-glow {
    animation: none;
  }
}
</style>
