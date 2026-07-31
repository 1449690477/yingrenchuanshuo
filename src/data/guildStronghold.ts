/**
 * 公会据点与功勋商店内容表。
 *
 * 功勋是服务端远征结算产生的联机凭证，不等同于本地背包材料；
 * 商店奖励只解锁公会内的收藏徽记，不进入角色战斗属性。
 */
export interface GuildStrongholdStage {
  id: 'camp' | 'lantern' | 'garden' | 'citadel';
  name: string;
  minProgress: number;
  description: string;
}

export interface GuildShopOffer {
  id: 'sakura-pennant' | 'moon-lantern' | 'legend-crest';
  name: string;
  description: string;
  meritCost: number;
}

export const GUILD_STRONGHOLD_STAGES: readonly GuildStrongholdStage[] = [
  { id: 'camp', name: '樱庭营地', minProgress: 0, description: '第一盏归途灯已经点亮。' },
  { id: 'lantern', name: '灯火长街', minProgress: 12, description: '旅人会循着灯火找到这里。' },
  {
    id: 'garden',
    name: '繁樱庭院',
    minProgress: 36,
    description: '每一次远征都在庭院留下新的故事。',
  },
  { id: 'citadel', name: '传说城塞', minProgress: 72, description: '这一季的同行足以写成传说。' },
] as const;

/** 一次服务器确认的新增远征贡献最多兑换多少功勋。 */
export const GUILD_MERIT_PER_CONTRIBUTION_STEP = 200;
export const GUILD_MERIT_MAX_PER_CONTRIBUTION = 5;

/** 满额建设委托和周团本通关给据点的基础进度。 */
export const GUILD_STRONGHOLD_COMMISSION_PROGRESS = 2;
export const GUILD_STRONGHOLD_RAID_PROGRESS = 10;

/** 只接受这三档服务器功勋捐献，避免任意金额绕过客户端确认。 */
export const GUILD_DONATION_AMOUNTS = [1, 5, 10] as const;

export const GUILD_SHOP_OFFERS: readonly GuildShopOffer[] = [
  {
    id: 'sakura-pennant',
    name: '樱庭旗印',
    description: '收进本季公会收藏册的旗印。',
    meritCost: 8,
  },
  {
    id: 'moon-lantern',
    name: '月樱引灯',
    description: '收进本季公会收藏册的月灯。',
    meritCost: 18,
  },
  {
    id: 'legend-crest',
    name: '同行纹章',
    description: '据点抵达繁樱庭院后可领取的纪念纹章。',
    meritCost: 36,
  },
] as const;
