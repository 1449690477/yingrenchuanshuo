<script setup lang="ts">
/** 公会详情底部弹层：名片、公告、本周远征进度与公开名册；未加入者在此加入。 */
import { computed } from 'vue';
import { Crown, Swords, Users, X } from '@lucide/vue';
import { abbr } from '@/core/format';
import { guildDisplayStage } from '@/core/guildExpedition';
import { useGuildStore } from '@/stores/guild';
import { crestInitial, crestTintClass } from './guildCrest';

const guild = useGuildStore();

const detail = computed(() => guild.detail);
const stage = computed(() => guildDisplayStage(detail.value?.guild.reputation ?? 0));
const isMine = computed(
  () => Boolean(detail.value) && guild.membership?.guild.id === detail.value?.guild.id,
);
const isFull = computed(() =>
  detail.value ? detail.value.guild.memberCount >= detail.value.guild.memberLimit : false,
);
const expeditionPct = computed(() => {
  const run = detail.value?.expedition;
  if (!run) return 0;
  return Math.min(100, Math.round((run.progress / Math.max(1, run.target)) * 100));
});

async function join() {
  if (detail.value) await guild.joinGuild(detail.value.guild.id);
}
</script>

<template>
  <Transition name="sheet-pop">
    <div
      v-if="guild.detailGuildId"
      class="sheet-backdrop"
      aria-label="公会详情"
      @click.self="guild.closeDetail"
    >
      <section class="sheet">
        <i class="sheet-handle" aria-hidden="true" />
        <button class="sheet-close" aria-label="关闭公会详情" @click="guild.closeDetail">
          <X :size="18" aria-hidden="true" />
        </button>

        <div v-if="guild.detailLoading && !detail" class="sheet-skeleton" aria-live="polite">
          <i class="sk-crest" />
          <i class="sk-line w-60" />
          <i class="sk-line w-40" />
          <i class="sk-block" />
        </div>

        <template v-else-if="detail">
          <header class="sheet-head">
            <span class="sheet-crest" :class="crestTintClass(detail.guild.name)" aria-hidden="true">
              {{ crestInitial(detail.guild.name) }}
            </span>
            <div class="sheet-identity">
              <small class="stage-chip">{{ stage.name }}</small>
              <h3>{{ detail.guild.name }}</h3>
              <p v-if="detail.guild.leaderName">会长 · {{ detail.guild.leaderName }}</p>
            </div>
            <span class="rep-pill num">声望 {{ abbr(detail.guild.reputation) }}</span>
          </header>

          <blockquote v-if="detail.guild.notice" class="sheet-notice">
            「{{ detail.guild.notice }}」
          </blockquote>

          <div class="sheet-stats">
            <div>
              <strong class="num">{{ detail.guild.memberCount }}/{{ detail.guild.memberLimit }}</strong>
              <small>同行成员</small>
            </div>
            <div>
              <strong class="num">{{ abbr(detail.guild.reputation) }}</strong>
              <small>公会声望</small>
            </div>
            <div>
              <strong class="num">{{ detail.guild.expeditionClears }}</strong>
              <small>完成远征</small>
            </div>
          </div>

          <div v-if="detail.expedition" class="sheet-expedition">
            <div class="expedition-copy">
              <span><Swords :size="13" aria-hidden="true" />本周远征</span>
              <strong class="num">{{ expeditionPct }}%</strong>
            </div>
            <div class="expedition-track" aria-hidden="true">
              <i :style="{ width: `${expeditionPct}%` }" />
            </div>
            <small v-if="detail.expedition.completed" class="expedition-done">
              本周首领已被突破 ✦
            </small>
          </div>

          <div v-if="detail.members.length" class="sheet-roster">
            <div class="roster-heading">
              <Users :size="14" aria-hidden="true" />成员名册
            </div>
            <div class="roster-scroll scroll-y">
              <div v-for="member in detail.members" :key="member.userId" class="roster-row">
                <span class="roster-avatar" aria-hidden="true">{{ crestInitial(member.displayName) }}</span>
                <strong>
                  {{ member.displayName }}
                  <Crown v-if="member.role === 'leader'" :size="13" aria-hidden="true" />
                </strong>
                <small class="num">Lv.{{ member.level }} · 战力 {{ abbr(member.combatPower) }}</small>
              </div>
            </div>
          </div>
          <p v-else-if="guild.detailUnsupported" class="roster-pending">
            完整名册将在后端更新后开放，敬请期待。
          </p>

          <footer class="sheet-foot">
            <span v-if="isMine" class="mine-badge">我的公会</span>
            <button v-else-if="isFull" class="sheet-join" disabled>已满员</button>
            <button v-else class="sheet-join" :disabled="guild.mutating" @click="join">
              加入这座樱庭
            </button>
          </footer>
        </template>
      </section>
    </div>
  </Transition>
