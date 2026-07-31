<script setup lang="ts">
/**
 * GuildView —— 樱庭公会。
 * 视觉方向：高级感磨砂分层 + 蓝白粉可爱基调；极光底、落樱、星闪、
 * 弹簧微交互与滑动指示器全部对 prefers-reduced-motion 安全降级。
 * 功能：创建 / 加入 / 邀请码 / 广场详情浏览 / 公告 / 成员管理 / 退出与解散 / 每周远征。
 */
import { computed, nextTick, onMounted, onUnmounted, ref, type Component } from 'vue';
import {
  ArrowLeft,
  Castle,
  Check,
  Compass,
  Copy,
  Crown,
  Gift,
  LogOut,
  Plus,
  RefreshCw,
  ScrollText,
  Shield,
  Sparkles,
  Swords,
  Ticket,
  UserMinus,
  Users,
} from '@lucide/vue';
import { abbr } from '@/core/format';
import { guildDisplayStage } from '@/core/guildExpedition';
import { useGuildStore } from '@/stores/guild';
import { useGameStore } from '@/stores/game';
import {
  GUILD_DISPLAY_STAGES,
  GUILD_NAME_MAX_LENGTH,
  GUILD_NOTICE_MAX_LENGTH,
} from '@/data/guildRules';
import type { GuildSummary } from '@/net/guild';
import GuildPlazaList from '@/components/guild/GuildPlazaList.vue';
import GuildDetailSheet from '@/components/guild/GuildDetailSheet.vue';
import GuildCommissionBoard from '@/components/guild/GuildCommissionBoard.vue';
import GuildStrongholdBoard from '@/components/guild/GuildStrongholdBoard.vue';
import GuildExpeditionBattleScene from '@/components/guild/GuildExpeditionBattleScene.vue';
import { crestInitial, crestTintClass } from '@/components/guild/guildCrest';

const emit = defineEmits<{ close: [] }>();
const guild = useGuildStore();
const game = useGameStore();
const backButton = ref<HTMLButtonElement | null>(null);
const guildPlaybackKey = ref(0);
const systemReduced =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const motionReduced = computed(() => systemReduced || Boolean(game.save?.settings.reduceMotion));

type GuildTab = 'home' | 'expedition' | 'members' | 'plaza';
const tabs: { id: GuildTab; label: string; icon: Component }[] = [
  { id: 'home', label: '首页', icon: Castle },
  { id: 'expedition', label: '团本', icon: Swords },
  { id: 'members', label: '成员', icon: Users },
  { id: 'plaza', label: '广场', icon: Compass },
];
const activeTab = ref<GuildTab>('home');
const tabIndex = computed(() =>
  Math.max(
    0,
    tabs.findIndex((tab) => tab.id === activeTab.value),
  ),
);

const newGuildName = ref('');
const noticeDraft = ref('');
const showCreate = ref(false);
const confirmLeave = ref(false);
const codeDraft = ref('');
const copiedInvite = ref(false);
const toastMessage = ref('');
let copyTimer: ReturnType<typeof setTimeout> | undefined;
let toastTimer: ReturnType<typeof setTimeout> | undefined;

const stage = computed(() => guildDisplayStage(guild.membership?.guild.reputation ?? 0));
const nextStage = computed(
  () =>
    GUILD_DISPLAY_STAGES.find(
      (item) => item.minReputation > (guild.membership?.guild.reputation ?? 0),
    ) ?? null,
);
const stageToNextPct = computed(() => {
  if (!nextStage.value) return 100;
  const current = guild.membership?.guild.reputation ?? 0;
  const base = stage.value.minReputation;
  const span = Math.max(1, nextStage.value.minReputation - base);
  return Math.min(100, Math.round(((current - base) / span) * 100));
});
const progressPct = computed(() => {
  const run = guild.expedition?.expedition;
  if (!run) return 0;
  return Math.min(100, Math.round((run.progress / Math.max(1, run.target)) * 100));
});
const inviteCode = computed(() => guild.membership?.guild.inviteCode ?? '');
const myGuildId = computed(() => guild.membership?.guild.id ?? null);
/** 广场列表：自己的公会即使未挤进前排也置顶可见。 */
const plazaGuilds = computed<GuildSummary[]>(() => {
  const list = guild.guilds;
  const mine = guild.membership?.guild;
  if (!mine) return list;
  return list.some((item) => item.id === mine.id) ? list : [mine, ...list];
});

onMounted(async () => {
  await nextTick();
  backButton.value?.focus();
  // 深链接 ?guild-invite=CODE：预填邀请码并立即清理地址栏，避免刷新后重复提示。
  const params = new URLSearchParams(window.location.search);
  const invited = params.get('guild-invite');
  if (invited) {
    codeDraft.value = invited
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 8);
    params.delete('guild-invite');
    const query = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
  }
  await guild.refresh();
  noticeDraft.value = guild.membership?.guild.notice ?? '';
});

onUnmounted(() => {
  clearTimeout(copyTimer);
  clearTimeout(toastTimer);
});

function showToast(message: string) {
  toastMessage.value = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toastMessage.value = ''), 2200);
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    try {
      return document.execCommand('copy');
    } catch {
      return false;
    } finally {
      area.remove();
    }
  }
}

