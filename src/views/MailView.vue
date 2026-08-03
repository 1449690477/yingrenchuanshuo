<script setup lang="ts">
/**
 * MailView —— 邮箱（M4-5）。
 *
 * overlay 子视图（与 GuildView / SetCodexView 同款外壳）：由 MoreView 的
 * showMail + Transition page-up 挂载，emit('close') 返回。
 *
 * 设计红线（docs/40）：
 * - 邮件永不过期、永不自动删除，附件随时可领；
 * - 不做未读角标/数字红点，未领取只用一枚信息型小圆点（陈述事实）；
 * - 领取先判后给（core/mail.ts），删除仅可删已领或空件。
 */
import { computed, nextTick, onMounted, ref } from 'vue';
import { ArrowLeft, Coins, Gift, MailOpen, Package, Trash2 } from '@lucide/vue';
import { itemName } from '@/data/items';
import { mailHasAttachments } from '@/data/mails';
import { useMailStore } from '@/stores/mail';

const emit = defineEmits<{ close: [] }>();
const mail = useMailStore();
const backButton = ref<HTMLButtonElement | null>(null);
const expandedId = ref<string | null>(null);
const toast = ref<{ text: string; ok: boolean } | null>(null);
let toastTimer: ReturnType<typeof setTimeout> | null = null;

onMounted(() => {
  // 幂等投递系统邮件：重复打开零副作用。
  mail.ensureSystemMails();
  void nextTick(() => backButton.value?.focus());
});

const entries = computed(() =>
  mail.messages.map((message) => {
    const template = mail.template(message.templateId);
    return { message, template };
  }),
);

function toggleExpand(id: string) {
  expandedId.value = expandedId.value === id ? null : id;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function say(text: string, ok: boolean) {
  toast.value = { text, ok };
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.value = null;
  }, 2400);
}

function claim(id: string) {
  const result = mail.claim(id);
  if (!result.ok) {
    say('这封邮件暂时领不了', false);
    return;
  }
  say('附件已放入背包', true);
}

function dismiss(id: string) {
  const result = mail.dismiss(id);
  if (!result.ok) {
    say('还有附件没领，先领取再删除', false);
    return;
  }
  if (expandedId.value === id) expandedId.value = null;
  say('邮件已删除', true);
}
</script>

<template>
  <section class="mail-view" role="region" aria-label="邮箱">
    <div class="sky" aria-hidden="true"><i class="sky-blob blob-a" /><i class="sky-blob blob-b" /></div>

    <header class="mail-top">
      <button ref="backButton" class="icon-button" aria-label="返回更多" @click="emit('close')">
        <ArrowLeft :size="19" aria-hidden="true" />
      </button>
      <span class="title-copy">
        <strong>邮箱</strong>
        <small>系统邮件 · 永不过期，随时可领</small>
      </span>
      <span class="mail-crest" aria-hidden="true"><MailOpen :size="20" /></span>
    </header>

    <main class="mail-scroll">
      <div v-if="entries.length === 0" class="state-card">
        <span class="state-crest"><MailOpen :size="26" aria-hidden="true" /></span>
        <strong>暂时没有邮件</strong>
        <p>樱庭有新消息时，会第一时间投递到这里。</p>
      </div>

      <ul v-else class="mail-list">
        <li v-for="entry in entries" :key="entry.message.id" class="mail-card">
          <button
            type="button"
            class="mail-head"
            :aria-expanded="expandedId === entry.message.id"
            @click="toggleExpand(entry.message.id)"
          >
            <span
              v-if="!entry.message.claimed"
              class="claim-dot"
              aria-label="有附件可领取"
            />
            <span class="mail-head-copy">
              <strong>{{ entry.template?.title ?? '（未知邮件）' }}</strong>
              <small>{{ entry.template?.sender ?? '樱庭' }} · {{ formatDate(entry.message.deliveredAt) }}</small>
            </span>
            <span v-if="entry.template && mailHasAttachments(entry.template)" class="mail-gift" aria-hidden="true">
              <Gift :size="16" />
            </span>
          </button>

          <div v-if="expandedId === entry.message.id && entry.template" class="mail-body">
            <p class="mail-text">{{ entry.template.body }}</p>

            <div v-if="mailHasAttachments(entry.template)" class="mail-attachments">
              <span v-if="(entry.template.attachments?.gold ?? 0) > 0" class="attach-chip">
                <Coins :size="15" aria-hidden="true" />
                金币 ×{{ entry.template.attachments?.gold }}
              </span>
              <span
                v-for="item in entry.template.attachments?.items ?? []"
                :key="item.itemId"
                class="attach-chip"
              >
                <Package :size="15" aria-hidden="true" />
                {{ itemName(item.itemId) }} ×{{ item.count }}
              </span>
            </div>

            <div class="mail-actions">
              <button
                v-if="!entry.message.claimed"
                type="button"
                class="action-button primary"
                @click="claim(entry.message.id)"
              >
                <Gift :size="15" aria-hidden="true" />
                领取附件
              </button>
              <span v-else class="claimed-note">附件已领取</span>
              <button
                type="button"
                class="action-button ghost"
                :disabled="!entry.message.claimed && mailHasAttachments(entry.template)"
                :title="!entry.message.claimed && mailHasAttachments(entry.template) ? '先领取附件再删除' : '删除邮件'"
                @click="dismiss(entry.message.id)"
              >
                <Trash2 :size="15" aria-hidden="true" />
                删除
              </button>
            </div>
          </div>
        </li>
      </ul>
    </main>

    <Transition name="toast">
      <p v-if="toast" class="mail-toast" :class="toast.ok ? 'ok' : 'warn'" role="status">
        {{ toast.text }}
      </p>
    </Transition>
  </section>
