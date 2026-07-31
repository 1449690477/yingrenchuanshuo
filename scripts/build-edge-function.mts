/**
 * 打包 Edge Functions 的共享 core，并做确定性自检。
 *
 * 为什么需要这一步：
 *   - 服务端复算必须用【与客户端完全相同的】src/core 代码（docs/51 §6.3、
 *     docs/52 §5.3），但本仓 TS 全部是不带扩展名的 `@/` 路径导入，
 *     Deno 原生无法解析
 *   - 于是用 esbuild 把每个函数所需的 core 打成单个自包含文件 _core.ts，
 *     只把 'zod' 留作外部依赖（Deno 端由 supabase/functions/deno.json 映射到 npm:）
 *
 * 自检：打包产物与 src/core 原始实现各跑一次同种子试炼与对决，结果必须
 * 逐点一致。这一步不过，说明打包链路出了问题，绝不应部署。
 *
 * 用法：npm run edge:build
 */

import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const FUNCTIONS = [
  'submit-trial',
  'sync-profile',
  'submit-milestone',
  'submit-affection',
  'submit-progress',
  'arena-snapshot',
  'arena-candidates',
  'arena-challenge',
  'arena-daily-settle',
  'arena-shop-buy',
  'guild-expedition',
  'submit-dungeon',
] as const;

for (const name of FUNCTIONS) {
  const entry = path.join(root, `supabase/functions/${name}/_core-entry.ts`);
  const outfile = path.join(root, `supabase/functions/${name}/_core.ts`);
  await build({
    entryPoints: [entry],
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    target: 'es2022',
    treeShaking: true,
    minify: false,
    external: ['zod'],
    alias: { '@': path.join(root, 'src') },
    banner: {
      js: [
        '// ═══════════════════════════════════════════════════',
        '// 生成文件，请勿手改。来源：src/core（见 _core-entry.ts）',
        '// 重新生成：npm run edge:build',
        '// ═══════════════════════════════════════════════════',
      ].join('\n'),
    },
    outfile,
  });
  console.log(`✓ 已打包 supabase/functions/${name}/_core.ts`);
}

// ── 确定性自检 1：试炼成绩（docs/51 §6.3 的地基）──
const trialGenerated = await import(
  pathToFileURL(path.join(root, 'supabase/functions/submit-trial/_core.ts')).href
);
const trialSource = await import('../src/core/trial.ts');

const equipped = [null, null, null, null, null, null, null, null];
const input = { name: '自检', classId: 'swordsman', level: 45, equipped };
const seasonId = 's1';
const weekIndex = 30;
// 分段 id 会随赛季轮换重划（docs/61 §3.2：4 段→5 段、id 全换新），
// 绝不硬编码 —— 从源实现按等级现算，与线上函数行为同口径。
const bracketId = trialSource.trialBracketFor(input.level).id;

const trialFromGenerated = trialGenerated.runTrial(
  trialGenerated.buildTrialCombatant(input),
  trialGenerated.weeklyTrialBoss(seasonId, weekIndex, bracketId).combatant,
  trialGenerated.trialScoreSeed(
    seasonId,
    weekIndex,
    bracketId,
    trialGenerated.buildTrialCombatant(input).buildHash,
  ),
);
const trialFromSource = trialSource.runTrial(
  trialSource.buildTrialCombatant(input),
  trialSource.weeklyTrialBoss(seasonId, weekIndex, bracketId).combatant,
  trialSource.trialScoreSeed(
    seasonId,
    weekIndex,
    bracketId,
    trialSource.buildTrialCombatant(input).buildHash,
  ),
);

if (trialFromGenerated.damage !== trialFromSource.damage) {
  console.error(
    `✗ 试炼自检失败：打包产物成绩 ${trialFromGenerated.damage} ≠ 源实现成绩 ${trialFromSource.damage}`,
  );
  process.exit(1);
}
console.log(`✓ 试炼确定性自检通过：打包产物与 src/core 成绩一致（${trialFromSource.damage}）`);

