import type { ClassId } from '@/core/types';
import type { CharacterAction } from './characterAppearance';

/**
 * 受击性格。四个职业挨打时的反应不该是同一套位移 ——
 * 这是除了立绘之外，玩家能感知到「职业不一样」的最廉价也最有效的手段。
 */
export type ReactStyle =
  /** 剑姬：重心稳，扛得住，只有小幅后仰 */
  | 'brace'
  /** 魔女：布甲脆皮，被打得踉跄，后仰幅度最大 */
  | 'stagger'
  /** 灵巫：顺着力道飘开，位移大但姿态不乱 */
  | 'drift'
  /** 喵喵：猫的本能，直接向后弹跳拉开距离 */
  | 'hop';

export interface ClassBattleMotion {
  /**
   * 普攻不再永远重复同一个姿势。
   * 序列只改变表现，不参与攻速、伤害或挂机结算。
   */
  basicSequence: readonly [CharacterAction, CharacterAction, CharacterAction];
  /** 挨打时的反应风格，决定 CSS 用哪套受击位移 */
  reactStyle: ReactStyle;
  /** 受击姿势持续时长（毫秒）。越脆的职业硬直越久。 */
  reactMs: number;
  /** 通关后的胜利姿势时长（毫秒） */
  victoryMs: number;
}

export const CLASS_BATTLE_MOTIONS: Readonly<Record<ClassId, ClassBattleMotion>> = {
  swordsman: {
    basicSequence: ['attack', 'dash', 'spin'],
    reactStyle: 'brace',
    reactMs: 260,
    victoryMs: 1400,
  },
  witch: {
    basicSequence: ['cast', 'attack', 'spin'],
    reactStyle: 'stagger',
    reactMs: 380,
    victoryMs: 1600,
  },
  shaman: {
    basicSequence: ['cast', 'spin', 'attack'],
    reactStyle: 'drift',
    reactMs: 320,
    victoryMs: 1500,
  },
  catkin: {
    basicSequence: ['attack', 'dash', 'flurry'],
    reactStyle: 'hop',
    reactMs: 300,
    victoryMs: 1300,
  },
};

/**
 * 用拍子序号稳定轮换普攻姿势。
 *
 * 这里不能使用随机数：同一拍在 Vue 重挂或截图复核时必须得到同一个动作，
 * 也不能让纯表现消耗战斗 RNG。
 */
export function basicBattleAction(classId: ClassId, beatSeq: number): CharacterAction {
  if (!Number.isSafeInteger(beatSeq) || beatSeq <= 0) {
    throw new Error(`[战斗动作] 拍子序号必须是正整数：${beatSeq}`);
  }
  const sequence = CLASS_BATTLE_MOTIONS[classId].basicSequence;
  return sequence[(beatSeq - 1) % sequence.length]!;
}

export interface SequencedActionBeat {
  seq: number;
  sourceSeq: number;
}

/**
 * 多段技能的延迟命中可能晚于下一拍才插入数组。
 * 人物姿势必须认原始拍子序号，不能因为旧技能的最后一段晚到而倒退。
 */
export function latestSourceBeat<T extends SequencedActionBeat>(
  beats: readonly T[],
  highestSeenSourceSeq: number,
): T | null {
  if (!Number.isSafeInteger(highestSeenSourceSeq) || highestSeenSourceSeq < 0) {
    throw new Error(`[战斗动作] 已见拍子序号必须是非负整数：${highestSeenSourceSeq}`);
  }
  let latest: T | null = null;
  for (const beat of beats) {
    if (beat.sourceSeq !== highestSeenSourceSeq) continue;
    if (latest === null || beat.seq > latest.seq) {
      latest = beat;
    }
  }
  return latest;
}

// ─────────────────────── 打击反馈 ───────────────────────

/**
 * 打击强度分档。
 *
 * 为什么要分档而不是「有命中就震一下」：如果每一次普攻都顿帧加震屏，
 * 挂机十分钟玩家就晕了 —— 放置游戏是长时间挂着看的，
 * 反馈强度必须和事件的稀有度成正比，否则重要的事（暴击、大招）
 * 反而淹没在持续的噪音里。
 *
 * light    普攻命中 / 玩家挨打 —— 只有受击方抖一下，不碰镜头
 * heavy    技能命中 —— 轻顿帧 + 小幅震屏
 * critical 普攻暴击 —— 明显顿帧 + 震屏
 * ultimate 技能暴击 —— 全套拉满，这是玩家最想看到的一击
 */