async function copyInvite() {
  if (!inviteCode.value) return;
  if (await copyText(inviteCode.value)) {
    copiedInvite.value = true;
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => (copiedInvite.value = false), 1800);
    showToast('邀请码已复制，快发给旅伴吧');
  } else {
    showToast('复制失败，请长按短码手动复制');
  }
}

function onCodeInput(event: Event) {
  const input = event.target as HTMLInputElement;
  codeDraft.value = input.value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);
  input.value = codeDraft.value;
}

async function submitCode() {
  const joined = await guild.joinByCode(codeDraft.value.trim());
  if (joined) {
    codeDraft.value = '';
    noticeDraft.value = guild.membership?.guild.notice ?? '';
    showToast(`已加入「${joined.name}」，一起远征吧`);
  }
}

async function create() {
  if (await guild.createGuild(newGuildName.value.trim())) {
    newGuildName.value = '';
    showCreate.value = false;
    noticeDraft.value = guild.membership?.guild.notice ?? '';
    showToast('你的樱庭已点亮，去邀请第一位伙伴吧');
  }
}

async function saveNotice() {
  if (await guild.updateNotice(noticeDraft.value)) {
    noticeDraft.value = guild.membership?.guild.notice ?? '';
    showToast('公告已更新');
  }
}

async function leave() {
  if (await guild.leaveGuild()) {
    confirmLeave.value = false;
    activeTab.value = 'home';
    showToast('已离开樱庭，山水有相逢');
  }
}

async function donateStronghold(amount: number) {
  if (await guild.donateMerit(amount)) {
    showToast(`已向赛季据点捐献 ${amount} 点功勋`);
  }
}

async function claimStrongholdOffer(offerId: 'sakura-pennant' | 'moon-lantern' | 'legend-crest') {
  if (await guild.claimShopOffer(offerId)) {
    showToast('已收进本季公会收藏册');
  }
}

async function challengeExpedition() {
  const result = await guild.challenge();
  if (result) guildPlaybackKey.value++;
}

function openPlazaDetail(item: GuildSummary) {
  void guild.openDetail(item.id);
}
</script>

