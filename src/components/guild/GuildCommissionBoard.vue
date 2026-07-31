<script setup lang="ts">
import { computed } from 'vue';
import { CheckCircle2, Hammer, Sparkles, Swords, UsersRound } from '@lucide/vue';
import type { GuildCommissionState } from '@/net/guildCommissions';

const props = defineProps<{ state: GuildCommissionState | null }>();
const emit = defineEmits<{ expedition: [] }>();

const completedIds = computed(() => new Set(props.state?.completedCommissionIds ?? []));
const buildPercent = computed(() => {
  if (!props.state) return 0;
  return Math.min(100, Math.round((props.state.progress / Math.max(1, props.state.target)) * 100));
});

function isComplete(id: string): boolean {
  return completedIds.value.has(id);
}
</script>

<template>
  <article class="commission-board panel" aria-labelledby="commission-title">
    <header class="commission-heading">
      <span id="commission-title" class="commission-title"
        ><Hammer :size="17" aria-hidden="true" />今日建设委托</span
      >
      <small v-if="state" class="participant-copy"
        ><UsersRound :size="14" aria-hidden="true" />{{ state.participants }} 人同行</small
      >
    </header>

    <template v-if="state">
      <div class="build-summary">
        <div>
          <small>樱庭建设</small>
          <strong v-if="state.completed"
            ><Sparkles :size="15" aria-hidden="true" />今日已点亮</strong
          >
          <strong v-else>离共同点亮还差 {{ Math.max(0, state.target - state.progress) }}</strong>
        </div>
        <b class="num">{{ state.progress }}/{{ state.target }}</b>
      </div>
      <div
        class="build-track"
        role="progressbar"
        aria-label="今日樱庭建设进度"
        :aria-valuenow="state.progress"
        aria-valuemin="0"
        :aria-valuemax="state.target"
      >
        <i :style="{ width: `${buildPercent}%` }" />
      </div>

      <ol class="commission-list" aria-label="今日可完成的远征委托">
        <li
          v-for="item in state.commissions"
          :key="item.id"
          :class="{ complete: isComplete(item.id) }"
        >
          <span class="commission-icon" aria-hidden="true">
            <CheckCircle2 v-if="isComplete(item.id)" :size="18" />
            <Swords v-else :size="18" />
          </span>
          <span class="commission-copy">
            <strong>{{ item.name }}</strong>
            <small>{{ item.description }}</small>
          </span>
          <span class="commission-value num">{{
            isComplete(item.id) ? '已计入' : `+${item.contribution}`
          }}</span>
        </li>
      </ol>

      <p class="commission-note">
        <CheckCircle2 :size="14" aria-hidden="true" />
        远征评分由服务器复算；委托只建设据点，不发放战力资产。
      </p>
      <button class="commission-go" @click="emit('expedition')">
        <Swords :size="17" aria-hidden="true" />{{
          state.completed ? '查看远征战报' : '去完成远征委托'
        }}
      </button>
    </template>

    <div v-else class="commission-pending">
      <span><Hammer :size="18" aria-hidden="true" /></span>
      <div>
        <strong>建设委托准备中</strong>
        <p>服务器更新后会自动开放；正常挂机和每周远征不会受影响。</p>
      </div>
    </div>
  </article>
</template>

