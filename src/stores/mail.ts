/**
 * 邮件 store（M4-5）。
 *
 * 职责：把 core/mail.ts 的纯判定接到存档上 ——
 * 入箱（ensureSystemMails，幂等）、领取（原子事务：先判后给）、删除。
 * 存档字段 save.mail 由 v26 迁移物化（永远存在，直接读写）。
 */
import { computed } from 'vue';
import { defineStore } from 'pinia';
import {
  claimMail,
  claimableMailCount,
  deliverMail,
  dismissMail,
  hasClaimableMail,
} from '@/core/mail';
import { getMailTemplate } from '@/data/mails';
import type { SaveData } from '@/save/schema';
import { useGameStore } from './game';

export interface MailActionResult {
  ok: boolean;
  reason?: 'no-save' | 'not-claimable' | 'not-dismissible';
}

export const useMailStore = defineStore('mail', () => {
  const game = useGameStore();

  const messages = computed(() => game.save?.mail.messages ?? []);

  /** 信息型提示口径：只说「有可领的」，不给数字角标（docs/40 红线）。 */
  const hasClaimable = computed(() =>
    game.save ? hasClaimableMail(game.save.mail) : false,
  );
  const claimableCount = computed(() =>
    game.save ? claimableMailCount(game.save.mail) : 0,
  );

  /**
   * 幂等投递系统邮件：打开邮箱时调一次即可，重复调用零副作用。
   * 触发条件全部读自既有存档数据，不新增任何字段。
   */
  function ensureSystemMails(): void {
    const s = game.save;
    if (!s) return;
    const before = s.mail;
    const now = Date.now();
    let mail = before;
    // ① 欢迎礼：人人有份。
    mail = deliverMail(mail, 'mail_welcome', now);
    // ② M3 收口纪念：全员纪念信。
    mail = deliverMail(mail, 'mail_m3_milestone', now);
    // ③ 强化保底关怀：曾强化过任意装备（背包或身上 +1 及以上）。
    if (hasEnhancedAny(s)) mail = deliverMail(mail, 'mail_enhance_care', now);
    // ④ 签到开通贺礼：签过至少一次（signInDay 为 v25 字段，null = 从未签到）。
    if (s.player.signInDay) {
      mail = deliverMail(mail, 'mail_signin_hello', now);
    }
    if (mail !== before) {
      s.mail = mail;
      void game.persist();
    }
  }

  /** 领取附件：先判后给，金币/材料一次性到账后标记已领，全程单事务。 */
  function claim(messageId: string): MailActionResult {
    const s = game.save;
    if (!s) return { ok: false, reason: 'no-save' };
    const result = claimMail(s.mail, messageId);
    if (!result) return { ok: false, reason: 'not-claimable' };

    const attachments = result.template.attachments;
    if ((attachments?.gold ?? 0) > 0) {
      s.player.gold += attachments!.gold!;
    }
    for (const item of attachments?.items ?? []) {
      s.bag.items[item.itemId] = (s.bag.items[item.itemId] ?? 0) + item.count;
    }
    s.mail = result.state;
    void game.persist();
    return { ok: true };
  }

  /** 删除邮件：仅可删已领或空件（判定在 core，这里只接线）。 */
  function dismiss(messageId: string): MailActionResult {
    const s = game.save;
    if (!s) return { ok: false, reason: 'no-save' };
    const next = dismissMail(s.mail, messageId);
    if (!next) return { ok: false, reason: 'not-dismissible' };
    s.mail = next;
    void game.persist();
    return { ok: true };
  }

  function template(templateId: string) {
    return getMailTemplate(templateId);
  }

  return {
    messages,
    hasClaimable,
    claimableCount,
    ensureSystemMails,
    claim,
    dismiss,
    template,
  };
});

function hasEnhancedAny(save: SaveData): boolean {
  if (save.bag.equipment.some((inst) => inst.enhance > 0)) return true;
  return Object.values(save.equipped).some((inst) => (inst?.enhance ?? 0) > 0);
}
