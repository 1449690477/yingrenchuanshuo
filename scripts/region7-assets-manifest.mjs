/**
 * 区域 7「血月峡谷」美术资产唯一清单。
 *
 * ImageGen 原图与 Alpha 母版保存在仓库外的独立美术源目录；主仓只提交
 * 运行时压缩资源、可复现构建器、来源锁和 QA 联系表。
 */

export const REGION7_CLASSES = ['swordsman', 'witch', 'shaman', 'catkin', 'kenshi'];
export const REGION7_VISIBLE_SLOTS = ['body', 'head', 'weapon'];
export const REGION7_SLOTS = [
  'weapon',
  'head',
  'body',
  'necklace',
  'bracelet',
  'ring',
  'belt',
  'shoes',
];

export const REGION7_MAPS = [
  { id: 'r7', kind: 'region', callId: 'call_aCNFmZiAP6bJ41Sr3SJtPnsf' },
  { id: 'chapter-7-1', kind: 'chapter', callId: 'call_Bp6i4kMDDLV23bN6ZAUhfzQi' },
  { id: 'chapter-7-2', kind: 'chapter', callId: 'call_JEx6GiaEuxPHZfv44AoDCbzh' },
  { id: 'chapter-7-3', kind: 'chapter', callId: 'call_avB8zGVXv81QHwQk8DdJiClN' },
  { id: 'chapter-7-4', kind: 'chapter', callId: 'call_wEYjL2shfBqsj3Gfb9j0urol' },
  { id: 'chapter-7-5', kind: 'chapter', callId: 'call_LULvENDrH8bcInm8o1EC5IYk' },
];

export const REGION7_BATTLEFIELDS = [
  { id: 'chapter-7-1', callId: 'call_bahzfNWlYTrN9gmL16UTda2y' },
  { id: 'chapter-7-2', callId: 'call_BNJL2gskPkY7oQulWgbFzexB' },
  { id: 'chapter-7-3', callId: 'call_ktkDAwePSVlki9bSDNKQvWW2' },
  { id: 'chapter-7-4', callId: 'call_FJ5bcmupLvecuALE8iUvVW7b' },
  { id: 'chapter-7-5', callId: 'call_JQUYfE1yYOsjVEmMV3kHgieI' },
];

export const REGION7_MONSTERS = [
  { id: 'mon_7-1_0', name: '血月绒蝠', motion: 'flutter', callId: 'call_QhY8NVqNZUuUdm6shtaBEqFB' },
  { id: 'mon_7-1_1', name: '峡谷灯笼鬼', motion: 'sway', callId: 'call_j2PHTR5doW26THCO1FX4MOCT' },
  { id: 'mon_7-1_2', name: '赤晶角兔', motion: 'hopper', callId: 'call_xAQaHfEWmyUguxeWafOP3C73' },
  { id: 'mon_7-1_3', name: '雾行小恶魔', motion: 'bounce', callId: 'call_Kt3jrYN1hC1gfRG1lfXwBXxX' },
  { id: 'mon_7-2_0', name: '血沼软泥怪', motion: 'bounce', callId: 'call_T7dnZgk9anOcnHKZHu0OQoF5' },
  { id: 'mon_7-2_1', name: '绯雾魅灵', motion: 'sway', callId: 'call_BoqmL8UqA0gtAw1DFDCWlWy5' },
  { id: 'mon_7-2_2', name: '沼泽魔蕈娘', motion: 'hopper', callId: 'call_iwuhBafJaOl6J1wWOQRug5Fp' },
  { id: 'mon_7-2_3', name: '血苔团子', motion: 'bounce', callId: 'call_Bwa9G3NjuitLLsmXGPLccSmn' },
  { id: 'mon_7-2_elite', name: '血雾魔女', motion: 'royal', callId: 'call_7tJpvhS3Z5VhiNyBkFepRQmM' },
  { id: 'mon_7-3_0', name: '断魂崖鸦', motion: 'flutter', callId: 'call_mIUNnM8UwuTQ3lt3AddWz8h9' },
  { id: 'mon_7-3_1', name: '赤藤攀行者', motion: 'sway', callId: 'call_vWCrT7ghNihwiFSnHqoD03sk' },
  { id: 'mon_7-3_2', name: '崖风魅影', motion: 'flutter', callId: 'call_jOte8Rz8DG7n9gkqmxrqgIo0' },
  { id: 'mon_7-3_3', name: '魂灯角兽', motion: 'guard', callId: 'call_IU0UPQYwq6GXj8v97Bo4gGSQ' },
  { id: 'mon_7-4_0', name: '恶魔侍童', motion: 'hopper', callId: 'call_3pT5F3iQ9XumHNgXdquIJLrS' },
  { id: 'mon_7-4_1', name: '月痕石像鬼', motion: 'guard', callId: 'call_TqVqsykE0wqHAFGO9BBXslZy' },
  { id: 'mon_7-4_2', name: '红缎魅灵', motion: 'sway', callId: 'call_eUikFO4sMbmRHF1UBmMEnqPW' },
  { id: 'mon_7-4_3', name: '三叉戟小鬼', motion: 'bounce', callId: 'call_M9m0z1NGZzYLjhAfRNUOkZ7y' },
  {
    id: 'mon_7-4_elite',
    name: '小恶魔娘三姐妹',
    motion: 'royal',
    subjectCount: 3,
    callId: 'call_FELxTcqYXJzPjF3S0wUga0Ar',
  },
  { id: 'mon_7-5_0', name: '血月祭司', motion: 'sway', callId: 'call_TWbrFhmoTqfeyu0WdLiAOmFr' },
  { id: 'mon_7-5_1', name: '猩红祷灵', motion: 'flutter', callId: 'call_xUO49PBNAVgXE78wgh41qxNY' },
  { id: 'mon_7-5_2', name: '月蚀守卫', motion: 'guard', callId: 'call_es6bgS64IIBf0CqPHUPeofg1' },
  { id: 'mon_7-5_3', name: '莉莉姆近侍', motion: 'hopper', callId: 'call_m76bFqdYFHTIVW8WpxYwQ4oJ' },
  { id: 'mon_7-5_elite', name: '血月大祭司', motion: 'royal', callId: 'call_zXw76k1Su0oxfDGw385aUh4A' },
  { id: 'mon_7-5_boss', name: '血月恶魔·莉莉姆', motion: 'royal', callId: 'call_DQOoaAMuEVj2WRH9NZ9qnqbo' },
];

