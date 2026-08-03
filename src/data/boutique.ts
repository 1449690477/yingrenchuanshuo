import type {
  AffixTier,
  BoutiqueThemeId,
  ClassId,
  EquipSlot,
  Quality,
  ShopOfferCategory,
} from '@/core/types';

export interface BoutiqueItemSpec {
  slot: EquipSlot;
  name: string;
  price: number;
  category: ShopOfferCategory;
  classId?: ClassId;
  /** 只有整身换装可声明 replacement；普通纸娃娃层保持默认 layer。 */
  renderMode?: 'layer' | 'replacement';
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
  attackEffects: Partial<Record<ClassId, string>>;
  /** 未填写时沿用品质默认固定词条；顶段限定装可声明真实固定 T 档。 */
  fixedAffixTier?: AffixTier;
  /** 未填写时沿用品质默认可洗槽数量。 */
  extraAffixSlots?: number;
  items: readonly BoutiqueItemSpec[];
}

export type BoutiqueShelfId = 'sakura' | 'ice-snow';

export interface BoutiqueShelf {
  id: BoutiqueShelfId;
  name: string;
  shortName: string;
  sceneAsset: string;
  sceneAlt: string;
  keeperName: string;
  headline: string;
  themeIds: readonly BoutiqueThemeId[];
  /**
   * 是否在商店里上架售卖。`false` = 下架：玩家买不到新的。
   *
   * ★ **下架撤销的是「售卖」，不是「存在」。** 货架条目、主题、以及由
   * `BOUTIQUE_THEME_LIST` 派生的**全部装备定义与外观都必须原样保留**。
   *
   * 原因：服务端不存玩家背包（购买与持有都在本地 IndexedDB），而
   * `core/trial.ts` 的 `getEquipment(defId)` 查不到定义就返回
   * `unknown-equipment`，调用方回 400。**一旦删掉定义，已经买过的玩家
   * 会在 sync-profile / submit-trial / arena / guild 全线被拒，且自己无法自救**
   * —— 等于把付过钱的玩家变成外挂嫌疑人。所以下架只能在这里摘牌。
   */
  listed?: boolean;
}