export type ImpactTier = 'light' | 'heavy' | 'critical' | 'ultimate';

export interface ImpactFeedback {
  /**
   * 顿帧时长（毫秒）。命中瞬间把双方动画冻住这么久。
   *
   * 这是「打到了」最主要的来源，比震屏和特效都重要 ——
   * 格斗游戏几十年验证过的手法：短暂静止会让大脑把前后两帧
   * 读成一次真实的碰撞。0 表示不顿。
   */
  hitstopMs: number;
  /** 镜头震幅（像素）。0 表示完全不震镜头。 */
  shakePx: number;
  /** 镜头震动时长（毫秒） */
  shakeMs: number;
  /** 受击方闪白强度 0~1 */
  flashAlpha: number;
  /** 伤害飘字相对字号倍率 */
  damageScale: number;
}

export const IMPACT_FEEDBACK: Readonly<Record<ImpactTier, ImpactFeedback>> = {
  // 普攻每秒可能好几次，绝不能碰镜头
  light: { hitstopMs: 0, shakePx: 0, shakeMs: 0, flashAlpha: 0.35, damageScale: 1 },
  heavy: { hitstopMs: 60, shakePx: 3, shakeMs: 160, flashAlpha: 0.55, damageScale: 1.18 },
  critical: { hitstopMs: 90, shakePx: 5, shakeMs: 220, flashAlpha: 0.75, damageScale: 1.34 },
  ultimate: { hitstopMs: 130, shakePx: 8, shakeMs: 300, flashAlpha: 1, damageScale: 1.55 },
};

export interface ImpactSource {
  kind: BeatKindForImpact;
  crit: boolean;
}

/** 只取 BattleBeat 里与打击反馈有关的那部分，避免演出层反向依赖节奏模块 */
export type BeatKindForImpact = 'player-attack' | 'player-skill' | 'monster-attack';

/**
 * 判定一次命中该给多强的反馈。
 *
 * 玩家挨打**永远**算 light：怪物打玩家是挂机常态，
 * 给它顿帧震屏会让「被打」比「打人」还醒目，完全喧宾夺主。
 * 玩家挨打的反馈交给角色自己的受击动作去表达。
 */
export function impactTierFor(source: ImpactSource): ImpactTier {
  if (source.kind === 'monster-attack') return 'light';
  if (source.kind === 'player-skill') return source.crit ? 'ultimate' : 'heavy';
  return source.crit ? 'critical' : 'light';
}

export function requireImpactFeedback(tier: ImpactTier): ImpactFeedback {
  const feedback = IMPACT_FEEDBACK[tier];
  if (!feedback) {
    throw new Error(`[打击反馈] 未登记的强度档位：${String(tier)}`);
  }
  return feedback;
}

// ─────────────────────── 副本战报分段 ───────────────────────

export interface StagedHit {
  /** 这一下打出的伤害 */
  damage: number;
  /** 是否本波最后一击 —— 用于给收尾那下更强的反馈 */
  finisher: boolean;
}

/**
 * 把一波已经算好的总伤害，拆成几下依次打出的分段。
 *
 * ## 为什么需要它
 *
 * 装备副本的战斗结果是**在进入演出之前就全部结算完的**（见 core/equipmentDungeon）。
 * 原本的演出把整波伤害当成一次 clash 播出去：血条一跳到底，
 * 屏幕上只出现一个总伤害数字，看起来不像打了一架，像是结算表格。
 *
 * 这个函数只做一件事：把同一个总数**重新分配到几下**，让血条能一格一格掉。
 *
 * ## 铁律：不碰数值
 *
 * 返回的各段之和**严格等于**传入的总伤害，一分不多一分不少。
 * 它不接触 RNG、不影响掉落、不改变胜负 —— 纯粹是把同一个结果换个节奏播出来。
 * 所以它必须是确定性的：同一场战斗重播多少次，每一下都一模一样。
 *
 * 权重递增（后面的打得更重），收尾那下最重，这样节奏是渐强而不是平铺。
 */
