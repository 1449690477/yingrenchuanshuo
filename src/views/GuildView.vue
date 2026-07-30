<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import {
  ArrowLeft,
  Castle,
  Crown,
  LogOut,
  Plus,
  RefreshCw,
  ScrollText,
  Shield,
  Swords,
  UserMinus,
  Users,
} from '@lucide/vue';
import { abbr } from '@/core/format';
import { guildDisplayStage } from '@/core/guildExpedition';
import { useGuildStore } from '@/stores/guild';
import { GUILD_NAME_MAX_LENGTH, GUILD_NOTICE_MAX_LENGTH } from '@/data/guildRules';

const emit = defineEmits<{ close: [] }>();
const guild = useGuildStore();
const backButton = ref<HTMLButtonElement | null>(null);
const activeTab = ref<'home' | 'expedition' | 'members'>('home');
const newGuildName = ref('');
const noticeDraft = ref('');
const showCreate = ref(false);
const confirmLeave = ref(false);

const stage = computed(() => guildDisplayStage(guild.membership?.guild.reputation ?? 0));
const progressPct = computed(() => {
  const run = guild.expedition?.expedition;
  if (!run) return 0;
  return Math.min(100, Math.round((run.progress / Math.max(1, run.target)) * 100));
});

onMounted(async () => {
  await nextTick();
  backButton.value?.focus();
  await guild.refresh();
  noticeDraft.value = guild.membership?.guild.notice ?? '';
});

async function create() {
  if (await guild.createGuild(newGuildName.value.trim())) {
    newGuildName.value = '';
    showCreate.value = false;
    noticeDraft.value = guild.membership?.guild.notice ?? '';
  }
}

async function join(id: string) {
  if (await guild.joinGuild(id)) noticeDraft.value = guild.membership?.guild.notice ?? '';
}

async function saveNotice() {
  if (await guild.updateNotice(noticeDraft.value)) {
    noticeDraft.value = guild.membership?.guild.notice ?? '';
  }
}

async function leave() {
  if (await guild.leaveGuild()) {
    confirmLeave.value = false;
    activeTab.value = 'home';
  }
}
</script>

