/**
 * 物品定义：材料、消耗品、货币。
 * 装备不在这里，见 equipment.ts。
 */

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