<template>
  <section class="guild-view" role="region" aria-label="公会">
    <div class="sky" aria-hidden="true">
      <i class="sky-blob blob-a" /><i class="sky-blob blob-b" /><i class="sky-blob blob-c" />
      <i v-for="n in 6" :key="n" class="sky-petal" :class="`sp-${n}`" />
    </div>

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
        <span class="state-crest"><Shield :size="26" aria-hidden="true" /></span>
        <strong>联机公会尚未配置</strong>
        <p>当前版本仍可正常挂机；部署 Supabase 迁移与公会函数后，这里会自动开放。</p>
      </div>

      <div v-else-if="guild.loading && !guild.membership" class="state-card" aria-live="polite">
        <span class="petal-loader" aria-hidden="true"><i /><i /><i /></span>
        <strong>正在寻找附近的樱庭…</strong>
      </div>

      <template v-else-if="!guild.membership">
        <section class="welcome-hero">
          <i class="hero-petal hp-a" aria-hidden="true" /><i
            class="hero-petal hp-b"
            aria-hidden="true"
          />
          <i class="hero-sparkle hs-a" aria-hidden="true">✦</i>
          <i class="hero-sparkle hs-b" aria-hidden="true">✦</i>
          <span class="hero-crest"><Castle :size="30" aria-hidden="true" /></span>
          <div class="hero-copy">
            <small>异步共享世界 · 首批试运行</small>
            <h2>找一群旅伴，共同挑战每周首领</h2>
            <p>不要求同时在线，不会暂停挂机。首版只有荣誉与据点外观，没有战力奖励。</p>
          </div>
        </section>

        <p v-if="guild.lastError" class="error-strip" role="status">{{ guild.lastError }}</p>

        <section class="panel create-panel">
          <button
            class="panel-heading action-heading"
            :aria-expanded="showCreate"
            @click="showCreate = !showCreate"
          >
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
              <Sparkles :size="16" aria-hidden="true" />点亮第一盏樱灯
            </button>
          </div>
        </section>

        <section class="panel invite-join-panel">
          <div class="panel-heading">
            <span><Ticket :size="17" />凭邀请码加入</span>
            <small>8 位好友短码</small>
          </div>
          <div class="invite-form">
            <input
              class="code-input"
              :value="codeDraft"
              maxlength="8"
              placeholder="输入邀请码"
              autocomplete="off"
              aria-label="公会邀请码"
              @input="onCodeInput"
            />
            <button
              class="primary-button"
              :disabled="guild.mutating || codeDraft.trim().length !== 8"
              @click="submitCode"
            >
              加入樱庭
            </button>
          </div>
        </section>

        <section class="panel">
          <div class="panel-heading">
            <span><Compass :size="17" />公会广场</span>
            <small>{{ plazaGuilds.length }} 座樱庭</small>
          </div>
          <GuildPlazaList
            :guilds="plazaGuilds"
            :my-guild-id="myGuildId"
            :loading="guild.loading"
            @select="openPlazaDetail"
          />
          <p class="plaza-tip">点开任意樱庭，可以先看看名册与本周远征再决定加入。</p>
        </section>
      </template>

      <template v-else>
        <section class="guild-banner" :class="`stage-${stage.id}`">
          <i class="banner-shine" aria-hidden="true" />
          <i class="hero-petal hp-a" aria-hidden="true" /><i
            class="hero-petal hp-b"
            aria-hidden="true"
          />
          <span class="crest-large" :class="crestTintClass(guild.membership.guild.name)">
            {{ crestInitial(guild.membership.guild.name) }}
          </span>
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
          <span class="rep-pill num">声望 {{ abbr(guild.membership.guild.reputation) }}</span>
          <div v-if="nextStage" class="stage-next">
            <span>距「{{ nextStage.name }}」</span>
            <i class="next-track" aria-hidden="true"
              ><i :style="{ width: `${stageToNextPct}%` }"
            /></i>
            <span class="num">{{ stageToNextPct }}%</span>
          </div>
          <div v-else class="stage-next maxed">
            <span>已抵达传说阶段 ✦</span>
          </div>
        </section>

        <nav class="guild-tabs" aria-label="公会页面">
          <i
            class="tab-glider"
            :style="{ transform: `translateX(${tabIndex * 100}%)` }"
            aria-hidden="true"
          />
          <button
            v-for="tab in tabs"
            :key="tab.id"
            :class="{ active: activeTab === tab.id }"
            @click="activeTab = tab.id"
          >
            <component :is="tab.icon" :size="16" aria-hidden="true" />{{ tab.label }}
          </button>
        </nav>

        <p v-if="guild.lastError" class="error-strip" role="status">{{ guild.lastError }}</p>

        <section v-if="activeTab === 'home'" class="tab-stack">
          <article v-if="inviteCode" class="panel invite-card">
            <div class="panel-heading">
              <span><Gift :size="17" />邀请伙伴</span>
              <small>同灯共济</small>
            </div>
            <div class="invite-body">
              <div class="invite-code" aria-label="公会邀请码">{{ inviteCode }}</div>
              <button
                class="copy-button"
                :class="{ done: copiedInvite }"
                :disabled="guild.mutating"
                @click="copyInvite"
              >
                <Check v-if="copiedInvite" :size="16" aria-hidden="true" />
                <Copy v-else :size="16" aria-hidden="true" />
                {{ copiedInvite ? '已复制' : '复制邀请码' }}
              </button>
              <p class="invite-hint">伙伴在公会广场输入短码即可直达加入，也可把短码发到群里。</p>
            </div>
          </article>

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
              <strong class="num">{{ guild.membership.guild.expeditionClears }}</strong
              ><small>完成远征</small>
            </div>
            <div>
              <strong class="num">{{ guild.membership.guild.memberCount }}</strong
              ><small>同行成员</small>
            </div>
            <div>
              <strong>{{ stage.name }}</strong
              ><small>据点阶段</small>
            </div>
          </article>

          <GuildCommissionBoard :state="guild.commissions" @expedition="activeTab = 'expedition'" />
          <GuildStrongholdBoard
            :state="guild.stronghold"
            :busy="guild.mutating"
            @donate="donateStronghold"
            @claim="claimStrongholdOffer"
            @expedition="activeTab = 'expedition'"
          />

          <article class="panel boundary-note">
            <Shield :size="20" aria-hidden="true" />
            <div>
              <strong>功勋只记录在服务器</strong>
              <p>公会不会出售攻击、掉率或离线收益；赛季据点与收藏不会改变战斗属性。</p>
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
            <GuildExpeditionBattleScene
              :boss="guild.expedition.boss"
              :result="guild.lastResult"
              :class-id="game.save?.player.classId ?? 'swordsman'"
              :level="game.player?.level ?? 1"
              :equipped="game.save?.equipped ?? null"
              :player-name="game.player?.name ?? '挑战者'"
              :player-max-hp="game.finalStats.hp"
              :playback-key="guildPlaybackKey"
              :loading="guild.challenging"
              :reduce-motion="motionReduced"
            />
            <div class="progress-copy">
              <span>全会团本进度</span><strong class="num">{{ progressPct }}%</strong>
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
            <small class="progress-numbers num">
              {{ abbr(guild.expedition.expedition.progress) }} /
              {{ abbr(guild.expedition.expedition.target) }} 贡献
            </small>
            <button
              class="challenge-button"
              :class="{ ready: guild.canChallenge }"
              :disabled="!guild.canChallenge"
              @click="challengeExpedition"
            >
              <Swords :size="18" aria-hidden="true" />
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
            <small>本次团本战果</small>
            <strong class="num">+{{ guild.lastResult.improvedBy }} 公会贡献</strong>
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
              :class="`rank-${index + 1}`"
            >
              <span class="rank">{{ index + 1 }}</span
              ><strong>{{ item.displayName }}</strong
              ><em class="num">{{ abbr(item.bestPoints) }}</em>
            </div>
          </article>
        </section>

        <section v-else-if="activeTab === 'members'" class="tab-stack">
          <article class="panel member-panel">
            <div class="panel-heading">
              <span><Users :size="17" />成员名册</span>
              <small>{{ guild.membership.guild.memberCount }} 人同行</small>
            </div>
            <div
              v-for="(member, index) in guild.membership.members"
              :key="member.userId"
              class="member-row row-in"
              :style="{ '--row-delay': `${Math.min(index, 12) * 40}ms` }"
            >
              <span class="member-avatar" aria-hidden="true">{{
                crestInitial(member.displayName)
              }}</span>
              <div>
                <strong
                  >{{ member.displayName }}
                  <Crown v-if="member.role === 'leader'" :size="13" aria-hidden="true" />
                  <em v-if="member.userId === guild.userId" class="me-chip">我</em></strong
                ><small class="num"
                  >Lv.{{ member.level }} · 战力 {{ abbr(member.combatPower) }}</small
                >
              </div>
              <button
                v-if="guild.isLeader && member.role !== 'leader'"
                class="remove-button"
                :aria-label="`移除成员 ${member.displayName}`"
                :disabled="guild.mutating"
                @click="guild.removeMember(member.userId)"
              >
                <UserMinus :size="17" aria-hidden="true" />
              </button>
            </div>
          </article>

          <article class="panel manage-panel">
            <div class="panel-heading">
              <span><Shield :size="17" />公会管理</span>
            </div>
            <button v-if="!confirmLeave" class="leave-row" @click="confirmLeave = true">
              <LogOut :size="17" aria-hidden="true" />
              <span>{{
                guild.isLeader && guild.membership.members.length === 1 ? '解散公会' : '退出公会'
              }}</span>
              <small v-if="guild.isLeader && guild.membership.members.length > 1"
                >会长将自动移交</small
              >
            </button>
            <div v-else class="leave-confirm">
              <p>
                {{
                  guild.isLeader && guild.membership.members.length > 1
                    ? '退出后，会长会自动转交给最早加入的成员。'
                    : guild.isLeader
                      ? '解散后公会与远征进度将一并消失，且无法恢复。'
                      : '确定要离开现在的公会吗？'
                }}
              </p>
              <div class="confirm-actions">
                <button class="soft-button" @click="confirmLeave = false">再想想</button>
                <button class="danger-button" :disabled="guild.mutating" @click="leave">
                  确认离开
                </button>
              </div>
            </div>
          </article>
        </section>

        <section v-else class="tab-stack">
          <article class="panel">
            <div class="panel-heading">
              <span><Compass :size="17" />公会广场</span>
              <small>{{ plazaGuilds.length }} 座樱庭</small>
            </div>
            <GuildPlazaList
              :guilds="plazaGuilds"
              :my-guild-id="myGuildId"
              :loading="guild.loading"
              @select="openPlazaDetail"
            />
            <p class="plaza-tip">看看其他樱庭的名册与本周远征，也许能结识新的旅伴。</p>
          </article>
        </section>
      </template>
    </main>

    <GuildDetailSheet />

    <Transition name="toast-up">
      <p v-if="toastMessage" class="guild-toast" role="status">{{ toastMessage }}</p>
    </Transition>
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
  background: linear-gradient(180deg, #eaf4ff 0%, #f5f3fd 46%, #fff2f8 100%);
}
/* ── 极光底与落樱（纯装饰）── */
.sky {
  position: absolute;
  z-index: 0;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}
