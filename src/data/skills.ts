/**
 * 技能玩法配置。
 *
 * 玩法效果与视觉资源分开维护：本文件只描述数值、条件和状态；
 * `skillVisuals.ts` 只描述图片、动作与演出时序。
 */

import type { ClassId, Skill, SkillEffect, SkillTarget } from '@/core/types';
import {
  SKILL_VISUALS,
  type SkillVisualDefinition,
  type SkillVisualKind,
} from './skillVisuals';

const SELF = { kind: 'self' } as const satisfies SkillTarget;
const PRIMARY = { kind: 'primary-enemy' } as const satisfies SkillTarget;
const EVENT_SOURCE = { kind: 'event-source' } as const satisfies SkillTarget;
const HIT_ENEMIES = { kind: 'hit-enemies' } as const satisfies SkillTarget;
const ALL_ENEMIES = { kind: 'enemies', count: 'all' } as const satisfies SkillTarget;

const damage = (
  target: SkillTarget,
  base: number,
  perLevel = 0.06,
  options: Omit<Extract<SkillEffect, { kind: 'damage' }>, 'kind' | 'target' | 'multiplier'> = {},
): Extract<SkillEffect, { kind: 'damage' }> => ({
  kind: 'damage',
  target,
  multiplier: { base, perLevel },
  ...options,
});

export const SWORDSMAN_SKILLS: readonly Skill[] = [
  {
    id: 'skill_swordsman_attack',
    name: '攻杀剑术',
    class: 'swordsman',
    type: 'active',
    element: 'none',
    unlockLevel: 4,
    cooldownSec: 4,
    priority: 10,
    effects: [damage(PRIMARY, 1.6)],
    icon: 'assets/icons/skills/swordsman-attack.png',
    desc: '冰蓝与樱粉剑光交错，利落斩向单个敌人。',
  },
  {
    id: 'skill_swordsman_halfmoon',
    name: '半月弯刀',
    class: 'swordsman',
    type: 'active',
    element: 'none',
    unlockLevel: 19,
    cooldownSec: 7,
    priority: 20,
    effects: [damage(ALL_ENEMIES, 1.3)],
    icon: 'assets/icons/skills/swordsman-halfmoon.png',
    desc: '月牙剑气横扫敌群，身后留下一串樱花光屑。',
  },
  {
    id: 'skill_swordsman_flame',
    name: '烈火剑法',
    class: 'swordsman',
    type: 'active',
    element: 'fire',
    unlockLevel: 35,
    cooldownSec: 8,
    priority: 30,
    effects: [
      damage(PRIMARY, 2.4, 0.06, { element: 'fire' }),
      {
        kind: 'trigger',
        event: 'on-hit',
        chance: 0.3,
        maxTriggers: 1,
        effects: [
          {
            kind: 'apply-status',
            target: PRIMARY,
            statusId: 'burn',
            stacks: 1,
            maxStacks: 1,
            durationSec: 5,
            refresh: 'duration',
          },
        ],
      },
    ],
    icon: 'assets/icons/skills/swordsman-flame.png',
    desc: '樱焰缠上剑锋，斩落时迸开灼热花火。',
  },
];

export const WITCH_SKILLS: readonly Skill[] = [
  {
    id: 'skill_witch_fireball',
    name: '火球术',
    class: 'witch',
    type: 'active',
    element: 'fire',
    unlockLevel: 1,
    cooldownSec: 3,
    priority: 10,
    effects: [damage(PRIMARY, 1.5, 0.06, { element: 'fire' })],
    icon: 'assets/icons/skills/witch-fireball.png',
    desc: '樱焰凝成花心火球，命中时迸开星屑。',
  },
  {
    id: 'skill_witch_fire_ring',
    name: '抗拒火环',
    class: 'witch',
    type: 'active',
    element: 'fire',
    unlockLevel: 13,
    cooldownSec: 8,
    priority: 20,
    effects: [
      damage(ALL_ENEMIES, 1.2, 0.06, { element: 'fire' }),
      {
        kind: 'control',
        target: ALL_ENEMIES,
        control: 'knockback',
        chance: 1,
        durationSec: 0.35,
        strengthRatio: 0.2,
      },
    ],
    icon: 'assets/icons/skills/witch-fire-ring.png',
    desc: '六瓣樱焰旋成火环，弹开身边的敌人。',
  },
  {
    id: 'skill_witch_hell_lightning',
    name: '地狱雷光',
    class: 'witch',
    type: 'active',
    element: 'thunder',
    unlockLevel: 29,
    cooldownSec: 9,
    priority: 30,
    effects: [damage(ALL_ENEMIES, 2.6, 0.06, { element: 'thunder' })],
    icon: 'assets/icons/skills/witch-lightning.png',
    desc: '星月雷光在敌群中央绽开，造成范围伤害。',
  },
];

