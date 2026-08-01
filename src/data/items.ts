/**
 * 物品定义：材料、消耗品、货币。
 * 装备不在这里，见 equipment.ts。
 */

import { REGION_34_MATERIALS } from './region34';
import { REGION_5_MATERIALS, type Region5MaterialSpec } from './region5';
import { REGION_6_MATERIALS, type Region6MaterialSpec } from './region6';
import { REGION_7_MATERIALS, type Region7MaterialSpec } from './region7';
import { EQUIPMENT_DUNGEON_TIERS } from './equipmentDungeonGear';
import { IMPRINT_CORE_ID, IMPRINT_CRYSTAL_IDS } from './imprintRules';

export type ItemKind = 'material' | 'consumable' | 'currency' | 'fragment';

export interface ItemDef {
  id: string;
  name: string;
  kind: ItemKind;
  /** 稀有度，仅用于 UI 配色，复用装备品质色 */
  tier: 'common' | 'fine' | 'rare' | 'epic' | 'legendary';
  desc: string;
  icon: string;
  /** 分解/出售获得的金币 */
  sellPrice: number;
  /** 可否被一键分解清理 */
  junk?: boolean;
}

function mat(
  id: string,
  name: string,
  tier: ItemDef['tier'],
  sellPrice: number,
  desc: string,
): ItemDef {
  return {
    id,
    name,
    kind: 'material',
    tier,
    desc,
    icon: `assets/items/${id}.png`,
    sellPrice,
  };
}

function regionSetItem(
  spec: Region5MaterialSpec | Region6MaterialSpec | Region7MaterialSpec,
): ItemDef {
  return {
    id: spec.id,
    name: spec.name,
    kind: spec.kind,
    tier: spec.tier,
    desc: spec.desc,
    icon: `assets/items/${spec.id}.png`,
    sellPrice: spec.sellPrice,
  };
}

