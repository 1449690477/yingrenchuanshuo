import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * docs/58 附录 B · kimi 侧烙印 UI 三件（B-1 烙印台 / B-2 掉落展示改材料 /
 * B-3 旧装绝版标）的源码契约测试。
 *
 * 校验与扣减一律走 store 契约（evaluateImprint / imprintEquipment /
 * unlockedImprintSetIds），UI 不复算（docs/57 §四的口径纪律）；
 * 三件 UI 与 claude 的材料注册 + 掉落表切换同属「激活批次」，
 * 开关在 src/ui/imprintActivation.ts，上线前必须保持 false。
 */

const benchSource = readFileSync(
  new URL('../imprint/ImprintBench.vue', import.meta.url),
  'utf8',
);
const displaySource = readFileSync(
  new URL('../imprint/imprintDisplay.ts', import.meta.url),
  'utf8',
);
const activationSource = readFileSync(
  new URL('../../ui/imprintActivation.ts', import.meta.url),
  'utf8',
);
const dungeonViewSource = readFileSync(
  new URL('../../views/DungeonView.vue', import.meta.url),
  'utf8',
);
const iconSource = readFileSync(new URL('../EquipmentIcon.vue', import.meta.url), 'utf8');
const detailSource = readFileSync(new URL('../EquipDetail.vue', import.meta.url), 'utf8');

describe('激活开关（docs/58 §六 · 激活批次同上线）', () => {
  it('上线前开关必须保持 false，且三件 UI 都挂在同一个开关上', () => {
    expect(activationSource).toContain('IMPRINT_BATCH_ACTIVE = false');
    expect(dungeonViewSource).toContain("from '@/ui/imprintActivation'");
    expect(iconSource).toContain("from '@/ui/imprintActivation'");
    expect(detailSource).toContain("from '@/ui/imprintActivation'");
  });
});

describe('B-1 · 烙印台', () => {
  it('校验与执行一律走 store 契约，UI 不复算', () => {
    expect(benchSource).toContain('game.evaluateImprint(');
    expect(benchSource).toContain('game.imprintEquipment(');
    expect(benchSource).toContain('game.unlockedImprintSetIds');
    // 不直接 import 纯函数层做判定（类型导入除外）
    expect(benchSource).not.toContain('planImprint(');
  });

  it('全部 reason 分支都有人话文案', () => {
    for (const reason of [
      'set-not-imprintable',
      'set-locked',
      'def-set-conflict',
      'fixed-template',
      'pending-affix',
      'already-imprinted-same',
    ]) {
      expect(benchSource).toContain(`'${reason}'`);
    }
    // materials / gold 走带数字的特判文案
    expect(benchSource).toContain("current.reason === 'materials'");
    expect(benchSource).toContain("current.reason === 'gold'");
  });

  it('红线一：材料不足只指路不给购买入口', () => {
    expect(benchSource).toContain('今日副本还有');
    expect(benchSource).toContain('还差');
    // 只查模板（script 里的红线注释本身会提到「购买」）
    const template = benchSource.split('<template>')[1] ?? '';
    expect(template).not.toMatch(/购买|商店|充值/);
  });

  it('红线二：确认页写明品质、词条、强化全部保留', () => {
    expect(benchSource).toContain('品质、词条、强化全部保留');
  });

  it('set-locked 给首通指路；弹层可及性齐全', () => {
    expect(benchSource).toContain('首通该档任意入口后，这套装备图纸才会解锁');
    expect(benchSource).toContain('role="dialog"');
    expect(benchSource).toContain('aria-modal="true"');
    expect(benchSource).toContain("event.key === 'Escape'");
  });

  it('320×568 矮屏压缩档存在', () => {
    expect(benchSource).toContain('@media (max-height: 620px)');
  });
});

describe('B-2 · 副本掉落展示改材料（开关默认关）', () => {
  it('激活态展示材料、非激活态仍是装备列表', () => {
    expect(dungeonViewSource).toContain('v-if="imprintActive" class="drop-list material-list"');
    expect(dungeonViewSource).toContain('v-else class="drop-list"');
  });

  it('材料数量口径照 docs/58 §3.2/§3.3，不自己发明', () => {
    expect(dungeonViewSource).toContain('胜利 ×2~3');
    expect(dungeonViewSource).toContain('每 6 胜保底 ×1');
    expect(dungeonViewSource).toContain('×4');
  });

  it('材料展示表 id 与 data/imprintRules 同源，图标路径走 assets/items', async () => {
    const { IMPRINT_CRYSTAL_DISPLAY, IMPRINT_CORE_DISPLAY, imprintMaterialIconUrl } =
      await import('../imprint/imprintDisplay');
    const { IMPRINT_CRYSTAL_IDS, IMPRINT_CORE_ID, IMPRINT_SET_TIER, IMPRINTABLE_SET_IDS } =
      await import('@/data/imprintRules');

    for (const setId of IMPRINTABLE_SET_IDS) {
      const tier = IMPRINT_SET_TIER[setId];
      expect(IMPRINT_CRYSTAL_DISPLAY[tier].id).toBe(IMPRINT_CRYSTAL_IDS[tier]);
    }
    expect(IMPRINT_CORE_DISPLAY.id).toBe(IMPRINT_CORE_ID);
    expect(imprintMaterialIconUrl('x')).toContain('assets/items/x.png');
    // 名称与 docs/58 §3.1 材料表逐字一致
    expect(IMPRINT_CRYSTAL_DISPLAY.azure.name).toBe('苍蓝烙印晶');
    expect(IMPRINT_CRYSTAL_DISPLAY.crimson.name).toBe('赤红烙印晶');
    expect(IMPRINT_CORE_DISPLAY.name).toBe('星纹核');
    expect(displaySource).toContain('绛紫烙印晶');
    expect(displaySource).toContain('辉金烙印晶');
  });

  it('正式图标 404 有兜底，不让破图流出', () => {
    expect(dungeonViewSource).toContain('onImprintIconError');
    expect(benchSource).toContain('onIconError');
  });
});

describe('B-3 · 旧副本整装绝版标', () => {
  it('判定照文档：定义级 setId 为 set_dungeon_*，且挂在激活开关上', () => {
    expect(iconSource).toContain("props.def.setId?.startsWith('set_dungeon_')");
    expect(iconSource).toContain('IMPRINT_BATCH_ACTIVE');
    expect(iconSource).toContain('绝版');
  });

  it('详情页：烙印所得读 instance.imprintSetId，旧装带绝版小标', () => {
    expect(detailSource).toContain('props.inst.imprintSetId ?? def.value.setId');
    expect(detailSource).toContain('绝版 · 不再掉落');
    expect(detailSource).toContain('set-origin-mark');
  });
});