export const SHAMAN_SKILLS: readonly Skill[] = [
  {
    id: 'skill_shaman_heal',
    name: '治愈术',
    class: 'shaman',
    type: 'active',
    element: 'none',
    unlockLevel: 1,
    cooldownSec: 10,
    priority: 10,
    effects: [
      {
        kind: 'heal',
        target: SELF,
        maxHpRatio: { base: 0.15 },
      },
    ],
    icon: 'assets/icons/skills/shaman-heal.png',
    desc: '水晶莲心绽开柔光，为少女回复元气。',
  },
  {
    id: 'skill_shaman_poison',
    name: '施毒术',
    class: 'shaman',
    type: 'active',
    element: 'none',
    unlockLevel: 10,
    cooldownSec: 6,
    priority: 20,
    effects: [
      {
        kind: 'periodic-damage',
        target: PRIMARY,
        totalMultiplier: { base: 6, perLevel: 0.6 },
        ticks: 10,
        durationSec: 10,
        maxStacks: 3,
      },
    ],
    icon: 'assets/icons/skills/shaman-poison.png',
    desc: '紫雾与荆棘缠住目标，持续侵蚀敌人的生命。',
  },
  {
    id: 'skill_shaman_skeleton',
    name: '召唤骷髅',
    class: 'shaman',
    type: 'active',
    element: 'none',
    unlockLevel: 20,
    cooldownSec: 30,
    priority: 30,
    effects: [{ kind: 'summon', summonId: 'summon_shaman_skeleton', durationSec: 60 }],
    icon: 'assets/icons/skills/shaman-skeleton.png',
    desc: '灵铃唤醒圆眼骷髅，替主人守在战场前方。',
  },
];