export const REGION7_ITEMS = [
  { id: 'dew_bloodmist', kind: 'material', callId: 'call_fPHvYbzq9kwUG5V5MJWf1ls0' },
  { id: 'herb_soulbreak', kind: 'material', callId: 'call_FDDhB4gKJ56ZrtKtN7pgPpI7' },
  { id: 'horn_demon', kind: 'material', callId: 'call_0EmxLDVminZr4BWNfseUxtN6' },
  { id: 'eye_bloodmoon', kind: 'material', callId: 'call_bmU6JELz8iAbCuZ8Fq0zqSeb' },
  { id: 'frag_bloodmoon', kind: 'fragment', callId: 'call_g2kgLdJHa2hOTBwQBkL5Ds5J' },
];

const equipmentCallIds = {
  weapon: 'call_QLgKuITJlr6l6RvqUySaXhPw',
  head: 'call_S3zF0ibfIUkzsrsEkQVuMoFn',
  body: 'call_bQ1gFjjVeXCO3ONd8vADIOzU',
  necklace: 'call_qKFu4PLixP2E95yri9tMlWwn',
  bracelet: 'call_p4TYEvwRB1DWClT18a88DpDy',
  ring: 'call_uXPW7ADucbLj8Cl31gpznhkR',
  belt: 'call_hLfUaGUSRtuGLr4K8ZP31n8Y',
  shoes: 'call_pbgoV6O9Eey5gLrWTFRsRuiE',
};
const setEquipmentCallIds = {
  weapon: 'call_03KiNvIropyJyPZQipBRCEQm',
  head: 'call_GDDTDSU52wifRuYgkukUfzvO',
  body: 'call_lAUsfCFPQKU4XjzTbs1EFe4X',
  necklace: 'call_5HxpVFcrU52E58iHkIwL3gyv',
  bracelet: 'call_c8HNS92Bcb9Gbak3U12UR7m2',
  ring: 'call_mcQorPzqDD6EnPr2JQ4FKLkJ',
  belt: 'call_vmJpa34JagK1YhxdChO2INP4',
  shoes: 'call_tjTkqPIftsFi5eMI72xIY6Bh',
};

export const REGION7_EQUIPMENT = REGION7_SLOTS.map((slot) => ({
  id: `r7-${slot}`,
  family: 'region',
  slot,
  callId: equipmentCallIds[slot],
}));
export const REGION7_SET_EQUIPMENT = REGION7_SLOTS.map((slot) => ({
  id: `r7-bloodmoon-${slot}`,
  family: 'set',
  slot,
  callId: setEquipmentCallIds[slot],
}));
export const REGION7_BADGE = {
  id: 'r7-bloodmoon-badge',
  family: 'badge',
  callId: 'call_Jd5ggaDgxiydH54VcsxagTAa',
};