const legacyV9Instance = {
  uid: 'edge-selfcheck-v9',
  defId: 'eq_r1_weapon_rare',
  enhance: 0,
  baseRollPermille: 1000,
  enhanceGainPermille: Array<number>(15).fill(0),
  enhanceLuck: {},
  affixes: [{ key: 'atk', value: 8.7, tier: 5 }],
  reforgeResonance: 0,
  locked: false,
};
const legacyIssueFromGenerated = trialGenerated.trialEquipmentSnapshotIssue(
  legacyV9Instance,
  'swordsman',
  6,
);
const legacyIssueFromSource = trialSource.trialEquipmentSnapshotIssue(
  legacyV9Instance,
  'swordsman',
  6,
);
if (legacyIssueFromGenerated !== null || legacyIssueFromSource !== null) {
  console.error(
    `✗ 历史词条自检失败：打包产物=${String(legacyIssueFromGenerated)}，源实现=${String(legacyIssueFromSource)}`,
  );
  process.exit(1);
}
console.log('✓ 历史词条自检通过：v9 正式生成并迁移的装备可进入服务端复算');

// 区域升阶只换 defId、原样保留来源等级生成的词条。线上曾把 r1→r6 的合法词条
// 拿 r6 等级区间校验，导致档案、公会入口与竞技场同时报“词条不符合公式”。
const advancedLegacyInstance = {
  ...legacyV9Instance,
  uid: 'edge-selfcheck-advanced',
  defId: 'eq_r6_weapon_rare',
};
for (const [name, generated] of [
  ['submit-trial', trialGenerated],
  [
    'arena-snapshot',
    await import(pathToFileURL(path.join(root, 'supabase/functions/arena-snapshot/_core.ts')).href),
  ],
  [
    'arena-challenge',
    await import(pathToFileURL(path.join(root, 'supabase/functions/arena-challenge/_core.ts')).href),
  ],
  [
    'sync-profile',
    await import(pathToFileURL(path.join(root, 'supabase/functions/sync-profile/_core.ts')).href),
  ],
  [
    'guild-expedition',
    await import(pathToFileURL(path.join(root, 'supabase/functions/guild-expedition/_core.ts')).href),
  ],
] as const) {
  const issue = generated.trialEquipmentSnapshotIssue(
    advancedLegacyInstance,
    'swordsman',
    58,
  );
  if (issue !== null) {
    console.error(`✗ 升阶保值词条自检失败：${name}=${String(issue)}`);
    process.exit(1);
  }
}
console.log('✓ 升阶保值词条自检通过：五条联机写入路径接受显式升阶链的历史生成等级');

// ── 确定性自检 2：竞技场对决（docs/52 §5.3 的地基）──
const duelGenerated = await import(
  pathToFileURL(path.join(root, 'supabase/functions/arena-challenge/_core.ts')).href
);
const duelSource = await import('../src/core/duel.ts');
const duelTrialSource = await import('../src/core/trial.ts');

const attackerInput = { name: '自检·攻', classId: 'witch', level: 80, equipped };
const defenderInput = { name: '自检·守', classId: 'shaman', level: 80, equipped };
const seed = 0x6d2b79f5;

const duelFromGenerated = duelGenerated.simulateDuel(
  duelGenerated.buildTrialCombatant(attackerInput),
  duelGenerated.buildTrialCombatant(defenderInput),
  new duelGenerated.Rng(seed),
);
const duelFromSource = duelSource.simulateDuel(
  duelTrialSource.buildTrialCombatant(attackerInput),
  duelTrialSource.buildTrialCombatant(defenderInput),
  new duelGenerated.Rng(seed),
);

const duelKey = (r: {
  winner: string;
  attackerDamage: number;
  defenderDamage: number;
  log: readonly unknown[];
}) => `${r.winner}|${r.attackerDamage}|${r.defenderDamage}|${r.log.length}`;
if (duelKey(duelFromGenerated) !== duelKey(duelFromSource)) {
  console.error(
    `✗ 对决自检失败：打包产物 ${duelKey(duelFromGenerated)} ≠ 源实现 ${duelKey(duelFromSource)}`,
  );
  process.exit(1);
}
console.log(`✓ 对决确定性自检通过：打包产物与 src/core 胜负一致（${duelKey(duelFromSource)}）`);