export const CATKIN_SKILLS: readonly Skill[] = [
  {
    id: 'skill_catkin_paw_combo',
    name: '肉球三连',
    class: 'catkin',
    type: 'active',
    element: 'none',
    unlockLevel: 1,
    cooldownSec: 3,
    priority: 20,
    effects: [damage(PRIMARY, 1.5, 0.06, { hitWeights: [1, 1, 1] })],
    icon: 'assets/icons/skills/catkin-paw-combo.png',
    desc: '左右爪接肉球重拍，三段总计造成 150% 伤害。',
  },
  {
    id: 'skill_catkin_keen_whiskers',
    name: '灵敏胡须',
    class: 'catkin',
    type: 'passive',
    element: 'none',
    unlockLevel: 4,
    effects: [
      {
        kind: 'modifier',
        target: SELF,
        modifier: {
          unit: 'percentage-points',
          stat: 'critRate',
          points: { base: 4, perLevel: 0.12, max: 10 },
        },
      },
    ],
    icon: 'assets/icons/skills/catkin-keen-whiskers.png',
    desc: '胡须捕捉细微破绽，暴击率提高 4 个百分点。',
  },
  {
    id: 'skill_catkin_light_pounce',
    name: '追光飞扑',
    class: 'catkin',
    type: 'active',
    element: 'thunder',
    unlockLevel: 9,
    cooldownSec: 5,
    priority: 40,
    effects: [damage(PRIMARY, 1.9, 0.06, { element: 'thunder' })],
    icon: 'assets/icons/skills/catkin-light-pounce.png',
    desc: '沿雷光扑向目标，造成 190% 雷系伤害。',
  },
  {
    id: 'skill_catkin_nimble_step',
    name: '轻盈猫步',
    class: 'catkin',
    type: 'passive',
    element: 'none',
    unlockLevel: 14,
    effects: [
      {
        kind: 'modifier',
        target: SELF,
        modifier: {
          unit: 'ratio',
          stat: 'spd',
          ratio: { base: 0.05, perLevel: 0.0015, max: 0.12 },
        },
      },
      {
        kind: 'modifier',
        target: SELF,
        modifier: {
          unit: 'percentage-points',
          stat: 'dodgeChance',
          points: { base: 6, perLevel: 0.15, max: 12 },
        },
      },
    ],
    icon: 'assets/icons/skills/catkin-nimble-step.png',
    desc: '攻速提高 5%，闪避率提高 6 个百分点。',
  },
  {
    id: 'skill_catkin_scratch_frenzy',
    name: '疯狂乱抓',
    class: 'catkin',
    type: 'active',
    element: 'none',
    unlockLevel: 19,
    cooldownSec: 7,
    priority: 60,
    effects: [damage(PRIMARY, 2.55, 0.06, { hitWeights: [1, 1, 1, 1, 1, 1] })],
    icon: 'assets/icons/skills/catkin-scratch-frenzy.png',
    desc: '六道爪痕疾速交错，六段总计造成 255% 伤害。',
  },
  {
    id: 'skill_catkin_bristle_counter',
    name: '炸毛反击',
    class: 'catkin',
    type: 'active',
    element: 'thunder',
    unlockLevel: 24,
    cooldownSec: 12,
    priority: 95,
    castWhen: { kind: 'self-hp-at-most', ratio: 0.65 },
    effects: [
      {
        kind: 'modifier',
        target: SELF,
        modifier: {
          unit: 'percentage-points',
          stat: 'dodgeChance',
          points: { base: 20 },
        },
        durationSec: 4,
      },
      {
        kind: 'trigger',
        event: 'on-dodge',
        durationSec: 4,
        maxTriggers: 1,
        effects: [damage(EVENT_SOURCE, 1.2, 0, { element: 'thunder' })],
      },
    ],
    icon: 'assets/icons/skills/catkin-bristle-counter.png',
    desc: '生命低于 65% 时炸毛，4 秒内闪避率 +20 点；首次闪避立刻雷爪反击。',
  },
  {
    id: 'skill_catkin_claw_mark',
    name: '猫爪印记',
    class: 'catkin',
    type: 'passive',
    element: 'none',
    unlockLevel: 30,
    effects: [
      {
        kind: 'trigger',
        event: 'after-skill-resolved',
        effects: [
          {
            kind: 'apply-status',
            target: HIT_ENEMIES,
            statusId: 'catkin_claw_mark',
            stacks: 1,
            maxStacks: 5,
            durationSec: 12,
            refresh: 'duration',
            modifiersPerStack: true,
            modifiers: [
              {
                unit: 'ratio',
                stat: 'damageTakenFromSource',
                ratio: { base: 0.02, perLevel: 0.0005, max: 0.035 },
              },
            ],
          },
        ],
      },
    ],
    icon: 'assets/icons/skills/catkin-claw-mark.png',
    desc: '每次直接伤害技能命中后叠 1 层，最多 5 层；每层使目标承受更多喵喵伤害。',
  },
  {
    id: 'skill_catkin_tail_sweep',
    name: '尾巴横扫',
    class: 'catkin',
    type: 'active',
    element: 'ice',
    unlockLevel: 35,
    cooldownSec: 8,
    priority: 50,
    effects: [
      damage(ALL_ENEMIES, 1.65, 0.06, { element: 'ice', hitWeights: [1, 1] }),
      {
        kind: 'control',
        target: ALL_ENEMIES,
        control: 'slow',
        chance: 1,
        durationSec: 3,
        strengthRatio: 0.2,
      },
    ],
    icon: 'assets/icons/skills/catkin-tail-sweep.png',
    desc: '大尾巴卷起冰风横扫全体，并使敌人减速 20%，持续 3 秒。',
  },
  {
    id: 'skill_catkin_box_ambush',
    name: '纸箱奇袭',
    class: 'catkin',
    type: 'active',
    element: 'none',
    unlockLevel: 42,
    cooldownSec: 10,
    priority: 85,
    castWhen: {
      kind: 'status-stacks-at-least',
      statusId: 'catkin_claw_mark',
      stacks: 3,
    },
    effects: [
      damage(PRIMARY, 2.9, 0.06, { defenseIgnoreRatio: 0.3 }),
      {
        kind: 'consume-status',
        target: PRIMARY,
        statusId: 'catkin_claw_mark',
        stacks: 3,
      },
    ],
    icon: 'assets/icons/skills/catkin-box-ambush.png',
    desc: '目标有 3 层印记时从纸箱突袭，无视 30% 防御并消耗 3 层。',
  },
  {
    id: 'skill_catkin_nine_life_spin',
    name: '九命回旋',
    class: 'catkin',
    type: 'active',
    element: 'ice',
    unlockLevel: 50,
    cooldownSec: 12,
    priority: 70,
    effects: [
      damage({ kind: 'enemies', count: 3 }, 3.1, 0.06, {
        element: 'ice',
        hitWeights: [1, 1, 1],
      }),
      {
        kind: 'modifier',
        target: SELF,
        modifier: {
          unit: 'percentage-points',
          stat: 'dodgeChance',
          points: { base: 15 },
        },
        durationSec: 2,
      },
    ],
    icon: 'assets/icons/skills/catkin-nine-life-spin.png',
    desc: '三重尾影回旋攻击最多 3 名敌人，并在 2 秒内提高 15 点闪避率。',
  },
  {
    id: 'skill_catkin_hunting_instinct',
    name: '狩猎本能',
    class: 'catkin',
    type: 'passive',
    element: 'none',
    unlockLevel: 58,
    effects: [
      {
        kind: 'conditional',
        when: { kind: 'monster-type', types: ['elite', 'boss'] },
        effects: [
          {
            kind: 'modifier',
            target: SELF,
            modifier: {
              unit: 'ratio',
              stat: 'damageDone',
              ratio: { base: 0.06, perLevel: 0.002, max: 0.15 },
            },
          },
        ],
      },
      {
        kind: 'conditional',
        when: { kind: 'target-hp-at-most', ratio: 0.3 },
        effects: [
          {
            kind: 'modifier',
            target: SELF,
            modifier: { unit: 'ratio', stat: 'damageDone', ratio: { base: 0.1 } },
          },
        ],
      },
    ],
    icon: 'assets/icons/skills/catkin-hunting-instinct.png',
    desc: '对精英与 BOSS 伤害提高 6%；目标低于 30% 生命时再提高 10%。',
  },
  {
    id: 'skill_catkin_moonshadow_step',
    name: '月影猫步',
    class: 'catkin',
    type: 'active',
    element: 'ice',
    unlockLevel: 66,
    cooldownSec: 15,
    priority: 80,
    effects: [
      damage(ALL_ENEMIES, 3.45, 0.06, {
        element: 'ice',
        hitWeights: [1, 1, 1, 1],
      }),
      { kind: 'avoid-next-hit', durationSec: 1.2, count: 1 },
    ],
    icon: 'assets/icons/skills/catkin-moonshadow-step.png',
    desc: '化作月影四连掠过全场，并在 1.2 秒内必定闪过下一次攻击。',
  },
  {
    id: 'skill_catkin_furball_storm',
    name: '毛球风暴',
    class: 'catkin',
    type: 'active',
    element: 'thunder',
    unlockLevel: 76,
    cooldownSec: 17,
    priority: 75,
    effects: [
      damage(ALL_ENEMIES, 4.1, 0.06, {
        element: 'thunder',
        hitWeights: [1, 1, 1, 1, 1, 1, 1, 1],
      }),
    ],
    icon: 'assets/icons/skills/catkin-furball-storm.png',
    desc: '八颗带电毛球围成风暴，八段总计造成 410% 雷系伤害。',
  },
  {
    id: 'skill_catkin_hundred_claw',
    name: '百爪樱岚',
    class: 'catkin',
    type: 'active',
    element: 'thunder',
    unlockLevel: 88,
    cooldownSec: 22,
    priority: 100,
    effects: [
      damage(ALL_ENEMIES, 5.2, 0.06, {
        element: 'thunder',
        hitWeights: Array<number>(12).fill(1),
        statusScaling: {
          statusId: 'catkin_claw_mark',
          damageRatioPerStack: 0.15,
          consume: 'all',
        },
      }),
    ],
    icon: 'assets/icons/skills/catkin-hundred-claw.png',
    desc: '十二道晶爪化作樱岚；先读取全部印记，每层再增伤 15%，结算后统一消耗。',
  },
];

