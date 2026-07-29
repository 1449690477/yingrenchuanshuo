import type {
  AffixKey,
  BoutiqueThemeId,
  ClassId,
  EquipmentDef,
  EquipSlot,
  FixedAffix,
} from '@/core/types';
import { BOUTIQUE_THEMES, boutiqueAppearanceId } from './boutique';

export interface AffectionEquipmentDefinition {
  definition: EquipmentDef;
  classId: ClassId;
  collectionIndex: number;
  unlockPoints: number;
  flavorText: string;
}

interface AffectionEquipmentSpec {
  classId: ClassId;
  slot: EquipSlot;
  name: string;
  slug: string;
  level: number;
  unlockPoints: number;
  appearanceTheme: BoutiqueThemeId;
  flavorText: string;
  memoryEffect: string;
}

const COLLECTION_LEVELS = [1, 5, 10, 15, 20, 25, 30, 35, 40, 45] as const;
const COLLECTION_UNLOCK_POINTS = [0, 40, 80, 160, 240, 360, 520, 700, 900, 1_100] as const;

const slotAffixKeys: Readonly<Record<EquipSlot, readonly AffixKey[]>> = {
  weapon: ['atk', 'critRate', 'critDmg', 'acc', 'spd', 'hp'],
  head: ['def', 'hp', 'acc', 'eva', 'critRate', 'critDmg'],
  body: ['def', 'hp', 'eva', 'acc', 'critRate', 'critDmg'],
  necklace: ['atk', 'critDmg', 'hp', 'critRate', 'acc', 'eva'],
  bracelet: ['atk', 'acc', 'def', 'critRate', 'hp', 'eva'],
  ring: ['atk', 'critRate', 'critDmg', 'acc', 'eva', 'hp'],
  belt: ['def', 'hp', 'eva', 'acc', 'critRate', 'critDmg'],
  shoes: ['eva', 'spd', 'def', 'hp', 'acc', 'critRate'],
};

const classSpecs = (
  classId: ClassId,
  baseTheme: BoutiqueThemeId,
  entries: readonly Omit<
    AffectionEquipmentSpec,
    'classId' | 'level' | 'unlockPoints' | 'appearanceTheme'
  >[],
): AffectionEquipmentSpec[] =>
  entries.map((entry, index) => ({
    ...entry,
    classId,
    level: COLLECTION_LEVELS[index]!,
    unlockPoints: COLLECTION_UNLOCK_POINTS[index]!,
    appearanceTheme: index >= 8 ? 'rose-night' : baseTheme,
  }));

