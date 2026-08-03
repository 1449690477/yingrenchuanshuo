/**
 * 邮件 store（M4-5）。
 *
 * 职责：把 core/mail.ts 的纯判定接到存档上 ——
 * 入箱（ensureSystemMails，幂等）、领取（原子事务：先判后给）、删除。
 *
 * 存档兼容说明：save.mail 字段由 v26 迁移物化（属主：小Q2，等 v25 合批落 main）。
 * 在字段落地前，这里用 readMail/writeMail 做缺省兜底，行为完全一致；
 * v26 落 main 后无需改本文件。
 */
import { computed } from 'vue';
import { defineStore } from 'pinia';
import {
  claimMail,
  claimableMailCount,
  createMailState,
  deliverMail,
  dismissMail,
  hasClaimableMail,
  type MailState,
} from '@/core/mail';
import { getMailTemplate } from '@/data/mails';
import type { SaveData } from '@/save/schema';
import { useGameStore } from './game';

type SaveWithMail = SaveData & { mail?: MailState };

function readMail(save: SaveData): MailState {
  return (save as SaveWithMail).mail ?? createMailState();
}

function writeMail(save: SaveData, mail: MailState): void {
  (save as SaveWithMail).mail = mail;
}

export interface MailActionResult {
  ok: boolean;
  reason?: 'no-save' | 'not-claimable' | 'not-dismissible';
}

export const useMailStore = defineStore('mail', () => {
  const game = useGameStore();

  const messages = computed(() => (game.save ? readMail(game.save).messages : []));

  /** 信息型提示口径：只说「有可领的」，不给数字角标（docs/40 红线）。 */
  const hasClaimable = computed(() =>
    game.save ? hasClaimableMail(readMail(game.save)) : false,
  );
  const claimableCount = computed(() =>
    game.save ? claimableMailCount(readMail(game.save)) : 0,
  );

  /**
   * 幂等投递系统邮件：打开邮箱时调一次即可，重复调用零副作用。
   * 触发条件全部读自既有存档数据，不新增任何字段。
   */
  function ensureSystemMails(): void {
    const s = game.save as SaveWithMail | null;
    if (!s) return;
    const before = readMail(s);
    const now = Date.now();
    let mail = before;
    // ① 欢迎礼：人人有份。
    mail = deliverMail(mail, 'mail_welcome', now);
    // ② M3 收口纪念：全员纪念信。
    mail = deliverMail(mail, 'mail_m3_milestone', now);
    // ③ 强化保底关怀：曾强化过任意装备（背包或身上 +1 及以上）。
    if (hasEnhancedAny(s)) mail = deliverMail(mail, 'mail_enhance_care', now);
    // ④ 签到开通贺礼：签过至少一次（signInDay 为 v25 字段，缺省即从未签到）。
    if ((s.player as { signInDay?: string | null }).signInDay) {
      mail = deliverMail(mail, 'mail_signin_hello', now);
    }
    if (mail !== before) {
      writeMail(s, mail);
      void game.persist();
    }
  }

  /** 领取附件：先判后给，金币/材料一次性到账后标记已领，全程单事务。 */
  function claim(messageId: string): MailActionResult {
    const s = game.save;
    if (!s) return { ok: false, reason: 'no-save' };
    const result = claimMail(readMail(s), messageId);
    if (!result) return { ok: false, reason: 'not-claimable' };

    const attachments = result.template.attachments;
    if ((attachments?.gold ?? 0) > 0) {
      s.player.gold += attachments!.gold!;
    }
    for (const item of attachments?.items ?? []) {
      s.bag.items[item.itemId] = (s.bag.items[item.itemId] ?? 0) + item.count;
    }
    writeMail(s, result.state);
    void game.persist();
    return { ok: true };
  }

  /** 删除邮件：仅可删已领或空件（判定在 core，这里只接线）。 */
  function dismiss(messageId: string): MailActionResult {
    const s = game.save;
    if (!s) return { ok: false, reason: 'no-save' };
    const next = dismissMail(readMail(s), messageId);
    if (!next) return { ok: false, reason: 'not-dismissible' };
    writeMail(s, next);
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
