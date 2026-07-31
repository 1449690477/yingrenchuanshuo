/**
 * 作弊证据的判定与分级（docs/78）。
 *
 * ## 这个模块只做一件事
 *
 * 服务端已经在各条上报路径上拒绝「物理上不可能」的提交了，但**拒完就扔**。
 * 本模块把那一刻的判据留成结构化证据，并回答唯一一个问题：
 * **这条证据够不够格公开点名？**
 *
 * ## 为什么判据只认「物理不可能」，不认「统计可疑」
 *
 * 公开点名一旦误伤，社会性后果不可撤回 —— 玩家不会记得我们后来撤了。
 * 所以采信的只有「该等级该职业物理可达上界」这类**数学上不可能**的量，
 * 「进度快 / 金币多 / 运气好 / 装备强」一律不采信：那些是肝帝、欧皇与氪佬的正常形态。
 * 这与 combatPowerBound 的职责边界是同一条：**拒绝物理上不可能，不拒绝比别人强得多。**
 *
 * ## 三道闸门（缺一不公开）
 *
 * 1. **铁证**：判据来自玩家实际结算那条链路的物理上界，不是统计阈值；
 * 2. **余量 ≥ PUBLISH_MIN_OVERAGE**：只超一点点的不公开 —— 见下方版本漂移那段；
 * 3. **重复或极端**：2 次以上独立铁证，或单次超 EXTREME_OVERAGE 倍。
 *
 * 与 core 其余模块同规：纯函数，不碰 Vue / Pinia / storage / DOM / 时钟。
 */

/** 证据来源路径。与 Edge Function 目录名一一对应，便于回溯是哪条链发现的。 */
export type CheatEvidenceSource =
  | 'sync-profile'
  | 'submit-trial'
  | 'submit-dungeon'
  | 'submit-progress'
  | 'submit-milestone';

/**
 * 被篡改的字段。
 *
 * 只列**有物理上界可依据**的字段 —— 没有上界就没有铁证，也就不该出现在这里。
 */
export type CheatClaimField =
  | 'combat_power'
  | 'trial_damage'
  | 'dungeon_duration'
  | 'equipment_affix'
  | 'equipment_level';

/** 字段的玩家可读名，封神榜与证据表共用，避免两处各写一套措辞。 */
export const CHEAT_FIELD_LABELS: Readonly<Record<CheatClaimField, string>> = {
  combat_power: '战力',
  trial_damage: '试炼伤害',
  dungeon_duration: '秘境用时',
  equipment_affix: '装备词条',
  equipment_level: '装备等级',
};

/**
 * 界限那一侧的说法。
 *
 * 「物理上限」对战力成立，对「装备等级 vs 角色等级」就不通顺 ——
 * 后者的界限是玩家自己的等级，不是什么物理常数。榜上的话必须读得通，
 * 否则玩家看不懂自己被指控了什么。
 */
const BOUND_LABELS: Readonly<Record<CheatClaimField, { upper: string; lower: string }>> = {
  combat_power: { upper: '物理上限', lower: '物理下限' },
  trial_damage: { upper: '物理上限', lower: '物理下限' },
  dungeon_duration: { upper: '物理上限', lower: '物理下限' },
  equipment_affix: { upper: '公式上限', lower: '公式下限' },
  equipment_level: { upper: '角色等级仅', lower: '角色等级' },
};

/**
 * ★ 该字段的判据是否「版本漂移免疫」—— 决定它能不能自动公开点名。
 *
 * ## 这条是本模块最重要的一个区分
 *
 * Edge Function 的核心是**打包快照**。新内容已发给客户端、而函数尚未重打包时，
 * 合法玩家会撞上一批**看起来像作弊的拒绝**：
 *   - 穿着新装备 → 服务端那份旧表里「装备定义不存在」
 *   - 新词条公式 → 「词条数值不符合生成公式」
 * **这两种拒绝在版本漂移下会由完全合法的玩家产生，且没有倍率可言**
 *   —— 倍率余量（PUBLISH_MIN_OVERAGE）对它们无效，因为它们不是数值越界，是结构不认识。
 *
 * 而下面这些判据的两个数**来自同一次提交内部**，跨版本恒成立：
 *   - 装备等级 > 角色等级：Lv5 穿 Lv100，任何版本都不可能
 *   - 战力 > 该等级物理上界：上界随内容自动扩展，且有 2 倍余量兜底
 *   - 秘境用时 < 两波怪物理最短：口径变动是小幅的，2 倍余量兜底
 *
 * **只有免疫的字段允许自动公开；其余一律只记录、进人工复核队列。**
 * 宁可漏掉一个作弊者，不可公开点名一个正常玩家。
 */