const SPECS: readonly AffectionEquipmentSpec[] = [
  ...classSpecs('swordsman', 'berry-cream', [
    {
      slot: 'head',
      name: '晨誓樱冠',
      slug: 'morning-oath-sakura-crown',
      flavorText: '晨练开始前，她亲手替你别好的第一瓣樱花。',
      memoryEffect: '晨誓回忆：待机时浮现晨光樱瓣。',
    },
    {
      slot: 'necklace',
      name: '守心樱瓣项链',
      slug: 'guardian-heart-petal-necklace',
      flavorText: '花瓣合拢时，正好护住一颗澄澈的蓝色心石。',
      memoryEffect: '守心回忆：受击时闪过樱瓣护光。',
    },
    {
      slot: 'bracelet',
      name: '并肩丝带腕饰',
      slug: 'side-by-side-ribbon-bracelet',
      flavorText: '两条不同颜色的丝带，被她认真编成同一个结。',
      memoryEffect: '并肩回忆：互动时亮起双色誓约丝带。',
    },
    {
      slot: 'ring',
      name: '不凋誓约戒',
      slug: 'everlasting-vow-ring',
      flavorText: '不是终点的承诺，而是每次出发都会回来的约定。',
      memoryEffect: '誓约回忆：暴击瞬间绽开微型樱环。',
    },
    {
      slot: 'belt',
      name: '心愿蔷薇腰封',
      slug: 'wish-rose-belt',
      flavorText: '她把没有说出口的愿望藏进了蔷薇扣背面。',
      memoryEffect: '心愿回忆：移动时留下蔷薇金线。',
    },
    {
      slot: 'shoes',
      name: '逐光舞步礼鞋',
      slug: 'lightstep-dance-shoes',
      flavorText: '适合训练，也适合把胜利后的第一支舞留给重要的人。',
      memoryEffect: '逐光回忆：闪避时踏出一圈晨光。',
    },
    {
      slot: 'body',
      name: '樱誓骑士姬礼裙',
      slug: 'sakura-oath-knight-dress',
      flavorText: '礼裙的每一道金线，都延续着她守护而不束缚的信念。',
      memoryEffect: '樱誓回忆：角色展示切换为樱色骑士礼装。',
    },
    {
      slot: 'weapon',
      name: '心虹誓约花剑',
      slug: 'heart-rainbow-vow-rapier',
      flavorText: '剑尖不指向同行者，只会为共同的道路划开阴霾。',
      memoryEffect: '心虹回忆：攻击拖出虹色樱花剑弧。',
    },
    {
      slot: 'body',
      name: '晚霞约会华礼服',
      slug: 'sunset-date-gala-dress',
      flavorText: '她说只是胜利宴会，却提前问了三次你会不会赴约。',
      memoryEffect: '晚霞回忆：角色展示切换为暮色约会礼服。',
    },
    {
      slot: 'weapon',
      name: '晨樱守护长刃',
      slug: 'morning-sakura-guardian-blade',
      flavorText: '两个人一起握住的愿望，比任何长刃都更坚定。',
      memoryEffect: '守护回忆：重击展开晨樱虹光。',
    },
  ]),
  ...classSpecs('witch', 'moon-sugar', [
    {
      slot: 'head',
      name: '告白星纱魔女帽',
      slug: 'confession-starveil-witch-hat',
      flavorText: '帽檐会替她遮住泛红的耳尖，却遮不住偷偷靠近的星光。',
      memoryEffect: '星纱回忆：待机时落下糖晶星屑。',
    },
    {
      slot: 'necklace',
      name: '怦然星核项链',
      slug: 'heartbeat-starcore-necklace',
      flavorText: '两颗心跳接近时，星核的光会比平时快一拍。',
      memoryEffect: '星核回忆：受击时展开柔和星盾。',
    },
    {
      slot: 'bracelet',
      name: '牵星蕾丝手环',
      slug: 'starbound-lace-bracelet',
      flavorText: '她坚持这只是导航魔法，丝带却总会指向你的位置。',
      memoryEffect: '牵星回忆：互动时浮现相连星轨。',
    },
    {
      slot: 'ring',
      name: '月下心愿戒',
      slug: 'moonlit-wish-ring',
      flavorText: '月光照进晶石后，会映出佩戴者最想再次见到的人。',
      memoryEffect: '心愿回忆：暴击时闪过弯月心光。',
    },
    {
      slot: 'belt',
      name: '星轨蝴蝶腰封',
      slug: 'startrail-butterfly-waistbelt',
      flavorText: '星轨绕了一大圈，最后停在两个人并肩的位置。',
      memoryEffect: '星轨回忆：移动时留下蝶翼星线。',
    },
    {
      slot: 'shoes',
      name: '流星软糖舞鞋',
      slug: 'shooting-star-candy-dance-shoes',
      flavorText: '每一步都像踩碎一颗软糖流星，甜得让人舍不得走快。',
      memoryEffect: '流星回忆：闪避时迸开糖晶星点。',
    },
    {
      slot: 'body',
      name: '星糖魔女洛丽塔裙',
      slug: 'star-sugar-witch-lolita-dress',
      flavorText: '她把最成功的甜点配方，缝进了只为这次约会准备的裙摆。',
      memoryEffect: '星糖回忆：角色展示切换为星糖魔女礼装。',
    },
    {
      slot: 'weapon',
      name: '心虹星匙法杖',
      slug: 'heart-rainbow-star-key-staff',
      flavorText: '据说能打开所有门，她却只想用它打开两个人的秘密基地。',
      memoryEffect: '心虹回忆：施法生成钥匙形虹色星阵。',
    },
    {
      slot: 'body',
      name: '银河约会夜礼裙',
      slug: 'galaxy-date-evening-dress',
      flavorText: '裙摆收进了整片银河，也给你留了身边的一小块位置。',
      memoryEffect: '银河回忆：角色展示切换为月夜星河礼服。',
    },
    {
      slot: 'weapon',
      name: '怦然月糖魔杖',
      slug: 'fluttering-moon-sugar-wand',
      flavorText: '每念错一次咒语，就会诚实地冒出一颗心形月糖。',
      memoryEffect: '怦然回忆：技能命中绽开月糖心虹。',
    },
  ]),
  ...classSpecs('shaman', 'moon-sugar', [
    {
      slot: 'head',
      name: '守愿灵蝶花冠',
      slug: 'wish-guardian-butterfly-crown',
      flavorText: '灵蝶只停在愿意认真倾听彼此心愿的人身边。',
      memoryEffect: '守愿回忆：待机时灵蝶绕冠一周。',
    },
    {
      slot: 'necklace',
      name: '同心御守项链',
      slug: 'kindred-omamori-necklace',
      flavorText: '没有写姓名的御守，却会在你靠近时发出温暖微光。',
      memoryEffect: '同心回忆：受击时浮现月银御守。',
    },
    {
      slot: 'bracelet',
      name: '归巢蝶翼手环',
      slug: 'homebound-butterfly-bracelet',
      flavorText: '无论灵蝶飞得多远，最后都会回到熟悉的手腕旁。',
      memoryEffect: '归巢回忆：互动后灵蝶回旋停驻。',
    },
    {
      slot: 'ring',
      name: '相守祈愿戒',
      slug: 'together-prayer-ring',
      flavorText: '双股月银交叠，却都保留着各自清晰的纹路。',
      memoryEffect: '相守回忆：暴击时点亮双生月环。',
    },
    {
      slot: 'belt',
      name: '安梦流苏腰封',
      slug: 'dream-tassel-belt',
      flavorText: '铃声很轻，刚好能让噩梦停下，又不会惊醒身边的人。',
      memoryEffect: '安梦回忆：移动时飘落蓝紫灵火。',
    },
    {
      slot: 'shoes',
      name: '踏月灵绣鞋',
      slug: 'moonstep-embroidered-shoes',
      flavorText: '鞋底绣着一轮弯月，陪她把漫长夜路走得很短。',
      memoryEffect: '踏月回忆：闪避时留下月光足迹。',
    },
    {
      slot: 'body',
      name: '灵蝶祈愿华礼服',
      slug: 'spirit-butterfly-prayer-ceremonial-dress',
      flavorText: '不是献给神明的礼服，而是她为珍惜当下亲自做出的选择。',
      memoryEffect: '祈愿回忆：角色展示切换为灵蝶祈愿礼服。',
    },
    {
      slot: 'weapon',
      name: '心虹祈愿灵铃',
      slug: 'heart-rainbow-prayer-bell',
      flavorText: '铃声越过风与雨，只把最真诚的那一句送到你耳边。',
      memoryEffect: '心虹回忆：施法荡开心形虹色铃波。',
    },
    {
      slot: 'body',
      name: '月灯相守约会裙',
      slug: 'moon-lantern-date-dress',
      flavorText: '两盏月灯互相照亮，正如同行的人不必谁依附于谁。',
      memoryEffect: '月灯回忆：角色展示切换为月灯约会礼裙。',
    },
    {
      slot: 'weapon',
      name: '相守月灯法扇',
      slug: 'together-moon-lantern-fan',
      flavorText: '扇面两盏灯始终等距，展开时却能照亮同一条路。',
      memoryEffect: '相守回忆：技能展开月灯蝶翼虹阵。',
    },
  ]),
  ...classSpecs('catkin', 'berry-cream', [
    {
      slot: 'head',
      name: '心跳猫耳蝴蝶结',
      slug: 'heartbeat-cat-ear-bow',
      flavorText: '她自己挑的搭档徽记，戴好后还装作只是顺手。',
      memoryEffect: '心跳回忆：待机时蝴蝶结泛起心虹。',
    },
    {
      slot: 'necklace',
      name: '心音铃铛颈链',
      slug: 'heart-sound-bell-necklace',
      flavorText: '铃铛从不催促谁靠近，只在并肩奔跑时快乐地响起。',
      memoryEffect: '心音回忆：受击时响起短促守护铃。',
    },
    {
      slot: 'bracelet',
      name: '肉球软糖手环',
      slug: 'paw-gummy-bracelet',
      flavorText: '她分你一颗最喜欢的软糖，又立刻强调这只是搭档福利。',
      memoryEffect: '软糖回忆：互动时跳出粉色肉球星。',
    },
    {
      slot: 'ring',
      name: '搭档心愿戒',
      slug: 'partner-wish-ring',
      flavorText: '不是占有的记号，而是随时愿意一起出发的约定。',
      memoryEffect: '搭档回忆：暴击时闪过并肩心星。',
    },
    {
      slot: 'belt',
      name: '蜜糖大蝴蝶腰封',
      slug: 'honey-bow-belt',
      flavorText: '大蝴蝶结里藏着备用糖果，当然也有给你的那一份。',
      memoryEffect: '蜜糖回忆：移动时飘落焦糖色丝带。',
    },
    {
      slot: 'shoes',
      name: '云朵肉球舞鞋',
      slug: 'cloud-paw-dance-shoes',
      flavorText: '落地像云朵一样轻，适合冒险，也适合偷偷练习双人舞。',
      memoryEffect: '云朵回忆：闪避时踏出柔软肉球光印。',
    },
    {
      slot: 'body',
      name: '蜜糖猫耳洛丽塔裙',
      slug: 'honey-cat-lolita-dress',
      flavorText: '可爱不是命令，而是她今天心情很好时主动做出的选择。',
      memoryEffect: '蜜糖回忆：角色展示切换为蜜糖猫耳礼装。',
    },
    {
      slot: 'weapon',
      name: '心虹蜜糖双爪',
      slug: 'heart-rainbow-honey-claws',
      flavorText: '爪刃负责开路，中心的心晶负责提醒她身后还有搭档。',
      memoryEffect: '心虹回忆：攻击交错出蜜糖虹色爪痕。',
    },
    {
      slot: 'body',
      name: '月下喵舞约会裙',
      slug: 'moonlit-cat-dance-dress',
      flavorText: '她把屋顶的月色裁进裙摆，只问你今晚要不要多坐一会儿。',
      memoryEffect: '月舞回忆：角色展示切换为月夜约会礼裙。',
    },
    {
      slot: 'weapon',
      name: '怦然铃星猫爪',
      slug: 'flutter-bell-star-claws',
      flavorText: '铃星会在双爪相碰时亮起，像两位搭档默契的击掌。',
      memoryEffect: '怦然回忆：技能命中迸开月铃心虹。',
    },
  ]),
] as const;

