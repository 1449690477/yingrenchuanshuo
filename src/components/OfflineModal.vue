<script setup lang="ts">
import { computed } from 'vue';
import { Coins, Sparkles, Star, Swords } from '@lucide/vue';
import { abbr, duration } from '@/core/format';
import { useStageStore } from '@/stores/stage';
import { getEquipment, requireEquipment } from '@/data/equipment';
import { requireItem } from '@/data/items';
import EquipmentIcon from '@/components/EquipmentIcon.vue';
import ItemIcon from '@/components/ItemIcon.vue';

const stage = useStageStore();

const r = computed(() => stage.offlineResult);

/** 掉落按数量排序，只展示前 8 条，避免弹窗过长 */
const drops = computed(() => {
  const list = r.value?.yield.loot ?? [];
  return [...list]
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
    .map((d) => {
      const eq = getEquipment(d.itemId);
      if (!eq) {
        const item = requireItem(d.itemId);
        return {
          itemId: d.itemId,
          name: item.name,
          count: d.count,
          quality: item.tier,
          isEquip: false,
        };
      }
      return {
        itemId: d.itemId,
        name: eq.name,
        count: d.count,
        quality: eq.quality,
        isEquip: true,
      };
    });
});

const moreCount = computed(() => Math.max(0, (r.value?.yield.loot.length ?? 0) - 8));
</script>

<template>
  <Transition name="modal-pop">
    <div v-if="r" class="overlay">
      <div class="sheet">
        <div class="top">
          <div class="sparkle">
            <Sparkles :size="30" :stroke-width="2" aria-hidden="true" />
          </div>
          <h3>欢迎回来</h3>
          <p class="sub">离线 {{ duration(r.seconds) }}，少女帮你打了一会儿</p>
        </div>

        <div class="gains">
          <div class="gain exp">
            <span class="g-icon" aria-hidden="true"><Star :size="15" :stroke-width="2.2" /></span>
            <span class="g-label">经验</span>
            <span class="g-value num">+{{ abbr(r.yield.exp) }}</span>
          </div>
          <div class="gain gold">
            <span class="g-icon" aria-hidden="true"><Coins :size="15" :stroke-width="2.2" /></span>
            <span class="g-label">金币</span>
            <span class="g-value num">+{{ abbr(r.yield.gold) }}</span>
          </div>
          <div class="gain kills">
            <span class="g-icon" aria-hidden="true"><Swords :size="15" :stroke-width="2.2" /></span>
            <span class="g-label">击杀</span>
            <span class="g-value num">{{ abbr(r.yield.kills) }}</span>
          </div>
        </div>

        <div v-if="drops.length > 0" class="drops">
          <div class="drops-head">掉落</div>
          <div class="drop-list">
            <div
              v-for="(d, i) in drops"
              :key="i"
              class="drop row-in"
              :style="{ '--row-delay': `${120 + i * 50}ms` }"
            >
              <EquipmentIcon v-if="d.isEquip" :def="requireEquipment(d.itemId)" size="sm" />
              <ItemIcon v-else :item="requireItem(d.itemId)" />
              <span class="d-name" :class="'q-' + d.quality">
                {{ d.name }}
              </span>
              <span class="d-count num">×{{ abbr(d.count) }}</span>
            </div>
          </div>
          <p v-if="moreCount > 0" class="more">还有 {{ moreCount }} 种物品已放入背包</p>
        </div>

        <p v-if="r.cappedSeconds > 0" class="capped">
          离线收益上限为 8 小时，超出的 {{ duration(r.cappedSeconds) }} 没有计入。
        </p>

        <button class="btn btn-pink take" @click="stage.dismissOffline()">收下</button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.sheet {
  position: relative;
  width: 100%;
  max-width: 340px;
  padding: 26px 18px 18px;
  background: linear-gradient(170deg, #fff, var(--blue-soft));
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-lg);
  text-align: center;
  overflow: hidden;
}

/* 面板顶部品牌渐变条 */
.sheet::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, var(--pink), var(--gold), var(--blue));
}

.top {
  margin-bottom: 16px;
}

.sparkle {
  display: grid;
  place-items: center;
  color: #f1b82f;
  animation: pop 0.5s ease-out;
}

@keyframes pop {
  from {
    transform: scale(0.4);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

h3 {
  margin-top: 4px;
  font-size: 19px;
  font-weight: 800;
  color: var(--pink-deep);
}

.sub {
  margin-top: 3px;
  font-size: 11px;
  color: var(--text-mid);
}

.gains {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}

.gain {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 10px 4px;
  background: #fff;
  border-radius: var(--r-sm);
  box-shadow: var(--shadow-sm);
}

/* 收益类别图标：经验蓝 / 金币金 / 击杀粉 */
.g-icon {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  margin-bottom: 1px;
  border-radius: 50%;
}

.gain.exp .g-icon {
  color: var(--blue-deep);
  background: var(--blue-soft);
}

.gain.gold .g-icon {
  color: #c99214;
  background: #fdf3d7;
}

.gain.kills .g-icon {
  color: var(--pink-deep);
  background: var(--pink-soft);
}

.g-label {
  font-size: 10px;
  color: var(--text-dim);
}

.g-value {
  font-size: 15px;
  font-weight: 800;
  color: var(--blue-deep);
}

.drops {
  padding: 10px;
  margin-bottom: 10px;
  background: #fff;
  border-radius: var(--r-sm);
  text-align: left;
}

.drops-head {
  font-size: 10px;
  color: var(--text-dim);
  margin-bottom: 5px;
}

.drop-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
  max-height: 150px;
  overflow-y: auto;
}

.drop {
  display: flex;
  align-items: center;
  gap: 6px;
  justify-content: space-between;
  font-size: 12px;
}

.d-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.d-count {
  flex-shrink: 0;
  color: var(--text-dim);
}

.more {
  margin-top: 6px;
  font-size: 10px;
  color: var(--text-dim);
}

.capped {
  margin-bottom: 10px;
  font-size: 10px;
  line-height: 1.6;
  color: var(--warn);
}

.take {
  width: 100%;
  padding: 12px;
  font-size: 15px;
}
</style>
