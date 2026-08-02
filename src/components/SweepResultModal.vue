<script setup lang="ts">
/**
 * 扫荡结果汇总（M3-7）。
 *
 * 展示口径与 OfflineModal 保持一致 —— 两者本质是同一件事：
 * 「一段没有实时观战的产出」。玩家不该在两个入口看到两套写法。
 */
import { computed } from 'vue';
import { Coins, Star, Swords, Zap } from '@lucide/vue';
import { abbr } from '@/core/format';
import { usePlayerStore } from '@/stores/player';
import { getEquipment, requireEquipment } from '@/data/equipment';
import { equipmentDisplayPresentation } from '@/data/equipmentPresentation';
import { requireItem } from '@/data/items';
import EquipmentIcon from '@/components/EquipmentIcon.vue';
import ItemIcon from '@/components/ItemIcon.vue';
import type { SweepResult } from '@/stores/game';

const props = defineProps<{ result: SweepResult }>();
defineEmits<{ close: [] }>();

const player = usePlayerStore();
const activeClassId = computed(() => {
  const classId = player.player?.classId;
  if (!classId) throw new Error('[扫荡结算错误] 存档未载入，无法解析装备职业外观');
  return classId;
});

/** 与离线弹窗同规：按数量排序、只展示前 8 条，避免弹窗过长。 */
const drops = computed(() =>
  [...props.result.yield.loot]
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
        name: equipmentDisplayPresentation(eq, activeClassId.value).name,
        count: d.count,
        quality: requireEquipment(d.itemId).quality,
        isEquip: true,
      };
    }),
);
</script>

<template>
  <Transition name="modal-pop" appear>
    <div class="overlay" @click.self="$emit('close')">
      <div class="sheet">
        <div class="top">
          <div class="sparkle">
            <Zap :size="30" :stroke-width="2" aria-hidden="true" />
          </div>
          <h3>扫荡完成</h3>
          <p class="sub">
            扫荡 {{ result.times }} 次 · 消耗体力 {{ result.staminaSpent }}
          </p>
        </div>

        <div class="gains">
          <div class="gain exp">
            <span class="g-icon" aria-hidden="true">
              <Star :size="15" :stroke-width="2.2" />
            </span>
            <span class="g-label">经验</span>
            <span class="g-value num">+{{ abbr(result.yield.exp) }}</span>
          </div>
          <div class="gain gold">
            <span class="g-icon" aria-hidden="true">
              <Coins :size="15" :stroke-width="2.2" />
            </span>
            <span class="g-label">金币</span>
            <span class="g-value num">+{{ abbr(result.yield.gold) }}</span>
          </div>
          <div class="gain kills">
            <span class="g-icon" aria-hidden="true">
              <Swords :size="15" :stroke-width="2.2" />
            </span>
            <span class="g-label">击杀</span>
            <span class="g-value num">{{ abbr(result.yield.kills) }}</span>
          </div>
        </div>

        <div v-if="drops.length > 0" class="drops">
          <div class="drops-head">掉落 · 共 {{ result.yield.loot.length }} 种</div>
          <div class="drop-list">
            <div v-for="(d, i) in drops" :key="i" class="drop">
              <EquipmentIcon
                v-if="d.isEquip"
                :def="requireEquipment(d.itemId)"
                :class-id="activeClassId"
                size="sm"
              />
              <ItemIcon v-else :item="requireItem(d.itemId)" />
              <span class="d-name" :class="'q-' + d.quality">{{ d.name }}</span>
              <span class="d-count num">×{{ abbr(d.count) }}</span>
            </div>
          </div>
        </div>
        <!-- 掉落为空不是异常：期望值结算下低概率物品本来就可能一件都不出 -->
        <p v-else class="no-drop">这次没有掉落，经验和金币已入账</p>

        <button class="ok" @click="$emit('close')">收下</button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgb(20 12 24 / 62%);
  backdrop-filter: blur(3px);
}

.sheet {
  width: min(100%, 340px);
  padding: 18px 16px 14px;
  border-radius: 16px;
  background: var(--surface, #fff);
  box-shadow: 0 14px 40px rgb(60 20 60 / 24%);
}

.top {
  display: grid;
  justify-items: center;
  gap: 4px;
  margin-bottom: 14px;
}

.sparkle {
  color: var(--accent, #d9689a);
}

h3 {
  margin: 0;
  font-size: 17px;
}

.sub {
  margin: 0;
  font-size: 12px;
  color: var(--text-dim, #8a7f8a);
}

.gains {
  display: grid;
  gap: 6px;
  margin-bottom: 12px;
}

.gain {
  display: grid;
  grid-template-columns: 22px 1fr auto;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 10px;
  background: var(--surface-2, #faf5fa);
}

.g-label {
  font-size: 12px;
  color: var(--text-dim, #8a7f8a);
}

.g-value {
  font-weight: 700;
}

.drops-head {
  margin-bottom: 6px;
  font-size: 12px;
  color: var(--text-dim, #8a7f8a);
}

.drop-list {
  display: grid;
  gap: 4px;
  max-height: 168px;
  overflow-y: auto;
}

.drop {
  display: grid;
  grid-template-columns: 26px 1fr auto;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.d-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.no-drop {
  margin: 0 0 12px;
  font-size: 12px;
  color: var(--text-dim, #8a7f8a);
  text-align: center;
}

.ok {
  width: 100%;
  margin-top: 12px;
  padding: 10px;
  border: none;
  border-radius: 10px;
  background: var(--accent, #d9689a);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
}
</style>
