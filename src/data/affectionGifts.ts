import type { AffectionMood } from '@/core/affection';
import type { ClassId } from '@/core/types';

export type AffectionGiftPreference = 'favorite' | 'liked' | 'regular';

export interface AffectionGiftDefinition {
  id: string;
  classId: ClassId;
  name: string;
  preference: AffectionGiftPreference;
  points: number;
  mood: AffectionMood;
  shortDescription: string;
  iconAsset: string;
  requiredStoryId: string;
  cost: {
    itemId: string;
    count: number;
  };
  responseLines: readonly [string, string];
}

const gift = (
  definition: Omit<AffectionGiftDefinition, 'iconAsset'>,
): AffectionGiftDefinition => ({
  ...definition,
  iconAsset: `assets/affection/gifts/${definition.id}.png`,
});

export const AFFECTION_GIFTS: Readonly<
  Record<ClassId, readonly AffectionGiftDefinition[]>
> = {
  swordsman: [
    gift({
      id: 'gift_swordsman_sakura_roast_tea',
      classId: 'swordsman',
      name: '双杯樱叶焙茶罐',
      preference: 'favorite',
      points: 18,
      mood: 'moved',
      shortDescription: '低糖樱叶焙茶与成对茶杯，记得她的口味，也留下你的座位。',
      requiredStoryId: 'aff_swordsman_06_homecoming',
      cost: { itemId: 'core_barrier', count: 1 },
      responseLines: [
        '原来你记得我不喜欢太甜……也记得茶要准备两只杯子。',
        '谢谢。第一杯由我来泡，你也坐下。',
      ],
    }),
    gift({
      id: 'gift_swordsman_guard_care_case',
      classId: 'swordsman',
      name: '樱纹护手养护匣',
      preference: 'liked',
      points: 14,
      mood: 'bright',
      shortDescription: '按她惯用规格配好的保养工具，没有擅自调整护具。',
      requiredStoryId: 'aff_swordsman_06_homecoming',
      cost: { itemId: 'bell_wood', count: 2 },
      responseLines: [
        '你先问过规格，连保养油也没有擅自替我选择。很合适。',
        '今晚可以一起整理；扣带最后仍由我自己确认。',
      ],
    }),
    gift({
      id: 'gift_swordsman_morning_training_cloth',
      classId: 'swordsman',
      name: '晨蓝练剑巾',
      preference: 'regular',
      points: 10,
      mood: 'calm',
      shortDescription: '轻便耐用的晨练用品，朴素但足够体贴。',
      requiredStoryId: 'aff_swordsman_06_homecoming',
      cost: { itemId: 'petal_sakura', count: 4 },
      responseLines: [
        '实用，而且颜色很安静。我会带去晨练。',
        '礼物收下；不过明早替我数剑的人还是不能迟到。',
      ],
    }),
  ],
  witch: [
    gift({
      id: 'gift_witch_deviant_star_ink',
      classId: 'witch',
      name: '偏航星晶墨',
      preference: 'favorite',
      points: 18,
      mood: 'playful',
      shortDescription: '会随观察角度变换星轨的安全魔法墨水。',
      requiredStoryId: 'aff_witch_06_constellation',
      cost: { itemId: 'crystal_altar', count: 1 },
      responseLines: [
        '它会随着观察角度偏航……你竟然找得到这种墨。',
        '先声明，是我喜欢，不是偏航星替我喜欢。',
      ],
    }),
    gift({
      id: 'gift_witch_blank_starmap_notebook',
      classId: 'witch',
      name: '无锁星图手札',
      preference: 'liked',
      points: 14,
      mood: 'moved',
      shortDescription: '没有预写答案、没有锁，也不催促她公开秘密的空白手札。',
      requiredStoryId: 'aff_witch_06_constellation',
      cost: { itemId: 'bell_wood', count: 2 },
      responseLines: [
        '空白页、不上锁、也不催我写答案。很懂规矩。',
        '我准备好时，会主动翻一页给你看。',
      ],
    }),
    gift({
      id: 'gift_witch_meteor_candy_jar',
      classId: 'witch',
      name: '流星软糖罐',
      preference: 'regular',
      points: 10,
      mood: 'bright',
      shortDescription: '不会爆炸、适合观星时分享的星形软糖。',
      requiredStoryId: 'aff_witch_06_constellation',
      cost: { itemId: 'jelly_cotton', count: 4 },
      responseLines: [
        '安全、甜、不会炸。今天难得收到一份正常礼物。',
        '分你一半，不代表实验权限打折。',
      ],
    }),
  ],
  shaman: [
    gift({
      id: 'gift_shaman_blank_wish_album',
      classId: 'shaman',
      name: '无字双页愿纸册',
      preference: 'favorite',
      points: 18,
      mood: 'moved',
      shortDescription: '不替她书写愿望，只把表达或沉默的选择留在纸上。',
      requiredStoryId: 'aff_shaman_06_firstsnow',
      cost: { itemId: 'core_barrier', count: 1 },
      responseLines: [
        '没有替我写下任何愿望，只把选择留在纸上。',
        '我很喜欢。第一张，也许只画两盏灯。',
      ],
    }),
    gift({
      id: 'gift_shaman_moonwhite_rest_tea',
      classId: 'shaman',
      name: '月白安神茶',
      preference: 'liked',
      points: 14,
      mood: 'shy',
      shortDescription: '气味清淡，不盖过风铃与药草香的休息茶。',
      requiredStoryId: 'aff_shaman_06_firstsnow',
      cost: { itemId: 'honey_bee', count: 2 },
      responseLines: [
        '香气很轻，不会盖过风铃。谢谢你记得安静也需要被照顾。',
        '请留下。第二杯，本来就该有人一起喝。',
      ],
    }),
    gift({
      id: 'gift_shaman_clear_lantern_cover',
      classId: 'shaman',
      name: '清月花灯罩',
      preference: 'regular',
      points: 10,
      mood: 'calm',
      shortDescription: '能挡风雨，却不会困住灯光的透明灯罩。',
      requiredStoryId: 'aff_shaman_06_firstsnow',
      cost: { itemId: 'bell_wood', count: 2 },
      responseLines: [
        '透明得恰好，能护住火，也不把光困住。',
        '我会用上它；下次巡夜，一起看看效果吧。',
      ],
    }),
  ],
  catkin: [
    gift({
      id: 'gift_catkin_modular_field_case',
      classId: 'catkin',
      name: '模块化远征收纳匣',
      preference: 'favorite',
      points: 18,
      mood: 'playful',
      shortDescription: '防水、可拆，空白标签由她决定最终分类。',
      requiredStoryId: 'aff_catkin_06_departure',
      cost: { itemId: 'core_barrier', count: 1 },
      responseLines: [
        '防水、可拆、编号牌还是空白的——专业！',
        '最重要的是，你把最终分类权留给我。偏爱验收通过。',
      ],
    }),
    gift({
      id: 'gift_catkin_dual_repair_lamp',
      classId: 'catkin',
      name: '双控便携维修灯',
      preference: 'liked',
      points: 14,
      mood: 'bright',
      shortDescription: '两边都能独立控制亮度的搭档维修设备。',
      requiredStoryId: 'aff_catkin_06_departure',
      cost: { itemId: 'bell_wood', count: 2 },
      responseLines: [
        '两档亮度、两边都能控制。搭档设备就该这样。',
        '今晚测试，你负责左路，我负责右路。',
      ],
    }),
    gift({
      id: 'gift_catkin_victory_candy_pack',
      classId: 'catkin',
      name: '胜利软糖补给包',
      preference: 'regular',
      points: 10,
      mood: 'shy',
      shortDescription: '口味可以自行选择的战后补给，不带宠物投喂语义。',
      requiredStoryId: 'aff_catkin_06_departure',
      cost: { itemId: 'jelly_cotton', count: 4 },
      responseLines: [
        '标准战后补给，口味也没擅自替我决定。',
        '收下。任务完成后，按搭档条例对半分。',
      ],
    }),
  ],
  kenshi: [],
};

export const AFFECTION_GIFT_LIST: readonly AffectionGiftDefinition[] =
  Object.values(AFFECTION_GIFTS).flat();

export function affectionGiftsForClass(
  classId: ClassId,
): readonly AffectionGiftDefinition[] {
  return AFFECTION_GIFTS[classId];
}

export function requireAffectionGift(
  classId: ClassId,
  giftId: string,
): AffectionGiftDefinition {
  const definition = AFFECTION_GIFTS[classId].find((entry) => entry.id === giftId);
  if (!definition) {
    throw new Error(`[配置错误] ${classId} 的好感礼物不存在：${giftId}`);
  }
  return definition;
}
