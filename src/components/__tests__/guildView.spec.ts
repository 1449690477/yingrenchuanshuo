import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const guild = readFileSync(new URL('../../views/GuildView.vue', import.meta.url), 'utf8');
const more = readFileSync(new URL('../../views/MoreView.vue', import.meta.url), 'utf8');

describe('公会竖屏与单层页面契约', () => {
  it('从更多页以单层子页面交接并在关闭后恢复入口焦点', () => {
    expect(more).toContain('<GuildView v-if="showGuild"');
    expect(more).toContain('guildEntryButton.value?.focus()');
    expect(more).toContain('showGuild || guildLeaving');
    expect(more).not.toContain('公会 · M8-3');
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

  it('挑战结果内联展示且明确首版无战力奖励', () => {
    expect(guild).toContain('v-if="guild.lastResult"');
    expect(guild).toContain('首版不出售成长');
    expect(guild).toContain('没有战力奖励');
  });

  it('会员与非会员都能通过广场浏览任意公会详情', () => {
    expect(guild).toContain("id: 'plaza'");
    expect(guild).toContain('<GuildPlazaList');
    expect(guild).toContain('<GuildDetailSheet />');
    expect(guild).toContain('guild.openDetail(item.id)');
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
});
