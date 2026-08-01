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

describe('试炼公式版本展示契约', () => {
  it('默认是当前公式，历史榜只能由玩家显式切换', () => {
    expect(rankSource).toContain('lb.selectTrialBoardFormulaVersion(TRIAL_FORMULA_VERSION)');
    expect(rankSource).toContain(
      'lb.selectTrialBoardFormulaVersion(LEGACY_TRIAL_FORMULA_VERSION)',
    );
    expect(rankSource).toContain('当前公式 v{{ TRIAL_FORMULA_VERSION }}');
    expect(rankSource).toContain('历史 v{{ LEGACY_TRIAL_FORMULA_VERSION }}');
  });

  it('历史分数明说不参与当前排名，新榜空态不冒充联机故障', () => {
    expect(rankSource).toContain(
      '历史成绩仅供回看，不参与当前排名；新旧公式伤害不可直接比较。',
    );
    expect(rankSource).toContain('新公式榜刚开启，完成一次试炼即可上榜。');
    expect(rankSource).toContain('没有可回看的历史成绩。');
  });
});