const weapons = (
  swordsman: Omit<BoutiqueItemSpec, 'slot' | 'category' | 'classId'>,
  witch: Omit<BoutiqueItemSpec, 'slot' | 'category' | 'classId'>,
  shaman: Omit<BoutiqueItemSpec, 'slot' | 'category' | 'classId'>,
  catkin: Omit<BoutiqueItemSpec, 'slot' | 'category' | 'classId'>,
  kenshi: Omit<BoutiqueItemSpec, 'slot' | 'category' | 'classId'>,
): BoutiqueItemSpec[] => [
  { ...swordsman, slot: 'weapon', category: 'weapon', classId: 'swordsman' },
  { ...witch, slot: 'weapon', category: 'weapon', classId: 'witch' },
  { ...shaman, slot: 'weapon', category: 'weapon', classId: 'shaman' },
  { ...catkin, slot: 'weapon', category: 'weapon', classId: 'catkin' },
  { ...kenshi, slot: 'weapon', category: 'weapon', classId: 'kenshi' },
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
      catkin: 'assets/effects/boutique/berry-cream-catkin.png',
      kenshi: 'assets/effects/boutique/berry-cream-kenshi.png',
    },
    items: [
      ...weapons(
        {
          name: '草莓奶霜伞剑',
          price: 1_350_000,
          uniqueEffect: '攻击换肤：心形糖晶斩弧与草莓星屑。',
        },
        {
          name: '草莓奶霜星匙杖',
          price: 1_350_000,
          uniqueEffect: '施法换肤：莓果星弹拖出奶油丝带。',
        },
        {
          name: '草莓奶霜茶铃',
          price: 1_350_000,
          uniqueEffect: '施法换肤：茶铃绽开粉白治愈波纹。',
        },
        {
          name: '草莓奶霜糖晶爪',
          price: 1_350_000,
          uniqueEffect: '攻击换肤：草莓心晶在双爪交错处迸开。',
        },
        {
          name: '草莓奶霜樱太刀',
          price: 1_350_000,
          uniqueEffect: '攻击换肤：粉白糖晶沿居合刀光轻快绽开。',
        },
      ),
      {
        slot: 'head',
        name: '蕾丝莓果软帽',
        price: 820_000,
        category: 'armor',
        uniqueEffect: '待机时帽檐偶尔落下一颗糖晶星。',
      },
      {
        slot: 'body',
        name: '草莓奶霜洛丽塔裙',
        price: 1_200_000,
        category: 'dress',
        uniqueEffect: '专属互动：奶油泡泡与害羞的下午茶转圈。',
      },
      {
        slot: 'necklace',
        name: '糖霜心锁',
        price: 900_000,
        category: 'accessory',
        uniqueEffect: '颈侧闪过柔粉心光，强化系列主光环。',
      },
      {
        slot: 'bracelet',
        name: '奶油蝴蝶手环',
        price: 800_000,
        category: 'accessory',
        uniqueEffect: '触摸角色时手边飞出奶油蝴蝶。',
      },
      {
        slot: 'ring',
        name: '莓晶茶戒',
        price: 950_000,
        category: 'accessory',
        uniqueEffect: '互动结束时凝成一颗莓红爱心。',
      },
      {
        slot: 'belt',
        name: '丝绒蛋糕腰封',
        price: 780_000,
        category: 'armor',
        uniqueEffect: '腰间丝带随攻击节奏轻轻扬起。',
      },
      {
        slot: 'shoes',
        name: '甜莓圆头鞋',
        price: 760_000,
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
      catkin: 'assets/effects/boutique/moon-sugar-catkin.png',
      kenshi: 'assets/effects/boutique/moon-sugar-kenshi.png',
    },
    items: [
      ...weapons(
        {
          name: '月桂星糖新月刃',
          price: 6_800_000,
          uniqueEffect: '攻击换肤：奶金新月剑弧连接星座线。',
        },
        {
          name: '月桂星糖月兔杖',
          price: 6_800_000,
          uniqueEffect: '施法换肤：月兔流星从新月法阵跃出。',
        },
        {
          name: '月桂星糖祷灯',
          price: 6_800_000,
          uniqueEffect: '施法换肤：祷灯灵火环绕成金色月相。',
        },
        {
          name: '月桂星糖月兔爪',
          price: 6_800_000,
          uniqueEffect: '攻击换肤：月兔新月沿蓝紫晶爪跃出。',
        },
        {
          name: '月桂星糖居合刀',
          price: 6_800_000,
          uniqueEffect: '攻击换肤：奶金月弧随归鞘声连成星座线。',
        },
      ),
      {
        slot: 'head',
        name: '月兔薄纱礼帽',
        price: 4_200_000,
        category: 'armor',
        uniqueEffect: '待机时月相在帽缘缓慢轮转。',
      },
      {
        slot: 'body',
        name: '月桂星糖洛丽塔裙',
        price: 6_000_000,
        category: 'dress',
        uniqueEffect: '专属互动：向月兔招手，星座线绕裙摆亮起。',
      },
      {
        slot: 'necklace',
        name: '星砂月相颈链',
        price: 4_600_000,
        category: 'accessory',
        uniqueEffect: '月相光点随角色呼吸明暗变化。',
      },
      {
        slot: 'bracelet',
        name: '月辉蕾丝袖扣',
        price: 4_000_000,
        category: 'accessory',
        uniqueEffect: '施法时双手留下短促星砂轨迹。',
      },
      {
        slot: 'ring',
        name: '新月祷愿戒',
        price: 5_200_000,
        category: 'accessory',
        uniqueEffect: '触摸戒指会召来一只短暂的月兔光影。',
      },
      {
        slot: 'belt',
        name: '夜蓝蝴蝶腰封',
        price: 3_800_000,
        category: 'armor',
        uniqueEffect: '夜蓝蝴蝶结泛起克制的奶金辉光。',
      },
      {
        slot: 'shoes',
        name: '月兔珍珠鞋',
        price: 3_600_000,
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
      catkin: 'assets/effects/boutique/rose-night-catkin.png',
      kenshi: 'assets/effects/boutique/rose-night-kenshi.png',
    },
    items: [
      ...weapons(
        {
          name: '绯樱星愿蔷薇剑',
          price: 22_000_000,
          uniqueEffect: '攻击换肤：蔷薇花瓣沿星河剑痕依次盛开。',
        },
        {
          name: '绯樱星愿天穹杖',
          price: 22_000_000,
          uniqueEffect: '施法换肤：天穹樱爆坠下赤金流星。',
        },
        {
          name: '绯樱星愿御灵扇',
          price: 22_000_000,
          uniqueEffect: '施法换肤：御灵蝶扇阵卷起绯樱星尘。',
        },
        {
          name: '绯樱星愿蔷薇爪',
          price: 22_000_000,
          uniqueEffect: '攻击换肤：赤金蔷薇在交错爪痕中央盛开。',
        },
        {
          name: '绯樱星愿名刀',
          price: 22_000_000,
          uniqueEffect: '攻击换肤：赤金樱瓣沿一线居合剑痕依次盛开。',
        },
      ),
      {
        slot: 'head',
        name: '星冠蔷薇礼帽',
        price: 14_000_000,
        category: 'armor',
        uniqueEffect: '待机时星冠点亮一圈克制的赤金星芒。',
      },
      {
        slot: 'body',
        name: '绯樱星愿洛丽塔礼裙',
        price: 20_000_000,
        category: 'dress',
        uniqueEffect: '专属互动：星愿提裙礼与由下而上的蔷薇绽放。',
      },
      {
        slot: 'necklace',
        name: '永绽樱心项链',
        price: 15_000_000,
        category: 'accessory',
        uniqueEffect: '胸前樱心随技能释放闪出一次星芒。',
      },
      {
        slot: 'bracelet',
        name: '星火蕾丝腕饰',
        price: 13_000_000,
        category: 'accessory',
        uniqueEffect: '挥手时留下绯红缎带与细碎星火。',
      },
      {
        slot: 'ring',
        name: '绯月誓约戒',
        price: 18_000_000,
        category: 'accessory',
        uniqueEffect: '触摸戒指触发一颗流星与专属回应。',
      },
      {
        slot: 'belt',
        name: '赤金蔷薇腰封',
        price: 12_000_000,
        category: 'armor',
        uniqueEffect: '腰间蔷薇在暴击演出时点亮赤金轮廓。',
      },
      {
        slot: 'shoes',
        name: '星愿水晶鞋',
        price: 11_000_000,
        category: 'armor',
        uniqueEffect: '脚步换肤：留下渐隐的蔷薇星爆。',
      },
    ],
  },
  'cardboard-cat': {
    id: 'cardboard-cat',
    name: '纸箱键帽摸鱼套',
    shortName: '宅猫',
    quality: 'epic',
    level: 14,
    unlockStageId: 'stage_2-2_6',
    rank: 1.5,
    tagline: '纸箱小包、键帽晶爪与“再摸五分钟”的猫系机动工装。',
    palette: ['#334f82', '#fff1d8', '#ff8fb5'],
    interactionName: '纸箱摸鱼时间',
    interactionLines: [
      '键盘先交给爪爪检查一下……没有小鱼干，差评！',
      '这个纸箱口袋刚好能装下今天的战利品。',
      '再摸五分钟就出发，猫猫说话算话……大概。',
    ],
    attackEffects: {
      catkin: 'assets/effects/boutique/cardboard-cat-catkin.png',
    },
    items: [
      {
        slot: 'body',
        name: '纸箱键帽机动工装',
        price: 2_600_000,
        category: 'dress',
        classId: 'catkin',
        renderMode: 'replacement',
        uniqueEffect: '整身换装：猫耳与蓝泪滴完全保留，纸箱小包随扑击动作一起摆动。',
      },
      {
        slot: 'weapon',
        name: '键帽疾打晶爪',
        price: 3_200_000,
        category: 'weapon',
        classId: 'catkin',
        uniqueEffect: '攻击换肤：六道蓝晶键帽爪痕交错，命中中心绽开粉色肉球。',
      },
    ],
  },
  'ice-snow': {
    id: 'ice-snow',
    name: '冰雪华年新春礼装',
    shortName: '冰雪',
    quality: 'legendary',
    level: 78,
    unlockStageId: 'stage_7-5_6',
    rank: 4,
    tagline: '象牙白礼裙、冰晶雪花、珍珠银穗与一抹新岁中国结。',
    palette: ['#f9fcff', '#bde8f8', '#ef91aa'],
    interactionName: '瑞雪迎春礼',
    interactionLines: [
      '第一片新雪落在掌心时，也把今年的好运分给你。',
      '银穗轻响三声，就算我们一起许过新年愿望啦。',
      '别担心裙摆沾雪，冰晶会把每一步都变成小星星。',
    ],
    attackEffects: {
      swordsman: 'assets/effects/boutique/ice-snow-swordsman.png',
      witch: 'assets/effects/boutique/ice-snow-witch.png',
      shaman: 'assets/effects/boutique/ice-snow-shaman.png',
      catkin: 'assets/effects/boutique/ice-snow-catkin.png',
      kenshi: 'assets/effects/boutique/ice-snow-kenshi.png',
    },
    // R7 终章的毕业珍品：传奇裸值跟随当前主线，强度来自真实 T5 固定词条与三条可洗槽。
    // 不提升到 divine，避免 15 / 5.8 = 2.59 倍的品质跳变摧毁现有 TTK。
    fixedAffixTier: 5,
    extraAffixSlots: 3,
    items: [
      ...weapons(
        {
          name: '冰雪华年·霁雪长剑',
          price: 210_000_000,
          uniqueEffect: '攻击换肤：霁蓝剑弧卷起六瓣雪晶与一线新春银光。',
        },
        {
          name: '冰雪华年·凝星法杖',
          price: 210_000_000,
          uniqueEffect: '施法换肤：冰晶星环沿杖尖扩散，珍珠光点柔和回旋。',
        },
        {
          name: '冰雪华年·玉铃灵扇',
          price: 210_000_000,
          uniqueEffect: '施法换肤：玉铃轻响，雪花灵纹与银穗波纹交叠绽放。',
        },
        {
          name: '冰雪华年·银绒双爪',
          price: 210_000_000,
          uniqueEffect: '攻击换肤：双爪交错留下猫耳雪晶与淡粉冰花爆点。',
        },
        {
          name: '冰雪华年·初霁太刀',
          price: 210_000_000,
          uniqueEffect: '攻击换肤：居合刀光凝成一线初霁冰河，末端落下新岁雪樱。',
        },
      ),
      {
        slot: 'head',
        name: '白绒岁华礼帽',
        price: 130_000_000,
        category: 'armor',
        uniqueEffect: '待机时帽檐雪晶轻亮，银穗随呼吸动作柔和摆动。',
      },
      {
        slot: 'body',
        name: '冰晶华年公主裙',
        price: 190_000_000,
        category: 'dress',
        uniqueEffect: '专属互动：象牙白裙摆旋开雪花、珍珠和一枚小小中国结。',
      },
      {
        slot: 'necklace',
        name: '雪魄珍珠项链',
        price: 140_000_000,
        category: 'accessory',
        uniqueEffect: '技能释放时胸前珍珠亮起一圈冰蓝呼吸光。',
      },
      {
        slot: 'bracelet',
        name: '银霜流苏腕饰',
        price: 120_000_000,
        category: 'accessory',
        uniqueEffect: '挥手时银霜流苏拖出克制的粉蓝星屑。',
      },
      {
        slot: 'ring',
        name: '新岁冰心誓戒',
        price: 160_000_000,
        category: 'accessory',
        uniqueEffect: '触摸戒指会点亮一枚冰心与短暂的新岁祝福光。',
      },
      {
        slot: 'belt',
        name: '瑞雪中国结腰封',
        price: 105_000_000,
        category: 'armor',
        uniqueEffect: '腰间小中国结在暴击演出时闪过一缕暖红银边。',
      },
      {
        slot: 'shoes',
        name: '踏雪珍珠短靴',
        price: 95_000_000,
        category: 'armor',
        uniqueEffect: '脚步换肤：留下两枚渐隐雪花与柔软珍珠光点。',
      },
    ],
  },
};