export const KENSHI_SKILLS: readonly Skill[] = [
  {
    id: 'skill_kenshi_iai_draw',
    name: '拔刀斩',
    class: 'kenshi',
    type: 'active',
    element: 'none',
    unlockLevel: 1,
    cooldownSec: 3,
    priority: 10,
    effects: [damage(PRIMARY, 1.5)],
    icon: 'assets/icons/skills/kenshi-iai-draw.png',
    desc: '居合起手式，拔刀的瞬间斩出清亮剑气。',
  },
  {
    id: 'skill_kenshi_sword_heart',
    name: '剑心',
    class: 'kenshi',
    type: 'passive',
    element: 'none',
    unlockLevel: 4,
    effects: [
      {
        kind: 'modifier',
        target: SELF,
        modifier: {
          unit: 'percentage-points',
          stat: 'critRate',
          points: { base: 5, perLevel: 0.12, max: 10 },
        },
      },
    ],
    icon: 'assets/icons/skills/kenshi-sword-heart.png',
    desc: '心剑合一，暴击率提高 5 个百分点。',
  },
  {
    id: 'skill_kenshi_wind_thrust',
    name: '追风突刺',
    class: 'kenshi',
    type: 'active',
    element: 'thunder',
    unlockLevel: 9,
    cooldownSec: 5,
    priority: 25,
    effects: [damage(PRIMARY, 1.9, 0.06, { element: 'thunder' })],
    icon: 'assets/icons/skills/kenshi-wind-thrust.png',
    desc: '人随剑走，一道雷光刺穿单个敌人。',
  },
  {
    id: 'skill_kenshi_white_blade',
    name: '白刃步',
    class: 'kenshi',
    type: 'passive',
    element: 'none',
    unlockLevel: 14,
    effects: [
      {
        kind: 'modifier',
        target: SELF,
        modifier: {
          unit: 'ratio',
          stat: 'spd',
          ratio: { base: 0.04, perLevel: 0.0015, max: 0.1 },
        },
      },
      {
        kind: 'modifier',
        target: SELF,
        modifier: {
          unit: 'percentage-points',
          stat: 'dodgeChance',
          points: { base: 5, perLevel: 0.15, max: 10 },
        },
      },
    ],
    icon: 'assets/icons/skills/kenshi-white-blade.png',
    desc: '白刃出鞘的步法：攻速提高 4%，闪避率提高 5 个百分点。',
  },
  {
    id: 'skill_kenshi_sakura_blizzard',
    name: '樱吹雪',
    class: 'kenshi',
    type: 'active',
    element: 'ice',
    unlockLevel: 19,
    cooldownSec: 7,
    priority: 30,
    effects: [damage(ALL_ENEMIES, 1.35, 0.06, { element: 'ice', hitWeights: [1, 1, 1] })],
    icon: 'assets/icons/skills/kenshi-sakura-blizzard.png',
    desc: '樱色剑气化作漫天飞雪，三段扫过全体敌人。',
  },
  {
    id: 'skill_kenshi_armor_break',
    name: '破甲斩',
    class: 'kenshi',
    type: 'active',
    element: 'none',
    unlockLevel: 24,
    cooldownSec: 9,
    priority: 40,
    effects: [damage(PRIMARY, 1.8, 0.06, { defenseIgnoreRatio: 0.25 })],
    icon: 'assets/icons/skills/kenshi-armor-break.png',
    desc: '势大力沉的一斩，无视目标 25% 防御。',
  },
  {
    id: 'skill_kenshi_sword_intent',
    name: '剑意',
    class: 'kenshi',
    type: 'passive',
    element: 'none',
    unlockLevel: 30,
    effects: [
      {
        kind: 'trigger',
        event: 'after-skill-resolved',
        effects: [
          {
            kind: 'apply-status',
            target: SELF,
            statusId: 'kenshi_sword_intent',
            stacks: 1,
            maxStacks: 5,
            durationSec: 12,
            refresh: 'duration',
          },
        ],
      },
    ],
    icon: 'assets/icons/skills/kenshi-sword-intent.png',
    desc: '每次直接伤害技能施放后积攒 1 层剑意，最多 5 层，12 秒后消散。',
  },
  {
    id: 'skill_kenshi_iai_flash',
    name: '居合·一闪',
    class: 'kenshi',
    type: 'active',
    element: 'ice',
    unlockLevel: 35,
    cooldownSec: 8,
    priority: 60,
    castWhen: {
      kind: 'status-stacks-at-least',
      statusId: 'kenshi_sword_intent',
      stacks: 2,
    },
    effects: [
      damage(PRIMARY, 2.4, 0.06, { element: 'ice', defenseIgnoreRatio: 0.3 }),
      {
        kind: 'consume-status',
        target: SELF,
        statusId: 'kenshi_sword_intent',
        stacks: 2,
      },
    ],
    icon: 'assets/icons/skills/kenshi-iai-flash.png',
    desc: '剑意满 2 层时可拔刀一闪，无视 30% 防御并消耗 2 层剑意。',
  },
  {
    id: 'skill_kenshi_sword_storm',
    name: '剑气纵横',
    class: 'kenshi',
    type: 'active',
    element: 'none',
    unlockLevel: 42,
    cooldownSec: 9,
    priority: 50,
    effects: [
      damage(ALL_ENEMIES, 1.55),
      {
        kind: 'control',
        target: ALL_ENEMIES,
        control: 'slow',
        chance: 1,
        durationSec: 3,
        strengthRatio: 0.15,
      },
    ],
    icon: 'assets/icons/skills/kenshi-sword-storm.png',
    desc: '剑气横扫全场，并使全体敌人减速 15%、持续 3 秒。',
  },
  {
    id: 'skill_kenshi_swallow_return',
    name: '燕返',
    class: 'kenshi',
    type: 'active',
    element: 'none',
    unlockLevel: 50,
    cooldownSec: 12,
    priority: 70,
    effects: [
      damage(PRIMARY, 3.2),
      {
        kind: 'conditional',
        when: { kind: 'target-hp-at-most', ratio: 0.3 },
        effects: [
          {
            kind: 'modifier',
            target: SELF,
            modifier: { unit: 'ratio', stat: 'damageDone', ratio: { base: 0.5 } },
          },
        ],
      },
    ],
    icon: 'assets/icons/skills/kenshi-swallow-return.png',
    desc: '燕返之剑：目标生命低于 30% 时，本次伤害提高 50%。',
  },
  {
    id: 'skill_kenshi_no_self',
    name: '无我',
    class: 'kenshi',
    type: 'passive',
    element: 'none',
    unlockLevel: 58,
    effects: [
      {
        kind: 'conditional',
        when: { kind: 'target-hp-at-most', ratio: 0.4 },
        effects: [
          {
            kind: 'modifier',
            target: SELF,
            modifier: {
              unit: 'ratio',
              stat: 'damageDone',
              ratio: { base: 0.1, perLevel: 0.002, max: 0.15 },
            },
          },
        ],
      },
    ],
    icon: 'assets/icons/skills/kenshi-no-self.png',
    desc: '进入无我之境：对生命低于 40% 的目标伤害提高 10%。',
  },
  {
    id: 'skill_kenshi_ice_heart',
    name: '冰心斩',
    class: 'kenshi',
    type: 'active',
    element: 'ice',
    unlockLevel: 66,
    cooldownSec: 13,
    priority: 80,
    effects: [
      damage(ALL_ENEMIES, 2.9, 0.06, { element: 'ice', hitWeights: [1, 1] }),
      {
        kind: 'control',
        target: ALL_ENEMIES,
        control: 'freeze',
        chance: 1,
        durationSec: 1.5,
      },
    ],
    icon: 'assets/icons/skills/kenshi-ice-heart.png',
    desc: '冰心一剑两段横扫全体，并将敌人冰冻 1.5 秒。',
  },
  {
    id: 'skill_kenshi_sword_saint',
    name: '剑圣之心',
    class: 'kenshi',
    type: 'passive',
    element: 'none',
    unlockLevel: 76,
    effects: [
      {
        kind: 'modifier',
        target: SELF,
        modifier: { unit: 'percentage-points', stat: 'critDmg', points: { base: 15 } },
      },
    ],
    icon: 'assets/icons/skills/kenshi-sword-saint.png',
    desc: '剑圣之心：暴击伤害提高 15%。',
  },
  {
    id: 'skill_kenshi_thousand_sakura',
    name: '奥义·千樱居合',
    class: 'kenshi',
    type: 'active',
    element: 'ice',
    unlockLevel: 88,
    cooldownSec: 20,
    priority: 100,
    effects: [
      damage(ALL_ENEMIES, 4.8, 0.06, {
        element: 'ice',
        hitWeights: Array<number>(5).fill(1),
        statusScaling: {
          statusId: 'kenshi_sword_intent',
          damageRatioPerStack: 0.12,
          consume: 'all',
        },
      }),
    ],
    icon: 'assets/icons/skills/kenshi-thousand-sakura.png',
    desc: '千樱齐放的终极居合：先快照全部剑意，每层使总伤害提高 12%，结算后统一消耗。',
  },
];

