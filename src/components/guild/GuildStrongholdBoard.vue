<script setup lang="ts">
import { computed } from 'vue';
import { Castle, CheckCircle2, Gift, Lock, Sparkles, Swords, WalletCards } from '@lucide/vue';
import { GUILD_DONATION_AMOUNTS, GUILD_STRONGHOLD_STAGES } from '@/data/guildStronghold';
import { GUILD_STRONGHOLD_SCENE_ASSET } from '@/data/guildScenes';
import type { GuildShopOfferState, GuildStrongholdState } from '@/net/guildStronghold';

const props = defineProps<{
  state: GuildStrongholdState | null;
  busy: boolean;
}>();
const emit = defineEmits<{
  donate: [amount: number];
  claim: [offerId: GuildShopOfferState['id']];
  expedition: [];
}>();
const strongholdSceneUrl = `${import.meta.env.BASE_URL}${GUILD_STRONGHOLD_SCENE_ASSET}`;

const stage = computed(
  () =>
    GUILD_STRONGHOLD_STAGES.find((item) => item.id === props.state?.stronghold.stageId) ??
    GUILD_STRONGHOLD_STAGES[0],
);
const nextStage = computed(
  () => GUILD_STRONGHOLD_STAGES.find((item) => item.minProgress > stage.value.minProgress) ?? null,
);
const stageProgress = computed(() => {
  if (!props.state || !nextStage.value) return 100;
  const span = Math.max(1, nextStage.value.minProgress - stage.value.minProgress);
  return Math.min(
    100,
    Math.round(((props.state.stronghold.progress - stage.value.minProgress) / span) * 100),
  );
});

function canClaim(offer: GuildShopOfferState): boolean {
  return (
    !props.busy &&
    !offer.locked &&
    !offer.claimed &&
    (props.state?.meritBalance ?? 0) >= offer.meritCost
  );
}
</script>

<template>
  <article class="stronghold-board panel" aria-labelledby="stronghold-title">
    <header class="stronghold-heading">
      <span id="stronghold-title" class="stronghold-title"
        ><Castle :size="17" aria-hidden="true" />赛季据点</span
      >
      <span v-if="state" class="merit-pill num"
        ><WalletCards :size="14" aria-hidden="true" />功勋 {{ state.meritBalance }}</span
      >
    </header>

    <template v-if="state">
      <section class="stage-card" :class="`stage-${stage.id}`">
        <img class="stage-scene" :src="strongholdSceneUrl" alt="" aria-hidden="true" />
        <i class="stage-shade" aria-hidden="true" />
        <i class="stage-energy" aria-hidden="true" />
        <div class="stage-copy">
          <small>S1 · {{ stage.name }}</small>
          <strong>{{ stage.description }}</strong>
        </div>
        <span class="stage-mark" aria-hidden="true"><Sparkles :size="21" /></span>
        <div class="stage-progress">
          <span>{{ nextStage ? `距「${nextStage.name}」` : '本季据点已抵达最高阶段' }}</span>
          <b class="num">{{ state.stronghold.progress }}</b>
        </div>
        <div
          class="season-track"
          role="progressbar"
          :aria-valuenow="state.stronghold.progress"
          :aria-valuemin="stage.minProgress"
          :aria-valuemax="
            nextStage?.minProgress ?? Math.max(stage.minProgress, state.stronghold.progress)
          "
        >
          <i :style="{ width: `${stageProgress}%` }" />
        </div>
        <small class="stage-stats"
          >{{ state.stronghold.commissionDays }} 次建设 ·
          {{ state.stronghold.raidClears }} 次团本突破 ·
          {{ state.stronghold.donatedMerits }} 点捐献</small
        >
      </section>

      <section class="donation-box" aria-label="功勋捐献">
        <div>
          <strong>把功勋投入据点</strong>
          <small>捐献只推进本季据点；不会影响角色属性或挂机收益。</small>
        </div>
        <div class="donation-actions">
          <button
            v-for="amount in GUILD_DONATION_AMOUNTS"
            :key="amount"
            :disabled="busy || state.meritBalance < amount"
            @click="emit('donate', amount)"
          >
            +{{ amount }}
          </button>
        </div>
      </section>

      <section class="shop-box" aria-labelledby="shop-title">
        <div class="shop-heading">
          <span id="shop-title"><Gift :size="16" aria-hidden="true" />功勋收藏</span>
          <small>全程由服务器保管</small>
        </div>
        <ul>
          <li
            v-for="offer in state.offers"
            :key="offer.id"
            :class="{ locked: offer.locked, claimed: offer.claimed }"
          >
            <span class="offer-icon" aria-hidden="true">
              <CheckCircle2 v-if="offer.claimed" :size="18" />
              <Lock v-else-if="offer.locked" :size="17" />
              <Gift v-else :size="17" />
            </span>
            <span class="offer-copy">
              <strong>{{ offer.name }}</strong>
              <small>{{ offer.description }}</small>
            </span>
            <button
              v-if="!offer.claimed"
              :disabled="!canClaim(offer)"
              @click="emit('claim', offer.id)"
            >
              <span class="num">{{ offer.meritCost }}</span>
              {{ offer.locked ? '未开放' : '收藏' }}
            </button>
            <span v-else class="claimed-copy">已收藏</span>
          </li>
        </ul>
      </section>

      <p class="stronghold-note">
        <Swords :size="14" aria-hidden="true" />
        团本的服务端评分会产出功勋；建设完成与团本突破会共同推进据点。
      </p>
      <button class="stronghold-go" @click="emit('expedition')">
        <Swords :size="17" aria-hidden="true" />前往公会团本
      </button>
    </template>

    <div v-else class="stronghold-pending">
      <span><Castle :size="19" aria-hidden="true" /></span>
      <div>
        <strong>赛季据点准备中</strong>
        <p>服务器更新后会自动开放；原有公会远征和挂机不会受影响。</p>
      </div>
    </div>
  </article>