function affectionFixedAffixes(
  slot: EquipSlot,
  level: number,
  collectionIndex: number,
): FixedAffix[] {
  return slotAffixKeys[slot].map((key) => ({
    key,
    value: affectionAffixValue(key, level, collectionIndex),
  }));
}

function affectionAffixValue(key: AffixKey, level: number, collectionIndex: number): number {
  const levelScale = Math.pow(level, 1.3);
  const gradeScale = 0.9 + collectionIndex * 0.025;
  switch (key) {
    case 'atk':
      return Math.max(1, Math.round(0.7 * levelScale * gradeScale));
    case 'def':
      return Math.max(1, Math.round(0.55 * levelScale * gradeScale));
    case 'hp':
      return Math.max(1, Math.round(7.5 * levelScale * gradeScale));
    case 'acc':
      return Math.max(1, Math.round(0.95 * levelScale * gradeScale));
    case 'eva':
      return Math.max(1, Math.round(0.8 * levelScale * gradeScale));
    case 'critRate':
      return Math.round((2.8 + collectionIndex * 0.16) * 10) / 10;
    case 'critDmg':
      return Math.round((9 + collectionIndex * 0.7) * 10) / 10;
    case 'spd':
      return Math.round((0.04 + collectionIndex * 0.003) * 100) / 100;
    default:
      throw new Error(`[配置错误] 心虹固定词条不支持：${key}`);
  }
}

