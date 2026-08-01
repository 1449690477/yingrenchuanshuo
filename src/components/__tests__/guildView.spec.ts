import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const guild = readFileSync(new URL('../../views/GuildView.vue', import.meta.url), 'utf8');
const more = readFileSync(new URL('../../views/MoreView.vue', import.meta.url), 'utf8');
const commissions = readFileSync(
  new URL('../guild/GuildCommissionBoard.vue', import.meta.url),
  'utf8',
);
const stronghold = readFileSync(
  new URL('../guild/GuildStrongholdBoard.vue', import.meta.url),
  'utf8',
);

describe('公会竖屏与单层页面契约', () => {
  it('从更多页以单层子页面交接并在关闭后恢复入口焦点', () => {
    expect(more).toContain('<GuildView v-if="showGuild"');
    expect(more).toContain('guildEntryButton.value?.focus()');
    expect(more).toContain('showGuild || guildLeaving');
    expect(more).not.toContain('公会 · M8-3');
  });

  it('更多页入口与公会顶部使用专用庭院场景，并以稳定最小高度防止横幅塌缩', () => {
    expect(more).toContain('GUILD_HOME_SCENE_ASSET');
    expect(more).toContain('class="guild-entry-scene"');
    expect(guild).toContain('class="guild-banner-scene"');
    expect(guild).toMatch(/\.guild-banner\s*\{[\s\S]*?min-height:\s*10\.5rem/);
    expect(guild).toContain('env(safe-area-inset-top)');
  });

  it('页面使用绝对单层覆盖，不创建 dialog 或弹窗套弹窗', () => {
    expect(guild).toMatch(/\.guild-view\s*\{[\s\S]*?position:\s*absolute/);
    expect(guild).not.toContain('<dialog');
    expect(guild).not.toContain('role="dialog"');
    expect(guild).not.toContain('Teleport');
  });

  it('320px 起保持流式列、无横向溢出并锁定 44px 触控目标', () => {
    expect(guild).toContain('grid-template-columns: auto minmax(0, 1fr)');
    expect(guild).toContain('overflow-x: hidden');
    expect(guild).toContain('min-height: 2.75rem');
    expect(guild).not.toContain('width: 390px');
    expect(guild).not.toContain('width: 320px');
  });

  it('挑战结果内联展示且明确不会出售战斗成长', () => {
    expect(guild).toContain('<GuildExpeditionBattleScene');
    expect(guild).toContain(':result="guild.lastResult"');
    expect(guild).toContain('challengeExpedition');
    expect(guild).toContain('guildPlaybackKey.value++');
    expect(guild).toContain('v-if="guild.lastResult"');
    expect(guild).toContain('功勋只记录在服务器');
    expect(guild).toContain('不会出售攻击、掉率或离线收益');
    expect(guild).toContain('没有战力奖励');
  });

  it('会员与非会员都能通过广场浏览任意公会详情', () => {
    expect(guild).toContain("id: 'plaza'");
    expect(guild).toContain('<GuildPlazaList');
    expect(guild).toContain('<GuildDetailSheet />');
    expect(guild).toContain('guild.openDetail(item.id)');
  });

  it('成员名册每行可打开统一的人物详情，并让移除按钮保持独立操作', () => {
    expect(guild).toContain('openMemberPeek(member, index)');
    expect(guild).toContain('class="member-peek"');
    expect(guild).toContain('查看成员 ${member.displayName} 的人物详情');
    expect(guild).toContain('<PlayerPeekSheet');
    expect(guild).toContain('context="guild"');
    expect(guild).toContain('@close="memberPeekTarget = null"');
  });

  it('邀请码加入与复制邀请入口齐备', () => {
    expect(guild).toContain('凭邀请码加入');
    expect(guild).toContain('guild.joinByCode(codeDraft.value.trim())');
    expect(guild).toContain('复制邀请码');
    expect(guild).toContain('guild-invite');
  });

  it('退出与解散入口收进公会管理面板并二次确认', () => {
    expect(guild).toContain('公会管理');
    expect(guild).toContain('退出公会');
    expect(guild).toContain('解散公会');
    expect(guild).toContain('confirmLeave');
  });

  it('首页嵌入非阻断的今日建设委托，并深链到既有远征页', () => {
    expect(guild).toContain('<GuildCommissionBoard');
    expect(guild).toContain('@expedition="activeTab = \'expedition\'"');
    expect(commissions).toContain('今日建设委托');
    expect(commissions).toContain('远征评分由服务器复算');
    expect(commissions).toContain('不发放战力资产');
    expect(commissions).toContain('GUILD_STRONGHOLD_SCENE_ASSET');
    expect(commissions).toContain('class="commission-visual"');
    expect(commissions).not.toContain('<dialog');
    expect(commissions).not.toContain('Teleport');
  });

  it('委托板从 320px 竖屏开始保持触控和减弱动效边界', () => {
    expect(commissions).toContain('grid-template-columns: 2.25rem minmax(0, 1fr) auto');
    expect(commissions).toContain('min-height: 2.75rem');
    expect(commissions).toContain('prefers-reduced-motion: reduce');
  });

  it('首页接入赛季据点、功勋捐献与无弹窗收藏商店', () => {
    expect(guild).toContain('<GuildStrongholdBoard');
    expect(guild).toContain('guild.donateMerit(amount)');
    expect(guild).toContain('guild.claimShopOffer(offerId)');
    expect(stronghold).toContain('赛季据点');
    expect(stronghold).toContain('功勋收藏');
    expect(stronghold).toContain('全程由服务器保管');
    expect(stronghold).toContain('GUILD_STRONGHOLD_SCENE_ASSET');
    expect(stronghold).toContain('class="stage-scene"');
    expect(stronghold).toContain('min-height: 2.75rem');
    expect(stronghold).toContain('prefers-reduced-motion: reduce');
    expect(stronghold).not.toContain('<dialog');
    expect(stronghold).not.toContain('Teleport');
  });
});