const SKILLS_BY_CLASS: Readonly<Record<ClassId, readonly Skill[]>> = {
  swordsman: SWORDSMAN_SKILLS,
  witch: WITCH_SKILLS,
  shaman: SHAMAN_SKILLS,
  catkin: CATKIN_SKILLS,
  kenshi: KENSHI_SKILLS,
};

export const ALL_SKILLS: readonly Skill[] = Object.values(SKILLS_BY_CLASS).flat();

export function skillsFor(classId: ClassId): readonly Skill[] {
  return SKILLS_BY_CLASS[classId];
}

export function unlockedSkills(classId: ClassId, level: number): readonly Skill[] {
  return skillsFor(classId).filter((skill) => skill.unlockLevel <= level);
}

export function primaryDamageEffect(
  skill: Skill,
): Extract<SkillEffect, { kind: 'damage' }> | null {
  return (
    skill.effects.find(
      (effect): effect is Extract<SkillEffect, { kind: 'damage' }> => effect.kind === 'damage',
    ) ?? null
  );
}

export function skillDealsDamage(skill: Skill): boolean {
  return skill.effects.some(
    (effect) => effect.kind === 'damage' || effect.kind === 'periodic-damage',
  );
}

export type VisualSkill = Skill & Omit<SkillVisualDefinition, 'skillId'>;
export type ActiveVisualSkill = Extract<VisualSkill, { type: 'active' }>;
export type { SkillVisualKind };

