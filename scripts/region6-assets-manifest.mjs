/**
 * 区域 6「幽影祀塔」美术资产的唯一清单。
 *
 * ImageGen 原图与 Alpha 母版保存在仓库外的独立美术源目录；主仓只提交
 * 运行时压缩资源、可复现构建器、来源锁和 QA 联系表。
 */

export const REGION6_CLASSES = ['swordsman', 'witch', 'shaman', 'catkin'];
export const REGION6_VISIBLE_SLOTS = ['body', 'head', 'weapon'];
export const REGION6_SLOTS = [
  'weapon',
  'head',
  'body',
  'necklace',
  'bracelet',
  'ring',
  'belt',
  'shoes',
];

export const REGION6_MAPS = [
  { id: 'r6', kind: 'region', callId: 'exec-1755bda1-947b-43b7-83a5-d098f0daf9a2' },
  { id: 'chapter-6-1', kind: 'chapter', callId: 'exec-4a529fa4-af7f-43c7-9db8-80ec1453dcd3' },
  { id: 'chapter-6-2', kind: 'chapter', callId: 'exec-981a6eda-cb81-4315-a0c4-ac62a0fd0baf' },
  { id: 'chapter-6-3', kind: 'chapter', callId: 'exec-9da934f1-73cc-45cd-ac84-2a0ad7929ac3' },
  { id: 'chapter-6-4', kind: 'chapter', callId: 'exec-5bc5d8d5-bf7f-481f-a116-b9bf80ffc847' },
  { id: 'chapter-6-5', kind: 'chapter', callId: 'exec-2a743c2a-0bed-44c9-81a5-559e0bdaf1d0' },
];

export const REGION6_BATTLEFIELDS = [
  { id: 'chapter-6-1', callId: 'exec-2fc96255-d543-47b9-a4e9-34c33b62cb0c' },
  { id: 'chapter-6-2', callId: 'exec-73a2e104-b009-4595-8a2c-b26aa7ad49db' },
  { id: 'chapter-6-3', callId: 'exec-fbf65401-46b4-415e-a213-145b18bb3916' },
  { id: 'chapter-6-4', callId: 'exec-b8942bf5-d43f-4cf6-a39b-2976cb3628b3' },
  { id: 'chapter-6-5', callId: 'exec-b4a3dfd1-59af-48eb-a901-f9c94118a42e' },
];

export const REGION6_MONSTERS = [
  { id: 'mon_6-1_0', name: '眠石团子', motion: 'bounce', callId: 'exec-46bb2fb1-da1c-469b-ab78-37940a4564af' },
  { id: 'mon_6-1_1', name: '刻纹石偶', motion: 'guard', callId: 'exec-ce8ec23e-28b7-401e-a81f-d06c04f744d9' },
  { id: 'mon_6-1_2', name: '黯光浮雕灵', motion: 'sway', callId: 'exec-c2947056-535e-4291-992d-b4d714c8e5ad' },
  { id: 'mon_6-1_3', name: '祀塔石翼兽', motion: 'guard', callId: 'exec-521817bd-ef42-49a1-a914-31362610a78a' },
  { id: 'mon_6-2_0', name: '经卷纸灵', motion: 'flutter', callId: 'exec-f5648d38-8fb1-47aa-a3e7-5c2a18411e9c' },
  { id: 'mon_6-2_1', name: '幽灯侍从', motion: 'sway', callId: 'exec-4aa5b875-6def-47ff-b56f-68ff81eecec4' },
  { id: 'mon_6-2_2', name: '祷钟蝠灵', motion: 'flutter', callId: 'exec-53779a2e-c26e-4c58-a526-6828a9bcd010' },
  { id: 'mon_6-2_3', name: '黑纱祭偶', motion: 'bounce', callId: 'exec-9cecef3b-6278-467f-a38d-0003859c0ad0' },
  { id: 'mon_6-2_elite', name: '幽影祭司', motion: 'royal', callId: 'exec-2c178949-cfb7-49e8-9292-fe8e2f21bd3f' },
  { id: 'mon_6-3_0', name: '墨页书灵', motion: 'flutter', callId: 'exec-d2b04fe8-3320-4d3f-aeae-156a7d112bcf' },
  { id: 'mon_6-3_1', name: '残烛经使', motion: 'sway', callId: 'exec-68252006-e877-472c-b269-a995dc623883' },
  { id: 'mon_6-3_2', name: '锁链卷轴怪', motion: 'hopper', callId: 'exec-5129b974-99ba-425a-9f9f-2f191266c8ca' },
  { id: 'mon_6-3_3', name: '静默守书人', motion: 'guard', callId: 'exec-e93ed2be-9ac8-4867-b657-0240f7502bb4' },
  { id: 'mon_6-4_0', name: '影纹侍女', motion: 'sway', callId: 'exec-e1473add-2955-42a4-b52d-be8661e23da4' },
  { id: 'mon_6-4_1', name: '禁书咒灵', motion: 'flutter', callId: 'exec-e380fbe2-0b8a-465a-9fc3-507308557cb7' },
  { id: 'mon_6-4_2', name: '虚像巡礼者', motion: 'hopper', callId: 'exec-136fafe3-258d-4724-bdcd-d8117e871b5b' },
  { id: 'mon_6-4_3', name: '紫晶神龛灵', motion: 'guard', callId: 'exec-31ade97d-3de6-467d-80f5-74deb45e9226' },
  { id: 'mon_6-4_elite', name: '幽影教主候补', motion: 'royal', callId: 'exec-7921e0a4-f17b-4000-9135-ff69e9e874bc' },
  { id: 'mon_6-5_0', name: '塔顶守望者', motion: 'guard', callId: 'exec-a394a99d-aa66-4889-a1ec-68831d9dd83f' },
  { id: 'mon_6-5_1', name: '虚空星灯', motion: 'flutter', callId: 'exec-660fd3cd-ea97-46fc-b60b-c6d41f0d64dd' },
  { id: 'mon_6-5_2', name: '祀影蛇灵', motion: 'hopper', callId: 'exec-943b48b3-0824-4f0e-af29-bd0b74c2ae73' },
  { id: 'mon_6-5_3', name: '诺瓦近侍', motion: 'sway', callId: 'exec-2e060c55-72ad-4182-98f2-895976a7986f' },
  { id: 'mon_6-5_elite', name: '塔顶司祭', motion: 'guard', callId: 'exec-923e6092-3511-4295-92e3-9fa82bd7361c' },
  { id: 'mon_6-5_boss', name: '幽影教主·诺瓦', motion: 'royal', callId: 'exec-ffb15fe3-f24b-4d32-b9c0-e16da68e3508' },
];

