import { describe, expect, it } from 'vitest';
import { MAIL_TEMPLATES, mailHasAttachments } from '@/data/mails';
import {
  MAIL_CAPACITY,
  claimMail,
  claimableMailCount,
  createMailState,
  deliverMail,
  dismissMail,
  hasClaimableMail,
  type MailMessage,
  type MailState,
} from '../mail';

const NOW = 1_800_000_000_000;

function fakeMessage(index: number, claimed: boolean): MailMessage {
  return {
    id: `fake_${index}`,
    // 容量用例只关心数量与领取状态，模板 id 不参与判定。
    templateId: 'mail_welcome',
    deliveredAt: NOW - index * 1000,
    claimed,
  };
}

describe('mails 模板（M4-5）', () => {
  it('4 条系统模板：标题/发件人/正文齐全，附件只有金币与材料', () => {
    expect(MAIL_TEMPLATES).toHaveLength(4);
    for (const t of MAIL_TEMPLATES) {
      expect(t.title.length).toBeGreaterThan(0);
      expect(t.sender.length).toBeGreaterThan(0);
      expect(t.body.length).toBeGreaterThan(0);
      expect(mailHasAttachments(t)).toBe(true);
      for (const item of t.attachments?.items ?? []) {
        expect(item.count).toBeGreaterThan(0);
      }
    }
    expect(new Set(MAIL_TEMPLATES.map((t) => t.id)).size).toBe(4);
  });
});

describe('deliverMail 幂等入箱', () => {
  it('同一模板重复投递只入箱一次', () => {
    let s = createMailState();
    s = deliverMail(s, 'mail_welcome', NOW);
    s = deliverMail(s, 'mail_welcome', NOW + 5000);
    expect(s.messages).toHaveLength(1);
    expect(s.messages[0]).toEqual({
      id: 'mail_welcome',
      templateId: 'mail_welcome',
      deliveredAt: NOW,
      claimed: false,
    });
  });

  it('新邮件排在最前（deliveredAt 降序）', () => {
    let s = createMailState();
    s = deliverMail(s, 'mail_welcome', NOW);
    s = deliverMail(s, 'mail_m3_milestone', NOW + 1000);
    expect(s.messages.map((m) => m.templateId)).toEqual([
      'mail_m3_milestone',
      'mail_welcome',
    ]);
  });

  it('已领取的邮件也不重复投递', () => {
    let s = createMailState();
    s = deliverMail(s, 'mail_welcome', NOW);
    const claimed = claimMail(s, 'mail_welcome')!;
    const again = deliverMail(claimed.state, 'mail_welcome', NOW + 9000);
    expect(again.messages).toHaveLength(1);
    expect(again.messages[0].claimed).toBe(true);
  });
});

describe('容量上限', () => {
  it('满箱时腾出最旧的已领邮件', () => {
    const messages: MailMessage[] = [];
    for (let i = 0; i < MAIL_CAPACITY; i += 1) {
      // index 越大 deliveredAt 越早 → 最旧的已领件在 index 最大处
      messages.push(fakeMessage(i, i % 2 === 1));
    }
    const state: MailState = { messages };
    // 假邮件全是 mail_welcome，投递 mail_m3_milestone 避开幂等拦截
    const next = deliverMail(state, 'mail_m3_milestone', NOW);
    expect(next.messages).toHaveLength(MAIL_CAPACITY);
    expect(next.messages[0].id).toBe('mail_m3_milestone');
    const oldestClaimed = messages.filter((m) => m.claimed).at(-1)!;
    expect(next.messages.some((m) => m.id === oldestClaimed.id)).toBe(false);
    // 未领取的邮件一封不丢
    for (const m of messages.filter((x) => !x.claimed)) {
      expect(next.messages.some((x) => x.id === m.id)).toBe(true);
    }
  });

  it('满箱且全部未领取 → 拒收，绝不挤掉未领附件', () => {
    const messages = Array.from({ length: MAIL_CAPACITY }, (_, i) => fakeMessage(i, false));
    const state: MailState = { messages };
    const next = deliverMail(state, 'mail_m3_milestone', NOW);
    expect(next).toBe(state);
  });
});

describe('claimMail 先判后给', () => {
  it('首领成功并标记 claimed，二次领取返回 null', () => {
    let s = createMailState();
    s = deliverMail(s, 'mail_enhance_care', NOW);
    const result = claimMail(s, 'mail_enhance_care');
    expect(result).not.toBeNull();
    expect(result!.template.id).toBe('mail_enhance_care');
    expect(result!.state.messages[0].claimed).toBe(true);
    expect(claimMail(result!.state, 'mail_enhance_care')).toBeNull();
  });

  it('不存在的邮件返回 null', () => {
    expect(claimMail(createMailState(), 'mail_welcome')).toBeNull();
  });
});

describe('dismissMail 仅可删已领或空件', () => {
  it('已领取 → 可删', () => {
    let s = createMailState();
    s = deliverMail(s, 'mail_welcome', NOW);
    s = claimMail(s, 'mail_welcome')!.state;
    const next = dismissMail(s, 'mail_welcome');
    expect(next?.messages).toHaveLength(0);
  });

  it('未领取且带附件 → 拒绝删除', () => {
    let s = createMailState();
    s = deliverMail(s, 'mail_welcome', NOW);
    expect(dismissMail(s, 'mail_welcome')).toBeNull();
    expect(s.messages).toHaveLength(1);
  });

  it('不存在的邮件 → null', () => {
    expect(dismissMail(createMailState(), 'ghost')).toBeNull();
  });
});

describe('信息型提示读数', () => {
  it('hasClaimableMail / claimableMailCount 只数未领取', () => {
    let s = createMailState();
    expect(hasClaimableMail(s)).toBe(false);
    expect(claimableMailCount(s)).toBe(0);
    s = deliverMail(s, 'mail_welcome', NOW);
    s = deliverMail(s, 'mail_m3_milestone', NOW + 1);
    expect(hasClaimableMail(s)).toBe(true);
    expect(claimableMailCount(s)).toBe(2);
    s = claimMail(s, 'mail_welcome')!.state;
    expect(hasClaimableMail(s)).toBe(true);
    expect(claimableMailCount(s)).toBe(1);
  });
});