<template>
  <section class="guild-view" role="region" aria-label="公会">
    <header class="guild-top">
      <button ref="backButton" class="icon-button" aria-label="返回更多" @click="emit('close')">
        <ArrowLeft :size="19" aria-hidden="true" />
      </button>
      <span class="title-copy">
        <strong>樱庭公会</strong>
        <small>各自挂机，也能共同留下传说</small>
      </span>
      <button
        class="icon-button"
        :disabled="guild.loading"
        aria-label="刷新公会状态"
        @click="guild.refresh"
      >
        <RefreshCw :size="18" :class="{ spinning: guild.loading }" aria-hidden="true" />
      </button>
    </header>

    <main class="guild-scroll scroll-y">
      <div v-if="guild.status === 'unconfigured'" class="state-card offline-card">
        <Shield :size="28" aria-hidden="true" />
        <strong>联机公会尚未配置</strong>
        <p>当前版本仍可正常挂机；部署 Supabase 迁移与公会函数后，这里会自动开放。</p>
      </div>

      <div v-else-if="guild.loading && !guild.membership" class="state-card" aria-live="polite">
        <RefreshCw class="spinning" :size="25" aria-hidden="true" />
        <strong>正在寻找附近的樱庭…</strong>
      </div>

      <template v-else-if="!guild.membership">
        <section class="welcome-banner">
          <i class="petal petal-a" aria-hidden="true" />
          <i class="petal petal-b" aria-hidden="true" />
          <span class="banner-icon"><Castle :size="30" /></span>
          <div>
            <small>异步共享世界 · 首批试运行</small>
            <h2>找一群旅伴，共同挑战每周首领</h2>
            <p>不要求同时在线，不会暂停挂机。首版只有荣誉与据点外观，没有战力奖励。</p>
          </div>
        </section>

        <p v-if="guild.lastError" class="error-strip" role="status">{{ guild.lastError }}</p>

        <section class="panel create-panel">
          <button class="panel-heading action-heading" @click="showCreate = !showCreate">
            <span><Plus :size="17" />建立新的樱庭</span>
            <small>{{ showCreate ? '收起' : '免费创建' }}</small>
          </button>
          <div v-if="showCreate" class="create-form">
            <label for="guild-name">公会名称</label>
            <input
              id="guild-name"
              v-model="newGuildName"
              :maxlength="GUILD_NAME_MAX_LENGTH"
              placeholder="2～12 个字"
              autocomplete="off"
            />
            <button
              class="primary-button"
              :disabled="guild.mutating || newGuildName.trim().length < 2"
              @click="create"
            >
              点亮第一盏樱灯
            </button>
          </div>
        </section>

        <section class="panel">
          <div class="panel-heading">
            <span><Users :size="17" />开放中的公会</span>
            <small>{{ guild.guilds.length }} 个可加入</small>
          </div>
          <div v-if="guild.guilds.length" class="guild-list">
            <article v-for="item in guild.guilds" :key="item.id" class="guild-row">
              <span class="crest"><Castle :size="20" /></span>
              <div class="row-copy">
                <strong>{{ item.name }}</strong>
                <p>{{ item.notice || '会长还没有写公告' }}</p>
                <small
                  >{{ item.memberCount }}/{{ item.memberLimit }} 人 · 声望
                  {{ abbr(item.reputation) }}</small
                >
              </div>
              <button class="join-button" :disabled="guild.mutating" @click="join(item.id)">
                加入
              </button>
            </article>
          </div>
          <p v-else class="empty-copy">暂时没有开放公会。你可以成为第一位会长。</p>
        </section>
      </template>

      <template v-else>
        <section class="guild-banner">
          <div class="crest-large"><Castle :size="30" /></div>
          <div class="guild-identity">
            <small
              >{{ stage.name }} · {{ guild.membership.guild.memberCount }}/{{
                guild.membership.guild.memberLimit
              }}
              人</small
            >
            <h2>{{ guild.membership.guild.name }}</h2>
            <p>{{ stage.description }}</p>
          </div>
          <span class="rep-pill">声望 {{ abbr(guild.membership.guild.reputation) }}</span>
        </section>

        <nav class="guild-tabs" aria-label="公会页面">
          <button :class="{ active: activeTab === 'home' }" @click="activeTab = 'home'">
            <Castle :size="16" />首页
          </button>
          <button :class="{ active: activeTab === 'expedition' }" @click="activeTab = 'expedition'">
            <Swords :size="16" />远征
          </button>
          <button :class="{ active: activeTab === 'members' }" @click="activeTab = 'members'">
            <Users :size="16" />成员
          </button>
        </nav>

        <p v-if="guild.lastError" class="error-strip" role="status">{{ guild.lastError }}</p>

        <section v-if="activeTab === 'home'" class="tab-stack">
          <article class="panel">
            <div class="panel-heading">
              <span><ScrollText :size="17" />公会公告</span>
            </div>
            <template v-if="guild.isLeader">
              <textarea
                v-model="noticeDraft"
                :maxlength="GUILD_NOTICE_MAX_LENGTH"
                rows="3"
                placeholder="写下本周想和大家一起做的事"
              />
              <div class="panel-actions">
                <small>{{ noticeDraft.length }}/{{ GUILD_NOTICE_MAX_LENGTH }}</small>
                <button class="soft-button" :disabled="guild.mutating" @click="saveNotice">
                  保存公告
                </button>
              </div>
            </template>
            <p v-else class="notice-copy">
              {{ guild.membership.guild.notice || '会长还没有写公告' }}
            </p>
          </article>

          <article class="stat-grid">
            <div>
              <strong>{{ guild.membership.guild.expeditionClears }}</strong
              ><small>完成远征</small>
            </div>
            <div>
              <strong>{{ guild.membership.guild.memberCount }}</strong
              ><small>同行成员</small>
            </div>
            <div>
              <strong>{{ stage.name }}</strong
              ><small>据点阶段</small>
            </div>
          </article>

          <article class="panel boundary-note">
            <Shield :size="20" />
            <div>
              <strong>首版不出售成长</strong>
              <p>公会不会增加攻击、掉率或离线收益，先让合作本身变得好玩。</p>
            </div>
          </article>
        </section>

        <section v-else-if="activeTab === 'expedition'" class="tab-stack">
          <article v-if="guild.expedition" class="boss-card">
            <div class="boss-orbit" aria-hidden="true"><i /><i /></div>
            <span class="boss-tag"
              >{{ guild.expedition.boss.bracketName }} · {{ guild.expedition.boss.tiltName }}</span
            >
            <h3>{{ guild.expedition.boss.name }}</h3>
            <p>{{ guild.expedition.boss.hint }}</p>
            <div class="progress-copy">
              <span>全会远征进度</span><strong>{{ progressPct }}%</strong>
            </div>
            <div
              class="progress-track"
              role="progressbar"
              :aria-valuenow="guild.expedition.expedition.progress"
              aria-valuemin="0"
              :aria-valuemax="guild.expedition.expedition.target"
            >
              <i :style="{ width: `${progressPct}%` }" />
            </div>
            <small class="progress-numbers">
              {{ abbr(guild.expedition.expedition.progress) }} /
              {{ abbr(guild.expedition.expedition.target) }} 贡献
            </small>
            <button
              class="challenge-button"
              :disabled="!guild.canChallenge"
              @click="guild.challenge"
            >
              <Swords :size="18" />
              {{
                guild.challenging
                  ? '服务端正在复算…'
                  : guild.attemptsLeft > 0
                    ? `发起远征 · 今日 ${guild.attemptsLeft} 次`
                    : '今日远征已完成'
              }}
            </button>
            <small class="fair-note">只取今日最高贡献；换装后重试只补差额，不重复累加。</small>
          </article>

          <article v-if="guild.lastResult" class="result-card" aria-live="polite">
            <button class="result-close" aria-label="收起战果" @click="guild.clearResult">×</button>
            <small>本次远征战果</small>
            <strong>+{{ guild.lastResult.improvedBy }} 公会贡献</strong>
            <p>
              造成 {{ abbr(guild.lastResult.damage) }} 伤害 · 本次评分 {{ guild.lastResult.points }}
            </p>
            <em v-if="guild.lastResult.justCompleted">本周首领已突破，樱庭声望提升！</em>
            <em v-else-if="guild.lastResult.improvedBy === 0"
              >没有超过今天最好成绩，公会进度未重复增加。</em
            >
          </article>

          <article v-if="guild.expedition?.leaders.length" class="panel">
            <div class="panel-heading">
              <span><Crown :size="17" />本周同行记录</span>
            </div>
            <div
              v-for="(item, index) in guild.expedition.leaders"
              :key="item.userId"
              class="leader-row"
            >
              <span>#{{ index + 1 }}</span
              ><strong>{{ item.displayName }}</strong
              ><em>{{ abbr(item.bestPoints) }}</em>
            </div>
          </article>
        </section>

        <section v-else class="tab-stack">
          <article class="panel member-panel">
            <div class="panel-heading">
              <span><Users :size="17" />成员名册</span>
            </div>
            <div v-for="member in guild.membership.members" :key="member.userId" class="member-row">
              <span class="member-avatar">{{ member.displayName.slice(0, 1) }}</span>
              <div>
                <strong
                  >{{ member.displayName }}
                  <Crown v-if="member.role === 'leader'" :size="13" /></strong
                ><small>Lv.{{ member.level }} · 战力 {{ abbr(member.combatPower) }}</small>
              </div>
              <button
                v-if="guild.isLeader && member.role !== 'leader'"
                class="remove-button"
                :aria-label="`移除成员 ${member.displayName}`"
                :disabled="guild.mutating"
                @click="guild.removeMember(member.userId)"
              >
                <UserMinus :size="17" />
              </button>
            </div>
          </article>

          <article class="panel leave-panel">
            <button v-if="!confirmLeave" class="leave-button" @click="confirmLeave = true">
              <LogOut :size="17" />{{
                guild.isLeader && guild.membership.members.length === 1 ? '解散公会' : '退出公会'
              }}
            </button>
            <div v-else class="leave-confirm">
              <p>
                {{
                  guild.isLeader && guild.membership.members.length > 1
                    ? '退出后，会长会自动转交给最早加入的成员。'
                    : '确定要离开现在的公会吗？'
                }}
              </p>
              <button class="soft-button" @click="confirmLeave = false">取消</button>
              <button class="danger-button" :disabled="guild.mutating" @click="leave">确认</button>
            </div>
          </article>
        </section>
      </template>
    </main>
  </section>