function buildDefinition(
  spec: AffectionEquipmentSpec,
  collectionIndex: number,
): AffectionEquipmentDefinition {
  const id = `eq_affection_${spec.classId}_${spec.slug}`;
  const appearanceId =
    spec.slot === 'weapon'
      ? boutiqueAppearanceId(spec.appearanceTheme, spec.slot, spec.classId)
      : boutiqueAppearanceId(spec.appearanceTheme, spec.slot);
  const commonDefinition = {
    id,
    name: spec.name,
    quality: 'prismatic' as const,
    level: spec.level,
    icon: `assets/equipment/affection/${spec.classId}/${spec.slug}.png`,
    appearanceId,
    classId: spec.classId,
    // 复用已经过完整角色叠层与战斗验收的精品主题特效。
    // 这样心虹装备的“互动与攻击换肤”是实际运行效果，不是只写在描述里的承诺。
    boutiqueTheme: spec.appearanceTheme,
    fixedAffixes: affectionFixedAffixes(spec.slot, spec.level, collectionIndex),
    fixedTemplate: true,
    /*
     * 心虹珍藏额外开两个可洗练槽。
     *
     * 六条固定词条是这件装备的身份，一条都不该被洗掉；
     * 但如果完全不能洗练，玩家在好感上的长期投入会随装备过时而作废 ——
     * 那正是《上瘾》里「投入」环节最忌讳的事（见 docs/40 红线）。
     *
     * 两个槽的取值：既让心虹装备能跟着洗练系统一起成长，
     * 又不至于喧宾夺主盖过定向副本产出的主力装备。
     */
    extraAffixSlots: 2,
    uniqueEffect: `心虹共鸣：激活「${BOUTIQUE_THEMES[spec.appearanceTheme].name}」角色外观、互动粒子与攻击换肤。`,
  };
  const definition: EquipmentDef =
    spec.slot === 'weapon'
      ? { ...commonDefinition, slot: spec.slot, element: 'none' }
      : { ...commonDefinition, slot: spec.slot };
  return {
    classId: spec.classId,
    collectionIndex,
    unlockPoints: spec.unlockPoints,
    flavorText: spec.flavorText,
    definition,
  };
}

