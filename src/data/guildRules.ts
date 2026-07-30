/** 公会首版规则：只提供合作与展示成长，不进入玩家战斗属性。 */

export const GUILD_MEMBER_LIMIT = 20;
export const GUILD_NAME_MIN_LENGTH = 2;
export const GUILD_NAME_MAX_LENGTH = 12;
export const GUILD_NOTICE_MAX_LENGTH = 80;
export const GUILD_RESET_HOUR_CST = 4;
export const GUILD_DAILY_SUBMISSIONS = 3;
export const GUILD_CONTRIBUTION_MAX = 1_000;
export const GUILD_TARGET_DAMAGE_FRACTION = 0.25;
export const GUILD_WEEKLY_TARGET_PER_MEMBER = 4_000;
export const GUILD_WEEK_CLEAR_REPUTATION = 100;

export interface GuildDisplayStage {
  id: string;
  name: string;
  minReputation: number;
  description: string;
}

export const GUILD_DISPLAY_STAGES: readonly GuildDisplayStage[] = [
  { id: 'seedling', name: '初绽庭院', minReputation: 0, description: '一处刚刚点亮的樱灯据点' },
  { id: 'bloom', name: '繁樱庭院', minReputation: 300, description: '远征旗帜开始被旅人认得' },
  { id: 'moonlit', name: '月樱庭院', minReputation: 800, description: '夜色中也能看见归途的灯火' },
  { id: 'legend', name: '传说樱庭', minReputation: 1_500, description: '共同经历被写进樱刃传说' },
] as const;
