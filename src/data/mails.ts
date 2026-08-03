/**
 * 邮件模板定义（M4-5，docs/14 系统清单）。
 *
 * 内容与代码分离（铁律 2）：本文件只描述邮件本身（谁发的/说什么/送什么），
 * 不包含任何逻辑。入箱、领取、删除的判定全部在 core/mail.ts。
 *
 * 设计红线（docs/40）：
 * - 邮件**永不过期、永不自动删除** —— 附件什么时候来领都可以；
 * - 不做未读角标与限时话术，只做「有好东西在这里」的信息型提示；
 * - 附件只送金币与材料，**不送装备**（装备一律走掉落/商店/锻造）。
 *
 * 每条模板以 templateId 为唯一键幂等入箱：一个存档里同一模板至多一封，
 * 系统邮件因此天然防重复发放。
 */

export type MailTemplateId =
  | 'mail_welcome'
  | 'mail_m3_milestone'
  | 'mail_enhance_care'
  | 'mail_signin_hello';

export interface MailItemAttachment {
  /** 物品 id，必须在 data/items.ts 里存在。 */
  itemId: string;
  /** 数量，正整数。 */
  count: number;
}

export interface MailAttachments {
  /** 附带的金币（0 或省略 = 不送金币）。 */
  gold?: number;
  /** 附带的材料/消耗品。 */
  items?: readonly MailItemAttachment[];
}

export interface MailTemplate {
  id: MailTemplateId;
  /** 玩家可见的邮件标题。 */
  title: string;
  /** 发件人署名。 */
  sender: string;
  /** 正文，纯文本换行。 */
  body: string;
  /** 附件；省略 = 空件（纯信件，可直接删除）。 */
  attachments?: MailAttachments;
}

export const MAIL_TEMPLATES: readonly MailTemplate[] = [
  {
    id: 'mail_welcome',
    title: '欢迎来到樱之大陆',
    sender: '樱庭邮差',
    body:
      '亲爱的冒险者：\n' +
      '欢迎抵达樱之大陆！樱庭的大家已经听说你的到来了。\n' +
      '挂机、推关、强化、与少女们相处——按你自己的节奏来就好，\n' +
      '这里没有任何需要赶的事情。\n\n' +
      '随信附上一份小小的见面礼，祝你一路顺风。',
    attachments: {
      gold: 500,
      items: [{ itemId: 'stone_enhance', count: 10 }],
    },
  },
  {
    id: 'mail_m3_milestone',
    title: '樱花祭纪念',
    sender: '樱庭邮差',
    body:
      '亲爱的冒险者：\n' +
      '樱花祭顺利落幕了！战力飘字、信息提示与虫娘洞窟的收口\n' +
      '都有你的一份功劳，樱庭特意备下纪念礼。\n\n' +
      '下一段旅程也会慢慢铺开，不着急，随时来领。',
    attachments: {
      gold: 800,
      items: [{ itemId: 'stone_reforge', count: 3 }],
    },
  },
  {
    id: 'mail_enhance_care',
    title: '强化的路上别灰心',
    sender: '锻造屋的灯',
    body:
      '听说你最近在冲击更高的强化等级。\n' +
      '失败几次再正常不过了——幸运值会一点点攒起来，\n' +
      '保底也一直都在，最坏的情况是可以预期的。\n\n' +
      '这点东西拿去垫垫手气，慢慢来就好。',
    attachments: {
      gold: 600,
      items: [{ itemId: 'charm_protect', count: 1 }],
    },
  },
  {
    id: 'mail_signin_hello',
    title: '签到奖励已升级',
    sender: '樱庭邮差',
    body:
      '谢谢你每天来樱庭签到！\n' +
      '为了感谢坚持，签到的里程碑奖励已经升级，\n' +
      '累计签到的每一步都算数，断签也不会清零。\n\n' +
      '随信附一份小贺礼，明天也期待见到你。',
    attachments: {
      gold: 400,
      items: [{ itemId: 'potion_hp_s', count: 2 }],
    },
  },
];

export function getMailTemplate(id: string): MailTemplate | undefined {
  return MAIL_TEMPLATES.find((t) => t.id === id);
}

/** 附件是否非空（金币或任一物品数量 > 0）。空件 = 纯信件，可直接删除。 */
export function mailHasAttachments(template: MailTemplate): boolean {
  const a = template.attachments;
  if (!a) return false;
  if ((a.gold ?? 0) > 0) return true;
  return (a.items ?? []).some((i) => i.count > 0);
}
