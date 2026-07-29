/**
 * 发布版 v10 能识别的装备定义 ID 快照。
 *
 * 迁移校验不能从当前 EQUIPMENT 动态派生这份集合：后续版本新增装备后，
 * 动态集合会把发布时根本不存在的 defId 反向判成“合法 v10”。这里仅在
 * 新增存档版本时另建下一份快照，不回写旧版本。
 */
const V10_STANDARD_SLOTS = [
  'weapon',
  'head',
  'body',
  'necklace',
  'bracelet',
  'ring',
  'belt',
  'shoes',
] as const;

const V10_STANDARD_REGION_QUALITIES = {
  r1: ['common', 'fine', 'rare'],
  r2: ['fine', 'rare', 'epic'],
  r3: ['rare', 'epic'],
  r4: ['rare', 'epic'],
} as const;

const v10StandardIds = Object.entries(V10_STANDARD_REGION_QUALITIES).flatMap(
  ([regionId, qualities]) =>
    V10_STANDARD_SLOTS.flatMap((slot) =>
      qualities.map((quality) => `eq_${regionId}_${slot}_${quality}`),
    ),
);

const V10_DUNGEON_THEMES = ['azure', 'violet', 'auric', 'crimson'] as const;
const V10_DUNGEON_PAIRED_SLOTS = [
  'head',
  'necklace',
  'bracelet',
  'ring',
  'belt',
  'shoes',
] as const;
const V10_CLASS_IDS = ['swordsman', 'witch', 'shaman', 'catkin'] as const;

const v10DungeonIds = V10_DUNGEON_THEMES.flatMap((theme) => [
  ...V10_DUNGEON_PAIRED_SLOTS.flatMap((slot) => [
    `eq_dungeon_${theme}_${slot}_1`,
    `eq_dungeon_${theme}_${slot}_2`,
  ]),
  ...V10_CLASS_IDS.flatMap((classId) => [
    `eq_dungeon_${theme}_body_${classId}`,
    `eq_dungeon_${theme}_weapon_${classId}`,
  ]),
]);

const V10_SHOP_THEMES = ['berry-cream', 'moon-sugar', 'rose-night'] as const;
const V10_SHOP_SHARED_SLOTS = [
  'head',
  'body',
  'necklace',
  'bracelet',
  'ring',
  'belt',
  'shoes',
] as const;

const v10ShopIds = [
  ...V10_SHOP_THEMES.flatMap((theme) => [
    ...V10_SHOP_SHARED_SLOTS.map((slot) => `eq_shop_${theme}_${slot}`),
    ...V10_CLASS_IDS.map((classId) => `eq_shop_${theme}_weapon_${classId}`),
  ]),
  'eq_shop_cardboard-cat_body_catkin',
  'eq_shop_cardboard-cat_weapon_catkin',
];

const V10_AFFECTION_EQUIPMENT_IDS = [
  'eq_affection_catkin_cloud-paw-dance-shoes',
  'eq_affection_catkin_flutter-bell-star-claws',
  'eq_affection_catkin_heart-rainbow-honey-claws',
  'eq_affection_catkin_heart-sound-bell-necklace',
  'eq_affection_catkin_heartbeat-cat-ear-bow',
  'eq_affection_catkin_honey-bow-belt',
  'eq_affection_catkin_honey-cat-lolita-dress',
  'eq_affection_catkin_moonlit-cat-dance-dress',
  'eq_affection_catkin_partner-wish-ring',
  'eq_affection_catkin_paw-gummy-bracelet',
  'eq_affection_shaman_dream-tassel-belt',
  'eq_affection_shaman_heart-rainbow-prayer-bell',
  'eq_affection_shaman_homebound-butterfly-bracelet',
  'eq_affection_shaman_kindred-omamori-necklace',
  'eq_affection_shaman_moon-lantern-date-dress',
  'eq_affection_shaman_moonstep-embroidered-shoes',
  'eq_affection_shaman_spirit-butterfly-prayer-ceremonial-dress',
  'eq_affection_shaman_together-moon-lantern-fan',
  'eq_affection_shaman_together-prayer-ring',
  'eq_affection_shaman_wish-guardian-butterfly-crown',
  'eq_affection_swordsman_everlasting-vow-ring',
  'eq_affection_swordsman_guardian-heart-petal-necklace',
  'eq_affection_swordsman_heart-rainbow-vow-rapier',
  'eq_affection_swordsman_lightstep-dance-shoes',
  'eq_affection_swordsman_morning-oath-sakura-crown',
  'eq_affection_swordsman_morning-sakura-guardian-blade',
  'eq_affection_swordsman_sakura-oath-knight-dress',
  'eq_affection_swordsman_side-by-side-ribbon-bracelet',
  'eq_affection_swordsman_sunset-date-gala-dress',
  'eq_affection_swordsman_wish-rose-belt',
  'eq_affection_witch_confession-starveil-witch-hat',
  'eq_affection_witch_fluttering-moon-sugar-wand',
  'eq_affection_witch_galaxy-date-evening-dress',
  'eq_affection_witch_heart-rainbow-star-key-staff',
  'eq_affection_witch_heartbeat-starcore-necklace',
  'eq_affection_witch_moonlit-wish-ring',
  'eq_affection_witch_shooting-star-candy-dance-shoes',
  'eq_affection_witch_star-sugar-witch-lolita-dress',
  'eq_affection_witch_starbound-lace-bracelet',
  'eq_affection_witch_startrail-butterfly-waistbelt',
] as const;

const v10EquipmentDefinitionIds = [
  ...v10StandardIds,
  ...v10DungeonIds,
  ...v10ShopIds,
  ...V10_AFFECTION_EQUIPMENT_IDS,
];

export const V10_EQUIPMENT_DEFINITION_IDS: ReadonlySet<string> = new Set(
  v10EquipmentDefinitionIds,
);

if (V10_EQUIPMENT_DEFINITION_IDS.size !== v10EquipmentDefinitionIds.length) {
  throw new Error('[配置错误] v10 装备定义快照存在重复 ID');
}