export const AFFECTION_EQUIPMENT_LIST: readonly AffectionEquipmentDefinition[] = SPECS.map(
  (spec, index) => buildDefinition(spec, index % 10),
);

export const AFFECTION_EQUIPMENT: Readonly<Record<string, AffectionEquipmentDefinition>> =
  Object.fromEntries(AFFECTION_EQUIPMENT_LIST.map((entry) => [entry.definition.id, entry]));

export function affectionEquipmentForClass(
  classId: ClassId,
): readonly AffectionEquipmentDefinition[] {
  return AFFECTION_EQUIPMENT_LIST.filter((entry) => entry.classId === classId);
}

export function affectionEquipmentIdsForClass(classId: ClassId): readonly string[] {
  return affectionEquipmentForClass(classId).map((entry) => entry.definition.id);
}

export function eligibleAffectionEquipmentIds(
  classId: ClassId,
  affectionPoints: number,
  playerLevel: number,
): readonly string[] {
  if (!Number.isFinite(affectionPoints) || affectionPoints < 0) {
    throw new Error(`[好感装备] 好感点数必须是非负有限数，收到 ${affectionPoints}`);
  }
  if (!Number.isInteger(playerLevel) || playerLevel < 1) {
    throw new Error(`[好感装备] 玩家等级必须是正整数，收到 ${playerLevel}`);
  }
  return affectionEquipmentForClass(classId)
    .filter(
      (entry) => affectionPoints >= entry.unlockPoints && playerLevel >= entry.definition.level,
    )
    .map((entry) => entry.definition.id);
}

export function requireAffectionEquipment(id: string): AffectionEquipmentDefinition {
  const entry = AFFECTION_EQUIPMENT[id];
  if (!entry) throw new Error(`[配置错误] 心虹好感装备不存在：${id}`);
  return entry;
}
