import type { BoutiqueThemeId, ClassId, EquipSlot, Quality, ShopOfferCategory } from '@/core/types';

export interface BoutiqueItemSpec {
  slot: EquipSlot;
  name: string;
  price: number;
  category: ShopOfferCategory;
  classId?: ClassId;
  uniqueEffect: string;
}

export interface BoutiqueTheme {
  id: BoutiqueThemeId;
  name: string;
  shortName: string;
  quality: Extract<Quality, 'epic' | 'legendary' | 'mythic'>;
  level: number;
  unlockStageId: string;
  rank: number;
  tagline: string;
  palette: readonly [string, string, string];
  interactionName: string;
  interactionLines: readonly string[];
  attackEffects: Record<ClassId, string>;
  items: readonly BoutiqueItemSpec[];
}

const weapons = (
  swordsman: Omit<BoutiqueItemSpec, 'slot' | 'category' | 'classId'>,
  witch: Omit<BoutiqueItemSpec, 'slot' | 'category' | 'classId'>,
  shaman: Omit<BoutiqueItemSpec, 'slot' | 'category' | 'classId'>,
): BoutiqueItemSpec[] => [
  { ...swordsman, slot: 'weapon', category: 'weapon', classId: 'swordsman' },
  { ...witch, slot: 'weapon', category: 'weapon', classId: 'witch' },
  { ...shaman, slot: 'weapon', category: 'weapon', classId: 'shaman' },
];

