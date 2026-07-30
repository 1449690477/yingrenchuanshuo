import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { describe, expect, it } from 'vitest';
import { weeklyTrialBoss } from '@/core/trial';
import { TRIAL_BRACKETS } from '@/data/trialRules';
import type { EquippedRecord } from '@/data/characterAppearance';
import { requireTrialVisual } from '@/data/trialVisuals';
import TrialBattleScene from '../TrialBattleScene.vue';

const EMPTY_EQUIPPED: EquippedRecord = {
  weapon: null,
  head: null,
  body: null,
  necklace: null,
  bracelet: null,
  ring: null,
  belt: null,
  shoes: null,
};

describe('TrialBattleScene / 周常试炼战斗窗口', () => {
  it('待机态直接展示专属场景、具体 Boss 与完整战斗 HUD', async () => {
    const boss = weeklyTrialBoss('s1', 30, TRIAL_BRACKETS[1]!.id);
    const visual = requireTrialVisual(boss.tilt.id, boss.combatant.element);
    const app = createSSRApp(
      h(TrialBattleScene, {
        boss,
        classId: 'swordsman',
        level: 45,
        equipped: EMPTY_EQUIPPED,
        playerName: '夜见',
        run: null,
        playbackKey: 0,
        reduceMotion: false,
      }),
    );

    const html = await renderToString(app);

    expect(html).toContain('trial-window');
    expect(html).toContain('镜界实战');
    expect(html).toContain('等待挑战');
    expect(html).toContain('待演算');
    expect(html).toContain('试炼生命');
    expect(html).toContain(boss.name);
    expect(html).toContain(visual.sceneAsset);
    expect(html).toContain(visual.bossAsset);
    expect(html).toContain('第 1 阶段');
    expect(html).toContain('镜门开启');
    expect(html).toContain('speed-lines');
    expect(html).toContain('telegraph-ring');
    expect(html).toContain('burst-layer');
  });
});