</template>

<style scoped>
.sheet-backdrop {
  position: absolute;
  z-index: 40;
  inset: 0;
  display: flex;
  align-items: flex-end;
  background: rgb(70 89 107 / 32%);
  backdrop-filter: blur(3px);
}
.sheet {
  position: relative;
  width: 100%;
  max-height: 82%;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  padding: 1.5rem 0.9rem calc(0.9rem + var(--sab));
  overflow-y: auto;
  background:
    radial-gradient(120% 60% at 85% 0%, var(--pink-soft) 0%, transparent 55%),
    radial-gradient(120% 60% at 8% 4%, var(--blue-soft) 0%, transparent 50%), #fff;
  border: 1px solid var(--glass-brd);
  border-bottom: 0;
  border-radius: 1.4rem 1.4rem 0 0;
  box-shadow: 0 -0.6rem 2rem rgb(70 89 107 / 18%);
}
.sheet-handle {
  position: absolute;
  top: 0.5rem;
  left: 50%;
  width: 2.6rem;
  height: 0.28rem;
  background: #d9e7f2;
  border-radius: 999px;
  transform: translateX(-50%);
}
.sheet-close {
  position: absolute;
  top: 0.55rem;
  right: 0.6rem;
  min-width: 2.75rem;
  min-height: 2.75rem;
  display: grid;
  place-items: center;
  color: var(--text-dim);
  border-radius: 0.8rem;
}
.sheet-head {
  display: grid;
  grid-template-columns: 3.4rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.7rem;
  padding-top: 0.35rem;
}
.sheet-crest {
  width: 3.4rem;
  height: 3.4rem;
  display: grid;
  place-items: center;
  font-size: 1.25rem;
  font-weight: 900;
  color: #fff;
  text-shadow: 0 1px 3px rgb(70 89 107 / 30%);
  border: 2px solid rgb(255 255 255 / 85%);
  border-radius: 1.1rem;
  box-shadow: var(--shadow);
}
.sheet-identity {
  min-width: 0;
}
.stage-chip {
  padding: 0.14rem 0.5rem;
  font-size: 0.58rem;
  font-weight: 800;
  color: #8a6fb8;
  background: #f1ecfd;
  border: 1px solid #e2d8f8;
  border-radius: 999px;
}
.sheet-identity h3 {
  margin: 0.25rem 0 0.1rem;
  font-size: 1.02rem;
  color: var(--text);
}
.sheet-identity p {
  margin: 0;
  font-size: 0.66rem;
  color: var(--text-dim);
}
.rep-pill {
  padding: 0.32rem 0.55rem;
  font-size: 0.62rem;
  font-weight: 800;
  color: #5d7f9a;
  background: var(--blue-soft);
  border: 1px solid #d8ecfa;
  border-radius: 999px;
  white-space: nowrap;
}
.sheet-notice {
  margin: 0;
  padding: 0.6rem 0.75rem;
  font-size: 0.72rem;
  line-height: 1.6;
  color: var(--text-mid);
  background: rgb(255 255 255 / 78%);
  border: 1px dashed #e3d5ef;
  border-radius: 0.9rem;
}
.sheet-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.45rem;
}
.sheet-stats > div {
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  padding: 0.65rem 0.3rem;
  background: rgb(255 255 255 / 82%);
  border: 1px solid var(--line);
  border-radius: 0.85rem;
}
.sheet-stats strong {
  font-size: 0.86rem;
  color: #52728a;
}
.sheet-stats small {
  font-size: 0.6rem;
  color: var(--text-dim);
}
.sheet-expedition {
  padding: 0.65rem 0.75rem;
  background: rgb(255 255 255 / 82%);
  border: 1px solid var(--line);
  border-radius: 0.9rem;
}
.expedition-copy {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.68rem;
  color: var(--text-mid);
}
.expedition-copy span {
  display: flex;
  align-items: center;
  gap: 0.3rem;
}
.expedition-copy strong {
  color: #d2608c;
}
.expedition-track {
  height: 0.45rem;
  overflow: hidden;
  margin-top: 0.4rem;
  background: #ecf3fa;
  border-radius: 999px;
}
.expedition-track i {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, var(--blue), var(--pink));
  border-radius: inherit;
  transition: width 0.5s var(--ease-soft);
}
.expedition-done {
  display: block;
  margin-top: 0.35rem;
  font-size: 0.6rem;
  color: #d2608c;
}
.sheet-roster {
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: rgb(255 255 255 / 82%);
  border: 1px solid var(--line);
  border-radius: 0.9rem;
  overflow: hidden;
}
.roster-heading {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.55rem 0.75rem;
  font-size: 0.72rem;
  font-weight: 800;
  color: var(--text-mid);
  border-bottom: 1px solid var(--line);
}
.roster-scroll {
  max-height: 11.5rem;
}
.roster-row {
  min-height: 2.9rem;
  display: grid;
  grid-template-columns: 2rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.75rem;
  border-bottom: 1px solid #f2f7fc;
}
.roster-row:last-child {
  border-bottom: 0;
}
.roster-avatar {
  width: 2rem;
  height: 2rem;
  display: grid;
  place-items: center;
  font-size: 0.72rem;
  font-weight: 800;
  color: #b76688;
  background: linear-gradient(145deg, #fff0f6, #eaf6ff);
  border-radius: 50%;
}
.roster-row strong {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  overflow: hidden;
  font-size: 0.74rem;
  color: var(--text);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.roster-row strong svg {
  flex-shrink: 0;
  color: #e8a43c;
}
.roster-row small {
  font-size: 0.6rem;
  color: var(--text-dim);
  white-space: nowrap;
}
.roster-pending {
  margin: 0;
  padding: 0.9rem;
  font-size: 0.68rem;
  line-height: 1.6;
  text-align: center;
  color: var(--text-dim);
  background: rgb(255 255 255 / 70%);
  border: 1px dashed var(--line-strong);
  border-radius: 0.9rem;
}
.sheet-foot {
  display: flex;
}
.sheet-join,
.mine-badge {
  min-height: 2.75rem;
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0 0.9rem;
  font-size: 0.82rem;
  font-weight: 800;
  border-radius: 0.9rem;
}
.sheet-join {
  color: #fff;
  background: linear-gradient(120deg, var(--blue-deep), var(--pink-deep));
  box-shadow: 0 0.4rem 0.9rem rgb(126 160 200 / 30%);
  transition:
    transform var(--t-fast) var(--ease-spring),
    filter var(--t-mid) var(--ease-soft);
}
.sheet-join:active:not(:disabled) {
  transform: scale(0.96);
}
.sheet-join:disabled {
  color: var(--text-dim);
  background: #eef4f9;
  box-shadow: none;
}
.mine-badge {
  color: #d2608c;
  background: var(--pink-soft);
  border: 1px solid #ffd5e4;
}
/* 骨架屏 */
.sheet-skeleton {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding-top: 0.5rem;
}
.sheet-skeleton i {
  display: block;
  background: linear-gradient(90deg, #eef4fa 25%, #f8fbfe 50%, #eef4fa 75%);
  background-size: 200% 100%;
  border-radius: 0.7rem;
  animation: sk-shine 1.4s ease infinite;
}
.sk-crest {
  width: 3.4rem;
  height: 3.4rem;
}
.sk-line {
  height: 0.8rem;
}
.sk-line.w-60 {
  width: 60%;
}
.sk-line.w-40 {
  width: 40%;
}
.sk-block {
  height: 4.5rem;
}
@keyframes sk-shine {
  from {
    background-position: 200% 0;
  }
  to {
    background-position: -200% 0;
  }
}
/* 弹层过渡：背板淡入 + 面板弹簧上滑 */
.sheet-pop-enter-from .sheet {
  transform: translateY(100%);
}
.sheet-pop-enter-from.sheet-backdrop,
.sheet-pop-leave-to.sheet-backdrop {
  opacity: 0;
}
.sheet-pop-enter-active,
.sheet-pop-leave-active {
  transition: opacity var(--t-mid) ease;
}
.sheet-pop-enter-active .sheet {
  transition: transform var(--t-slow) var(--ease-spring);
}
.sheet-pop-leave-active .sheet {
  transition: transform var(--t-fast) ease-in;
  transform: translateY(100%);
}
@media (prefers-reduced-motion: reduce) {
  .sheet-skeleton i {
    animation: none;
  }
  .expedition-track i {
    transition: none;
  }
  .sheet-pop-enter-active .sheet,
  .sheet-pop-leave-active .sheet {
    transition: none;
    transform: none;
  }
}
</style>