export const BOUTIQUE_THEMES: Readonly<Record<BoutiqueThemeId, BoutiqueTheme>> = {
  'berry-cream': {
    id: 'berry-cream',
    name: '草莓奶霜茶会',
    shortName: '莓霜',
    quality: 'epic',
    level: 12,
    unlockStageId: 'stage_2-1_6',
    rank: 1,
    tagline: '白粉蕾丝、莓果糖晶与下午茶的甜香。',
    palette: ['#ff7fad', '#fff1f7', '#ffe1a8'],
    interactionName: '奶霜下午茶',
    interactionLines: [
      '奶油泡泡不会弄脏裙摆，放心戳一下吧～',
      '要把第一颗草莓留给你吗？',
      '转一圈，糖霜星星都跟着亮起来啦！',
    ],
    attackEffects: {
      swordsman: 'assets/effects/boutique/berry-cream-swordsman.png',
      witch: 'assets/effects/boutique/berry-cream-witch.png',
      shaman: 'assets/effects/boutique/berry-cream-shaman.png',
    },
    items: [
      ...weapons(
        {
          name: '草莓奶霜伞剑',
          price: 450_000,
          uniqueEffect: '攻击换肤：心形糖晶斩弧与草莓星屑。',
        },
        {
          name: '草莓奶霜星匙杖',
          price: 450_000,
          uniqueEffect: '施法换肤：莓果星弹拖出奶油丝带。',
        },
        {
          name: '草莓奶霜茶铃',
          price: 450_000,
          uniqueEffect: '施法换肤：茶铃绽开粉白治愈波纹。',
        },
      ),
      {
        slot: 'head',
        name: '蕾丝莓果软帽',
        price: 270_000,
        category: 'armor',
        uniqueEffect: '待机时帽檐偶尔落下一颗糖晶星。',
      },
      {
        slot: 'body',
        name: '草莓奶霜洛丽塔裙',
        price: 400_000,
        category: 'dress',
        uniqueEffect: '专属互动：奶油泡泡与害羞的下午茶转圈。',
      },
      {
        slot: 'necklace',
        name: '糖霜心锁',
        price: 300_000,
        category: 'accessory',
        uniqueEffect: '颈侧闪过柔粉心光，强化系列主光环。',
      },
      {
        slot: 'bracelet',
        name: '奶油蝴蝶手环',
        price: 260_000,
        category: 'accessory',
        uniqueEffect: '触摸角色时手边飞出奶油蝴蝶。',
      },
      {
        slot: 'ring',
        name: '莓晶茶戒',
        price: 320_000,
        category: 'accessory',
        uniqueEffect: '互动结束时凝成一颗莓红爱心。',
      },
      {
        slot: 'belt',
        name: '丝绒蛋糕腰封',
        price: 260_000,
        category: 'armor',
        uniqueEffect: '腰间丝带随攻击节奏轻轻扬起。',
      },
      {
        slot: 'shoes',
        name: '甜莓圆头鞋',
        price: 250_000,
        category: 'armor',
        uniqueEffect: '脚步换肤：留下短暂草莓糖霜印。',
      },
    ],
  },
  'moon-sugar': {
    id: 'moon-sugar',
    name: '月桂星糖茶会',
    shortName: '月糖',
    quality: 'legendary',
    level: 16,
    unlockStageId: 'stage_2-3_6',
    rank: 2,
    tagline: '夜蓝薄纱、奶金月桂与会跳舞的月兔。',
    palette: ['#4d66a8', '#fff5d6', '#e7c470'],
    interactionName: '月兔祷愿',
    interactionLines: [
      '嘘，月兔刚刚从袖口探出头了。',
      '一起把愿望藏进这颗星糖里吧。',
      '挥挥手，星座线正在替我们写名字。',
    ],
    attackEffects: {
      swordsman: 'assets/effects/boutique/moon-sugar-swordsman.png',
      witch: 'assets/effects/boutique/moon-sugar-witch.png',
      shaman: 'assets/effects/boutique/moon-sugar-shaman.png',
    },
    items: [
      ...weapons(
        {
          name: '月桂星糖新月刃',
          price: 1_400_000,
          uniqueEffect: '攻击换肤：奶金新月剑弧连接星座线。',
        },
        {
          name: '月桂星糖月兔杖',
          price: 1_400_000,
          uniqueEffect: '施法换肤：月兔流星从新月法阵跃出。',
        },
        {
          name: '月桂星糖祷灯',
          price: 1_400_000,
          uniqueEffect: '施法换肤：祷灯灵火环绕成金色月相。',
        },
      ),
      {
        slot: 'head',
        name: '月兔薄纱礼帽',
        price: 880_000,
        category: 'armor',
        uniqueEffect: '待机时月相在帽缘缓慢轮转。',
      },
      {
        slot: 'body',
        name: '月桂星糖洛丽塔裙',
        price: 1_250_000,
        category: 'dress',
        uniqueEffect: '专属互动：向月兔招手，星座线绕裙摆亮起。',
      },
      {
        slot: 'necklace',
        name: '星砂月相颈链',
        price: 960_000,
        category: 'accessory',
        uniqueEffect: '月相光点随角色呼吸明暗变化。',
      },
      {
        slot: 'bracelet',
        name: '月辉蕾丝袖扣',
        price: 840_000,
        category: 'accessory',
        uniqueEffect: '施法时双手留下短促星砂轨迹。',
      },
      {
        slot: 'ring',
        name: '新月祷愿戒',
        price: 1_100_000,
        category: 'accessory',
        uniqueEffect: '触摸戒指会召来一只短暂的月兔光影。',
      },
      {
        slot: 'belt',
        name: '夜蓝蝴蝶腰封',
        price: 800_000,
        category: 'armor',
        uniqueEffect: '夜蓝蝴蝶结泛起克制的奶金辉光。',
      },
      {
        slot: 'shoes',
        name: '月兔珍珠鞋',
        price: 750_000,
        category: 'armor',
        uniqueEffect: '脚步换肤：留下新月与兔耳光斑。',
      },
    ],
  },
  'rose-night': {
    id: 'rose-night',
    name: '绯樱星愿夜宴',
    shortName: '绯夜',
    quality: 'mythic',
    level: 20,
    unlockStageId: 'stage_2-5_6',
    rank: 3,
    tagline: '绯红蔷薇、赤金星河与只为胜者点亮的夜宴。',
    palette: ['#a92f52', '#2d2446', '#f2c66d'],
    interactionName: '星愿提裙礼',
    interactionLines: [
      '今晚的第一颗流星，也想和你一起看。',
      '别眨眼，蔷薇会在提裙礼结束时盛开。',
      '这枚绯月誓约……只回应你的触碰。',
    ],
    attackEffects: {
      swordsman: 'assets/effects/boutique/rose-night-swordsman.png',
      witch: 'assets/effects/boutique/rose-night-witch.png',
      shaman: 'assets/effects/boutique/rose-night-shaman.png',
    },
    items: [
      ...weapons(
        {
          name: '绯樱星愿蔷薇剑',
          price: 3_500_000,
          uniqueEffect: '攻击换肤：蔷薇花瓣沿星河剑痕依次盛开。',
        },
        {
          name: '绯樱星愿天穹杖',
          price: 3_500_000,
          uniqueEffect: '施法换肤：天穹樱爆坠下赤金流星。',
        },
        {
          name: '绯樱星愿御灵扇',
          price: 3_500_000,
          uniqueEffect: '施法换肤：御灵蝶扇阵卷起绯樱星尘。',
        },
      ),
      {
        slot: 'head',
        name: '星冠蔷薇礼帽',
        price: 2_200_000,
        category: 'armor',
        uniqueEffect: '待机时星冠点亮一圈克制的赤金星芒。',
      },
      {
        slot: 'body',
        name: '绯樱星愿洛丽塔礼裙',
        price: 3_200_000,
        category: 'dress',
        uniqueEffect: '专属互动：星愿提裙礼与由下而上的蔷薇绽放。',
      },
      {
        slot: 'necklace',
        name: '永绽樱心项链',
        price: 2_400_000,
        category: 'accessory',
        uniqueEffect: '胸前樱心随技能释放闪出一次星芒。',
      },
      {
        slot: 'bracelet',
        name: '星火蕾丝腕饰',
        price: 2_100_000,
        category: 'accessory',
        uniqueEffect: '挥手时留下绯红缎带与细碎星火。',
      },
      {
        slot: 'ring',
        name: '绯月誓约戒',
        price: 2_900_000,
        category: 'accessory',
        uniqueEffect: '触摸戒指触发一颗流星与专属回应。',
      },
      {
        slot: 'belt',
        name: '赤金蔷薇腰封',
        price: 1_900_000,
        category: 'armor',
        uniqueEffect: '腰间蔷薇在暴击演出时点亮赤金轮廓。',
      },
      {
        slot: 'shoes',
        name: '星愿水晶鞋',
        price: 1_800_000,
        category: 'armor',
        uniqueEffect: '脚步换肤：留下渐隐的蔷薇星爆。',
      },
    ],
  },
};

export const BOUTIQUE_THEME_LIST = Object.values(BOUTIQUE_THEMES);

export function boutiqueEquipmentId(
  themeId: BoutiqueThemeId,
  slot: EquipSlot,
  classId?: ClassId,
): string {
  return `eq_shop_${themeId}_${slot}${classId ? `_${classId}` : ''}`;
}

export function boutiqueOfferId(
  themeId: BoutiqueThemeId,
  slot: EquipSlot,
  classId?: ClassId,
): string {
  return `offer_${themeId}_${slot}${classId ? `_${classId}` : ''}`;
}

export function boutiqueAppearanceId(
  themeId: BoutiqueThemeId,
  slot: EquipSlot,
  classId?: ClassId,
): string {
  return `boutique-${themeId}-${slot}${classId ? `-${classId}` : ''}`;
}