export const ITEMS: Record<string, ItemDef> = {
  // ── 货币 ──
  gold: {
    id: 'gold',
    name: '金币',
    kind: 'currency',
    tier: 'common',
    desc: '通用货币，强化和购买都要用。',
    icon: 'assets/items/gold.png',
    sellPrice: 0,
  },

  // ── 强化材料（全程通用）──
  ...Object.fromEntries(
    [
      mat('stone_enhance', '强化石', 'common', 12, '强化装备的基础材料，到处都掉。'),
      mat('ore_black', '玄铁矿', 'rare', 180, '+10 以上强化必需，由中后期精英与 BOSS 产出。'),
      mat('lucky_nine', '幸运九', 'epic', 1200, '+13 以上强化必需，由最终关 BOSS 产出。'),
      mat(
        'charm_protect',
        '保护符',
        'epic',
        900,
        '冲击 +13 以上时防止装备碎裂，由最终关 BOSS 与首通奖励产出。',
      ),
      mat('stone_reforge', '洗练石', 'fine', 60, '重掷装备的随机词条。'),
      mat('sand_crystal', '凝晶砂', 'common', 14, '细密的结晶砂粒，能把已有的力量磨得更纯。'),
      mat('charm_bind', '定契符', 'fine', 90, '写着守约的符纸，能让一条词条在洗练中不动。'),
      mat(
        'sigil_swordsman',
        '剑姬徽记',
        'rare',
        420,
        '刻着樱与刃的徽章，唤出属于剑姬的力量。',
      ),
      mat(
        'sigil_witch',
        '魔女徽记',
        'rare',
        420,
        '刻着星与杖的徽章，唤出属于魔女的力量。',
      ),
      mat(
        'sigil_shaman',
        '灵巫徽记',
        'rare',
        420,
        '刻着铃与灵的徽章，唤出属于灵巫的力量。',
      ),
      mat(
        'sigil_catkin',
        '喵喵徽记',
        'rare',
        420,
        '刻着爪与铃铛的徽章，唤出属于喵喵的力量。',
      ),
      {
        ...mat(
          'sigil_kenshi',
          '樱酱徽记',
          'rare',
          420,
          '刻着樱与刀穗的徽章，唤出属于樱酱的居合剑意。',
        ),
        // P1 显式复用同为猫耳职业的正式徽记图；P2 再替换专属刀穗图标。
        icon: 'assets/items/sigil_catkin.png',
      },
      mat(
        'crystal_resonance',
        '同调结晶',
        'epic',
        1500,
        '与装备产生共鸣，能把一条词条直接推高一阶。',
      ),
    ].map((i) => [i.id, i]),
  ),

  // ── 区域 1：樱花初镇 ──
  ...Object.fromEntries(
    [
      mat('petal_sakura', '樱花瓣', 'common', 4, '飘落的樱花，闻起来甜甜的。'),
      mat('grass_soft', '柔软草叶', 'common', 3, '兔娘最爱啃的草。'),
      mat('bell_wood', '木铃', 'fine', 22, '林中木偶身上的小铃铛，会自己响。'),
      mat('core_barrier', '结界核心', 'rare', 140, '落樱结界的碎片，还带着暖意。'),
    ].map((i) => [i.id, i]),
  ),

  // ── 区域 2：迷糊草原 ──
  ...Object.fromEntries(
    [
      mat('jelly_cotton', '棉花糖凝胶', 'common', 6, '史莱姆掉的，据说能吃，没人敢试。'),
      mat('straw_sleepy', '打盹稻草', 'common', 5, '摸一下就想睡觉。'),
      mat('honey_bee', '蜂娘蜜', 'fine', 30, '蜜蜂娘辛苦攒的，甜到发晕。'),
      mat('crystal_altar', '祭坛结晶', 'rare', 200, '草原祭坛的能量结晶。'),
    ].map((i) => [i.id, i]),
  ),

  // ── 区域 3～4：虫娘洞窟 / 月下墓园 ──
  // 声明在 region34.ts，与区域、装备主题、怪物动作同源，避免同一批内容分散两处。
  ...Object.fromEntries(
    REGION_34_MATERIALS.map((spec) => [
      spec.id,
      mat(spec.id, spec.name, spec.tier, spec.sellPrice, spec.desc),
    ]),
  ),

  // ── 区域 5：熔岩神殿 ──
  // frag_crimson 是套装碎片，不属于 ChapterSpec.materials，必须保留 fragment 类型。
  ...Object.fromEntries(
    REGION_5_MATERIALS.map((spec) => [spec.id, regionSetItem(spec)]),
  ),

  // ── 区域 6：幽影祀塔 ──
  ...Object.fromEntries(
    REGION_6_MATERIALS.map((spec) => [spec.id, regionSetItem(spec)]),
  ),

  // ── 区域 7：血月峡谷 ──
  ...Object.fromEntries(
    REGION_7_MATERIALS.map((spec) => [spec.id, regionSetItem(spec)]),
  ),

  // ── 竞技场（docs/53 §二/§四）──
  honor_sigil: {
    id: 'honor_sigil',
    name: '荣誉印记',
    kind: 'currency',
    tier: 'epic',
    desc: '竞技场的荣耀铸成的印记，可在荣誉商店兑换圣痕装备。',
    icon: 'assets/items/honor_sigil.png',
    sellPrice: 0,
  },
  box_starlight: {
    id: 'box_starlight',
    name: '星辉匣',
    kind: 'consumable',
    tier: 'rare',
    desc: '竞技场每日结算的嘉奖，盛着星辉般的小惊喜。',
    icon: 'assets/items/box_starlight.png',
    sellPrice: 0,
  },
  box_sacred: {
    id: 'box_sacred',
    name: '圣痕匣',
    kind: 'consumable',
    tier: 'legendary',
    desc: '绯樱段位以上才有的重赏，装着通往圣痕套的碎片。',
    icon: 'assets/items/box_sacred.png',
    sellPrice: 0,
  },
  frag_stigma: {
    id: 'frag_stigma',
    name: '圣痕碎片',
    kind: 'fragment',
    tier: 'legendary',
    desc: '圣痕装备崩解后的碎片，40 枚可在荣誉商店任选一件圣痕装备。',
    icon: 'assets/items/frag_stigma.png',
    sellPrice: 0,
  },

  // ── 消耗品 ──
  potion_hp_s: {
    id: 'potion_hp_s',
    name: '小体力药',
    kind: 'consumable',
    tier: 'common',
    desc: '恢复 30 点体力。',
    icon: 'assets/items/potion_hp_s.png',
    sellPrice: 50,
  },
  exp_book_s: {
    id: 'exp_book_s',
    name: '初级经验书',
    kind: 'consumable',
    tier: 'fine',
    desc: '使用后立即获得一定经验。',
    icon: 'assets/items/exp_book_s.png',
    sellPrice: 120,
  },

  // ── 烙印材料（docs/58 §3.1）──
  //
  // id 不在这里手写，一律从 imprintRules.ts 的契约取：那份表同时被
  // core/equipmentImprint.ts 的成本计算与 store 的支付路径读取，
  // 手抄一份就会出现「同一口径两处实现」——今天已经因为这个吃过一次线上事故
  // （邻域榜 SQL 与客户端各写一套职业过滤，docs/61 §2.2）。
  //
  // 售价刻意压低（晶 30 / 核 150）：它们是烙印的唯一入口，
  // 卖钱不该成为有竞争力的出路，否则玩家会把养成材料当金币来源。
  ...Object.fromEntries(
    EQUIPMENT_DUNGEON_TIERS.map((tier) => {
      const id = IMPRINT_CRYSTAL_IDS[tier.id];
      // 名字与描述都从档位定义派生：套装名只有 EQUIPMENT_DUNGEON_TIERS 一处来源，
      // 改档位名时材料名自动跟上，不会出现材料名与套装名对不上的情况。
      //
      // 注意：docs/58 §3.1 里写的「苍蓝/绛紫/辉金/赤红烙印晶」是**占位名**，
      // 与实装的档位名（晴蓝茶会/月紫星宴/琥珀蔷薇王庭/绯樱典藏）对不上。
      // 以实装为准，别按文档把名字改回去。
      return [
        id,
        mat(
          id,
          `${tier.setName.slice(0, 2)}烙印晶`,
          'rare',
          30,
          `烙印「${tier.setName}」所需。由${tier.name}胜利产出。`,
        ),
      ];
    }),
  ),
  [IMPRINT_CORE_ID]: mat(
    IMPRINT_CORE_ID,
    '星纹核',
    'epic',
    150,
    '任意套装通用的烙印核心。各档副本稀有产出，并有保底 —— 运气差时靠它补上缺口。',
  ),
};

export function getItem(id: string): ItemDef | undefined {
  return ITEMS[id];
}

export function requireItem(id: string): ItemDef {
  const item = ITEMS[id];
  if (!item) throw new Error(`[配置错误] 物品不存在：${id}`);
  return item;
}

export function itemName(id: string): string {
  return requireItem(id).name;
}