function attachVisual(skill: Skill, visualDefinition: SkillVisualDefinition): VisualSkill {
  const { skillId: _skillId, ...visual } = visualDefinition;
  return { ...skill, ...visual };
}

const SKILL_BY_ID = new Map(ALL_SKILLS.map((skill) => [skill.id, skill]));
if (SKILL_BY_ID.size !== ALL_SKILLS.length) {
  throw new Error('[配置错误] 技能 id 必须全局唯一');
}

const VISUAL_SKILLS = Object.values(SKILL_VISUALS).map((visualDefinition) => {
  const skill = SKILL_BY_ID.get(visualDefinition.skillId);
  if (!skill) {
    throw new Error(`[配置错误] 视觉定义引用了不存在的技能：${visualDefinition.skillId}`);
  }
  return attachVisual(skill, visualDefinition);
});

/**
 * 视觉层是玩法技能的严格子集：没有专属大图的技能仍是合法玩法数据，
 * 但每一条已登记视觉都必须反向引用真实技能。
 */
const VISUAL_SKILLS_BY_CLASS: Readonly<Record<ClassId, readonly VisualSkill[]>> = {
  swordsman: VISUAL_SKILLS.filter((skill) => skill.class === 'swordsman'),
  witch: VISUAL_SKILLS.filter((skill) => skill.class === 'witch'),
  shaman: VISUAL_SKILLS.filter((skill) => skill.class === 'shaman'),
  catkin: VISUAL_SKILLS.filter((skill) => skill.class === 'catkin'),
  kenshi: VISUAL_SKILLS.filter((skill) => skill.class === 'kenshi'),
};