// ── 确定性自检 3：里程碑合理性下界（docs/51 §4 榜 4）──
//
// 这个榜没有「服务端复算」可言（「你何时到达 Lv60」无法重建），
// 下界表是唯一的防线。若打包产物里的表与 src/data 漂移，
// 服务端就会按另一套标准判定，而这类漂移正是 docs/61 §2.2 那个
// 「同一口径两处实现」bug 的成因 —— 必须在部署前拦住。
const milestoneGenerated = await import(
  pathToFileURL(path.join(root, 'supabase/functions/submit-milestone/_core.ts')).href
);
const milestoneSource = await import('../src/core/milestones.ts');
const milestoneRules = await import('../src/data/milestoneRules.ts');

for (const level of milestoneRules.MILESTONE_LEVELS) {
  const floor = milestoneRules.MILESTONE_MIN_ELAPSED_MS[level];
  // 下界上下各取一点：边界两侧的判定都必须两边一致
  for (const elapsedMs of [floor - 1, floor, floor + 1]) {
    const claim = { level, elapsedMs };
    const fromGenerated = milestoneGenerated.isPlausibleMilestone(claim);
    const fromSource = milestoneSource.isPlausibleMilestone(claim);
    if (fromGenerated !== fromSource) {
      console.error(
        `✗ 里程碑自检失败：Lv${level} 用时 ${elapsedMs}ms —— ` +
          `打包产物=${String(fromGenerated)}，源实现=${String(fromSource)}`,
      );
      process.exit(1);
    }
  }
}
if (milestoneGenerated.MILESTONE_LEVELS.join() !== milestoneRules.MILESTONE_LEVELS.join()) {
  console.error(
    `✗ 里程碑档位漂移：打包产物=[${milestoneGenerated.MILESTONE_LEVELS.join()}]，` +
      `源实现=[${milestoneRules.MILESTONE_LEVELS.join()}]`,
  );
  process.exit(1);
}
console.log(
  `✓ 里程碑确定性自检通过：档位 [${milestoneRules.MILESTONE_LEVELS.join(', ')}] 与下界判定两边一致`,
);

// ── 确定性自检 4：羁绊榜合理性下界（docs/63 §三 · P2）──
//
// 与里程碑同构：这个榜同样没有服务端复算可言，下界公式是唯一防线。
// 常量全部从好感数据推导（幕数上限 / 单次上限 / 单幕点数），
// 数据批次更新后打包产物必须跟上 —— 逐点比对打包产物与源实现。
const affectionGenerated = await import(
  pathToFileURL(path.join(root, 'supabase/functions/submit-affection/_core.ts')).href
);
const affectionSource = await import('../src/core/affectionBoard.ts');

const affectionProbes: { claim: { points: number; totalInteractions: number; storyCount: number }; accountAgeMs: number }[] = [
  // 30 天满勤满幕的理论极限（真实玩家上限）
  { claim: { points: 4 * 30 * 18 + 12 * 60, totalInteractions: 120, storyCount: 12 }, accountAgeMs: 30 * 86_400_000 },
  // 新号顶格（作弊声明）
  { claim: { points: 99_999, totalInteractions: 10_000, storyCount: 12 }, accountAgeMs: 86_400_000 },
  // 虚报互动次数（日上限防线）
  { claim: { points: 10_000, totalInteractions: 360, storyCount: 0 }, accountAgeMs: 10 * 86_400_000 },
  // 首日新手
  { claim: { points: 40, totalInteractions: 4, storyCount: 0 }, accountAgeMs: 0 },
  // 边界上下各一点
  { claim: { points: 99_999, totalInteractions: 5_555, storyCount: 15 }, accountAgeMs: 365 * 86_400_000 },
];
for (const probe of affectionProbes) {
  const fromGenerated = affectionGenerated.isPlausibleAffectionClaim(probe.claim, probe.accountAgeMs);
  const fromSource = affectionSource.isPlausibleAffectionClaim(probe.claim, probe.accountAgeMs);
  if (fromGenerated !== fromSource) {
    console.error(
      `✗ 羁绊自检失败：${JSON.stringify(probe)} —— ` +
        `打包产物=${String(fromGenerated)}，源实现=${String(fromSource)}`,
    );
    process.exit(1);
  }
}
console.log('✓ 羁绊榜确定性自检通过：下界判定打包产物与 src/core 逐点一致');