export function stageWaveHits(totalDamage: number, hitCount: number): StagedHit[] {
  if (!Number.isFinite(totalDamage) || totalDamage < 0) {
    throw new Error(`[战报分段] 总伤害必须是非负有限数：${totalDamage}`);
  }
  if (!Number.isSafeInteger(hitCount) || hitCount <= 0) {
    throw new Error(`[战报分段] 分段数必须是正整数：${hitCount}`);
  }

  const total = Math.round(totalDamage);
  if (total <= 0) return [{ damage: 0, finisher: true }];

  // 伤害太小时不硬凑段数，否则会出现一串「-0」
  const segments = Math.max(1, Math.min(hitCount, total));

  // 递增权重：最后一下的权重最高，收尾才有分量
  const weights = Array.from({ length: segments }, (_, i) => 1 + i * 0.35);
  const weightSum = weights.reduce((sum, w) => sum + w, 0);

  const hits: StagedHit[] = [];
  let allocated = 0;
  for (let i = 0; i < segments - 1; i++) {
    // 每段至少 1 点，且要给后面的段留够
    const remainingSegments = segments - 1 - i;
    const ideal = Math.round((total * weights[i]!) / weightSum);
    const maxAllowed = total - allocated - remainingSegments;
    const damage = Math.max(1, Math.min(ideal, maxAllowed));
    hits.push({ damage, finisher: false });
    allocated += damage;
  }
  // 收尾那下吃掉全部余数 —— 这是「之和严格等于总伤害」的保证
  hits.push({ damage: total - allocated, finisher: true });

  return hits;
}

export type MonsterMotionProfile = 'flutter' | 'hopper' | 'bounce' | 'sway' | 'guard' | 'royal';

export type MonsterAction = 'idle' | 'attack' | 'hit' | 'defeat';

export interface MonsterActionState {
  defeated: boolean;
  attacking: boolean;
  hit: boolean;
}

export function monsterActionFor(state: MonsterActionState): MonsterAction {
  if (state.defeated) return 'defeat';
  if (state.attacking) return 'attack';
  if (state.hit) return 'hit';
  return 'idle';
}

export interface MonsterTargetVisualState {
  monsterId: string;
  pulseId: number;
}

export function shouldPlayMonsterSpawn(
  current: MonsterTargetVisualState,
  previous: MonsterTargetVisualState,
): boolean {
  const speciesChanged = current.monsterId !== previous.monsterId;
  const defeatedMonsterLeft = previous.pulseId > 0 && current.pulseId === 0;
  return current.pulseId === 0 && (speciesChanged || defeatedMonsterLeft);
}

export interface MonsterMotionTiming {
  attackMs: number;
  /** 攻击动作从蓄力进入命中的时点，供反馈层对齐玩家受击。 */
  impactMs: number;
  hitMs: number;
  defeatMs: number;
}

/**
 * 怪物动作时长集中登记，MonsterArtwork 只消费 CSS 变量。
 * 精英守卫与 BOSS 的动作更沉，普通飞行怪和跳跳怪更轻快。
 */
export const MONSTER_MOTION_TIMINGS: Readonly<Record<MonsterMotionProfile, MonsterMotionTiming>> = {
  flutter: { attackMs: 560, impactMs: 300, hitMs: 340, defeatMs: 540 },
  hopper: { attackMs: 520, impactMs: 270, hitMs: 320, defeatMs: 500 },
  bounce: { attackMs: 580, impactMs: 300, hitMs: 360, defeatMs: 560 },
  sway: { attackMs: 640, impactMs: 370, hitMs: 380, defeatMs: 620 },
  guard: { attackMs: 700, impactMs: 405, hitMs: 420, defeatMs: 680 },
  royal: { attackMs: 780, impactMs: 455, hitMs: 460, defeatMs: 720 },
};

export function requireMonsterMotionTiming(profile: MonsterMotionProfile): MonsterMotionTiming {
  const timing = MONSTER_MOTION_TIMINGS[profile];
  if (!timing) {
    throw new Error(`[怪物动作] 未登记动作节奏：${String(profile)}`);
  }
  return timing;
}