export const VERSION_SKEW_IMMUNE: Readonly<Record<CheatClaimField, boolean>> = {
  combat_power: true,
  trial_damage: true,
  dungeon_duration: true,
  equipment_level: true,
  // 词条是否「符合生成公式」依赖服务端那份公式快照，改公式即产生假阳性
  equipment_affix: false,
};

/**
 * 越界方向。
 *
 * 绝大多数作弊是「把数值改大」，但秘境用时是**越小越强**，
 * 伪造成绩会低于物理最短时间。两个方向的倍率算法不同，不能混为一谈。
 */
export type CheatBoundKind = 'upper' | 'lower';

export interface CheatEvidenceInput {
  source: CheatEvidenceSource;
  claimField: CheatClaimField;
  /** 玩家上报的值 */
  claimedValue: number;
  /** 该情形下的物理界限（上界或下界，由 boundKind 决定） */
  boundValue: number;
  boundKind: CheatBoundKind;
  /**
   * 此前已公开的同一玩家独立证据条数（不含本条）。
   * 由调用方从证据表查得 —— 本模块不碰 IO。
   */
  priorEvidenceCount: number;
}

export interface CheatEvidenceVerdict {
  /** 是否构成铁证（越界为真且倍率可计算）。false 时不应写入证据表。 */
  isProven: boolean;
  /** 超出界限的倍率；上界方向 = 报值/界限，下界方向 = 界限/报值。 */
  overageRatio: number;
  /** 四道闸门是否全开 —— 只有 true 才公开点名。 */
  shouldPublish: boolean;
  /** 未公开时的原因，写进证据表便于老板复核队列排序。 */
  holdReason:
    | 'none'
    | 'below-margin'
    | 'awaiting-second-evidence'
    | 'version-skew-sensitive';
}

/**
 * 公开点名所需的最小超额倍率。
 *
 * ## 这个 2 倍不是拍的，它挡的是一个真实存在的误判源
 *
 * Edge Function 的核心逻辑是**打包快照**：新装备已经发给客户端、而函数尚未
 * 重打包重部署时，穿着新装备的**合法玩家**会小幅超过服务端那份旧上界。
 * docs/72 反复强调 `edge:build` 纪律正是因为这条缝隙确实存在。
 *
 * 版本漂移造成的超额是 +10%~30% 量级（一档新装备的强度增量），
 * 而真作弊者填的是 999999999 —— 两者差几个数量级。
 * 取 2 倍：把版本漂移误判压到零，同时一个真作弊者都放不掉。
 */
export const PUBLISH_MIN_OVERAGE = 2;

/**
 * 单次即可公开的极端倍率。
 *
 * 超过物理上限 10 倍没有任何合法解释空间 —— 不需要等第二次。
 */
export const EXTREME_OVERAGE = 10;

/** 两条以上独立铁证即可公开（配合 PUBLISH_MIN_OVERAGE 一起生效）。 */
export const REPEAT_EVIDENCE_THRESHOLD = 2;

/**
 * 判定一条越界上报构成什么级别的证据。
 *
 * 调用方职责：只在**已经确认越界并因此拒绝了这次提交**之后调用它。
 * 本函数不重复判定业务合法性，只做分级 —— 判定逻辑必须留在各自的权威模块
 * （combatPowerBound / dungeonBoard / trial），避免同一口径两处实现。
 */