const modularCallIds = {
  swordsman: {
    r7: {
      body: 'call_bWivishlEoov9j2l4GSmPwrd',
      head: 'call_i1IA8fw21pkpLn97jjg7kXSE',
      weapon: 'call_fOKP2Ec1kEt0ofeJS3uqiGPP',
    },
    'r7-bloodmoon': {
      body: 'call_d60OJvO1fY0xWL32a2EoSgLE',
      head: 'call_wfe1Wt1E0H0QcdUoZsxBDquh',
      weapon: 'call_7HeHY2R6C6ENViMfM2iLV210',
    },
  },
  witch: {
    r7: {
      body: 'call_D12nJJSQ0N5xKm2B22Z7fUMS',
      head: 'call_36KwV74vfdeD55nhyvXEry4k',
      weapon: 'call_Omh7xnnjvq5vXg6p5MbcjyAJ',
    },
    'r7-bloodmoon': {
      body: 'call_QrnzqiXGm4B926wgHA9L9kav',
      head: 'call_vf5NIjLlNvBPFDI1K5HwQ5LQ',
      weapon: 'call_cqQPKdKo8hmJqEr4LdFkXH4U',
    },
  },
  shaman: {
    r7: {
      body: 'call_w13RXOjMz3YNTaP9ROlgvjbD',
      head: 'call_GwxEHJWUPCmKahD8WjBj6RaX',
      weapon: 'call_x8tI9gIR2fyBjrvWjTWzvC8D',
    },
    'r7-bloodmoon': {
      body: 'call_5nW3yEHxkhBOf55mTJDPmS2W',
      head: 'call_2K969ifL5xax3AMc2JTaAFEg',
      weapon: 'call_av70VsenXV9giMwQXIqYr1cu',
    },
  },
  catkin: {
    r7: {
      body: 'call_eEe6vNqmeQeIQKUiLSNrdapC',
      head: 'call_gHqnks7qiYXbefisPxtGaRqC',
      weapon: 'call_RHx1V72Zb4OqYHUqJP23wSX2',
    },
    'r7-bloodmoon': {
      body: 'call_pXLLt3BTbTZW1XfO1WZ0RY0a',
      head: 'call_6Kg0Vk3DdEbPnwS9XWoAnTGb',
      weapon: 'call_Q9FQuZ8DIdg30npk1aP7w158',
    },
  },
  kenshi: {
    r7: {
      body: 'contract-kenshi-r7-r7-body',
      head: 'contract-kenshi-r7-r7-head',
      weapon: 'contract-kenshi-r7-r7-weapon',
    },
    'r7-bloodmoon': {
      body: 'contract-kenshi-r7-r7-bloodmoon-body',
      head: 'contract-kenshi-r7-r7-bloodmoon-head',
      weapon: 'contract-kenshi-r7-r7-bloodmoon-weapon',
    },
  },
};

export const REGION7_MODULAR_LAYERS = REGION7_CLASSES.flatMap((classId) =>
  REGION7_VISIBLE_SLOTS.map((slot) => ({
    classId,
    family: 'r7',
    slot,
    id: `${classId}-r7-${slot}`,
    callId: modularCallIds[classId].r7[slot],
  })),
);
export const REGION7_SET_MODULAR_LAYERS = REGION7_CLASSES.flatMap((classId) =>
  REGION7_VISIBLE_SLOTS.map((slot) => ({
    classId,
    family: 'r7-bloodmoon',
    slot,
    id: `${classId}-r7-bloodmoon-${slot}`,
    callId: modularCallIds[classId]['r7-bloodmoon'][slot],
  })),
);

export const REGION7_COUNTS = Object.freeze({
  maps: 6,
  battlefields: 5,
  monsters: 24,
  items: 5,
  equipment: 8,
  setEquipment: 8,
  badges: 1,
  modularLayers: 15,
  setModularLayers: 15,
  regionContentRuntime: 55,
  regionSetRuntime: 21,
  runtimeTotal: 87,
});

export const REGION7_ALL_ASSETS = [
  ...REGION7_MAPS.map((asset) => ({ ...asset, category: 'map' })),
  ...REGION7_BATTLEFIELDS.map((asset) => ({ ...asset, category: 'battlefield' })),
  ...REGION7_MONSTERS.map((asset) => ({ ...asset, category: 'monster' })),
  ...REGION7_ITEMS.map((asset) => ({ ...asset, category: 'item' })),
  ...REGION7_EQUIPMENT.map((asset) => ({ ...asset, category: 'equipment' })),
  ...REGION7_SET_EQUIPMENT.map((asset) => ({ ...asset, category: 'set-equipment' })),
  { ...REGION7_BADGE, category: 'badge' },
  ...REGION7_MODULAR_LAYERS.map((asset) => ({ ...asset, category: 'layer' })),
  ...REGION7_SET_MODULAR_LAYERS.map((asset) => ({ ...asset, category: 'set-layer' })),
];