</template>

<style scoped>
.stronghold-board {
  padding: 0.9rem;
  overflow: hidden;
}
.stronghold-heading,
.stronghold-title,
.merit-pill,
.donation-actions,
.shop-heading,
.stronghold-note,
.stronghold-go,
.stronghold-pending {
  display: flex;
  align-items: center;
}
.stronghold-heading {
  justify-content: space-between;
  gap: 0.6rem;
}
.stronghold-title {
  gap: 0.35rem;
  color: #52728a;
  font-size: 0.82rem;
  font-weight: 850;
  letter-spacing: 0.02em;
}
.stronghold-title svg {
  color: #d985aa;
}
.merit-pill {
  gap: 0.25rem;
  padding: 0.26rem 0.46rem;
  border: 1px solid #f0d9ad;
  border-radius: 999px;
  color: #b78440;
  background: #fff9ed;
  font-size: 0.67rem;
  font-weight: 800;
  white-space: nowrap;
}
.stage-card {
  isolation: isolate;
  position: relative;
  min-height: 11.25rem;
  margin-top: 0.72rem;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 0.78rem;
  overflow: hidden;
  color: #fff;
  border: 1px solid rgb(255 255 255 / 82%);
  border-radius: 0.95rem;
  background: #607f9a;
  box-shadow: 0 0.55rem 1.2rem rgb(64 96 121 / 17%);
}
.stage-scene,
.stage-shade {
  position: absolute;
  z-index: -2;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.stage-scene {
  object-fit: cover;
  object-position: 57% 52%;
  transform: scale(1.02);
  animation: stronghold-drift 12s ease-in-out infinite alternate;
}
.stage-shade {
  z-index: -1;
  background:
    linear-gradient(90deg, rgb(20 49 72 / 68%), rgb(30 59 82 / 26%) 58%, rgb(52 42 72 / 18%)),
    linear-gradient(180deg, rgb(12 36 58 / 4%) 25%, rgb(17 40 59 / 84%) 100%);
}
.stage-energy {
  position: absolute;
  z-index: 0;
  top: 12%;
  right: 13%;
  width: 3.5rem;
  height: 3.5rem;
  border: 1px solid rgb(181 238 255 / 46%);
  border-radius: 50%;
  box-shadow:
    0 0 1.1rem rgb(113 220 255 / 42%),
    inset 0 0 0.8rem rgb(234 154 255 / 28%);
  animation: energy-pulse 2.8s ease-in-out infinite;
  pointer-events: none;
}
@keyframes stronghold-drift {
  from {
    transform: scale(1.02) translate3d(0, 0, 0);
  }
  to {
    transform: scale(1.07) translate3d(-0.25rem, -0.12rem, 0);
  }
}
@keyframes energy-pulse {
  0%,
  100% {
    opacity: 0.35;
    transform: scale(0.86);
  }
  50% {
    opacity: 0.9;
    transform: scale(1.08);
  }
}
.stage-copy,
.stage-progress,
.stage-stats,
.season-track {
  position: relative;
  z-index: 1;
}
.stage-copy {
  padding: 0.55rem 2.6rem 0.52rem 0.6rem;
  background: rgb(17 44 65 / 48%);
  border: 1px solid rgb(255 255 255 / 22%);
  border-radius: 0.72rem;
  backdrop-filter: blur(7px);
}
.stage-copy small,
.stage-copy strong {
  display: block;
}
.stage-copy small {
  color: rgb(255 255 255 / 78%);
  font-size: 0.64rem;
}
.stage-copy strong {
  margin-top: 0.13rem;
  color: #fff;
  font-size: 0.74rem;
  line-height: 1.4;
}
.stage-mark {
  position: absolute;
  z-index: 1;
  top: 0.72rem;
  right: 0.68rem;
  display: grid;
  width: 1.95rem;
  height: 1.95rem;
  place-items: center;
  border: 1px solid rgb(255 255 255 / 56%);
  border-radius: 0.68rem;
  color: #fff;
  background: rgb(34 58 80 / 38%);
  box-shadow: 0 0 0.8rem rgb(189 226 255 / 24%);
  backdrop-filter: blur(8px);
}
.stage-progress {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  margin-top: 0.62rem;
  color: rgb(255 255 255 / 82%);
  font-size: 0.65rem;
}
.stage-progress b {
  color: #ffd3e8;
}
.season-track {
  height: 0.48rem;
  margin-top: 0.28rem;
  overflow: hidden;
  border: 1px solid rgb(255 255 255 / 22%);
  border-radius: 999px;
  background: rgb(18 45 65 / 56%);
}
.season-track i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #72bfe3, #d88ec3 62%, #f0bb6d);
  transition: width 0.35s ease;
}
.stage-stats {
  display: block;
  margin-top: 0.42rem;
  color: rgb(255 255 255 / 76%);
  font-size: 0.61rem;
  line-height: 1.45;
}
.donation-box {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.55rem;
  align-items: center;
  margin-top: 0.58rem;
  padding: 0.6rem;
  border: 1px solid #dcebe1;
  border-radius: 0.78rem;
  background: linear-gradient(115deg, #f8fdf9, #f1faf6);
}
.donation-box strong,
.donation-box small {
  display: block;
}
.donation-box strong {
  color: #5d7e70;
  font-size: 0.71rem;
}
.donation-box small {
  margin-top: 0.13rem;
  color: #79978a;
  font-size: 0.61rem;
  line-height: 1.35;
}
.donation-actions {
  gap: 0.28rem;
}
.donation-actions button {
  min-width: 2.5rem;
  min-height: 2.75rem;
  border: 1px solid #cce5d6;
  border-radius: 0.62rem;
  color: #4f9a71;
  background: #fff;
  font-size: 0.68rem;
  font-weight: 850;
}
.donation-actions button:disabled {
  color: #afc3b7;
  background: #f3f8f5;
}
.shop-box {
  margin-top: 0.62rem;
  padding: 0.66rem;
  border: 1px solid #e4ebf1;
  border-radius: 0.82rem;
  background: rgb(251 253 255 / 0.76);
}
.shop-heading {
  justify-content: space-between;
  gap: 0.5rem;
  color: #55768d;
  font-size: 0.71rem;
  font-weight: 850;
}
.shop-heading > span {
  display: inline-flex;
  gap: 0.3rem;
  align-items: center;
}
.shop-heading svg {
  color: #d985aa;
}
.shop-heading small {
  color: #90a4b1;
  font-size: 0.61rem;
  font-weight: 650;
}
.shop-box ul {
  display: grid;
  gap: 0.38rem;
  margin: 0.52rem 0 0;
  padding: 0;
  list-style: none;
}
.shop-box li {
  display: grid;
  grid-template-columns: 2.05rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.45rem;
  padding: 0.4rem 0.1rem;
  border-top: 1px solid #edf2f5;
}
.shop-box li:first-child {
  border-top: 0;
}
.offer-icon {
  display: grid;
  width: 2.05rem;
  height: 2.05rem;
  place-items: center;
  border: 1px solid #e3e8ef;
  border-radius: 0.6rem;
  color: #d886ab;
  background: #fff;
}
.offer-copy {
  min-width: 0;
}
.offer-copy strong,
.offer-copy small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.offer-copy strong {
  color: #607e92;
  font-size: 0.69rem;
}
.offer-copy small {
  margin-top: 0.1rem;
  color: #92a5b1;
  font-size: 0.59rem;
}
.shop-box li > button {
  min-width: 3.75rem;
  min-height: 2.75rem;
  border: 1px solid #d4e5ee;
  border-radius: 0.62rem;
  color: #5d91ad;
  background: #f4faff;
  font-size: 0.63rem;
  font-weight: 850;
}
.shop-box li > button .num {
  color: #c9865b;
}
.shop-box li > button:disabled {
  color: #a7b8c3;
  background: #f5f7f8;
}
.shop-box li.claimed .offer-icon {
  color: #63af83;
  border-color: #cee8d8;
}
.shop-box li.locked .offer-icon {
  color: #a9b7c2;
}
.claimed-copy {
  color: #65a985;
  font-size: 0.63rem;
  font-weight: 800;
}
.stronghold-note {
  gap: 0.32rem;
  margin: 0.65rem 0.1rem 0;
  color: #7891a0;
  font-size: 0.63rem;
  line-height: 1.45;
}
.stronghold-note svg {
  flex: none;
  color: #d889ad;
}
.stronghold-go {
  justify-content: center;
  gap: 0.4rem;
  width: 100%;
  min-height: 2.75rem;
  margin-top: 0.6rem;
  border: 0;
  border-radius: 0.82rem;
  color: #fff;
  background: linear-gradient(135deg, #6cade0, #d985ad);
  box-shadow: 0 0.32rem 0.82rem rgb(110 171 218 / 0.2);
  font-size: 0.76rem;
  font-weight: 850;
}
.stronghold-go:active {
  transform: translateY(1px);
}
.stronghold-go:focus-visible,
.donation-actions button:focus-visible,
.shop-box li > button:focus-visible {
  outline: 0.18rem solid rgb(112 174 217 / 0.35);
  outline-offset: 0.13rem;
}
.stronghold-pending {
  gap: 0.6rem;
  margin-top: 0.68rem;
  padding: 0.7rem;
  border: 1px dashed #d9e7ef;
  border-radius: 0.78rem;
  background: #f6fafd;
}
.stronghold-pending > span {
  display: grid;
  flex: none;
  width: 2.1rem;
  height: 2.1rem;
  place-items: center;
  border-radius: 0.7rem;
  color: #9cbccc;
  background: #e8f2f7;
}
.stronghold-pending strong {
  color: #5c7d94;
  font-size: 0.72rem;
}
.stronghold-pending p {
  margin: 0.16rem 0 0;
  color: var(--text-dim);
  font-size: 0.64rem;
  line-height: 1.45;
}
@media (max-width: 350px) {
  .donation-box {
    grid-template-columns: 1fr;
  }
  .donation-actions {
    justify-content: flex-end;
  }
}
@media (prefers-reduced-motion: reduce) {
  .season-track i,
  .stage-scene,
  .stage-energy {
    animation: none;
    transition: none;
  }
  .stronghold-go:active {
    transform: none;
  }
}
</style>