// ── 确定性自检 5：进度榜（docs/63 §五 · P4）──
//
// 这个榜同样没有服务端复算可言，防线是 L1 白名单窗口 + L3 同源门槛判定
// + 排序口径。若打包产物与 src/core 漂移，服务端就会按另一套标准判定 ——
// 三类探针逐点比对。关卡 id 一律从源实现 ORDERED_STAGE_IDS 现取，不硬编码
// （加新区域时自检自动跟随）。
const progressGenerated = await import(
  pathToFileURL(path.join(root, 'supabase/functions/submit-progress/_core.ts')).href
);
const progressSource = await import('../src/core/progressBoard.ts');
const progressStages = await import('../src/data/stages.ts');
const progressRegions = await import('../src/data/regions.ts');
const progressConstants = await import('../src/data/constants.ts');

const progressFirstStageId = progressStages.ORDERED_STAGE_IDS[0]!;
const progressLastStageId = progressStages.ORDERED_STAGE_IDS.at(-1)!;
const progressNow = Date.parse('2026-07-01T12:00:00.000Z');

// L1 结构白名单：窗口上下沿各取一点，两侧判定都必须一致
const progressL1Probes = [
  { stageId: progressFirstStageId, firstClearedAt: progressNow - 86_400_000 }, // 合法：首关有时刻
  { stageId: progressLastStageId, firstClearedAt: null }, // 合法：最深关无时刻（老档）
  { stageId: 'stage_99-9_6', firstClearedAt: progressNow }, // 未登记的关卡 id
  { stageId: progressFirstStageId, firstClearedAt: Date.parse('2020-01-01T00:00:00.000Z') }, // 赛季起点之前
  { stageId: progressFirstStageId, firstClearedAt: progressNow + 86_400_000 }, // 未来（超 5 分钟容差）
];
for (const probe of progressL1Probes) {
  const fromGenerated = progressGenerated.isProgressClaimWellFormed(probe, progressNow);
  const fromSource = progressSource.isProgressClaimWellFormed(probe, progressNow);
  if (fromGenerated !== fromSource) {
    console.error(
      `✗ 进度榜 L1 自检失败：${JSON.stringify(probe)} —— ` +
        `打包产物=${String(fromGenerated)}，源实现=${String(fromSource)}`,
    );
    process.exit(1);
  }
}

// L3 同源门槛判定：末关 0 战力 Lv1（拒）、末关顶格战力（过）、首关恒过、
// 老档等级后门（level = 章起点 + GATE_LEGACY_LEVEL_MARGIN，cp=0 也过）
const progressLastChapter = progressRegions.ALL_CHAPTERS.find(
  (c: { id: string }) => c.id === progressStages.getStage(progressLastStageId)!.chapterId,
)!;
const progressL3Probes: { claim: { stageId: string; firstClearedAt: number | null }; profile: { level: number; combatPower: number } }[] = [
  { claim: { stageId: progressLastStageId, firstClearedAt: progressNow }, profile: { level: 1, combatPower: 0 } },
  { claim: { stageId: progressLastStageId, firstClearedAt: progressNow }, profile: { level: 1, combatPower: Number.MAX_SAFE_INTEGER } },
  { claim: { stageId: progressFirstStageId, firstClearedAt: progressNow }, profile: { level: 1, combatPower: 0 } },
  {
    claim: { stageId: progressLastStageId, firstClearedAt: progressNow },
    profile: {
      level: progressLastChapter.levelFrom + progressConstants.GATE_LEGACY_LEVEL_MARGIN,
      combatPower: 0,
    },
  },
];
for (const probe of progressL3Probes) {
  const fromGenerated = progressGenerated.evaluateProgressClaim(probe.claim, probe.profile);
  const fromSource = progressSource.evaluateProgressClaim(probe.claim, probe.profile);
  const key = (v: { verified: boolean; verdict: string }) => `${v.verified}|${v.verdict}`;
  if (key(fromGenerated) !== key(fromSource)) {
    console.error(
      `✗ 进度榜 L3 自检失败：${JSON.stringify(probe)} —— ` +
        `打包产物=${key(fromGenerated)}，源实现=${key(fromSource)}`,
    );
    process.exit(1);
  }
}