export const BOUTIQUE_THEME_LIST = Object.values(BOUTIQUE_THEMES);

export const BOUTIQUE_SHELVES: Readonly<Record<BoutiqueShelfId, BoutiqueShelf>> = {
  sakura: {
    id: 'sakura',
    name: '樱花珍品货架',
    shortName: '樱花馆',
    sceneAsset: 'assets/shops/sakura-boutique.webp',
    sceneAlt: '樱花珍品店内景，左右是华丽装备货架，中央展示洛丽塔裙装',
    keeperName: '店主 · 樱桃',
    headline: '欢迎试穿，喜欢再带走～',
    themeIds: ['berry-cream', 'moon-sugar', 'rose-night', 'cardboard-cat'],
  },
  'ice-snow': {
    id: 'ice-snow',
    name: '冰雪华年新春货架',
    shortName: '冰雪馆',
    sceneAsset: 'assets/shops/ice-snow-shelf.webp',
    sceneAlt: '冰雪华年新春货架，中央展示白色新春礼裙，周围陈列五职业冰晶武器',
    keeperName: '新春礼装 · 瑞雪',
    headline: '瑞雪迎春，五职业礼装都能完整试穿～',
    themeIds: ['ice-snow'],
    // 2026-08-03 复上架：v2 全新母版（docs/art/ice-snow-v2，SOURCE-MAPPING
    // 逐件可溯源）经忠实构建管线换代后重新上架；下架期只摘牌未删定义，
    // 老玩家持有不受影响（理由见 BoutiqueShelf.listed 的注释）。
  },
};

/** 商店实际展示的货架：已下架的不出现，但其装备定义与外观仍然存在。 */
export const BOUTIQUE_SHELF_LIST = Object.values(BOUTIQUE_SHELVES).filter(
  (shelf) => shelf.listed !== false,
);

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