<style scoped>
.commission-board {
  padding: 0.9rem;
  overflow: hidden;
}
.commission-heading,
.build-summary,
.participant-copy,
.commission-note,
.commission-pending,
.commission-go {
  display: flex;
  align-items: center;
}
.commission-heading {
  justify-content: space-between;
  gap: 0.6rem;
}
.commission-title {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: #52728a;
  font-size: 0.82rem;
  font-weight: 850;
  letter-spacing: 0.02em;
}
.commission-title svg {
  color: #e98fb0;
}
.participant-copy {
  gap: 0.25rem;
  color: var(--text-dim);
  font-size: 0.68rem;
  white-space: nowrap;
}
.build-summary {
  justify-content: space-between;
  gap: 0.8rem;
  margin-top: 0.8rem;
}
.build-summary div {
  min-width: 0;
}
.build-summary small,
.build-summary strong {
  display: block;
}
.build-summary small {
  color: #66849a;
  font-size: 0.66rem;
}
.build-summary strong {
  margin-top: 0.14rem;
  color: #54748c;
  font-size: 0.74rem;
}
.build-summary strong svg {
  vertical-align: -0.16em;
  color: #e998b8;
}
.build-summary b {
  color: #d9769e;
  font-size: 0.78rem;
  white-space: nowrap;
}
.build-track {
  height: 0.52rem;
  margin: 0.45rem 0 0.72rem;
  overflow: hidden;
  border: 1px solid #e3edf4;
  border-radius: 999px;
  background: #edf4f8;
  box-shadow: inset 0 0.08rem 0.18rem rgb(107 151 179 / 0.08);
}
.build-track i {
  display: block;
  height: 100%;
  min-width: 0.28rem;
  border-radius: inherit;
  background: linear-gradient(90deg, #77bfe2, #d98fce 58%, #f2b368);
  box-shadow: 0 0 0.5rem rgb(218 143 195 / 0.42);
  transition: width 0.35s ease;
}
.commission-list {
  display: grid;
  gap: 0.4rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.commission-list li {
  display: grid;
  grid-template-columns: 2.25rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  padding: 0.5rem 0.55rem;
  border: 1px solid #dfebf2;
  border-radius: 0.76rem;
  background: linear-gradient(110deg, rgb(247 251 253 / 0.98), rgb(240 248 252 / 0.92));
}
.commission-list li.complete {
  border-color: #d9e8cf;
  background: linear-gradient(110deg, #f7fcf7, #edf8f0);
}
.commission-icon {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  place-items: center;
  border: 1px solid #dce9f0;
  border-radius: 0.68rem;
  color: #d985aa;
  background: #fff;
}
.complete .commission-icon {
  border-color: #c9e4d0;
  color: #65b98c;
}
.commission-copy {
  min-width: 0;
}
.commission-copy strong,
.commission-copy small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.commission-copy strong {
  color: #54748c;
  font-size: 0.75rem;
}
.commission-copy small {
  margin-top: 0.12rem;
  color: var(--text-dim);
  font-size: 0.65rem;
}
.commission-value {
  color: #d9769e;
  font-size: 0.68rem;
  white-space: nowrap;
}
.complete .commission-value {
  color: #5cae83;
}
.commission-note {
  gap: 0.32rem;
  margin: 0.7rem 0.1rem 0;
  color: #7690a0;
  font-size: 0.65rem;
  line-height: 1.45;
}
.commission-note svg {
  flex: none;
  color: #70b996;
}
.commission-go {
  justify-content: center;
  gap: 0.4rem;
  width: 100%;
  min-height: 2.75rem;
  margin-top: 0.68rem;
  border: 0;
  border-radius: 0.82rem;
  color: #fff;
  background: linear-gradient(135deg, #6eafd7, #de87b0);
  box-shadow: 0 0.35rem 0.85rem rgb(112 168 211 / 0.2);
  font-size: 0.77rem;
  font-weight: 850;
}
.commission-go:active {
  transform: translateY(1px);
}
.commission-go:focus-visible {
  outline: 0.18rem solid rgb(105 174 215 / 0.35);
  outline-offset: 0.14rem;
}
.commission-pending {
  gap: 0.6rem;
  margin-top: 0.7rem;
  padding: 0.72rem;
  border: 1px dashed #d9e7ef;
  border-radius: 0.78rem;
  background: #f5f9fc;
}
.commission-pending > span {
  display: grid;
  flex: none;
  width: 2.1rem;
  height: 2.1rem;
  place-items: center;
  border-radius: 0.7rem;
  color: #9cbccc;
  background: #e8f2f7;
}
.commission-pending strong {
  color: #5c7d94;
  font-size: 0.73rem;
}
.commission-pending p {
  margin: 0.18rem 0 0;
  color: var(--text-dim);
  font-size: 0.66rem;
  line-height: 1.45;
}
@media (prefers-reduced-motion: reduce) {
  .build-track i,
  .commission-go {
    transition: none;
  }
  .commission-go:active {
    transform: none;
  }
}
</style>