export const REGION6_ITEMS = [
  { id: 'dust_statue', kind: 'material', callId: 'exec-91d4c281-67e4-47cb-ba09-ef56eab5cbd0' },
  { id: 'scroll_faded', kind: 'material', callId: 'exec-6b57318c-d4a5-45c6-9540-64356f2c342e' },
  { id: 'wisp_shadow', kind: 'material', callId: 'exec-d26081c3-e19c-467c-af2d-3a4e0f68212c' },
  { id: 'stone_void', kind: 'material', callId: 'exec-b49fa51d-6b1b-41de-a859-633a8140d1a1' },
  { id: 'frag_shadow', kind: 'fragment', callId: 'exec-f7e78f1a-f29e-402f-af01-87d2093c5512' },
];

const equipmentCallIds = {
  weapon: 'exec-a6d6873f-1ac7-43da-a4fb-f8b7a28c1874',
  head: 'exec-aed0faf6-bcaa-440f-adc2-4f0b416856f2',
  body: 'exec-204462a0-4cad-444f-8111-c53e92d3260a',
  necklace: 'exec-d9a9500d-b9ae-4919-8896-d5b69be1694c',
  bracelet: 'exec-5bbfbe07-32fa-4b8a-ab53-79edffdb652e',
  ring: 'exec-ed0087a3-1762-4180-a7c2-6756cc18cb19',
  belt: 'exec-db0b69aa-cd96-4a5f-9eeb-4b538fdea218',
  shoes: 'exec-8e633445-8fbf-425d-8b5d-b64ff3b84175',
};
const setEquipmentCallIds = {
  weapon: 'exec-69711f4d-92f0-42ad-8875-dbacdea0a170',
  head: 'exec-12a50ca5-3b96-44bd-91bc-2dbe8d61324f',
  body: 'exec-fe84d5c7-1331-4d4f-b4e7-42a7e2f10a87',
  necklace: 'exec-b468b74f-7979-44dc-9046-52d885572320',
  bracelet: 'exec-d42bfe97-b2f4-4059-ab60-4377b6e67704',
  ring: 'exec-efd6e983-fdc7-426b-a0f9-6fd34bc4142e',
  belt: 'exec-2972aed4-50e2-4501-b82c-ea80a094b8ce',
  shoes: 'exec-4f0a056e-45c1-419b-b905-0d42e531c831',
};

export const REGION6_EQUIPMENT = REGION6_SLOTS.map((slot) => ({
  id: `r6-${slot}`,
  family: 'region',
  slot,
  callId: equipmentCallIds[slot],
}));
export const REGION6_SET_EQUIPMENT = REGION6_SLOTS.map((slot) => ({
  id: `r6-shadow-${slot}`,
  family: 'set',
  slot,
  callId: setEquipmentCallIds[slot],
}));

