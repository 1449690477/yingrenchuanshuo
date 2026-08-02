/**
 * 词条基准值的冻结快照 —— 改基准是**破坏性改动**，这张表让它无法被静默做掉。
 *
 * ── 它防的事故（2026-08-02 实测，两套方案同时中招）──
 * 有人把 `sha_spirit` 的基准从 0.84 改成 0.58。改完 `npm run verify` 全绿、
 * `npm run sim` 全绿、平衡门禁全部达标 —— **看起来是一次干净的数值调整**。
 * 但线上灵巫老玩家身上那件按 0.84 掉落的装备，其词条值落在新值域之外：
 * `isVerifiablePersistedAffixValue` 返回 false ⇒ `trialEquipmentSnapshotIssue`
 * 报 `affix-value` ⇒ submit-trial 返回 **400**。
 * **玩家什么都没做错，交不了试炼成绩，而且自己修不了**（除非扔掉那件装备）。
 *
 * ── 为什么现有测试全都抓不到 ──
 * 所有词条测试都是「用当前公式生成一个值，再用当前公式校验」——
 * **自洽但同版**。无论基准改成多少，这类测试永远是绿的。
 * 唯一能抓到的问法是「**上一版的合法值，这一版还认不认**」，
 * 而那需要一个「上一版是多少」的记录 —— 就是下面这张表。
 *
 * ── 还有一个更阴的原因（`equipment.ts:569`）──
 * 历史兼容路径取基准时写的是
 * `(rebase?.oldBaseline ?? (spec.min + spec.max) / 2)`。
 * **没在历史表里登记过的键会走 `??` 分支，拿今天的基准去"复现历史"** ——
 * 于是历史路径与当前路径算出同一个值域，等于没有历史路径，
 * 而且不报错、不警告。缺省值让"缺失"长得和"正常"一模一样。
 *
 * ── 改基准的人要做什么 ──
 * 测试红了说明你改了某个键的基准。**不要直接把下面的数字改成新值就完事**，
 * 那只是让测试闭嘴，线上老装备照样被 400 拒。正确顺序是：
 *   1. 先把**旧基准**登记进 `data/legacyAffixHistory.ts` 的历史 rebase 表，
 *      让 `isVerifiablePersistedAffixValue` 仍认得老玩家手里的值；
 *   2. 补一条测试：拿老值域的边界值去验，必须为 `true`；
 *   3. 最后才更新这里的数字。
 * 顺序反了的话，第 3 步会让红灯消失，而缺陷原样留在线上。
 *
 * ── 与战力版本戳的关系 ──
 * 改基准同时会改变同一件旧装备算出的战力，所以**通常还要把
 * `CP_FORMULA_VERSION` +1**（见 `cpFormulaVersion.ts` 文件头）。
 * 那条纪律有它自己的指纹守卫，但那个指纹喂的是冻结的 Stats 向量，
 * **抓不到"数据变了"这一类** —— 两条守卫互补，都要看。
 */

/**
 * 每个词条键当前的 `[min, max]` 基准。
 *
 * **只在完成上面三步之后才更新。** 顺序反了等于把守卫关掉。
 */
export const FROZEN_AFFIX_BASELINES: Readonly<Record<string, readonly [number, number]>> =
  Object.freeze({
    acc: [0.5, 1.2],
    atk: [0.4, 0.8],
    cat_nimble: [0.91, 0.91],
    cat_swift: [0.027, 0.027],
    critDmg: [2, 12],
    critRate: [0.5, 3],
    def: [0.3, 0.6],
    dmgReduce: [0.5, 2.5],
    elemDmg: [3, 10],
    eva: [0.4, 1],
    hp: [4, 8],
    kenshi_blade: [27, 27],
    kenshi_bushido: [2, 2],
    kenshi_honor: [7.8, 7.8],
    kenshi_iai: [4.3, 4.3],
    lifesteal: [0.5, 2],
    sha_drain: [1.6, 1.6],
    sha_spirit: [0.84, 0.84],
    sha_vitality: [7.8, 7.8],
    sha_ward: [2, 2],
    skillMul: [1, 4],
    spd: [0.01, 0.05],
    swd_guard: [0.59, 0.59],
    swd_heavy: [27, 27],
    wit_elem: [4.3, 4.3],
    wit_power: [0.53, 0.53],
    wit_veil: [0.91, 0.91],
  } as const);
