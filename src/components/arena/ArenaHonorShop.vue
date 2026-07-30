<script setup lang="ts">
/**
 * ArenaHonorShop —— 荣誉商店（docs/53 §4.1）。
 *
 * 四格货架（武器/头冠/衣装/戒指），每格两条路：
 *   - 荣誉直购（服务端原子扣减，人人可走）
 *   - 圣痕碎片 40 换 1（高段位快车道，本地完成，不是独占路）
 * 套装进度条：穿几件亮几件，提醒「套装效果只在竞技场内生效」。
 */
import { computed, ref } from 'vue';
import { Gem, Shield, Sparkles } from '@lucide/vue';
import { ARENA_FRAGMENT_EXCHANGE_COST } from '@/data/arenaShop';
import { arenaSetPieceCount } from '@/data/arenaEquipment';
import { useArenaStore } from '@/stores/arena';
import { useGameStore } from '@/stores/game';
import { SLOT_ORDER } from '@/data/constants';

const arena = useArenaStore();
const game = useGameStore();

const BASE = import.meta.env.BASE_URL;
const assetUrl = (path: string) => `${BASE}${path}`;

const SLOT_LABELS: Record<string, string> = {
  weapon: '武器',
  head: '头冠',
  body: '衣装',
  ring: '戒指',
};

const honor = computed(() => arena.me?.honor ?? 0);
const setPieces = computed(() =>
  arenaSetPieceCount(SLOT_ORDER.map((s) => game.save?.equipped[s] ?? null)),
);
// 单件拥有检测：背包或穿戴中有该圣痕即标记，货架上直接给「已拥有」角标
const ownedDefIds = computed(() => {
  const bag = game.save?.bag.equipment ?? [];
  const equipped = game.save?.equipped;
  const ids = new Set<string>();
  for (const entry of arena.shopEntries) {
    const defId = entry.definition.id;
    const inBag = bag.some((e) => e.defId === defId);
    const worn = equipped ? SLOT_ORDER.some((s) => equipped[s]?.defId === defId) : false;
    if (inBag || worn) ids.add(defId);
  }
  return ids;
});
const ownedCount = computed(() => ownedDefIds.value.size);

const busyEntry = ref<string | null>(null);

async function onBuy(entryId: string): Promise<void> {
  if (busyEntry.value) return;
  busyEntry.value = entryId;
  try {
    await arena.buyShopEntry(entryId);
  } finally {
    busyEntry.value = null;
  }
}

function onFragmentExchange(defId: string): void {
  if (busyEntry.value) return;
  busyEntry.value = defId;
  try {
    arena.exchangeStigmaFragments(defId);
  } finally {
    busyEntry.value = null;
  }
}
</script>

<template>
  <section class="card honor-shop" aria-label="荣誉商店">
    <header class="shop-head">
      <span class="shop-title"><Sparkles :size="13" aria-hidden="true" />荣誉商店</span>
      <span class="honor-balance">
        <img :src="assetUrl('assets/items/honor_sigil.png')" alt="荣誉印记" class="honor-icon" />
        {{ honor }}
      </span>
    </header>

    <!-- 套装进度：穿几件亮几件 -->
    <div class="set-progress" role="img" :aria-label="`圣痕套 ${setPieces}/4 件`">
      <Shield :size="12" aria-hidden="true" />
      <span class="set-name">圣痕套</span>
      <span class="set-pips">
        <i v-for="n in 4" :key="n" :class="{ lit: n <= setPieces }" />
      </span>
      <span class="set-note">{{ setPieces }}/4 · 套装效果仅在竞技场内生效</span>
      <span v-if="ownedCount > 0" class="set-owned">已拥有 {{ ownedCount }}/4</span>
    </div>

    <div class="shelves">
      <article
        v-for="entry in arena.shopEntries"
        :key="entry.id"
        class="shelf"
        :class="{ owned: ownedDefIds.has(entry.definition.id) }"
      >
        <span v-if="ownedDefIds.has(entry.definition.id)" class="owned-tag">已拥有</span>
        <span class="icon-halo" aria-hidden="true" />
        <img
          :src="assetUrl(entry.definition.icon)"
          :alt="entry.definition.name"
          class="shelf-icon"
        />
        <div class="shelf-info">
          <strong class="shelf-name">{{ entry.definition.name }}</strong>
          <span class="shelf-slot">{{ SLOT_LABELS[entry.slot] }} · 圣痕</span>
        </div>
        <div class="shelf-actions">
          <button
            class="buy-btn"
            type="button"
            :disabled="busyEntry !== null || honor < entry.price"
            @click="onBuy(entry.id)"
          >
            <img :src="assetUrl('assets/items/honor_sigil.png')" alt="" class="btn-icon" />
            {{ entry.price }}
          </button>
          <button
            class="buy-btn frag"
            type="button"
            :disabled="busyEntry !== null || arena.stigmaFragments < ARENA_FRAGMENT_EXCHANGE_COST"
            @click="onFragmentExchange(entry.definition.id)"
          >
            <Gem :size="11" aria-hidden="true" />
            ×{{ ARENA_FRAGMENT_EXCHANGE_COST }}
          </button>
        </div>
      </article>
    </div>

    <footer class="shop-foot">
      <span class="frag-count">
        <Gem :size="11" aria-hidden="true" />圣痕碎片 {{ arena.stigmaFragments }}/{{
          ARENA_FRAGMENT_EXCHANGE_COST
        }}
      </span>
      <span class="shop-hint">碎片来自每日结算的圣痕匣（绯樱及以上）</span>
    </footer>
  </section>
