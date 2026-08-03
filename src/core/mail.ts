/**
 * 邮件核心（M4-5）。
 *
 * 纯函数（铁律 1）：不读存档、不触 UI、不读时钟外状态；
 * now 由调用方传入，方便测试钉住时间。
 *
 * 状态模型：
 * - 每条邮件 = 一个模板的一次入箱；templateId 即唯一键（幂等入箱）。
 * - 邮件**永不过期、永不自动删除**（docs/40 红线）：附件随时可领，
 *   只有玩家能主动删除，且仅可删「已领取」或「无附件」的邮件。
 * - 容量上限 MAIL_CAPACITY 条；满箱时优先腾出最旧的已领邮件，
 *   绝不挤掉仍带未领附件的邮件。
 */
import {
  getMailTemplate,
  mailHasAttachments,
  type MailTemplate,
  type MailTemplateId,
} from '@/data/mails';

export interface MailMessage {
  /** 邮件实例 id；系统邮件与 templateId 相同（幂等入箱保证唯一）。 */
  id: string;
  templateId: MailTemplateId;
  /** 入箱时间（毫秒时间戳）。 */
  deliveredAt: number;
  /** 附件是否已领取。 */
  claimed: boolean;
}

export interface MailState {
  /** 按 deliveredAt 降序（最新在前）。 */
  messages: readonly MailMessage[];
}

/** 邮箱容量：系统邮件当前仅 4 条，余量留给未来运营位。 */
export const MAIL_CAPACITY = 50;

export function createMailState(): MailState {
  return { messages: [] };
}

/**
 * 投递一封系统邮件（幂等）。
 *
 * - 模板不存在 → 原样返回；
 * - 同 templateId 已在箱（无论是否已领）→ 原样返回，不重复发；
 * - 满箱 → 腾出最旧的**已领取**邮件；若没有已领的可腾，拒收（不丢未领附件）。
 */
export function deliverMail(
  state: MailState,
  templateId: MailTemplateId,
  now: number,
): MailState {
  const template = getMailTemplate(templateId);
  if (!template) return state;
  if (state.messages.some((m) => m.templateId === templateId)) return state;

  let messages = state.messages;
  if (messages.length >= MAIL_CAPACITY) {
    const oldestClaimedIndex = findOldestClaimedIndex(messages);
    if (oldestClaimedIndex < 0) return state;
    messages = messages.filter((_, index) => index !== oldestClaimedIndex);
  }

  const message: MailMessage = {
    id: templateId,
    templateId,
    deliveredAt: now,
    claimed: false,
  };
  return { messages: [message, ...messages] };
}

export interface MailClaimResult {
  state: MailState;
  template: MailTemplate;
}

/**
 * 领取一封邮件的附件（先判后给）。
 *
 * 邮件不存在或已领取 → 返回 null（发放侧不得给任何东西）。
 * 成功则返回标记 claimed 的新状态与模板（附件内容由调用方发放）。
 */
export function claimMail(state: MailState, messageId: string): MailClaimResult | null {
  const message = state.messages.find((m) => m.id === messageId);
  if (!message || message.claimed) return null;
  const template = getMailTemplate(message.templateId);
  if (!template) return null;
  return {
    state: {
      messages: state.messages.map((m) => (m.id === messageId ? { ...m, claimed: true } : m)),
    },
    template,
  };
}

/**
 * 删除一封邮件。
 *
 * 仅允许删除**已领取**或**无附件**的邮件 —— 带未领附件的邮件删不掉，
 * 避免玩家误点丢奖励。不允许时返回 null。
 */
export function dismissMail(state: MailState, messageId: string): MailState | null {
  const message = state.messages.find((m) => m.id === messageId);
  if (!message) return null;
  if (!message.claimed) {
    const template = getMailTemplate(message.templateId);
    // 模板缺失视为「无附件」：不可领取的东西没有保留价值。
    if (template && mailHasAttachments(template)) return null;
  }
  return { messages: state.messages.filter((m) => m.id !== messageId) };
}

/** 是否还有可领取的邮件（信息型红点用：陈述事实，不带数字角标）。 */
export function hasClaimableMail(state: MailState): boolean {
  return state.messages.some((m) => !m.claimed);
}

/** 可领取的邮件数量（展示文案用；红点只读 hasClaimableMail）。 */
export function claimableMailCount(state: MailState): number {
  return state.messages.filter((m) => !m.claimed).length;
}

function findOldestClaimedIndex(messages: readonly MailMessage[]): number {
  let index = -1;
  let oldest = Number.POSITIVE_INFINITY;
  messages.forEach((m, i) => {
    if (m.claimed && m.deliveredAt < oldest) {
      oldest = m.deliveredAt;
      index = i;
    }
  });
  return index;
}
