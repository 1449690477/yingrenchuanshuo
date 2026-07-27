import type { EncounterDefinition, EncounterTiming } from '@/core/encounters';

/** 首次 60 秒便于试玩，之后约每 10 分钟一次。 */
export const ENCOUNTER_TIMING: EncounterTiming = { firstSec: 60, intervalSec: 600, queueMax: 3 };

const DEFINITIONS = [
  {
    id: 'enc_r1_petalsmith',
    regionIds: ['r1'],
    title: '花径上的见习刀匠',
    story: '一位见习刀匠蹲在路旁，正为缺少柔韧的包刀材料发愁。',
    choices: [
      {
        id: 'trade',
        label: '送她一些材料',
        outcome: '刀匠把打磨剩下的强化石送给了你。',
        costs: { items: { petal_sakura: 3, grass_soft: 2 } },
        rewards: { gold: 30, items: { stone_enhance: 2 } },
      },
      { id: 'leave', label: '祝她顺利', outcome: '你们互相挥手，继续各自的旅程。' },
    ],
  },
  {
    id: 'enc_r1_bell',
    regionIds: ['r1'],
    title: '会自己响的木铃',
    story: '林间传来清脆铃声，一只小木灵想收回散落的木铃。',
    choices: [
      {
        id: 'return',
        label: '归还木铃',
        outcome: '小木灵开心地翻出一袋旧日矿石作为谢礼。',
        costs: { items: { bell_wood: 3 } },
        rewards: { gold: 80, items: { stone_enhance: 3 } },
      },
      { id: 'listen', label: '听一会儿铃声', outcome: '风声和铃声交织，让这段路轻快了不少。' },
    ],
  },
  {
    id: 'enc_r1_barrier',
    regionIds: ['r1'],
    title: '微微发亮的裂隙',
    story: '落樱结界裂开了一道细缝，温暖的光正一点点漏出来。',
    choices: [
      {
        id: 'mend',
        label: '修补结界',
        outcome: '裂隙恢复平静，一块洗练石从光芒中落入掌心。',
        costs: { items: { core_barrier: 1, petal_sakura: 4 } },
        rewards: { gold: 150, items: { stone_reforge: 1 } },
      },
      { id: 'leave', label: '先不触碰', outcome: '你记下了位置，安静地离开了结界。' },
    ],
  },
  {
    id: 'enc_r2_napper',
    regionIds: ['r2'],
    title: '睡过站的草原信使',
    story: '信使抱着包裹睡在草垛旁，醒来后发现捆包材料全散了。',
    choices: [
      {
        id: 'bundle',
        label: '帮她重新捆好',
        outcome: '包裹终于扎稳，信使送出几块随身强化石。',
        costs: { items: { straw_sleepy: 4, jelly_cotton: 3 } },
        rewards: { gold: 60, items: { stone_enhance: 3 } },
      },
      { id: 'wake', label: '提醒她别再睡了', outcome: '她认真地点头，然后站着又打了个哈欠。' },
    ],
  },
  {
    id: 'enc_r2_honey',
    regionIds: ['r2'],
    title: '蜂娘的下午茶',
    story: '巡逻的蜂娘想泡一壶甜茶，却怎么也找不到合适的杯垫。',
    choices: [
      {
        id: 'tea',
        label: '凑齐茶会材料',
        outcome: '茶会大成功，蜂娘拿出珍藏的强化石与你分享。',
        costs: { items: { honey_bee: 2, jelly_cotton: 4 } },
        rewards: { gold: 100, items: { stone_enhance: 4 } },
      },
      { id: 'decline', label: '下次再来', outcome: '蜂娘给你指了路，继续忙着准备茶点。' },
    ],
  },
  {
    id: 'enc_r2_altar',
    regionIds: ['r2'],
    title: '草原祭坛的回声',
    story: '古老祭坛发出轻柔回声，似乎在等待一块失落的结晶。',
    choices: [
      {
        id: 'answer',
        label: '回应祭坛',
        outcome: '祭坛亮起星光，凝成两块可以洗练装备的石头。',
        costs: { items: { crystal_altar: 1, straw_sleepy: 5 } },
        rewards: { gold: 180, items: { stone_reforge: 2 } },
      },
      { id: 'leave', label: '尊重这份安静', outcome: '回声渐渐远去，草浪重新盖住祭坛。' },
    ],
  },
] satisfies EncounterDefinition[];

export const ENCOUNTERS: Record<string, EncounterDefinition> = Object.fromEntries(
  DEFINITIONS.map((encounter) => [encounter.id, encounter]),
);

export function requireEncounter(id: string): EncounterDefinition {
  const encounter = ENCOUNTERS[id];
  if (!encounter) throw new Error(`[配置错误] 奇遇不存在：${id}`);
  return encounter;
}

export function encounterIdsForRegion(regionId: string): string[] {
  return DEFINITIONS.filter((e) => e.regionIds.includes(regionId)).map((e) => e.id);
}