// 排序口径：更深者胜 / 同深更早者胜 / 有时刻胜无时刻 / 无时刻但更深仍胜
const progressSortProbes = [
  { a: { deepestStageIndex: 10, firstClearedAt: 1000 }, b: { deepestStageIndex: 9, firstClearedAt: 500 } },
  { a: { deepestStageIndex: 10, firstClearedAt: 500 }, b: { deepestStageIndex: 10, firstClearedAt: 1000 } },
  { a: { deepestStageIndex: 10, firstClearedAt: 500 }, b: { deepestStageIndex: 10, firstClearedAt: null } },
  { a: { deepestStageIndex: 10, firstClearedAt: null }, b: { deepestStageIndex: 9, firstClearedAt: 500 } },
];
for (const { a, b } of progressSortProbes) {
  for (const [x, y] of [
    [a, b],
    [b, a],
  ] as const) {
    const fromGenerated = progressGenerated.progressRowBeatsRow(x, y);
    const fromSource = progressSource.progressRowBeatsRow(x, y);
    if (fromGenerated !== fromSource) {
      console.error(
        `✗ 进度榜排序自检失败：${JSON.stringify(x)} vs ${JSON.stringify(y)} —— ` +
          `打包产物=${String(fromGenerated)}，源实现=${String(fromSource)}`,
      );
      process.exit(1);
    }
  }
}
console.log('✓ 进度榜确定性自检通过：L1 白名单 / L3 门槛判定 / 排序口径打包产物与 src/core 逐点一致');

await import('./guild-edge-self-check.mts');

// ── 确定性自检：档案同步的战力与试炼函数逐点一致（docs/65 §六之二 方向 A）──
//
// sync-profile 与 submit-trial 是两个函数、两份打包产物，但它们对同一份
// 搭配快照必须算出**同一个战力** —— 否则玩家在「打开排行榜」和「提交试炼」
// 两条路径上会拿到两个名次，而这种分叉不会有任何报错。
// 这正是 docs/61 §2.2「同一口径两处实现」那类事故的形状。
const syncGenerated = await import(
  pathToFileURL(path.join(root, 'supabase/functions/sync-profile/_core.ts')).href
);
const syncTrialGenerated = await import(
  pathToFileURL(path.join(root, 'supabase/functions/submit-trial/_core.ts')).href
);
const syncSource = await import('../src/core/trial.ts');

for (const probe of [
  { name: '自检·档案', classId: 'swordsman', level: 45, equipped },
  { name: '自检·档案', classId: 'catkin', level: 78, equipped },
]) {
  const fromSync = syncGenerated.buildTrialCombatant(probe).combatPower;
  const fromTrial = syncTrialGenerated.buildTrialCombatant(probe).combatPower;
  const fromSource = syncSource.buildTrialCombatant(probe).combatPower;
  if (fromSync !== fromTrial || fromSync !== fromSource) {
    console.error(
      `✗ 档案同步自检失败：${probe.classId} Lv${probe.level} —— ` +
        `sync-profile=${fromSync}，submit-trial=${fromTrial}，源实现=${fromSource}`,
    );
    process.exit(1);
  }
}
console.log('✓ 档案同步确定性自检通过：sync-profile 与 submit-trial 战力逐点一致');

// ── 确定性自检：秘境榜白名单、合理性判定与深度链（docs/63 §二 · P1、docs/64）──
//
// 白名单是**从数据推导**的：档位的 comingSoon 决定收不收，
// 深度锚点表的 openDepths 决定开几层。内容更新时只有数据会变，
// 不会有人来动 Edge Function —— 打包产物没跟上，就会出现
// 「玩家能打、服务端拒收」，而且没人会想到来看这里。
// 所以逐点比对打包产物与源实现，两边不一致就不许部署。
const dungeonGenerated = await import(
  pathToFileURL(path.join(root, 'supabase/functions/submit-dungeon/_core.ts')).href
);
const dungeonSource = await import('../src/core/dungeonBoard.ts');