</template>

<style scoped>
.guild-view {
  position: absolute;
  z-index: 30;
  inset: 0;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  color: var(--text);
  background:
    radial-gradient(circle at 85% 8%, #ffe8f2 0, transparent 28%),
    linear-gradient(180deg, #f8fbff, #eef7ff 55%, #fff5fa);
}
.guild-top {
  min-height: 3.5rem;
  display: grid;
  grid-template-columns: 2.75rem minmax(0, 1fr) 2.75rem;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.65rem;
  border-bottom: 1px solid rgb(174 203 228 / 50%);
  background: rgb(255 255 255 / 82%);
  backdrop-filter: blur(12px);
}
.icon-button {
  min-width: 2.75rem;
  min-height: 2.75rem;
  display: grid;
  place-items: center;
  color: #587791;
  background: transparent;
  border-radius: 0.8rem;
}
.icon-button:focus-visible,
button:focus-visible,
input:focus-visible,
textarea:focus-visible {
  outline: 3px solid rgb(255 126 168 / 28%);
  outline-offset: 2px;
}
.title-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}
.title-copy strong {
  font-size: 0.95rem;
  color: #37536b;
}
.title-copy small {
  margin-top: 0.2rem;
  font-size: 0.68rem;
  color: var(--text-dim);
}
.guild-scroll {
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.75rem 0.75rem calc(1rem + var(--sab));
  overflow-x: hidden;
}
.state-card {
  min-height: 12rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  padding: 1.5rem;
  text-align: center;
  color: #6e8497;
  background: rgb(255 255 255 / 78%);
  border: 1px solid #dcebf6;
  border-radius: 1.2rem;
}
.state-card p {
  max-width: 26rem;
  margin: 0;
  font-size: 0.78rem;
  line-height: 1.65;
}
.offline-card svg {
  color: #ed8daf;
}
.welcome-banner,
.guild-banner {
  position: relative;
  overflow: hidden;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 0.8rem;
  padding: 1rem;
  color: #fff;
  border: 1px solid rgb(255 255 255 / 72%);
  border-radius: 1.25rem;
  box-shadow: 0 0.7rem 1.5rem rgb(70 99 125 / 15%);
  background: linear-gradient(135deg, #6fa8d4, #8dbbdc 48%, #e791b3);
}
.welcome-banner::after,
.guild-banner::after {
  position: absolute;
  inset: auto -12% -60% 35%;
  height: 9rem;
  content: '';
  border: 1px solid rgb(255 255 255 / 28%);
  border-radius: 50%;
  transform: rotate(-12deg);
}
.welcome-banner > *,
.guild-banner > * {
  position: relative;
  z-index: 1;
}
.banner-icon,
.crest-large {
  width: 3.25rem;
  height: 3.25rem;
  display: grid;
  place-items: center;
  color: #6c7e9d;
  background: rgb(255 255 255 / 90%);
  border: 1px solid #fff;
  border-radius: 1rem;
  box-shadow: 0 0.35rem 0.8rem rgb(50 75 100 / 16%);
}
.welcome-banner small,
.guild-banner small {
  font-size: 0.65rem;
  opacity: 0.88;
}
.welcome-banner h2,
.guild-banner h2 {
  margin: 0.18rem 0;
  font-size: 1.08rem;
  line-height: 1.25;
}
.welcome-banner p,
.guild-banner p {
  margin: 0;
  font-size: 0.7rem;
  line-height: 1.55;
  opacity: 0.9;
}
.petal {
  position: absolute;
  width: 0.55rem;
  height: 0.36rem;
  background: rgb(255 255 255 / 72%);
  border-radius: 80% 20% 70% 30%;
}
.petal-a {
  top: 16%;
  right: 12%;
  transform: rotate(25deg);
}
.petal-b {
  right: 25%;
  bottom: 16%;
  transform: rotate(-35deg);
}
.panel {
  min-width: 0;
  overflow: hidden;
  background: rgb(255 255 255 / 88%);
  border: 1px solid #dbeaf5;
  border-radius: 1rem;
  box-shadow: 0 0.35rem 1rem rgb(72 103 130 / 8%);
}
.panel-heading {
  min-height: 3rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  padding: 0.55rem 0.75rem;
  color: #506d85;
  border-bottom: 1px solid #edf3f8;
}
.panel-heading span {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.82rem;
  font-weight: 800;
}
.panel-heading small {
  font-size: 0.66rem;
  color: var(--text-dim);
}
.action-heading {
  width: 100%;
  text-align: left;
  background: transparent;
}
.create-form {
  display: grid;
  gap: 0.5rem;
  padding: 0.75rem;
}
.create-form label {
  font-size: 0.72rem;
  color: #688095;
}
input,
textarea {
  width: 100%;
  min-height: 2.75rem;
  padding: 0.65rem 0.75rem;
  font: inherit;
  font-size: 0.82rem;
  color: var(--text);
  background: #f7fbff;
  border: 1px solid #d6e6f2;
  border-radius: 0.75rem;
  resize: vertical;
}
textarea {
  min-height: 5rem;
  margin: 0.7rem 0.7rem 0;
  width: calc(100% - 1.4rem);
}
.primary-button,
.join-button,
.soft-button,
.danger-button,
.challenge-button,
.leave-button {
  min-height: 2.75rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0 0.85rem;
  font-weight: 800;
  border-radius: 0.8rem;
}
.primary-button,
.challenge-button {
  color: #fff;
  background: linear-gradient(120deg, #6fa9d5, #e98fb4);
  box-shadow: 0 0.35rem 0.8rem rgb(104 146 180 / 20%);
}
.primary-button:disabled,
.challenge-button:disabled {
  opacity: 0.5;
  box-shadow: none;
}
.guild-list {
  display: flex;
  flex-direction: column;
}
.guild-row {
  min-width: 0;
  display: grid;
  grid-template-columns: 2.6rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.55rem;
  padding: 0.65rem 0.7rem;
  border-bottom: 1px solid #edf3f8;
}
.guild-row:last-child {
  border-bottom: 0;
}
.crest {
  width: 2.6rem;
  height: 2.6rem;
  display: grid;
  place-items: center;
  color: #d4769b;
  background: #fff0f6;
  border-radius: 0.8rem;
}
.row-copy {
  min-width: 0;
}
.row-copy strong {
  font-size: 0.8rem;
}
.row-copy p {
  overflow: hidden;
  margin: 0.12rem 0;
  font-size: 0.68rem;
  color: var(--text-mid);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.row-copy small {
  font-size: 0.62rem;
  color: var(--text-dim);
}
.join-button {
  color: #47718d;
  background: #eaf6ff;
  border: 1px solid #cee8f8;
}
.empty-copy,
.notice-copy {
  margin: 0;
  padding: 1rem;
  font-size: 0.75rem;
  line-height: 1.6;
  color: var(--text-mid);
}
.error-strip {
  margin: 0;
  padding: 0.7rem 0.8rem;
  font-size: 0.72rem;
  color: #a04c68;
  background: #fff0f5;
  border: 1px solid #ffd2e1;
  border-radius: 0.8rem;
}
.guild-banner {
  grid-template-columns: auto minmax(0, 1fr) auto;
  background: linear-gradient(135deg, #668faa, #82aec8 55%, #d986a9);
}
.guild-identity {
  min-width: 0;
}
.rep-pill {
  padding: 0.35rem 0.55rem;
  font-size: 0.64rem;
  background: rgb(255 255 255 / 18%);
  border: 1px solid rgb(255 255 255 / 35%);
  border-radius: 999px;
  white-space: nowrap;
}
.guild-tabs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  padding: 0.25rem;
  background: rgb(255 255 255 / 82%);
  border: 1px solid #dbeaf5;
  border-radius: 0.9rem;
}
.guild-tabs button {
  min-height: 2.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  font-size: 0.74rem;
  color: #7890a2;
  border-radius: 0.7rem;
}
.guild-tabs button.active {
  color: #4d718b;
  background: linear-gradient(120deg, #e7f5ff, #fff0f6);
  box-shadow: inset 0 0 0 1px #d7eaf5;
}
.tab-stack {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}
.panel-actions {
  min-height: 3rem;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.7rem;
  padding: 0.35rem 0.7rem 0.7rem;
}
.panel-actions small {
  margin-right: auto;
  color: var(--text-dim);
}
.soft-button {
  color: #4f748e;
  background: #edf8ff;
  border: 1px solid #d3e9f7;
}
.stat-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.45rem;
}
.stat-grid div {
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.8rem 0.35rem;
  background: rgb(255 255 255 / 85%);
  border: 1px solid #dbeaf5;
  border-radius: 0.85rem;
}
.stat-grid strong {
  max-width: 100%;
  font-size: 0.88rem;
  color: #52728a;
  overflow-wrap: anywhere;
}
.stat-grid small {
  margin-top: 0.2rem;
  font-size: 0.62rem;
  color: var(--text-dim);
}
.boundary-note {
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
  padding: 0.8rem;
  color: #638096;
}
.boundary-note strong {
  font-size: 0.78rem;
}
.boundary-note p {
  margin: 0.2rem 0 0;
  font-size: 0.68rem;
  line-height: 1.55;
}
.boss-card {
  position: relative;
  overflow: hidden;
  padding: 1rem;
  color: #fff;
  background:
    radial-gradient(circle at 85% 20%, rgb(255 255 255 / 18%), transparent 28%),
    linear-gradient(145deg, #405d76, #668ca4 58%, #bb7797);
  border: 1px solid rgb(255 255 255 / 70%);
  border-radius: 1.15rem;
  box-shadow: 0 0.7rem 1.4rem rgb(54 77 98 / 18%);
}
.boss-card > * {
  position: relative;
  z-index: 1;
}
.boss-card h3 {
  margin: 0.45rem 0 0.2rem;
  font-size: 1.2rem;
}
.boss-card > p {
  margin: 0 0 0.9rem;
  font-size: 0.7rem;
  opacity: 0.86;
}
.boss-tag {
  padding: 0.3rem 0.55rem;
  font-size: 0.62rem;
  background: rgb(255 255 255 / 15%);
  border: 1px solid rgb(255 255 255 / 25%);
  border-radius: 999px;
}
.boss-orbit {
  position: absolute;
  z-index: 0;
  inset: -25% -20% auto auto;
  width: 10rem;
  height: 10rem;
  border: 1px solid rgb(255 255 255 / 14%);
  border-radius: 50%;
}
.boss-orbit i {
  position: absolute;
  inset: 20%;
  border: 1px dashed rgb(255 255 255 / 16%);
  border-radius: 50%;
}
.progress-copy {
  display: flex;
  justify-content: space-between;
  font-size: 0.7rem;
}
.progress-track {
  height: 0.7rem;
  overflow: hidden;
  margin-top: 0.35rem;
  background: rgb(21 43 60 / 42%);
  border: 1px solid rgb(255 255 255 / 18%);
  border-radius: 999px;
}
.progress-track i {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #81d4ed, #ffd0e2);
  border-radius: inherit;
  transition: width 0.5s ease;
}
.progress-numbers,
.fair-note {
  display: block;
  margin-top: 0.35rem;
  font-size: 0.62rem;
  opacity: 0.76;
}
.challenge-button {
  width: 100%;
  margin-top: 0.85rem;
  background: rgb(255 255 255 / 94%);
  color: #6f6179;
}
.fair-note {
  text-align: center;
}
.result-card {
  position: relative;
  padding: 0.85rem;
  background: linear-gradient(135deg, #fff, #fff2f7);
  border: 1px solid #ffd3e3;
  border-radius: 1rem;
}
.result-card small,
.result-card strong,
.result-card p,
.result-card em {
  display: block;
}
.result-card small {
  color: var(--text-dim);
}
.result-card strong {
  margin: 0.2rem 0;
  font-size: 1rem;
  color: #d36e96;
}
.result-card p,
.result-card em {
  margin: 0;
  font-size: 0.7rem;
  line-height: 1.55;
  color: var(--text-mid);
}
.result-card em {
  margin-top: 0.3rem;
  color: #b65e82;
  font-style: normal;
}
.result-close {
  position: absolute;
  top: 0.25rem;
  right: 0.25rem;
  min-width: 2.75rem;
  min-height: 2.75rem;
  color: #9b8290;
  font-size: 1.2rem;
}
.leader-row {
  min-height: 2.75rem;
  display: grid;
  grid-template-columns: 2rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.4rem;
  padding: 0 0.75rem;
  font-size: 0.72rem;
  border-bottom: 1px solid #edf3f8;
}
.leader-row:last-child {
  border-bottom: 0;
}
.leader-row span {
  color: #d27a9b;
}
.leader-row em {
  font-style: normal;
  color: var(--text-dim);
}
.member-row {
  min-height: 3.6rem;
  display: grid;
  grid-template-columns: 2.5rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.55rem;
  padding: 0.5rem 0.7rem;
  border-bottom: 1px solid #edf3f8;
}
.member-row:last-child {
  border-bottom: 0;
}
.member-avatar {
  width: 2.5rem;
  height: 2.5rem;
  display: grid;
  place-items: center;
  font-weight: 800;
  color: #b76688;
  background: linear-gradient(145deg, #fff0f6, #eaf6ff);
  border-radius: 50%;
}
.member-row div {
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.member-row strong {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.78rem;
}
.member-row small {
  margin-top: 0.2rem;
  font-size: 0.64rem;
  color: var(--text-dim);
}
.remove-button {
  min-width: 2.75rem;
  min-height: 2.75rem;
  display: grid;
  place-items: center;
  color: #b96a83;
  border-radius: 0.75rem;
}
.leave-panel {
  padding: 0.65rem;
}
.leave-button {
  width: 100%;
  color: #a45a72;
  background: #fff4f7;
}
.leave-confirm {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}
.leave-confirm p {
  grid-column: 1 / -1;
  margin: 0;
  font-size: 0.72rem;
  line-height: 1.55;
  color: var(--text-mid);
}
.danger-button {
  color: #fff;
  background: #cf6f85;
}
.spinning {
  animation: spin 0.9s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@media (min-width: 640px) {
  .guild-scroll {
    padding-right: 1rem;
    padding-left: 1rem;
  }
}
@media (prefers-reduced-motion: reduce) {
  .spinning {
    animation: none;
  }
  .progress-track i {
    transition: none;
  }
}
</style>