export function judgeCheatEvidence(input: CheatEvidenceInput): CheatEvidenceVerdict {
  const { claimedValue, boundValue, boundKind, priorEvidenceCount } = input;

  const notProven: CheatEvidenceVerdict = {
    isProven: false,
    overageRatio: 0,
    shouldPublish: false,
    holdReason: 'none',
  };

  // 非有限数、负数、零界限都无法构成「超出物理上界」的证明。
  // 这类输入本身可能只是客户端 bug 或旧版本，宁可不判。
  if (!Number.isFinite(claimedValue) || !Number.isFinite(boundValue)) return notProven;
  if (claimedValue < 0 || boundValue <= 0) return notProven;

  let overageRatio: number;
  if (boundKind === 'upper') {
    if (claimedValue <= boundValue) return notProven;
    overageRatio = claimedValue / boundValue;
  } else {
    // 下界方向（秘境用时越小越强）：报 0 或负数属于结构性伪造，
    // 直接给极端倍率 —— 除以零得不到有意义的比值，但它显然是伪造。
    if (claimedValue >= boundValue) return notProven;
    overageRatio = claimedValue <= 0 ? EXTREME_OVERAGE : boundValue / claimedValue;
  }

  // 闸门零：版本漂移敏感的判据一律不自动公开，只记录进人工复核队列。
  // 它排在最前面 —— 后面的倍率闸门对这类判据本来就不成立。
  if (!VERSION_SKEW_IMMUNE[input.claimField]) {
    return {
      isProven: true,
      overageRatio,
      shouldPublish: false,
      holdReason: 'version-skew-sensitive',
    };
  }
  if (overageRatio < PUBLISH_MIN_OVERAGE) {
    return { isProven: true, overageRatio, shouldPublish: false, holdReason: 'below-margin' };
  }
  if (overageRatio >= EXTREME_OVERAGE) {
    return { isProven: true, overageRatio, shouldPublish: true, holdReason: 'none' };
  }
  if (priorEvidenceCount + 1 >= REPEAT_EVIDENCE_THRESHOLD) {
    return { isProven: true, overageRatio, shouldPublish: true, holdReason: 'none' };
  }
  return {
    isProven: true,
    overageRatio,
    shouldPublish: false,
    holdReason: 'awaiting-second-evidence',
  };
}

/**
 * 封神榜条目的展示文案。
 *
 * 老板要求「让别人知道他改了什么、改了多少」，所以三段都要具体：
 * 改的字段、他报的值、物理界限。措辞在 core 统一生成，
 * 避免 UI 与证据表各写一套（docs/61 §2.2 同一口径两处实现的教训）。
 */
export function describeCheatEvidence(input: {
  claimField: CheatClaimField;
  claimedValue: number;
  boundValue: number;
  boundKind: CheatBoundKind;
  overageRatio: number;
}): string {
  const label = CHEAT_FIELD_LABELS[input.claimField];
  const boundLabel = BOUND_LABELS[input.claimField][input.boundKind];
  const claimed = formatNumber(input.claimedValue);
  const bound = formatNumber(input.boundValue);
  if (input.boundKind === 'lower') {
    return `${label} ${claimed}，${boundLabel} ${bound}`;
  }
  return `${label} ${claimed}，${boundLabel} ${bound} · 超 ${formatRatio(input.overageRatio)} 倍`;
}

/**
 * 证据表的一行（列名与 20260801030000_cheat_evidence.sql 一一对应）。
 *
 * 构造留在 core：五条上报路径共用同一套字段与措辞，
 * 各 Edge Function 只负责把它 insert 进去 —— 避免同一口径五处实现。
 */
export interface CheatEvidenceRow {
  user_id: string;
  source: CheatEvidenceSource;
  claim_field: CheatClaimField;
  claimed_value: number;
  bound_value: number;
  bound_kind: CheatBoundKind;
  overage_ratio: number;
  summary: string;
  bundle_version: string;
  published: boolean;
  hold_reason: CheatEvidenceVerdict['holdReason'];
}

/**
 * 由一次已判定的越界构造证据行。
 *
 * @param bundleVersion 服务端核心打包版本。日后若发现某版本的上界函数本身有错，
 *                      可按此列批量作废该批证据 —— 「我们自己判错了」时的唯一后悔药。
 */
export function buildCheatEvidenceRow(input: {
  userId: string;
  evidence: CheatEvidenceInput;
  verdict: CheatEvidenceVerdict;
  bundleVersion: string;
}): CheatEvidenceRow {
  const { userId, evidence, verdict, bundleVersion } = input;
  return {
    user_id: userId,
    source: evidence.source,
    claim_field: evidence.claimField,
    claimed_value: evidence.claimedValue,
    bound_value: evidence.boundValue,
    bound_kind: evidence.boundKind,
    overage_ratio: verdict.overageRatio,
    summary: describeCheatEvidence({
      claimField: evidence.claimField,
      claimedValue: evidence.claimedValue,
      boundValue: evidence.boundValue,
      boundKind: evidence.boundKind,
      overageRatio: verdict.overageRatio,
    }),
    bundle_version: bundleVersion,
    published: verdict.shouldPublish,
    hold_reason: verdict.holdReason,
  };
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return Math.round(value).toLocaleString('en-US');
}

function formatRatio(ratio: number): string {
  if (!Number.isFinite(ratio)) return '∞';
  if (ratio >= 100) return Math.round(ratio).toLocaleString('en-US');
  return ratio.toFixed(1);
}