if (dungeonGenerated.BOARDABLE_DUNGEON_IDS.join() !== dungeonSource.BOARDABLE_DUNGEON_IDS.join()) {
  console.error(
    `✗ 秘境白名单漂移：打包产物 ${dungeonGenerated.BOARDABLE_DUNGEON_IDS.length} 层，` +
      `源实现 ${dungeonSource.BOARDABLE_DUNGEON_IDS.length} 层`,
  );
  process.exit(1);
}

const dungeonNow = Date.parse('2026-07-31T12:00:00+08:00');
const dungeonProbes = [
  // 满级碾压低档低层的合法下界成绩（统计型下界会误杀的那一类）
  { dungeonId: 'equipment_weapon_azure_d1', bestDurationMs: 200, firstClearedAt: dungeonNow - 8.64e7 },
  // 正常的深层成绩
  { dungeonId: 'equipment_body_auric_d3', bestDurationMs: 37_100, firstClearedAt: dungeonNow - 8.64e8 },
  // 未开放的层（crimson openDepths=1，d2 数值上等价于 d1，不单开榜）
  { dungeonId: 'equipment_weapon_crimson_d2', bestDurationMs: 42_300, firstClearedAt: dungeonNow },
  // 不存在的副本
  { dungeonId: 'equipment_weapon_rainbow_d1', bestDurationMs: 1_000, firstClearedAt: dungeonNow },
  // 破格律（手填的数字）
  { dungeonId: 'equipment_head_violet_d2', bestDurationMs: 1_337, firstClearedAt: dungeonNow },
  // 低于两帧下界
  { dungeonId: 'equipment_head_violet_d2', bestDurationMs: 100, firstClearedAt: dungeonNow },
  // 首通时刻穿越到 1970（并列排序的作弊路径）
  { dungeonId: 'equipment_head_violet_d2', bestDurationMs: 25_800, firstClearedAt: 0 },
];
for (const probe of dungeonProbes) {
  const fromGenerated = dungeonGenerated.isPlausibleDungeonClaim(probe, dungeonNow);
  const fromSource = dungeonSource.isPlausibleDungeonClaim(probe, dungeonNow);
  if (fromGenerated !== fromSource) {
    console.error(
      `✗ 秘境自检失败：${JSON.stringify(probe)} —— ` +
        `打包产物=${String(fromGenerated)}，源实现=${String(fromSource)}`,
    );
    process.exit(1);
  }
}

// 深度链：边界两侧都必须两边一致。这条判定是删掉等级门槛之后唯一的资格门禁，
// 打包产物若与源实现不同步，服务端会放行跳级上报，而且不会有任何报错。
const chainProbes: [string, number][] = [
  ['equipment_weapon_auric_d1', 0],
  ['equipment_weapon_auric_d2', 0],
  ['equipment_weapon_auric_d2', 1],
  ['equipment_weapon_auric_d5', 3],
  ['equipment_weapon_auric_d5', 4],
  ['equipment_head_auric_d4', 3],
];
for (const [dungeonId, clearedDepth] of chainProbes) {
  const fromGenerated = dungeonGenerated.meetsDungeonDepthChain(dungeonId, clearedDepth);
  const fromSource = dungeonSource.meetsDungeonDepthChain(dungeonId, clearedDepth);
  if (fromGenerated !== fromSource) {
    console.error(
      `✗ 秘境深度链自检失败：${dungeonId} 已达 ${clearedDepth} 层 —— ` +
        `打包产物=${String(fromGenerated)}，源实现=${String(fromSource)}`,
    );
    process.exit(1);
  }
}
console.log(
  `✓ 秘境榜确定性自检通过：${dungeonSource.BOARDABLE_DUNGEON_IDS.length} 层已开放，` +
    '白名单、合理性判定与深度链两边一致',
);
