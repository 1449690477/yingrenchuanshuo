import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const rankSource = readFileSync(new URL('../../views/RankView.vue', import.meta.url), 'utf8');
const editorSource = readFileSync(new URL('../ProfileEditor.vue', import.meta.url), 'utf8');
const peekSource = readFileSync(new URL('../PlayerPeekSheet.vue', import.meta.url), 'utf8');

describe('排行榜档案入口契约', () => {
  it('我的成绩卡可打开 ProfileEditor，并在保存后刷新公开榜单', () => {
    expect(rankSource).toContain('编辑档案');
    expect(rankSource).toContain('<ProfileEditor');
    expect(rankSource).toContain('@saved="onProfileSaved"');
    expect(rankSource).toContain('lb.refreshBoards(true)');
  });

  it('非本人榜单条目提供举报入口并接到 reportProfile', () => {
    expect(rankSource).toContain('v-if="!row.isMe && lb.status === \'ready\'"');
    expect(rankSource).toContain('@click.stop="openReport(row)"');
    expect(rankSource).toContain('await reportProfile(client');
  });

  it('榜单和编辑器统一使用三层失败回落头像组件', () => {
    expect(rankSource).toContain('<ProfileAvatar');
    expect(editorSource).toContain('<ProfileAvatar');
    expect(editorSource).toContain(':class-id="classId"');
  });

  it('人物详情可复用于公会名册，且公会语境不冒充排行榜', () => {
    expect(peekSource).toContain("context?: 'leaderboard' | 'guild'");
    expect(peekSource).toContain("props.context === 'guild'");
    expect(peekSource).toContain("isGuild ? '席位' : '名次'");
    expect(peekSource).toContain("isGuild ? '返回名册' : '返回榜单'");
    expect(peekSource).toContain('v-if="total && !isGuild"');
  });
});