</template>

<style scoped>
.mail-view {
  position: fixed;
  z-index: 30;
  top: calc(var(--topbar-h) + var(--sat));
  right: 0;
  bottom: calc(var(--tabbar-h) + var(--sab));
  left: 0;
  width: 100%;
  max-width: var(--app-max-w);
  margin-inline: auto;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  color: var(--text);
  background: linear-gradient(180deg, #eaf4ff 0%, #f5f3fd 46%, #fff2f8 100%);
}

/* ── 极光底（纯装饰，reduced-motion 时静止）── */
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
@keyframes blob-drift {
  from {
    transform: translate(0, 0) scale(1);
  }
  to {
    transform: translate(1.4rem, 0.9rem) scale(1.08);
  }
}
@media (prefers-reduced-motion: reduce) {
  .blob-a,
  .blob-b {
    animation: none;
  }
}

.mail-top {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.9rem 1rem 0.5rem;
}

.icon-button {
  min-width: 2.75rem;
  min-height: 2.75rem;
  display: grid;
  place-items: center;
  color: #587791;
  border-radius: 0.8rem;
  transition: transform 0.16s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.icon-button:active {
  transform: scale(0.88);
}
@media (hover: hover) and (pointer: fine) {
  .icon-button:hover {
    background: rgb(255 255 255 / 65%);
  }
}

.title-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  flex: 1;
}
.title-copy strong {
  font-size: 1.05rem;
  color: #33475b;
}
.title-copy small {
  font-size: 0.72rem;
  color: #7e92a6;
}
.mail-crest {
  display: grid;
  place-items: center;
  width: 2.4rem;
  height: 2.4rem;
  border-radius: 0.9rem;
  color: #ff7ea8;
  background: rgb(255 255 255 / 70%);
  box-shadow: 0 0.35rem 1rem rgb(255 126 168 / 18%);
}

.mail-scroll {
  position: relative;
  z-index: 1;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0.5rem 1rem 1.2rem;
}

.state-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  padding: 2.2rem 1.2rem;
  text-align: center;
  color: #587089;
  background: rgb(255 255 255 / 62%);
  border: 1px solid rgb(255 255 255 / 78%);
  border-radius: 1.1rem;
  box-shadow: 0 0.6rem 1.6rem rgb(120 140 190 / 10%);
}
.state-crest {
  display: grid;
  place-items: center;
  width: 3.4rem;
  height: 3.4rem;
  border-radius: 1.2rem;
  color: #ff7ea8;
  background: rgb(255 226 238 / 80%);
}

.mail-list {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.mail-card {
  border-radius: 1rem;
  background: rgb(255 255 255 / 72%);
  border: 1px solid rgb(255 255 255 / 80%);
  box-shadow: 0 0.45rem 1.3rem rgb(120 140 190 / 9%);
  overflow: hidden;
}

.mail-head {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.75rem 0.9rem;
  text-align: left;
}
.mail-head-copy {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}
.mail-head-copy strong {
  font-size: 0.92rem;
  color: #33475b;
}
.mail-head-copy small {
  font-size: 0.72rem;
  color: #7e92a6;
}

/* 信息型提示：一枚小圆点陈述「有附件可领」，无数字、无倒计时 */
.claim-dot {
  flex: none;
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 50%;
  background: #ff7ea8;
  box-shadow: 0 0 0.4rem rgb(255 126 168 / 55%);
}
.mail-gift {
  flex: none;
  display: grid;
  place-items: center;
  width: 1.9rem;
  height: 1.9rem;
  border-radius: 0.7rem;
  color: #b8860b;
  background: rgb(255 240 210 / 85%);
}

.mail-body {
  padding: 0 0.9rem 0.9rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  border-top: 1px dashed rgb(150 170 200 / 28%);
}
.mail-text {
  margin: 0.7rem 0 0;
  font-size: 0.85rem;
  line-height: 1.7;
  color: #4a5f75;
  white-space: pre-line;
}

.mail-attachments {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}
.attach-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.32rem 0.6rem;
  font-size: 0.78rem;
  color: #6b5908;
  background: rgb(255 246 219 / 90%);
  border: 1px solid rgb(214 178 94 / 40%);
  border-radius: 999px;
}

.mail-actions {
  display: flex;
  align-items: center;
  gap: 0.55rem;
}
.action-button {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 0.95rem;
  font-size: 0.85rem;
  border-radius: 0.8rem;
  transition: transform 0.16s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.action-button:active {
  transform: scale(0.94);
}
.action-button.primary {
  color: #fff;
  background: linear-gradient(135deg, #ff9fc0, #ff7ea8);
  box-shadow: 0 0.4rem 1rem rgb(255 126 168 / 35%);
}
.action-button.ghost {
  color: #7e92a6;
  background: rgb(255 255 255 / 60%);
  border: 1px solid rgb(150 170 200 / 30%);
}
.action-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.claimed-note {
  font-size: 0.8rem;
  color: #7e92a6;
}

.mail-toast {
  position: absolute;
  z-index: 2;
  left: 50%;
  bottom: 1.2rem;
  transform: translateX(-50%);
  padding: 0.5rem 1rem;
  font-size: 0.82rem;
  border-radius: 999px;
  background: rgb(51 71 91 / 88%);
  color: #fff;
}
.mail-toast.warn {
  background: rgb(146 92 40 / 90%);
}
.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 0.5rem);
}
@media (prefers-reduced-motion: reduce) {
  .toast-enter-active,
  .toast-leave-active,
  .action-button,
  .icon-button {
    transition: none;
  }
}
</style>
