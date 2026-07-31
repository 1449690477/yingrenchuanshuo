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

/**
 * ★ 判据本身不可用的原因 —— **这是我方故障，不是对玩家的判断**。
 *
 * ## 为什么要把它和「证据不足」分开
 *
 * 判定入口拿到非有限数、负数报值或非正界限时，唯一正确的处置是**不判**：
 * 这类输入构不成「超出物理上界」的证明，硬判只会公示无辜的人。
 * 但「不判」这个动作，此前和「玩家是清白的」返回了完全一样的东西 ——
 * 两者都是 isProven=false，都不落库、不告警、无遥测。
 *
 * **于是恰恰在我方尺子算坏了的时候，用来发现这件事的仪器是瞎的。**
 * 真实教训：2026-07-31 排查一条被静默隐藏两天的合法成绩时发现，
 * 「被判定为不可信」与「压根没被判过」在库里长得一模一样，没有任何理由可查。
 *
 * 分开之后：玩家清白仍然安静（本该如此），**我方尺子坏了则必须吵**。
 * 调用方约定：`inputFault` 非空时**记日志/告警，但仍然不写证据表、不公示** ——
 * 尺子坏了要修的是尺子，不是拿坏尺子去量玩家。
 */
export type CheatInputFault =
  | 'claimed-not-finite'
  | 'bound-not-finite'
  /** 报值为负。物理量为负说明算它的那个公式坏了，不是玩家改的。 */
  | 'claimed-negative'
  /** 界限 ≤ 0。上界函数返回 0 或负数即其自身失效，此时任何比较都无意义。 */
  | 'bound-non-positive';

/** 我方判据故障的可读描述，供 Edge Function 打日志用，措辞统一在 core。 */
const INPUT_FAULT_LABELS: Readonly<Record<CheatInputFault, string>> = {
  'claimed-not-finite': '上报值不是有限数',
  'bound-not-finite': '判定界限不是有限数',
  'claimed-negative': '上报值为负——算它的公式已失效',
  'bound-non-positive': '判定界限 ≤ 0——上界函数自身已失效',
};

/**
 * 把一次判据故障写成一句可直接进日志的话。
 *
 * 措辞刻意以「判据异常」开头而非「作弊」—— 读日志的人第一眼就该知道
 * 这是我们自己的问题，不是抓到了谁。
 */
export function describeInputFault(input: {
  fault: CheatInputFault;
  claimField: CheatClaimField;
  claimedValue: number;
  boundValue: number;
}): string {
  return (
    `判据异常（我方故障，未对玩家做任何判定）：${CHEAT_FIELD_LABELS[input.claimField]}` +
    ` 上报=${input.claimedValue} 界限=${input.boundValue} —— ${INPUT_FAULT_LABELS[input.fault]}`
  );
}

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
  /**
   * ★ 本次判定所用的那个界限，此刻是否可信。默认 true。
   *
   * ## 为什么这个开关必须存在
   *
   * 上界不是凭空来的，它由玩家档案里的等级算出。而档案由客户端提交、
   * 可能**陈旧**（同步每会话只跑一次，且失败被静默吞掉）。档案偏旧 →
   * 上界偏低 → **正常玩家看起来像越界**。方向是恒定的：陈旧只会冤枉人，
   * 不会放过人（作弊者只会把等级往高了报，往低报反而更容易被抓）。
   *
   * 所以调用方在拿不准界限新鲜度时传 false：证据照记（便于人工复核），
   * **但绝不自动公示**。公开点名一旦误伤不可撤回，这个不对称决定了
   * 拿不准时只能选择不点名。
   */
  boundTrustworthy?: boolean;
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
    | 'version-skew-sensitive'
    /** 界限所依据的档案可能陈旧，方向上只会冤枉人 —— 记录但不点名。 */
    | 'bound-not-trustworthy';
  /**
   * ★ 非空 = **我方判据故障**，与玩家无关。
   *
   * 此时 isProven 恒为 false（不落库、不公示），但调用方**应当告警** ——
   * 这是「我们的尺子坏了」，不是「这个玩家看起来是清白的」。
   * 两者此前不可区分，见 CheatInputFault 的说明。
   */
  inputFault: CheatInputFault | null;
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
    inputFault: null,
  };
  /**
   * 判据不可用时的返回：一律不判（与 notProven 同为 isProven=false），
   * 但带上 inputFault 让调用方能告警 —— 这一支是**我方故障**，不是玩家清白。
   */
  const faulted = (fault: CheatInputFault): CheatEvidenceVerdict => ({
    ...notProven,
    inputFault: fault,
  });

  // 非有限数、负数、零界限都无法构成「超出物理上界」的证明 —— 一律不判。
  // 但它们各自意味着我方链路上有东西坏了，必须能被区分出来告警。
  if (!Number.isFinite(claimedValue)) return faulted('claimed-not-finite');
  if (!Number.isFinite(boundValue)) return faulted('bound-not-finite');
  if (claimedValue < 0) return faulted('claimed-negative');
  if (boundValue <= 0) return faulted('bound-non-positive');

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

  // 走到这里判据一定是可用的，故以下各支 inputFault 恒为 null。
  const proven = (
    shouldPublish: boolean,
    holdReason: CheatEvidenceVerdict['holdReason'],
  ): CheatEvidenceVerdict => ({
    isProven: true,
    overageRatio,
    shouldPublish,
    holdReason,
    inputFault: null,
  });

  // 闸门零：版本漂移敏感的判据一律不自动公开，只记录进人工复核队列。
  // 它排在最前面 —— 后面的倍率闸门对这类判据本来就不成立。
  if (!VERSION_SKEW_IMMUNE[input.claimField]) return proven(false, 'version-skew-sensitive');
  // 闸门零之二：界限本身不新鲜时同样不点名。倍率再高也不行 ——
  // 界限偏低正是把倍率抬高的原因，用它去证明「倍率高所以是作弊」是循环论证。
  if (input.boundTrustworthy === false) return proven(false, 'bound-not-trustworthy');
  if (overageRatio < PUBLISH_MIN_OVERAGE) return proven(false, 'below-margin');
  if (overageRatio >= EXTREME_OVERAGE) return proven(true, 'none');
  if (priorEvidenceCount + 1 >= REPEAT_EVIDENCE_THRESHOLD) return proven(true, 'none');
  return proven(false, 'awaiting-second-evidence');
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