.sky-blob {
  position: absolute;
  border-radius: 50%;
}
.blob-a {
  width: 17rem;
  height: 17rem;
  left: -5rem;
  top: -5rem;
  background: radial-gradient(circle, rgb(126 200 242 / 42%), transparent 68%);
  animation: blob-drift 13s ease-in-out infinite alternate;
}
.blob-b {
  width: 18rem;
  height: 18rem;
  right: -6rem;
  top: 9%;
  background: radial-gradient(circle, rgb(255 158 196 / 38%), transparent 68%);
  animation: blob-drift 16s ease-in-out infinite alternate-reverse;
}
.blob-c {
  width: 21rem;
  height: 21rem;
  left: 18%;
  bottom: -9rem;
  background: radial-gradient(circle, rgb(184 156 255 / 28%), transparent 70%);
  animation: blob-drift 19s ease-in-out infinite alternate;
}
@keyframes blob-drift {
  from {
    transform: translate(0, 0) scale(1);
  }
  to {
    transform: translate(1.4rem, 0.9rem) scale(1.08);
  }
}
.sky-petal {
  position: absolute;
  top: -3%;
  width: 0.6rem;
  height: 0.4rem;
  background: linear-gradient(135deg, #ffd8e8, #ffb9d6);
  border-radius: 80% 20% 70% 30%;
  opacity: 0;
  animation: petal-fall linear infinite;
}
.sp-1 {
  left: 7%;
  animation-duration: 12s;
}
.sp-2 {
  left: 22%;
  width: 0.45rem;
  height: 0.3rem;
  animation-duration: 15s;
  animation-delay: -6s;
}
.sp-3 {
  left: 47%;
  animation-duration: 11s;
  animation-delay: -3.5s;
}
.sp-4 {
  left: 63%;
  width: 0.5rem;
  height: 0.32rem;
  animation-duration: 16s;
  animation-delay: -9s;
}
.sp-5 {
  left: 79%;
  animation-duration: 13s;
  animation-delay: -1.8s;
}
.sp-6 {
  left: 91%;
  width: 0.42rem;
  height: 0.28rem;
  animation-duration: 17s;
  animation-delay: -12s;
}
@keyframes petal-fall {
  0% {
    transform: translate3d(0, -4vh, 0) rotate(12deg);
    opacity: 0;
  }
  9% {
    opacity: 0.8;
  }
  50% {
    transform: translate3d(1.5rem, 46vh, 0) rotate(185deg);
  }
  91% {
    opacity: 0.7;
  }
  100% {
    transform: translate3d(-0.7rem, 96vh, 0) rotate(348deg);
    opacity: 0;
  }
}
/* ── 顶栏 ── */
.guild-top {
  position: relative;
  z-index: 2;
  min-height: 3.5rem;
  display: grid;
  grid-template-columns: 2.75rem minmax(0, 1fr) 2.75rem;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.65rem;
  border-bottom: 1px solid rgb(255 255 255 / 55%);
  background: var(--glass-bg);
  backdrop-filter: var(--blur-glass);
}
.icon-button {
  min-width: 2.75rem;
  min-height: 2.75rem;
  display: grid;
  place-items: center;
  color: #587791;
  border-radius: 0.8rem;
  transition:
    transform var(--t-fast) var(--ease-spring),
    background-color var(--t-mid) var(--ease-soft);
}
.icon-button:active {
  transform: scale(0.88);
}
@media (hover: hover) and (pointer: fine) {
  .icon-button:hover {
    background: rgb(255 255 255 / 65%);
  }
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
  font-size: 0.98rem;
  background: linear-gradient(120deg, #4a7ba6, #d2608c);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.title-copy small {
  margin-top: 0.2rem;
  font-size: 0.66rem;
  color: var(--text-dim);
}
.guild-scroll {
  position: relative;
  z-index: 1;
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  padding: 0.8rem 0.75rem calc(1.1rem + var(--sab));
  overflow-x: hidden;
}
/* ── 状态卡 ── */
.state-card {
  min-height: 13rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.7rem;
  padding: 1.6rem;
  text-align: center;
  color: #6e8497;
  background: var(--glass-bg-strong);
  border: 1px solid var(--glass-brd);
  border-radius: 1.25rem;
  box-shadow: var(--shadow-key);
}
.state-card p {
  max-width: 26rem;
  margin: 0;
  font-size: 0.76rem;
  line-height: 1.65;
}
.state-crest {
  width: 3.4rem;
  height: 3.4rem;
  display: grid;
  place-items: center;
  color: #ed8daf;
  background: linear-gradient(145deg, #fff3f8, #ecf6ff);
  border-radius: 1.1rem;
}
.petal-loader {
  display: flex;
  gap: 0.42rem;
}
.petal-loader i {
  width: 0.6rem;
  height: 0.6rem;
  background: linear-gradient(135deg, var(--blue), var(--pink));
  border-radius: 50%;
  animation: dot-bounce 1s ease-in-out infinite;
}
.petal-loader i:nth-child(2) {
  animation-delay: 0.12s;
}
.petal-loader i:nth-child(3) {
  animation-delay: 0.24s;
}
@keyframes dot-bounce {
  0%,
  100% {
    transform: translateY(0);
    opacity: 0.55;
  }
  50% {
    transform: translateY(-0.4rem);
    opacity: 1;
  }
}
/* ── 欢迎主视觉 / 公会横幅 ── */
.welcome-hero,
.guild-banner {
  position: relative;
  overflow: hidden;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 0.85rem;
  padding: 1.1rem 1rem;
  color: #fff;
  border: 1px solid rgb(255 255 255 / 72%);
  border-radius: 1.3rem;
  box-shadow: var(--shadow-float);
  background: linear-gradient(135deg, #6fa8d4, #8dbbdc 48%, #e791b3);
}
.welcome-hero > *,
.guild-banner > * {
  position: relative;
  z-index: 1;
}
.hero-crest,
.crest-large {
  width: 3.4rem;
  height: 3.4rem;
  display: grid;
  place-items: center;
  font-size: 1.25rem;
  font-weight: 900;
  color: #6c7e9d;
  background: rgb(255 255 255 / 92%);
  border: 1px solid #fff;
  border-radius: 1.1rem;
  box-shadow: 0 0.4rem 0.9rem rgb(50 75 100 / 18%);
}
.hero-crest {
  color: #d47ba0;
  animation: crest-float 3.8s ease-in-out infinite;
}
@keyframes crest-float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-0.35rem);
  }
}
.hero-copy small,
.guild-identity small {
  font-size: 0.64rem;
  opacity: 0.9;
}
.hero-copy h2,
.guild-identity h2 {
  margin: 0.2rem 0;
  font-size: 1.1rem;
  line-height: 1.3;
  text-shadow: 0 1px 6px rgb(70 89 107 / 18%);
}
.hero-copy p,
.guild-identity p {
  margin: 0;
  font-size: 0.69rem;
  line-height: 1.55;
  opacity: 0.92;
}
.hero-petal {
  position: absolute;
  width: 0.55rem;
  height: 0.36rem;
  background: rgb(255 255 255 / 75%);
  border-radius: 80% 20% 70% 30%;
  animation: petal-sway 4.5s ease-in-out infinite alternate;
}
.hp-a {
  top: 14%;
  right: 10%;
}
.hp-b {
  right: 26%;
  bottom: 14%;
  animation-delay: -2.2s;
}
@keyframes petal-sway {
  from {
    transform: rotate(20deg) translateY(0);
  }
  to {
    transform: rotate(-24deg) translateY(-0.45rem);
  }
}
.hero-sparkle {
  position: absolute;
  font-size: 0.85rem;
  font-style: normal;
  color: rgb(255 255 255 / 95%);
  animation: twinkle 2.4s ease-in-out infinite;
}
.hs-a {
  top: 18%;
  right: 36%;
}
.hs-b {
  right: 6%;
  bottom: 20%;
  animation-delay: -1.1s;
}
@keyframes twinkle {
  0%,
  100% {
    opacity: 0.25;
    transform: scale(0.7) rotate(0deg);
  }
  50% {
    opacity: 1;
    transform: scale(1.15) rotate(20deg);
  }
}
/* ── 公会横幅：阶段主题与光泽 ── */
.guild-banner {
  grid-template-columns: auto minmax(0, 1fr) auto;
  background: linear-gradient(135deg, #6f9fd0, #8db8de 45%, #e08fae);
}
.guild-banner.stage-bloom {
  background: linear-gradient(135deg, #7f9fd6, #a48fd4 48%, #ef92b1);
}
.guild-banner.stage-moonlit {
  background: linear-gradient(135deg, #55619b, #7a6cb2 52%, #c0739c);
}
.guild-banner.stage-legend {
  background: linear-gradient(120deg, #6a7fc9, #9a6fc0 30%, #d06f9e 55%, #e8a06f 80%, #d4b45c);
}
.guild-banner .crest-large {
  font-size: 1.3rem;
  text-shadow: 0 1px 3px rgb(70 89 107 / 25%);
}
.banner-shine {
  position: absolute;
  z-index: 0;
  top: 0;
  bottom: 0;
  left: -35%;
  width: 30%;
  background: linear-gradient(100deg, transparent, rgb(255 255 255 / 22%), transparent);
  transform: skewX(-18deg);
  animation: shine-sweep 5.2s ease-in-out infinite;
}
@keyframes shine-sweep {
  0%,
  55% {
    left: -35%;
  }
  85%,
  100% {
    left: 125%;
  }
}
.guild-identity {
  min-width: 0;
}
.rep-pill {
  padding: 0.36rem 0.6rem;
  font-size: 0.64rem;
  font-weight: 800;
  background: rgb(255 255 255 / 20%);
  border: 1px solid rgb(255 255 255 / 38%);
  border-radius: 999px;
  white-space: nowrap;
}
.stage-next {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.62rem;
  opacity: 0.94;
}
.next-track {
  flex: 1;
  height: 0.32rem;
  overflow: hidden;
  background: rgb(21 43 60 / 25%);
  border-radius: 999px;
}
.next-track i {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #ffffffb3, #fff);
  border-radius: inherit;
  transition: width 0.5s var(--ease-soft);
}
.stage-next.maxed {
  justify-content: center;
}
/* ── 页签（滑动指示器）── */
.guild-tabs {
  position: relative;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  padding: 0.25rem;
  background: var(--glass-bg-strong);
  border: 1px solid var(--glass-brd);
  border-radius: 0.95rem;
  box-shadow: var(--shadow-sm);
}
.tab-glider {
  position: absolute;
  top: 0.25rem;
  bottom: 0.25rem;
  left: 0.25rem;
  width: calc((100% - 0.5rem) / 4);
  background: linear-gradient(120deg, #e9f6ff, #fff0f6);
  border-radius: 0.72rem;
  box-shadow:
    inset 0 0 0 1px #d7eaf5,
    var(--shadow-sm);
  transition: transform var(--t-slow) var(--ease-spring);
}
.guild-tabs button {
  position: relative;
  z-index: 1;
  min-height: 2.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.32rem;
  font-size: 0.74rem;
  color: #7890a2;
  border-radius: 0.72rem;
  transition: color var(--t-mid) var(--ease-soft);
}
.guild-tabs button.active {
  font-weight: 800;
  color: #4d718b;
}
/* ── 通用面板 ── */
.panel {
  min-width: 0;
  overflow: hidden;
  background: var(--glass-bg-strong);
  border: 1px solid var(--glass-brd);
  border-radius: 1.05rem;
  box-shadow: var(--shadow-sm);
  transition: box-shadow var(--t-mid) var(--ease-soft);
}
@media (hover: hover) and (pointer: fine) {
  .panel:hover {
    box-shadow: var(--shadow-key);
  }
}
.panel-heading {
  min-height: 3rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  padding: 0.55rem 0.75rem;
  color: #506d85;
  border-bottom: 1px solid #eef4f9;
}
.panel-heading span {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.82rem;
  font-weight: 800;
}
.panel-heading small {
  font-size: 0.64rem;
  color: var(--text-dim);
}
.action-heading {
  width: 100%;
  text-align: left;
  background: transparent;
}
.create-form {
  display: grid;
  gap: 0.55rem;
  padding: 0.75rem;
  animation: form-in var(--t-slow) var(--ease-soft) both;
}
@keyframes form-in {
  from {
    opacity: 0;
    transform: translateY(-6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
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
  transition:
    border-color var(--t-mid) var(--ease-soft),
    box-shadow var(--t-mid) var(--ease-soft);
}
input:focus,
textarea:focus {
  border-color: #a9d4ef;
  box-shadow: 0 0 0 3px rgb(126 200 242 / 20%);
}
textarea {
  min-height: 5rem;
  margin: 0.7rem 0.7rem 0;
  width: calc(100% - 1.4rem);
}
.primary-button,
.soft-button,
.danger-button,
.challenge-button,
.copy-button {
  min-height: 2.75rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0 0.9rem;
  font-weight: 800;
  border-radius: 0.8rem;
  transition:
    transform var(--t-fast) var(--ease-spring),
    filter var(--t-mid) var(--ease-soft),
    box-shadow var(--t-mid) var(--ease-soft),
    background-color var(--t-mid) var(--ease-soft);
}
.primary-button:active:not(:disabled),
.soft-button:active:not(:disabled),
.danger-button:active:not(:disabled),
.challenge-button:active:not(:disabled),
.copy-button:active:not(:disabled) {
  transform: scale(0.95);
}
.primary-button {
  color: #fff;
  background: linear-gradient(120deg, var(--blue-deep), var(--pink-deep));
  box-shadow: 0 0.4rem 0.9rem rgb(126 160 200 / 28%);
}
.primary-button:disabled {
  opacity: 0.5;
  box-shadow: none;
}
.plaza-tip {
  margin: 0;
  padding: 0.55rem 0.75rem 0.7rem;
  font-size: 0.64rem;
  line-height: 1.6;
  color: var(--text-dim);
  border-top: 1px solid #eef4f9;
}
/* ── 邀请码 ── */
.invite-form {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.55rem;
  padding: 0.75rem;
}
.code-input {
  font-size: 0.95rem;
  font-weight: 800;
  letter-spacing: 0.3em;
  text-align: center;
  text-transform: uppercase;
  color: #4d6f8a;
}
.code-input::placeholder {
  font-size: 0.78rem;
  font-weight: 400;
  letter-spacing: normal;
}
.invite-body {
  display: grid;
  gap: 0.6rem;
  padding: 0.8rem 0.75rem;
}
.invite-code {
  padding: 0.75rem 0.5rem 0.75rem 0.8rem;
  font-size: 1.28rem;
  font-weight: 900;
  letter-spacing: 0.3em;
  text-align: center;
  color: #4d6f8a;
  background: linear-gradient(120deg, #fff7fb, #f2f9ff);
  border: 1.5px dashed #e3b7cc;
  border-radius: 0.9rem;
}
.copy-button {
  color: #4f748e;
  background: #edf8ff;
  border: 1px solid #d3e9f7;
}
.copy-button.done {
  color: #3d8f68;
  background: #e5f7ee;
  border-color: #bfe9d2;
}
.invite-hint {
  margin: 0;
  font-size: 0.64rem;
  line-height: 1.6;
  text-align: center;
  color: var(--text-dim);
}
/* ── 首页 ── */
.tab-stack {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
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
  background: var(--glass-bg-strong);
  border: 1px solid var(--glass-brd);
  border-radius: 0.9rem;
  box-shadow: var(--shadow-sm);
}
.stat-grid strong {
  max-width: 100%;
  font-size: 0.9rem;
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
.boundary-note svg {
  flex-shrink: 0;
  margin-top: 0.1rem;
}
.boundary-note strong {
  font-size: 0.78rem;
}
.boundary-note p {
  margin: 0.2rem 0 0;
  font-size: 0.68rem;
  line-height: 1.55;
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
/* ── 远征首领卡 ── */
.boss-card {
  position: relative;
  overflow: hidden;
  padding: 1.05rem 1rem;
  color: #fff;
  background:
    radial-gradient(circle at 85% 18%, rgb(255 255 255 / 16%), transparent 30%),
    linear-gradient(150deg, #44557c, #5f6da3 45%, #9a6fa0 78%, #c77e9e);
  border: 1px solid rgb(255 255 255 / 65%);
  border-radius: 1.2rem;
  box-shadow: var(--shadow-float);
}
.boss-card > * {
  position: relative;
  z-index: 1;
}
.boss-card h3 {
  margin: 0.45rem 0 0.2rem;
  font-size: 1.22rem;
  text-shadow: 0 0 14px rgb(255 214 233 / 45%);
}
.boss-card > p {
  margin: 0 0 0.9rem;
  font-size: 0.7rem;
  opacity: 0.88;
}
.boss-tag {
  padding: 0.3rem 0.6rem;
  font-size: 0.62rem;
  font-weight: 700;
  background: rgb(255 255 255 / 16%);
  border: 1px solid rgb(255 255 255 / 28%);
  border-radius: 999px;
}
.boss-orbit {
  position: absolute;
  z-index: 0;
  inset: -24% -18% auto auto;
  width: 10.5rem;
  height: 10.5rem;
  border: 1px solid rgb(255 255 255 / 14%);
  border-radius: 50%;
  animation: orbit-spin 14s linear infinite;
}
.boss-orbit i {
  position: absolute;
  inset: 19%;
  border: 1px dashed rgb(255 255 255 / 18%);
  border-radius: 50%;
  animation: orbit-spin 9s linear infinite reverse;
}
@keyframes orbit-spin {
  to {
    transform: rotate(360deg);
  }
}
.progress-copy {
  display: flex;
  justify-content: space-between;
  font-size: 0.7rem;
}
.progress-track {
  height: 0.72rem;
  overflow: hidden;
  margin-top: 0.35rem;
  background: rgb(21 43 60 / 42%);
  border: 1px solid rgb(255 255 255 / 18%);
  border-radius: 999px;
}
.progress-track i {
  position: relative;
  display: block;
  height: 100%;
  overflow: hidden;
  background: linear-gradient(90deg, #81d4ed, #ffd0e2);
  border-radius: inherit;
  transition: width 0.5s var(--ease-soft);
}
.progress-track i::after {
  position: absolute;
  inset: 0;
  content: '';
  background: linear-gradient(90deg, transparent, rgb(255 255 255 / 50%), transparent);
  transform: translateX(-100%);
  animation: shimmer 1.9s ease-in-out infinite;
}
@keyframes shimmer {
  60%,
  100% {
    transform: translateX(100%);
  }
}
.progress-numbers,
.fair-note {
  display: block;
  margin-top: 0.35rem;
  font-size: 0.62rem;
  opacity: 0.78;
}
.challenge-button {
  width: 100%;
  margin-top: 0.85rem;
  color: #6f6179;
  background: rgb(255 255 255 / 94%);
}
.challenge-button.ready {
  animation: ready-pulse 2.2s ease-in-out infinite;
}
@keyframes ready-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgb(255 255 255 / 45%);
  }
  50% {
    box-shadow: 0 0 0 0.5rem rgb(255 255 255 / 0%);
  }
}
.fair-note {
  text-align: center;
}
/* ── 战果卡 ── */
.result-card {
  position: relative;
  padding: 0.9rem;
  background: linear-gradient(135deg, #fff, #fff2f7);
  border: 1px solid #ffd3e3;
  border-radius: 1rem;
  box-shadow: var(--shadow-sm);
  animation: result-pop var(--t-slow) var(--ease-out-back) both;
}
@keyframes result-pop {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
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
  font-size: 1.05rem;
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
/* ── 同行记录 ── */
.leader-row {
  min-height: 2.9rem;
  display: grid;
  grid-template-columns: 1.8rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.5rem;
  padding: 0 0.75rem;
  font-size: 0.72rem;
  border-bottom: 1px solid #eef4f9;
}
.leader-row:last-child {
  border-bottom: 0;
}
.leader-row .rank {
  width: 1.55rem;
  height: 1.55rem;
  display: grid;
  place-items: center;
  font-size: 0.62rem;
  font-weight: 900;
  color: #8fa3b5;
  background: #f1f6fb;
  border-radius: 50%;
}
.leader-row.rank-1 .rank {
  color: #fff;
  background: linear-gradient(145deg, #ffd394, #f0a94e);
}
.leader-row.rank-2 .rank {
  color: #fff;
  background: linear-gradient(145deg, #cfd9e4, #a9bcd0);
}
.leader-row.rank-3 .rank {
  color: #fff;
  background: linear-gradient(145deg, #e8b89a, #cd8f66);
}
.leader-row em {
  font-style: normal;
  color: var(--text-dim);
}
/* ── 成员 ── */
.member-row {
  min-height: 3.6rem;
  display: grid;
  grid-template-columns: 2.5rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.55rem;
  padding: 0.5rem 0.7rem;
  border-bottom: 1px solid #eef4f9;
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
  border: 1px solid #fff;
  border-radius: 50%;
  box-shadow: var(--shadow-sm);
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
  overflow: hidden;
  font-size: 0.78rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.member-row strong svg {
  flex-shrink: 0;
  color: #e8a43c;
}
.me-chip {
  padding: 0.08rem 0.35rem;
  font-size: 0.56rem;
  font-style: normal;
  font-weight: 800;
  color: #5d7f9a;
  background: var(--blue-soft);
  border-radius: 999px;
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
  transition:
    transform var(--t-fast) var(--ease-spring),
    background-color var(--t-mid) var(--ease-soft);
}
.remove-button:active {
  transform: scale(0.88);
}
@media (hover: hover) and (pointer: fine) {
  .remove-button:hover {
    background: #fff0f4;
  }
}
/* ── 公会管理（退出 / 解散）── */
.leave-row {
  width: 100%;
  min-height: 2.75rem;
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.72rem 0.8rem;
  font-size: 0.8rem;
  font-weight: 700;
  text-align: left;
  color: #c25d77;
  transition: background-color var(--t-mid) var(--ease-soft);
}
.leave-row small {
  margin-left: auto;
  font-size: 0.62rem;
  font-weight: 400;
  color: var(--text-dim);
}
@media (hover: hover) and (pointer: fine) {
  .leave-row:hover {
    background: #fff4f7;
  }
}
.leave-confirm {
  display: grid;
  gap: 0.6rem;
  padding: 0.75rem 0.8rem 0.8rem;
  animation: form-in var(--t-slow) var(--ease-soft) both;
}
.leave-confirm p {
  margin: 0;
  font-size: 0.72rem;
  line-height: 1.6;
  color: var(--text-mid);
}
.confirm-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.55rem;
}
.danger-button {
  color: #fff;
  background: linear-gradient(120deg, #e07d92, #cf6f85);
  box-shadow: 0 0.35rem 0.8rem rgb(207 111 133 / 26%);
}
/* ── 轻提示 ── */
.guild-toast {
  position: absolute;
  z-index: 45;
  bottom: calc(1.4rem + var(--sab));
  left: 50%;
  margin: 0;
  padding: 0.6rem 0.95rem;
  font-size: 0.74rem;
  font-weight: 700;
  color: #fff;
  white-space: nowrap;
  background: linear-gradient(120deg, #5f83a8, #b05f84);
  border-radius: 999px;
  box-shadow: var(--shadow-lg);
  transform: translateX(-50%);
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
  .sky-blob,
  .sky-petal,
  .hero-crest,
  .hero-petal,
  .hero-sparkle,
  .banner-shine,
  .boss-orbit,
  .progress-track i::after,
  .challenge-button.ready,
  .petal-loader i,
  .spinning {
    animation: none;
  }
  .tab-glider,
  .progress-track i,
  .next-track i,
  .icon-button,
  .panel,
  .copy-button,
  .remove-button {
    transition: none;
  }
  .result-card,
  .create-form,
  .leave-confirm {
    animation: none;
  }
}
</style>