const modularCallIds = {
  swordsman: {
    r6: {
      body: 'exec-e3832012-b0af-40f9-b676-25b07d6c170b',
      head: 'exec-f1c98e8c-673e-4638-bf6c-afbb0948d52a',
      weapon: 'exec-a4329eee-7f04-421d-9d88-4c437cec8a04',
    },
    'r6-shadow': {
      body: 'exec-cd76839c-f80c-4d13-8b1b-51581bf85265',
      head: 'exec-82caecb5-5836-406e-84b4-90fde0708a12',
      weapon: 'exec-41634012-98f8-4d9e-9381-702b83fbbe2b',
    },
  },
  witch: {
    r6: {
      body: 'exec-21a52374-c5a2-4c42-b900-443b435104f0',
      head: 'exec-8e80714b-666e-4481-bc46-24b163e5dcbd',
      weapon: 'exec-0bbb633d-58df-4471-8558-01a1a47edd21',
    },
    'r6-shadow': {
      body: 'exec-bf1e059a-432c-452f-96b4-6d2a155571ac',
      head: 'exec-d27fb864-c671-4001-acb2-d4ff23527d43',
      weapon: 'exec-0ae7ff0b-111d-47d8-aee6-dee801a3b88e',
    },
  },
  shaman: {
    r6: {
      body: 'exec-48137945-ddfe-47f9-9f61-9ad003d7a889',
      head: 'exec-ad15b52c-d6cb-47c7-943b-393f6b2df4e2',
      weapon: 'exec-8a3b29d7-1c5d-40b2-9a1c-08e4ccaae507',
    },
    'r6-shadow': {
      body: 'exec-c8aaf8f2-6946-406c-84aa-0f13479b694d',
      head: 'exec-8f66e271-f813-4fcd-8776-6b87ec4a8e6c',
      weapon: 'exec-1a9b9929-b919-47ce-b24e-4bf206cb14c6',
    },
  },
  catkin: {
    r6: {
      body: 'exec-c4c9a751-0717-4766-a2af-0108f53627ab',
      head: 'exec-e448b202-66f9-429a-ad61-5dd73d8380ee',
      weapon: 'exec-dbcb80df-8672-49d4-bf32-01f4f25e2b25',
    },
    'r6-shadow': {
      body: 'exec-1dcad859-5e89-46fe-9c6c-aef7662eed7e',
      head: 'exec-72a8bf3b-888b-4872-892d-39edc2f3b54c',
      weapon: 'exec-28ff8ff2-5a9b-4ce1-a37d-e4ccd09679b3',
    },
  },
};

export const REGION6_MODULAR_LAYERS = REGION6_CLASSES.flatMap((classId) =>
  REGION6_VISIBLE_SLOTS.map((slot) => ({
    classId,
    family: 'r6',
    slot,
    id: `${classId}-r6-${slot}`,
    callId: modularCallIds[classId].r6[slot],
  })),
);
export const REGION6_SET_MODULAR_LAYERS = REGION6_CLASSES.flatMap((classId) =>
  REGION6_VISIBLE_SLOTS.map((slot) => ({
    classId,
    family: 'r6-shadow',
    slot,
    id: `${classId}-r6-shadow-${slot}`,
    callId: modularCallIds[classId]['r6-shadow'][slot],
  })),
);

export const REGION6_COUNTS = Object.freeze({
  maps: 6,
  battlefields: 5,
  monsters: 24,
  items: 5,
  equipment: 8,
  setEquipment: 8,
  modularLayers: 12,
  setModularLayers: 12,
  regionContentRuntime: 55,
  regionSetRuntime: 20,
  runtimeTotal: 80,
});

export const REGION6_ALL_ASSETS = [
  ...REGION6_MAPS.map((asset) => ({ ...asset, category: 'map' })),
  ...REGION6_BATTLEFIELDS.map((asset) => ({ ...asset, category: 'battlefield' })),
  ...REGION6_MONSTERS.map((asset) => ({ ...asset, category: 'monster' })),
  ...REGION6_ITEMS.map((asset) => ({ ...asset, category: 'item' })),
  ...REGION6_EQUIPMENT.map((asset) => ({ ...asset, category: 'equipment' })),
  ...REGION6_SET_EQUIPMENT.map((asset) => ({ ...asset, category: 'set-equipment' })),
  ...REGION6_MODULAR_LAYERS.map((asset) => ({ ...asset, category: 'layer' })),
  ...REGION6_SET_MODULAR_LAYERS.map((asset) => ({ ...asset, category: 'set-layer' })),
];