</template>

<style scoped>
.honor-shop {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.shop-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.shop-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 800;
  color: var(--text);
}
.honor-balance {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 15px;
  font-weight: 900;
  color: var(--q-divine);
}
.honor-icon {
  width: 18px;
  height: 18px;
}

.set-progress {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 10px;
  border-radius: var(--r-sm);
  background: linear-gradient(90deg, rgb(232 172 31 / 10%), rgb(255 200 96 / 4%));
  border: 1px solid rgb(232 172 31 / 22%);
  font-size: 11px;
  color: var(--text-mid);
}
.set-name {
  font-weight: 800;
  color: var(--q-divine);
}
.set-pips {
  display: inline-flex;
  gap: 4px;
}
.set-pips i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--line-strong);
  transition:
    background 0.3s,
    box-shadow 0.3s;
}
.set-pips i.lit {
  background: var(--q-divine);
  box-shadow: 0 0 8px rgb(232 172 31 / 60%);
}
.set-owned {
  margin-left: auto;
  font-weight: 700;
  color: var(--text-mid);
}

.shelves {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.shelf {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 12px 10px;
  border-radius: var(--r);
  background: var(--panel-2);
  border: 1px solid var(--line);
  transition:
    transform 0.18s var(--ease-spring),
    box-shadow 0.18s,
    border-color 0.18s;
}
.shelf:active {
  transform: scale(0.97);
}

@media (hover: hover) and (pointer: fine) {
  .shelf:hover {
    border-color: rgb(232 172 31 / 40%);
    box-shadow: 0 6px 16px rgb(96 74 32 / 12%);
    transform: translateY(-2px);
  }
}

/* 已拥有：淡金描边 + 角标，避免重复兑换 */
.shelf.owned {
  border-color: rgb(232 172 31 / 38%);
  background: linear-gradient(180deg, rgb(255 217 138 / 10%), var(--panel-2));
}

.owned-tag {
  position: absolute;
  z-index: 2;
  top: 7px;
  right: 7px;
  padding: 2px 7px;
  font-size: 8px;
  font-weight: 800;
  color: #a0720b;
  background: linear-gradient(150deg, #fbe3a8, #f6cf6a);
  border: 1px solid rgb(255 255 255 / 70%);
  border-radius: 999px;
  box-shadow: 0 2px 6px rgb(232 172 31 / 26%);
}

/* 图标底光晕：货架品的「圣光托底」 */
.icon-halo {
  position: absolute;
  top: 14px;
  width: 72px;
  height: 46px;
  background: radial-gradient(ellipse, rgb(255 200 96 / 30%), transparent 68%);
  pointer-events: none;
}

.shelf-icon {
  width: 56px;
  height: 56px;
  filter: drop-shadow(0 3px 8px rgb(232 172 31 / 30%));
}
.shelf-info {
  text-align: center;
}
.shelf-name {
  display: block;
  font-size: 12px;
  font-weight: 800;
  color: var(--text);
  line-height: 1.3;
}
.shelf-slot {
  font-size: 10px;
  color: var(--text-dim);
}

.shelf-actions {
  display: flex;
  gap: 6px;
}
.buy-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 1px solid rgb(255 255 255 / 55%);
  border-radius: 999px;
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 800;
  color: #fff;
  background: linear-gradient(150deg, #d99a26, #f0c25e 70%, #f6cf6a);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 36%),
    0 3px 10px rgb(217 154 38 / 34%);
  cursor: pointer;
  text-shadow: 0 1px 2px rgb(133 90 12 / 32%);
  transition:
    transform 0.15s var(--ease-spring),
    opacity 0.15s;
}
.buy-btn:active:not(:disabled) {
  transform: scale(0.92);
}
.buy-btn:disabled {
  opacity: 0.38;
  box-shadow: none;
  cursor: default;
}
.buy-btn.frag {
  background: linear-gradient(150deg, #a365dd, #c77ee8);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 36%),
    0 3px 10px rgb(171 111 224 / 30%);
}
.btn-icon {
  width: 13px;
  height: 13px;
}

.shop-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 4px;
  font-size: 11px;
  color: var(--text-dim);
}
.frag-count {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 800;
  color: #ab6fe0;
}

@media (max-width: 340px) {
  .shelf-icon {
    width: 46px;
    height: 46px;
  }
  .shelf-name {
    font-size: 11px;
  }
  .buy-btn {
    padding: 5px 8px;
    font-size: 11px;
  }
}
</style>