export const SWORDSMAN_VISUAL_SKILLS = VISUAL_SKILLS_BY_CLASS.swordsman;
export const WITCH_VISUAL_SKILLS = VISUAL_SKILLS_BY_CLASS.witch;
export const SHAMAN_VISUAL_SKILLS = VISUAL_SKILLS_BY_CLASS.shaman;
export const CATKIN_VISUAL_SKILLS = VISUAL_SKILLS_BY_CLASS.catkin;
export const KENSHI_VISUAL_SKILLS = VISUAL_SKILLS_BY_CLASS.kenshi;

export function visualSkillsFor(classId: ClassId): readonly VisualSkill[] {
  return VISUAL_SKILLS_BY_CLASS[classId];
}

export function unlockedVisualSkills(classId: ClassId, level: number): readonly VisualSkill[] {
  return visualSkillsFor(classId).filter((skill) => skill.unlockLevel <= level);
}

/**
 * 当前挂机节奏只负责“可信的攻击演出”。
 *
 * 治疗、召唤以及带释放条件的技能不能在缺少正式战斗状态时伪装成伤害；
 * 它们仍可在角色页逐项预览，等 M3-4 的真实技能调度统一接管。
 */
export function battleRhythmSkills(
  classId: ClassId,
  level: number,
): readonly ActiveVisualSkill[] {
  return unlockedVisualSkills(classId, level).filter(
    (skill): skill is ActiveVisualSkill =>
      skill.type === 'active' && skill.castWhen === undefined && skillDealsDamage(skill),
  );
}
