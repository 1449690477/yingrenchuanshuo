// ═══════════════════════════════════════════════════
// 生成文件，请勿手改。来源：src/core（见 _core-entry.ts）
// 重新生成：npm run edge:build
// ═══════════════════════════════════════════════════

// src/data/constants.ts
var CP_WEIGHTS = {
  atk: 2,
  def: 3,
  hp: 0.15,
  acc: 1,
  eva: 1.2,
  critRate: 250,
  critDmg: 80
};
var CLASS_BASE_STATS = {
  swordsman: { atk: 12, def: 8, hp: 200, acc: 85, eva: 5, critRate: 5, critDmg: 50, spd: 1 },
  witch: { atk: 18, def: 4, hp: 120, acc: 80, eva: 8, critRate: 8, critDmg: 50, spd: 0.9 },
  shaman: { atk: 10, def: 6, hp: 160, acc: 82, eva: 10, critRate: 6, critDmg: 50, spd: 1.1 },
  catkin: { atk: 13, def: 5, hp: 140, acc: 88, eva: 12, critRate: 10, critDmg: 50, spd: 1.25 }
};
var CLASS_GROWTH = {
  swordsman: { atk: 2.2, def: 1.8, hp: 45 },
  witch: { atk: 3.4, def: 0.8, hp: 22 },
  shaman: { atk: 1.9, def: 1.3, hp: 33 },
  catkin: { atk: 2.6, def: 1, hp: 28 }
};
var CLASS_ATK_MUL = {
  swordsman: 1,
  witch: 1.06,
  shaman: 0.86,
  catkin: 0.76
};
var ACC_PER_LEVEL = 1.5;
var EVA_PER_LEVEL = 0.8;
var ITEM_BASE = 6;
var ITEM_POW = 1.35;
var ITEM_SCALE = 0.1;
var QUALITY_ORDER = [
  "common",
  "fine",
  "rare",
  "epic",
  "legendary",
  "mythic",
  "prismatic",
  "divine"
];
var QUALITY_RANK = {
  common: 0,
  fine: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
  mythic: 5,
  prismatic: 6,
  divine: 7
};
var QUALITY_MUL = {
  common: 1,
  fine: 1.5,
  rare: 2.3,
  epic: 3.6,
  legendary: 5.8,
  mythic: 9.2,
  prismatic: 11.8,
  divine: 15
};
var QUALITY_AFFIX_COUNT = {
  common: 1,
  fine: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
  mythic: 5,
  prismatic: 6,
  divine: 6
};
var QUALITY_PROFESSION_AFFIX_COUNT = {
  common: 0,
  fine: 0,
  rare: 0,
  epic: 1,
  legendary: 1,
  mythic: 1,
  prismatic: 1,
  divine: 1
};
var AFFIX_TIERS = [
  { tier: 1, name: "\u7C97\u7CD9", weight: 40, multiplier: 0.62 },
  { tier: 2, name: "\u666E\u901A", weight: 27, multiplier: 0.76 },
  { tier: 3, name: "\u4F18\u826F", weight: 18, multiplier: 0.88 },
  { tier: 4, name: "\u5353\u8D8A", weight: 11, multiplier: 1.1 },
  { tier: 5, name: "\u6781\u54C1", weight: 4, multiplier: 1.64 }
];
var AFFIX_VALUE_VARIANCE = 0.03;
var SLOT_WEIGHTS = {
  weapon: { atk: 2 },
  head: { def: 0.7, acc: 0.8, hp: 3 },
  body: { def: 1.6, hp: 8 },
  necklace: { atk: 1 },
  bracelet: { atk: 0.8, acc: 0.6, def: 0.4 },
  ring: { atk: 0.7 },
  belt: { def: 1, hp: 5 },
  shoes: { def: 0.5, eva: 0.8, hp: 2 }
};
var SLOT_PCT_WEIGHTS = {
  weapon: { critRate: 1.5 },
  head: {},
  body: {},
  necklace: { critDmg: 8 },
  bracelet: {},
  ring: { critRate: 2, critDmg: 6 },
  belt: {},
  shoes: { spd: 0.02 }
};
var QUALITY_PCT_SCALE = {
  common: 0,
  fine: 0.5,
  rare: 1,
  epic: 1.6,
  legendary: 2.4,
  mythic: 3.4,
  prismatic: 4,
  divine: 4.6
};
var CRIT_RATE_CAP = 75;
var ACTIVE_AFFIX_RUNTIME = {
  generation: "active",
  settlement: "active"
};
var AFFIX_RUNTIME_RULES = {
  atk: ACTIVE_AFFIX_RUNTIME,
  def: ACTIVE_AFFIX_RUNTIME,
  hp: ACTIVE_AFFIX_RUNTIME,
  acc: ACTIVE_AFFIX_RUNTIME,
  eva: ACTIVE_AFFIX_RUNTIME,
  critRate: ACTIVE_AFFIX_RUNTIME,
  critDmg: ACTIVE_AFFIX_RUNTIME,
  spd: ACTIVE_AFFIX_RUNTIME,
  dmgReduce: ACTIVE_AFFIX_RUNTIME,
  elemDmg: ACTIVE_AFFIX_RUNTIME,
  lifesteal: ACTIVE_AFFIX_RUNTIME,
  skillMul: {
    generation: "deferred",
    settlement: "deferred",
    milestone: "M3-4",
    notice: "\u5F85 M3-4 \u6280\u80FD\u7ED3\u7B97"
  },
  swd_guard: ACTIVE_AFFIX_RUNTIME,
  swd_heavy: ACTIVE_AFFIX_RUNTIME,
  wit_power: ACTIVE_AFFIX_RUNTIME,
  wit_elem: ACTIVE_AFFIX_RUNTIME,
  wit_veil: ACTIVE_AFFIX_RUNTIME,
  sha_vitality: ACTIVE_AFFIX_RUNTIME,
  sha_drain: ACTIVE_AFFIX_RUNTIME,
  sha_ward: ACTIVE_AFFIX_RUNTIME,
  sha_spirit: ACTIVE_AFFIX_RUNTIME,
  cat_swift: ACTIVE_AFFIX_RUNTIME,
  cat_nimble: ACTIVE_AFFIX_RUNTIME
};
function isAffixGenerationActive(key) {
  return AFFIX_RUNTIME_RULES[key].generation === "active";
}
function isAffixSettlementActive(key) {
  return AFFIX_RUNTIME_RULES[key].settlement === "active";
}
var AFFIX_POOL = [
  {
    key: "atk",
    min: 0.4,
    max: 0.8,
    weight: 20,
    scalesWithLevel: true,
    decimals: 1,
    label: "\u653B\u51FB\u529B"
  },
  {
    key: "def",
    min: 0.3,
    max: 0.6,
    weight: 20,
    scalesWithLevel: true,
    decimals: 1,
    label: "\u9632\u5FA1\u529B"
  },
  { key: "hp", min: 4, max: 8, weight: 20, scalesWithLevel: true, decimals: 1, label: "\u751F\u547D\u503C" },
  {
    key: "critRate",
    min: 0.5,
    max: 3,
    weight: 10,
    scalesWithLevel: false,
    decimals: 1,
    label: "\u66B4\u51FB\u7387"
  },
  {
    key: "critDmg",
    min: 2,
    max: 12,
    weight: 10,
    scalesWithLevel: false,
    decimals: 1,
    label: "\u66B4\u51FB\u4F24\u5BB3"
  },
  { key: "acc", min: 0.5, max: 1.2, weight: 8, scalesWithLevel: true, decimals: 1, label: "\u547D\u4E2D" },
  { key: "eva", min: 0.4, max: 1, weight: 8, scalesWithLevel: true, decimals: 1, label: "\u95EA\u907F" },
  {
    key: "spd",
    min: 0.01,
    max: 0.05,
    weight: 4,
    scalesWithLevel: false,
    decimals: 2,
    label: "\u653B\u901F"
  },
  {
    key: "dmgReduce",
    min: 0.5,
    max: 2.5,
    weight: 3,
    scalesWithLevel: false,
    decimals: 1,
    label: "\u4F24\u5BB3\u51CF\u514D"
  },
  {
    key: "elemDmg",
    min: 3,
    max: 10,
    weight: 3,
    scalesWithLevel: false,
    decimals: 1,
    label: "\u5C5E\u6027\u4F24\u5BB3"
  },
  {
    key: "lifesteal",
    min: 0.5,
    max: 2,
    weight: 2,
    scalesWithLevel: false,
    decimals: 1,
    label: "\u5438\u8840"
  },
  {
    key: "skillMul",
    min: 1,
    max: 4,
    weight: 2,
    scalesWithLevel: false,
    decimals: 1,
    label: "\u6280\u80FD\u500D\u7387"
  }
];
var PROFESSION_AFFIX_POOLS = {
  swordsman: [
    {
      key: "swd_guard",
      balanceRole: "sustain",
      min: 0.59,
      max: 0.59,
      weight: 30,
      scalesWithLevel: true,
      decimals: 1,
      label: "\u5B88\u52BF"
    },
    {
      key: "swd_heavy",
      balanceRole: "offense",
      min: 27,
      max: 27,
      weight: 25,
      scalesWithLevel: false,
      decimals: 1,
      label: "\u91CD\u538B"
    }
  ],
  witch: [
    {
      key: "wit_power",
      balanceRole: "offense",
      min: 0.53,
      max: 0.53,
      weight: 30,
      scalesWithLevel: true,
      decimals: 1,
      label: "\u7075\u80FD"
    },
    {
      key: "wit_elem",
      balanceRole: "offense",
      min: 4.3,
      max: 4.3,
      weight: 25,
      scalesWithLevel: false,
      decimals: 1,
      label: "\u5143\u7D20\u4EB2\u548C"
    },
    {
      key: "wit_veil",
      balanceRole: "sustain",
      min: 0.91,
      max: 0.91,
      weight: 55,
      scalesWithLevel: true,
      decimals: 1,
      label: "\u661F\u7EB1"
    }
  ],
  shaman: [
    {
      key: "sha_vitality",
      balanceRole: "sustain",
      min: 7.8,
      max: 7.8,
      weight: 30,
      scalesWithLevel: true,
      decimals: 1,
      label: "\u56DE\u54CD"
    },
    {
      key: "sha_drain",
      balanceRole: "sustain",
      min: 1.6,
      max: 1.6,
      weight: 25,
      scalesWithLevel: false,
      decimals: 1,
      label: "\u7075\u5951"
    },
    {
      key: "sha_ward",
      balanceRole: "sustain",
      min: 2,
      max: 2,
      weight: 25,
      scalesWithLevel: false,
      decimals: 1,
      label: "\u5E87\u4F51"
    },
    {
      key: "sha_spirit",
      balanceRole: "offense",
      min: 0.84,
      max: 0.84,
      weight: 80,
      scalesWithLevel: true,
      decimals: 1,
      label: "\u7075\u51FB"
    }
  ],
  catkin: [
    {
      key: "cat_swift",
      balanceRole: "offense",
      min: 0.027,
      max: 0.027,
      weight: 30,
      scalesWithLevel: false,
      decimals: 3,
      label: "\u75BE\u98CE"
    },
    {
      key: "cat_nimble",
      balanceRole: "sustain",
      min: 0.91,
      max: 0.91,
      weight: 25,
      scalesWithLevel: true,
      decimals: 1,
      label: "\u7075\u5DE7"
    }
  ]
};
var SLOT_LABELS = {
  weapon: "\u6B66\u5668",
  head: "\u5934\u51A0",
  body: "\u8863\u88D9",
  necklace: "\u9879\u94FE",
  bracelet: "\u624B\u956F",
  ring: "\u6212\u6307",
  belt: "\u8170\u5E26",
  shoes: "\u978B"
};
var SLOT_ORDER = [
  "weapon",
  "head",
  "body",
  "necklace",
  "bracelet",
  "ring",
  "belt",
  "shoes"
];
var ENHANCE_MAX = 15;
var EQUIPMENT_BASE_ROLL_MIN = 1e3;
var EQUIPMENT_BASE_ROLL_MAX = 1200;
var ENHANCE_GAIN_TIERS = [
  { id: "stable", weight: 86, min: 80, max: 82 },
  { id: "excellent", weight: 13, min: 83, max: 95 },
  { id: "miracle", weight: 1, min: 110, max: 125 }
];
var ENHANCE_TOTAL_GAIN_CAP_PERMILLE = 1350;
var LUCK_FULL = 100;
var ENHANCE_MATERIAL_IDS = {
  stone: "stone_enhance",
  ore: "ore_black",
  lucky: "lucky_nine",
  protection: "charm_protect"
};
var OFFLINE_CAP_SECONDS = 8 * 3600;
var DEFAULT_MAX_KILLS_PER_SEC = 3;
var SWEEP_EQUIV_SECONDS = 30 * 60;
var AVG_SKILL_MULTIPLIERS = [
  { minLevel: 85, multiplier: 2.6 },
  { minLevel: 65, multiplier: 2.3 },
  { minLevel: 45, multiplier: 2 },
  { minLevel: 25, multiplier: 1.7 },
  { minLevel: 10, multiplier: 1.45 },
  { minLevel: 1, multiplier: 1.2 }
];

// src/core/formula.ts
function combatPower(stats) {
  const base = stats.atk * CP_WEIGHTS.atk + stats.def * CP_WEIGHTS.def + stats.hp * CP_WEIGHTS.hp + stats.acc * CP_WEIGHTS.acc + stats.eva * CP_WEIGHTS.eva + stats.critRate / 100 * CP_WEIGHTS.critRate + stats.critDmg / 100 * CP_WEIGHTS.critDmg;
  return Math.round(base * stats.spd);
}
function zeroStats() {
  return { atk: 0, def: 0, hp: 0, acc: 0, eva: 0, critRate: 0, critDmg: 0, spd: 0 };
}
function addStats(a, b) {
  return {
    atk: a.atk + (b.atk ?? 0),
    def: a.def + (b.def ?? 0),
    hp: a.hp + (b.hp ?? 0),
    acc: a.acc + (b.acc ?? 0),
    eva: a.eva + (b.eva ?? 0),
    critRate: a.critRate + (b.critRate ?? 0),
    critDmg: a.critDmg + (b.critDmg ?? 0),
    spd: a.spd + (b.spd ?? 0)
  };
}

// src/core/equipmentSets.ts
function resolveEquipmentSetBonuses(equipped, defOf, setDefOf) {
  const counts = /* @__PURE__ */ new Map();
  const definitions = /* @__PURE__ */ new Map();
  for (const instance of equipped) {
    if (!instance) continue;
    const equipmentDefinition = defOf(instance.defId);
    if (!equipmentDefinition) {
      throw new Error(`[\u914D\u7F6E\u9519\u8BEF] \u88C5\u5907\u5B9A\u4E49\u4E0D\u5B58\u5728\uFF1A${instance.defId}`);
    }
    if (!equipmentDefinition.setId) continue;
    const cachedDefinition = definitions.get(equipmentDefinition.setId);
    const setDefinition = cachedDefinition ?? setDefOf(equipmentDefinition.setId);
    if (!setDefinition) {
      throw new Error(`[\u914D\u7F6E\u9519\u8BEF] \u88C5\u5907\u5F15\u7528\u4E86\u672A\u767B\u8BB0\u5957\u88C5\uFF1A${equipmentDefinition.setId}`);
    }
    if (setDefinition.id !== equipmentDefinition.setId) {
      throw new Error(
        `[\u914D\u7F6E\u9519\u8BEF] \u5957\u88C5\u67E5\u8BE2\u952E\u4E0E\u5B9A\u4E49 ID \u4E0D\u4E00\u81F4\uFF1A${equipmentDefinition.setId} / ${setDefinition.id}`
      );
    }
    if (!setDefinition.pieceSlots.includes(equipmentDefinition.slot)) {
      throw new Error(
        `[\u914D\u7F6E\u9519\u8BEF] \u5957\u88C5 ${setDefinition.id} \u4E0D\u5305\u542B\u90E8\u4F4D ${equipmentDefinition.slot}\uFF1A${equipmentDefinition.id}`
      );
    }
    if (!cachedDefinition) {
      assertSetDefinition(setDefinition);
      definitions.set(setDefinition.id, setDefinition);
    }
    counts.set(setDefinition.id, (counts.get(setDefinition.id) ?? 0) + 1);
  }
  const statPercent = zeroStats();
  const statFlat = zeroStats();
  const combatBonuses = zeroSetCombatBonuses();
  const onHitTriggers = [];
  const onLethalTriggers = [];
  let skillMultiplierBonus = 0;
  const sets = [];
  for (const [setId, equippedPieces] of counts) {
    const definition = definitions.get(setId);
    const activeBonuses = definition.bonuses.filter((bonus) => equippedPieces >= bonus.pieces);
    const nextBonus = definition.bonuses.find((bonus) => equippedPieces < bonus.pieces) ?? null;
    for (const bonus of activeBonuses) {
      addPartialStats(statPercent, bonus.statPercent);
      addPartialStats(statFlat, bonus.statFlat);
      addSetCombatBonuses(combatBonuses, bonus.combatBonuses);
      for (const trigger of bonus.onHitTriggers ?? []) {
        if (onHitTriggers.some((existing) => existing.id === trigger.id)) {
          throw new Error(`[\u914D\u7F6E\u9519\u8BEF] \u91CD\u590D\u7684\u9010\u51FB\u89E6\u53D1 ID\uFF1A${trigger.id}`);
        }
        onHitTriggers.push(trigger);
      }
      for (const trigger of bonus.onLethalTriggers ?? []) {
        if (onLethalTriggers.some((existing) => existing.id === trigger.id)) {
          throw new Error(`[\u914D\u7F6E\u9519\u8BEF] \u91CD\u590D\u7684\u81F4\u547D\u4F24\u89E6\u53D1 ID\uFF1A${trigger.id}`);
        }
        onLethalTriggers.push(trigger);
      }
      skillMultiplierBonus += bonus.skillMultiplierBonus ?? 0;
    }
    sets.push({ definition, equippedPieces, activeBonuses, nextBonus });
  }
  sets.sort((left, right) => right.equippedPieces - left.equippedPieces);
  return {
    sets,
    statPercent,
    statFlat,
    combatBonuses,
    onHitTriggers,
    onLethalTriggers,
    skillMultiplierBonus
  };
}
function applyEquipmentSetStats(stats, resolution) {
  return {
    atk: stats.atk * (1 + resolution.statPercent.atk) + resolution.statFlat.atk,
    def: stats.def * (1 + resolution.statPercent.def) + resolution.statFlat.def,
    hp: stats.hp * (1 + resolution.statPercent.hp) + resolution.statFlat.hp,
    acc: stats.acc * (1 + resolution.statPercent.acc) + resolution.statFlat.acc,
    eva: stats.eva * (1 + resolution.statPercent.eva) + resolution.statFlat.eva,
    critRate: stats.critRate * (1 + resolution.statPercent.critRate) + resolution.statFlat.critRate,
    critDmg: stats.critDmg * (1 + resolution.statPercent.critDmg) + resolution.statFlat.critDmg,
    spd: stats.spd * (1 + resolution.statPercent.spd) + resolution.statFlat.spd
  };
}
function addPartialStats(target, source4) {
  if (!source4) return;
  for (const key of Object.keys(target)) {
    target[key] += source4[key] ?? 0;
  }
}
function zeroSetCombatBonuses() {
  return {
    damageReduction: 0,
    lifesteal: 0,
    elementDamage: { fire: 0, ice: 0, thunder: 0 }
  };
}
function addSetCombatBonuses(target, source4) {
  if (!source4) return;
  target.damageReduction += source4.damageReduction ?? 0;
  target.lifesteal += source4.lifesteal ?? 0;
  target.elementDamage.fire += source4.elementDamage?.fire ?? 0;
  target.elementDamage.ice += source4.elementDamage?.ice ?? 0;
  target.elementDamage.thunder += source4.elementDamage?.thunder ?? 0;
}
function assertSetDefinition(definition) {
  if (definition.pieceSlots.length === 0) {
    throw new Error(`[\u914D\u7F6E\u9519\u8BEF] \u5957\u88C5\u6CA1\u6709\u767B\u8BB0\u4EFB\u4F55\u90E8\u4F4D\uFF1A${definition.id}`);
  }
  if (new Set(definition.pieceSlots).size !== definition.pieceSlots.length) {
    throw new Error(`[\u914D\u7F6E\u9519\u8BEF] \u5957\u88C5\u90E8\u4F4D\u91CD\u590D\uFF1A${definition.id}`);
  }
  let previousPieces = 0;
  const triggerIds = /* @__PURE__ */ new Set();
  const lethalTriggerIds = /* @__PURE__ */ new Set();
  for (const bonus of definition.bonuses) {
    if (bonus.pieces <= previousPieces || bonus.pieces > definition.pieceSlots.length) {
      throw new Error(`[\u914D\u7F6E\u9519\u8BEF] \u5957\u88C5\u6FC0\u6D3B\u4EF6\u6570\u975E\u6CD5\uFF1A${definition.id} / ${bonus.pieces}`);
    }
    for (const trigger of bonus.onHitTriggers ?? []) {
      assertOnHitElementalDamageTrigger(trigger);
      if (triggerIds.has(trigger.id)) {
        throw new Error(`[\u914D\u7F6E\u9519\u8BEF] \u91CD\u590D\u7684\u9010\u51FB\u89E6\u53D1 ID\uFF1A${trigger.id}`);
      }
      triggerIds.add(trigger.id);
    }
    for (const trigger of bonus.onLethalTriggers ?? []) {
      assertOnLethalRecoveryTrigger(trigger);
      if (lethalTriggerIds.has(trigger.id)) {
        throw new Error(`[\u914D\u7F6E\u9519\u8BEF] \u91CD\u590D\u7684\u81F4\u547D\u4F24\u89E6\u53D1 ID\uFF1A${trigger.id}`);
      }
      lethalTriggerIds.add(trigger.id);
    }
    previousPieces = bonus.pieces;
  }
}
function assertOnLethalRecoveryTrigger(trigger) {
  if (trigger.kind !== "lethal-recovery") {
    throw new Error(`[\u914D\u7F6E\u9519\u8BEF] \u672A\u77E5\u81F4\u547D\u4F24\u89E6\u53D1\u7C7B\u578B\uFF1A${trigger.id}`);
  }
  if (!trigger.id.trim()) {
    throw new Error("[\u914D\u7F6E\u9519\u8BEF] \u81F4\u547D\u4F24\u89E6\u53D1\u7F3A\u5C11\u7A33\u5B9A ID");
  }
  if (!Number.isFinite(trigger.healRatio) || trigger.healRatio <= 0 || trigger.healRatio > 1) {
    throw new Error(`[\u914D\u7F6E\u9519\u8BEF] \u81F4\u547D\u4F24\u56DE\u590D\u6BD4\u4F8B\u5FC5\u987B\u5728 (0, 1]\uFF1A${trigger.id}`);
  }
  if (!Number.isSafeInteger(trigger.activationsPerFight) || trigger.activationsPerFight <= 0) {
    throw new Error(`[\u914D\u7F6E\u9519\u8BEF] \u81F4\u547D\u4F24\u89E6\u53D1\u6B21\u6570\u5FC5\u987B\u662F\u6B63\u6574\u6570\uFF1A${trigger.id}`);
  }
}
function assertOnHitElementalDamageTrigger(trigger) {
  if (trigger.kind !== "elemental-damage") {
    throw new Error(`[\u914D\u7F6E\u9519\u8BEF] \u672A\u77E5\u9010\u51FB\u89E6\u53D1\u7C7B\u578B\uFF1A${trigger.id}`);
  }
  if (!trigger.id.trim()) {
    throw new Error("[\u914D\u7F6E\u9519\u8BEF] \u9010\u51FB\u89E6\u53D1\u7F3A\u5C11\u7A33\u5B9A ID");
  }
  if (!Number.isFinite(trigger.chance) || trigger.chance < 0 || trigger.chance > 1) {
    throw new Error(`[\u914D\u7F6E\u9519\u8BEF] \u9010\u51FB\u89E6\u53D1\u6982\u7387\u5FC5\u987B\u5728 0~1\uFF1A${trigger.id}`);
  }
  if (!Number.isFinite(trigger.atkMultiplier) || trigger.atkMultiplier <= 0) {
    throw new Error(`[\u914D\u7F6E\u9519\u8BEF] \u9010\u51FB\u89E6\u53D1\u653B\u51FB\u500D\u7387\u5FC5\u987B\u4E3A\u6B63\u6570\uFF1A${trigger.id}`);
  }
  if (!["fire", "ice", "thunder"].includes(trigger.element)) {
    throw new Error(`[\u914D\u7F6E\u9519\u8BEF] \u8FFD\u52A0\u5143\u7D20\u4F24\u5BB3\u4E0D\u80FD\u662F\u65E0\u5C5E\u6027\uFF1A${trigger.id}`);
  }
}

// src/core/progression.ts
function baseStatsFor(classId, level) {
  if (level < 1) throw new Error(`baseStatsFor: \u7B49\u7EA7\u5FC5\u987B >= 1\uFF0C\u6536\u5230 ${level}`);
  const base = CLASS_BASE_STATS[classId];
  const growth = CLASS_GROWTH[classId];
  const n = level - 1;
  return {
    atk: base.atk + growth.atk * n,
    def: base.def + growth.def * n,
    hp: base.hp + growth.hp * n,
    acc: base.acc + ACC_PER_LEVEL * n,
    eva: base.eva + EVA_PER_LEVEL * n,
    critRate: base.critRate,
    critDmg: base.critDmg,
    spd: base.spd
  };
}
function applyClassMods(classId, stats) {
  return { ...stats, atk: stats.atk * CLASS_ATK_MUL[classId] };
}
function makePlayer(name, level, stats, element = "none", combatBonuses) {
  return {
    name,
    level,
    element,
    stats,
    currentHp: stats.hp,
    ...combatBonuses ? { combatBonuses } : {}
  };
}
function averageSkillMultiplier(level) {
  if (level < 1) throw new Error(`averageSkillMultiplier: \u7B49\u7EA7\u5FC5\u987B >= 1\uFF0C\u6536\u5230 ${level}`);
  return AVG_SKILL_MULTIPLIERS.find((entry4) => level >= entry4.minLevel).multiplier;
}

// src/data/reforgeRules.ts
var REFORGE_RESONANCE_MAX = 20;
var REFORGE_RULES = {
  reforge: {
    goldPerLevel: 50,
    materialEveryLevels: 5,
    materialBase: 1,
    regionCommonEach: 10,
    regionFine: 2
  },
  temper: {
    goldPerLevel: 80,
    materialEveryLevels: 4
  },
  bind: {
    /** 锁 N 条时，本次消耗 2^(N-1)；0 条不消耗。 */
    exponentOffset: 1
  },
  resonate: {
    goldPerLevel: 300
  },
  /**
   * 每次随机洗练后共鸣值的增减；T4/T5 视为已拿到好结果，清零。
   *
   * 原表（+2/+1/0）下保底几乎摸不到：非好词条平均只推进 1.26 点，
   * 要连续 16 次不出 T4/T5 才能填满 20，实测保底只贡献 7.8% 的 T4+，
   * 玩家盯着的那条进度条基本永远填不满，还经常卡在 T3 一动不动。
   * 现表让每一次不如意都推进进度条，保底占比 22.8%、平均 5.4 次出一条
   * T4+（原 6.2 次）—— 倒霉的人有兜底，运气好的人本来也用不上它。
   * 上限仍是 20，不触动存档校验与既有迁移。
   */
  resonanceGain: {
    1: 3,
    2: 2,
    3: 1,
    4: -REFORGE_RESONANCE_MAX,
    5: -REFORGE_RESONANCE_MAX
  }
};

// src/core/bag.ts
var AUTO_LOCK_MIN_RANK = QUALITY_RANK.legendary;
var MIRACLE_AUTO_LOCK_MIN_RANK = QUALITY_RANK.epic;

// src/core/equipment.ts
function weaponElementOf(definition) {
  if (definition.slot !== "weapon") {
    throw new Error(`[\u914D\u7F6E\u9519\u8BEF] \u53EA\u6709\u6B66\u5668\u80FD\u63D0\u4F9B\u57FA\u7840\u653B\u51FB\u5C5E\u6027\uFF1A${definition.id}`);
  }
  return definition.element;
}
function itemBaseValue(level, quality) {
  if (!Number.isInteger(level) || level < 1) {
    throw new Error(`itemBaseValue: \u7B49\u7EA7\u5FC5\u987B\u662F\u6B63\u6574\u6570\uFF0C\u6536\u5230 ${level}`);
  }
  return ITEM_BASE * Math.pow(level, ITEM_POW) * QUALITY_MUL[quality] * ITEM_SCALE;
}
function baseEquipStats(def) {
  const baseValue = itemBaseValue(def.level, def.quality);
  const pctScale = QUALITY_PCT_SCALE[def.quality];
  const out = zeroStats();
  for (const [key, w] of Object.entries(SLOT_WEIGHTS[def.slot])) {
    out[key] += baseValue * w;
  }
  for (const [key, w] of Object.entries(SLOT_PCT_WEIGHTS[def.slot])) {
    out[key] += pctScale * w;
  }
  return out;
}
function enhanceMultiplier(enhanceLevel, enhanceGainPermille) {
  if (!Number.isInteger(enhanceLevel) || enhanceLevel < 0 || enhanceLevel > ENHANCE_MAX) {
    throw new Error(`enhanceMultiplier: \u5F3A\u5316\u7B49\u7EA7\u5FC5\u987B\u5728 0~${ENHANCE_MAX}\uFF0C\u6536\u5230 ${enhanceLevel}`);
  }
  assertEnhanceGainArray(enhanceGainPermille, enhanceLevel);
  const totalGain = enhanceGainPermille.slice(0, enhanceLevel).reduce((sum, gain) => sum + gain, 0);
  return 1 + Math.min(totalGain, ENHANCE_TOTAL_GAIN_CAP_PERMILLE) / 1e3;
}
function instanceStatsForClass(def, inst, classId) {
  return instanceStatsWhere(def, inst, (affix) => affixAppliesToClass(affix.key, classId));
}
function instanceStatsWhere(def, inst, includeAffix) {
  const base = baseEquipStats(def);
  assertBaseRoll(inst.baseRollPermille);
  const mul = inst.baseRollPermille / 1e3 * enhanceMultiplier(inst.enhance, inst.enhanceGainPermille);
  let out = {
    atk: base.atk * mul,
    def: base.def * mul,
    hp: base.hp * mul,
    acc: base.acc * mul,
    eva: base.eva * mul,
    // 百分比属性不受强化影响
    critRate: base.critRate,
    critDmg: base.critDmg,
    spd: base.spd
  };
  for (const a of [...def.fixedAffixes ?? [], ...inst.affixes]) {
    if (!includeAffix(a)) continue;
    out = applyAffix(out, a);
  }
  return out;
}
function applyAffix(stats, affix) {
  switch (affix.key) {
    case "atk":
    case "def":
    case "hp":
    case "acc":
    case "eva":
    case "critRate":
    case "critDmg":
    case "spd":
      return addStats(stats, { [affix.key]: affix.value });
    case "swd_guard":
      return addStats(stats, { def: affix.value });
    case "swd_heavy":
      return addStats(stats, { critDmg: affix.value });
    case "wit_power":
      return addStats(stats, { atk: affix.value });
    case "wit_veil":
      return addStats(stats, { eva: affix.value });
    case "sha_vitality":
      return addStats(stats, { hp: affix.value });
    case "sha_spirit":
      return addStats(stats, { atk: affix.value });
    case "cat_swift":
      return addStats(stats, { spd: affix.value });
    case "cat_nimble":
      return addStats(stats, { eva: affix.value });
    default:
      return stats;
  }
}
function zeroCombatBonuses() {
  return {
    damageReduction: 0,
    lifesteal: 0,
    elementDamage: { fire: 0, ice: 0, thunder: 0 }
  };
}
function addCombatBonuses(a, b) {
  return {
    damageReduction: a.damageReduction + (b.damageReduction ?? 0),
    lifesteal: a.lifesteal + (b.lifesteal ?? 0),
    elementDamage: {
      fire: a.elementDamage.fire + (b.elementDamage?.fire ?? 0),
      ice: a.elementDamage.ice + (b.elementDamage?.ice ?? 0),
      thunder: a.elementDamage.thunder + (b.elementDamage?.thunder ?? 0)
    }
  };
}
function applyCombatAffix(bonuses, affix) {
  if (!isAffixSettlementActive(affix.key)) return bonuses;
  switch (affix.key) {
    case "dmgReduce":
    case "sha_ward":
      return addCombatBonuses(bonuses, { damageReduction: affix.value });
    case "lifesteal":
    case "sha_drain":
      return addCombatBonuses(bonuses, { lifesteal: affix.value });
    case "elemDmg":
    case "wit_elem": {
      if (!affix.element || affix.element === "none") {
        throw new Error("elemDmg \u8BCD\u6761\u5FC5\u987B\u7ED1\u5B9A fire / ice / thunder \u4E4B\u4E00");
      }
      return addCombatBonuses(bonuses, {
        elementDamage: { [affix.element]: affix.value }
      });
    }
    default:
      return bonuses;
  }
}
function instanceCombatBonusesForClass(def, inst, classId) {
  let out = zeroCombatBonuses();
  for (const affix of [...def.fixedAffixes ?? [], ...inst.affixes]) {
    if (classId !== null && !affixAppliesToClass(affix.key, classId)) continue;
    out = applyCombatAffix(out, affix);
  }
  return out;
}
function affixAppliesToClass(key, classId) {
  const owner = professionForAffix(key);
  return owner === null || owner === classId;
}
function professionForAffix(key) {
  for (const classId of Object.keys(PROFESSION_AFFIX_POOLS)) {
    if (PROFESSION_AFFIX_POOLS[classId].some((entry4) => entry4.key === key)) return classId;
  }
  return null;
}
function totalEquipStats(equipped, defOf, classId) {
  let out = zeroStats();
  for (const inst of equipped) {
    if (!inst) continue;
    const def = defOf(inst.defId);
    if (!def) throw new Error(`[\u914D\u7F6E\u9519\u8BEF] \u88C5\u5907\u5B9A\u4E49\u4E0D\u5B58\u5728\uFF1A${inst.defId}`);
    out = addStats(out, instanceStatsForClass(def, inst, classId));
  }
  return out;
}
function totalEquipCombatBonuses(equipped, defOf, classId) {
  let out = zeroCombatBonuses();
  for (const inst of equipped) {
    if (!inst) continue;
    const def = defOf(inst.defId);
    if (!def) throw new Error(`[\u914D\u7F6E\u9519\u8BEF] \u88C5\u5907\u5B9A\u4E49\u4E0D\u5B58\u5728\uFF1A${inst.defId}`);
    out = addCombatBonuses(out, instanceCombatBonusesForClass(def, inst, classId));
  }
  return out;
}
function affixValueRange(key, level, tier) {
  const spec = requireAffixSpec(key);
  const { baseline, multiplier, precision } = affixValueContext(spec, level, tier);
  return {
    min: Math.round(baseline * multiplier * (1 - AFFIX_VALUE_VARIANCE) * precision) / precision,
    max: Math.round(baseline * multiplier * (1 + AFFIX_VALUE_VARIANCE) * precision) / precision,
    decimals: spec.decimals
  };
}
function isRolledAffixValue(key, level, tier, value) {
  if (!Number.isFinite(value)) return false;
  const range = affixValueRange(key, level, tier);
  const precision = 10 ** range.decimals;
  const scaled = value * precision;
  const hasConfiguredPrecision = Math.abs(scaled - Math.round(scaled)) <= 1e-8;
  return hasConfiguredPrecision && value >= range.min - Number.EPSILON && value <= range.max + Number.EPSILON;
}
function requireAffixSpec(key) {
  const spec = AFFIX_POOL.find((entry4) => entry4.key === key) ?? Object.values(PROFESSION_AFFIX_POOLS).flat().find((entry4) => entry4.key === key);
  if (!spec) throw new Error(`[\u914D\u7F6E\u9519\u8BEF] \u968F\u673A\u8BCD\u6761\u6C60\u4E0D\u5B58\u5728\uFF1A${key}`);
  return spec;
}
function affixValueContext(spec, level, tier) {
  if (!Number.isInteger(level) || level < 1) {
    throw new Error(`rollAffixValue: \u88C5\u5907\u7B49\u7EA7\u5FC5\u987B\u662F\u6B63\u6574\u6570\uFF0C\u6536\u5230 ${level}`);
  }
  const tierConfig = AFFIX_TIERS.find((config) => config.tier === tier);
  if (!tierConfig) throw new Error(`rollAffixValue: \u672A\u914D\u7F6E\u7684\u8BCD\u6761\u54C1\u9636 T${tier}`);
  const levelScale = spec.scalesWithLevel ? Math.pow(level, 1.3) : 1;
  return {
    baseline: (spec.min + spec.max) / 2 * levelScale,
    multiplier: tierConfig.multiplier,
    precision: 10 ** spec.decimals
  };
}
function assertBaseRoll(permille) {
  if (!Number.isInteger(permille) || permille < EQUIPMENT_BASE_ROLL_MIN || permille > EQUIPMENT_BASE_ROLL_MAX) {
    throw new Error(
      `\u88C5\u5907\u80DA\u5B50\u500D\u7387\u5FC5\u987B\u662F ${EQUIPMENT_BASE_ROLL_MIN}~${EQUIPMENT_BASE_ROLL_MAX} \u7684\u6574\u6570\uFF0C\u6536\u5230 ${permille}`
    );
  }
}
function assertEnhanceGainArray(gains, enhanceLevel) {
  if (gains.length !== ENHANCE_MAX) {
    throw new Error(`\u5F3A\u5316\u589E\u5E45\u8BB0\u5F55\u5FC5\u987B\u56FA\u5B9A\u4E3A ${ENHANCE_MAX} \u683C\uFF0C\u6536\u5230 ${gains.length}`);
  }
  gains.forEach((gain, index) => {
    const configured = gain === 0 || ENHANCE_GAIN_TIERS.some((tier) => gain >= tier.min && gain <= tier.max);
    if (!Number.isInteger(gain) || !configured) {
      throw new Error(`\u5F3A\u5316\u589E\u5E45\u7B2C ${index + 1} \u683C\u4E0D\u5408\u6CD5\uFF1A${gain}`);
    }
    if (index < enhanceLevel && gain === 0) {
      throw new Error(`\u5F53\u524D\u5DF2\u5F3A\u5316\u5230 +${enhanceLevel}\uFF0C\u7B2C ${index + 1} \u683C\u589E\u5E45\u4E0D\u80FD\u4E3A 0`);
    }
  });
}

// src/core/types.ts
var CLASS_IDS = ["swordsman", "witch", "shaman", "catkin"];

// src/data/boutique.ts
var weapons = (swordsman, witch, shaman, catkin) => [
  { ...swordsman, slot: "weapon", category: "weapon", classId: "swordsman" },
  { ...witch, slot: "weapon", category: "weapon", classId: "witch" },
  { ...shaman, slot: "weapon", category: "weapon", classId: "shaman" },
  { ...catkin, slot: "weapon", category: "weapon", classId: "catkin" }
];
var BOUTIQUE_THEMES = {
  "berry-cream": {
    id: "berry-cream",
    name: "\u8349\u8393\u5976\u971C\u8336\u4F1A",
    shortName: "\u8393\u971C",
    quality: "epic",
    level: 12,
    unlockStageId: "stage_2-1_6",
    rank: 1,
    tagline: "\u767D\u7C89\u857E\u4E1D\u3001\u8393\u679C\u7CD6\u6676\u4E0E\u4E0B\u5348\u8336\u7684\u751C\u9999\u3002",
    palette: ["#ff7fad", "#fff1f7", "#ffe1a8"],
    interactionName: "\u5976\u971C\u4E0B\u5348\u8336",
    interactionLines: [
      "\u5976\u6CB9\u6CE1\u6CE1\u4E0D\u4F1A\u5F04\u810F\u88D9\u6446\uFF0C\u653E\u5FC3\u6233\u4E00\u4E0B\u5427\uFF5E",
      "\u8981\u628A\u7B2C\u4E00\u9897\u8349\u8393\u7559\u7ED9\u4F60\u5417\uFF1F",
      "\u8F6C\u4E00\u5708\uFF0C\u7CD6\u971C\u661F\u661F\u90FD\u8DDF\u7740\u4EAE\u8D77\u6765\u5566\uFF01"
    ],
    attackEffects: {
      swordsman: "assets/effects/boutique/berry-cream-swordsman.png",
      witch: "assets/effects/boutique/berry-cream-witch.png",
      shaman: "assets/effects/boutique/berry-cream-shaman.png",
      catkin: "assets/effects/boutique/berry-cream-catkin.png"
    },
    items: [
      ...weapons(
        {
          name: "\u8349\u8393\u5976\u971C\u4F1E\u5251",
          price: 135e4,
          uniqueEffect: "\u653B\u51FB\u6362\u80A4\uFF1A\u5FC3\u5F62\u7CD6\u6676\u65A9\u5F27\u4E0E\u8349\u8393\u661F\u5C51\u3002"
        },
        {
          name: "\u8349\u8393\u5976\u971C\u661F\u5319\u6756",
          price: 135e4,
          uniqueEffect: "\u65BD\u6CD5\u6362\u80A4\uFF1A\u8393\u679C\u661F\u5F39\u62D6\u51FA\u5976\u6CB9\u4E1D\u5E26\u3002"
        },
        {
          name: "\u8349\u8393\u5976\u971C\u8336\u94C3",
          price: 135e4,
          uniqueEffect: "\u65BD\u6CD5\u6362\u80A4\uFF1A\u8336\u94C3\u7EFD\u5F00\u7C89\u767D\u6CBB\u6108\u6CE2\u7EB9\u3002"
        },
        {
          name: "\u8349\u8393\u5976\u971C\u7CD6\u6676\u722A",
          price: 135e4,
          uniqueEffect: "\u653B\u51FB\u6362\u80A4\uFF1A\u8349\u8393\u5FC3\u6676\u5728\u53CC\u722A\u4EA4\u9519\u5904\u8FF8\u5F00\u3002"
        }
      ),
      {
        slot: "head",
        name: "\u857E\u4E1D\u8393\u679C\u8F6F\u5E3D",
        price: 82e4,
        category: "armor",
        uniqueEffect: "\u5F85\u673A\u65F6\u5E3D\u6A90\u5076\u5C14\u843D\u4E0B\u4E00\u9897\u7CD6\u6676\u661F\u3002"
      },
      {
        slot: "body",
        name: "\u8349\u8393\u5976\u971C\u6D1B\u4E3D\u5854\u88D9",
        price: 12e5,
        category: "dress",
        uniqueEffect: "\u4E13\u5C5E\u4E92\u52A8\uFF1A\u5976\u6CB9\u6CE1\u6CE1\u4E0E\u5BB3\u7F9E\u7684\u4E0B\u5348\u8336\u8F6C\u5708\u3002"
      },
      {
        slot: "necklace",
        name: "\u7CD6\u971C\u5FC3\u9501",
        price: 9e5,
        category: "accessory",
        uniqueEffect: "\u9888\u4FA7\u95EA\u8FC7\u67D4\u7C89\u5FC3\u5149\uFF0C\u5F3A\u5316\u7CFB\u5217\u4E3B\u5149\u73AF\u3002"
      },
      {
        slot: "bracelet",
        name: "\u5976\u6CB9\u8774\u8776\u624B\u73AF",
        price: 8e5,
        category: "accessory",
        uniqueEffect: "\u89E6\u6478\u89D2\u8272\u65F6\u624B\u8FB9\u98DE\u51FA\u5976\u6CB9\u8774\u8776\u3002"
      },
      {
        slot: "ring",
        name: "\u8393\u6676\u8336\u6212",
        price: 95e4,
        category: "accessory",
        uniqueEffect: "\u4E92\u52A8\u7ED3\u675F\u65F6\u51DD\u6210\u4E00\u9897\u8393\u7EA2\u7231\u5FC3\u3002"
      },
      {
        slot: "belt",
        name: "\u4E1D\u7ED2\u86CB\u7CD5\u8170\u5C01",
        price: 78e4,
        category: "armor",
        uniqueEffect: "\u8170\u95F4\u4E1D\u5E26\u968F\u653B\u51FB\u8282\u594F\u8F7B\u8F7B\u626C\u8D77\u3002"
      },
      {
        slot: "shoes",
        name: "\u751C\u8393\u5706\u5934\u978B",
        price: 76e4,
        category: "armor",
        uniqueEffect: "\u811A\u6B65\u6362\u80A4\uFF1A\u7559\u4E0B\u77ED\u6682\u8349\u8393\u7CD6\u971C\u5370\u3002"
      }
    ]
  },
  "moon-sugar": {
    id: "moon-sugar",
    name: "\u6708\u6842\u661F\u7CD6\u8336\u4F1A",
    shortName: "\u6708\u7CD6",
    quality: "legendary",
    level: 16,
    unlockStageId: "stage_2-3_6",
    rank: 2,
    tagline: "\u591C\u84DD\u8584\u7EB1\u3001\u5976\u91D1\u6708\u6842\u4E0E\u4F1A\u8DF3\u821E\u7684\u6708\u5154\u3002",
    palette: ["#4d66a8", "#fff5d6", "#e7c470"],
    interactionName: "\u6708\u5154\u7977\u613F",
    interactionLines: [
      "\u5618\uFF0C\u6708\u5154\u521A\u521A\u4ECE\u8896\u53E3\u63A2\u51FA\u5934\u4E86\u3002",
      "\u4E00\u8D77\u628A\u613F\u671B\u85CF\u8FDB\u8FD9\u9897\u661F\u7CD6\u91CC\u5427\u3002",
      "\u6325\u6325\u624B\uFF0C\u661F\u5EA7\u7EBF\u6B63\u5728\u66FF\u6211\u4EEC\u5199\u540D\u5B57\u3002"
    ],
    attackEffects: {
      swordsman: "assets/effects/boutique/moon-sugar-swordsman.png",
      witch: "assets/effects/boutique/moon-sugar-witch.png",
      shaman: "assets/effects/boutique/moon-sugar-shaman.png",
      catkin: "assets/effects/boutique/moon-sugar-catkin.png"
    },
    items: [
      ...weapons(
        {
          name: "\u6708\u6842\u661F\u7CD6\u65B0\u6708\u5203",
          price: 68e5,
          uniqueEffect: "\u653B\u51FB\u6362\u80A4\uFF1A\u5976\u91D1\u65B0\u6708\u5251\u5F27\u8FDE\u63A5\u661F\u5EA7\u7EBF\u3002"
        },
        {
          name: "\u6708\u6842\u661F\u7CD6\u6708\u5154\u6756",
          price: 68e5,
          uniqueEffect: "\u65BD\u6CD5\u6362\u80A4\uFF1A\u6708\u5154\u6D41\u661F\u4ECE\u65B0\u6708\u6CD5\u9635\u8DC3\u51FA\u3002"
        },
        {
          name: "\u6708\u6842\u661F\u7CD6\u7977\u706F",
          price: 68e5,
          uniqueEffect: "\u65BD\u6CD5\u6362\u80A4\uFF1A\u7977\u706F\u7075\u706B\u73AF\u7ED5\u6210\u91D1\u8272\u6708\u76F8\u3002"
        },
        {
          name: "\u6708\u6842\u661F\u7CD6\u6708\u5154\u722A",
          price: 68e5,
          uniqueEffect: "\u653B\u51FB\u6362\u80A4\uFF1A\u6708\u5154\u65B0\u6708\u6CBF\u84DD\u7D2B\u6676\u722A\u8DC3\u51FA\u3002"
        }
      ),
      {
        slot: "head",
        name: "\u6708\u5154\u8584\u7EB1\u793C\u5E3D",
        price: 42e5,
        category: "armor",
        uniqueEffect: "\u5F85\u673A\u65F6\u6708\u76F8\u5728\u5E3D\u7F18\u7F13\u6162\u8F6E\u8F6C\u3002"
      },
      {
        slot: "body",
        name: "\u6708\u6842\u661F\u7CD6\u6D1B\u4E3D\u5854\u88D9",
        price: 6e6,
        category: "dress",
        uniqueEffect: "\u4E13\u5C5E\u4E92\u52A8\uFF1A\u5411\u6708\u5154\u62DB\u624B\uFF0C\u661F\u5EA7\u7EBF\u7ED5\u88D9\u6446\u4EAE\u8D77\u3002"
      },
      {
        slot: "necklace",
        name: "\u661F\u7802\u6708\u76F8\u9888\u94FE",
        price: 46e5,
        category: "accessory",
        uniqueEffect: "\u6708\u76F8\u5149\u70B9\u968F\u89D2\u8272\u547C\u5438\u660E\u6697\u53D8\u5316\u3002"
      },
      {
        slot: "bracelet",
        name: "\u6708\u8F89\u857E\u4E1D\u8896\u6263",
        price: 4e6,
        category: "accessory",
        uniqueEffect: "\u65BD\u6CD5\u65F6\u53CC\u624B\u7559\u4E0B\u77ED\u4FC3\u661F\u7802\u8F68\u8FF9\u3002"
      },
      {
        slot: "ring",
        name: "\u65B0\u6708\u7977\u613F\u6212",
        price: 52e5,
        category: "accessory",
        uniqueEffect: "\u89E6\u6478\u6212\u6307\u4F1A\u53EC\u6765\u4E00\u53EA\u77ED\u6682\u7684\u6708\u5154\u5149\u5F71\u3002"
      },
      {
        slot: "belt",
        name: "\u591C\u84DD\u8774\u8776\u8170\u5C01",
        price: 38e5,
        category: "armor",
        uniqueEffect: "\u591C\u84DD\u8774\u8776\u7ED3\u6CDB\u8D77\u514B\u5236\u7684\u5976\u91D1\u8F89\u5149\u3002"
      },
      {
        slot: "shoes",
        name: "\u6708\u5154\u73CD\u73E0\u978B",
        price: 36e5,
        category: "armor",
        uniqueEffect: "\u811A\u6B65\u6362\u80A4\uFF1A\u7559\u4E0B\u65B0\u6708\u4E0E\u5154\u8033\u5149\u6591\u3002"
      }
    ]
  },
  "rose-night": {
    id: "rose-night",
    name: "\u7EEF\u6A31\u661F\u613F\u591C\u5BB4",
    shortName: "\u7EEF\u591C",
    quality: "mythic",
    level: 20,
    unlockStageId: "stage_2-5_6",
    rank: 3,
    tagline: "\u7EEF\u7EA2\u8537\u8587\u3001\u8D64\u91D1\u661F\u6CB3\u4E0E\u53EA\u4E3A\u80DC\u8005\u70B9\u4EAE\u7684\u591C\u5BB4\u3002",
    palette: ["#a92f52", "#2d2446", "#f2c66d"],
    interactionName: "\u661F\u613F\u63D0\u88D9\u793C",
    interactionLines: [
      "\u4ECA\u665A\u7684\u7B2C\u4E00\u9897\u6D41\u661F\uFF0C\u4E5F\u60F3\u548C\u4F60\u4E00\u8D77\u770B\u3002",
      "\u522B\u7728\u773C\uFF0C\u8537\u8587\u4F1A\u5728\u63D0\u88D9\u793C\u7ED3\u675F\u65F6\u76DB\u5F00\u3002",
      "\u8FD9\u679A\u7EEF\u6708\u8A93\u7EA6\u2026\u2026\u53EA\u56DE\u5E94\u4F60\u7684\u89E6\u78B0\u3002"
    ],
    attackEffects: {
      swordsman: "assets/effects/boutique/rose-night-swordsman.png",
      witch: "assets/effects/boutique/rose-night-witch.png",
      shaman: "assets/effects/boutique/rose-night-shaman.png",
      catkin: "assets/effects/boutique/rose-night-catkin.png"
    },
    items: [
      ...weapons(
        {
          name: "\u7EEF\u6A31\u661F\u613F\u8537\u8587\u5251",
          price: 22e6,
          uniqueEffect: "\u653B\u51FB\u6362\u80A4\uFF1A\u8537\u8587\u82B1\u74E3\u6CBF\u661F\u6CB3\u5251\u75D5\u4F9D\u6B21\u76DB\u5F00\u3002"
        },
        {
          name: "\u7EEF\u6A31\u661F\u613F\u5929\u7A79\u6756",
          price: 22e6,
          uniqueEffect: "\u65BD\u6CD5\u6362\u80A4\uFF1A\u5929\u7A79\u6A31\u7206\u5760\u4E0B\u8D64\u91D1\u6D41\u661F\u3002"
        },
        {
          name: "\u7EEF\u6A31\u661F\u613F\u5FA1\u7075\u6247",
          price: 22e6,
          uniqueEffect: "\u65BD\u6CD5\u6362\u80A4\uFF1A\u5FA1\u7075\u8776\u6247\u9635\u5377\u8D77\u7EEF\u6A31\u661F\u5C18\u3002"
        },
        {
          name: "\u7EEF\u6A31\u661F\u613F\u8537\u8587\u722A",
          price: 22e6,
          uniqueEffect: "\u653B\u51FB\u6362\u80A4\uFF1A\u8D64\u91D1\u8537\u8587\u5728\u4EA4\u9519\u722A\u75D5\u4E2D\u592E\u76DB\u5F00\u3002"
        }
      ),
      {
        slot: "head",
        name: "\u661F\u51A0\u8537\u8587\u793C\u5E3D",
        price: 14e6,
        category: "armor",
        uniqueEffect: "\u5F85\u673A\u65F6\u661F\u51A0\u70B9\u4EAE\u4E00\u5708\u514B\u5236\u7684\u8D64\u91D1\u661F\u8292\u3002"
      },
      {
        slot: "body",
        name: "\u7EEF\u6A31\u661F\u613F\u6D1B\u4E3D\u5854\u793C\u88D9",
        price: 2e7,
        category: "dress",
        uniqueEffect: "\u4E13\u5C5E\u4E92\u52A8\uFF1A\u661F\u613F\u63D0\u88D9\u793C\u4E0E\u7531\u4E0B\u800C\u4E0A\u7684\u8537\u8587\u7EFD\u653E\u3002"
      },
      {
        slot: "necklace",
        name: "\u6C38\u7EFD\u6A31\u5FC3\u9879\u94FE",
        price: 15e6,
        category: "accessory",
        uniqueEffect: "\u80F8\u524D\u6A31\u5FC3\u968F\u6280\u80FD\u91CA\u653E\u95EA\u51FA\u4E00\u6B21\u661F\u8292\u3002"
      },
      {
        slot: "bracelet",
        name: "\u661F\u706B\u857E\u4E1D\u8155\u9970",
        price: 13e6,
        category: "accessory",
        uniqueEffect: "\u6325\u624B\u65F6\u7559\u4E0B\u7EEF\u7EA2\u7F0E\u5E26\u4E0E\u7EC6\u788E\u661F\u706B\u3002"
      },
      {
        slot: "ring",
        name: "\u7EEF\u6708\u8A93\u7EA6\u6212",
        price: 18e6,
        category: "accessory",
        uniqueEffect: "\u89E6\u6478\u6212\u6307\u89E6\u53D1\u4E00\u9897\u6D41\u661F\u4E0E\u4E13\u5C5E\u56DE\u5E94\u3002"
      },
      {
        slot: "belt",
        name: "\u8D64\u91D1\u8537\u8587\u8170\u5C01",
        price: 12e6,
        category: "armor",
        uniqueEffect: "\u8170\u95F4\u8537\u8587\u5728\u66B4\u51FB\u6F14\u51FA\u65F6\u70B9\u4EAE\u8D64\u91D1\u8F6E\u5ED3\u3002"
      },
      {
        slot: "shoes",
        name: "\u661F\u613F\u6C34\u6676\u978B",
        price: 11e6,
        category: "armor",
        uniqueEffect: "\u811A\u6B65\u6362\u80A4\uFF1A\u7559\u4E0B\u6E10\u9690\u7684\u8537\u8587\u661F\u7206\u3002"
      }
    ]
  },
  "cardboard-cat": {
    id: "cardboard-cat",
    name: "\u7EB8\u7BB1\u952E\u5E3D\u6478\u9C7C\u5957",
    shortName: "\u5B85\u732B",
    quality: "epic",
    level: 14,
    unlockStageId: "stage_2-2_6",
    rank: 1.5,
    tagline: "\u7EB8\u7BB1\u5C0F\u5305\u3001\u952E\u5E3D\u6676\u722A\u4E0E\u201C\u518D\u6478\u4E94\u5206\u949F\u201D\u7684\u732B\u7CFB\u673A\u52A8\u5DE5\u88C5\u3002",
    palette: ["#334f82", "#fff1d8", "#ff8fb5"],
    interactionName: "\u7EB8\u7BB1\u6478\u9C7C\u65F6\u95F4",
    interactionLines: [
      "\u952E\u76D8\u5148\u4EA4\u7ED9\u722A\u722A\u68C0\u67E5\u4E00\u4E0B\u2026\u2026\u6CA1\u6709\u5C0F\u9C7C\u5E72\uFF0C\u5DEE\u8BC4\uFF01",
      "\u8FD9\u4E2A\u7EB8\u7BB1\u53E3\u888B\u521A\u597D\u80FD\u88C5\u4E0B\u4ECA\u5929\u7684\u6218\u5229\u54C1\u3002",
      "\u518D\u6478\u4E94\u5206\u949F\u5C31\u51FA\u53D1\uFF0C\u732B\u732B\u8BF4\u8BDD\u7B97\u8BDD\u2026\u2026\u5927\u6982\u3002"
    ],
    attackEffects: {
      catkin: "assets/effects/boutique/cardboard-cat-catkin.png"
    },
    items: [
      {
        slot: "body",
        name: "\u7EB8\u7BB1\u952E\u5E3D\u673A\u52A8\u5DE5\u88C5",
        price: 26e5,
        category: "dress",
        classId: "catkin",
        renderMode: "replacement",
        uniqueEffect: "\u6574\u8EAB\u6362\u88C5\uFF1A\u732B\u8033\u4E0E\u84DD\u6CEA\u6EF4\u5B8C\u5168\u4FDD\u7559\uFF0C\u7EB8\u7BB1\u5C0F\u5305\u968F\u6251\u51FB\u52A8\u4F5C\u4E00\u8D77\u6446\u52A8\u3002"
      },
      {
        slot: "weapon",
        name: "\u952E\u5E3D\u75BE\u6253\u6676\u722A",
        price: 32e5,
        category: "weapon",
        classId: "catkin",
        uniqueEffect: "\u653B\u51FB\u6362\u80A4\uFF1A\u516D\u9053\u84DD\u6676\u952E\u5E3D\u722A\u75D5\u4EA4\u9519\uFF0C\u547D\u4E2D\u4E2D\u5FC3\u7EFD\u5F00\u7C89\u8272\u8089\u7403\u3002"
      }
    ]
  }
};
var BOUTIQUE_THEME_LIST = Object.values(BOUTIQUE_THEMES);
function boutiqueEquipmentId(themeId, slot, classId) {
  return `eq_shop_${themeId}_${slot}${classId ? `_${classId}` : ""}`;
}
function boutiqueAppearanceId(themeId, slot, classId) {
  return `boutique-${themeId}-${slot}${classId ? `-${classId}` : ""}`;
}

// src/data/affectionEquipment.ts
var COLLECTION_LEVELS = [1, 5, 10, 15, 20, 25, 30, 35, 40, 45];
var COLLECTION_UNLOCK_POINTS = [0, 40, 80, 160, 240, 360, 520, 700, 900, 1100];
var slotAffixKeys = {
  weapon: ["atk", "critRate", "critDmg", "acc", "spd", "hp"],
  head: ["def", "hp", "acc", "eva", "critRate", "critDmg"],
  body: ["def", "hp", "eva", "acc", "critRate", "critDmg"],
  necklace: ["atk", "critDmg", "hp", "critRate", "acc", "eva"],
  bracelet: ["atk", "acc", "def", "critRate", "hp", "eva"],
  ring: ["atk", "critRate", "critDmg", "acc", "eva", "hp"],
  belt: ["def", "hp", "eva", "acc", "critRate", "critDmg"],
  shoes: ["eva", "spd", "def", "hp", "acc", "critRate"]
};
var classSpecs = (classId, baseTheme, entries) => entries.map((entry4, index) => ({
  ...entry4,
  classId,
  level: COLLECTION_LEVELS[index],
  unlockPoints: COLLECTION_UNLOCK_POINTS[index],
  appearanceTheme: index >= 8 ? "rose-night" : baseTheme
}));
var SPECS = [
  ...classSpecs("swordsman", "berry-cream", [
    {
      slot: "head",
      name: "\u6668\u8A93\u6A31\u51A0",
      slug: "morning-oath-sakura-crown",
      flavorText: "\u6668\u7EC3\u5F00\u59CB\u524D\uFF0C\u5979\u4EB2\u624B\u66FF\u4F60\u522B\u597D\u7684\u7B2C\u4E00\u74E3\u6A31\u82B1\u3002",
      memoryEffect: "\u6668\u8A93\u56DE\u5FC6\uFF1A\u5F85\u673A\u65F6\u6D6E\u73B0\u6668\u5149\u6A31\u74E3\u3002"
    },
    {
      slot: "necklace",
      name: "\u5B88\u5FC3\u6A31\u74E3\u9879\u94FE",
      slug: "guardian-heart-petal-necklace",
      flavorText: "\u82B1\u74E3\u5408\u62E2\u65F6\uFF0C\u6B63\u597D\u62A4\u4F4F\u4E00\u9897\u6F84\u6F88\u7684\u84DD\u8272\u5FC3\u77F3\u3002",
      memoryEffect: "\u5B88\u5FC3\u56DE\u5FC6\uFF1A\u53D7\u51FB\u65F6\u95EA\u8FC7\u6A31\u74E3\u62A4\u5149\u3002"
    },
    {
      slot: "bracelet",
      name: "\u5E76\u80A9\u4E1D\u5E26\u8155\u9970",
      slug: "side-by-side-ribbon-bracelet",
      flavorText: "\u4E24\u6761\u4E0D\u540C\u989C\u8272\u7684\u4E1D\u5E26\uFF0C\u88AB\u5979\u8BA4\u771F\u7F16\u6210\u540C\u4E00\u4E2A\u7ED3\u3002",
      memoryEffect: "\u5E76\u80A9\u56DE\u5FC6\uFF1A\u4E92\u52A8\u65F6\u4EAE\u8D77\u53CC\u8272\u8A93\u7EA6\u4E1D\u5E26\u3002"
    },
    {
      slot: "ring",
      name: "\u4E0D\u51CB\u8A93\u7EA6\u6212",
      slug: "everlasting-vow-ring",
      flavorText: "\u4E0D\u662F\u7EC8\u70B9\u7684\u627F\u8BFA\uFF0C\u800C\u662F\u6BCF\u6B21\u51FA\u53D1\u90FD\u4F1A\u56DE\u6765\u7684\u7EA6\u5B9A\u3002",
      memoryEffect: "\u8A93\u7EA6\u56DE\u5FC6\uFF1A\u66B4\u51FB\u77AC\u95F4\u7EFD\u5F00\u5FAE\u578B\u6A31\u73AF\u3002"
    },
    {
      slot: "belt",
      name: "\u5FC3\u613F\u8537\u8587\u8170\u5C01",
      slug: "wish-rose-belt",
      flavorText: "\u5979\u628A\u6CA1\u6709\u8BF4\u51FA\u53E3\u7684\u613F\u671B\u85CF\u8FDB\u4E86\u8537\u8587\u6263\u80CC\u9762\u3002",
      memoryEffect: "\u5FC3\u613F\u56DE\u5FC6\uFF1A\u79FB\u52A8\u65F6\u7559\u4E0B\u8537\u8587\u91D1\u7EBF\u3002"
    },
    {
      slot: "shoes",
      name: "\u9010\u5149\u821E\u6B65\u793C\u978B",
      slug: "lightstep-dance-shoes",
      flavorText: "\u9002\u5408\u8BAD\u7EC3\uFF0C\u4E5F\u9002\u5408\u628A\u80DC\u5229\u540E\u7684\u7B2C\u4E00\u652F\u821E\u7559\u7ED9\u91CD\u8981\u7684\u4EBA\u3002",
      memoryEffect: "\u9010\u5149\u56DE\u5FC6\uFF1A\u95EA\u907F\u65F6\u8E0F\u51FA\u4E00\u5708\u6668\u5149\u3002"
    },
    {
      slot: "body",
      name: "\u6A31\u8A93\u9A91\u58EB\u59EC\u793C\u88D9",
      slug: "sakura-oath-knight-dress",
      flavorText: "\u793C\u88D9\u7684\u6BCF\u4E00\u9053\u91D1\u7EBF\uFF0C\u90FD\u5EF6\u7EED\u7740\u5979\u5B88\u62A4\u800C\u4E0D\u675F\u7F1A\u7684\u4FE1\u5FF5\u3002",
      memoryEffect: "\u6A31\u8A93\u56DE\u5FC6\uFF1A\u89D2\u8272\u5C55\u793A\u5207\u6362\u4E3A\u6A31\u8272\u9A91\u58EB\u793C\u88C5\u3002"
    },
    {
      slot: "weapon",
      name: "\u5FC3\u8679\u8A93\u7EA6\u82B1\u5251",
      slug: "heart-rainbow-vow-rapier",
      flavorText: "\u5251\u5C16\u4E0D\u6307\u5411\u540C\u884C\u8005\uFF0C\u53EA\u4F1A\u4E3A\u5171\u540C\u7684\u9053\u8DEF\u5212\u5F00\u9634\u973E\u3002",
      memoryEffect: "\u5FC3\u8679\u56DE\u5FC6\uFF1A\u653B\u51FB\u62D6\u51FA\u8679\u8272\u6A31\u82B1\u5251\u5F27\u3002"
    },
    {
      slot: "body",
      name: "\u665A\u971E\u7EA6\u4F1A\u534E\u793C\u670D",
      slug: "sunset-date-gala-dress",
      flavorText: "\u5979\u8BF4\u53EA\u662F\u80DC\u5229\u5BB4\u4F1A\uFF0C\u5374\u63D0\u524D\u95EE\u4E86\u4E09\u6B21\u4F60\u4F1A\u4E0D\u4F1A\u8D74\u7EA6\u3002",
      memoryEffect: "\u665A\u971E\u56DE\u5FC6\uFF1A\u89D2\u8272\u5C55\u793A\u5207\u6362\u4E3A\u66AE\u8272\u7EA6\u4F1A\u793C\u670D\u3002"
    },
    {
      slot: "weapon",
      name: "\u6668\u6A31\u5B88\u62A4\u957F\u5203",
      slug: "morning-sakura-guardian-blade",
      flavorText: "\u4E24\u4E2A\u4EBA\u4E00\u8D77\u63E1\u4F4F\u7684\u613F\u671B\uFF0C\u6BD4\u4EFB\u4F55\u957F\u5203\u90FD\u66F4\u575A\u5B9A\u3002",
      memoryEffect: "\u5B88\u62A4\u56DE\u5FC6\uFF1A\u91CD\u51FB\u5C55\u5F00\u6668\u6A31\u8679\u5149\u3002"
    }
  ]),
  ...classSpecs("witch", "moon-sugar", [
    {
      slot: "head",
      name: "\u544A\u767D\u661F\u7EB1\u9B54\u5973\u5E3D",
      slug: "confession-starveil-witch-hat",
      flavorText: "\u5E3D\u6A90\u4F1A\u66FF\u5979\u906E\u4F4F\u6CDB\u7EA2\u7684\u8033\u5C16\uFF0C\u5374\u906E\u4E0D\u4F4F\u5077\u5077\u9760\u8FD1\u7684\u661F\u5149\u3002",
      memoryEffect: "\u661F\u7EB1\u56DE\u5FC6\uFF1A\u5F85\u673A\u65F6\u843D\u4E0B\u7CD6\u6676\u661F\u5C51\u3002"
    },
    {
      slot: "necklace",
      name: "\u6026\u7136\u661F\u6838\u9879\u94FE",
      slug: "heartbeat-starcore-necklace",
      flavorText: "\u4E24\u9897\u5FC3\u8DF3\u63A5\u8FD1\u65F6\uFF0C\u661F\u6838\u7684\u5149\u4F1A\u6BD4\u5E73\u65F6\u5FEB\u4E00\u62CD\u3002",
      memoryEffect: "\u661F\u6838\u56DE\u5FC6\uFF1A\u53D7\u51FB\u65F6\u5C55\u5F00\u67D4\u548C\u661F\u76FE\u3002"
    },
    {
      slot: "bracelet",
      name: "\u7275\u661F\u857E\u4E1D\u624B\u73AF",
      slug: "starbound-lace-bracelet",
      flavorText: "\u5979\u575A\u6301\u8FD9\u53EA\u662F\u5BFC\u822A\u9B54\u6CD5\uFF0C\u4E1D\u5E26\u5374\u603B\u4F1A\u6307\u5411\u4F60\u7684\u4F4D\u7F6E\u3002",
      memoryEffect: "\u7275\u661F\u56DE\u5FC6\uFF1A\u4E92\u52A8\u65F6\u6D6E\u73B0\u76F8\u8FDE\u661F\u8F68\u3002"
    },
    {
      slot: "ring",
      name: "\u6708\u4E0B\u5FC3\u613F\u6212",
      slug: "moonlit-wish-ring",
      flavorText: "\u6708\u5149\u7167\u8FDB\u6676\u77F3\u540E\uFF0C\u4F1A\u6620\u51FA\u4F69\u6234\u8005\u6700\u60F3\u518D\u6B21\u89C1\u5230\u7684\u4EBA\u3002",
      memoryEffect: "\u5FC3\u613F\u56DE\u5FC6\uFF1A\u66B4\u51FB\u65F6\u95EA\u8FC7\u5F2F\u6708\u5FC3\u5149\u3002"
    },
    {
      slot: "belt",
      name: "\u661F\u8F68\u8774\u8776\u8170\u5C01",
      slug: "startrail-butterfly-waistbelt",
      flavorText: "\u661F\u8F68\u7ED5\u4E86\u4E00\u5927\u5708\uFF0C\u6700\u540E\u505C\u5728\u4E24\u4E2A\u4EBA\u5E76\u80A9\u7684\u4F4D\u7F6E\u3002",
      memoryEffect: "\u661F\u8F68\u56DE\u5FC6\uFF1A\u79FB\u52A8\u65F6\u7559\u4E0B\u8776\u7FFC\u661F\u7EBF\u3002"
    },
    {
      slot: "shoes",
      name: "\u6D41\u661F\u8F6F\u7CD6\u821E\u978B",
      slug: "shooting-star-candy-dance-shoes",
      flavorText: "\u6BCF\u4E00\u6B65\u90FD\u50CF\u8E29\u788E\u4E00\u9897\u8F6F\u7CD6\u6D41\u661F\uFF0C\u751C\u5F97\u8BA9\u4EBA\u820D\u4E0D\u5F97\u8D70\u5FEB\u3002",
      memoryEffect: "\u6D41\u661F\u56DE\u5FC6\uFF1A\u95EA\u907F\u65F6\u8FF8\u5F00\u7CD6\u6676\u661F\u70B9\u3002"
    },
    {
      slot: "body",
      name: "\u661F\u7CD6\u9B54\u5973\u6D1B\u4E3D\u5854\u88D9",
      slug: "star-sugar-witch-lolita-dress",
      flavorText: "\u5979\u628A\u6700\u6210\u529F\u7684\u751C\u70B9\u914D\u65B9\uFF0C\u7F1D\u8FDB\u4E86\u53EA\u4E3A\u8FD9\u6B21\u7EA6\u4F1A\u51C6\u5907\u7684\u88D9\u6446\u3002",
      memoryEffect: "\u661F\u7CD6\u56DE\u5FC6\uFF1A\u89D2\u8272\u5C55\u793A\u5207\u6362\u4E3A\u661F\u7CD6\u9B54\u5973\u793C\u88C5\u3002"
    },
    {
      slot: "weapon",
      name: "\u5FC3\u8679\u661F\u5319\u6CD5\u6756",
      slug: "heart-rainbow-star-key-staff",
      flavorText: "\u636E\u8BF4\u80FD\u6253\u5F00\u6240\u6709\u95E8\uFF0C\u5979\u5374\u53EA\u60F3\u7528\u5B83\u6253\u5F00\u4E24\u4E2A\u4EBA\u7684\u79D8\u5BC6\u57FA\u5730\u3002",
      memoryEffect: "\u5FC3\u8679\u56DE\u5FC6\uFF1A\u65BD\u6CD5\u751F\u6210\u94A5\u5319\u5F62\u8679\u8272\u661F\u9635\u3002"
    },
    {
      slot: "body",
      name: "\u94F6\u6CB3\u7EA6\u4F1A\u591C\u793C\u88D9",
      slug: "galaxy-date-evening-dress",
      flavorText: "\u88D9\u6446\u6536\u8FDB\u4E86\u6574\u7247\u94F6\u6CB3\uFF0C\u4E5F\u7ED9\u4F60\u7559\u4E86\u8EAB\u8FB9\u7684\u4E00\u5C0F\u5757\u4F4D\u7F6E\u3002",
      memoryEffect: "\u94F6\u6CB3\u56DE\u5FC6\uFF1A\u89D2\u8272\u5C55\u793A\u5207\u6362\u4E3A\u6708\u591C\u661F\u6CB3\u793C\u670D\u3002"
    },
    {
      slot: "weapon",
      name: "\u6026\u7136\u6708\u7CD6\u9B54\u6756",
      slug: "fluttering-moon-sugar-wand",
      flavorText: "\u6BCF\u5FF5\u9519\u4E00\u6B21\u5492\u8BED\uFF0C\u5C31\u4F1A\u8BDA\u5B9E\u5730\u5192\u51FA\u4E00\u9897\u5FC3\u5F62\u6708\u7CD6\u3002",
      memoryEffect: "\u6026\u7136\u56DE\u5FC6\uFF1A\u6280\u80FD\u547D\u4E2D\u7EFD\u5F00\u6708\u7CD6\u5FC3\u8679\u3002"
    }
  ]),
  ...classSpecs("shaman", "moon-sugar", [
    {
      slot: "head",
      name: "\u5B88\u613F\u7075\u8776\u82B1\u51A0",
      slug: "wish-guardian-butterfly-crown",
      flavorText: "\u7075\u8776\u53EA\u505C\u5728\u613F\u610F\u8BA4\u771F\u503E\u542C\u5F7C\u6B64\u5FC3\u613F\u7684\u4EBA\u8EAB\u8FB9\u3002",
      memoryEffect: "\u5B88\u613F\u56DE\u5FC6\uFF1A\u5F85\u673A\u65F6\u7075\u8776\u7ED5\u51A0\u4E00\u5468\u3002"
    },
    {
      slot: "necklace",
      name: "\u540C\u5FC3\u5FA1\u5B88\u9879\u94FE",
      slug: "kindred-omamori-necklace",
      flavorText: "\u6CA1\u6709\u5199\u59D3\u540D\u7684\u5FA1\u5B88\uFF0C\u5374\u4F1A\u5728\u4F60\u9760\u8FD1\u65F6\u53D1\u51FA\u6E29\u6696\u5FAE\u5149\u3002",
      memoryEffect: "\u540C\u5FC3\u56DE\u5FC6\uFF1A\u53D7\u51FB\u65F6\u6D6E\u73B0\u6708\u94F6\u5FA1\u5B88\u3002"
    },
    {
      slot: "bracelet",
      name: "\u5F52\u5DE2\u8776\u7FFC\u624B\u73AF",
      slug: "homebound-butterfly-bracelet",
      flavorText: "\u65E0\u8BBA\u7075\u8776\u98DE\u5F97\u591A\u8FDC\uFF0C\u6700\u540E\u90FD\u4F1A\u56DE\u5230\u719F\u6089\u7684\u624B\u8155\u65C1\u3002",
      memoryEffect: "\u5F52\u5DE2\u56DE\u5FC6\uFF1A\u4E92\u52A8\u540E\u7075\u8776\u56DE\u65CB\u505C\u9A7B\u3002"
    },
    {
      slot: "ring",
      name: "\u76F8\u5B88\u7948\u613F\u6212",
      slug: "together-prayer-ring",
      flavorText: "\u53CC\u80A1\u6708\u94F6\u4EA4\u53E0\uFF0C\u5374\u90FD\u4FDD\u7559\u7740\u5404\u81EA\u6E05\u6670\u7684\u7EB9\u8DEF\u3002",
      memoryEffect: "\u76F8\u5B88\u56DE\u5FC6\uFF1A\u66B4\u51FB\u65F6\u70B9\u4EAE\u53CC\u751F\u6708\u73AF\u3002"
    },
    {
      slot: "belt",
      name: "\u5B89\u68A6\u6D41\u82CF\u8170\u5C01",
      slug: "dream-tassel-belt",
      flavorText: "\u94C3\u58F0\u5F88\u8F7B\uFF0C\u521A\u597D\u80FD\u8BA9\u5669\u68A6\u505C\u4E0B\uFF0C\u53C8\u4E0D\u4F1A\u60CA\u9192\u8EAB\u8FB9\u7684\u4EBA\u3002",
      memoryEffect: "\u5B89\u68A6\u56DE\u5FC6\uFF1A\u79FB\u52A8\u65F6\u98D8\u843D\u84DD\u7D2B\u7075\u706B\u3002"
    },
    {
      slot: "shoes",
      name: "\u8E0F\u6708\u7075\u7EE3\u978B",
      slug: "moonstep-embroidered-shoes",
      flavorText: "\u978B\u5E95\u7EE3\u7740\u4E00\u8F6E\u5F2F\u6708\uFF0C\u966A\u5979\u628A\u6F2B\u957F\u591C\u8DEF\u8D70\u5F97\u5F88\u77ED\u3002",
      memoryEffect: "\u8E0F\u6708\u56DE\u5FC6\uFF1A\u95EA\u907F\u65F6\u7559\u4E0B\u6708\u5149\u8DB3\u8FF9\u3002"
    },
    {
      slot: "body",
      name: "\u7075\u8776\u7948\u613F\u534E\u793C\u670D",
      slug: "spirit-butterfly-prayer-ceremonial-dress",
      flavorText: "\u4E0D\u662F\u732E\u7ED9\u795E\u660E\u7684\u793C\u670D\uFF0C\u800C\u662F\u5979\u4E3A\u73CD\u60DC\u5F53\u4E0B\u4EB2\u81EA\u505A\u51FA\u7684\u9009\u62E9\u3002",
      memoryEffect: "\u7948\u613F\u56DE\u5FC6\uFF1A\u89D2\u8272\u5C55\u793A\u5207\u6362\u4E3A\u7075\u8776\u7948\u613F\u793C\u670D\u3002"
    },
    {
      slot: "weapon",
      name: "\u5FC3\u8679\u7948\u613F\u7075\u94C3",
      slug: "heart-rainbow-prayer-bell",
      flavorText: "\u94C3\u58F0\u8D8A\u8FC7\u98CE\u4E0E\u96E8\uFF0C\u53EA\u628A\u6700\u771F\u8BDA\u7684\u90A3\u4E00\u53E5\u9001\u5230\u4F60\u8033\u8FB9\u3002",
      memoryEffect: "\u5FC3\u8679\u56DE\u5FC6\uFF1A\u65BD\u6CD5\u8361\u5F00\u5FC3\u5F62\u8679\u8272\u94C3\u6CE2\u3002"
    },
    {
      slot: "body",
      name: "\u6708\u706F\u76F8\u5B88\u7EA6\u4F1A\u88D9",
      slug: "moon-lantern-date-dress",
      flavorText: "\u4E24\u76CF\u6708\u706F\u4E92\u76F8\u7167\u4EAE\uFF0C\u6B63\u5982\u540C\u884C\u7684\u4EBA\u4E0D\u5FC5\u8C01\u4F9D\u9644\u4E8E\u8C01\u3002",
      memoryEffect: "\u6708\u706F\u56DE\u5FC6\uFF1A\u89D2\u8272\u5C55\u793A\u5207\u6362\u4E3A\u6708\u706F\u7EA6\u4F1A\u793C\u88D9\u3002"
    },
    {
      slot: "weapon",
      name: "\u76F8\u5B88\u6708\u706F\u6CD5\u6247",
      slug: "together-moon-lantern-fan",
      flavorText: "\u6247\u9762\u4E24\u76CF\u706F\u59CB\u7EC8\u7B49\u8DDD\uFF0C\u5C55\u5F00\u65F6\u5374\u80FD\u7167\u4EAE\u540C\u4E00\u6761\u8DEF\u3002",
      memoryEffect: "\u76F8\u5B88\u56DE\u5FC6\uFF1A\u6280\u80FD\u5C55\u5F00\u6708\u706F\u8776\u7FFC\u8679\u9635\u3002"
    }
  ]),
  ...classSpecs("catkin", "berry-cream", [
    {
      slot: "head",
      name: "\u5FC3\u8DF3\u732B\u8033\u8774\u8776\u7ED3",
      slug: "heartbeat-cat-ear-bow",
      flavorText: "\u5979\u81EA\u5DF1\u6311\u7684\u642D\u6863\u5FBD\u8BB0\uFF0C\u6234\u597D\u540E\u8FD8\u88C5\u4F5C\u53EA\u662F\u987A\u624B\u3002",
      memoryEffect: "\u5FC3\u8DF3\u56DE\u5FC6\uFF1A\u5F85\u673A\u65F6\u8774\u8776\u7ED3\u6CDB\u8D77\u5FC3\u8679\u3002"
    },
    {
      slot: "necklace",
      name: "\u5FC3\u97F3\u94C3\u94DB\u9888\u94FE",
      slug: "heart-sound-bell-necklace",
      flavorText: "\u94C3\u94DB\u4ECE\u4E0D\u50AC\u4FC3\u8C01\u9760\u8FD1\uFF0C\u53EA\u5728\u5E76\u80A9\u5954\u8DD1\u65F6\u5FEB\u4E50\u5730\u54CD\u8D77\u3002",
      memoryEffect: "\u5FC3\u97F3\u56DE\u5FC6\uFF1A\u53D7\u51FB\u65F6\u54CD\u8D77\u77ED\u4FC3\u5B88\u62A4\u94C3\u3002"
    },
    {
      slot: "bracelet",
      name: "\u8089\u7403\u8F6F\u7CD6\u624B\u73AF",
      slug: "paw-gummy-bracelet",
      flavorText: "\u5979\u5206\u4F60\u4E00\u9897\u6700\u559C\u6B22\u7684\u8F6F\u7CD6\uFF0C\u53C8\u7ACB\u523B\u5F3A\u8C03\u8FD9\u53EA\u662F\u642D\u6863\u798F\u5229\u3002",
      memoryEffect: "\u8F6F\u7CD6\u56DE\u5FC6\uFF1A\u4E92\u52A8\u65F6\u8DF3\u51FA\u7C89\u8272\u8089\u7403\u661F\u3002"
    },
    {
      slot: "ring",
      name: "\u642D\u6863\u5FC3\u613F\u6212",
      slug: "partner-wish-ring",
      flavorText: "\u4E0D\u662F\u5360\u6709\u7684\u8BB0\u53F7\uFF0C\u800C\u662F\u968F\u65F6\u613F\u610F\u4E00\u8D77\u51FA\u53D1\u7684\u7EA6\u5B9A\u3002",
      memoryEffect: "\u642D\u6863\u56DE\u5FC6\uFF1A\u66B4\u51FB\u65F6\u95EA\u8FC7\u5E76\u80A9\u5FC3\u661F\u3002"
    },
    {
      slot: "belt",
      name: "\u871C\u7CD6\u5927\u8774\u8776\u8170\u5C01",
      slug: "honey-bow-belt",
      flavorText: "\u5927\u8774\u8776\u7ED3\u91CC\u85CF\u7740\u5907\u7528\u7CD6\u679C\uFF0C\u5F53\u7136\u4E5F\u6709\u7ED9\u4F60\u7684\u90A3\u4E00\u4EFD\u3002",
      memoryEffect: "\u871C\u7CD6\u56DE\u5FC6\uFF1A\u79FB\u52A8\u65F6\u98D8\u843D\u7126\u7CD6\u8272\u4E1D\u5E26\u3002"
    },
    {
      slot: "shoes",
      name: "\u4E91\u6735\u8089\u7403\u821E\u978B",
      slug: "cloud-paw-dance-shoes",
      flavorText: "\u843D\u5730\u50CF\u4E91\u6735\u4E00\u6837\u8F7B\uFF0C\u9002\u5408\u5192\u9669\uFF0C\u4E5F\u9002\u5408\u5077\u5077\u7EC3\u4E60\u53CC\u4EBA\u821E\u3002",
      memoryEffect: "\u4E91\u6735\u56DE\u5FC6\uFF1A\u95EA\u907F\u65F6\u8E0F\u51FA\u67D4\u8F6F\u8089\u7403\u5149\u5370\u3002"
    },
    {
      slot: "body",
      name: "\u871C\u7CD6\u732B\u8033\u6D1B\u4E3D\u5854\u88D9",
      slug: "honey-cat-lolita-dress",
      flavorText: "\u53EF\u7231\u4E0D\u662F\u547D\u4EE4\uFF0C\u800C\u662F\u5979\u4ECA\u5929\u5FC3\u60C5\u5F88\u597D\u65F6\u4E3B\u52A8\u505A\u51FA\u7684\u9009\u62E9\u3002",
      memoryEffect: "\u871C\u7CD6\u56DE\u5FC6\uFF1A\u89D2\u8272\u5C55\u793A\u5207\u6362\u4E3A\u871C\u7CD6\u732B\u8033\u793C\u88C5\u3002"
    },
    {
      slot: "weapon",
      name: "\u5FC3\u8679\u871C\u7CD6\u53CC\u722A",
      slug: "heart-rainbow-honey-claws",
      flavorText: "\u722A\u5203\u8D1F\u8D23\u5F00\u8DEF\uFF0C\u4E2D\u5FC3\u7684\u5FC3\u6676\u8D1F\u8D23\u63D0\u9192\u5979\u8EAB\u540E\u8FD8\u6709\u642D\u6863\u3002",
      memoryEffect: "\u5FC3\u8679\u56DE\u5FC6\uFF1A\u653B\u51FB\u4EA4\u9519\u51FA\u871C\u7CD6\u8679\u8272\u722A\u75D5\u3002"
    },
    {
      slot: "body",
      name: "\u6708\u4E0B\u55B5\u821E\u7EA6\u4F1A\u88D9",
      slug: "moonlit-cat-dance-dress",
      flavorText: "\u5979\u628A\u5C4B\u9876\u7684\u6708\u8272\u88C1\u8FDB\u88D9\u6446\uFF0C\u53EA\u95EE\u4F60\u4ECA\u665A\u8981\u4E0D\u8981\u591A\u5750\u4E00\u4F1A\u513F\u3002",
      memoryEffect: "\u6708\u821E\u56DE\u5FC6\uFF1A\u89D2\u8272\u5C55\u793A\u5207\u6362\u4E3A\u6708\u591C\u7EA6\u4F1A\u793C\u88D9\u3002"
    },
    {
      slot: "weapon",
      name: "\u6026\u7136\u94C3\u661F\u732B\u722A",
      slug: "flutter-bell-star-claws",
      flavorText: "\u94C3\u661F\u4F1A\u5728\u53CC\u722A\u76F8\u78B0\u65F6\u4EAE\u8D77\uFF0C\u50CF\u4E24\u4F4D\u642D\u6863\u9ED8\u5951\u7684\u51FB\u638C\u3002",
      memoryEffect: "\u6026\u7136\u56DE\u5FC6\uFF1A\u6280\u80FD\u547D\u4E2D\u8FF8\u5F00\u6708\u94C3\u5FC3\u8679\u3002"
    }
  ])
];
function affectionFixedAffixes(slot, level, collectionIndex) {
  return slotAffixKeys[slot].map((key) => ({
    key,
    value: affectionAffixValue(key, level, collectionIndex)
  }));
}
function affectionAffixValue(key, level, collectionIndex) {
  const levelScale = Math.pow(level, 1.3);
  const gradeScale = 0.9 + collectionIndex * 0.025;
  switch (key) {
    case "atk":
      return Math.max(1, Math.round(0.7 * levelScale * gradeScale));
    case "def":
      return Math.max(1, Math.round(0.55 * levelScale * gradeScale));
    case "hp":
      return Math.max(1, Math.round(7.5 * levelScale * gradeScale));
    case "acc":
      return Math.max(1, Math.round(0.95 * levelScale * gradeScale));
    case "eva":
      return Math.max(1, Math.round(0.8 * levelScale * gradeScale));
    case "critRate":
      return Math.round((2.8 + collectionIndex * 0.16) * 10) / 10;
    case "critDmg":
      return Math.round((9 + collectionIndex * 0.7) * 10) / 10;
    case "spd":
      return Math.round((0.04 + collectionIndex * 3e-3) * 100) / 100;
    default:
      throw new Error(`[\u914D\u7F6E\u9519\u8BEF] \u5FC3\u8679\u56FA\u5B9A\u8BCD\u6761\u4E0D\u652F\u6301\uFF1A${key}`);
  }
}
function buildDefinition(spec, collectionIndex) {
  const id = `eq_affection_${spec.classId}_${spec.slug}`;
  const appearanceId = spec.slot === "weapon" ? boutiqueAppearanceId(spec.appearanceTheme, spec.slot, spec.classId) : boutiqueAppearanceId(spec.appearanceTheme, spec.slot);
  const commonDefinition = {
    id,
    name: spec.name,
    quality: "prismatic",
    level: spec.level,
    icon: `assets/equipment/affection/${spec.classId}/${spec.slug}.png`,
    appearanceId,
    classId: spec.classId,
    // 复用已经过完整角色叠层与战斗验收的精品主题特效。
    // 这样心虹装备的“互动与攻击换肤”是实际运行效果，不是只写在描述里的承诺。
    boutiqueTheme: spec.appearanceTheme,
    fixedAffixes: affectionFixedAffixes(spec.slot, spec.level, collectionIndex),
    fixedTemplate: true,
    /*
     * 心虹珍藏额外开两个可洗练槽。
     *
     * 六条固定词条是这件装备的身份，一条都不该被洗掉；
     * 但如果完全不能洗练，玩家在好感上的长期投入会随装备过时而作废 ——
     * 那正是《上瘾》里「投入」环节最忌讳的事（见 docs/40 红线）。
     *
     * 两个槽的取值：既让心虹装备能跟着洗练系统一起成长，
     * 又不至于喧宾夺主盖过定向副本产出的主力装备。
     */
    extraAffixSlots: 2,
    uniqueEffect: `\u5FC3\u8679\u5171\u9E23\uFF1A\u6FC0\u6D3B\u300C${BOUTIQUE_THEMES[spec.appearanceTheme].name}\u300D\u89D2\u8272\u5916\u89C2\u3001\u4E92\u52A8\u7C92\u5B50\u4E0E\u653B\u51FB\u6362\u80A4\u3002`
  };
  const definition = spec.slot === "weapon" ? { ...commonDefinition, slot: spec.slot, element: "none" } : { ...commonDefinition, slot: spec.slot };
  return {
    classId: spec.classId,
    collectionIndex,
    unlockPoints: spec.unlockPoints,
    flavorText: spec.flavorText,
    definition
  };
}
var AFFECTION_EQUIPMENT_LIST = SPECS.map(
  (spec, index) => buildDefinition(spec, index % 10)
);
var AFFECTION_EQUIPMENT = Object.fromEntries(AFFECTION_EQUIPMENT_LIST.map((entry4) => [entry4.definition.id, entry4]));
function affectionEquipmentForClass(classId) {
  return AFFECTION_EQUIPMENT_LIST.filter((entry4) => entry4.classId === classId);
}
function affectionEquipmentIdsForClass(classId) {
  return affectionEquipmentForClass(classId).map((entry4) => entry4.definition.id);
}

// src/data/region5.ts
var REGION_5 = {
  id: "r5",
  index: 5,
  name: "\u7194\u5CA9\u795E\u6BBF",
  subtitle: "\u8D64\u91D1\u706B\u7EB9\u7167\u4EAE\u4E0D\u7184\u7684\u8A93\u7EA6",
  levelFrom: 40,
  levelTo: 52,
  theme: ["#f27a70", "#ffe5bd"],
  mapAsset: "assets/maps/r5.webp",
  chapters: [
    {
      id: "5-1",
      name: "\u7126\u571F\u5916\u73AF",
      levelFrom: 40,
      levelTo: 42,
      element: "fire",
      normals: ["\u7070\u70EC\u56E2\u5B50", "\u7194\u58F3\u8725\u7075", "\u706B\u661F\u98DE\u86FE", "\u7126\u5CA9\u7532\u866B"],
      materials: ["slag_lava", "shard_scorched"],
      tutorial: "\u708E\u5C5E\u6027\u602A\u7269\u767B\u573A\u3002\u653B\u51FB\u5143\u7D20\u4ECD\u53EA\u7531\u6B66\u5668\u51B3\u5B9A\uFF0C\u6362\u88C5\u524D\u53EF\u5148\u67E5\u770B\u6B66\u5668\u8BE6\u60C5\u3002",
      mapAsset: "assets/maps/chapter-5-1.webp",
      battleAsset: "assets/battlefields/chapter-5-1.webp"
    },
    {
      id: "5-2",
      name: "\u7194\u5CA9\u6865",
      levelFrom: 42,
      levelTo: 45,
      element: "fire",
      normals: ["\u5CA9\u6D46\u53F2\u83B1\u59C6", "\u706B\u7FBD\u8760\u7075", "\u7EA2\u6676\u5B88\u536B", "\u94FE\u6865\u706B\u94C3"],
      elite: "\u7194\u5CA9\u536B\u5A18",
      materials: ["slag_lava", "shard_scorched", "ember_ritual"],
      mapAsset: "assets/maps/chapter-5-2.webp",
      battleAsset: "assets/battlefields/chapter-5-2.webp"
    },
    {
      id: "5-3",
      name: "\u795E\u6BBF\u524D\u5EAD",
      levelFrom: 45,
      levelTo: 47,
      element: "fire",
      normals: ["\u7948\u706B\u706F\u7075", "\u8D64\u7EB9\u77F3\u50CF", "\u9999\u7070\u72D0\u7075", "\u91D1\u7130\u7532\u5175"],
      materials: ["slag_lava", "shard_scorched"],
      mapAsset: "assets/maps/chapter-5-3.webp",
      battleAsset: "assets/battlefields/chapter-5-3.webp"
    },
    {
      id: "5-4",
      name: "\u796D\u706B\u5927\u5385",
      levelFrom: 47,
      levelTo: 50,
      element: "fire",
      normals: ["\u706B\u7EB1\u4F8D\u4ECE", "\u796D\u76D8\u7CBE\u7075", "\u70DB\u51A0\u706B\u7075", "\u8D64\u7EF8\u821E\u7075"],
      elite: "\u8D64\u7EA2\u795E\u5B98",
      materials: ["slag_lava", "shard_scorched", "ember_ritual"],
      mapAsset: "assets/maps/chapter-5-4.webp",
      battleAsset: "assets/battlefields/chapter-5-4.webp"
    },
    {
      id: "5-5",
      name: "\u7194\u5FC3\u5723\u6240",
      levelFrom: 50,
      levelTo: 52,
      element: "fire",
      normals: ["\u7194\u5FC3\u5B88\u536B", "\u7130\u7FBD\u5723\u7075", "\u91D1\u77B3\u706B\u86C7", "\u8A93\u706B\u4F8D\u5973"],
      elite: "\u7194\u5FC3\u5723\u4F8D",
      boss: "\u708E\u795E\u5B98\u957F\xB7\u7EF4\u65AF\u5854",
      materials: ["slag_lava", "shard_scorched", "ember_ritual", "core_moltenheart"],
      mapAsset: "assets/maps/chapter-5-5.webp",
      battleAsset: "assets/battlefields/chapter-5-5.webp"
    }
  ]
};
var REGION_5_EQUIPMENT_THEME = {
  regionId: "r5",
  themeName: "\u7EEF\u91D1\u706B\u7EB9\u7CFB",
  level: 46,
  qualities: ["rare", "epic", "legendary"],
  visualKeywords: ["\u8D64\u7EA2", "\u938F\u91D1", "\u706B\u7EB9", "\u900F\u660E\u7194\u6676"],
  names: {
    weapon: "\u7EEF\u91D1\u8A93\u5203",
    head: "\u706B\u7EB9\u796D\u51A0",
    body: "\u8D64\u7130\u796D\u793C\u88D9",
    necklace: "\u4F59\u70EC\u5FC3\u5760",
    bracelet: "\u7194\u7EB9\u62A4\u8155",
    ring: "\u8A93\u706B\u91D1\u6212",
    belt: "\u8D64\u91D1\u7EF6\u5E26",
    shoes: "\u7130\u6B65\u77ED\u9774"
  },
  weaponNames: {
    swordsman: "\u7EEF\u91D1\u8A93\u5203",
    witch: "\u7194\u6676\u7130\u5FC3\u6756",
    shaman: "\u8D64\u7FBD\u796D\u706B\u6247",
    catkin: "\u7EEF\u7130\u88C2\u6676\u722A"
  }
};
var REGION_5_SET_ID = "set_region_crimson";
var REGION_5_SET_LEVEL = 50;
var REGION_5_SET_QUALITY = "legendary";
var REGION_5_SET_SLOTS = [
  "weapon",
  "head",
  "body",
  "necklace",
  "ring",
  "bracelet"
];
var REGION_5_SET_NAMES = {
  weapon: "\u7EF4\u65AF\u5854\u8A93\u7130\u5203",
  head: "\u7EEF\u7130\u5723\u51A0",
  body: "\u7EEF\u7130\u8A93\u7EA6\u793C\u88C5",
  necklace: "\u7194\u5FC3\u8A93\u5760",
  ring: "\u4E0D\u706D\u7130\u6212",
  bracelet: "\u8D64\u91D1\u7130\u62A4"
};
var REGION_5_SET_WEAPON_NAMES = {
  swordsman: "\u7EF4\u65AF\u5854\u8A93\u7130\u5203",
  witch: "\u7EF4\u65AF\u5854\u7130\u5FC3\u6756",
  shaman: "\u7EF4\u65AF\u5854\u71CE\u5929\u6247",
  catkin: "\u7EF4\u65AF\u5854\u7130\u7FBD\u722A"
};
function region5SetEquipmentId(slot) {
  return `eq_set_region_crimson_${slot}`;
}
var REGION_5_MONSTER_MOTIONS = {
  "mon_5-1_0": "bounce",
  "mon_5-1_1": "hopper",
  "mon_5-1_2": "flutter",
  "mon_5-1_3": "guard",
  "mon_5-2_0": "bounce",
  "mon_5-2_1": "flutter",
  "mon_5-2_2": "guard",
  "mon_5-2_3": "sway",
  "mon_5-2_elite": "royal",
  "mon_5-3_0": "flutter",
  "mon_5-3_1": "guard",
  "mon_5-3_2": "hopper",
  "mon_5-3_3": "guard",
  "mon_5-4_0": "sway",
  "mon_5-4_1": "bounce",
  "mon_5-4_2": "flutter",
  "mon_5-4_3": "sway",
  "mon_5-4_elite": "royal",
  "mon_5-5_0": "guard",
  "mon_5-5_1": "flutter",
  "mon_5-5_2": "hopper",
  "mon_5-5_3": "sway",
  "mon_5-5_elite": "guard",
  "mon_5-5_boss": "royal"
};

// src/data/arenaEquipment.ts
var ARENA_SET_ID = "set_arena_stigma";
var ARENA_EQUIPMENT_LEVEL = REGION_5_SET_LEVEL + 10;
var ARENA_EQUIPMENT_SET = {
  id: ARENA_SET_ID,
  name: "\u5723\u75D5\u5957",
  pieceSlots: ["weapon", "head", "body", "ring"],
  bonuses: [
    {
      pieces: 2,
      label: "\u88C1\u51B3\u5723\u5370",
      description: "\u653B\u51FB +8%\uFF08\u4EC5\u7ADE\u6280\u573A\u5185\u751F\u6548\uFF09",
      statPercent: { atk: 0.08 }
    },
    {
      pieces: 4,
      label: "\u51A0\u5195\u5723\u57DF",
      description: "\u653B\u51FB +8%\u3001\u51CF\u4F24 +10%\uFF08\u4EC5\u7ADE\u6280\u573A\u5185\u751F\u6548\uFF1B\u9632\u5B88\u65B9\u989D\u5916 +5% \u51CF\u4F24\uFF09",
      statPercent: { atk: 0.08 },
      combatBonuses: { damageReduction: 10 }
    }
  ]
};
var SPECS2 = [
  // ── 剑姬 · 凯旋 ──
  { classId: "swordsman", slot: "weapon", name: "\u5723\u75D5\xB7\u51EF\u65CB\xB7\u88C1\u51B3\u4E4B\u5251", slug: "triumph-verdict-blade", series: "\u51EF\u65CB" },
  { classId: "swordsman", slot: "head", name: "\u5723\u75D5\xB7\u51EF\u65CB\xB7\u8363\u51A0", slug: "triumph-laurel-crown", series: "\u51EF\u65CB" },
  { classId: "swordsman", slot: "body", name: "\u5723\u75D5\xB7\u51EF\u65CB\xB7\u6218\u62AB", slug: "triumph-battle-mantle", series: "\u51EF\u65CB" },
  { classId: "swordsman", slot: "ring", name: "\u5723\u75D5\xB7\u51EF\u65CB\xB7\u8A93\u7EA6\u6307\u73AF", slug: "triumph-oath-ring", series: "\u51EF\u65CB" },
  // ── 魔女 · 裁星 ──
  { classId: "witch", slot: "weapon", name: "\u5723\u75D5\xB7\u88C1\u661F\xB7\u5929\u5E73\u6CD5\u6756", slug: "starjudge-scale-staff", series: "\u88C1\u661F" },
  { classId: "witch", slot: "head", name: "\u5723\u75D5\xB7\u88C1\u661F\xB7\u89C2\u661F\u51A0", slug: "starjudge-observatory-crown", series: "\u88C1\u661F" },
  { classId: "witch", slot: "body", name: "\u5723\u75D5\xB7\u88C1\u661F\xB7\u661F\u8F68\u957F\u888D", slug: "starjudge-orbit-robe", series: "\u88C1\u661F" },
  { classId: "witch", slot: "ring", name: "\u5723\u75D5\xB7\u88C1\u661F\xB7\u6052\u661F\u6307\u73AF", slug: "starjudge-fixedstar-ring", series: "\u88C1\u661F" },
  // ── 灵巫 · 神谕 ──
  { classId: "shaman", slot: "weapon", name: "\u5723\u75D5\xB7\u795E\u8C15\xB7\u7075\u94C3\u6756", slug: "oracle-spirit-bell-staff", series: "\u795E\u8C15" },
  { classId: "shaman", slot: "head", name: "\u5723\u75D5\xB7\u795E\u8C15\xB7\u796D\u51A0", slug: "oracle-rite-crown", series: "\u795E\u8C15" },
  { classId: "shaman", slot: "body", name: "\u5723\u75D5\xB7\u795E\u8C15\xB7\u5DEB\u795D\u793C\u8863", slug: "oracle-ritual-vestment", series: "\u795E\u8C15" },
  { classId: "shaman", slot: "ring", name: "\u5723\u75D5\xB7\u795E\u8C15\xB7\u5951\u7075\u6307\u73AF", slug: "oracle-pact-ring", series: "\u795E\u8C15" },
  // ── 喵喵 · 疾影 ──
  { classId: "catkin", slot: "weapon", name: "\u5723\u75D5\xB7\u75BE\u5F71\xB7\u53CC\u5F26\u722A", slug: "swiftshadow-twin-claws", series: "\u75BE\u5F71" },
  { classId: "catkin", slot: "head", name: "\u5723\u75D5\xB7\u75BE\u5F71\xB7\u591C\u730E\u8033\u9970", slug: "swiftshadow-nighthunt-ears", series: "\u75BE\u5F71" },
  { classId: "catkin", slot: "body", name: "\u5723\u75D5\xB7\u75BE\u5F71\xB7\u6F5C\u884C\u6218\u8863", slug: "swiftshadow-stalker-suit", series: "\u75BE\u5F71" },
  { classId: "catkin", slot: "ring", name: "\u5723\u75D5\xB7\u75BE\u5F71\xB7\u8FC5\u6377\u6307\u73AF", slug: "swiftshadow-agile-ring", series: "\u75BE\u5F71" }
];
function arenaAppearanceId(classId, slot) {
  return `arena-${classId}-${slot}`;
}
function buildDefinition2(spec) {
  const common = {
    id: `eq_arena_${spec.classId}_${spec.slug}`,
    name: spec.name,
    quality: "divine",
    level: ARENA_EQUIPMENT_LEVEL,
    setId: ARENA_SET_ID,
    classId: spec.classId,
    icon: `assets/equipment/arena/${spec.classId}/${spec.slug}.png`,
    appearanceId: arenaAppearanceId(spec.classId, spec.slot),
    uniqueEffect: `\u5723\u75D5\u5957\u88C5\uFF08${spec.series}\u7CFB\u5217\uFF09\uFF1A\u96C6\u9F50 2 / 4 \u4EF6\u5728\u7ADE\u6280\u573A\u5185\u6FC0\u6D3B\u5957\u88C5\u6548\u679C\uFF1B\u7ADE\u6280\u573A\u4E4B\u5916\u5957\u88C5\u6548\u679C\u4E0D\u751F\u6548\u3002`
  };
  return spec.slot === "weapon" ? { ...common, slot: spec.slot, element: "none" } : { ...common, slot: spec.slot };
}
var ARENA_EQUIPMENT_LIST = SPECS2.map(buildDefinition2);
var ARENA_EQUIPMENT = Object.fromEntries(
  ARENA_EQUIPMENT_LIST.map((definition) => [definition.id, definition])
);

// src/data/weaponElements.ts
var REGION_WEAPON_ELEMENTS = {
  r1: "none",
  r2: "fire",
  r3: "fire",
  r4: "none",
  r5: "fire",
  // 幽影祀塔以雷属性怪为主，R6 冰武器提供下一段明确的克制来源。
  r6: "ice"
};
var BOUTIQUE_WEAPON_ELEMENTS = {
  "berry-cream": "fire",
  "moon-sugar": "ice",
  "rose-night": "thunder",
  "cardboard-cat": "none"
};
var EQUIPMENT_DUNGEON_WEAPON_ELEMENTS = {
  azure: "ice",
  violet: "thunder",
  auric: "fire",
  crimson: "thunder"
};

// src/data/equipmentDungeonGear.ts
var EQUIPMENT_DUNGEON_TIERS = [
  {
    id: "azure",
    name: "\u6674\u84DD\u68A6\u5323",
    shortName: "\u84DD\u8272\u7A00\u6709",
    quality: "rare",
    level: 16,
    unlockLevel: 16,
    color: "#4f9fff",
    glow: "#b9e7ff",
    setId: "set_dungeon_azure",
    setName: "\u6674\u84DD\u8336\u4F1A",
    effectLabel: "\u6674\u84DD\u7CD6\u6676\u4E0E\u7EC6\u5C0F\u6CE1\u6CE1"
  },
  {
    id: "violet",
    name: "\u6708\u7D2B\u661F\u5323",
    shortName: "\u7D2B\u8272\u53F2\u8BD7",
    quality: "epic",
    level: 31,
    unlockLevel: 31,
    color: "#a96cff",
    glow: "#ead8ff",
    setId: "set_dungeon_violet",
    setName: "\u6708\u7D2B\u661F\u5BB4",
    effectLabel: "\u6708\u5154\u661F\u7802\u4E0E\u65B0\u6708\u8F68\u8FF9"
  },
  {
    id: "auric",
    name: "\u7425\u73C0\u8537\u8587\u5323",
    shortName: "\u6A59\u8272\u4F20\u8BF4",
    quality: "legendary",
    level: 56,
    unlockLevel: 56,
    color: "#ffab45",
    glow: "#ffe5a8",
    setId: "set_dungeon_auric",
    setName: "\u7425\u73C0\u8537\u8587\u738B\u5EAD",
    effectLabel: "\u91D1\u8272\u8537\u8587\u4E0E\u6696\u5149\u661F\u5C18"
  },
  {
    id: "crimson",
    name: "\u7EEF\u6A31\u5178\u85CF\u5323",
    shortName: "\u7EA2\u8272\u5178\u85CF\u73CD\u54C1",
    quality: "mythic",
    level: 81,
    unlockLevel: 81,
    color: "#ff4f72",
    glow: "#ffd1dc",
    setId: "set_dungeon_crimson",
    setName: "\u7EEF\u6A31\u5178\u85CF",
    effectLabel: "\u8D64\u91D1\u6A31\u74E3\u3001\u5178\u85CF\u661F\u73AF\u4E0E\u7EEF\u7EA2\u8F89\u5149"
  }
];
var TIER_BY_ID = Object.fromEntries(
  EQUIPMENT_DUNGEON_TIERS.map((tier) => [tier.id, tier])
);
var CLASS_GEAR = {
  swordsman: {
    weaponNoun: "\u8A93\u7EA6\u82B1\u5251",
    dressNoun: "\u9A91\u58EB\u59EC\u793C\u88D9",
    weaponVisualKey: "weapon-swordsman",
    bodyVisualKey: "body-swordsman",
    weaponAffix: "atk",
    bodyAffix: "def",
    attackCopy: "\u82B1\u74E3\u6CBF\u5251\u5F27\u9010\u6BB5\u4EAE\u8D77",
    interactionCopy: "\u63D0\u88D9\u884C\u9A91\u58EB\u793C\uFF0C\u5251\u7A57\u5316\u6210\u4E00\u5708\u5C0F\u6A31\u82B1"
  },
  witch: {
    weaponNoun: "\u661F\u5319\u6CD5\u6756",
    dressNoun: "\u9B54\u5973\u6D1B\u4E3D\u5854\u88D9",
    weaponVisualKey: "weapon-witch",
    bodyVisualKey: "body-witch",
    weaponAffix: "critDmg",
    bodyAffix: "eva",
    attackCopy: "\u661F\u5319\u5C55\u5F00\u7CD6\u6676\u6CD5\u9635\u4E0E\u5C0F\u6D41\u661F",
    interactionCopy: "\u8F7B\u70B9\u5E3D\u6A90\uFF0C\u88D9\u6446\u4E0B\u6D6E\u8D77\u4E00\u5708\u8FF7\u4F60\u661F\u7403"
  },
  shaman: {
    weaponNoun: "\u7948\u613F\u7075\u94C3",
    dressNoun: "\u7948\u7075\u534E\u793C\u670D",
    weaponVisualKey: "weapon-shaman",
    bodyVisualKey: "body-shaman",
    weaponAffix: "acc",
    bodyAffix: "hp",
    attackCopy: "\u94C3\u97F3\u5316\u4F5C\u8774\u8776\u4E0E\u67D4\u5149\u6CE2\u7EB9",
    interactionCopy: "\u53CC\u624B\u7948\u613F\uFF0C\u8863\u8896\u95F4\u98DE\u51FA\u5B88\u62A4\u7075\u8776"
  },
  catkin: {
    weaponNoun: "\u7CD6\u6676\u53CC\u722A",
    dressNoun: "\u732B\u8033\u5C0F\u793C\u88D9",
    weaponVisualKey: "weapon-catkin",
    bodyVisualKey: "body-catkin",
    weaponAffix: "spd",
    bodyAffix: "eva",
    attackCopy: "\u4EA4\u9519\u722A\u75D5\u4E2D\u592E\u5F39\u51FA\u732B\u722A\u661F\u5370",
    interactionCopy: "\u4FCF\u76AE\u8F6C\u8EAB\uFF0C\u5C3E\u7AEF\u7559\u4E0B\u77ED\u6682\u5FC3\u5F62\u5149\u8FF9"
  }
};
var TIER_CLASS_PREFIX = {
  azure: {
    swordsman: "\u6674\u84DD\u8336\u4F1A",
    witch: "\u6674\u84DD\u7CD6\u661F",
    shaman: "\u6674\u84DD\u7948\u613F",
    catkin: "\u6674\u84DD\u732B\u7CD6"
  },
  violet: {
    swordsman: "\u6708\u7D2B\u8A93\u7EA6",
    witch: "\u6708\u7D2B\u661F\u4EEA",
    shaman: "\u6708\u7D2B\u7977\u6B4C",
    catkin: "\u6708\u7D2B\u5154\u5F71"
  },
  auric: {
    swordsman: "\u7425\u73C0\u738B\u5EAD",
    witch: "\u7425\u73C0\u5929\u7A79",
    shaman: "\u7425\u73C0\u5723\u6B4C",
    catkin: "\u7425\u73C0\u8537\u8587"
  },
  crimson: {
    swordsman: "\u7EEF\u6A31\u5178\u85CF",
    witch: "\u7EEF\u6A31\u79D8\u85CF",
    shaman: "\u7EEF\u6A31\u5723\u85CF",
    catkin: "\u7EEF\u6A31\u73CD\u85CF"
  }
};
var SHARED_VARIANTS = {
  head: [
    {
      suffix: "\u661F\u7EB1\u82B1\u51A0",
      visualKey: "head-starlace",
      affix: "critRate",
      effect: "\u82B1\u51A0\u4E0A\u4F9D\u6B21\u70B9\u4EAE\u4E09\u9897\u5C0F\u661F"
    },
    {
      suffix: "\u5B88\u68A6\u5C0F\u793C\u5E3D",
      visualKey: "head-dreamhat",
      affix: "hp",
      effect: "\u5E3D\u6A90\u5782\u4E0B\u67D4\u8F6F\u7684\u5B88\u62A4\u5149\u7EB1"
    }
  ],
  necklace: [
    {
      suffix: "\u5FC3\u9501\u9879\u94FE",
      visualKey: "necklace-heart",
      affix: "atk",
      effect: "\u5FC3\u9501\u968F\u653B\u51FB\u8282\u594F\u95EA\u51FA\u7EC6\u5C0F\u5149\u70B9"
    },
    {
      suffix: "\u5B88\u62A4\u6708\u5760",
      visualKey: "necklace-moon",
      affix: "hp",
      effect: "\u6708\u5760\u5728\u53D7\u51FB\u65F6\u6CDB\u8D77\u4E00\u5708\u67D4\u5149"
    }
  ],
  bracelet: [
    {
      suffix: "\u8776\u7FFC\u624B\u73AF",
      visualKey: "bracelet-butterfly",
      affix: "acc",
      effect: "\u624B\u8FB9\u52A8\u4F5C\u4F1A\u5E26\u51FA\u4E24\u53EA\u77ED\u6682\u5149\u8776"
    },
    {
      suffix: "\u8537\u8587\u62A4\u8155",
      visualKey: "bracelet-rose",
      affix: "def",
      effect: "\u62A4\u8155\u8FB9\u7F18\u7EFD\u5F00\u4E00\u6735\u8FF7\u4F60\u8537\u8587"
    }
  ],
  ring: [
    {
      suffix: "\u661F\u613F\u5B9D\u6212",
      visualKey: "ring-star",
      affix: "critDmg",
      effect: "\u66B4\u51FB\u6F14\u51FA\u4F1A\u591A\u51FA\u4E00\u9897\u62D6\u5C3E\u661F"
    },
    {
      suffix: "\u5B88\u68A6\u6676\u6212",
      visualKey: "ring-guard",
      affix: "eva",
      effect: "\u95EA\u907F\u65F6\u7559\u4E0B\u6676\u83B9\u7684\u73AF\u5F62\u6B8B\u5149"
    }
  ],
  belt: [
    {
      suffix: "\u5BB4\u4F1A\u8774\u8776\u8170\u5C01",
      visualKey: "belt-bow",
      affix: "def",
      effect: "\u5927\u8774\u8776\u7ED3\u968F\u89D2\u8272\u52A8\u4F5C\u8F7B\u8F7B\u6446\u52A8"
    },
    {
      suffix: "\u661F\u5E55\u675F\u5E26",
      visualKey: "belt-starlight",
      affix: "hp",
      effect: "\u8170\u95F4\u661F\u5E55\u968F\u547C\u5438\u660E\u6697\u53D8\u5316"
    }
  ],
  shoes: [
    {
      suffix: "\u661F\u5C51\u821E\u978B",
      visualKey: "shoes-stardust",
      affix: "spd",
      effect: "\u811A\u6B65\u7559\u4E0B\u77ED\u6682\u7684\u661F\u5C51\u4E0E\u5C0F\u82B1"
    },
    {
      suffix: "\u5B88\u68A6\u5706\u5934\u978B",
      visualKey: "shoes-ribbon",
      affix: "eva",
      effect: "\u978B\u8DDF\u843D\u5730\u65F6\u5F39\u51FA\u67D4\u8F6F\u4E1D\u5E26\u5149\u6591"
    }
  ]
};
var TIER_SHARED_PREFIX = {
  azure: "\u6674\u84DD",
  violet: "\u6708\u7D2B",
  auric: "\u7425\u73C0",
  crimson: "\u7EEF\u6A31\u5178\u85CF"
};
var PERCENT_AFFIX_BASE = {
  critRate: [1.2, 1.8, 2.4, 3],
  critDmg: [5, 8, 11, 14],
  spd: [0.02, 0.03, 0.04, 0.05]
};
function tierRank(tier) {
  return EQUIPMENT_DUNGEON_TIERS.findIndex((candidate) => candidate.id === tier.id);
}
function fixedAffix(key, tier) {
  const rank = tierRank(tier);
  const levelScale = Math.pow(tier.level, 1.3);
  let value;
  switch (key) {
    case "atk":
      value = Math.round(levelScale * (0.5 + rank * 0.05));
      break;
    case "def":
      value = Math.round(levelScale * (0.38 + rank * 0.04));
      break;
    case "hp":
      value = Math.round(levelScale * (4.5 + rank * 0.45));
      break;
    case "acc":
      value = Math.round(levelScale * (0.65 + rank * 0.05));
      break;
    case "eva":
      value = Math.round(levelScale * (0.55 + rank * 0.05));
      break;
    case "critRate":
    case "critDmg":
    case "spd":
      value = PERCENT_AFFIX_BASE[key][rank];
      break;
    default:
      throw new Error(`[\u914D\u7F6E\u9519\u8BEF] \u88C5\u5907\u526F\u672C\u56FA\u5B9A\u8BCD\u6761\u4E0D\u652F\u6301 ${key}`);
  }
  return { key, value };
}
function iconPath(tierId, visualKey) {
  return `assets/equipment/dungeon/${tierId}/${visualKey}.png`;
}
function equipmentDungeonAppearanceId(tierId, slot) {
  return `dungeon-${tierId}-${slot}`;
}
function buildClassGear(tier, classId, slot) {
  const classSpec = CLASS_GEAR[classId];
  const visualKey = slot === "weapon" ? classSpec.weaponVisualKey : classSpec.bodyVisualKey;
  const affixKey = slot === "weapon" ? classSpec.weaponAffix : classSpec.bodyAffix;
  const noun = slot === "weapon" ? classSpec.weaponNoun : classSpec.dressNoun;
  const effect = slot === "weapon" ? classSpec.attackCopy : classSpec.interactionCopy;
  const common = {
    id: `eq_dungeon_${tier.id}_${slot}_${classId}`,
    name: `${TIER_CLASS_PREFIX[tier.id][classId]}\xB7${noun}`,
    quality: tier.quality,
    level: tier.level,
    setId: tier.setId,
    classId,
    icon: iconPath(tier.id, visualKey),
    appearanceId: equipmentDungeonAppearanceId(tier.id, slot),
    fixedAffixes: [fixedAffix(affixKey, tier)],
    uniqueEffect: `\u4E13\u5C5E\u89C6\u89C9\uFF1A${effect}\uFF0C\u5E76\u4F34\u968F${tier.effectLabel}\u3002`
  };
  return slot === "weapon" ? { ...common, slot, element: EQUIPMENT_DUNGEON_WEAPON_ELEMENTS[tier.id] } : { ...common, slot };
}
function buildSharedGear(tier, slot, variant, index) {
  return {
    id: `eq_dungeon_${tier.id}_${slot}_${index + 1}`,
    name: `${TIER_SHARED_PREFIX[tier.id]}\xB7${variant.suffix}`,
    slot,
    quality: tier.quality,
    level: tier.level,
    setId: tier.setId,
    icon: iconPath(tier.id, variant.visualKey),
    appearanceId: equipmentDungeonAppearanceId(tier.id, slot),
    fixedAffixes: [fixedAffix(variant.affix, tier)],
    uniqueEffect: `\u4E13\u5C5E\u89C6\u89C9\uFF1A${variant.effect}\uFF0C\u5E76\u4F34\u968F${tier.effectLabel}\u3002`
  };
}
function buildEquipmentDungeonGear() {
  const out = {};
  for (const tier of EQUIPMENT_DUNGEON_TIERS) {
    for (const classId of CLASS_IDS) {
      for (const slot of ["weapon", "body"]) {
        const definition = buildClassGear(tier, classId, slot);
        out[definition.id] = definition;
      }
    }
    for (const [slot, variants] of Object.entries(SHARED_VARIANTS)) {
      variants.forEach((variant, index) => {
        const definition = buildSharedGear(tier, slot, variant, index);
        out[definition.id] = definition;
      });
    }
  }
  return out;
}
var EQUIPMENT_DUNGEON_GEAR = buildEquipmentDungeonGear();
var EQUIPMENT_DUNGEON_GEAR_LIST = Object.values(EQUIPMENT_DUNGEON_GEAR);
function requireEquipmentDungeonTier(tierId) {
  const tier = TIER_BY_ID[tierId];
  if (!tier) throw new Error(`[\u914D\u7F6E\u9519\u8BEF] \u88C5\u5907\u526F\u672C\u54C1\u8D28\u6863\u4E0D\u5B58\u5728\uFF1A${tierId}`);
  return tier;
}
function equipmentDungeonGearFor(tierId, slot, classId) {
  return EQUIPMENT_DUNGEON_GEAR_LIST.filter(
    (definition) => definition.quality === requireEquipmentDungeonTier(tierId).quality && definition.slot === slot && (classId === void 0 || definition.classId === void 0 || definition.classId === classId)
  );
}

// src/data/region34.ts
var REGION_3 = {
  id: "r3",
  index: 3,
  name: "\u866B\u5A18\u6D1E\u7A9F",
  subtitle: "\u83CC\u706F\u7167\u4EAE\u4F1A\u547C\u5438\u7684\u5730\u4E0B\u79D8\u5883",
  levelFrom: 20,
  levelTo: 30,
  theme: ["#8edfc9", "#dff9f0"],
  mapAsset: "assets/maps/r3.webp",
  chapters: [
    {
      id: "3-1",
      name: "\u6D1E\u7A9F\u5165\u53E3",
      levelFrom: 20,
      levelTo: 22,
      element: "ice",
      normals: ["\u5CA9\u7532\u866B\u5A18", "\u706F\u7B3C\u86FE\u7075", "\u82D4\u85D3\u8717\u725B", "\u6C34\u6676\u8681\u5175"],
      materials: ["chitin_wing", "moss_cave"],
      tutorial: "\u866B\u5A18\u504F\u51B0\u5C5E\u6027\u3002\u6362\u4E0A\u708E\u5C5E\u6027\u6B66\u5668\u540E\uFF0C\u6302\u673A\u51FB\u6740\u4F1A\u660E\u663E\u66F4\u5FEB\u3002",
      mapAsset: "assets/maps/chapter-3-1.webp",
      battleAsset: "assets/battlefields/chapter-3-1.webp"
    },
    {
      id: "3-2",
      name: "\u86DB\u7F51\u56DE\u5ECA",
      levelFrom: 22,
      levelTo: 24,
      element: "ice",
      normals: ["\u4E1D\u56CA\u86DB\u7075", "\u94F6\u7EBF\u86FE\u5A18", "\u7F51\u5DE2\u4FA6\u5BDF\u86DB", "\u8327\u706F\u7CBE"],
      elite: "\u7EC7\u7F51\u86DB\u5A18",
      materials: ["chitin_wing", "moss_cave", "silk_spider"],
      mapAsset: "assets/maps/chapter-3-2.webp",
      battleAsset: "assets/battlefields/chapter-3-2.webp"
    },
    {
      id: "3-3",
      name: "\u5E7D\u5149\u83CC\u9053",
      levelFrom: 24,
      levelTo: 26,
      element: "ice",
      normals: ["\u8367\u4F1E\u83C7\u5A18", "\u5B62\u5B50\u56E2\u5B50", "\u84DD\u6676\u8815\u7075", "\u83CC\u706F\u7532\u866B"],
      materials: ["chitin_wing", "moss_cave"],
      mapAsset: "assets/maps/chapter-3-3.webp",
      battleAsset: "assets/battlefields/chapter-3-3.webp"
    },
    {
      id: "3-4",
      name: "\u5730\u5E95\u6E56\u7554",
      levelFrom: 26,
      levelTo: 28,
      element: "ice",
      normals: ["\u6C34\u8424\u866B\u7075", "\u6D1E\u6E56\u87BA\u5A18", "\u51B0\u58F3\u6C34\u86A4", "\u6708\u7EB9\u877E\u8788"],
      materials: ["chitin_wing", "moss_cave"],
      mapAsset: "assets/maps/chapter-3-4.webp",
      battleAsset: "assets/battlefields/chapter-3-4.webp"
    },
    {
      id: "3-5",
      name: "\u866B\u6BCD\u5DE2\u7A74",
      levelFrom: 28,
      levelTo: 30,
      element: "ice",
      normals: ["\u62A4\u5375\u7532\u866B", "\u5DE2\u871C\u8815\u866B", "\u738B\u7EB9\u98DE\u86FE", "\u5375\u58F3\u5B88\u536B"],
      elite: "\u866B\u5DE2\u8FD1\u536B",
      boss: "\u866B\u6BCD\xB7\u7F07\u5A05",
      materials: ["chitin_wing", "moss_cave", "silk_spider", "egg_broodmother"],
      mapAsset: "assets/maps/chapter-3-5.webp",
      battleAsset: "assets/battlefields/chapter-3-5.webp"
    }
  ]
};
var REGION_4 = {
  id: "r4",
  index: 4,
  name: "\u6708\u4E0B\u5893\u56ED",
  subtitle: "\u6708\u5149\u66FF\u957F\u7720\u8005\u5B88\u7740\u5B89\u9759\u7684\u82B1",
  levelFrom: 30,
  levelTo: 40,
  theme: ["#b7c9ff", "#eeeaff"],
  mapAsset: "assets/maps/r4.webp",
  chapters: [
    {
      id: "4-1",
      name: "\u5893\u56ED\u94C1\u95E8",
      levelFrom: 30,
      levelTo: 32,
      element: "none",
      normals: ["\u63D0\u706F\u5C0F\u5E7D\u7075", "\u9508\u7532\u9AB7\u9AC5", "\u6708\u89C1\u8349\u7075", "\u94C1\u95E8\u77F3\u50CF"],
      materials: ["dust_bone", "herb_moonlit"],
      mapAsset: "assets/maps/chapter-4-1.webp",
      battleAsset: "assets/battlefields/chapter-4-1.webp"
    },
    {
      id: "4-2",
      name: "\u65E0\u540D\u7891\u6797",
      levelFrom: 32,
      levelTo: 34,
      element: "none",
      normals: ["\u5893\u7891\u8424\u706B", "\u62D3\u7247\u7EB8\u7075", "\u65E0\u540D\u5E7D\u9B42", "\u77F3\u5C51\u9AA8\u72AC"],
      elite: "\u7891\u7075",
      materials: ["dust_bone", "herb_moonlit", "rubbing_epitaph"],
      mapAsset: "assets/maps/chapter-4-2.webp",
      battleAsset: "assets/battlefields/chapter-4-2.webp"
    },
    {
      id: "4-3",
      name: "\u9AB8\u9AA8\u56DE\u5ECA",
      levelFrom: 34,
      levelTo: 36,
      element: "none",
      normals: ["\u9AA8\u706F\u4F8D\u4ECE", "\u6708\u767D\u9AB7\u9AC5\u5F13\u624B", "\u56DE\u5ECA\u6028\u5F71", "\u7075\u67E9\u7532\u866B"],
      materials: ["dust_bone", "herb_moonlit"],
      mapAsset: "assets/maps/chapter-4-3.webp",
      battleAsset: "assets/battlefields/chapter-4-3.webp"
    },
    {
      id: "4-4",
      name: "\u6708\u5149\u793C\u62DC\u5802",
      levelFrom: 36,
      levelTo: 38,
      element: "none",
      normals: ["\u7977\u70DB\u5E7D\u7075", "\u7834\u949F\u5929\u4F7F\u50CF", "\u6708\u7EB1\u4EA1\u7075", "\u94F6\u676F\u6028\u7075"],
      elite: "\u5815\u843D\u4FEE\u5973",
      materials: ["dust_bone", "herb_moonlit", "rubbing_epitaph"],
      mapAsset: "assets/maps/chapter-4-4.webp",
      battleAsset: "assets/battlefields/chapter-4-4.webp"
    },
    {
      id: "4-5",
      name: "\u957F\u7720\u4E4B\u68FA",
      levelFrom: 38,
      levelTo: 40,
      element: "none",
      normals: ["\u738B\u5BA4\u5E7D\u9B42", "\u68FA\u7EB9\u77F3\u536B", "\u9ED1\u7EB1\u6028\u7075", "\u6CEA\u6676\u8759\u8760"],
      elite: "\u738B\u68FA\u5B88\u536B",
      boss: "\u4EA1\u7075\u516C\u4E3B\xB7\u8389\u8389\u4E1D",
      materials: ["dust_bone", "herb_moonlit", "rubbing_epitaph", "tear_eternal"],
      mapAsset: "assets/maps/chapter-4-5.webp",
      battleAsset: "assets/battlefields/chapter-4-5.webp"
    }
  ]
};
var REGION_34 = [REGION_3, REGION_4];
var REGION_34_EQUIPMENT_THEMES = [
  {
    regionId: "r3",
    themeName: "\u866B\u7532\u7CFB",
    visualKeywords: ["\u7532\u58F3", "\u6697\u7EFF", "\u8584\u7FC5", "\u5E7D\u5149"],
    names: {
      weapon: "\u6676\u58F3\u53CC\u5203",
      head: "\u8584\u7FFC\u89E6\u89D2\u51A0",
      body: "\u5E7D\u5149\u866B\u7532\u88D9",
      necklace: "\u8715\u58F3\u540A\u5760",
      bracelet: "\u86DB\u4E1D\u62A4\u8155",
      ring: "\u590D\u773C\u6676\u6212",
      belt: "\u7532\u8282\u8170\u5C01",
      shoes: "\u82D4\u7EB9\u8F7B\u9774"
    },
    weaponNames: {
      swordsman: "\u6676\u58F3\u53CC\u5203",
      witch: "\u5E7D\u6676\u9B54\u5BFC\u7403",
      shaman: "\u866B\u7FC5\u7075\u6247",
      catkin: "\u5E7D\u6676\u88C2\u722A"
    }
  },
  {
    regionId: "r4",
    themeName: "\u6708\u6B87\u7CFB",
    visualKeywords: ["\u5E7D\u84DD", "\u9AA8\u767D", "\u6708\u7EB9", "\u94F6\u8F89"],
    names: {
      weapon: "\u6708\u6CEA\u9AA8\u5203",
      head: "\u957F\u7720\u6708\u51A0",
      body: "\u6708\u6B87\u793C\u88D9",
      necklace: "\u6C38\u7720\u6CEA\u5760",
      bracelet: "\u7891\u6587\u62A4\u8155",
      ring: "\u6708\u89C1\u94F6\u6212",
      belt: "\u7075\u67E9\u8170\u5C01",
      shoes: "\u5E7D\u6B65\u9AA8\u9774"
    },
    weaponNames: {
      swordsman: "\u6708\u6CEA\u9AA8\u5203",
      witch: "\u6708\u6CEA\u661F\u6756",
      shaman: "\u6C38\u7720\u8F6E\u6247",
      catkin: "\u6708\u94E0\u5DE8\u722A"
    }
  }
];
var REGION_34_MONSTER_MOTIONS = {
  "mon_3-1_0": "guard",
  "mon_3-1_1": "flutter",
  "mon_3-1_2": "sway",
  "mon_3-1_3": "hopper",
  "mon_3-2_0": "bounce",
  "mon_3-2_1": "flutter",
  "mon_3-2_2": "hopper",
  "mon_3-2_3": "sway",
  "mon_3-2_elite": "guard",
  "mon_3-3_0": "sway",
  "mon_3-3_1": "bounce",
  "mon_3-3_2": "sway",
  "mon_3-3_3": "hopper",
  "mon_3-4_0": "flutter",
  "mon_3-4_1": "sway",
  "mon_3-4_2": "hopper",
  "mon_3-4_3": "bounce",
  "mon_3-5_0": "guard",
  "mon_3-5_1": "sway",
  "mon_3-5_2": "flutter",
  "mon_3-5_3": "guard",
  "mon_3-5_elite": "guard",
  "mon_3-5_boss": "royal",
  "mon_4-1_0": "flutter",
  "mon_4-1_1": "hopper",
  "mon_4-1_2": "sway",
  "mon_4-1_3": "guard",
  "mon_4-2_0": "flutter",
  "mon_4-2_1": "flutter",
  "mon_4-2_2": "sway",
  "mon_4-2_3": "hopper",
  "mon_4-2_elite": "guard",
  "mon_4-3_0": "sway",
  "mon_4-3_1": "guard",
  "mon_4-3_2": "flutter",
  "mon_4-3_3": "hopper",
  "mon_4-4_0": "flutter",
  "mon_4-4_1": "guard",
  "mon_4-4_2": "sway",
  "mon_4-4_3": "bounce",
  "mon_4-4_elite": "royal",
  "mon_4-5_0": "flutter",
  "mon_4-5_1": "guard",
  "mon_4-5_2": "sway",
  "mon_4-5_3": "flutter",
  "mon_4-5_elite": "guard",
  "mon_4-5_boss": "royal"
};

// src/data/region6.ts
var REGION_6 = {
  id: "r6",
  index: 6,
  name: "\u5E7D\u5F71\u7940\u5854",
  subtitle: "\u7D2B\u9ED1\u77F3\u9636\u901A\u5411\u65E0\u58F0\u7684\u865A\u7A7A\u796D\u575B",
  levelFrom: 52,
  levelTo: 65,
  theme: ["#6f5aa8", "#c4a9ef"],
  mapAsset: "assets/maps/r6.webp",
  chapters: [
    {
      id: "6-1",
      name: "\u7940\u5854\u4E00\u5C42\xB7\u77F3\u50CF\u56DE\u5ECA",
      levelFrom: 52,
      levelTo: 55,
      element: "thunder",
      normals: ["\u7720\u77F3\u56E2\u5B50", "\u523B\u7EB9\u77F3\u5076", "\u9EEF\u5149\u6D6E\u96D5\u7075", "\u7940\u5854\u77F3\u7FFC\u517D"],
      materials: ["dust_statue", "scroll_faded"],
      tutorial: "\u77F3\u50CF\u602A\u4F1A\u5728\u7B2C\u4E00\u6B21\u53D7\u51FB\u65F6\u82CF\u9192\uFF1B\u5B83\u53EA\u6539\u53D8\u5165\u573A\u6F14\u51FA\uFF0C\u4E0D\u4F1A\u5077\u88AD\u9020\u6210\u989D\u5916\u4F24\u5BB3\u3002",
      mapAsset: "assets/maps/chapter-6-1.webp",
      battleAsset: "assets/battlefields/chapter-6-1.webp"
    },
    {
      id: "6-2",
      name: "\u7940\u5854\u4E09\u5C42\xB7\u796D\u7940\u95F4",
      levelFrom: 55,
      levelTo: 58,
      element: "thunder",
      normals: ["\u7ECF\u5377\u7EB8\u7075", "\u5E7D\u706F\u4F8D\u4ECE", "\u7977\u949F\u8760\u7075", "\u9ED1\u7EB1\u796D\u5076"],
      elite: "\u5E7D\u5F71\u796D\u53F8",
      materials: ["dust_statue", "scroll_faded", "wisp_shadow"],
      mapAsset: "assets/maps/chapter-6-2.webp",
      battleAsset: "assets/battlefields/chapter-6-2.webp"
    },
    {
      id: "6-3",
      name: "\u7940\u5854\u4E94\u5C42\xB7\u85CF\u7ECF\u9601",
      levelFrom: 58,
      levelTo: 60,
      element: "thunder",
      normals: ["\u58A8\u9875\u4E66\u7075", "\u6B8B\u70DB\u7ECF\u4F7F", "\u9501\u94FE\u5377\u8F74\u602A", "\u9759\u9ED8\u5B88\u4E66\u4EBA"],
      materials: ["dust_statue", "scroll_faded"],
      mapAsset: "assets/maps/chapter-6-3.webp",
      battleAsset: "assets/battlefields/chapter-6-3.webp"
    },
    {
      id: "6-4",
      name: "\u7940\u5854\u4E03\u5C42\xB7\u7981\u5FCC\u4E4B\u95F4",
      levelFrom: 60,
      levelTo: 63,
      element: "thunder",
      normals: ["\u5F71\u7EB9\u4F8D\u5973", "\u7981\u4E66\u5492\u7075", "\u865A\u50CF\u5DE1\u793C\u8005", "\u7D2B\u6676\u795E\u9F9B\u7075"],
      elite: "\u5E7D\u5F71\u6559\u4E3B\u5019\u8865",
      materials: ["dust_statue", "scroll_faded", "wisp_shadow"],
      mapAsset: "assets/maps/chapter-6-4.webp",
      battleAsset: "assets/battlefields/chapter-6-4.webp"
    },
    {
      id: "6-5",
      name: "\u5854\u9876\xB7\u865A\u7A7A\u796D\u575B",
      levelFrom: 63,
      levelTo: 65,
      element: "thunder",
      normals: ["\u5854\u9876\u5B88\u671B\u8005", "\u865A\u7A7A\u661F\u706F", "\u7940\u5F71\u86C7\u7075", "\u8BFA\u74E6\u8FD1\u4F8D"],
      elite: "\u5854\u9876\u53F8\u796D",
      boss: "\u5E7D\u5F71\u6559\u4E3B\xB7\u8BFA\u74E6",
      materials: ["dust_statue", "scroll_faded", "wisp_shadow", "stone_void"],
      mapAsset: "assets/maps/chapter-6-5.webp",
      battleAsset: "assets/battlefields/chapter-6-5.webp"
    }
  ]
};
var REGION_6_EQUIPMENT_THEME = {
  regionId: "r6",
  themeName: "\u5E7D\u77F3\u7940\u7EB9\u7CFB",
  level: 56,
  qualities: ["rare", "epic", "legendary"],
  visualKeywords: ["\u7D2B\u9ED1", "\u77F3\u7EB9", "\u94F6\u7070", "\u6559\u56E2\u5FBD\u8BB0"],
  names: {
    weapon: "\u5E7D\u77F3\u7977\u5203",
    head: "\u77F3\u7EB9\u7940\u51A0",
    body: "\u5E7D\u5EAD\u796D\u793C\u88D9",
    necklace: "\u892A\u8272\u7ECF\u5760",
    bracelet: "\u9547\u5F71\u77F3\u956F",
    ring: "\u865A\u5149\u8A93\u6212",
    belt: "\u7384\u7EB9\u7940\u5E26",
    shoes: "\u9759\u9ED8\u884C\u9774"
  },
  weaponNames: {
    swordsman: "\u5E7D\u77F3\u9547\u9B42\u5251",
    witch: "\u5E7D\u70EC\u7977\u661F\u6756",
    shaman: "\u7384\u94C3\u9547\u5F71\u6247",
    catkin: "\u591C\u5F71\u88C2\u77F3\u722A"
  }
};
var REGION_6_SET_ID = "set_region_shadow";
var REGION_6_SET_LEVEL = 62;
var REGION_6_SET_QUALITY = "legendary";
var REGION_6_SET_SLOTS = [
  "weapon",
  "head",
  "body",
  "necklace",
  "bracelet",
  "ring",
  "belt",
  "shoes"
];
var REGION_6_SET_NAMES = {
  weapon: "\u8BFA\u74E6\u5E7D\u754C\u5203",
  head: "\u5E7D\u5F71\u6559\u7687\u51A0",
  body: "\u8BFA\u74E6\u865A\u7A7A\u793C\u88C5",
  necklace: "\u6B8B\u6708\u9B42\u5760",
  bracelet: "\u9547\u9B42\u5E7D\u956F",
  ring: "\u4E0D\u706D\u5F71\u6212",
  belt: "\u865A\u7A7A\u7940\u5E26",
  shoes: "\u65E0\u58F0\u5F71\u9774"
};
var REGION_6_SET_WEAPON_NAMES = {
  swordsman: "\u8BFA\u74E6\u5E7D\u754C\u5251",
  witch: "\u8BFA\u74E6\u865A\u661F\u6756",
  shaman: "\u8BFA\u74E6\u9547\u9B42\u6247",
  catkin: "\u8BFA\u74E6\u5F71\u7F1A\u722A"
};
function region6SetEquipmentId(slot) {
  return `eq_set_region_shadow_${slot}`;
}
var REGION_6_STATUE_MONSTER_IDS = [
  "mon_6-1_0",
  "mon_6-1_1",
  "mon_6-1_2",
  "mon_6-1_3",
  "mon_6-3_3"
];
var REGION_6_MONSTER_MOTIONS = {
  "mon_6-1_0": "bounce",
  "mon_6-1_1": "guard",
  "mon_6-1_2": "sway",
  "mon_6-1_3": "guard",
  "mon_6-2_0": "flutter",
  "mon_6-2_1": "sway",
  "mon_6-2_2": "flutter",
  "mon_6-2_3": "bounce",
  "mon_6-2_elite": "royal",
  "mon_6-3_0": "flutter",
  "mon_6-3_1": "sway",
  "mon_6-3_2": "hopper",
  "mon_6-3_3": "guard",
  "mon_6-4_0": "sway",
  "mon_6-4_1": "flutter",
  "mon_6-4_2": "hopper",
  "mon_6-4_3": "guard",
  "mon_6-4_elite": "royal",
  "mon_6-5_0": "guard",
  "mon_6-5_1": "flutter",
  "mon_6-5_2": "hopper",
  "mon_6-5_3": "sway",
  "mon_6-5_elite": "guard",
  "mon_6-5_boss": "royal"
};

// src/data/equipment.ts
var THEMES = [
  {
    regionId: "r1",
    // 白装 Lv2 即可穿，和 docs/14 的「Lv2 解锁装备穿戴」一致。
    level: 4,
    weaponElement: REGION_WEAPON_ELEMENTS.r1,
    qualities: ["common", "fine", "rare"],
    icons: {
      weapon: "assets/equipment/r1/weapon.png",
      head: "assets/equipment/r1/head.png",
      body: "assets/equipment/r1/body.png",
      necklace: "assets/equipment/r1/necklace.png",
      bracelet: "assets/equipment/r1/bracelet.png",
      ring: "assets/equipment/r1/ring.png",
      belt: "assets/equipment/r1/belt.png",
      shoes: "assets/equipment/r1/shoes.png"
    },
    names: {
      weapon: "\u6A31\u679D\u77ED\u5251",
      head: "\u82B1\u51A0",
      body: "\u6A31\u8272\u8FDE\u8863\u88D9",
      necklace: "\u82B1\u74E3\u9879\u94FE",
      bracelet: "\u85E4\u7F16\u624B\u73AF",
      ring: "\u6728\u94C3\u6212",
      belt: "\u7F0E\u5E26\u8170\u5C01",
      shoes: "\u8F6F\u8349\u4FBF\u978B"
    },
    weaponNames: {
      swordsman: "\u6A31\u679D\u77ED\u5251",
      witch: "\u82B1\u7FBD\u9B54\u6756",
      shaman: "\u6A31\u4FE1\u7075\u6247",
      catkin: "\u82B1\u94C3\u6676\u722A"
    }
  },
  {
    regionId: "r2",
    level: 16,
    weaponElement: REGION_WEAPON_ELEMENTS.r2,
    qualities: ["fine", "rare", "epic"],
    icons: {
      weapon: "assets/equipment/r2/weapon.png",
      head: "assets/equipment/r2/head.png",
      body: "assets/equipment/r2/body.png",
      necklace: "assets/equipment/r2/necklace.png",
      bracelet: "assets/equipment/r2/bracelet.png",
      ring: "assets/equipment/r2/ring.png",
      belt: "assets/equipment/r2/belt.png",
      shoes: "assets/equipment/r2/shoes.png"
    },
    names: {
      weapon: "\u68C9\u82B1\u7CD6\u9524",
      head: "\u7A3B\u8349\u5E3D",
      body: "\u871C\u8702\u7EB9\u7F69\u88D9",
      necklace: "\u871C\u6EF4\u540A\u5760",
      bracelet: "\u8702\u8721\u62A4\u8155",
      ring: "\u7ED3\u6676\u6212",
      belt: "\u8349\u7F16\u8170\u5E26",
      shoes: "\u84EC\u677E\u7ED2\u9774"
    },
    weaponNames: {
      swordsman: "\u68C9\u82B1\u7CD6\u6218\u69CC",
      witch: "\u751C\u4E91\u9B54\u6756",
      shaman: "\u871C\u94C3\u7075\u69CC",
      catkin: "\u8702\u871C\u952E\u5E3D\u9524"
    }
  },
  // 区域 3/4：主题与可见名称登记在 region34.ts，此处只补等级与品质档。
  // 品质上限停在史诗，传说留给区域 5 的第一个套装区，
  // 提前放开会让后面的区域没有东西可给（见 docs/44 品质开放节奏）。
  ...REGION_34_EQUIPMENT_THEMES.map((theme) => ({
    regionId: theme.regionId,
    level: theme.regionId === "r3" ? 26 : 36,
    weaponElement: REGION_WEAPON_ELEMENTS[theme.regionId],
    qualities: ["fine", "rare", "epic"],
    icons: Object.fromEntries(
      SLOT_ORDER.map((slot) => [slot, `assets/equipment/${theme.regionId}/${slot}.png`])
    ),
    names: theme.names,
    weaponNames: theme.weaponNames
  })),
  {
    regionId: REGION_5_EQUIPMENT_THEME.regionId,
    level: REGION_5_EQUIPMENT_THEME.level,
    weaponElement: REGION_WEAPON_ELEMENTS.r5,
    qualities: [...REGION_5_EQUIPMENT_THEME.qualities],
    icons: Object.fromEntries(
      SLOT_ORDER.map((slot) => [slot, `assets/equipment/r5/${slot}.png`])
    ),
    names: REGION_5_EQUIPMENT_THEME.names,
    weaponNames: REGION_5_EQUIPMENT_THEME.weaponNames
  },
  {
    regionId: REGION_6_EQUIPMENT_THEME.regionId,
    level: REGION_6_EQUIPMENT_THEME.level,
    weaponElement: REGION_WEAPON_ELEMENTS.r6,
    qualities: [...REGION_6_EQUIPMENT_THEME.qualities],
    icons: Object.fromEntries(
      SLOT_ORDER.map((slot) => [slot, `assets/equipment/r6/${slot}.png`])
    ),
    names: REGION_6_EQUIPMENT_THEME.names,
    weaponNames: REGION_6_EQUIPMENT_THEME.weaponNames
  }
];
var QUALITY_PREFIX = {
  common: "",
  fine: "\u7CBE\u5236\xB7",
  rare: "\u79D8\u94F6\xB7",
  epic: "\u7075\u7EB9\xB7",
  legendary: "\u4F20\u4E16\xB7",
  mythic: "\u795E\u8BDD\xB7",
  prismatic: "\u5FC3\u8679\xB7",
  divine: "\u5723\u75D5\xB7"
};
var QUALITY_LEVEL_OFFSET = {
  common: -2,
  fine: 0,
  rare: 2,
  epic: 4,
  legendary: 6,
  mythic: 8,
  prismatic: 9,
  divine: 10
};
function weaponClassPresentations(appearanceId, names, qualityPrefix = "") {
  return Object.fromEntries(
    CLASS_IDS.map((classId) => [
      classId,
      {
        name: `${qualityPrefix}${names[classId]}`,
        icon: `assets/equipment/weapons/${appearanceId}/${classId}.png`
      }
    ])
  );
}
function buildEquipment() {
  const out = {};
  for (const theme of THEMES) {
    for (const slot of SLOT_ORDER) {
      for (const quality of theme.qualities) {
        const id = `eq_${theme.regionId}_${slot}_${quality}`;
        const common = {
          id,
          name: QUALITY_PREFIX[quality] + theme.names[slot],
          quality,
          level: Math.max(1, theme.level + QUALITY_LEVEL_OFFSET[quality]),
          icon: theme.icons[slot],
          appearanceId: `${theme.regionId}-${slot}`
        };
        out[id] = slot === "weapon" ? {
          ...common,
          slot,
          element: theme.weaponElement,
          classPresentations: weaponClassPresentations(
            `${theme.regionId}-weapon`,
            theme.weaponNames,
            QUALITY_PREFIX[quality]
          )
        } : { ...common, slot };
      }
    }
  }
  for (const slot of REGION_5_SET_SLOTS) {
    const id = region5SetEquipmentId(slot);
    const common = {
      id,
      name: REGION_5_SET_NAMES[slot],
      quality: REGION_5_SET_QUALITY,
      level: REGION_5_SET_LEVEL,
      setId: REGION_5_SET_ID,
      icon: `assets/equipment/sets/r5-crimson/${slot}.png`,
      appearanceId: `r5-set-${slot}`
    };
    out[id] = slot === "weapon" ? {
      ...common,
      slot,
      element: REGION_WEAPON_ELEMENTS.r5,
      classPresentations: weaponClassPresentations(
        "r5-set-weapon",
        REGION_5_SET_WEAPON_NAMES
      )
    } : { ...common, slot };
  }
  for (const slot of REGION_6_SET_SLOTS) {
    const id = region6SetEquipmentId(slot);
    const common = {
      id,
      name: REGION_6_SET_NAMES[slot],
      quality: REGION_6_SET_QUALITY,
      level: REGION_6_SET_LEVEL,
      setId: REGION_6_SET_ID,
      icon: `assets/equipment/sets/r6-shadow/${slot}.png`,
      appearanceId: `r6-set-${slot}`
    };
    out[id] = slot === "weapon" ? {
      ...common,
      slot,
      element: REGION_WEAPON_ELEMENTS.r6,
      classPresentations: weaponClassPresentations(
        "r6-set-weapon",
        REGION_6_SET_WEAPON_NAMES
      )
    } : { ...common, slot };
  }
  for (const theme of BOUTIQUE_THEME_LIST) {
    const percentile = theme.quality === "epic" ? 0.6 : theme.quality === "legendary" ? 0.75 : 0.9;
    for (const item of theme.items) {
      const id = boutiqueEquipmentId(theme.id, item.slot, item.classId);
      const iconName = item.classId ? `${item.slot}-${item.classId}.png` : `${item.slot}.png`;
      const common = {
        id,
        name: item.name,
        quality: theme.quality,
        level: theme.level,
        icon: `assets/equipment/shop/${theme.id}/${iconName}`,
        appearanceId: boutiqueAppearanceId(theme.id, item.slot, item.classId),
        fixedAffixes: boutiqueAffixes(
          item.slot,
          theme.level,
          QUALITY_AFFIX_COUNT[theme.quality],
          percentile
        ),
        fixedTemplate: true,
        uniqueEffect: item.uniqueEffect,
        boutiqueTheme: theme.id,
        ...item.classId ? { classId: item.classId } : {}
      };
      out[id] = item.slot === "weapon" ? { ...common, slot: item.slot, element: BOUTIQUE_WEAPON_ELEMENTS[theme.id] } : { ...common, slot: item.slot };
    }
  }
  for (const definition of EQUIPMENT_DUNGEON_GEAR_LIST) {
    if (out[definition.id]) {
      throw new Error(`[\u914D\u7F6E\u9519\u8BEF] \u88C5\u5907 ID \u91CD\u590D\uFF1A${definition.id}`);
    }
    out[definition.id] = definition;
  }
  for (const entry4 of AFFECTION_EQUIPMENT_LIST) {
    const definition = entry4.definition;
    if (out[definition.id]) {
      throw new Error(`[\u914D\u7F6E\u9519\u8BEF] \u88C5\u5907 ID \u91CD\u590D\uFF1A${definition.id}`);
    }
    out[definition.id] = definition;
  }
  for (const definition of ARENA_EQUIPMENT_LIST) {
    if (out[definition.id]) {
      throw new Error(`[\u914D\u7F6E\u9519\u8BEF] \u88C5\u5907 ID \u91CD\u590D\uFF1A${definition.id}`);
    }
    out[definition.id] = definition;
  }
  return out;
}
var BOUTIQUE_AFFIX_KEYS = {
  weapon: ["atk", "critRate", "critDmg", "acc", "spd", "hp"],
  head: ["def", "hp", "acc", "critRate", "eva", "critDmg"],
  body: ["def", "hp", "eva", "acc", "critRate", "critDmg"],
  necklace: ["atk", "critDmg", "hp", "critRate", "acc", "eva"],
  bracelet: ["atk", "acc", "def", "critRate", "hp", "eva"],
  ring: ["atk", "critRate", "critDmg", "acc", "eva", "hp"],
  belt: ["def", "hp", "eva", "acc", "critRate", "critDmg"],
  shoes: ["eva", "spd", "def", "hp", "acc", "critRate"]
};
function boutiqueAffixes(slot, level, count, percentile) {
  return BOUTIQUE_AFFIX_KEYS[slot].slice(0, count).map((key) => ({ key, value: boutiqueAffixValue(key, level, percentile) }));
}
function boutiqueAffixValue(key, level, percentile) {
  const levelScale = Math.pow(level, 1.3);
  switch (key) {
    case "atk":
      return Math.round((0.4 + 0.4 * percentile) * levelScale);
    case "def":
      return Math.round((0.3 + 0.3 * percentile) * levelScale);
    case "hp":
      return Math.round((4 + 4 * percentile) * levelScale);
    case "acc":
      return Math.round((0.5 + 0.7 * percentile) * levelScale);
    case "eva":
      return Math.round((0.4 + 0.6 * percentile) * levelScale);
    case "critRate":
      return Math.round((0.5 + 2.5 * percentile) * 10) / 10;
    case "critDmg":
      return Math.round((2 + 10 * percentile) * 10) / 10;
    case "spd":
      return Math.round((0.01 + 0.04 * percentile) * 100) / 100;
    default:
      throw new Error(`[\u914D\u7F6E\u9519\u8BEF] \u7CBE\u54C1\u5546\u5E97\u4E0D\u652F\u6301\u56FA\u5B9A\u8BCD\u6761\uFF1A${key}`);
  }
}
var EQUIPMENT = buildEquipment();
function getEquipment(id) {
  return EQUIPMENT[id];
}
function requireEquipment(id) {
  const equipment = EQUIPMENT[id];
  if (!equipment) throw new Error(`[\u914D\u7F6E\u9519\u8BEF] \u88C5\u5907\u5B9A\u4E49\u4E0D\u5B58\u5728\uFF1A${id}`);
  return equipment;
}

// src/data/equipmentDungeonSets.ts
var EQUIPMENT_DUNGEON_SETS = {
  set_dungeon_azure: {
    id: "set_dungeon_azure",
    tierId: "azure",
    name: "\u6674\u84DD\u8336\u4F1A",
    pieceSlots: SLOT_ORDER,
    bonuses: [
      {
        pieces: 2,
        label: "\u8336\u4F1A\u5E8F\u66F2",
        description: "\u653B\u51FB +4%",
        statPercent: { atk: 0.04 }
      },
      {
        pieces: 4,
        label: "\u7CD6\u6676\u62A4\u5E2D",
        description: "\u751F\u547D +8%",
        statPercent: { hp: 0.08 }
      },
      {
        pieces: 6,
        label: "\u6674\u7A7A\u5408\u594F",
        description: "\u9632\u5FA1 +6%\uFF0C\u66B4\u51FB\u7387 +2%",
        statPercent: { def: 0.06 },
        statFlat: { critRate: 2 }
      },
      {
        pieces: 8,
        label: "\u84DD\u5323\u8C22\u5E55",
        description: "\u5E73\u5747\u6280\u80FD\u500D\u7387 +0.05",
        skillMultiplierBonus: 0.05
      }
    ]
  },
  set_dungeon_violet: {
    id: "set_dungeon_violet",
    tierId: "violet",
    name: "\u6708\u7D2B\u661F\u5BB4",
    pieceSlots: SLOT_ORDER,
    bonuses: [
      {
        pieces: 2,
        label: "\u6708\u5154\u8FCE\u5BBE",
        description: "\u653B\u51FB +6%",
        statPercent: { atk: 0.06 }
      },
      {
        pieces: 4,
        label: "\u661F\u7EB1\u5E37\u5E55",
        description: "\u751F\u547D +10%",
        statPercent: { hp: 0.1 }
      },
      {
        pieces: 6,
        label: "\u65B0\u6708\u5171\u821E",
        description: "\u9632\u5FA1 +8%\uFF0C\u66B4\u51FB\u7387 +3%",
        statPercent: { def: 0.08 },
        statFlat: { critRate: 3 }
      },
      {
        pieces: 8,
        label: "\u7D2B\u5323\u661F\u6F6E",
        description: "\u5E73\u5747\u6280\u80FD\u500D\u7387 +0.08",
        skillMultiplierBonus: 0.08
      }
    ]
  },
  set_dungeon_auric: {
    id: "set_dungeon_auric",
    tierId: "auric",
    name: "\u7425\u73C0\u8537\u8587\u738B\u5EAD",
    pieceSlots: SLOT_ORDER,
    bonuses: [
      {
        pieces: 2,
        label: "\u738B\u5EAD\u8A93\u82B1",
        description: "\u653B\u51FB +9%",
        statPercent: { atk: 0.09 }
      },
      {
        pieces: 4,
        label: "\u7425\u73C0\u58C1\u5792",
        description: "\u751F\u547D +14%",
        statPercent: { hp: 0.14 }
      },
      {
        pieces: 6,
        label: "\u91D1\u8537\u8587\u793C\u8D5E",
        description: "\u9632\u5FA1 +11%\uFF0C\u66B4\u51FB\u7387 +4%",
        statPercent: { def: 0.11 },
        statFlat: { critRate: 4 }
      },
      {
        pieces: 8,
        label: "\u738B\u5EAD\u52A0\u5195",
        description: "\u5E73\u5747\u6280\u80FD\u500D\u7387 +0.12",
        skillMultiplierBonus: 0.12
      }
    ]
  },
  set_dungeon_crimson: {
    id: "set_dungeon_crimson",
    tierId: "crimson",
    name: "\u7EEF\u6A31\u5178\u85CF",
    pieceSlots: SLOT_ORDER,
    bonuses: [
      {
        pieces: 2,
        label: "\u5178\u85CF\u542F\u5C01",
        description: "\u653B\u51FB +12%",
        statPercent: { atk: 0.12 }
      },
      {
        pieces: 4,
        label: "\u8D64\u91D1\u793C\u88C5",
        description: "\u751F\u547D +18%",
        statPercent: { hp: 0.18 }
      },
      {
        pieces: 6,
        label: "\u7EEF\u6A31\u661F\u73AF",
        description: "\u9632\u5FA1 +15%\uFF0C\u66B4\u51FB\u7387 +5%",
        statPercent: { def: 0.15 },
        statFlat: { critRate: 5 }
      },
      {
        pieces: 8,
        label: "\u73CD\u54C1\u5171\u9E23",
        description: "\u5E73\u5747\u6280\u80FD\u500D\u7387 +0.18",
        skillMultiplierBonus: 0.18
      }
    ]
  }
};

// src/data/regionEquipmentSets.ts
var REGION_CRIMSON_SET_ID = "set_region_crimson";
var REGION_CRIMSON_FLAMEBURST_TRIGGER_ID = `${REGION_CRIMSON_SET_ID}:flameburst`;
var REGION_SHADOW_SET_ID = "set_region_shadow";
var REGION_SHADOW_SURVIVAL_TRIGGER_ID = `${REGION_SHADOW_SET_ID}:survival`;
var REGION_EQUIPMENT_SETS = {
  [REGION_CRIMSON_SET_ID]: {
    id: REGION_CRIMSON_SET_ID,
    name: "\u7EEF\u7130\u5957",
    pieceSlots: ["weapon", "head", "body", "necklace", "ring", "bracelet"],
    bonuses: [
      {
        pieces: 2,
        label: "\u8D64\u91D1\u706B\u7EB9",
        description: "\u653B\u51FB +8%",
        statPercent: { atk: 0.08 }
      },
      {
        pieces: 4,
        label: "\u796D\u706B\u8A93\u7EA6",
        description: "\u66B4\u51FB\u7387 +6%\uFF0C\u708E\u5C5E\u6027\u4F24\u5BB3 +12%",
        statFlat: { critRate: 6 },
        combatBonuses: { elementDamage: { fire: 12 } }
      },
      {
        pieces: 6,
        label: "\u7EEF\u7130",
        description: "\u6BCF\u6B21\u76F4\u63A5\u547D\u4E2D\u6709 15% \u6982\u7387\u8FFD\u52A0 120% \u653B\u51FB\u529B\u7684\u708E\u7206\u4F24\u5BB3",
        onHitTriggers: [
          {
            id: REGION_CRIMSON_FLAMEBURST_TRIGGER_ID,
            kind: "elemental-damage",
            chance: 0.15,
            atkMultiplier: 1.2,
            element: "fire"
          }
        ]
      }
    ]
  },
  [REGION_SHADOW_SET_ID]: {
    id: REGION_SHADOW_SET_ID,
    name: "\u5E7D\u5F71\u5957",
    pieceSlots: [
      "weapon",
      "head",
      "body",
      "necklace",
      "bracelet",
      "ring",
      "belt",
      "shoes"
    ],
    bonuses: [
      {
        pieces: 2,
        label: "\u77F3\u5F71\u62A4\u8EAB",
        description: "\u751F\u547D +10%",
        statPercent: { hp: 0.1 }
      },
      {
        pieces: 4,
        label: "\u5E7D\u5E55",
        description: "\u4F24\u5BB3\u51CF\u514D +6%",
        combatBonuses: { damageReduction: 6 }
      },
      {
        pieces: 6,
        label: "\u865A\u7A7A\u7977\u8BCD",
        description: "\u653B\u51FB +12%\uFF0C\u66B4\u51FB\u4F24\u5BB3 +20%",
        statPercent: { atk: 0.12 },
        statFlat: { critDmg: 20 }
      },
      {
        pieces: 8,
        label: "\u5E7D\u5F71",
        description: "\u6BCF\u573A\u6218\u6597\u9996\u6B21\u53D7\u5230\u81F4\u547D\u4F24\u5BB3\u65F6\u514D\u4E8E\u5012\u4E0B\uFF0C\u5E76\u56DE\u590D 30% \u6700\u5927\u751F\u547D",
        onLethalTriggers: [
          {
            id: REGION_SHADOW_SURVIVAL_TRIGGER_ID,
            kind: "lethal-recovery",
            healRatio: 0.3,
            activationsPerFight: 1
          }
        ]
      }
    ]
  }
};
var REGION_CRIMSON_SET = REGION_EQUIPMENT_SETS[REGION_CRIMSON_SET_ID];
var REGION_SHADOW_SET = REGION_EQUIPMENT_SETS[REGION_SHADOW_SET_ID];

// src/data/equipmentSets.ts
var EQUIPMENT_SETS = {
  ...EQUIPMENT_DUNGEON_SETS,
  ...REGION_EQUIPMENT_SETS,
  [ARENA_SET_ID]: ARENA_EQUIPMENT_SET
};
function getEquipmentSet(id) {
  return EQUIPMENT_SETS[id];
}
var ARENA_SET_FIELD_STUB = {
  ...ARENA_EQUIPMENT_SET,
  bonuses: []
};
function getFieldEquipmentSet(id) {
  const definition = EQUIPMENT_SETS[id];
  if (!definition) return void 0;
  return definition.id === ARENA_SET_ID ? ARENA_SET_FIELD_STUB : definition;
}

// src/data/expectedPower.ts
function typicalQualityAt(level) {
  if (level < 15) return "common";
  if (level < 25) return "fine";
  if (level < 40) return "rare";
  if (level < 65) return "epic";
  if (level < 90) return "legendary";
  if (level < 110) return "mythic";
  return "divine";
}
function zeroStats2() {
  return { atk: 0, def: 0, hp: 0, acc: 0, eva: 0, critRate: 0, critDmg: 0, spd: 0 };
}
function expectedGearStats(level, quality) {
  const baseValue = ITEM_BASE * Math.pow(level, ITEM_POW) * QUALITY_MUL[quality] * ITEM_SCALE;
  const pctScale = QUALITY_PCT_SCALE[quality];
  const out = zeroStats2();
  for (const slot of Object.keys(SLOT_WEIGHTS)) {
    for (const [key, weight] of Object.entries(SLOT_WEIGHTS[slot])) {
      out[key] += baseValue * weight;
    }
    for (const [key, weight] of Object.entries(SLOT_PCT_WEIGHTS[slot])) {
      out[key] += pctScale * weight;
    }
  }
  return out;
}
function expectedFullGearCp(level, classId = "swordsman") {
  const quality = typicalQualityAt(level);
  return combatPower(addStats(baseStatsFor(classId, level), expectedGearStats(level, quality)));
}

// src/data/trialRules.ts
var TRIAL_BRACKETS = [
  { id: "chuying", name: "\u521D\u6A31", minLevel: 1, maxLevel: 30, bossLevel: 15 },
  { id: "feiyue", name: "\u7EEF\u6708", minLevel: 31, maxLevel: 60, bossLevel: 45 },
  { id: "hupo", name: "\u7425\u73C0", minLevel: 61, maxLevel: 90, bossLevel: 75 },
  { id: "feiying", name: "\u7EEF\u6A31", minLevel: 91, maxLevel: 120, bossLevel: 105 }
];
var TRIAL_BEST_KEEP = 26;

// src/core/trial.ts
function fnv1a32(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
var TRIAL_WEEK_EPOCH_MS = Date.UTC(2026, 0, 5);
var WEEK_MS = 7 * 24 * 36e5;
function buildTrialCombatant(input) {
  if (input.equipped.length !== SLOT_ORDER.length) {
    throw new Error(`[\u8BD5\u70BC] equipped \u5FC5\u987B\u6709 ${SLOT_ORDER.length} \u4E2A\u69FD\u4F4D`);
  }
  const equipped = [...input.equipped];
  const base = baseStatsFor(input.classId, input.level);
  const equipStats = totalEquipStats(equipped, getEquipment, input.classId);
  const setResolution = resolveEquipmentSetBonuses(
    equipped,
    getEquipment,
    // 圣痕套只在竞技场内生效（docs/53 §六）：对决构建用全量查询，试炼走空效果查询
    input.arena ? getEquipmentSet : getFieldEquipmentSet
  );
  const combined = applyEquipmentSetStats(addStats(base, equipStats), setResolution);
  combined.critRate = Math.min(CRIT_RATE_CAP, combined.critRate);
  const stats = applyClassMods(input.classId, combined);
  const bonuses = addCombatBonuses(
    totalEquipCombatBonuses(equipped, getEquipment, input.classId),
    setResolution.combatBonuses
  );
  const weapon = input.equipped[0];
  const element = weapon ? weaponElementOf(requireEquipment(weapon.defId)) : "none";
  return {
    combatant: makePlayer(input.name, input.level, stats, element, bonuses),
    skillMultiplier: averageSkillMultiplier(input.level) + setResolution.skillMultiplierBonus,
    onHitTriggers: setResolution.onHitTriggers,
    onLethalTriggers: setResolution.onLethalTriggers,
    combatPower: combatPower(stats),
    buildHash: canonicalBuildHash(input.equipped)
  };
}
function canonicalBuildHash(equipped) {
  const body = equipped.map((inst, index) => inst ? `${SLOT_ORDER[index]}=${canonicalInstance(inst)}` : "").join(";");
  return fnv1a32(body).toString(16).padStart(8, "0");
}
function canonicalInstance(inst) {
  const affixes = inst.affixes.map((a) => `${a.key}:${a.value}:${a.element ?? ""}:${a.tier}`).join("|");
  return [
    inst.defId,
    inst.enhance,
    inst.baseRollPermille,
    inst.enhanceGainPermille.join(","),
    affixes,
    inst.reforgeResonance
  ].join("#");
}
function trialPlausibilityCap(level, classId) {
  return expectedFullGearCp(level, classId) * 1.6;
}

// src/data/arenaRules.ts
var ARENA_JOIN_HONOR = 100;
var ARENA_TIERS = [
  { id: "yingguan", name: "\u6A31\u51A0", topRank: 10, topPercent: null, dailyHonor: 300, dailyBoxes: { sacred: 2, starlight: 0 } },
  { id: "feiying", name: "\u7EEF\u6A31", topRank: 100, topPercent: null, dailyHonor: 200, dailyBoxes: { sacred: 1, starlight: 0 } },
  { id: "hupo", name: "\u7425\u73C0", topRank: null, topPercent: 0.3, dailyHonor: 120, dailyBoxes: { sacred: 0, starlight: 2 } },
  { id: "feiyue", name: "\u7EEF\u6708", topRank: null, topPercent: 0.6, dailyHonor: 80, dailyBoxes: { sacred: 0, starlight: 1 } },
  { id: "qingying", name: "\u9752\u6A31", topRank: null, topPercent: null, dailyHonor: 50, dailyBoxes: { sacred: 0, starlight: 1 } }
];

// src/core/duel.ts
function arenaTierFor(rank, totalPlayers) {
  if (!Number.isInteger(rank) || rank <= 0) {
    throw new Error(`[\u5BF9\u51B3] \u6392\u540D\u5FC5\u987B\u662F\u6B63\u6574\u6570\uFF0C\u6536\u5230 ${rank}`);
  }
  const total = Math.max(1, totalPlayers);
  for (const tier of ARENA_TIERS) {
    if (tier.topRank !== null && rank <= tier.topRank) return tier;
    if (tier.topPercent !== null && rank / total <= tier.topPercent) return tier;
  }
  return ARENA_TIERS[ARENA_TIERS.length - 1];
}

// src/save/schema.ts
import { z } from "zod";

// src/data/equipmentDungeonRules.ts
var EQUIPMENT_DUNGEON_RULES = {
  /** 八个门户共享每日成功领取次数；失败不扣。 */
  dailyClears: 3,
  /** 北京时间凌晨 4 点日切，避开玩家午夜正好战斗时被重置。 */
  resetHourCst: 4,
  /** 单场最多 90 秒，防止双方打不动。 */
  maxFightSeconds: 90,
  /** 击败随从后恢复 12% 最大生命，给第二波守关者留公平缓冲。 */
  betweenWaveHealRatio: 0.12,
  /** 每个关卡首次胜利额外执行一次同表掉落，帮助玩家启动新档位。 */
  firstClearBonusRolls: 1
};

// src/core/reforge.ts
function promoteAffix(affix) {
  if (affix.tier >= 5) throw new Error("promoteAffix: T5 \u8BCD\u6761\u4E0D\u80FD\u7EE7\u7EED\u63D0\u5347");
  const current = AFFIX_TIERS.find((entry4) => entry4.tier === affix.tier);
  const next = AFFIX_TIERS.find((entry4) => entry4.tier === affix.tier + 1);
  const spec = requireAffixSpec2(affix.key);
  const precision = 10 ** spec.decimals;
  return {
    ...affix,
    tier: next.tier,
    value: Math.round(affix.value * (next.multiplier / current.multiplier) * precision) / precision
  };
}
function isProfessionAffixSlot(quality, affixCount, targetIndex) {
  const reserved = Math.min(QUALITY_PROFESSION_AFFIX_COUNT[quality], affixCount);
  return reserved > 0 && targetIndex >= affixCount - reserved;
}
function requireAffixSpec2(key) {
  const spec = AFFIX_POOL.find((entry4) => entry4.key === key) ?? Object.values(PROFESSION_AFFIX_POOLS).flat().find((entry4) => entry4.key === key);
  if (!spec) throw new Error(`[\u914D\u7F6E\u9519\u8BEF] \u8BCD\u6761\u6C60\u4E0D\u5B58\u5728\uFF1A${key}`);
  return spec;
}

// src/data/encounters.ts
var akanePortrait = (portraitId) => ({
  characterId: "char_akane",
  portraitId
});
var suiPortrait = (portraitId) => ({
  characterId: "char_sui",
  portraitId
});
var DEFINITIONS = [
  {
    id: "enc_r1_petalsmith",
    regionIds: ["r1"],
    unlockChapterId: "1-1",
    title: "\u82B1\u5F84\u4E0A\u7684\u89C1\u4E60\u5200\u5320",
    story: "\u4E00\u4F4D\u89C1\u4E60\u5200\u5320\u8E72\u5728\u8DEF\u65C1\uFF0C\u6B63\u4E3A\u7F3A\u5C11\u67D4\u97E7\u7684\u5305\u5200\u6750\u6599\u53D1\u6101\u3002",
    speaker: "\u89C1\u4E60\u5200\u5320\xB7\u831C",
    glyph: "\u{1F528}",
    sceneAsset: "assets/encounters/scenes/akane/petalsmith-road.webp",
    initialPortrait: akanePortrait("nervous-request"),
    storyArc: {
      characterId: "char_akane",
      characterName: "\u89C1\u4E60\u5200\u5320\xB7\u831C",
      episode: 1,
      episodeLabel: "\u7B2C\u4E00\u5E55 \xB7 \u4E0D\u5408\u89C4\u77E9\u7684\u5200\u67C4",
      requiredEncounterIds: [],
      repeatable: false,
      storyChoices: [
        {
          id: "lasting_grip",
          label: "\u201C\u67D4\u8F6F\u4E9B\uFF0C\u53CD\u800C\u80FD\u63E1\u5F97\u66F4\u4E45\u3002\u201D",
          responseDialogue: [
            {
              speaker: "\u89C1\u4E60\u5200\u5320\xB7\u831C",
              text: "\u63E1\u5F97\u66F4\u4E45\u2026\u2026\u539F\u6765\u4F60\u4E0D\u662F\u53EA\u770B\u5B83\u591F\u4E0D\u591F\u5A01\u98CE\u3002",
              portraitCue: akanePortrait("lasting-grip")
            },
            { speaker: "\u89C1\u4E60\u5200\u5320\xB7\u831C", text: "\u8FD9\u53E5\u8BDD\uFF0C\u6211\u60F3\u8BB0\u5728\u4ECA\u5929\u7684\u8349\u56FE\u65C1\u8FB9\u3002" }
          ]
        },
        {
          id: "prove_it",
          label: "\u201C\u5148\u505A\u51FA\u6765\uFF0C\u518D\u8BA9\u5E08\u7236\u8BC4\u4EF7\u3002\u201D",
          responseDialogue: [
            {
              speaker: "\u89C1\u4E60\u5200\u5320\xB7\u831C",
              text: "\u5BF9\u54E6\uFF0C\u8FDE\u6210\u54C1\u90FD\u6CA1\u6709\uFF0C\u600E\u4E48\u80FD\u5148\u8BA4\u8F93\u5462\uFF01",
              portraitCue: akanePortrait("prove-it")
            },
            { text: "\u5979\u628A\u76B1\u5DF4\u5DF4\u7684\u8349\u56FE\u91CD\u65B0\u94FA\u5E73\uFF0C\u773C\u775B\u4E5F\u4EAE\u4E86\u8D77\u6765\u3002" }
          ]
        }
      ]
    },
    dialogue: [
      { text: "\u82B1\u5F84\u7684\u62D0\u89D2\u4F20\u6765\u53EE\u53EE\u5F53\u5F53\u7684\u58F0\u97F3\u3002" },
      { speaker: "\u89C1\u4E60\u5200\u5320\xB7\u831C", text: "\u554A\u3001\u6709\u4EBA\u6765\u4E86\uFF01\u90A3\u4E2A\u2026\u2026\u4F60\u8EAB\u4E0A\u6709\u67D4\u8F6F\u4E00\u70B9\u7684\u6750\u6599\u5417\uFF1F" },
      { speaker: "\u89C1\u4E60\u5200\u5320\xB7\u831C", text: "\u6211\u60F3\u7ED9\u65B0\u5200\u505A\u4E2A\u5305\u67C4\uFF0C\u53EF\u5E08\u7236\u8BF4\u6211\u6311\u7684\u6599\u5B50\u592A\u786C\u4E86\u2026\u2026" }
    ],
    choices: [
      {
        id: "trade",
        label: "\u9001\u5979\u4E00\u4E9B\u6750\u6599",
        outcome: "\u5200\u5320\u628A\u4E00\u4EFD\u6C89\u7538\u7538\u7684\u8C22\u793C\u585E\u5230\u4E86\u4F60\u624B\u91CC\u3002",
        costs: { items: { petal_sakura: 3, grass_soft: 2 } },
        rewardPool: [
          {
            weight: 90,
            rewards: { gold: { min: 20, max: 60 }, items: { stone_enhance: { min: 1, max: 3 } } }
          },
          {
            weight: 10,
            rewards: { gold: { min: 60, max: 120 }, items: { stone_reforge: { min: 1, max: 1 } } }
          }
        ]
      },
      { id: "leave", label: "\u795D\u5979\u987A\u5229", outcome: "\u4F60\u4EEC\u4E92\u76F8\u6325\u624B\uFF0C\u7EE7\u7EED\u5404\u81EA\u7684\u65C5\u7A0B\u3002" }
    ]
  },
  {
    id: "enc_r1_petalsmith_doubt",
    regionIds: ["r1"],
    unlockChapterId: "1-3",
    title: "\u88AB\u9000\u56DE\u7684\u8BD5\u4F5C\u54C1",
    sceneAsset: "assets/encounters/scenes/akane/rejected-workbench.webp",
    initialPortrait: akanePortrait("rejected-clutch"),
    story: "\u831C\u62B1\u7740\u88AB\u5E08\u7236\u9000\u56DE\u7684\u5200\u67C4\uFF0C\u8EB2\u5728\u82B1\u623F\u540E\u9762\u4E0D\u80AF\u56DE\u5DE5\u574A\u3002",
    speaker: "\u89C1\u4E60\u5200\u5320\xB7\u831C",
    glyph: "\u{1F528}",
    storyArc: {
      characterId: "char_akane",
      characterName: "\u89C1\u4E60\u5200\u5320\xB7\u831C",
      episode: 2,
      episodeLabel: "\u7B2C\u4E8C\u5E55 \xB7 \u5E08\u7236\u8BF4\u4E0D\u884C",
      requiredEncounterIds: ["enc_r1_petalsmith"],
      repeatable: false,
      storyChoices: [
        {
          id: "ask_herself",
          label: "\u201C\u5148\u522B\u7BA1\u5E08\u7236\u3002\u4F60\u81EA\u5DF1\u559C\u6B22\u5B83\u5417\uFF1F\u201D",
          responseDialogue: [
            {
              speaker: "\u89C1\u4E60\u5200\u5320\xB7\u831C",
              text: "\u6211\u2026\u2026\u559C\u6B22\u3002\u63E1\u4E0A\u53BB\u7684\u65F6\u5019\uFF0C\u624B\u5FC3\u4F1A\u89C9\u5F97\u5F88\u5B89\u5FC3\u3002",
              portraitCue: akanePortrait("ask-herself")
            },
            { speaker: "\u89C1\u4E60\u5200\u5320\xB7\u831C", text: "\u539F\u6765\u8FD9\u4E5F\u53EF\u4EE5\u6210\u4E3A\u7EE7\u7EED\u505A\u4E0B\u53BB\u7684\u7406\u7531\u3002" }
          ]
        },
        {
          id: "not_wrong",
          label: "\u201C\u88AB\u5426\u5B9A\uFF0C\u4E0D\u7B49\u4E8E\u505A\u9519\u4E86\u3002\u201D",
          responseDialogue: [
            {
              speaker: "\u89C1\u4E60\u5200\u5320\xB7\u831C",
              text: "\u5E08\u7236\u53EA\u8BF4\u5B83\u4E0D\u50CF\u4F20\u7EDF\u5200\u67C4\uFF0C\u5374\u6CA1\u8BF4\u5B83\u771F\u7684\u4E0D\u80FD\u7528\u3002",
              portraitCue: akanePortrait("not-wrong")
            },
            { speaker: "\u89C1\u4E60\u5200\u5320\xB7\u831C", text: "\u54FC\u54FC\u2026\u2026\u6211\u597D\u50CF\u627E\u5230\u80FD\u53CD\u9A73\u4ED6\u7684\u5730\u65B9\u4E86\u3002" }
          ]
        }
      ],
      memoryCallbacks: [
        {
          fromEncounterId: "enc_r1_petalsmith",
          choiceId: "lasting_grip",
          dialogue: [{ speaker: "\u89C1\u4E60\u5200\u5320\xB7\u831C", text: "\u4F60\u4E0A\u6B21\u8BF4\u201C\u63E1\u5F97\u4E45\u201D\u66F4\u91CD\u8981\u2026\u2026\u6211\u771F\u7684\u7167\u7740\u6539\u4E86\u3002" }]
        },
        {
          fromEncounterId: "enc_r1_petalsmith",
          choiceId: "prove_it",
          dialogue: [
            { speaker: "\u89C1\u4E60\u5200\u5320\xB7\u831C", text: "\u6211\u7167\u4F60\u8BF4\u7684\u5148\u505A\u51FA\u4E86\u6210\u54C1\uFF0C\u53EF\u5E08\u7236\u8FD8\u662F\u628A\u5B83\u9000\u56DE\u6765\u4E86\u3002" }
          ]
        }
      ]
    },
    dialogue: [
      { text: "\u82B1\u623F\u540E\u4F20\u6765\u538B\u5F97\u5F88\u4F4E\u7684\u62BD\u9F3B\u5B50\u58F0\uFF0C\u4E00\u622A\u7C89\u767D\u5200\u67C4\u9732\u5728\u82B1\u76C6\u65C1\u3002" },
      { speaker: "\u89C1\u4E60\u5200\u5320\xB7\u831C", text: "\u5E08\u7236\u8BF4\u5B83\u4E0D\u5408\u89C4\u77E9\uFF0C\u53EB\u6211\u5168\u90E8\u62C6\u6389\u91CD\u6765\u3002" },
      { speaker: "\u89C1\u4E60\u5200\u5320\xB7\u831C", text: "\u662F\u4E0D\u662F\u53EA\u6709\u7167\u7740\u65E7\u6837\u5B50\u505A\uFF0C\u624D\u7B97\u771F\u6B63\u7684\u5200\u5320\uFF1F" }
    ],
    choices: [
      {
        id: "supply",
        label: "\u8865\u4E0A\u6539\u9020\u7528\u7684\u6750\u6599",
        outcome: "\u831C\u628A\u6728\u94C3\u62C6\u6210\u8F7B\u5DE7\u7684\u5C3E\u5760\uFF0C\u8BD5\u4F5C\u54C1\u53D1\u51FA\u4E86\u6E05\u4EAE\u7684\u7B2C\u4E00\u58F0\u3002",
        costs: { items: { bell_wood: 3, petal_sakura: 2 } },
        rewardPool: [
          {
            weight: 85,
            rewards: { gold: { min: 90, max: 150 }, items: { stone_enhance: { min: 3, max: 5 } } }
          },
          {
            weight: 15,
            rewards: { gold: { min: 150, max: 220 }, items: { stone_reforge: { min: 1, max: 1 } } }
          }
        ]
      },
      {
        id: "encourage",
        label: "\u8BA9\u5979\u6309\u81EA\u5DF1\u7684\u60F3\u6CD5\u5B8C\u6210",
        outcome: "\u831C\u62B1\u7D27\u8BD5\u4F5C\u54C1\uFF0C\u51B3\u5B9A\u660E\u65E9\u518D\u53BB\u6572\u4E00\u6B21\u5DE5\u574A\u7684\u95E8\u3002"
      }
    ]
  },
  {
    id: "enc_r1_petalsmith_first_blade",
    regionIds: ["r1"],
    unlockChapterId: "1-5",
    title: "\u5C5E\u4E8E\u81EA\u5DF1\u7684\u7B2C\u4E00\u628A\u5200",
    story: "\u7ED3\u754C\u524D\uFF0C\u831C\u6B63\u7B49\u5F85\u4E00\u4E2A\u613F\u610F\u66FF\u5979\u8BD5\u5200\u7684\u4EBA\u3002",
    speaker: "\u89C1\u4E60\u5200\u5320\xB7\u831C",
    glyph: "\u{1F5E1}\uFE0F",
    sceneAsset: "assets/encounters/scenes/akane/first-blade-gate.webp",
    initialPortrait: akanePortrait("first-blade-present"),
    climaxAsset: "assets/encounters/cg/akane-first-blade.webp",
    climaxAlt: "\u94F6\u767D\u77ED\u5200\u201C\u4E45\u63E1\u201D\u4E0E\u7C89\u767D\u5305\u67C4\u9759\u9759\u653E\u5728\u521D\u6B21\u76F8\u9047\u7684\u8349\u56FE\u4E0A\u3002",
    storyArc: {
      characterId: "char_akane",
      characterName: "\u89C1\u4E60\u5200\u5320\xB7\u831C",
      episode: 3,
      episodeLabel: "\u7B2C\u4E09\u5E55 \xB7 \u7B2C\u4E00\u628A\u81EA\u5DF1\u7684\u5200",
      requiredEncounterIds: ["enc_r1_petalsmith_doubt"],
      repeatable: false,
      storyChoices: [
        {
          id: "give_name",
          label: "\u201C\u5148\u7ED9\u5B83\u8D77\u4E2A\u540D\u5B57\u5427\u3002\u201D",
          responseDialogue: [
            {
              speaker: "\u89C1\u4E60\u5200\u5320\xB7\u831C",
              text: "\u540D\u5B57\uFF1F\u6211\u4E00\u76F4\u53EA\u6562\u53EB\u5B83\u201C\u8BD5\u4F5C\u7B2C\u4E03\u53F7\u201D\u2026\u2026",
              portraitCue: akanePortrait("give-name")
            },
            { speaker: "\u89C1\u4E60\u5200\u5320\xB7\u831C", text: "\u90A3\u5C31\u53EB\u201C\u4E45\u63E1\u201D\u3002\u56E0\u4E3A\u6709\u4EBA\u6559\u6211\uFF0C\u80FD\u966A\u4F34\u5F88\u4E45\u4E5F\u5F88\u4E86\u4E0D\u8D77\u3002" }
          ]
        },
        {
          id: "test_blade",
          label: "\u201C\u8BA9\u6211\u6765\u8BD5\u8BD5\u5B83\u7684\u624B\u611F\u3002\u201D",
          responseDialogue: [
            { text: "\u4F60\u63A5\u8FC7\u5200\u3002\u67D4\u8F6F\u7684\u5305\u67C4\u7A33\u7A33\u8D34\u5408\u638C\u5FC3\uFF0C\u6CA1\u6709\u4E00\u4E1D\u6ED1\u52A8\u3002" },
            {
              speaker: "\u89C1\u4E60\u5200\u5320\xB7\u831C",
              text: "\u4F60\u7684\u8868\u60C5\u5DF2\u7ECF\u544A\u8BC9\u6211\u7B54\u6848\u4E86\u2026\u2026\u6210\u529F\u4E86\uFF0C\u5BF9\u5427\uFF1F",
              portraitCue: akanePortrait("test-blade")
            }
          ]
        }
      ],
      memoryCallbacks: [
        {
          fromEncounterId: "enc_r1_petalsmith_doubt",
          choiceId: "ask_herself",
          dialogue: [{ speaker: "\u89C1\u4E60\u5200\u5320\xB7\u831C", text: "\u6211\u7EC8\u4E8E\u505A\u5B8C\u4E86\u90A3\u628A\u201C\u81EA\u5DF1\u4E5F\u559C\u6B22\u201D\u7684\u5200\u3002" }]
        },
        {
          fromEncounterId: "enc_r1_petalsmith_doubt",
          choiceId: "not_wrong",
          dialogue: [
            { speaker: "\u89C1\u4E60\u5200\u5320\xB7\u831C", text: "\u5E08\u7236\u6CA1\u6709\u5938\u6211\uFF0C\u4F46\u4E5F\u6CA1\u518D\u8BF4\u5B83\u662F\u9519\u7684\u3002\u8FD9\u6837\u5C31\u591F\u4E86\u3002" }
          ]
        }
      ]
    },
    dialogue: [
      { text: "\u7ED3\u754C\u7684\u5FAE\u5149\u843D\u5728\u4E00\u628A\u77ED\u5200\u4E0A\uFF0C\u7C89\u767D\u5305\u67C4\u5DF2\u7ECF\u78E8\u5F97\u5706\u6DA6\u59A5\u5E16\u3002" },
      { speaker: "\u89C1\u4E60\u5200\u5320\xB7\u831C", text: "\u8FD9\u662F\u6211\u6CA1\u6709\u7167\u4EFB\u4F55\u65E7\u56FE\u7EB8\u505A\u7684\u7B2C\u4E00\u628A\u5200\u3002" },
      { speaker: "\u89C1\u4E60\u5200\u5320\xB7\u831C", text: "\u4F60\u613F\u610F\u5F53\u7B2C\u4E00\u4E2A\u63A5\u8FC7\u5B83\u7684\u4EBA\u5417\uFF1F" }
    ],
    choices: [
      {
        id: "finish",
        label: "\u4E3A\u5200\u8865\u4E0A\u6700\u540E\u7684\u7ED3\u754C\u82AF",
        outcome: "\u5200\u8EAB\u4EAE\u8D77\u4E00\u7EBF\u6A31\u5149\u3002\u831C\u628A\u7B2C\u4E00\u679A\u6B63\u5F0F\u5200\u94ED\u90D1\u91CD\u4EA4\u7ED9\u4E86\u4F60\u3002",
        costs: { items: { core_barrier: 1, petal_sakura: 5 } },
        rewardPool: [
          {
            weight: 75,
            rewards: { gold: { min: 180, max: 280 }, items: { stone_reforge: { min: 1, max: 2 } } }
          },
          {
            weight: 25,
            rewards: { gold: { min: 280, max: 360 }, items: { stone_enhance: { min: 6, max: 9 } } }
          }
        ]
      },
      {
        id: "witness",
        label: "\u53EA\u66FF\u5979\u89C1\u8BC1\u8FD9\u4E00\u523B",
        outcome: "\u4F60\u5C06\u5200\u7A33\u7A33\u9012\u56DE\u3002\u831C\u7B2C\u4E00\u6B21\u4EE5\u5200\u5320\u7684\u793C\u8282\u5411\u4F60\u97A0\u8EAC\u3002"
      }
    ]
  },
  {
    id: "enc_r1_petalsmith_daily",
    regionIds: ["r1", "r2"],
    unlockChapterId: "1-5",
    title: "\u5200\u5320\u7684\u4F8B\u884C\u8BD5\u63E1",
    sceneAsset: "assets/encounters/scenes/akane/daily-blind-grip.webp",
    initialPortrait: akanePortrait("blind-grip-trust"),
    story: "\u831C\u53C8\u5E26\u7740\u65B0\u7684\u5305\u67C4\u6837\u54C1\u6765\u627E\u5979\u6700\u4FE1\u4EFB\u7684\u8BD5\u63E1\u4EBA\u3002",
    speaker: "\u5200\u5320\xB7\u831C",
    glyph: "\u{1F338}",
    storyArc: {
      characterId: "char_akane",
      characterName: "\u5200\u5320\xB7\u831C",
      episode: 4,
      episodeLabel: "\u65E5\u5E38 \xB7 \u65B0\u4F5C\u8BD5\u63E1",
      requiredEncounterIds: ["enc_r1_petalsmith_first_blade"],
      repeatable: true,
      storyChoices: [
        {
          id: "soft",
          label: "\u201C\u8FD9\u6B21\u66F4\u67D4\u8F6F\u4E86\u3002\u201D",
          responseDialogue: [
            {
              speaker: "\u5200\u5320\xB7\u831C",
              text: "\u4F60\u7684\u624B\u611F\u8FD8\u662F\u8FD9\u4E48\u51C6\uFF01\u6211\u53C8\u5C11\u8D70\u4E00\u6761\u5F2F\u8DEF\u3002",
              portraitCue: akanePortrait("soft-response")
            }
          ]
        },
        {
          id: "steady",
          label: "\u201C\u63E1\u8D77\u6765\u5F88\u7A33\u3002\u201D",
          responseDialogue: [
            {
              speaker: "\u5200\u5320\xB7\u831C",
              text: "\u563F\u563F\uFF0C\u90A3\u6211\u5C31\u6562\u628A\u5B83\u4EA4\u7ED9\u771F\u6B63\u7684\u5BA2\u4EBA\u4E86\u3002",
              portraitCue: akanePortrait("steady-response")
            }
          ]
        }
      ]
    },
    dailyVariants: [
      {
        id: "blind_grip",
        title: "\u95ED\u773C\u8BD5\u63E1\u7684\u65B0\u4F5C",
        story: "\u831C\u628A\u4E24\u622A\u65B0\u5305\u67C4\u85CF\u5230\u8EAB\u540E\uFF0C\u7B49\u4F60\u53EA\u51ED\u624B\u611F\u9009\u51FA\u66F4\u597D\u7684\u4E00\u622A\u3002",
        sceneAsset: "assets/encounters/scenes/akane/daily-blind-grip.webp",
        initialPortrait: akanePortrait("blind-grip-trust"),
        relationshipDialogue: {
          \u521D\u9047: [{ speaker: "\u5200\u5320\xB7\u831C", text: "\u90A3\u4E2A\u2026\u2026\u8FD8\u613F\u610F\u5E2E\u6211\u8BD5\u4E00\u6B21\u5417\uFF1F" }],
          \u719F\u6089: [{ speaker: "\u5200\u5320\xB7\u831C", text: "\u4F60\u4E0A\u6B21\u8BF4\u7684\u624B\u611F\uFF0C\u6211\u4E00\u76F4\u8BB0\u5728\u8349\u56FE\u8FB9\u4E0A\u3002" }],
          \u4EB2\u8FD1: [{ speaker: "\u5200\u5320\xB7\u831C", text: "\u8FD9\u6B21\u6211\u8FD8\u6CA1\u7ED9\u5E08\u7236\u770B\uFF0C\u60F3\u5148\u542C\u4F60\u7684\u3002" }],
          \u4FE1\u8D56: [{ speaker: "\u5200\u5320\xB7\u831C", text: "\u8001\u642D\u6863\uFF0C\u624B\u501F\u6211\u4E00\u4E0B\uFF01\u53EA\u501F\u4E00\u5C0F\u4F1A\u513F\u3002" }]
        },
        dialogue: [
          { speaker: "\u5200\u5320\xB7\u831C", text: "\u95ED\u4E0A\u773C\uFF0C\u53EA\u51ED\u624B\u611F\u5E2E\u6211\u6311\u4E00\u6761\u3002\u53EF\u4E0D\u8BB8\u5077\u770B\u54E6\uFF01" },
          { text: "\u5979\u628A\u4E24\u622A\u5305\u67C4\u85CF\u5728\u80CC\u540E\uFF0C\u795E\u60C5\u5DF2\u7ECF\u6BD4\u7B2C\u4E00\u6B21\u89C1\u9762\u65F6\u4ECE\u5BB9\u8BB8\u591A\u3002" }
        ]
      },
      {
        id: "rain_wrap",
        title: "\u96E8\u5929\u4E5F\u63E1\u5F97\u4F4F",
        story: "\u4E00\u573A\u5C0F\u96E8\u8BA9\u831C\u53D1\u73B0\u65B0\u5200\u67C4\u592A\u6ED1\uFF0C\u5979\u62B1\u7740\u4E09\u5377\u7F20\u5E26\u8FFD\u4E0A\u4E86\u4F60\u3002",
        sceneAsset: "assets/encounters/scenes/akane/daily-rain-wrap.webp",
        initialPortrait: akanePortrait("rain-wrap-trust"),
        relationshipDialogue: {
          \u521D\u9047: [{ speaker: "\u5200\u5320\xB7\u831C", text: "\u53C8\u3001\u53C8\u89C1\u9762\u4E86\uFF01\u8FD9\u6B21\u4E0D\u662F\u574F\u6389\uFF0C\u53EA\u662F\u6709\u70B9\u6ED1\u3002" }],
          \u719F\u6089: [{ speaker: "\u5200\u5320\xB7\u831C", text: "\u6211\u7167\u4F60\u7684\u529E\u6CD5\u6539\u8F6F\u4E86\uFF0C\u53EF\u96E8\u5929\u53C8\u5192\u51FA\u65B0\u95EE\u9898\u3002" }],
          \u4EB2\u8FD1: [{ speaker: "\u5200\u5320\xB7\u831C", text: "\u6211\u77E5\u9053\u4F60\u4E0D\u4F1A\u53EA\u8BF4\u597D\u542C\u8BDD\uFF0C\u6240\u4EE5\u624D\u6765\u627E\u4F60\u3002" }],
          \u4FE1\u8D56: [{ speaker: "\u5200\u5320\xB7\u831C", text: "\u679C\u7136\u5728\u8FD9\u91CC\uFF01\u5FEB\u6765\u6551\u6551\u6211\u8FD9\u5377\u4E0D\u4E89\u6C14\u7684\u7F20\u5E26\u3002" }]
        },
        dialogue: [
          { speaker: "\u5200\u5320\xB7\u831C", text: "\u8FD9\u4E09\u79CD\u7F20\u6CD5\u90FD\u4E0D\u4F1A\u5438\u6C34\uFF0C\u4F60\u5E2E\u6211\u770B\u770B\u54EA\u4E00\u79CD\u66F4\u8D34\u624B\uFF1F" },
          { text: "\u7EC6\u5BC6\u7684\u96E8\u73E0\u6CBF\u7740\u5200\u9798\u6ED1\u843D\uFF0C\u7F20\u5E26\u5374\u4ECD\u5E26\u7740\u6696\u6696\u7684\u5DE5\u574A\u6C14\u606F\u3002" }
        ]
      },
      {
        id: "small_hands",
        title: "\u7ED9\u5C0F\u624B\u5BA2\u4EBA\u7684\u5200\u67C4",
        story: "\u831C\u63A5\u5230\u4E00\u4EFD\u7279\u522B\u8BA2\u5355\uFF1A\u4E3A\u624B\u638C\u5F88\u5C0F\u7684\u5BA2\u4EBA\u505A\u4E00\u628A\u4E0D\u4F1A\u7D2F\u7684\u7EC3\u4E60\u5200\u3002",
        sceneAsset: "assets/encounters/scenes/akane/daily-small-hands.webp",
        initialPortrait: akanePortrait("small-hands-trust"),
        relationshipDialogue: {
          \u521D\u9047: [{ speaker: "\u5200\u5320\xB7\u831C", text: "\u4F60\u770B\u8D77\u6765\u5F88\u4F1A\u66FF\u522B\u4EBA\u8003\u8651\u2026\u2026\u53EF\u4EE5\u5E2E\u6211\u60F3\u60F3\u5417\uFF1F" }],
          \u719F\u6089: [{ speaker: "\u5200\u5320\xB7\u831C", text: "\u4F60\u8BF4\u8FC7\u63E1\u5F97\u4E45\u6BD4\u770B\u8D77\u6765\u5A01\u98CE\u66F4\u91CD\u8981\uFF0C\u6211\u6CA1\u6709\u5FD8\u3002" }],
          \u4EB2\u8FD1: [{ speaker: "\u5200\u5320\xB7\u831C", text: "\u8FD9\u4EFD\u8BA2\u5355\u8BA9\u6211\u60F3\u8D77\u7B2C\u4E00\u6B21\u9047\u89C1\u4F60\u7684\u90A3\u5929\u3002" }],
          \u4FE1\u8D56: [{ speaker: "\u5200\u5320\xB7\u831C", text: "\u8FD9\u628A\u5200\u7684\u7B2C\u4E00\u4F4D\u8BD5\u63E1\u4EBA\uFF0C\u5F53\u7136\u8FD8\u662F\u4F60\u3002" }]
        },
        dialogue: [
          { speaker: "\u5200\u5320\xB7\u831C", text: "\u6211\u628A\u91CD\u5FC3\u5F80\u524D\u632A\u4E86\u4E00\u70B9\uFF0C\u624B\u67C4\u4E5F\u6536\u7EC6\u4E86\u3002\u4F60\u89C9\u5F97\u4F1A\u4E0D\u4F1A\u592A\u8F6F\uFF1F" },
          { text: "\u5979\u5C0F\u5FC3\u6258\u7740\u90A3\u628A\u672A\u5F00\u5203\u7684\u7EC3\u4E60\u5200\uFF0C\u50CF\u6258\u7740\u67D0\u4E2A\u4EBA\u521A\u521A\u840C\u82BD\u7684\u52C7\u6C14\u3002" }
        ]
      }
    ],
    supportTiers: [
      {
        unlockChapterId: "1-5",
        choice: {
          id: "materials",
          label: "\u7559\u4E0B\u4E9B\u4E0B\u6B21\u8BD5\u4F5C\u7528\u7684\u6750\u6599",
          outcome: "\u831C\u8BB0\u4E0B\u4F60\u7684\u8BC4\u4EF7\uFF0C\u4E5F\u585E\u6765\u4E00\u5C0F\u5305\u5DE5\u574A\u8FB9\u89D2\u6599\u3002",
          costs: { items: { petal_sakura: 3, grass_soft: 2 } },
          rewardPool: [
            {
              weight: 90,
              rewards: { gold: { min: 40, max: 90 }, items: { stone_enhance: { min: 2, max: 4 } } }
            },
            {
              weight: 10,
              rewards: {
                gold: { min: 90, max: 140 },
                items: { stone_reforge: { min: 1, max: 1 } }
              }
            }
          ]
        }
      },
      {
        unlockChapterId: "2-2",
        choice: {
          id: "materials",
          label: "\u7559\u4E9B\u8349\u539F\u6346\u624E\u6750\u6599",
          outcome: "\u831C\u628A\u65B0\u6750\u6599\u6536\u8FDB\u5DE5\u5177\u888B\uFF0C\u56DE\u8D60\u4E86\u6253\u78E8\u65F6\u7559\u4E0B\u7684\u597D\u4E1C\u897F\u3002",
          costs: { items: { straw_sleepy: 3, jelly_cotton: 2 } },
          rewardPool: [
            {
              weight: 90,
              rewards: {
                gold: { min: 60, max: 110 },
                items: { stone_enhance: { min: 3, max: 5 } }
              }
            },
            {
              weight: 10,
              rewards: {
                gold: { min: 110, max: 170 },
                items: { stone_reforge: { min: 1, max: 2 } }
              }
            }
          ]
        }
      },
      {
        unlockChapterId: "2-3",
        choice: {
          id: "materials",
          label: "\u7559\u4E9B\u9632\u6F6E\u7684\u8702\u5DE2\u6750\u6599",
          outcome: "\u831C\u773C\u775B\u4E00\u4EAE\uFF0C\u8BF4\u8FD9\u6B21\u7EC8\u4E8E\u80FD\u505A\u51FA\u4E0D\u6015\u96E8\u7684\u5305\u67C4\u4E86\u3002",
          costs: { items: { honey_bee: 1, jelly_cotton: 3 } },
          rewardPool: [
            {
              weight: 88,
              rewards: {
                gold: { min: 80, max: 140 },
                items: { stone_enhance: { min: 3, max: 6 } }
              }
            },
            {
              weight: 12,
              rewards: {
                gold: { min: 120, max: 190 },
                items: { stone_reforge: { min: 1, max: 2 } }
              }
            }
          ]
        }
      },
      {
        unlockChapterId: "2-5",
        choice: {
          id: "materials",
          label: "\u7559\u4E0B\u4E00\u679A\u796D\u575B\u7ED3\u6676",
          outcome: "\u7ED3\u6676\u5728\u5200\u67C4\u91CC\u5316\u6210\u4E00\u7EBF\u5FAE\u5149\uFF0C\u831C\u90D1\u91CD\u6536\u597D\u5269\u4F59\u7684\u5DE5\u574A\u56DE\u793C\u3002",
          costs: { items: { crystal_altar: 1, jelly_cotton: 2 } },
          rewardPool: [
            {
              weight: 85,
              rewards: {
                gold: { min: 100, max: 180 },
                items: { stone_enhance: { min: 10, max: 12 } }
              }
            },
            {
              weight: 15,
              rewards: {
                gold: { min: 100, max: 180 },
                items: { stone_reforge: { min: 2, max: 3 } }
              }
            }
          ]
        }
      }
    ],
    dialogue: [
      { speaker: "\u5200\u5320\xB7\u831C", text: "\u6765\u5F97\u6B63\u597D\uFF01\u95ED\u4E0A\u773C\uFF0C\u53EA\u51ED\u624B\u611F\u5E2E\u6211\u6311\u4E00\u6761\u3002" },
      { text: "\u5979\u628A\u4E24\u622A\u5305\u67C4\u85CF\u5728\u80CC\u540E\uFF0C\u795E\u60C5\u5DF2\u7ECF\u6BD4\u7B2C\u4E00\u6B21\u89C1\u9762\u65F6\u4ECE\u5BB9\u8BB8\u591A\u3002" }
    ],
    choices: [
      {
        id: "materials",
        label: "\u7559\u4E0B\u4E9B\u4E0B\u6B21\u8BD5\u4F5C\u7528\u7684\u6750\u6599",
        outcome: "\u831C\u8BB0\u4E0B\u4F60\u7684\u8BC4\u4EF7\uFF0C\u4E5F\u585E\u6765\u4E00\u5C0F\u5305\u5DE5\u574A\u8FB9\u89D2\u6599\u3002",
        costs: { items: { petal_sakura: 3, grass_soft: 2 } },
        rewardPool: [
          {
            weight: 90,
            rewards: { gold: { min: 40, max: 90 }, items: { stone_enhance: { min: 2, max: 4 } } }
          },
          {
            weight: 10,
            rewards: { gold: { min: 90, max: 140 }, items: { stone_reforge: { min: 1, max: 1 } } }
          }
        ]
      },
      {
        id: "next_time",
        label: "\u7EA6\u597D\u4E0B\u6B21\u518D\u6765",
        outcome: "\u831C\u6325\u7740\u8349\u56FE\u8DD1\u56DE\u5DE5\u574A\uFF0C\u80CC\u5F71\u50CF\u4E00\u74E3\u8F7B\u5FEB\u7684\u6A31\u82B1\u3002"
      }
    ]
  },
  {
    id: "enc_r1_bell",
    regionIds: ["r1"],
    unlockChapterId: "1-3",
    title: "\u4F1A\u81EA\u5DF1\u54CD\u7684\u6728\u94C3",
    story: "\u6797\u95F4\u4F20\u6765\u6E05\u8106\u94C3\u58F0\uFF0C\u4E00\u53EA\u5C0F\u6728\u7075\u60F3\u6536\u56DE\u6563\u843D\u7684\u6728\u94C3\u3002",
    speaker: "\u6728\u94C3",
    glyph: "\u{1F514}",
    sceneAsset: "assets/encounters/scenes/ordinary/r1-bell-path.webp",
    initialPortrait: null,
    dialogue: [
      { text: "\u6797\u95F4\u5C0F\u5F84\u7684\u6811\u679D\u4E0A\uFF0C\u6302\u7740\u4E00\u53EA\u6CA1\u6709\u98CE\u4E5F\u5728\u54CD\u7684\u6728\u94C3\u3002" },
      { speaker: "\u6728\u94C3", text: "\u53EE\u94C3\u2014\u2014\u53EE\u94C3\u2014\u2014" },
      { text: "\u94C3\u58F0\u542C\u8D77\u6765\u2026\u2026\u50CF\u662F\u5728\u53EB\u4F60\u8FC7\u53BB\u3002" }
    ],
    choices: [
      {
        id: "return",
        label: "\u5F52\u8FD8\u6728\u94C3",
        outcome: "\u5C0F\u6728\u7075\u5F00\u5FC3\u5730\u7FFB\u51FA\u4E00\u888B\u65E7\u65E5\u77FF\u77F3\u4F5C\u4E3A\u8C22\u793C\u3002",
        costs: { items: { bell_wood: 3 } },
        rewardPool: [
          {
            weight: 85,
            rewards: { gold: { min: 60, max: 100 }, items: { stone_enhance: { min: 2, max: 4 } } }
          },
          {
            weight: 15,
            rewards: { gold: { min: 100, max: 160 }, items: { stone_reforge: { min: 1, max: 1 } } }
          }
        ]
      },
      { id: "listen", label: "\u542C\u4E00\u4F1A\u513F\u94C3\u58F0", outcome: "\u98CE\u58F0\u548C\u94C3\u58F0\u4EA4\u7EC7\uFF0C\u8BA9\u8FD9\u6BB5\u8DEF\u8F7B\u5FEB\u4E86\u4E0D\u5C11\u3002" }
    ]
  },
  {
    id: "enc_r1_barrier",
    regionIds: ["r1"],
    unlockChapterId: "1-5",
    title: "\u5FAE\u5FAE\u53D1\u4EAE\u7684\u88C2\u9699",
    sceneAsset: "assets/encounters/scenes/ordinary/r1-barrier-glade.webp",
    initialPortrait: null,
    story: "\u843D\u6A31\u7ED3\u754C\u88C2\u5F00\u4E86\u4E00\u9053\u7EC6\u7F1D\uFF0C\u6E29\u6696\u7684\u5149\u6B63\u4E00\u70B9\u70B9\u6F0F\u51FA\u6765\u3002",
    speaker: "\u7ED3\u754C\u88C2\u9699",
    glyph: "\u2728",
    dialogue: [
      { text: "\u843D\u6A31\u7ED3\u754C\u7684\u8FB9\u7F18\u88C2\u5F00\u4E00\u9053\u7EC6\u7F1D\uFF0C\u7F1D\u91CC\u900F\u51FA\u6E29\u541E\u541E\u7684\u5149\u3002" },
      { text: "\u628A\u624B\u4F38\u8FDB\u53BB\u4F3C\u4E4E\u80FD\u6478\u5230\u4EC0\u4E48\uFF0C\u4F46\u4E5F\u53EF\u80FD\u53EA\u662F\u9519\u89C9\u3002" }
    ],
    choices: [
      {
        id: "mend",
        label: "\u4FEE\u8865\u7ED3\u754C",
        outcome: "\u88C2\u9699\u6062\u590D\u5E73\u9759\uFF0C\u7ED3\u754C\u51DD\u6210\u4E86\u4E00\u4EFD\u770B\u4E0D\u900F\u7684\u56DE\u793C\u3002",
        costs: { items: { core_barrier: 1, petal_sakura: 4 } },
        rewardPool: [
          {
            weight: 75,
            rewards: { gold: { min: 120, max: 220 }, items: { stone_reforge: { min: 1, max: 2 } } }
          },
          {
            weight: 25,
            rewards: { gold: { min: 220, max: 300 }, items: { stone_enhance: { min: 5, max: 8 } } }
          }
        ]
      },
      { id: "leave", label: "\u5148\u4E0D\u89E6\u78B0", outcome: "\u4F60\u8BB0\u4E0B\u4E86\u4F4D\u7F6E\uFF0C\u5B89\u9759\u5730\u79BB\u5F00\u4E86\u7ED3\u754C\u3002" }
    ]
  },
  {
    id: "enc_r2_napper",
    regionIds: ["r2"],
    unlockChapterId: "2-2",
    title: "\u7761\u8FC7\u7AD9\u7684\u8349\u539F\u4FE1\u4F7F",
    story: "\u4FE1\u4F7F\u62B1\u7740\u5305\u88F9\u7761\u5728\u8349\u579B\u65C1\uFF0C\u9192\u6765\u540E\u53D1\u73B0\u6346\u5305\u6750\u6599\u5168\u6563\u4E86\u3002",
    speaker: "\u8349\u539F\u4FE1\u4F7F\xB7\u7A57",
    glyph: "\u{1F4A4}",
    sceneAsset: "assets/encounters/scenes/sui/hayfield-wakeup.webp",
    initialPortrait: suiPortrait("hay-sleep"),
    storyArc: {
      characterId: "char_sui",
      characterName: "\u8349\u539F\u4FE1\u4F7F\xB7\u7A57",
      episode: 1,
      episodeLabel: "\u7B2C\u4E00\u5E55 \xB7 \u7761\u8FC7\u7AD9\u7684\u4FE1\u4F7F",
      requiredEncounterIds: [],
      repeatable: false,
      storyChoices: [
        {
          id: "take_breath",
          label: "\u201C\u5148\u559D\u53E3\u6C34\uFF0C\u518D\u60F3\u600E\u4E48\u8865\u6551\u3002\u201D",
          responseDialogue: [
            {
              speaker: "\u8349\u539F\u4FE1\u4F7F\xB7\u7A57",
              text: "\u4F60\u5C45\u7136\u6CA1\u5148\u9A82\u6211\u2026\u2026\u90A3\u6211\u3001\u6211\u53EA\u4F11\u606F\u8FD9\u4E00\u5C0F\u53E3\uFF01",
              portraitCue: suiPortrait("take-breath")
            },
            { text: "\u5979\u8BA4\u771F\u559D\u4E86\u4E00\u53E3\u6C34\uFF0C\u7EC8\u4E8E\u628A\u4FE1\u888B\u80CC\u6B63\u3002" }
          ]
        },
        {
          id: "go_together",
          label: "\u201C\u8D70\u5427\uFF0C\u6211\u966A\u4F60\u628A\u8FD9\u8D9F\u9001\u5B8C\u3002\u201D",
          responseDialogue: [
            {
              speaker: "\u8349\u539F\u4FE1\u4F7F\xB7\u7A57",
              text: "\u771F\u3001\u771F\u7684\uFF1F\u6709\u4EBA\u4E00\u8D77\u8D70\uFF0C\u6211\u80AF\u5B9A\u4E0D\u4F1A\u518D\u7761\u7740\uFF01",
              portraitCue: suiPortrait("go-together")
            },
            { text: "\u5979\u63E1\u7D27\u80A9\u5E26\uFF0C\u7B2C\u4E00\u6B21\u8DD1\u5728\u4E86\u4F60\u7684\u524D\u9762\u3002" }
          ]
        }
      ]
    },
    dialogue: [
      { text: "\u8349\u579B\u65C1\u501A\u7740\u4E00\u4F4D\u80CC\u7740\u4FE1\u888B\u7684\u5E74\u8F7B\u4FE1\u4F7F\uFF0C\u7761\u5F97\u6B63\u9999\u3002" },
      { speaker: "\u8349\u539F\u4FE1\u4F7F\xB7\u7A57", text: "\u547C\u2026\u2026\u55EF\u2026\u2026\u518D\u3001\u518D\u4E94\u5206\u949F\u2026\u2026" },
      { text: "\u5979\u7684\u4FE1\u888B\u522B\u7740\u892A\u8272\u7684\u6025\u4EF6\u5C01\u8721\uFF0C\u5BC4\u51FA\u65E5\u671F\u5DF2\u7ECF\u662F\u4E09\u5929\u524D\u3002" }
    ],
    choices: [
      {
        id: "bundle",
        label: "\u5E2E\u5979\u91CD\u65B0\u6346\u597D",
        outcome: "\u5305\u88F9\u7EC8\u4E8E\u624E\u7A33\uFF0C\u4FE1\u4F7F\u4ECE\u884C\u56CA\u91CC\u6478\u51FA\u4E86\u4E00\u4EFD\u8C22\u793C\u3002",
        costs: { items: { straw_sleepy: 4, jelly_cotton: 3 } },
        rewardPool: [
          {
            weight: 90,
            rewards: { gold: { min: 40, max: 80 }, items: { stone_enhance: { min: 2, max: 4 } } }
          },
          {
            weight: 10,
            rewards: { gold: { min: 80, max: 140 }, items: { stone_reforge: { min: 1, max: 1 } } }
          }
        ]
      },
      { id: "wake", label: "\u63D0\u9192\u5979\u522B\u518D\u7761\u4E86", outcome: "\u5979\u8BA4\u771F\u5730\u70B9\u5934\uFF0C\u7136\u540E\u7AD9\u7740\u53C8\u6253\u4E86\u4E2A\u54C8\u6B20\u3002" }
    ]
  },
  {
    id: "enc_r2_napper_old_letter",
    regionIds: ["r2"],
    unlockChapterId: "2-3",
    title: "\u8FDF\u5230\u4E86\u4E09\u5929\u7684\u65E7\u4FE1",
    sceneAsset: "assets/encounters/scenes/sui/old-letter-door.webp",
    initialPortrait: suiPortrait("old-letter-anxious"),
    story: "\u7A57\u5728\u8702\u5DE2\u5916\u8E0C\u8E87\u4E0D\u524D\uFF0C\u4FE1\u888B\u91CC\u90A3\u5C01\u65E7\u4FE1\u4ECD\u6CA1\u6709\u9001\u51FA\u53BB\u3002",
    speaker: "\u8349\u539F\u4FE1\u4F7F\xB7\u7A57",
    glyph: "\u2709\uFE0F",
    storyArc: {
      characterId: "char_sui",
      characterName: "\u8349\u539F\u4FE1\u4F7F\xB7\u7A57",
      episode: 2,
      episodeLabel: "\u7B2C\u4E8C\u5E55 \xB7 \u8FDF\u5230\u7684\u4FE1",
      requiredEncounterIds: ["enc_r2_napper"],
      repeatable: false,
      storyChoices: [
        {
          id: "apologize",
          label: "\u201C\u4EB2\u624B\u4EA4\u51FA\u53BB\uFF0C\u4E5F\u4EB2\u53E3\u9053\u6B49\u3002\u201D",
          responseDialogue: [
            {
              speaker: "\u8349\u539F\u4FE1\u4F7F\xB7\u7A57",
              text: "\u5C31\u7B97\u4F1A\u88AB\u9A82\uFF0C\u4E5F\u6BD4\u8BA9\u5B83\u6C38\u8FDC\u8EBA\u5728\u888B\u5B50\u91CC\u597D\u3002",
              portraitCue: suiPortrait("apologize")
            },
            { speaker: "\u8349\u539F\u4FE1\u4F7F\xB7\u7A57", text: "\u4F60\u80FD\u2026\u2026\u5728\u95E8\u5916\u7B49\u6211\u4E00\u4E0B\u5417\uFF1F" }
          ]
        },
        {
          id: "still_matters",
          label: "\u201C\u8FDF\u5230\u7684\u4FE1\uFF0C\u4E5F\u53EF\u80FD\u4ECD\u6709\u4EBA\u7B49\u3002\u201D",
          responseDialogue: [
            {
              speaker: "\u8349\u539F\u4FE1\u4F7F\xB7\u7A57",
              text: "\u539F\u6765\u9001\u4FE1\u4E0D\u662F\u548C\u65F6\u95F4\u8D5B\u8DD1\uFF0C\u662F\u628A\u5FC3\u610F\u9001\u5230\u554A\u3002",
              portraitCue: suiPortrait("still-matters")
            },
            { speaker: "\u8349\u539F\u4FE1\u4F7F\xB7\u7A57", text: "\u90A3\u6211\u66F4\u4E0D\u80FD\u628A\u5B83\u4E22\u6389\u3002" }
          ]
        }
      ],
      memoryCallbacks: [
        {
          fromEncounterId: "enc_r2_napper",
          choiceId: "take_breath",
          dialogue: [{ speaker: "\u8349\u539F\u4FE1\u4F7F\xB7\u7A57", text: "\u6211\u6709\u7167\u4F60\u8BF4\u7684\u5148\u51B7\u9759\uFF0C\u53EF\u8D70\u5230\u95E8\u53E3\u8FD8\u662F\u5BB3\u6015\u3002" }]
        },
        {
          fromEncounterId: "enc_r2_napper",
          choiceId: "go_together",
          dialogue: [
            { speaker: "\u8349\u539F\u4FE1\u4F7F\xB7\u7A57", text: "\u4E0A\u6B21\u6709\u4F60\u966A\u7740\u624D\u9001\u5B8C\uFF0C\u8FD9\u6B21\u6211\u60F3\u8BD5\u7740\u81EA\u5DF1\u8D70\u5230\u95E8\u524D\u3002" }
          ]
        }
      ]
    },
    dialogue: [
      { text: "\u8702\u5DE2\u5C0F\u5C4B\u8FD1\u5728\u773C\u524D\uFF0C\u7A57\u5374\u7ED5\u7740\u540C\u4E00\u5757\u77F3\u5934\u8D70\u4E86\u7B2C\u4E09\u5708\u3002" },
      { speaker: "\u8349\u539F\u4FE1\u4F7F\xB7\u7A57", text: "\u8FD9\u5C01\u4FE1\u5DF2\u7ECF\u8FDF\u5230\u4E09\u5929\u4E86\u3002\u73B0\u5728\u9001\u8FDB\u53BB\uFF0C\u53EA\u4F1A\u8BA9\u4EBA\u66F4\u751F\u6C14\u5427\uFF1F" },
      { speaker: "\u8349\u539F\u4FE1\u4F7F\xB7\u7A57", text: "\u8981\u4E0D\u2026\u2026\u5C31\u5F53\u5B83\u4ECE\u6765\u6CA1\u6709\u5BC4\u51FA\u8FC7\uFF1F" }
    ],
    choices: [
      {
        id: "sweeten",
        label: "\u51C6\u5907\u4E00\u4EFD\u8FDF\u5230\u7684\u8D54\u793C",
        outcome: "\u95E8\u5F88\u5FEB\u6253\u5F00\u3002\u6536\u4FE1\u4EBA\u6CA1\u6709\u8D23\u602A\uFF0C\u53EA\u9012\u7ED9\u7A57\u4E00\u676F\u6E29\u70ED\u7684\u871C\u8336\u3002",
        costs: { items: { honey_bee: 2, jelly_cotton: 2 } },
        rewardPool: [
          {
            weight: 85,
            rewards: { gold: { min: 90, max: 150 }, items: { stone_enhance: { min: 3, max: 5 } } }
          },
          {
            weight: 15,
            rewards: { gold: { min: 150, max: 210 }, items: { stone_reforge: { min: 1, max: 1 } } }
          }
        ]
      },
      {
        id: "wait_outside",
        label: "\u5728\u95E8\u5916\u7B49\u5979",
        outcome: "\u7247\u523B\u540E\uFF0C\u7A57\u7EA2\u7740\u773C\u775B\u8DD1\u51FA\u6765\uFF0C\u5374\u7B11\u5F97\u6BD4\u8349\u539F\u4E0A\u7684\u592A\u9633\u8FD8\u4EAE\u3002"
      }
    ]
  },
  {
    id: "enc_r2_napper_true_delivery",
    regionIds: ["r2"],
    unlockChapterId: "2-5",
    title: "\u7EDD\u5BF9\u4E0D\u80FD\u8FDF\u5230\u7684\u4E00\u5C01\u4FE1",
    story: "\u796D\u575B\u98CE\u66B4\u5C06\u9053\u8DEF\u5439\u5F97\u6A21\u7CCA\uFF0C\u7A57\u5374\u7B2C\u4E00\u6B21\u6CA1\u6709\u505C\u4E0B\u811A\u6B65\u3002",
    speaker: "\u8349\u539F\u4FE1\u4F7F\xB7\u7A57",
    glyph: "\u{1F4E8}",
    sceneAsset: "assets/encounters/scenes/sui/storm-delivery.webp",
    initialPortrait: suiPortrait("storm-run-ready"),
    climaxAsset: "assets/encounters/cg/sui-return-letter.webp",
    climaxAlt: "\u84DD\u8FB9\u56DE\u4FE1\u4E0E\u78E8\u4EAE\u7684\u4FE1\u4F7F\u5FBD\u7AE0\u5E76\u6392\u538B\u5728\u65E7\u5730\u56FE\u548C\u7EA2\u8272\u706B\u6F06\u65C1\u3002",
    storyArc: {
      characterId: "char_sui",
      characterName: "\u8349\u539F\u4FE1\u4F7F\xB7\u7A57",
      episode: 3,
      episodeLabel: "\u7B2C\u4E09\u5E55 \xB7 \u8FD9\u6B21\u4E0D\u4F1A\u8FDF\u5230",
      requiredEncounterIds: ["enc_r2_napper_old_letter"],
      repeatable: false,
      storyChoices: [
        {
          id: "trust_her",
          label: "\u201C\u8FD9\u4E00\u6B21\uFF0C\u6211\u5728\u7EC8\u70B9\u7B49\u4F60\u3002\u201D",
          responseDialogue: [
            {
              speaker: "\u8349\u539F\u4FE1\u4F7F\xB7\u7A57",
              text: "\u55EF\uFF01\u5982\u679C\u7EC8\u70B9\u6709\u4EBA\u7B49\uFF0C\u6211\u5C31\u4E0D\u4F1A\u5728\u534A\u8DEF\u505C\u4E0B\u3002",
              portraitCue: suiPortrait("trust-her")
            },
            { text: "\u5979\u538B\u4F4E\u8EAB\u4F53\u51B2\u8FDB\u8349\u6D6A\uFF0C\u6CA1\u6709\u518D\u56DE\u5934\u786E\u8BA4\u4F60\u662F\u5426\u8DDF\u4E0A\u3002" }
          ]
        },
        {
          id: "run_beside",
          label: "\u201C\u6700\u540E\u4E00\u6BB5\uFF0C\u6211\u4EEC\u5E76\u80A9\u8DD1\u3002\u201D",
          responseDialogue: [
            {
              speaker: "\u8349\u539F\u4FE1\u4F7F\xB7\u7A57",
              text: "\u8FD9\u6B21\u53EF\u4E0D\u662F\u4F60\u5E26\u7740\u6211\uFF0C\u662F\u6211\u5E26\u8DEF\uFF01",
              portraitCue: suiPortrait("run-beside")
            },
            { text: "\u5979\u8FCE\u7740\u98CE\u7B11\u8D77\u6765\uFF0C\u811A\u6B65\u6E05\u695A\u800C\u575A\u5B9A\u3002" }
          ]
        }
      ],
      memoryCallbacks: [
        {
          fromEncounterId: "enc_r2_napper_old_letter",
          choiceId: "apologize",
          dialogue: [
            { speaker: "\u8349\u539F\u4FE1\u4F7F\xB7\u7A57", text: "\u6211\u5DF2\u7ECF\u5B66\u4F1A\u4E3A\u8FDF\u5230\u9053\u6B49\uFF0C\u6240\u4EE5\u8FD9\u6B21\u66F4\u60F3\u51C6\u65F6\u62B5\u8FBE\u3002" }
          ]
        },
        {
          fromEncounterId: "enc_r2_napper_old_letter",
          choiceId: "still_matters",
          dialogue: [
            { speaker: "\u8349\u539F\u4FE1\u4F7F\xB7\u7A57", text: "\u6709\u4EBA\u5728\u7B49\u8FD9\u5C01\u4FE1\u3002\u5149\u662F\u60F3\u5230\u8FD9\u4EF6\u4E8B\uFF0C\u6211\u5C31\u4E00\u70B9\u4E5F\u4E0D\u56F0\u4E86\u3002" }
          ]
        }
      ]
    },
    dialogue: [
      { text: "\u796D\u575B\u65B9\u5411\u7684\u98CE\u628A\u8DEF\u6807\u5439\u6B6A\uFF0C\u4E00\u5C01\u52A0\u6025\u4FE1\u5728\u7A57\u7684\u6000\u91CC\u53D1\u51FA\u8F7B\u54CD\u3002" },
      { speaker: "\u8349\u539F\u4FE1\u4F7F\xB7\u7A57", text: "\u4ECE\u524D\u7684\u6211\u4E00\u5B9A\u4F1A\u627E\u4E2A\u8349\u579B\u8EB2\u5230\u98CE\u505C\u3002" },
      { speaker: "\u8349\u539F\u4FE1\u4F7F\xB7\u7A57", text: "\u4F46\u4ECA\u5929\uFF0C\u6211\u60F3\u6210\u4E3A\u4E00\u4E2A\u771F\u6B63\u80FD\u628A\u4FE1\u9001\u5230\u7684\u4EBA\u3002" }
    ],
    choices: [
      {
        id: "wind_charm",
        label: "\u7528\u796D\u575B\u7ED3\u6676\u505A\u4E00\u679A\u907F\u98CE\u7B26",
        outcome: "\u7A57\u51C6\u65F6\u5C06\u4FE1\u9001\u5230\u3002\u56DE\u7A0B\u65F6\uFF0C\u5979\u628A\u76D6\u7740\u65B0\u90AE\u6233\u7684\u56DE\u4FE1\u4EA4\u7ED9\u4E86\u4F60\u3002",
        costs: { items: { crystal_altar: 1, straw_sleepy: 4 } },
        rewardPool: [
          {
            weight: 75,
            rewards: { gold: { min: 200, max: 300 }, items: { stone_reforge: { min: 1, max: 2 } } }
          },
          {
            weight: 25,
            rewards: { gold: { min: 300, max: 400 }, items: { stone_enhance: { min: 6, max: 9 } } }
          }
        ]
      },
      {
        id: "send_off",
        label: "\u76EE\u9001\u5979\u72EC\u81EA\u51FA\u53D1",
        outcome: "\u5F88\u4E45\u4EE5\u540E\uFF0C\u8FDC\u5904\u4F20\u6765\u4E00\u58F0\u6E05\u4EAE\u7684\u547C\u558A\uFF1A\u201C\u9001\u5230\u5566\u2014\u2014\uFF01\u201D"
      }
    ]
  },
  {
    id: "enc_r2_napper_daily",
    regionIds: ["r1", "r2"],
    unlockChapterId: "2-5",
    title: "\u51C6\u65F6\u8DEF\u8FC7\u7684\u4FE1\u4F7F",
    sceneAsset: "assets/encounters/scenes/sui/daily-morning-route.webp",
    initialPortrait: suiPortrait("morning-route-trust"),
    story: "\u7A57\u51C6\u65F6\u4ECE\u8DEF\u53E3\u7ECF\u8FC7\uFF0C\u8FD8\u7279\u610F\u505C\u4E0B\u6765\u548C\u4F60\u6253\u4E86\u58F0\u62DB\u547C\u3002",
    speaker: "\u8349\u539F\u4FE1\u4F7F\xB7\u7A57",
    glyph: "\u{1F33E}",
    storyArc: {
      characterId: "char_sui",
      characterName: "\u8349\u539F\u4FE1\u4F7F\xB7\u7A57",
      episode: 4,
      episodeLabel: "\u65E5\u5E38 \xB7 \u4ECA\u65E5\u51C6\u65F6",
      requiredEncounterIds: ["enc_r2_napper_true_delivery"],
      repeatable: true,
      storyChoices: [
        {
          id: "praise",
          label: "\u201C\u4ECA\u5929\u4E5F\u5F88\u51C6\u65F6\u3002\u201D",
          responseDialogue: [
            {
              speaker: "\u8349\u539F\u4FE1\u4F7F\xB7\u7A57",
              text: "\u90A3\u5F53\u7136\uFF01\u6211\u73B0\u5728\u8FD8\u4F1A\u63D0\u524D\u4E00\u523B\u949F\u51FA\u95E8\u5462\u3002",
              portraitCue: suiPortrait("praise-response")
            }
          ]
        },
        {
          id: "rest",
          label: "\u201C\u5FD9\u5B8C\u8BB0\u5F97\u597D\u597D\u4F11\u606F\u3002\u201D",
          responseDialogue: [
            {
              speaker: "\u8349\u539F\u4FE1\u4F7F\xB7\u7A57",
              text: "\u653E\u5FC3\uFF0C\u6211\u5DF2\u7ECF\u4F1A\u5206\u6E05\u4F11\u606F\u548C\u5077\u61D2\u5566\u2026\u2026\u5927\u6982\uFF01",
              portraitCue: suiPortrait("rest-response")
            }
          ]
        }
      ]
    },
    dailyVariants: [
      {
        id: "morning_route",
        title: "\u6BD4\u6668\u98CE\u66F4\u65E9\u4E00\u6B65",
        story: "\u6668\u96FE\u8FD8\u6CA1\u6563\uFF0C\u7A57\u5DF2\u7ECF\u5E26\u7740\u6574\u7406\u6574\u9F50\u7684\u4FE1\u888B\u8DD1\u5230\u4E86\u8DEF\u53E3\u3002",
        sceneAsset: "assets/encounters/scenes/sui/daily-morning-route.webp",
        initialPortrait: suiPortrait("morning-route-trust"),
        relationshipDialogue: {
          \u521D\u9047: [{ speaker: "\u8349\u539F\u4FE1\u4F7F\xB7\u7A57", text: "\u65E9\u3001\u65E9\u4E0A\u597D\uFF01\u6211\u4ECA\u5929\u771F\u7684\u6CA1\u6709\u7761\u8FC7\u5934\u3002" }],
          \u719F\u6089: [{ speaker: "\u8349\u539F\u4FE1\u4F7F\xB7\u7A57", text: "\u4F60\u770B\uFF0C\u592A\u9633\u624D\u521A\u8D77\u6765\uFF0C\u6211\u5DF2\u7ECF\u8D70\u5B8C\u534A\u6BB5\u8DEF\u5566\u3002" }],
          \u4EB2\u8FD1: [{ speaker: "\u8349\u539F\u4FE1\u4F7F\xB7\u7A57", text: "\u6211\u7ED5\u4E86\u4E00\u70B9\u70B9\u8DEF\u3002\u53EA\u662F\u60F3\u8BA9\u4F60\u7B2C\u4E00\u4E2A\u770B\u5230\u6211\u51C6\u65F6\u3002" }],
          \u4FE1\u8D56: [{ speaker: "\u8349\u539F\u4FE1\u4F7F\xB7\u7A57", text: "\u65E9\u4E0A\u597D\uFF01\u4F60\u7684\u4E13\u5C5E\u51C6\u65F6\u4FE1\u4F7F\u524D\u6765\u62A5\u5230\uFF01" }]
        },
        dialogue: [
          { speaker: "\u8349\u539F\u4FE1\u4F7F\xB7\u7A57", text: "\u8FD9\u6B21\u4E0D\u662F\u7761\u5728\u8DEF\u8FB9\uFF0C\u662F\u4E13\u95E8\u505C\u4E0B\u6765\u627E\u4F60\u8BF4\u8BDD\u3002" },
          { text: "\u5979\u8EAB\u540E\u7684\u4FE1\u888B\u6574\u7406\u5F97\u6574\u6574\u9F50\u9F50\uFF0C\u6700\u4E0A\u9762\u8FD8\u522B\u7740\u4E00\u6735\u5E26\u9732\u6C34\u7684\u5C0F\u82B1\u3002" }
        ]
      },
      {
        id: "windy_knot",
        title: "\u5927\u98CE\u5929\u7684\u7EF3\u7ED3",
        story: "\u8349\u539F\u98CE\u628A\u4FE1\u888B\u5439\u5F97\u9F13\u9F13\u4F5C\u54CD\uFF0C\u7A57\u5374\u5F97\u610F\u5730\u5C55\u793A\u8D77\u81EA\u5DF1\u65B0\u5B66\u7684\u7EF3\u7ED3\u3002",
        sceneAsset: "assets/encounters/scenes/sui/daily-windy-knot.webp",
        initialPortrait: suiPortrait("windy-knot-trust"),
        relationshipDialogue: {
          \u521D\u9047: [{ speaker: "\u8349\u539F\u4FE1\u4F7F\xB7\u7A57", text: "\u522B\u62C5\u5FC3\uFF01\u4ECA\u5929\u53EA\u6709\u4FE1\u888B\u4E71\uFF0C\u6211\u672C\u4EBA\u6CA1\u6709\u8FF7\u8DEF\u3002" }],
          \u719F\u6089: [{ speaker: "\u8349\u539F\u4FE1\u4F7F\xB7\u7A57", text: "\u4E0A\u6B21\u4F60\u5E2E\u6211\u624E\u8FC7\u4EE5\u540E\uFF0C\u6211\u5077\u5077\u7EC3\u4E86\u597D\u591A\u904D\u3002" }],
          \u4EB2\u8FD1: [{ speaker: "\u8349\u539F\u4FE1\u4F7F\xB7\u7A57", text: "\u5148\u8BF4\u597D\uFF0C\u677E\u5F00\u7684\u90A3\u4E2A\u7ED3\u4E0D\u662F\u6211\u6253\u7684\u2026\u2026\u5927\u6982\u3002" }],
          \u4FE1\u8D56: [{ speaker: "\u8349\u539F\u4FE1\u4F7F\xB7\u7A57", text: "\u6551\u547D\uFF0C\u6211\u7684\u7EF3\u7ED3\u8001\u5E08\uFF01\u8FD9\u9635\u98CE\u4E5F\u592A\u4E0D\u8BB2\u9053\u7406\u4E86\u3002" }]
        },
        dialogue: [
          { speaker: "\u8349\u539F\u4FE1\u4F7F\xB7\u7A57", text: "\u5DE6\u8FB9\u8FD9\u4E2A\u7ED3\u8DD1\u5F97\u5FEB\uFF0C\u53F3\u8FB9\u8FD9\u4E2A\u66F4\u7A33\u3002\u4F60\u89C9\u5F97\u54EA\u79CD\u9002\u5408\u957F\u9014\uFF1F" },
          { text: "\u5979\u4E00\u8FB9\u8BF4\u4E00\u8FB9\u6309\u4F4F\u5FEB\u8981\u98DE\u8D70\u7684\u5E3D\u5B50\uFF0C\u4ECD\u6CA1\u5FD8\u62A4\u4F4F\u6000\u91CC\u7684\u4FE1\u3002" }
        ]
      },
      {
        id: "quiet_letter",
        title: "\u4E0D\u50AC\u4FC3\u7684\u90A3\u5C01\u4FE1",
        story: "\u4ECA\u5929\u7684\u6700\u540E\u4E00\u5C01\u4FE1\u6CA1\u6709\u5199\u671F\u9650\uFF0C\u7A57\u53CD\u800C\u6BD4\u5E73\u65F6\u66F4\u52A0\u8BA4\u771F\u3002",
        sceneAsset: "assets/encounters/scenes/sui/daily-quiet-letter.webp",
        initialPortrait: suiPortrait("quiet-letter-trust"),
        relationshipDialogue: {
          \u521D\u9047: [{ speaker: "\u8349\u539F\u4FE1\u4F7F\xB7\u7A57", text: "\u5947\u602A\u5427\uFF1F\u4E0D\u7740\u6025\u7684\u4FE1\uFF0C\u6211\u5374\u4E00\u70B9\u4E5F\u4E0D\u60F3\u803D\u6401\u3002" }],
          \u719F\u6089: [{ speaker: "\u8349\u539F\u4FE1\u4F7F\xB7\u7A57", text: "\u6211\u73B0\u5728\u660E\u767D\u4E86\uFF0C\u51C6\u65F6\u4E0D\u662F\u56E0\u4E3A\u522B\u4EBA\u50AC\u5F97\u51F6\u3002" }],
          \u4EB2\u8FD1: [{ speaker: "\u8349\u539F\u4FE1\u4F7F\xB7\u7A57", text: "\u6709\u4E9B\u8BDD\u88AB\u4EBA\u8BA4\u771F\u7B49\u7740\uFF0C\u5C31\u4E0D\u8BE5\u5728\u8DEF\u4E0A\u591A\u7761\u4E00\u89C9\u3002" }],
          \u4FE1\u8D56: [{ speaker: "\u8349\u539F\u4FE1\u4F7F\xB7\u7A57", text: "\u966A\u6211\u8D70\u5230\u4E0B\u4E2A\u8DEF\u53E3\u5427\uFF1F\u8FD9\u5C01\u4FE1\u9002\u5408\u5B89\u5B89\u9759\u9759\u5730\u9001\u3002" }]
        },
        dialogue: [
          {
            speaker: "\u8349\u539F\u4FE1\u4F7F\xB7\u7A57",
            text: "\u5BC4\u4FE1\u4EBA\u53EA\u5199\u4E86\u201C\u7B49\u4F60\u65B9\u4FBF\u65F6\u9001\u5230\u201D\u3002\u53EF\u6211\u60F3\u8BA9\u6536\u4FE1\u4EBA\u4ECA\u5929\u5C31\u770B\u89C1\u3002"
          },
          { text: "\u4FE1\u5C01\u5F88\u8F7B\uFF0C\u8FB9\u89D2\u5374\u88AB\u5979\u62A4\u5F97\u5E73\u5E73\u6574\u6574\uFF0C\u50CF\u4E00\u4EF6\u90D1\u91CD\u7684\u5C0F\u4E8B\u3002" }
        ]
      }
    ],
    supportTiers: [
      {
        unlockChapterId: "2-2",
        choice: {
          id: "supplies",
          label: "\u8865\u5145\u4E9B\u57FA\u7840\u6346\u5305\u6750\u6599",
          outcome: "\u7A57\u91CD\u65B0\u624E\u7D27\u4FE1\u888B\uFF0C\u9001\u7ED9\u4F60\u51E0\u679A\u6CBF\u9014\u6536\u96C6\u7684\u5C0F\u77F3\u5934\u3002",
          costs: { items: { straw_sleepy: 3, grass_soft: 2 } },
          rewardPool: [
            {
              weight: 90,
              rewards: {
                gold: { min: 50, max: 100 },
                items: { stone_enhance: { min: 2, max: 4 } }
              }
            },
            {
              weight: 10,
              rewards: {
                gold: { min: 100, max: 150 },
                items: { stone_reforge: { min: 1, max: 1 } }
              }
            }
          ]
        }
      },
      {
        unlockChapterId: "2-3",
        choice: {
          id: "supplies",
          label: "\u8865\u5145\u4E9B\u9632\u6F6E\u6346\u5305\u6750\u6599",
          outcome: "\u7A57\u628A\u67D4\u8F6F\u51DD\u80F6\u57AB\u8FDB\u4FE1\u888B\u5939\u5C42\uFF0C\u7B11\u7740\u5206\u7ED9\u4F60\u4E00\u888B\u6CBF\u9014\u6536\u83B7\u3002",
          costs: { items: { honey_bee: 1, jelly_cotton: 3 } },
          rewardPool: [
            {
              weight: 88,
              rewards: {
                gold: { min: 80, max: 140 },
                items: { stone_enhance: { min: 3, max: 6 } }
              }
            },
            {
              weight: 12,
              rewards: {
                gold: { min: 120, max: 190 },
                items: { stone_reforge: { min: 1, max: 2 } }
              }
            }
          ]
        }
      },
      {
        unlockChapterId: "2-4",
        choice: {
          id: "supplies",
          label: "\u8865\u5145\u4E9B\u957F\u9014\u5C01\u5305\u6750\u6599",
          outcome: "\u7A57\u628A\u957F\u9014\u4FE1\u4EF6\u91CD\u65B0\u5C01\u597D\uFF0C\u8BA4\u771F\u5411\u4F60\u884C\u4E86\u4E00\u4E2A\u4FE1\u4F7F\u793C\u3002",
          costs: { items: { honey_bee: 2, straw_sleepy: 2 } },
          rewardPool: [
            {
              weight: 88,
              rewards: {
                gold: { min: 90, max: 150 },
                items: { stone_enhance: { min: 4, max: 7 } }
              }
            },
            {
              weight: 12,
              rewards: {
                gold: { min: 140, max: 210 },
                items: { stone_reforge: { min: 1, max: 2 } }
              }
            }
          ]
        }
      },
      {
        unlockChapterId: "2-5",
        choice: {
          id: "supplies",
          label: "\u8865\u5145\u796D\u575B\u8DEF\u6BB5\u7684\u62A4\u4FE1\u6750\u6599",
          outcome: "\u796D\u575B\u7ED3\u6676\u5316\u6210\u4E00\u5C42\u8584\u5149\u62A4\u4F4F\u4FE1\u888B\uFF0C\u7A57\u628A\u73CD\u85CF\u7684\u6CBF\u9014\u6536\u83B7\u9001\u7ED9\u4E86\u4F60\u3002",
          costs: { items: { crystal_altar: 1, jelly_cotton: 2 } },
          rewardPool: [
            {
              weight: 85,
              rewards: {
                gold: { min: 100, max: 180 },
                items: { stone_enhance: { min: 10, max: 12 } }
              }
            },
            {
              weight: 15,
              rewards: {
                gold: { min: 100, max: 180 },
                items: { stone_reforge: { min: 2, max: 3 } }
              }
            }
          ]
        }
      }
    ],
    dialogue: [
      { speaker: "\u8349\u539F\u4FE1\u4F7F\xB7\u7A57", text: "\u65E9\u4E0A\u597D\uFF01\u8FD9\u6B21\u4E0D\u662F\u7761\u5728\u8DEF\u8FB9\uFF0C\u662F\u4E13\u95E8\u505C\u4E0B\u6765\u627E\u4F60\u8BF4\u8BDD\u3002" },
      { text: "\u5979\u8EAB\u540E\u7684\u4FE1\u888B\u6574\u7406\u5F97\u6574\u6574\u9F50\u9F50\uFF0C\u6700\u4E0A\u9762\u8FD8\u522B\u7740\u4E00\u6735\u5C0F\u82B1\u3002" }
    ],
    choices: [
      {
        id: "supplies",
        label: "\u8865\u5145\u4E9B\u8DEF\u4E0A\u7528\u7684\u6346\u5305\u6750\u6599",
        outcome: "\u7A57\u91CD\u65B0\u624E\u7D27\u4FE1\u888B\uFF0C\u9001\u7ED9\u4F60\u51E0\u679A\u6CBF\u9014\u6536\u96C6\u7684\u5C0F\u77F3\u5934\u3002",
        costs: { items: { straw_sleepy: 3, jelly_cotton: 2 } },
        rewardPool: [
          {
            weight: 90,
            rewards: { gold: { min: 50, max: 100 }, items: { stone_enhance: { min: 2, max: 4 } } }
          },
          {
            weight: 10,
            rewards: { gold: { min: 100, max: 150 }, items: { stone_reforge: { min: 1, max: 1 } } }
          }
        ]
      },
      {
        id: "wave",
        label: "\u6325\u624B\u795D\u5979\u4E00\u8DEF\u987A\u98CE",
        outcome: "\u7A57\u8E29\u7740\u8F7B\u5FEB\u7684\u6B65\u5B50\u7EE7\u7EED\u8D76\u8DEF\uFF0C\u8FD9\u6B21\u6CA1\u6709\u9519\u8FC7\u4EFB\u4F55\u4E00\u4E2A\u8DEF\u53E3\u3002"
      }
    ]
  },
  {
    id: "enc_r2_honey",
    regionIds: ["r2"],
    unlockChapterId: "2-3",
    title: "\u8702\u5A18\u7684\u4E0B\u5348\u8336",
    story: "\u5DE1\u903B\u7684\u8702\u5A18\u60F3\u6CE1\u4E00\u58F6\u751C\u8336\uFF0C\u5374\u600E\u4E48\u4E5F\u627E\u4E0D\u5230\u5408\u9002\u7684\u676F\u57AB\u3002",
    speaker: "\u871C\u8702\u5A18\xB7\u8283",
    glyph: "\u{1F36F}",
    sceneAsset: "assets/encounters/scenes/ordinary/r2-honey-tea.webp",
    initialPortrait: null,
    dialogue: [
      { text: "\u8702\u5DE2\u5916\u6446\u7740\u4E00\u5F20\u5C0F\u684C\u5B50\uFF0C\u684C\u4E0A\u662F\u521A\u5012\u597D\u7684\u4E24\u676F\u871C\u8336\u3002" },
      { speaker: "\u871C\u8702\u5A18\xB7\u8283", text: "\u6B38\uFF1F\u4F60\u4E0D\u662F\u6765\u62A2\u871C\u7684\u5427\uFF1F" },
      { speaker: "\u871C\u8702\u5A18\xB7\u8283", text: "\u2026\u2026\u7B97\u4E86\uFF0C\u53CD\u6B63\u6211\u4E5F\u4E00\u4E2A\u4EBA\u559D\u4E0D\u5B8C\u3002\u5750\u561B\u5750\u561B\u3002" }
    ],
    choices: [
      {
        id: "tea",
        label: "\u51D1\u9F50\u8336\u4F1A\u6750\u6599",
        outcome: "\u8336\u4F1A\u5927\u6210\u529F\uFF0C\u8702\u5A18\u795E\u79D8\u5730\u9012\u6765\u4E00\u4E2A\u751C\u9999\u7684\u5C0F\u5305\u3002",
        costs: { items: { honey_bee: 2, jelly_cotton: 4 } },
        rewardPool: [
          {
            weight: 85,
            rewards: { gold: { min: 70, max: 130 }, items: { stone_enhance: { min: 3, max: 5 } } }
          },
          {
            weight: 15,
            rewards: { gold: { min: 130, max: 190 }, items: { stone_reforge: { min: 1, max: 1 } } }
          }
        ]
      },
      { id: "decline", label: "\u4E0B\u6B21\u518D\u6765", outcome: "\u8702\u5A18\u7ED9\u4F60\u6307\u4E86\u8DEF\uFF0C\u7EE7\u7EED\u5FD9\u7740\u51C6\u5907\u8336\u70B9\u3002" }
    ]
  },
  {
    id: "enc_r2_altar",
    regionIds: ["r2"],
    unlockChapterId: "2-5",
    title: "\u8349\u539F\u796D\u575B\u7684\u56DE\u58F0",
    sceneAsset: "assets/encounters/scenes/ordinary/r2-altar-echo.webp",
    initialPortrait: null,
    story: "\u53E4\u8001\u796D\u575B\u53D1\u51FA\u8F7B\u67D4\u56DE\u58F0\uFF0C\u4F3C\u4E4E\u5728\u7B49\u5F85\u4E00\u5757\u5931\u843D\u7684\u7ED3\u6676\u3002",
    speaker: "\u796D\u575B\u56DE\u58F0",
    glyph: "\u{1F300}",
    dialogue: [
      { text: "\u8349\u539F\u796D\u575B\u7684\u77F3\u7F1D\u95F4\u56DE\u8361\u7740\u67D0\u79CD\u4F4E\u8BED\uFF0C\u542C\u4E0D\u6E05\u8BCD\u53E5\u3002" },
      { speaker: "\u796D\u575B\u56DE\u58F0", text: "\u2026\u2026\u4EA4\u6362\u2026\u2026\u7B49\u4EF7\u7684\u2026\u2026" },
      { text: "\u56DE\u58F0\u505C\u4E0B\u4E86\uFF0C\u50CF\u662F\u5728\u7B49\u4F60\u7684\u7B54\u590D\u3002" }
    ],
    choices: [
      {
        id: "answer",
        label: "\u56DE\u5E94\u796D\u575B",
        outcome: "\u796D\u575B\u4EAE\u8D77\u661F\u5149\uFF0C\u4E00\u4EFD\u53E4\u8001\u7684\u9988\u8D60\u843D\u5165\u4F60\u7684\u638C\u5FC3\u3002",
        costs: { items: { crystal_altar: 1, straw_sleepy: 5 } },
        rewardPool: [
          {
            weight: 75,
            rewards: { gold: { min: 180, max: 280 }, items: { stone_reforge: { min: 1, max: 2 } } }
          },
          {
            weight: 25,
            rewards: { gold: { min: 280, max: 380 }, items: { stone_enhance: { min: 6, max: 9 } } }
          }
        ]
      },
      { id: "leave", label: "\u5C0A\u91CD\u8FD9\u4EFD\u5B89\u9759", outcome: "\u56DE\u58F0\u6E10\u6E10\u8FDC\u53BB\uFF0C\u8349\u6D6A\u91CD\u65B0\u76D6\u4F4F\u796D\u575B\u3002" }
    ]
  }
];
var ENCOUNTERS = Object.fromEntries(
  DEFINITIONS.map((encounter) => [encounter.id, encounter])
);

// src/data/regions.ts
var REGION_1 = {
  id: "r1",
  index: 1,
  name: "\u6A31\u82B1\u521D\u9547",
  subtitle: "\u98D8\u7740\u82B1\u74E3\u7684\u6E29\u6696\u5C0F\u9547",
  levelFrom: 1,
  levelTo: 10,
  theme: ["#ffd6e7", "#ffeef5"],
  mapAsset: "assets/maps/r1.webp",
  chapters: [
    {
      id: "1-1",
      name: "\u521D\u9192\u7684\u6A31\u5EAD",
      levelFrom: 1,
      levelTo: 2,
      element: "none",
      normals: ["\u6A31\u82B1\u7CBE\u7075", "\u8FF7\u8DEF\u5154\u5A18", "\u5C0F\u82B1\u5996", "\u98D8\u53F6\u7075"],
      materials: ["petal_sakura", "grass_soft"],
      tutorial: "\u6302\u673A\u4F1A\u81EA\u52A8\u6253\u602A\uFF0C\u79BB\u5F00\u540E\u56DE\u6765\u80FD\u9886\u53D6\u79BB\u7EBF\u6536\u76CA\u3002",
      mapAsset: "assets/maps/chapter-1-1.webp",
      battleAsset: "assets/battlefields/chapter-1-1.webp"
    },
    {
      id: "1-2",
      name: "\u9547\u5916\u5C0F\u5F84",
      levelFrom: 3,
      levelTo: 4,
      element: "none",
      normals: ["\u8611\u83C7\u5A18", "\u91CE\u732B\u5A18", "\u8349\u56E2\u5B50", "\u98CE\u94C3\u7CBE"],
      materials: ["petal_sakura", "grass_soft"],
      tutorial: "\u6389\u843D\u7684\u88C5\u5907\u53EF\u4EE5\u5728\u300C\u517B\u6210\u300D\u91CC\u7A7F\u4E0A\uFF0C\u6218\u529B\u4F1A\u63D0\u5347\u3002",
      mapAsset: "assets/maps/chapter-1-2.webp",
      battleAsset: "assets/battlefields/chapter-1-2.webp"
    },
    {
      id: "1-3",
      name: "\u8352\u5E9F\u7684\u82B1\u623F",
      levelFrom: 5,
      levelTo: 6,
      element: "none",
      normals: ["\u85E4\u8513\u5A18", "\u82B1\u5996", "\u76C6\u683D\u5C0F\u602A", "\u6D12\u6C34\u58F6\u7075"],
      elite: "\u6E29\u5BA4\u770B\u5B88",
      materials: ["petal_sakura", "bell_wood"],
      tutorial: "\u88C5\u5907\u53EF\u4EE5\u5F3A\u5316\uFF0C+5 \u4EE5\u5185\u7EDD\u5BF9\u4E0D\u4F1A\u5931\u8D25\uFF0C\u653E\u5FC3\u70B9\u3002",
      mapAsset: "assets/maps/chapter-1-3.webp",
      battleAsset: "assets/battlefields/chapter-1-3.webp"
    },
    {
      id: "1-4",
      name: "\u6A31\u4E4B\u6797\u6DF1\u5904",
      levelFrom: 7,
      levelTo: 8,
      element: "none",
      normals: ["\u6811\u7075", "\u6728\u5076\u5A18", "\u6797\u95F4\u8424\u706B", "\u82D4\u85D3\u5154"],
      elite: "\u53E4\u6728\u5B88\u536B",
      materials: ["bell_wood", "grass_soft"],
      tutorial: "\u7B49\u7EA7\u5230\u4E86\u4F1A\u89E3\u9501\u65B0\u6280\u80FD\uFF0C\u6280\u80FD\u5728\u6302\u673A\u65F6\u81EA\u52A8\u91CA\u653E\u3002",
      mapAsset: "assets/maps/chapter-1-4.webp",
      battleAsset: "assets/battlefields/chapter-1-4.webp"
    },
    {
      id: "1-5",
      name: "\u843D\u6A31\u7ED3\u754C",
      levelFrom: 9,
      levelTo: 10,
      element: "none",
      normals: ["\u7ED3\u754C\u5B88\u536B", "\u6A31\u5439\u96EA", "\u5149\u4E4B\u788E\u7247", "\u5B88\u62A4\u6728\u7075"],
      elite: "\u7ED3\u754C\u5DE1\u5B88",
      boss: "\u6A31\u5B88\xB7\u7EEF",
      materials: ["core_barrier", "petal_sakura"],
      tutorial: "\u6253\u8FC7 BOSS \u540E\u5C31\u80FD\u300C\u626B\u8361\u300D\u8FD9\u4E00\u5173\uFF0C\u7528\u4F53\u529B\u6362\u6536\u76CA\uFF0C\u4E0D\u7528\u4E00\u76F4\u6302\u7740\u3002",
      mapAsset: "assets/maps/chapter-1-5.webp",
      battleAsset: "assets/battlefields/chapter-1-5.webp"
    }
  ]
};
var REGION_2 = {
  id: "r2",
  index: 2,
  name: "\u8FF7\u7CCA\u8349\u539F",
  subtitle: "\u8FDE\u602A\u7269\u90FD\u5728\u6253\u778C\u7761",
  levelFrom: 10,
  levelTo: 20,
  theme: ["#cdeafd", "#eaf7ff"],
  mapAsset: "assets/maps/r2.webp",
  chapters: [
    {
      id: "2-1",
      name: "\u68C9\u82B1\u7CD6\u4E18\u9675",
      levelFrom: 10,
      levelTo: 12,
      element: "none",
      normals: ["\u68C9\u82B1\u7CD6\u53F2\u83B1\u59C6", "\u4E91\u6735\u5154", "\u8F6F\u7CD6\u5C0F\u602A", "\u7CD6\u971C\u8776"],
      materials: ["jelly_cotton", "grass_soft"],
      mapAsset: "assets/maps/chapter-2-1.webp",
      battleAsset: "assets/battlefields/chapter-2-1.webp"
    },
    {
      id: "2-2",
      name: "\u6253\u76F9\u7A3B\u8349\u7530",
      levelFrom: 12,
      levelTo: 14,
      element: "none",
      normals: ["\u7A3B\u8349\u4EBA\u5A18", "\u778C\u7761\u9EBB\u96C0", "\u8349\u579B\u602A", "\u6652\u8C37\u7075"],
      elite: "\u7A3B\u8349\u7530\u76D1\u5DE5",
      materials: ["straw_sleepy", "grass_soft"],
      mapAsset: "assets/maps/chapter-2-2.webp",
      battleAsset: "assets/battlefields/chapter-2-2.webp"
    },
    {
      id: "2-3",
      name: "\u8702\u5A18\u8702\u5DE2",
      levelFrom: 14,
      levelTo: 16,
      element: "none",
      normals: ["\u5C0F\u871C\u8702\u5A18", "\u82B1\u7C89\u7CBE", "\u5DE2\u7A74\u5B88\u536B", "\u871C\u6EF4\u602A"],
      elite: "\u8702\u540E\u4F8D\u536B",
      materials: ["honey_bee", "jelly_cotton"],
      mapAsset: "assets/maps/chapter-2-3.webp",
      battleAsset: "assets/battlefields/chapter-2-3.webp"
    },
    {
      id: "2-4",
      name: "\u8FF7\u8DEF\u8005\u8425\u5730",
      levelFrom: 16,
      levelTo: 18,
      element: "none",
      normals: ["\u8FF7\u8DEF\u65C5\u4EBA", "\u8425\u706B\u7CBE", "\u884C\u56CA\u602A", "\u8DEF\u6807\u7075"],
      elite: "\u8425\u5730\u9996\u9886",
      materials: ["straw_sleepy", "honey_bee"],
      mapAsset: "assets/maps/chapter-2-4.webp",
      battleAsset: "assets/battlefields/chapter-2-4.webp"
    },
    {
      id: "2-5",
      name: "\u8349\u539F\u796D\u575B",
      levelFrom: 18,
      levelTo: 20,
      element: "ice",
      normals: ["\u796D\u575B\u5B88\u536B", "\u7ED3\u6676\u53F2\u83B1\u59C6", "\u53E4\u6587\u7891\u7075", "\u51B0\u971C\u56E2\u5B50"],
      elite: "\u796D\u575B\u796D\u53F8",
      boss: "\u5927\u53F2\u83B1\u59C6\u5973\u738B",
      materials: ["crystal_altar", "jelly_cotton"],
      tutorial: "\u6709\u4E9B\u5173\u5361\u7684\u602A\u5E26\u5C5E\u6027\u3002\u4E0A\u4E00\u7AE0\u9996\u901A\u9001\u7684\u708E\u5C5E\u6027\u6B66\u5668\u53EF\u4EE5\u514B\u5236\u51B0\u602A\uFF0C\u6362\u4E0A\u540E\u4F24\u5BB3\u66F4\u9AD8\u3002",
      mapAsset: "assets/maps/chapter-2-5.webp",
      battleAsset: "assets/battlefields/chapter-2-5.webp"
    }
  ]
};
var REGIONS = [
  REGION_1,
  REGION_2,
  ...REGION_34,
  REGION_5,
  REGION_6
];
var STAGES_PER_CHAPTER = 6;
var ALL_CHAPTERS = REGIONS.flatMap((r) => r.chapters);

// src/data/monsterVisuals.ts
function buildRegion34MonsterVisuals() {
  return Object.fromEntries(
    Object.entries(REGION_34_MONSTER_MOTIONS).map(([id, motion]) => {
      const regionIndex = id.match(/^mon_([34])-/)?.[1];
      if (!regionIndex) {
        throw new Error(`[\u602A\u7269\u914D\u7F6E] \u533A\u57DF 3/4 \u602A\u7269 ID \u683C\u5F0F\u9519\u8BEF\uFF1A${id}`);
      }
      return [
        id,
        {
          asset: `assets/monsters/r${regionIndex}/${id}.webp`,
          motion
        }
      ];
    })
  );
}
var REGION_34_MONSTER_VISUALS = buildRegion34MonsterVisuals();
var REGION_5_MONSTER_VISUALS = Object.fromEntries(
  Object.entries(REGION_5_MONSTER_MOTIONS).map(([id, motion]) => [
    id,
    {
      asset: `assets/monsters/r5/${id}.webp`,
      motion
    }
  ])
);
var REGION_6_STATUE_MONSTER_ID_SET = new Set(REGION_6_STATUE_MONSTER_IDS);
var REGION_6_MONSTER_VISUALS = Object.fromEntries(
  Object.entries(REGION_6_MONSTER_MOTIONS).map(([id, motion]) => [
    id,
    {
      asset: `assets/monsters/r6/${id}.webp`,
      motion,
      ...REGION_6_STATUE_MONSTER_ID_SET.has(id) ? { statueAwaken: true } : {}
    }
  ])
);
var MONSTER_VISUALS = {
  // 区域 3/4 与 regions.ts 同一批接入：素材、掉落、强化曲线全部就绪后才展开，
  // 展开前 REGION_34_MONSTER_VISUALS 只作为待启用注册表存在。
  ...REGION_34_MONSTER_VISUALS,
  ...REGION_5_MONSTER_VISUALS,
  ...REGION_6_MONSTER_VISUALS,
  "mon_1-1_0": { asset: "assets/monsters/r1/mon_1-1_0.webp", motion: "flutter" },
  "mon_1-1_1": { asset: "assets/monsters/r1/mon_1-1_1.webp", motion: "hopper" },
  "mon_1-1_2": { asset: "assets/monsters/r1/mon_1-1_2.webp", motion: "flutter" },
  "mon_1-1_3": { asset: "assets/monsters/r1/mon_1-1_3.webp", motion: "flutter" },
  "mon_1-2_0": { asset: "assets/monsters/r1/mon_1-2_0.webp", motion: "bounce" },
  "mon_1-2_1": { asset: "assets/monsters/r1/mon_1-2_1.webp", motion: "hopper" },
  "mon_1-2_2": { asset: "assets/monsters/r1/mon_1-2_2.webp", motion: "bounce" },
  "mon_1-2_3": { asset: "assets/monsters/r1/mon_1-2_3.webp", motion: "flutter" },
  "mon_1-3_0": { asset: "assets/monsters/r1/mon_1-3_0.webp", motion: "sway" },
  "mon_1-3_1": { asset: "assets/monsters/r1/mon_1-3_1.webp", motion: "flutter" },
  "mon_1-3_2": { asset: "assets/monsters/r1/mon_1-3_2.webp", motion: "sway" },
  "mon_1-3_3": { asset: "assets/monsters/r1/mon_1-3_3.webp", motion: "sway" },
  "mon_1-3_elite": { asset: "assets/monsters/r1/mon_1-3_elite.webp", motion: "guard" },
  "mon_1-4_0": { asset: "assets/monsters/r1/mon_1-4_0.webp", motion: "sway" },
  "mon_1-4_1": { asset: "assets/monsters/r1/mon_1-4_1.webp", motion: "hopper" },
  "mon_1-4_2": { asset: "assets/monsters/r1/mon_1-4_2.webp", motion: "flutter" },
  "mon_1-4_3": { asset: "assets/monsters/r1/mon_1-4_3.webp", motion: "hopper" },
  "mon_1-4_elite": { asset: "assets/monsters/r1/mon_1-4_elite.webp", motion: "guard" },
  "mon_1-5_0": { asset: "assets/monsters/r1/mon_1-5_0.webp", motion: "guard" },
  "mon_1-5_1": { asset: "assets/monsters/r1/mon_1-5_1.webp", motion: "flutter" },
  "mon_1-5_2": { asset: "assets/monsters/r1/mon_1-5_2.webp", motion: "flutter" },
  "mon_1-5_3": { asset: "assets/monsters/r1/mon_1-5_3.webp", motion: "sway" },
  "mon_1-5_elite": { asset: "assets/monsters/r1/mon_1-5_elite.webp", motion: "guard" },
  "mon_1-5_boss": { asset: "assets/monsters/r1/mon_1-5_boss.webp", motion: "royal" },
  "mon_2-1_0": { asset: "assets/monsters/r2/mon_2-1_0.webp", motion: "bounce" },
  "mon_2-1_1": { asset: "assets/monsters/r2/mon_2-1_1.webp", motion: "hopper" },
  "mon_2-1_2": { asset: "assets/monsters/r2/mon_2-1_2.webp", motion: "bounce" },
  "mon_2-1_3": { asset: "assets/monsters/r2/mon_2-1_3.webp", motion: "flutter" },
  "mon_2-2_0": { asset: "assets/monsters/r2/mon_2-2_0.webp", motion: "sway" },
  "mon_2-2_1": { asset: "assets/monsters/r2/mon_2-2_1.webp", motion: "flutter" },
  "mon_2-2_2": { asset: "assets/monsters/r2/mon_2-2_2.webp", motion: "bounce" },
  "mon_2-2_3": { asset: "assets/monsters/r2/mon_2-2_3.webp", motion: "sway" },
  "mon_2-2_elite": { asset: "assets/monsters/r2/mon_2-2_elite.webp", motion: "guard" },
  "mon_2-3_0": { asset: "assets/monsters/r2/mon_2-3_0.webp", motion: "flutter" },
  "mon_2-3_1": { asset: "assets/monsters/r2/mon_2-3_1.webp", motion: "flutter" },
  "mon_2-3_2": { asset: "assets/monsters/r2/mon_2-3_2.webp", motion: "guard" },
  "mon_2-3_3": { asset: "assets/monsters/r2/mon_2-3_3.webp", motion: "bounce" },
  "mon_2-3_elite": { asset: "assets/monsters/r2/mon_2-3_elite.webp", motion: "guard" },
  "mon_2-4_0": { asset: "assets/monsters/r2/mon_2-4_0.webp", motion: "hopper" },
  "mon_2-4_1": { asset: "assets/monsters/r2/mon_2-4_1.webp", motion: "flutter" },
  "mon_2-4_2": { asset: "assets/monsters/r2/mon_2-4_2.webp", motion: "bounce" },
  "mon_2-4_3": { asset: "assets/monsters/r2/mon_2-4_3.webp", motion: "sway" },
  "mon_2-4_elite": { asset: "assets/monsters/r2/mon_2-4_elite.webp", motion: "guard" },
  "mon_2-5_0": { asset: "assets/monsters/r2/mon_2-5_0.webp", motion: "guard" },
  "mon_2-5_1": { asset: "assets/monsters/r2/mon_2-5_1.webp", motion: "bounce" },
  "mon_2-5_2": { asset: "assets/monsters/r2/mon_2-5_2.webp", motion: "sway" },
  "mon_2-5_3": { asset: "assets/monsters/r2/mon_2-5_3.webp", motion: "bounce" },
  "mon_2-5_elite": { asset: "assets/monsters/r2/mon_2-5_elite.webp", motion: "royal" },
  "mon_2-5_boss": { asset: "assets/monsters/r2/mon_2-5_boss.webp", motion: "royal" }
};
function requireMonsterVisual(id) {
  const visual = MONSTER_VISUALS[id];
  if (!visual) {
    throw new Error(`[\u602A\u7269\u914D\u7F6E] \u672A\u767B\u8BB0\u89C6\u89C9\u8D44\u6E90\uFF1A${id}`);
  }
  return visual;
}

// src/data/monsters.ts
var MONSTER_OVERRIDES = {
  // 首关第一只怪刻意调弱，保证新玩家进游戏就能秒掉，建立正反馈
  "mon_1-1_0": { hpMul: 0.5 },
  // 樱守·绯 是第一个 BOSS，不能太硬，否则新手会卡住
  "mon_1-5_boss": { hpMul: 0.6, atkMul: 0.8 }
};
function idFor(chapterId, key) {
  return `mon_${chapterId}_${key}`;
}
function spreadLevel(spec, index, total) {
  if (total <= 1) return spec.levelFrom;
  const t = index / (total - 1);
  return Math.round(spec.levelFrom + (spec.levelTo - spec.levelFrom) * t);
}
function make(chapterId, key, name, level, type, spec) {
  const id = idFor(chapterId, key);
  const base = {
    id,
    name,
    level,
    type,
    element: spec.element,
    lootTableId: lootTableIdFor(chapterId, type),
    sprite: requireMonsterVisual(id).asset,
    desc: type === "boss" ? `${spec.name}\u7684\u5B88\u62A4\u8005\u3002` : void 0
  };
  return { ...base, ...MONSTER_OVERRIDES[id] };
}
function lootTableIdFor(chapterId, type) {
  return `loot_${chapterId}_${type}`;
}
function buildMonsters() {
  const out = {};
  for (const spec of ALL_CHAPTERS) {
    spec.normals.forEach((name, i) => {
      const m = make(spec.id, i, name, spreadLevel(spec, i, spec.normals.length), "normal", spec);
      out[m.id] = m;
    });
    if (spec.elite) {
      const m = make(spec.id, "elite", spec.elite, spec.levelTo, "elite", spec);
      out[m.id] = m;
    }
    if (spec.boss) {
      const m = make(spec.id, "boss", spec.boss, spec.levelTo, "boss", spec);
      out[m.id] = m;
    }
  }
  return out;
}
var MONSTERS = buildMonsters();
function monstersOfChapter(chapterId) {
  return Object.values(MONSTERS).filter((m) => m.id.startsWith(`mon_${chapterId}_`));
}
function normalsOfChapter(chapterId) {
  return monstersOfChapter(chapterId).filter((m) => m.type === "normal");
}
function eliteOfChapter(chapterId) {
  return MONSTERS[idFor(chapterId, "elite")];
}
function bossOfChapter(chapterId) {
  return MONSTERS[idFor(chapterId, "boss")];
}

// src/data/region5EnhanceProgression.ts
var MATERIAL = {
  ...ENHANCE_MATERIAL_IDS,
  reforge: "stone_reforge"
};
function entry(itemId, weight, minCount, maxCount, pityCount) {
  return {
    itemId,
    weight,
    minCount,
    maxCount,
    ...pityCount === void 0 ? {} : { pityCount }
  };
}
function source(entries = [], guaranteed2 = []) {
  return { entries, guaranteed: guaranteed2 };
}
function chapter(chapterId, recommendedAllEnhance, recommendedMainEnhance, stoneByStage, loot, finalBonus) {
  return {
    chapterId,
    recommendedAllEnhance,
    recommendedMainEnhance,
    loot,
    firstClear: { stoneByStage, finalBonus }
  };
}
var EMPTY = source();
var REGION_5_ENHANCE_PROGRESSION = {
  "5-1": chapter(
    "5-1",
    12,
    14,
    [330, 365, 400, 440, 480, 650],
    {
      normal: source([entry(MATERIAL.stone, 3.2, 20, 30)]),
      elite: EMPTY,
      boss: EMPTY
    },
    [
      { itemId: MATERIAL.reforge, count: 4 },
      { itemId: MATERIAL.ore, count: 30 }
    ]
  ),
  "5-2": chapter(
    "5-2",
    12,
    14,
    [350, 385, 420, 460, 505, 700],
    {
      normal: source([entry(MATERIAL.stone, 3.4, 20, 30)]),
      elite: source([entry(MATERIAL.ore, 0.6, 1, 2, 40)]),
      boss: EMPTY
    },
    [
      { itemId: MATERIAL.reforge, count: 4 },
      { itemId: MATERIAL.ore, count: 45 },
      { itemId: MATERIAL.protection, count: 2 }
    ]
  ),
  "5-3": chapter(
    "5-3",
    13,
    14,
    [370, 405, 445, 485, 530, 740],
    {
      normal: source([entry(MATERIAL.stone, 3.6, 21, 31)]),
      elite: EMPTY,
      boss: EMPTY
    },
    [
      { itemId: MATERIAL.reforge, count: 5 },
      { itemId: MATERIAL.ore, count: 60 },
      { itemId: MATERIAL.lucky, count: 2 }
    ]
  ),
  "5-4": chapter(
    "5-4",
    13,
    15,
    [390, 430, 470, 510, 560, 780],
    {
      normal: source([entry(MATERIAL.stone, 3.8, 21, 32)]),
      elite: source([
        entry(MATERIAL.ore, 0.7, 1, 2, 35),
        entry(MATERIAL.lucky, 3e-3, 1, 1, 650),
        entry(MATERIAL.protection, 2e-3, 1, 1, 800)
      ]),
      boss: EMPTY
    },
    [
      { itemId: MATERIAL.reforge, count: 5 },
      { itemId: MATERIAL.ore, count: 80 },
      { itemId: MATERIAL.lucky, count: 3 },
      { itemId: MATERIAL.protection, count: 3 }
    ]
  ),
  "5-5": chapter(
    "5-5",
    13,
    15,
    [420, 460, 500, 545, 600, 840],
    {
      normal: source([entry(MATERIAL.stone, 4, 22, 32)]),
      elite: source([
        entry(MATERIAL.ore, 0.8, 1, 2, 31),
        entry(MATERIAL.lucky, 3e-3, 1, 1, 1e3),
        entry(MATERIAL.protection, 2e-3, 1, 1, 1200)
      ]),
      boss: source([
        entry(MATERIAL.ore, 0.4, 1, 2, 46),
        entry(MATERIAL.lucky, 3e-3, 1, 1, 750),
        entry(MATERIAL.protection, 2e-3, 1, 1, 1100)
      ])
    },
    [
      { itemId: MATERIAL.reforge, count: 6 },
      { itemId: MATERIAL.ore, count: 120 },
      { itemId: MATERIAL.lucky, count: 6 },
      { itemId: MATERIAL.protection, count: 6 }
    ]
  )
};

// src/data/region6EnhanceProgression.ts
var MATERIAL2 = {
  ...ENHANCE_MATERIAL_IDS,
  reforge: "stone_reforge"
};
function entry2(itemId, weight, minCount, maxCount, pityCount) {
  return {
    itemId,
    weight,
    minCount,
    maxCount,
    ...pityCount === void 0 ? {} : { pityCount }
  };
}
function source2(entries = [], guaranteed2 = []) {
  return { entries, guaranteed: guaranteed2 };
}
function chapter2(chapterId, recommendedAllEnhance, recommendedMainEnhance, stoneByStage, loot, finalBonus) {
  return {
    chapterId,
    recommendedAllEnhance,
    recommendedMainEnhance,
    loot,
    firstClear: { stoneByStage, finalBonus }
  };
}
var EMPTY2 = source2();
var REGION_6_ENHANCE_PROGRESSION = {
  "6-1": chapter2(
    "6-1",
    13,
    15,
    [500, 545, 590, 645, 705, 960],
    {
      normal: source2([entry2(MATERIAL2.stone, 4.2, 24, 35)]),
      elite: EMPTY2,
      boss: EMPTY2
    },
    [
      { itemId: MATERIAL2.reforge, count: 6 },
      { itemId: MATERIAL2.ore, count: 100 },
      { itemId: MATERIAL2.lucky, count: 8 },
      { itemId: MATERIAL2.protection, count: 6 }
    ]
  ),
  "6-2": chapter2(
    "6-2",
    13,
    15,
    [530, 575, 625, 680, 745, 1010],
    {
      normal: source2([entry2(MATERIAL2.stone, 4.4, 24, 36)]),
      elite: source2([
        entry2(MATERIAL2.ore, 0.9, 1, 3, 28),
        entry2(MATERIAL2.protection, 3e-3, 1, 1, 650)
      ]),
      boss: EMPTY2
    },
    [
      { itemId: MATERIAL2.reforge, count: 7 },
      { itemId: MATERIAL2.ore, count: 130 },
      { itemId: MATERIAL2.lucky, count: 11 },
      { itemId: MATERIAL2.protection, count: 8 }
    ]
  ),
  "6-3": chapter2(
    "6-3",
    14,
    15,
    [560, 610, 660, 720, 785, 1070],
    {
      normal: source2([entry2(MATERIAL2.stone, 4.6, 25, 37)]),
      elite: EMPTY2,
      boss: EMPTY2
    },
    [
      { itemId: MATERIAL2.reforge, count: 7 },
      { itemId: MATERIAL2.ore, count: 160 },
      { itemId: MATERIAL2.lucky, count: 14 },
      { itemId: MATERIAL2.protection, count: 9 }
    ]
  ),
  "6-4": chapter2(
    "6-4",
    14,
    15,
    [590, 640, 695, 755, 825, 1125],
    {
      normal: source2([entry2(MATERIAL2.stone, 4.8, 25, 38)]),
      elite: source2([
        entry2(MATERIAL2.ore, 1, 1, 3, 24),
        entry2(MATERIAL2.lucky, 4e-3, 1, 1, 700),
        entry2(MATERIAL2.protection, 4e-3, 1, 1, 620)
      ]),
      boss: EMPTY2
    },
    [
      { itemId: MATERIAL2.reforge, count: 8 },
      { itemId: MATERIAL2.ore, count: 200 },
      { itemId: MATERIAL2.lucky, count: 17 },
      { itemId: MATERIAL2.protection, count: 11 }
    ]
  ),
  "6-5": chapter2(
    "6-5",
    14,
    15,
    [620, 675, 730, 795, 870, 1190],
    {
      normal: source2([entry2(MATERIAL2.stone, 5, 26, 39)]),
      elite: source2([
        entry2(MATERIAL2.ore, 1.1, 1, 3, 22),
        entry2(MATERIAL2.lucky, 4e-3, 1, 1, 650),
        entry2(MATERIAL2.protection, 4e-3, 1, 1, 580)
      ]),
      boss: source2([
        entry2(MATERIAL2.ore, 0.6, 2, 4, 34),
        entry2(MATERIAL2.lucky, 4e-3, 1, 1, 560),
        entry2(MATERIAL2.protection, 5e-3, 1, 1, 500)
      ])
    },
    [
      { itemId: MATERIAL2.reforge, count: 9 },
      { itemId: MATERIAL2.ore, count: 280 },
      { itemId: MATERIAL2.lucky, count: 21 },
      { itemId: MATERIAL2.protection, count: 14 }
    ]
  )
};

// src/data/enhanceProgression.ts
var MATERIAL3 = {
  ...ENHANCE_MATERIAL_IDS,
  reforge: "stone_reforge",
  resonance: "crystal_resonance"
};
var ENHANCE_PROGRESSION_MATERIAL_IDS = [
  MATERIAL3.stone,
  MATERIAL3.ore,
  MATERIAL3.lucky,
  MATERIAL3.protection
];
function entry3(itemId, weight, minCount, maxCount, pityCount) {
  return {
    itemId,
    weight,
    minCount,
    maxCount,
    ...pityCount === void 0 ? {} : { pityCount }
  };
}
function guaranteed(itemId, minCount, maxCount) {
  return entry3(itemId, 0, minCount, maxCount);
}
function source3(entries = [], guaranteedEntries = []) {
  return { entries, guaranteed: guaranteedEntries };
}
function chapter3(chapterId, recommendedAllEnhance, recommendedMainEnhance, stoneByStage, loot, finalBonus = [{ itemId: MATERIAL3.reforge, count: 2 }]) {
  return {
    chapterId,
    recommendedAllEnhance,
    recommendedMainEnhance,
    loot,
    firstClear: { stoneByStage, finalBonus }
  };
}
var EMPTY_SOURCE = source3();
var ENHANCE_PROGRESSION = {
  "1-1": chapter3("1-1", 0, 2, [2, 3, 4, 5, 6, 8], {
    normal: source3([entry3(MATERIAL3.stone, 170, 1, 2)]),
    elite: EMPTY_SOURCE,
    boss: EMPTY_SOURCE
  }),
  "1-2": chapter3("1-2", 1, 3, [3, 4, 5, 6, 8, 10], {
    normal: source3([entry3(MATERIAL3.stone, 170, 1, 2)]),
    elite: EMPTY_SOURCE,
    boss: EMPTY_SOURCE
  }),
  "1-3": chapter3("1-3", 3, 5, [6, 8, 10, 12, 15, 20], {
    normal: source3([entry3(MATERIAL3.stone, 180, 1, 3)]),
    elite: source3([], [guaranteed(MATERIAL3.stone, 3, 5)]),
    boss: EMPTY_SOURCE
  }),
  "1-4": chapter3(
    "1-4",
    4,
    6,
    [10, 12, 15, 18, 22, 30],
    {
      normal: source3([entry3(MATERIAL3.stone, 190, 2, 3)]),
      elite: source3([entry3(MATERIAL3.ore, 44, 1, 1, 3)], [guaranteed(MATERIAL3.stone, 4, 6)]),
      boss: EMPTY_SOURCE
    },
    [
      { itemId: MATERIAL3.reforge, count: 2 },
      { itemId: MATERIAL3.ore, count: 2 }
    ]
  ),
  "1-5": chapter3(
    "1-5",
    5,
    8,
    [15, 18, 22, 26, 30, 50],
    {
      normal: source3([entry3(MATERIAL3.stone, 210, 2, 4)]),
      elite: source3([entry3(MATERIAL3.ore, 68, 1, 2, 2)], [guaranteed(MATERIAL3.stone, 5, 8)]),
      boss: source3(
        [entry3(MATERIAL3.lucky, 6, 1, 1, 9), entry3(MATERIAL3.protection, 3, 1, 1, 19)],
        [
          guaranteed(MATERIAL3.stone, 20, 30),
          guaranteed(MATERIAL3.reforge, 1, 3),
          guaranteed(MATERIAL3.ore, 5, 8)
        ]
      )
    },
    [
      { itemId: MATERIAL3.reforge, count: 2 },
      { itemId: MATERIAL3.ore, count: 10 },
      { itemId: MATERIAL3.lucky, count: 1 },
      { itemId: MATERIAL3.protection, count: 1 }
    ]
  ),
  "2-1": chapter3(
    "2-1",
    5,
    8,
    [20, 24, 28, 32, 36, 50],
    {
      normal: source3([entry3(MATERIAL3.stone, 220, 3, 5)]),
      elite: EMPTY_SOURCE,
      boss: EMPTY_SOURCE
    },
    [
      { itemId: MATERIAL3.reforge, count: 2 },
      { itemId: MATERIAL3.ore, count: 3 }
    ]
  ),
  "2-2": chapter3(
    "2-2",
    6,
    9,
    [28, 32, 36, 42, 48, 60],
    {
      normal: source3([entry3(MATERIAL3.stone, 230, 4, 6)]),
      elite: source3([entry3(MATERIAL3.ore, 34, 1, 1, 4)], [guaranteed(MATERIAL3.stone, 6, 10)]),
      boss: EMPTY_SOURCE
    },
    [
      { itemId: MATERIAL3.reforge, count: 2 },
      { itemId: MATERIAL3.ore, count: 5 }
    ]
  ),
  "2-3": chapter3(
    "2-3",
    7,
    9,
    [36, 42, 48, 55, 62, 75],
    {
      normal: source3([entry3(MATERIAL3.stone, 250, 4, 7)]),
      elite: source3([entry3(MATERIAL3.ore, 55, 1, 2, 3)], [guaranteed(MATERIAL3.stone, 8, 12)]),
      boss: EMPTY_SOURCE
    },
    [
      { itemId: MATERIAL3.reforge, count: 2 },
      { itemId: MATERIAL3.ore, count: 8 }
    ]
  ),
  "2-4": chapter3(
    "2-4",
    8,
    10,
    [48, 55, 62, 70, 80, 100],
    {
      normal: source3([entry3(MATERIAL3.stone, 275, 5, 8)]),
      elite: source3([], [guaranteed(MATERIAL3.stone, 10, 15), guaranteed(MATERIAL3.ore, 2, 3)]),
      boss: EMPTY_SOURCE
    },
    [
      { itemId: MATERIAL3.reforge, count: 2 },
      { itemId: MATERIAL3.ore, count: 12 }
    ]
  ),
  "2-5": chapter3(
    "2-5",
    9,
    10,
    [60, 70, 80, 90, 100, 150],
    {
      normal: source3([entry3(MATERIAL3.stone, 275, 6, 10)]),
      elite: source3([], [guaranteed(MATERIAL3.stone, 12, 18), guaranteed(MATERIAL3.ore, 3, 5)]),
      boss: source3(
        [entry3(MATERIAL3.lucky, 18, 1, 1, 3), entry3(MATERIAL3.protection, 10, 1, 1, 5)],
        [
          guaranteed(MATERIAL3.stone, 40, 60),
          guaranteed(MATERIAL3.reforge, 2, 4),
          guaranteed(MATERIAL3.ore, 12, 18)
        ]
      )
    },
    [
      { itemId: MATERIAL3.reforge, count: 2 },
      { itemId: MATERIAL3.ore, count: 30 },
      { itemId: MATERIAL3.lucky, count: 2 },
      { itemId: MATERIAL3.protection, count: 2 }
    ]
  ),
  // ── 区域 3 虫娘洞窟（Lv20-30）──
  // 推荐档位必须从区域 2 收尾的 9 / 10 继续递增，不能回落；
  // 精英掉落只配给真正有精英的章节（3-2 / 3-5），否则会生成不可触达的掉落表。
  "3-1": chapter3("3-1", 9, 10, [110, 125, 140, 155, 170, 240], {
    normal: source3([entry3(MATERIAL3.stone, 300, 8, 13)]),
    elite: EMPTY_SOURCE,
    boss: EMPTY_SOURCE
  }),
  "3-2": chapter3("3-2", 9, 11, [125, 140, 155, 170, 190, 265], {
    normal: source3([entry3(MATERIAL3.stone, 305, 9, 14)]),
    elite: source3(
      [entry3(MATERIAL3.ore, 24, 1, 2, 4)],
      [guaranteed(MATERIAL3.stone, 18, 26), guaranteed(MATERIAL3.ore, 4, 7)]
    ),
    boss: EMPTY_SOURCE
  }),
  "3-3": chapter3("3-3", 10, 11, [140, 155, 175, 190, 210, 290], {
    normal: source3([entry3(MATERIAL3.stone, 310, 10, 15)]),
    elite: EMPTY_SOURCE,
    boss: EMPTY_SOURCE
  }),
  "3-4": chapter3("3-4", 10, 12, [155, 175, 195, 210, 230, 320], {
    normal: source3([entry3(MATERIAL3.stone, 315, 11, 16)]),
    elite: EMPTY_SOURCE,
    boss: EMPTY_SOURCE
  }),
  "3-5": chapter3(
    "3-5",
    10,
    12,
    [175, 195, 215, 235, 260, 360],
    {
      normal: source3([entry3(MATERIAL3.stone, 320, 12, 18)]),
      elite: source3([], [guaranteed(MATERIAL3.stone, 24, 34), guaranteed(MATERIAL3.ore, 7, 11)]),
      boss: source3(
        [entry3(MATERIAL3.lucky, 22, 1, 2, 3), entry3(MATERIAL3.protection, 13, 1, 1, 4)],
        [
          guaranteed(MATERIAL3.stone, 55, 80),
          guaranteed(MATERIAL3.reforge, 3, 5),
          guaranteed(MATERIAL3.ore, 16, 24)
        ]
      )
    },
    [
      { itemId: MATERIAL3.reforge, count: 3 },
      { itemId: MATERIAL3.ore, count: 40 },
      { itemId: MATERIAL3.lucky, count: 3 },
      { itemId: MATERIAL3.protection, count: 2 }
    ]
  ),
  // ── 区域 4 月下墓园（Lv30-40）──
  // 保护符从「首通奖励」转为精英与 BOSS 的常规低概率产出，
  // 支撑玩家第一次尝试冲 +13 以上。精英章节为 4-2 / 4-4 / 4-5。
  "4-1": chapter3("4-1", 11, 12, [200, 225, 250, 275, 300, 420], {
    normal: source3([entry3(MATERIAL3.stone, 325, 14, 20)]),
    elite: EMPTY_SOURCE,
    boss: EMPTY_SOURCE
  }),
  "4-2": chapter3("4-2", 11, 13, [225, 250, 275, 300, 330, 460], {
    normal: source3([entry3(MATERIAL3.stone, 330, 15, 22)]),
    elite: source3(
      [entry3(MATERIAL3.ore, 28, 2, 4, 4), entry3(MATERIAL3.protection, 6, 1, 1, 8)],
      [guaranteed(MATERIAL3.stone, 30, 42), guaranteed(MATERIAL3.ore, 9, 14)]
    ),
    boss: EMPTY_SOURCE
  }),
  "4-3": chapter3("4-3", 11, 13, [250, 275, 305, 330, 365, 505], {
    normal: source3([entry3(MATERIAL3.stone, 335, 16, 24)]),
    elite: EMPTY_SOURCE,
    boss: EMPTY_SOURCE
  }),
  "4-4": chapter3("4-4", 12, 14, [275, 305, 335, 365, 400, 555], {
    normal: source3([entry3(MATERIAL3.stone, 340, 18, 26)]),
    elite: source3(
      [entry3(MATERIAL3.ore, 30, 3, 5, 3), entry3(MATERIAL3.lucky, 8, 1, 1, 6)],
      [guaranteed(MATERIAL3.stone, 35, 48), guaranteed(MATERIAL3.ore, 11, 17)]
    ),
    boss: EMPTY_SOURCE
  }),
  "4-5": chapter3(
    "4-5",
    12,
    14,
    [305, 335, 370, 400, 440, 610],
    {
      normal: source3([entry3(MATERIAL3.stone, 345, 20, 28)]),
      elite: source3([], [guaranteed(MATERIAL3.stone, 38, 52), guaranteed(MATERIAL3.ore, 13, 19)]),
      boss: source3(
        [entry3(MATERIAL3.lucky, 26, 2, 3, 3), entry3(MATERIAL3.protection, 16, 1, 2, 3)],
        [
          guaranteed(MATERIAL3.stone, 75, 105),
          guaranteed(MATERIAL3.reforge, 4, 6),
          guaranteed(MATERIAL3.ore, 22, 32)
        ]
      )
    },
    [
      { itemId: MATERIAL3.reforge, count: 4 },
      { itemId: MATERIAL3.ore, count: 55 },
      { itemId: MATERIAL3.lucky, count: 4 },
      { itemId: MATERIAL3.protection, count: 3 }
    ]
  ),
  ...REGION_5_ENHANCE_PROGRESSION,
  ...REGION_6_ENHANCE_PROGRESSION
};
function getEnhanceProgression(chapterId) {
  return ENHANCE_PROGRESSION[chapterId];
}
function requireEnhanceProgression(chapterId) {
  const progression = getEnhanceProgression(chapterId);
  if (!progression) throw new Error(`[\u914D\u7F6E\u9519\u8BEF] \u7AE0\u8282\u7F3A\u5C11\u5F3A\u5316\u6210\u957F\u914D\u7F6E\uFF1A${chapterId}`);
  return progression;
}
function enhanceFirstClearRewards(chapterId, stageIndex, isBossStage) {
  if (!Number.isInteger(stageIndex) || stageIndex < 0 || stageIndex >= 6) {
    throw new Error(`[\u914D\u7F6E\u9519\u8BEF] \u9996\u901A\u5956\u52B1\u5173\u5361\u7D22\u5F15\u5FC5\u987B\u5728 0~5\uFF1A${stageIndex}`);
  }
  const firstClear = requireEnhanceProgression(chapterId).firstClear;
  const rewards = [
    {
      itemId: MATERIAL3.stone,
      count: firstClear.stoneByStage[stageIndex]
    }
  ];
  if (stageIndex === 5 && isBossStage) {
    rewards.push({ itemId: MATERIAL3.resonance, count: 1 });
  }
  if (stageIndex === 5) {
    rewards.push(...firstClear.finalBonus.map((reward) => ({ ...reward })));
  }
  return rewards;
}

// src/data/stages.ts
var STAGE_FIRST_CLEAR_GEAR_REWARDS = {
  "stage_2-4_6": [{ itemId: "eq_r2_weapon_fine", count: 1 }]
};
function stageLevel(spec, idx) {
  const t = STAGES_PER_CHAPTER <= 1 ? 0 : idx / (STAGES_PER_CHAPTER - 1);
  return Math.round(spec.levelFrom + (spec.levelTo - spec.levelFrom) * t);
}
function estimateRecommendCP(level) {
  const bare = combatPower(baseStatsFor("swordsman", level));
  const gearFactor = 0.85 + Math.min(1, (level - 1) * 0.02);
  return Math.round(bare * gearFactor);
}
function buildWaves(spec, idx) {
  const normals = normalsOfChapter(spec.id);
  const elite = eliteOfChapter(spec.id);
  const boss = bossOfChapter(spec.id);
  const isEliteStage = idx === 2;
  const isFinalStage = idx === STAGES_PER_CHAPTER - 1;
  const hasEliteWave = (isEliteStage || isFinalStage) && Boolean(elite);
  const hasBossWave = isFinalStage && Boolean(boss);
  const waves = [];
  const normalWaveCount = hasEliteWave || hasBossWave ? 2 : 3;
  for (let w = 0; w < normalWaveCount; w++) {
    const a = normals[(idx + w) % normals.length];
    const b = normals[(idx + w + 1) % normals.length];
    const monsters = [];
    if (a) monsters.push({ id: a.id, count: 2 + w });
    if (b && b.id !== a?.id) monsters.push({ id: b.id, count: 1 + w });
    waves.push({ monsters });
  }
  if (hasEliteWave && elite) {
    waves.push({ monsters: [{ id: elite.id, count: 1 }] });
  }
  if (hasBossWave && boss) {
    waves.push({ monsters: [{ id: boss.id, count: 1 }] });
    return { waves, bossId: boss.id };
  }
  return { waves };
}
function buildStages() {
  const out = {};
  for (const spec of ALL_CHAPTERS) {
    for (let idx = 0; idx < STAGES_PER_CHAPTER; idx++) {
      const level = stageLevel(spec, idx);
      const { waves, bossId } = buildWaves(spec, idx);
      const id = `stage_${spec.id}_${idx + 1}`;
      const firstClearGearRewards = STAGE_FIRST_CLEAR_GEAR_REWARDS[id] ?? [];
      out[id] = {
        id,
        chapterId: spec.id,
        name: `${spec.name} ${idx + 1}`,
        level,
        waves,
        ...bossId ? { bossId } : {},
        recommendCP: estimateRecommendCP(level),
        firstClearRewards: [
          ...enhanceFirstClearRewards(spec.id, idx, Boolean(bossId)),
          ...firstClearGearRewards.map((reward) => ({ ...reward }))
        ],
        // 挂机基础收益统一掷普通表；store 再按真实波次为精英/BOSS 追加专属表。
        lootTableId: lootTableIdFor(spec.id, "normal"),
        maxKillsPerSec: DEFAULT_MAX_KILLS_PER_SEC,
        element: spec.element
      };
    }
  }
  return out;
}
var STAGES = buildStages();
var STAGE_LIST = Object.values(STAGES);
function stagesOfChapter(chapterId) {
  return STAGE_LIST.filter((s) => s.chapterId === chapterId);
}
var ORDERED_STAGE_IDS = ALL_CHAPTERS.flatMap(
  (c) => stagesOfChapter(c.id).map((s) => s.id)
);
var FIRST_STAGE_ID = ORDERED_STAGE_IDS[0];

// src/data/equipmentDungeons.ts
var PORTAL_SPECS = [
  {
    slot: "weapon",
    name: "\u661F\u5203\u94F8\u68A6\u7089",
    shortName: "\u6B66\u5668\u7089",
    keeperName: "\u8A93\u5203\u953B\u9020\u59EC\xB7\u8299\u857E\u96C5",
    minionName: "\u7EBF\u8F74\u5251\u7075",
    lore: "\u4F1A\u628A\u6BCF\u4E00\u6B21\u6325\u51FB\u7F1D\u8FDB\u661F\u5149\u94A2\u91CC\u7684\u5C0F\u5C0F\u94F8\u9020\u738B\u5EAD\u3002",
    ruleCopy: "\u5251\u7075\u653B\u51FB\u66F4\u51F6\uFF0C\u4F18\u5148\u68C0\u67E5\u9632\u5FA1\u4E0E\u751F\u547D\u3002",
    accent: "#ff718c",
    element: "fire",
    mapAsset: "assets/dungeons/equipment/weapon-battle.webp",
    minionAsset: "assets/monsters/equipment-dungeon/weapon-minion.webp",
    bossAsset: "assets/monsters/equipment-dungeon/weapon-boss.webp",
    objectPosition: "52% 58%",
    hpMul: 0.96,
    atkMul: 1.12
  },
  {
    slot: "head",
    name: "\u82B1\u51A0\u4E91\u7AEF\u5E3D\u574A",
    shortName: "\u5934\u51A0\u574A",
    keeperName: "\u661F\u51A0\u88C1\u5E3D\u5E08\xB7\u7C73\u857E",
    minionName: "\u5E3D\u9488\u7CBE\u7075",
    lore: "\u6F02\u5728\u4E91\u6D77\u4E0A\u7684\u5E3D\u574A\uFF0C\u6240\u6709\u82B1\u51A0\u90FD\u8981\u5148\u901A\u8FC7\u661F\u98CE\u7684\u8BD5\u6234\u3002",
    ruleCopy: "\u5E3D\u9488\u7CBE\u7075\u95EA\u907F\u8F83\u9AD8\uFF0C\u547D\u4E2D\u4E0D\u8DB3\u65F6\u4F1A\u62D6\u957F\u6218\u6597\u3002",
    accent: "#8f8cff",
    element: "thunder",
    mapAsset: "assets/dungeons/equipment/head-battle.webp",
    minionAsset: "assets/monsters/equipment-dungeon/head-minion.webp",
    bossAsset: "assets/monsters/equipment-dungeon/head-boss.webp",
    objectPosition: "50% 52%",
    hpMul: 0.9,
    atkMul: 0.94
  },
  {
    slot: "body",
    name: "\u6D1B\u4E3D\u5854\u5E7B\u8863\u5385",
    shortName: "\u5E7B\u8863\u5385",
    keeperName: "\u793C\u88C5\u4EBA\u5076\u5E08\xB7\u9732\u897F\u4E9A",
    minionName: "\u857E\u4E1D\u5E03\u5076",
    lore: "\u857E\u4E1D\u3001\u88D9\u6491\u548C\u9B54\u6CD5\u4E1D\u7EBF\u4F1A\u81EA\u5DF1\u8DF3\u821E\u7684\u534E\u4E3D\u793C\u88C5\u5C55\u5385\u3002",
    ruleCopy: "\u4EBA\u5076\u5E08\u62E5\u6709\u66F4\u539A\u7684\u62A4\u76FE\uFF0C\u662F\u516B\u5EA7\u95E8\u6237\u91CC\u6700\u8010\u6253\u7684\u4E00\u4F4D\u3002",
    accent: "#ed75c4",
    element: "ice",
    mapAsset: "assets/dungeons/equipment/body-battle.webp",
    minionAsset: "assets/monsters/equipment-dungeon/body-minion.webp",
    bossAsset: "assets/monsters/equipment-dungeon/body-boss.webp",
    objectPosition: "49% 55%",
    hpMul: 1.18,
    atkMul: 0.86
  },
  {
    slot: "necklace",
    name: "\u6708\u94FE\u5929\u8C61\u9986",
    shortName: "\u5929\u8C61\u9986",
    keeperName: "\u6708\u76F8\u73E0\u5B9D\u59EC\xB7\u8D5B\u857E",
    minionName: "\u5760\u661F\u5C0F\u7075",
    lore: "\u9879\u94FE\u50CF\u661F\u8F68\u4E00\u6837\u60AC\u5728\u7A79\u9876\uFF0C\u6708\u76F8\u4F1A\u66FF\u5B9D\u77F3\u6311\u9009\u4E3B\u4EBA\u3002",
    ruleCopy: "\u6708\u76F8\u4F1A\u5F3A\u5316\u66B4\u51FB\uFF0C\u6301\u7EED\u627F\u4F24\u6BD4\u9762\u677F\u6218\u529B\u66F4\u91CD\u8981\u3002",
    accent: "#6da9ff",
    element: "ice",
    mapAsset: "assets/dungeons/equipment/necklace-battle.webp",
    minionAsset: "assets/monsters/equipment-dungeon/necklace-minion.webp",
    bossAsset: "assets/monsters/equipment-dungeon/necklace-boss.webp",
    objectPosition: "52% 50%",
    hpMul: 0.94,
    atkMul: 1.03
  },
  {
    slot: "bracelet",
    name: "\u8776\u7FFC\u6C34\u6676\u6E29\u5BA4",
    shortName: "\u6676\u8776\u6E29\u5BA4",
    keeperName: "\u6676\u8776\u56ED\u827A\u5E08\xB7\u8299\u6D1B\u62C9",
    minionName: "\u8155\u82B1\u8776\u7075",
    lore: "\u6C34\u6676\u85E4\u8513\u7ED3\u51FA\u624B\u73AF\uFF0C\u8774\u8776\u8D1F\u8D23\u628A\u5FAE\u5149\u6388\u7C89\u5230\u6BCF\u9897\u5B9D\u77F3\u3002",
    ruleCopy: "\u8776\u7075\u653B\u901F\u5F88\u5FEB\uFF0C\u9002\u5408\u7528\u9AD8\u9632\u5FA1\u6216\u66F4\u5FEB\u7206\u53D1\u538B\u5236\u3002",
    accent: "#63d8bf",
    element: "none",
    mapAsset: "assets/dungeons/equipment/bracelet-battle.webp",
    minionAsset: "assets/monsters/equipment-dungeon/bracelet-minion.webp",
    bossAsset: "assets/monsters/equipment-dungeon/bracelet-boss.webp",
    objectPosition: "48% 57%",
    hpMul: 0.88,
    atkMul: 1.08
  },
  {
    slot: "ring",
    name: "\u8A93\u7EA6\u5B9D\u6212\u4E66\u5E93",
    shortName: "\u5B9D\u6212\u4E66\u5E93",
    keeperName: "\u8A93\u6212\u5178\u85CF\u5B98\xB7\u8BFA\u96C5",
    minionName: "\u6212\u9875\u4E66\u7075",
    lore: "\u6BCF\u4E00\u679A\u6212\u6307\u90FD\u5939\u7740\u4E00\u9875\u8A93\u8A00\uFF0C\u53EA\u6709\u6218\u80DC\u5178\u85CF\u5B98\u624D\u80FD\u501F\u8D70\u3002",
    ruleCopy: "\u4E66\u7075\u64C5\u957F\u7CBE\u51C6\u53CD\u51FB\uFF0C\u95EA\u907F\u8DEF\u7EBF\u4F1A\u66F4\u8212\u670D\u3002",
    accent: "#b67cff",
    element: "thunder",
    mapAsset: "assets/dungeons/equipment/ring-battle.webp",
    minionAsset: "assets/monsters/equipment-dungeon/ring-minion.webp",
    bossAsset: "assets/monsters/equipment-dungeon/ring-boss.webp",
    objectPosition: "54% 50%",
    hpMul: 0.92,
    atkMul: 1.06
  },
  {
    slot: "belt",
    name: "\u661F\u7F0E\u7EC7\u68A6\u5DE5\u623F",
    shortName: "\u7EC7\u68A6\u5DE5\u623F",
    keeperName: "\u7EC7\u68A6\u88C1\u7F1D\u5E08\xB7\u4F69\u59AE",
    minionName: "\u7F0E\u5E26\u56E2\u5B50",
    lore: "\u6574\u5EA7\u5DE5\u623F\u7531\u4F1A\u81EA\u5DF1\u6253\u7ED3\u7684\u661F\u7F0E\u9A71\u52A8\uFF0C\u8774\u8776\u7ED3\u662F\u8FD9\u91CC\u7684\u901A\u884C\u8BC1\u3002",
    ruleCopy: "\u7F0E\u5E26\u4F1A\u524A\u5F31\u8282\u594F\uFF0C\u7A33\u5B9A\u547D\u4E2D\u6BD4\u8D4C\u66B4\u51FB\u66F4\u53EF\u9760\u3002",
    accent: "#ff9fbe",
    element: "fire",
    mapAsset: "assets/dungeons/equipment/belt-battle.webp",
    minionAsset: "assets/monsters/equipment-dungeon/belt-minion.webp",
    bossAsset: "assets/monsters/equipment-dungeon/belt-boss.webp",
    objectPosition: "48% 52%",
    hpMul: 1.04,
    atkMul: 0.92
  },
  {
    slot: "shoes",
    name: "\u661F\u6B65\u821E\u4F1A\u56DE\u5ECA",
    shortName: "\u821E\u4F1A\u56DE\u5ECA",
    keeperName: "\u5348\u591C\u821E\u59EC\xB7\u53EF\u53EF",
    minionName: "\u821E\u978B\u7CBE\u7075",
    lore: "\u4E0D\u4F1A\u505C\u4E0B\u7684\u6708\u591C\u821E\u4F1A\uFF0C\u8D70\u5B8C\u56DE\u5ECA\u624D\u80FD\u5E26\u8D70\u4E00\u53CC\u661F\u6B65\u821E\u978B\u3002",
    ruleCopy: "\u821E\u59EC\u95EA\u907F\u4E0E\u901F\u5EA6\u6700\u9AD8\uFF0C\u547D\u4E2D\u3001\u653B\u901F\u548C\u7206\u53D1\u90FD\u5F88\u5173\u952E\u3002",
    accent: "#75b9ff",
    element: "none",
    mapAsset: "assets/dungeons/equipment/shoes-battle.webp",
    minionAsset: "assets/monsters/equipment-dungeon/shoes-minion.webp",
    bossAsset: "assets/monsters/equipment-dungeon/shoes-boss.webp",
    objectPosition: "50% 60%",
    hpMul: 0.86,
    atkMul: 1.02
  }
];
var EQUIPMENT_DUNGEON_PORTALS = PORTAL_SPECS.map((portal) => ({
  ...portal,
  id: `equipment-${portal.slot}`
}));
var PORTAL_BY_SLOT = Object.fromEntries(
  EQUIPMENT_DUNGEON_PORTALS.map((portal) => [portal.slot, portal])
);
var TIER_ENCOUNTER_SCALE = {
  azure: { hp: 1.1, atk: 0.58 },
  violet: { hp: 0.72, atk: 0.24 },
  auric: { hp: 1.5, atk: 1 },
  crimson: { hp: 2.6, atk: 1.4 }
};
function stageId(slot, tierId) {
  return `equipment_${slot}_${tierId}`;
}
function lootTableFor(slot, tier) {
  const definitions = equipmentDungeonGearFor(tier.id, slot);
  if (definitions.length === 0) {
    throw new Error(`[\u914D\u7F6E\u9519\u8BEF] ${tier.id} ${slot} \u6CA1\u6709\u88C5\u5907\u526F\u672C\u6389\u843D`);
  }
  return {
    id: `loot_equipment_${slot}_${tier.id}`,
    rolls: 1,
    entries: definitions.map((definition) => ({
      itemId: definition.id,
      ...definition.classId ? { classId: definition.classId } : {},
      weight: 1,
      minCount: 1,
      maxCount: 1,
      // 通用部位有两款；连续两次没见到其中一款，下一次会保底并额外正常 roll，
      // 形成一次“补偿双掉”，避免定向本仍被重复件拖垮体验。
      ...definition.classId ? {} : { pityCount: 2 }
    }))
  };
}
var RECOMMEND_CP_RATIO = 0.9;
function recommendCpFor(tier, portal) {
  const portalDifficulty = Math.sqrt(portal.hpMul * portal.atkMul);
  return Math.round(expectedFullGearCp(tier.level) * RECOMMEND_CP_RATIO * portalDifficulty);
}
function encounterFor(portal, tier, role, lootTableId) {
  const isBoss = role === "boss";
  const asset = isBoss ? portal.bossAsset : portal.minionAsset;
  const name = isBoss ? portal.keeperName : portal.minionName;
  const visualId = `equipment-${portal.slot}-${role}`;
  const tierScale = TIER_ENCOUNTER_SCALE[tier.id];
  const monster = {
    id: `monster_${portal.slot}_${tier.id}_${role}`,
    name: `${tier.name}\xB7${name}`,
    level: Math.max(1, tier.level - (isBoss ? 0 : 2)),
    type: isBoss ? "boss" : "elite",
    element: portal.element,
    hpMul: (isBoss ? 0.065 : 0.18) * portal.hpMul * tierScale.hp,
    atkMul: (isBoss ? 0.18 : 0.2) * portal.atkMul * tierScale.atk,
    lootTableId,
    sprite: asset
  };
  return { role, visualId, asset, monster };
}
function buildStages2() {
  const out = {};
  for (const slot of SLOT_ORDER) {
    const portal = PORTAL_BY_SLOT[slot];
    EQUIPMENT_DUNGEON_TIERS.forEach((tier, index) => {
      const id = stageId(slot, tier.id);
      const lootTable = lootTableFor(slot, tier);
      out[id] = {
        id,
        portalId: portal.id,
        slot,
        tierId: tier.id,
        name: `${portal.shortName}\xB7${tier.name}`,
        subtitle: `\u5B9A\u5411\u6389\u843D ${tier.shortName}${SLOT_LABELS[slot]}`,
        quality: tier.quality,
        level: tier.level,
        unlockLevel: tier.unlockLevel,
        recommendCP: recommendCpFor(tier, portal),
        accent: portal.accent,
        glow: tier.glow,
        mapAsset: portal.mapAsset,
        objectPosition: portal.objectPosition,
        ...index > 0 ? { previousStageId: stageId(slot, EQUIPMENT_DUNGEON_TIERS[index - 1].id) } : {},
        encounters: [
          encounterFor(portal, tier, "minion", lootTable.id),
          encounterFor(portal, tier, "boss", lootTable.id)
        ],
        lootTable
      };
    });
  }
  return out;
}
var EQUIPMENT_DUNGEON_STAGES = buildStages2();
var EQUIPMENT_DUNGEON_STAGE_LIST = Object.values(EQUIPMENT_DUNGEON_STAGES);

// src/data/affectionDates.ts
var SWORDSMAN_DATES = [
  {
    slot: "morning",
    story: {
      id: "aff_swordsman_10_market",
      classId: "swordsman",
      episode: 10,
      title: "\u66FF\u5979\u6311\u4E00\u6761\u5251\u7A57",
      episodeLabel: "\u7B2C\u5341\u5E55 \xB7 \u6668\u5E02\u5251\u7A57",
      unlockPoints: 3e3,
      requiredStoryIds: ["aff_swordsman_09_reciprocal"],
      completionPoints: 60,
      backgroundAsset: "assets/affection/scenes/swordsman-morning-market.webp",
      openingDialogue: [
        { text: "\u6668\u5E02\u521A\u5F00\uFF0C\u5251\u7A57\u94FA\u5B50\u7684\u4E1D\u7EE6\u5728\u6653\u98CE\u91CC\u4E00\u6392\u6392\u6643\u3002\u5979\u505C\u5728\u644A\u524D\uFF0C\u770B\u5F97\u6BD4\u770B\u5251\u8C31\u8FD8\u4E13\u6CE8\u3002" },
        { speaker: "\u5251\u59EC", mood: "shy", text: "\u65E7\u7A57\u78E8\u5230\u8D77\u6BDB\u4E86\u3002\u672C\u6765\u60F3\u968F\u4FBF\u6362\u4E00\u6761\u2026\u2026\u65E2\u7136\u4F60\u5728\uFF0C\u5C31\u300A\u8BA4\u771F\u6311\u4E00\u6B21\u300B\u3002" },
        { text: "\u5979\u628A\u4F60\u8BA9\u5230\u91CC\u4FA7\uFF0C\u81EA\u5DF1\u7AD9\u5728\u5E02\u58F0\u5916\u9762\u2014\u2014\u50CF\u66FF\u4F60\u6321\u7740\u4E00\u4E2A\u770B\u4E0D\u89C1\u7684\u961F\u5F62\u3002" }
      ],
      choices: [
        {
          id: "pick_quiet_color",
          label: "\u201C\u8FD9\u6761\u54D1\u5149\u7684\u3002\u50CF\u4F60\u7684\u4EBA\uFF0C\u8010\u770B\u3002\u201D",
          mood: "moved",
          responseDialogue: [
            { text: "\u5979\u628A\u90A3\u6761\u7A57\u5B50\u8D34\u5728\u5251\u67C4\u4E0A\u6BD4\u4E86\u6BD4\uFF0C\u8033\u6839\u6162\u6162\u7EA2\u4E86\u3002" },
            { speaker: "\u5251\u59EC", mood: "shy", text: "\u5938\u7A57\u5B50\u5C31\u5938\u7A57\u5B50\u2026\u2026\u600E\u4E48\u8FDE\u6211\u4E5F\u4E00\u8D77\u5938\u4E86\u3002" },
            { speaker: "\u5251\u59EC", mood: "moved", text: "\u300A\u90A3\u5C31\u5B83\u5427\u300B\u3002\u4EE5\u540E\u6BCF\u6B21\u6536\u5251\uFF0C\u90FD\u4F1A\u770B\u89C1\u3002" }
          ]
        },
        {
          id: "let_her_test_swing",
          label: "\u201C\u5148\u7CFB\u4E0A\u8BD5\u6325\u4E09\u4E0B\uFF0C\u987A\u624B\u624D\u4F5C\u6570\u3002\u201D",
          mood: "bright",
          responseDialogue: [
            { text: "\u5979\u771F\u7684\u9000\u5F00\u534A\u6B65\uFF0C\u5728\u5DF7\u7A7A\u91CC\u8BD5\u4E86\u4E09\u5F0F\uFF0C\u7A57\u5C3E\u5212\u51FA\u7684\u5F27\u7EBF\u4E00\u6B21\u6BD4\u4E00\u6B21\u7A33\u3002" },
            { speaker: "\u5251\u59EC", mood: "bright", text: "\u300A\u7B2C\u4E09\u4E0B\u6700\u987A\u300B\u3002\u4F60\u6311\u7684\u4F4D\u7F6E\uFF0C\u91CD\u5FC3\u521A\u597D\u3002" },
            { text: "\u644A\u4E3B\u5728\u65C1\u8FB9\u9F13\u638C\uFF0C\u5979\u96BE\u5F97\u6CA1\u6709\u53CD\u9A73\u201C\u6211\u4EEC\u4E0D\u662F\u90A3\u79CD\u5173\u7CFB\u201D\u3002" }
          ]
        },
        {
          id: "ask_before_touch",
          label: "\u201C\u6211\u80FD\u62FF\u8D77\u6765\u6BD4\u6BD4\u957F\u5EA6\u5417\uFF1F\u5148\u95EE\u644A\u4E3B\uFF0C\u4E5F\u5148\u95EE\u4F60\u3002\u201D",
          mood: "shy",
          responseDialogue: [
            { text: "\u5979\u6014\u4E86\u4E00\u4E0B\uFF0C\u628A\u5251\u67C4\u4E3B\u52A8\u9012\u8FC7\u6765\u4E00\u5BF8\u3002" },
            { speaker: "\u5251\u59EC", mood: "moved", text: "\u4F60\u603B\u662F\u5148\u95EE\u3002\u6240\u4EE5\u7B54\u6848\u6C38\u8FDC\u662F\u2014\u2014\u300A\u53EF\u4EE5\u300B\u3002" }
          ]
        }
      ],
      memoryCallbacks: [
        {
          fromStoryId: "aff_swordsman_07_gift",
          choiceId: "gift_without_debt",
          dialogue: [
            { speaker: "\u5251\u59EC", text: "\u8FD8\u8BB0\u5F97\u5417\uFF0C\u4F60\u8BF4\u8FC7\u5B83\u4E0D\u662F\u519B\u9700\u3002\u90A3\u4ECA\u5929\u8FD9\u6761\u7A57\u5B50\uFF0C\u4E5F\u4E0D\u662F\u3002" }
          ]
        }
      ]
    }
  },
  {
    slot: "afternoon",
    story: {
      id: "aff_swordsman_11_bento",
      classId: "swordsman",
      episode: 11,
      title: "\u6E56\u7554\u4FBF\u5F53\u7684\u4E00\u534A",
      episodeLabel: "\u7B2C\u5341\u4E00\u5E55 \xB7 \u6E56\u7554\u4FBF\u5F53",
      unlockPoints: 3500,
      requiredStoryIds: ["aff_swordsman_10_market"],
      completionPoints: 60,
      backgroundAsset: "assets/affection/scenes/swordsman-lakeside-bento.webp",
      openingDialogue: [
        { text: "\u5348\u540E\u7684\u6E56\u98CE\u628A\u8377\u53F6\u5439\u5F97\u7FFB\u8D77\u94F6\u8FB9\u3002\u5979\u6253\u5F00\u4E24\u5C42\u7684\u4FBF\u5F53\u76D2\uFF0C\u6446\u5F97\u50CF\u662F\u6821\u9605\u9635\u578B\u3002" },
        { speaker: "\u5251\u59EC", mood: "bright", text: "\u4E0B\u5C42\u662F\u4F60\u63D0\u8FC7\u60F3\u5403\u7684\u90A3\u51E0\u6837\u3002\u4E0A\u5C42\u2026\u2026\u662F\u6211\u575A\u6301\u8981\u505A\u7684\u3002\u300A\u516C\u5E73\u5206\u914D\u300B\u3002" },
        { text: "\u7B77\u5B50\u9012\u5230\u4F60\u624B\u91CC\u65F6\uFF0C\u5979\u5148\u628A\u81EA\u5DF1\u90A3\u53CC\u6446\u6B63\u4E86\u2014\u2014\u8FDE\u91CE\u9910\u90FD\u900F\u7740\u8BA4\u771F\u3002" }
      ],
      choices: [
        {
          id: "trade_half",
          label: "\u201C\u4E0A\u5C42\u4E0B\u5C42\u5404\u5206\u4E00\u534A\uFF0C\u8C01\u4E5F\u522B\u8BA9\u8C01\u3002\u201D",
          mood: "bright",
          responseDialogue: [
            { text: "\u5979\u76EF\u7740\u4F60\u628A\u7389\u5B50\u70E7\u5BF9\u534A\u5207\u5F00\uFF0C\u7EC8\u4E8E\u5FCD\u4E0D\u4F4F\u7B11\u51FA\u58F0\u3002" },
            { speaker: "\u5251\u59EC", mood: "bright", text: "\u884C\u519B\u6253\u4ED7\u90FD\u6CA1\u8FD9\u4E48\u5206\u914D\u8FC7\u2026\u2026\u4F46\u8FD9\u6837\uFF0C\u300A\u6700\u597D\u5403\u300B\u3002" }
          ]
        },
        {
          id: "praise_her_cooking",
          label: "\u201C\u5148\u5403\u5979\u505A\u7684\u90A3\u5C42\uFF0C\u8BA4\u771F\u8BF4\u54EA\u91CC\u597D\u3002\u201D",
          mood: "moved",
          responseDialogue: [
            { text: "\u5979\u5047\u88C5\u770B\u6E56\uFF0C\u5374\u628A\u201C\u54EA\u91CC\u597D\u201D\u4E09\u4E2A\u5B57\u542C\u5F97\u4E00\u5B57\u4E0D\u843D\u3002" },
            { speaker: "\u5251\u59EC", mood: "moved", text: "\u7EC3\u5251\u6709\u4EBA\u770B\u62DB\u5F0F\uFF0C\u505A\u996D\u2026\u2026\u7B2C\u4E00\u6B21\u6709\u4EBA\u770B\u706B\u5019\u3002" },
            { speaker: "\u5251\u59EC", mood: "shy", text: "\u4E0B\u6B21\u8FD8\u505A\u3002\u8FD9\u53E5\u8BDD\u4E0D\u662F\u5BA2\u5957\uFF0C\u662F\u300A\u9884\u5B9A\u300B\u3002" }
          ]
        },
        {
          id: "save_dessert_for_her",
          label: "\u201C\u751C\u70B9\u7559\u5230\u6700\u540E\uFF0C\u63A8\u56DE\u5979\u90A3\u8FB9\u3002\u201D",
          mood: "shy",
          responseDialogue: [
            { text: "\u5979\u628A\u751C\u70B9\u53C8\u63A8\u56DE\u6765\uFF0C\u63A8\u4E86\u4E09\u4E2A\u56DE\u5408\uFF0C\u6700\u540E\u7528\u5C0F\u7B7E\u628A\u5B83\u5206\u6210\u4E86\u6574\u9F50\u7684\u4E24\u534A\u3002" },
            { speaker: "\u5251\u59EC", mood: "shy", text: "\u5404\u9000\u4E00\u6B65\u3002\u8FD9\u662F\u6211\u80FD\u63A5\u53D7\u7684\u300A\u552F\u4E00\u6218\u679C\u300B\u3002" }
          ]
        }
      ],
      memoryCallbacks: [
        {
          fromStoryId: "aff_swordsman_08_preference",
          choiceId: "ask_today_preference",
          dialogue: [
            { speaker: "\u5251\u59EC", text: "\u4ECA\u5929\u4E5F\u662F\u4F4E\u7CD6\u3002\u6211\u8BB0\u5F97\u4F60\u95EE\u8FC7\u6211\u4E00\u6B21\uFF0C\u4ECE\u90A3\u4EE5\u540E\uFF0C\u6211\u8BB0\u5F97\u6BCF\u4E00\u6B21\u3002" }
          ]
        }
      ]
    }
  },
  {
    slot: "night",
    story: {
      id: "aff_swordsman_12_bridge",
      classId: "swordsman",
      episode: 12,
      title: "\u706F\u6865\u4E0A\u5E76\u80A9\u5F52\u8425",
      episodeLabel: "\u7B2C\u5341\u4E8C\u5E55 \xB7 \u706F\u6865\u5F52\u8425",
      unlockPoints: 4100,
      requiredStoryIds: ["aff_swordsman_11_bento"],
      completionPoints: 60,
      backgroundAsset: "assets/affection/scenes/swordsman-lantern-bridge.webp",
      cgAsset: "assets/affection/cg/swordsman-paired-tassels.webp",
      openingDialogue: [
        { text: "\u591C\u8BAD\u7ED3\u675F\uFF0C\u706F\u6865\u4E00\u4E32\u706F\u7B3C\u6B21\u7B2C\u4EAE\u8D77\u3002\u5979\u6CA1\u6709\u8D70\u5FEB\uFF0C\u628A\u56DE\u8425\u7684\u8DEF\u8BA9\u7ED9\u4E86\u6162\u6162\u8D70\u3002" },
        { speaker: "\u5251\u59EC", text: "\u4EE5\u524D\u8FD9\u6761\u8DEF\u662F\u7528\u6765\u8D76\u7684\u3002\u8D76\u56DE\u53BB\u64E6\u5251\u3001\u590D\u76D8\u3001\u7761\u591F\u4E94\u4E2A\u65F6\u8FB0\u3002" },
        { speaker: "\u5251\u59EC", mood: "shy", text: "\u73B0\u5728\u6211\u60F3\u8BA9\u5B83\u957F\u4E00\u70B9\u3002\u5C31\u56E0\u4E3A\u65C1\u8FB9\u591A\u4E86\u4E00\u4E2A\u4EBA\u2014\u2014\u8FD9\u8BDD\u6211\u300A\u53EA\u8BF4\u4E00\u904D\u300B\u3002" }
      ],
      choices: [
        {
          id: "walk_on_outside",
          label: "\u201C\u6362\u6211\u8D70\u5916\u4FA7\u3002\u4ECA\u665A\u6362\u6211\u62A4\u7740\u4F60\u3002\u201D",
          mood: "moved",
          responseDialogue: [
            { text: "\u5979\u505C\u4E0B\u811A\u6B65\u770B\u4F60\u6362\u5230\u5916\u4FA7\uFF0C\u706F\u7B3C\u7684\u5149\u5728\u5979\u773C\u91CC\u6643\u4E86\u4E00\u4E0B\u3002" },
            { speaker: "\u5251\u59EC", mood: "moved", text: "\u88AB\u4EBA\u62A4\u7740\u2026\u2026\u539F\u6765\u4E0D\u662F\u5378\u4E0B\u8D23\u4EFB\uFF0C\u662F\u591A\u4E86\u4E00\u4E2A\u300A\u60F3\u4E00\u8D77\u56DE\u53BB\u7684\u4EBA\u300B\u3002" },
            { speaker: "\u5251\u59EC", mood: "shy", text: "\u90A3\u5C31\u62DC\u6258\u4F60\u4E86\u3002\u8FD9\u4E00\u6BB5\u8DEF\u3002" }
          ]
        },
        {
          id: "tie_two_tassels",
          label: "\u201C\u628A\u65B0\u7A57\u548C\u65E7\u7A57\u5E76\u5728\u4E00\u8D77\uFF0C\u7CFB\u6210\u4E00\u5BF9\u3002\u201D",
          mood: "shy",
          responseDialogue: [
            { text: "\u5979\u770B\u7740\u4E24\u6761\u7A57\u5B50\u5728\u6865\u706F\u4E0B\u5E76\u6392\u5782\u7740\uFF0C\u4F38\u624B\u66FF\u5B83\u4EEC\u7406\u9F50\u4E86\u5C3E\u7AEF\u3002" },
            { speaker: "\u5251\u59EC", mood: "moved", text: "\u65E7\u7684\u7559\u7740\u529F\u52CB\uFF0C\u65B0\u7684\u7559\u7740\u4F60\u3002\u300A\u8C01\u4E5F\u4E0D\u66FF\u8C01\u300B\u3002" },
            { text: "\u56DE\u8425\u4E4B\u540E\uFF0C\u5979\u628A\u8FD9\u5BF9\u7A57\u5B50\u6302\u5728\u4E86\u5E8A\u5934\u6700\u987A\u624B\u7684\u4F4D\u7F6E\u3002" }
          ]
        },
        {
          id: "promise_next_morning",
          label: "\u201C\u660E\u65E9\u6668\u949F\u524D\uFF0C\u6211\u8FD8\u6765\u66FF\u4F60\u6570\u5251\u3002\u201D",
          mood: "bright",
          responseDialogue: [
            { speaker: "\u5251\u59EC", mood: "bright", text: "\u90A3\u6211\u4ECA\u665A\u4F1A\u65E9\u7761\u534A\u4E2A\u65F6\u8FB0\u3002" },
            { text: "\u5979\u8BF4\u5F97\u90D1\u91CD\uFF0C\u50CF\u5728\u7B7E\u7F72\u4E00\u4EFD\u53EA\u6709\u4E24\u4E2A\u4EBA\u7684\u519B\u4EE4\u3002" },
            { speaker: "\u5251\u59EC", mood: "playful", text: "\u8FDD\u7EA6\u7684\u90A3\u4E00\u65B9\uFF0C\u8981\u8D1F\u8D23\u5E26\u300A\u7B2C\u4E8C\u5929\u7684\u65E9\u9910\u300B\u3002" }
          ]
        }
      ],
      memoryCallbacks: [
        {
          fromStoryId: "aff_swordsman_09_reciprocal",
          choiceId: "leave_future_ribbon",
          dialogue: [
            { speaker: "\u5251\u59EC", text: "\u4F60\u8BF4\u8FC7\u628A\u5C06\u6765\u7684\u7EF6\u5E26\u7559\u5230\u5C06\u6765\u3002\u90A3\u5BF9\u7A57\u5B50\uFF0C\u5C31\u5F53\u662F\u5B83\u63D0\u524D\u6765\u62A5\u5230\u4E86\u3002" }
          ]
        }
      ]
    }
  }
];
var WITCH_DATES = [
  {
    slot: "morning",
    story: {
      id: "aff_witch_10_starcandy",
      classId: "witch",
      episode: 10,
      title: "\u661F\u7CD6\u5B9E\u9A8C\u7EA6\u4F1A",
      episodeLabel: "\u7B2C\u5341\u5E55 \xB7 \u661F\u7CD6\u7EA6\u4F1A",
      unlockPoints: 3e3,
      requiredStoryIds: ["aff_witch_09_reciprocal"],
      completionPoints: 60,
      backgroundAsset: "assets/affection/scenes/witch-starcandy-atelier.webp",
      openingDialogue: [
        { text: "\u4E0A\u5348\u7684\u5DE5\u574A\u98D8\u7740\u7126\u7CD6\u9999\u3002\u5979\u628A\u4E00\u6392\u661F\u7CD6\u8BD5\u7BA1\u63A8\u6210\u5F27\u5F62\uFF0C\u50CF\u4F60\u624D\u662F\u4ECA\u5929\u7684\u4E3B\u8981\u5B9E\u9A8C\u3002" },
        { speaker: "\u9B54\u5973", mood: "playful", text: "\u672C\u6B21\u8BFE\u9898\uFF1A\u4E24\u79CD\u53E3\u5473\u7684\u661F\u7CD6\uFF0C\u5728\u201C\u4E00\u8D77\u5C1D\u201D\u7684\u524D\u63D0\u4E0B\u4F1A\u4E0D\u4F1A\u66F4\u751C\u3002" },
        { speaker: "\u9B54\u5973", mood: "shy", text: "\u5BF9\u7167\u7EC4\u65E9\u5C31\u505A\u5B8C\u4E86\u2014\u2014\u6211\u4E00\u4E2A\u4EBA\u5403\u7684\u65F6\u5019\uFF0C\u7B54\u6848\u662F\u300A\u201C\u8FD8\u884C\u201D\u300B\u3002" }
      ],
      choices: [
        {
          id: "volunteer_taster",
          label: "\u201C\u6211\u62A5\u540D\u5F53\u552F\u4E00\u8BD5\u5403\u5458\uFF0C\u8BB0\u5F55\u4EA4\u7ED9\u4F60\u5199\u3002\u201D",
          mood: "bright",
          responseDialogue: [
            { speaker: "\u9B54\u5973", mood: "playful", text: "\u6279\u51C6\u3002\u8BD5\u5403\u5458\u7684\u7B2C\u4E00\u6761\u8BB0\u5F55\u662F\u2014\u2014\u300A\u8868\u60C5\u4E0D\u8BB8\u4F5C\u5047\u300B\u3002" },
            { text: "\u5979\u76EF\u7740\u4F60\u7684\u53CD\u5E94\uFF0C\u7B14\u5C16\u5374\u8FDF\u8FDF\u6CA1\u6709\u52A8\uFF0C\u56E0\u4E3A\u5979\u4E5F\u60F3\u5148\u7B11\u4E00\u4F1A\u513F\u3002" }
          ]
        },
        {
          id: "adjust_ratio_together",
          label: "\u201C\u914D\u65B9\u6BD4\u4F8B\u6211\u4EEC\u4E00\u8D77\u6539\uFF0C\u5931\u8D25\u4F5C\u4E5F\u4E00\u8D77\u5403\u6389\u3002\u201D",
          mood: "moved",
          responseDialogue: [
            { text: "\u5979\u628A\u5931\u8D25\u4F5C\u5012\u8FDB\u4E24\u4E2A\u676F\u5B50\uFF0C\u81EA\u5DF1\u5148\u559D\u4E86\u4E00\u5927\u53E3\u3002" },
            { speaker: "\u9B54\u5973", mood: "moved", text: "\u4EE5\u524D\u5931\u8D25\u662F\u8981\u7ACB\u523B\u9500\u6BC1\u7684\u3002\u548C\u4F60\u4E00\u8D77\u4E4B\u540E\uFF0C\u5B83\u4EEC\u6539\u540D\u53EB\u300A\u201C\u8FC7\u7A0B\u201D\u300B\u3002" },
            { speaker: "\u9B54\u5973", mood: "shy", text: "\u8FD9\u676F\u4E0D\u7B97\u597D\u559D\u3002\u4F46\u8FD9\u4E00\u53E3\uFF0C\u6211\u60F3\u8BB0\u4E0B\u6765\u3002" }
          ]
        },
        {
          id: "ask_lab_rules",
          label: "\u201C\u8FDB\u5DE5\u574A\u524D\uFF0C\u5148\u544A\u8BC9\u6211\u54EA\u4E9B\u4E1C\u897F\u4E0D\u8BB8\u78B0\u3002\u201D",
          mood: "calm",
          responseDialogue: [
            { text: "\u5979\u660E\u663E\u677E\u4E86\u53E3\u6C14\uFF0C\u628A\u4E09\u6837\u5371\u9669\u54C1\u9010\u4E00\u70B9\u540D\uFF0C\u7136\u540E\u628A\u5176\u4F59\u7684\u63A8\u5230\u4F60\u9762\u524D\u3002" },
            { speaker: "\u9B54\u5973", mood: "moved", text: "\u522B\u4EBA\u8FDB\u95E8\u5148\u78B0\u518D\u95EE\uFF0C\u4F60\u662F\u53CD\u8FC7\u6765\u2026\u2026\u6240\u4EE5\u6211\u624D\u6562\u628A\u5DE5\u574A\u300A\u7ED9\u4F60\u770B\u300B\u3002" }
          ]
        }
      ],
      memoryCallbacks: [
        {
          fromStoryId: "aff_witch_08_secret",
          choiceId: "ask_opening_rule",
          dialogue: [
            { speaker: "\u9B54\u5973", text: "\u4F60\u770B\uFF0C\u5148\u95EE\u8FB9\u754C\u7684\u4EBA\uFF0C\u6700\u540E\u4F1A\u88AB\u5141\u8BB8\u8D70\u8FDB\u6765\u6700\u8FDC\u7684\u5730\u65B9\u3002" }
          ]
        }
      ]
    }
  },
  {
    slot: "afternoon",
    story: {
      id: "aff_witch_11_planetarium",
      classId: "witch",
      episode: 11,
      title: "\u4FEE\u597D\u90A3\u5EA7\u5C0F\u661F\u8C61\u9986",
      episodeLabel: "\u7B2C\u5341\u4E00\u5E55 \xB7 \u661F\u8C61\u9986\u4FEE\u590D",
      unlockPoints: 3500,
      requiredStoryIds: ["aff_witch_10_starcandy"],
      completionPoints: 60,
      backgroundAsset: "assets/affection/scenes/witch-planetarium-repair.webp",
      openingDialogue: [
        { text: "\u5348\u540E\uFF0C\u9601\u697C\u7684\u65E7\u661F\u8C61\u4EEA\u5361\u5728\u67D0\u4E2A\u5E74\u4EE3\uFF0C\u6295\u51FA\u7684\u661F\u661F\u5168\u6B6A\u5411\u4E00\u8FB9\u3002\u5979\u8E29\u7740\u68AF\u5B50\uFF0C\u56DE\u5934\u770B\u4F60\u3002" },
        { speaker: "\u9B54\u5973", mood: "shy", text: "\u5B83\u662F\u6211\u5C0F\u65F6\u5019\u7167\u7740\u4E66\u505A\u7684\u3002\u4FEE\u5F97\u597D\u5C31\u7EE7\u7EED\u8F6C\uFF0C\u4FEE\u4E0D\u597D\u2026\u2026\u300A\u4E5F\u4E0D\u8BB8\u7B11\u300B\u3002" },
        { text: "\u6273\u624B\u9012\u4E0B\u6765\u65F6\uFF0C\u5979\u5148\u628A\u53EF\u80FD\u5939\u624B\u7684\u90E8\u4F4D\u5305\u4E86\u4E00\u5C42\u8F6F\u5E03\u3002" }
      ],
      choices: [
        {
          id: "hold_ladder",
          label: "\u201C\u4F60\u4FEE\uFF0C\u6211\u6276\u68AF\u5B50\u3002\u9AD8\u5EA6\u4EA4\u7ED9\u6211\u76EF\u7740\u3002\u201D",
          mood: "moved",
          responseDialogue: [
            { text: "\u5979\u4F4E\u5934\u786E\u8BA4\u4F60\u7684\u624B\u6276\u7A33\u4E86\uFF0C\u624D\u7EE7\u7EED\u5F80\u4E0A\u591F\u3002" },
            { speaker: "\u9B54\u5973", mood: "moved", text: "\u5947\u602A\u3002\u660E\u660E\u53EA\u662F\u6276\u68AF\u5B50\uFF0C\u6211\u5374\u6562\u7AD9\u5230\u300A\u4EE5\u524D\u4E0D\u6562\u7AD9\u7684\u9AD8\u5EA6\u300B\u3002" }
          ]
        },
        {
          id: "recalibrate_together",
          label: "\u201C\u661F\u56FE\u6211\u6765\u5BF9\u5750\u6807\uFF0C\u9F7F\u8F6E\u5F52\u4F60\u3002\u201D",
          mood: "bright",
          responseDialogue: [
            { speaker: "\u9B54\u5973", mood: "bright", text: "\u6210\u4EA4\u3002\u9519\u4E86\u5C31\u4E00\u8D77\u91CD\u62E7\uFF0C\u8C01\u4E5F\u4E0D\u7529\u9505\u3002" },
            { text: "\u534A\u5C0F\u65F6\u540E\uFF0C\u7B2C\u4E00\u9897\u661F\u661F\u51C6\u786E\u5730\u843D\u56DE\u5B83\u8BE5\u6709\u7684\u4F4D\u7F6E\uFF0C\u4F60\u4EEC\u540C\u65F6\u201C\u54E6\u201D\u4E86\u4E00\u58F0\u3002" },
            { speaker: "\u9B54\u5973", mood: "moved", text: "\u8BB0\u4E00\u4E0B\uFF1A\u8FD9\u662F\u6211\u4EEC\u5408\u529B\u6821\u51C6\u7684\u300A\u7B2C\u4E00\u9897\u661F\u300B\u3002\u7F16\u53F7\u2026\u2026\u5C31\u7528\u4ECA\u5929\u5427\u3002" }
          ]
        },
        {
          id: "keep_old_quirk",
          label: "\u201C\u7559\u4E00\u9897\u6B6A\u7684\u522B\u4FEE\uFF0C\u90A3\u662F\u5B83\u8BA4\u8BC6\u4F60\u7684\u5E74\u4EE3\u3002\u201D",
          mood: "shy",
          responseDialogue: [
            { text: "\u5979\u6123\u5728\u68AF\u5B50\u4E0A\uFF0C\u597D\u4E00\u4F1A\u513F\u624D\u5C0F\u58F0\u7B11\u51FA\u6765\u3002" },
            { speaker: "\u9B54\u5973", mood: "shy", text: "\u4F60\u5C45\u7136\u7ED9\u4E00\u53F0\u65E7\u673A\u5668\u7559\u201C\u5F53\u5E74\u201D\u2026\u2026\u597D\uFF0C\u90A3\u5C31\u7559\u4E00\u9897\u3002" },
            { speaker: "\u9B54\u5973", mood: "moved", text: "\u6700\u6B6A\u7684\u90A3\u9897\uFF0C\u4ECE\u4ECA\u5929\u8D77\u53EB\u300A\u201C\u8BA4\u8BC6\u4F60\u4E4B\u524D\u201D\u300B\u3002" }
          ]
        }
      ],
      memoryCallbacks: [
        {
          fromStoryId: "aff_witch_09_reciprocal",
          choiceId: "two_independent_colors",
          dialogue: [
            { speaker: "\u9B54\u5973", text: "\u4E24\u79CD\u989C\u8272\u90FD\u8981\u80FD\u770B\u89C1\u5BF9\u65B9\u2014\u2014\u6240\u4EE5\u4ECA\u5929\u661F\u56FE\u4E0A\u4E5F\u7559\u7740\u4F60\u7684\u5750\u6807\u3002" }
          ]
        }
      ]
    }
  },
  {
    slot: "night",
    story: {
      id: "aff_witch_12_meteor",
      classId: "witch",
      episode: 12,
      title: "\u591C\u53F0\u5E76\u80A9\u770B\u6D41\u661F",
      episodeLabel: "\u7B2C\u5341\u4E8C\u5E55 \xB7 \u6D41\u661F\u591C\u53F0",
      unlockPoints: 4100,
      requiredStoryIds: ["aff_witch_11_planetarium"],
      completionPoints: 60,
      backgroundAsset: "assets/affection/scenes/witch-meteor-terrace.webp",
      cgAsset: "assets/affection/cg/witch-meteor-journal.webp",
      openingDialogue: [
        { text: "\u591C\u53F0\u7684\u671B\u8FDC\u955C\u5DF2\u7ECF\u67B6\u597D\uFF0C\u661F\u56FE\u644A\u5728\u4E24\u4EBA\u4E2D\u95F4\uFF0C\u624B\u8FB9\u662F\u4E24\u676F\u8FD8\u5192\u70ED\u6C14\u7684\u661F\u7CD6\u996E\u3002" },
        { speaker: "\u9B54\u5973", mood: "playful", text: "\u6D41\u661F\u96E8\u9884\u62A5\u8BEF\u5DEE\u7387\u4E09\u6210\u3002\u6240\u4EE5\u4ECA\u665A\u65E0\u8BBA\u6709\u6CA1\u6709\u6D41\u661F\uFF0C\u89C2\u6D4B\u90FD\u7B97\u6210\u529F\u2014\u2014" },
        { speaker: "\u9B54\u5973", mood: "shy", text: "\u56E0\u4E3A\u300A\u89C2\u6D4B\u5BF9\u8C61\u300B\uFF0C\u5DF2\u7ECF\u5C31\u4F4D\u4E86\u3002" }
      ],
      choices: [
        {
          id: "wish_for_her",
          label: "\u201C\u5982\u679C\u53EA\u6709\u4E00\u9897\u6D41\u661F\uFF0C\u613F\u671B\u8BA9\u7ED9\u4F60\u3002\u201D",
          mood: "moved",
          responseDialogue: [
            { text: "\u5979\u55E4\u4E86\u4E00\u58F0\u8BF4\u201C\u4E0D\u79D1\u5B66\u201D\uFF0C\u5374\u628A\u661F\u56FE\u5F80\u4F60\u90A3\u8FB9\u632A\u4E86\u534A\u5BF8\u3002" },
            { speaker: "\u9B54\u5973", mood: "moved", text: "\u90A3\u5982\u679C\u51FA\u73B0\u4E24\u9897\uFF0C\u6211\u4EEC\u4E00\u4EBA\u4E00\u4E2A\u3002\u5982\u679C\u51FA\u73B0\u4E00\u9897\u2026\u2026\u5C31\u4E00\u8D77\u8BB8\u300A\u540C\u4E00\u4E2A\u300B\u3002" },
            { speaker: "\u9B54\u5973", mood: "playful", text: "\u65B9\u6848\u5DF2\u9501\u5B9A\uFF0C\u4E0D\u8BB8\u6539\u3002" }
          ]
        },
        {
          id: "record_for_journal",
          label: "\u201C\u4F60\u8D1F\u8D23\u770B\uFF0C\u6211\u8D1F\u8D23\u8BB0\uFF0C\u540D\u5B57\u5199\u4E24\u4E2A\u4EBA\u3002\u201D",
          mood: "bright",
          responseDialogue: [
            { text: "\u5979\u628A\u89C2\u6D4B\u65E5\u5FD7\u7FFB\u5F00\u5230\u65B0\u7684\u4E00\u9875\uFF0C\u9875\u7709\u7AEF\u7AEF\u6B63\u6B63\u5199\u4E86\u4E24\u4E2A\u540D\u5B57\u3002" },
            { speaker: "\u9B54\u5973", mood: "bright", text: "\u4ECE\u4ECA\u5929\u8D77\uFF0C\u8FD9\u672C\u65E5\u5FD7\u53EB\u201C\u8054\u5408\u89C2\u6D4B\u201D\u3002\u4EE5\u524D\u7684\u5355\u4EBA\u5377\uFF0C\u300A\u5F52\u6863\u300B\u3002" }
          ]
        },
        {
          id: "admit_cold_together",
          label: "\u201C\u624B\u51B7\u4E86\u5C31\u8BF4\uFF0C\u522B\u901E\u5F3A\u3002\u6211\u8FD9\u8FB9\u4E5F\u662F\u3002\u201D",
          mood: "shy",
          responseDialogue: [
            { text: "\u591C\u98CE\u6B63\u597D\u63A0\u8FC7\u53F0\u6CBF\uFF0C\u5979\u770B\u4E86\u4F60\u4E00\u773C\uFF0C\u628A\u624B\u5957\u5206\u4E86\u4E00\u53EA\u7ED9\u4F60\u3002" },
            { speaker: "\u9B54\u5973", mood: "shy", text: "\u4E00\u4EBA\u4E00\u53EA\u3002\u5269\u4E0B\u7684\u90A3\u53EA\u624B\u2026\u2026\u300A\u81EA\u5DF1\u60F3\u529E\u6CD5\u9760\u8FD1\u70ED\u6E90\u300B\u3002" },
            { text: "\u5979\u8BF4\u5B8C\u81EA\u5DF1\u5148\u7B11\u4E86\uFF0C\u661F\u5149\u843D\u5728\u5979\u80A9\u4E0A\uFF0C\u4E00\u52A8\u6CA1\u52A8\u3002" }
          ]
        }
      ],
      memoryCallbacks: [
        {
          fromStoryId: "aff_witch_07_gift",
          choiceId: "inspect_together",
          dialogue: [
            { speaker: "\u9B54\u5973", text: "\u90A3\u6B21\u7684\u89C4\u77E9\u8FD8\u8BB0\u5F97\u5427\u2014\u2014\u4F60\u4E3B\u6301\u3002\u4ECA\u665A\u7684\u89C2\u6D4B\u8BB0\u5F55\uFF0C\u4E5F\u7531\u4F60\u6765\u5FF5\u7ED9\u6211\u542C\u3002" }
          ]
        }
      ]
    }
  }
];
var SHAMAN_DATES = [
  {
    slot: "morning",
    story: {
      id: "aff_shaman_10_shrine_market",
      classId: "shaman",
      episode: 10,
      title: "\u795E\u793E\u65E9\u5E02\u540C\u884C",
      episodeLabel: "\u7B2C\u5341\u5E55 \xB7 \u65E9\u5E02\u540C\u884C",
      unlockPoints: 3e3,
      requiredStoryIds: ["aff_shaman_09_reciprocal"],
      completionPoints: 60,
      backgroundAsset: "assets/affection/scenes/shaman-shrine-market.webp",
      openingDialogue: [
        { text: "\u795E\u793E\u4E0B\u7684\u65E9\u5E02\u521A\u9192\uFF0C\u9999\u706B\u6C14\u548C\u84B8\u997C\u7684\u767D\u96FE\u6DF7\u5728\u4E00\u8D77\u3002\u5979\u62CE\u7740\u4E00\u53EA\u7A7A\u7BEE\uFF0C\u8D70\u5F97\u4E0D\u6025\u3002" },
        { speaker: "\u7075\u5DEB", mood: "shy", text: "\u4EE5\u524D\u6765\u65E9\u5E02\uFF0C\u662F\u91C7\u4E70\u6E05\u5355\u4E0A\u7684\u4E1C\u897F\u3002\u4ECA\u5929\u6E05\u5355\u53EA\u6709\u4E00\u884C\u2014\u2014\u300A\u548C\u4F60\u6162\u6162\u8D70\u4E00\u904D\u300B\u3002" },
        { text: "\u5979\u628A\u4F60\u8BA9\u5230\u9760\u91CC\u7684\u4E00\u4FA7\uFF0C\u8863\u8896\u5728\u4EBA\u6D41\u91CC\u59CB\u7EC8\u79BB\u4F60\u534A\u62F3\u7684\u8DDD\u79BB\u3002" }
      ],
      choices: [
        {
          id: "carry_basket",
          label: "\u201C\u7BEE\u5B50\u7ED9\u6211\u3002\u4F60\u53EA\u8D1F\u8D23\u6311\u3002\u201D",
          mood: "moved",
          responseDialogue: [
            { text: "\u5979\u628A\u7BEE\u5B50\u4EA4\u7ED9\u4F60\u65F6\uFF0C\u987A\u624B\u628A\u6700\u91CD\u7684\u90A3\u888B\u7C73\u4E5F\u653E\u4E86\u8FDB\u53BB\u2014\u2014\u7136\u540E\u5077\u5077\u770B\u4F60\u5403\u4E0D\u5403\u529B\u3002" },
            { speaker: "\u7075\u5DEB", mood: "moved", text: "\u5F88\u91CD\u5427\u3002\u91CD\u5C31\u5BF9\u4E86\uFF0C\u8FD9\u6837\u6211\u624D\u6562\u627F\u8BA4\u300A\u81EA\u5DF1\u63D0\u4E86\u5F88\u4E45\u300B\u3002" }
          ]
        },
        {
          id: "taste_breakfast_stall",
          label: "\u201C\u65E9\u9910\u644A\u5148\u505C\u4E00\u4E0B\uFF0C\u6211\u8BF7\u5BA2\uFF0C\u4F60\u70B9\u3002\u201D",
          mood: "bright",
          responseDialogue: [
            { speaker: "\u7075\u5DEB", mood: "playful", text: "\u90A3\u6211\u8981\u90A3\u4EFD\u9650\u91CF\u7684\u3002" },
            { text: "\u5979\u70B9\u5B8C\u624D\u53D1\u73B0\u81EA\u5DF1\u96BE\u5F97\u4EFB\u6027\u4E86\u4E00\u6B21\uFF0C\u4F4E\u5934\u7B11\u4E86\u5F88\u4E45\u3002" },
            { speaker: "\u7075\u5DEB", mood: "moved", text: "\u539F\u6765\u88AB\u4EBA\u8BF7\u5BA2\uFF0C\u662F\u53EF\u4EE5\u4E0D\u7528\u60F3\u300A\u201C\u56DE\u793C\u201D\u300B\u4E24\u4E2A\u5B57\u7684\u3002" }
          ]
        },
        {
          id: "walk_in_comfortable_silence",
          label: "\u201C\u4E0D\u8BF4\u8BDD\u4E5F\u884C\u3002\u8D70\u5230\u54EA\u7B97\u54EA\u3002\u201D",
          mood: "calm",
          responseDialogue: [
            { text: "\u5979\u70B9\u70B9\u5934\uFF0C\u4E24\u4E2A\u4EBA\u7684\u811A\u6B65\u6E10\u6E10\u843D\u5728\u540C\u4E00\u4E2A\u8282\u62CD\u4E0A\u3002" },
            { speaker: "\u7075\u5DEB", mood: "calm", text: "\u548C\u4F60\u8D70\u8DEF\uFF0C\u300A\u5B89\u9759\u300B\u4E5F\u6709\u4E86\u53BB\u5904\u3002" }
          ]
        }
      ],
      memoryCallbacks: [
        {
          fromStoryId: "aff_shaman_08_rest",
          choiceId: "quiet_counts",
          dialogue: [
            { speaker: "\u7075\u5DEB", text: "\u4F60\u8BF4\u8FC7\u5B89\u9759\u4E5F\u7B97\u6570\u3002\u6240\u4EE5\u4ECA\u5929\u8FD9\u6761\u8857\uFF0C\u6211\u4EEC\u4E00\u53E5\u5BA2\u5957\u90FD\u4E0D\u7528\u8BB2\u3002" }
          ]
        }
      ]
    }
  },
  {
    slot: "afternoon",
    story: {
      id: "aff_shaman_11_firefly_ferry",
      classId: "shaman",
      episode: 11,
      title: "\u8424\u706B\u6E21\u821F\u540C\u4E58",
      episodeLabel: "\u7B2C\u5341\u4E00\u5E55 \xB7 \u8424\u706B\u6E21\u821F",
      unlockPoints: 3500,
      requiredStoryIds: ["aff_shaman_10_shrine_market"],
      completionPoints: 60,
      backgroundAsset: "assets/affection/scenes/shaman-firefly-ferry.webp",
      openingDialogue: [
        { text: "\u5348\u540E\u5C06\u5C3D\uFF0C\u6E21\u53E3\u7684\u8424\u706B\u4E00\u76CF\u76CF\u9192\u6765\u3002\u6728\u821F\u4E0D\u5927\uFF0C\u8239\u5BB6\u8BF4\u8FD9\u8D9F\u53EA\u8F7D\u4E24\u4F4D\u3002" },
        { speaker: "\u7075\u5DEB", text: "\u8FD9\u6761\u6C34\u8DEF\u6211\u5DE1\u8FC7\u5F88\u591A\u6B21\uFF0C\u90FD\u662F\u66FF\u522B\u4EBA\u5F15\u706F\u3002" },
        { speaker: "\u7075\u5DEB", mood: "shy", text: "\u4ECA\u5929\u6CA1\u6709\u4EBA\u8981\u7B49\u63A5\u5F15\u3002\u706F\u4EAE\u7740\uFF0C\u53EA\u662F\u56E0\u4E3A\u597D\u770B\u2014\u2014\u8FD9\u53E5\u8BDD\uFF0C\u300A\u53EA\u60F3\u5728\u8239\u4E0A\u8BF4\u7ED9\u4F60\u542C\u300B\u3002" }
      ],
      choices: [
        {
          id: "sit_opposite_balance",
          label: "\u201C\u6211\u5750\u4F60\u5BF9\u9762\uFF0C\u8239\u624D\u7A33\u3002\u201D",
          mood: "calm",
          responseDialogue: [
            { text: "\u8239\u8EAB\u8F7B\u8F7B\u4E00\u6643\u53C8\u7A33\u4E0B\u6765\uFF0C\u5979\u9694\u7740\u4E00\u81C2\u7684\u8DDD\u79BB\u770B\u4F60\uFF0C\u773C\u91CC\u843D\u7740\u6C34\u5149\u3002" },
            { speaker: "\u7075\u5DEB", mood: "moved", text: "\u5E73\u8861\u539F\u6765\u4E0D\u662F\u5404\u5750\u4E00\u8FB9\uFF0C\u662F\u4E24\u4E2A\u4EBA\u90FD\u613F\u610F\u300A\u5148\u7A33\u4F4F\u81EA\u5DF1\u300B\u3002" }
          ]
        },
        {
          id: "offer_to_row",
          label: "\u201C\u8FD9\u4E00\u6BB5\u6211\u6765\u6491\uFF0C\u4F60\u53EA\u7BA1\u770B\u8424\u706B\u3002\u201D",
          mood: "bright",
          responseDialogue: [
            { text: "\u5979\u628A\u7AF9\u7BD9\u4EA4\u7ED9\u4F60\uFF0C\u81EA\u5DF1\u7B2C\u4E00\u6B21\u5728\u822A\u7A0B\u91CC\u505A\u4E86\u4E58\u5BA2\u3002" },
            { speaker: "\u7075\u5DEB", mood: "moved", text: "\u88AB\u6E21\u7684\u611F\u89C9\u2026\u2026\u539F\u6765\u6C34\u58F0\u8FD9\u4E48\u6E05\u695A\u3002\u4EE5\u524D\u90FD\u662F\u6211\u542C\u522B\u4EBA\u4E0A\u5CB8\u3002" },
            { speaker: "\u7075\u5DEB", mood: "shy", text: "\u6162\u4E00\u70B9\u6491\u3002\u6211\u60F3\u300A\u8FDF\u4E00\u70B9\u5230\u300B\u3002" }
          ]
        },
        {
          id: "ask_before_lantern",
          label: "\u201C\u653E\u4E00\u76CF\u5F15\u8DEF\u706F\u966A\u4F60\uFF1F\u5148\u542C\u4F60\u613F\u4E0D\u613F\u610F\u3002\u201D",
          mood: "shy",
          responseDialogue: [
            { text: "\u5979\u60F3\u4E86\u4E00\u4F1A\u513F\uFF0C\u4EB2\u624B\u628A\u706F\u70B9\u4EAE\uFF0C\u5374\u628A\u5B83\u7559\u5728\u4E86\u8239\u8231\u91CC\u3002" },
            { speaker: "\u7075\u5DEB", mood: "moved", text: "\u613F\u610F\u3002\u4F46\u4ECA\u5929\u4E0D\u653E\u8D70\u5B83\u2014\u2014\u5C31\u8BA9\u5B83\u300A\u8DDF\u7740\u8239\u8D70\u300B\uFF0C\u8DDF\u4F60\u6211\u4E00\u6837\u3002" }
          ]
        }
      ],
      memoryCallbacks: [
        {
          fromStoryId: "aff_shaman_09_reciprocal",
          choiceId: "hang_side_by_side",
          dialogue: [
            { speaker: "\u7075\u5DEB", text: "\u90A3\u4E24\u76CF\u5E76\u6392\u7684\u706F\u8FD8\u5728\u795E\u793E\u95E8\u53E3\u3002\u4ECA\u5929\u8239\u8231\u91CC\u8FD9\u76CF\uFF0C\u662F\u7B2C\u4E09\u76CF\u3002" }
          ]
        }
      ]
    }
  },
  {
    slot: "night",
    story: {
      id: "aff_shaman_12_rainy_teahouse",
      classId: "shaman",
      episode: 12,
      title: "\u96E8\u591C\u8336\u5C4B\u5171\u4EAB\u5B89\u9759",
      episodeLabel: "\u7B2C\u5341\u4E8C\u5E55 \xB7 \u96E8\u591C\u8336\u5C4B",
      unlockPoints: 4100,
      requiredStoryIds: ["aff_shaman_11_firefly_ferry"],
      completionPoints: 60,
      backgroundAsset: "assets/affection/scenes/shaman-rainy-teahouse.webp",
      cgAsset: "assets/affection/cg/shaman-paired-teacups.webp",
      openingDialogue: [
        { text: "\u591C\u96E8\u6572\u7740\u8336\u5C4B\u7684\u6A90\u89D2\uFF0C\u5C4B\u91CC\u53EA\u6709\u716E\u6C34\u7684\u8F7B\u54CD\u3002\u5979\u628A\u4E24\u53EA\u8336\u76CF\u5E76\u6392\u6446\u597D\uFF0C\u96FE\u6C14\u5728\u4E24\u4EBA\u4E4B\u95F4\u5347\u8D77\u6765\u3002" },
        { speaker: "\u7075\u5DEB", text: "\u5F88\u591A\u4EBA\u627E\u6211\uFF0C\u662F\u4E3A\u4E86\u628A\u5FC3\u91CC\u7684\u8BDD\u5012\u51FA\u6765\u3002" },
        { speaker: "\u7075\u5DEB", mood: "shy", text: "\u53EF\u4ECA\u665A\u6211\u4EC0\u4E48\u90FD\u4E0D\u60F3\u5012\u3002\u53EA\u60F3\u548C\u4F60\u628A\u8FD9\u4E00\u58F6\u559D\u5B8C\u2014\u2014\u300A\u8FD9\u4E5F\u7B97\u4E00\u79CD\u503E\u8BC9\u300B\uFF0C\u4F60\u61C2\u5417\uFF1F" }
      ],
      choices: [
        {
          id: "pour_for_each_other",
          label: "\u201C\u7B2C\u4E00\u5DE1\u6211\u659F\uFF0C\u7B2C\u4E8C\u5DE1\u6362\u4F60\u3002\u201D",
          mood: "moved",
          responseDialogue: [
            { text: "\u4E24\u8F6E\u8336\u4E0B\u6765\uFF0C\u5979\u6367\u7740\u76CF\u6CBF\u7684\u624B\u653E\u677E\u4E86\u8BB8\u591A\u3002" },
            { speaker: "\u7075\u5DEB", mood: "moved", text: "\u88AB\u7167\u987E\u548C\u7167\u987E\u4EBA\uFF0C\u539F\u6765\u53EF\u4EE5\u5728\u540C\u4E00\u5F20\u684C\u4E0A\u300A\u8F6E\u73ED\u300B\u3002\u4EE5\u524D\u6211\u603B\u662F\u4E00\u4E2A\u4EBA\u5305\u573A\u3002" }
          ]
        },
        {
          id: "listen_to_rain_together",
          label: "\u201C\u4E0D\u542C\u5FC3\u4E8B\uFF0C\u542C\u96E8\u3002\u542C\u5230\u96E8\u505C\u3002\u201D",
          mood: "calm",
          responseDialogue: [
            { text: "\u5979\u987A\u7740\u4F60\u7684\u76EE\u5149\u770B\u5411\u6A90\u5916\uFF0C\u5F88\u4E45\u6CA1\u6709\u8BF4\u8BDD\uFF0C\u80A9\u8180\u5374\u4E00\u70B9\u70B9\u677E\u4E0B\u6765\u3002" },
            { speaker: "\u7075\u5DEB", mood: "calm", text: "\u539F\u6765\u6700\u50CF\u56DE\u7B54\u7684\u58F0\u97F3\uFF0C\u662F\u4E24\u4E2A\u4EBA\u4E00\u8D77\u542C\u89C1\u7684\u300A\u90A3\u573A\u96E8\u300B\u3002" },
            { speaker: "\u7075\u5DEB", mood: "moved", text: "\u4ECA\u665A\u4EC0\u4E48\u90FD\u4E0D\u7528\u89E3\u51B3\u3002\u8FD9\u6837\u5C31\u591F\u4E86\u3002" }
          ]
        },
        {
          id: "leave_cups_unwashed",
          label: "\u201C\u8336\u76CF\u5148\u522B\u6536\u3002\u8BA9\u5B83\u4EEC\u4E5F\u5750\u4E00\u4F1A\u513F\u3002\u201D",
          mood: "shy",
          responseDialogue: [
            { text: "\u5979\u5931\u7B11\uFF0C\u771F\u7684\u628A\u4E24\u53EA\u7A7A\u76CF\u5E76\u6392\u7559\u5728\u684C\u4E0A\uFF0C\u50CF\u7559\u4E24\u4F4D\u5C0F\u5C0F\u7684\u5BA2\u4EBA\u3002" },
            { speaker: "\u7075\u5DEB", mood: "playful", text: "\u597D\u3002\u8BA9\u5B83\u4EEC\u4E5F\u542C\u542C\u96E8\u3002\u2014\u2014\u4F60\u770B\uFF0C\u6211\u4E5F\u5B66\u4F1A\u300A\u4E0D\u8BB2\u9053\u7406\u300B\u4E86\u3002" }
          ]
        }
      ],
      memoryCallbacks: [
        {
          fromStoryId: "aff_shaman_07_gift",
          choiceId: "blank_is_complete",
          dialogue: [
            { speaker: "\u7075\u5DEB", text: "\u7A7A\u767D\u7684\u613F\u7EB8\u4F60\u66FF\u6211\u7559\u4F4F\u4E86\u3002\u4ECA\u665A\u8FD9\u58F6\u8336\uFF0C\u6211\u4E5F\u66FF\u4F60\u7559\u4E86\u4E00\u76CF\u7A7A\u767D\u2014\u2014\u4EC0\u4E48\u90FD\u4E0D\u8BF4\uFF0C\u4E5F\u662F\u6EE1\u7684\u3002" }
          ]
        }
      ]
    }
  }
];
var CATKIN_DATES = [
  {
    slot: "morning",
    story: {
      id: "aff_catkin_10_supply_market",
      classId: "catkin",
      episode: 10,
      title: "\u8865\u7ED9\u5E02\u96C6\u5927\u91C7\u8D2D",
      episodeLabel: "\u7B2C\u5341\u5E55 \xB7 \u8865\u7ED9\u5E02\u96C6",
      unlockPoints: 3e3,
      requiredStoryIds: ["aff_catkin_09_reciprocal"],
      completionPoints: 60,
      backgroundAsset: "assets/affection/scenes/catkin-supply-market.webp",
      openingDialogue: [
        { text: "\u4E0A\u5348\u7684\u8865\u7ED9\u5E02\u96C6\u5435\u5435\u95F9\u95F9\uFF0C\u5979\u5DF2\u7ECF\u5217\u597D\u4E86\u4E00\u5F20\u53CC\u4EBA\u6E05\u5355\uFF0C\u5DE6\u4E0A\u89D2\u8FD8\u76D6\u4E86\u4E2A\u5C0F\u5C0F\u7684\u722A\u5370\u7AE0\u3002" },
        { speaker: "\u55B5\u55B5", mood: "bright", text: "\u7B2C\u4E00\u526F\u961F\u957F\uFF01\u4ECA\u5929\u7684\u8FDC\u5F81\u76EE\u6807\u662F\u2014\u2014\u628A\u8FD9\u5F20\u6E05\u5355\u300A\u5168\u90E8\u6253\u52FE\u300B\uFF01" },
        { speaker: "\u55B5\u55B5", mood: "playful", text: "\u89C4\u5219\u7167\u65E7\uFF1A\u6211\u7684\u683C\u5B50\u6211\u81EA\u5DF1\u80CC\uFF0C\u4F60\u7684\u90A3\u4EFD\u4E0D\u8BB8\u5077\u5077\u52A0\u7801\u3002" }
      ],
      choices: [
        {
          id: "race_checklist",
          label: "\u201C\u5206\u5934\u884C\u52A8\uFF0C\u6BD4\u8C01\u5148\u96C6\u9F50\uFF0C\u8F93\u7684\u63D0\u888B\u5B50\u3002\u201D",
          mood: "bright",
          responseDialogue: [
            { text: "\u5979\u55D6\u5730\u7A9C\u51FA\u53BB\uFF0C\u53C8\u6298\u8FD4\u56DE\u6765\u628A\u6E05\u5355\u6495\u6210\u6574\u9F50\u7684\u4E24\u534A\u3002" },
            { speaker: "\u55B5\u55B5", mood: "bright", text: "\u8FD9\u6837\u624D\u516C\u5E73\uFF01\u2014\u2014\u4E0D\u8FC7\u7EC8\u70B9\u8981\u300A\u4E00\u8D77\u51B2\u7EBF\u300B\uFF0C\u8FD9\u662F\u642D\u6863\u6761\u6B3E\uFF01" }
          ]
        },
        {
          id: "inspect_supplies_together",
          label: "\u201C\u5E72\u7CAE\u8981\u6311\u4FDD\u8D28\u671F\u7684\uFF0C\u6211\u966A\u4F60\u4E00\u5305\u4E00\u5305\u770B\u3002\u201D",
          mood: "moved",
          responseDialogue: [
            { text: "\u5979\u628A\u6BCF\u5305\u5E72\u7CAE\u4E3E\u5230\u5149\u5E95\u4E0B\uFF0C\u548C\u4F60\u4E00\u8D77\u770B\u5B8C\u624D\u653E\u8FDB\u7BEE\u5B50\uFF0C\u795E\u60C5\u50CF\u5728\u68C0\u9605\u6B66\u5668\u3002" },
            { speaker: "\u55B5\u55B5", mood: "moved", text: "\u4EE5\u524D\u6211\u90FD\u662F\u6293\u5230\u5C31\u8D70\u2026\u2026\u539F\u6765\u6162\u6162\u6311\uFF0C\u6311\u5230\u7684\u90FD\u662F\u300A\u597D\u65E5\u5B50\u300B\u3002" }
          ]
        },
        {
          id: "ask_budget_first",
          label: "\u201C\u9884\u7B97\u4E0A\u9650\u5148\u8BF4\u6E05\u695A\uFF0C\u8D85\u4E86\u7684\u6211\u81EA\u5DF1\u60F3\u529E\u6CD5\u3002\u201D",
          mood: "calm",
          responseDialogue: [
            { text: "\u5979\u8BA4\u771F\u5730\u5728\u6E05\u5355\u89D2\u843D\u5199\u4E0B\u6570\u5B57\uFF0C\u53C8\u5728\u65C1\u8FB9\u753B\u4E86\u4E00\u4E2A\u5C0F\u5C0F\u7684\u201C+\u60CA\u559C\u989D\u5EA6\u201D\u3002" },
            { speaker: "\u55B5\u55B5", mood: "playful", text: "\u60CA\u559C\u989D\u5EA6\u662F\u300A\u642D\u6863\u4E13\u7528\u300B\uFF01\u7528\u4E0D\u7528\u7531\u4F60\uFF0C\u51C6\u4E0D\u51C6\u5907\u7531\u6211\u3002" }
          ]
        }
      ],
      memoryCallbacks: [
        {
          fromStoryId: "aff_catkin_07_gift",
          choiceId: "owner_sets_labels",
          dialogue: [
            { speaker: "\u55B5\u55B5", text: "\u6E05\u5355\u7684\u6807\u7B7E\u4E5F\u662F\u6211\u586B\u7684\uFF01\u4F60\u7684\u90A3\u4E00\u680F\u6211\u53EA\u5199\u4E86\u4E24\u4E2A\u5B57\u2014\u2014\u201C\u642D\u6863\u201D\u3002" }
          ]
        }
      ]
    }
  },
  {
    slot: "afternoon",
    story: {
      id: "aff_catkin_11_workshop_coffee",
      classId: "catkin",
      episode: 11,
      title: "\u7EB8\u7BB1\u5DE5\u574A\u7684\u5496\u5561\u65F6\u95F4",
      episodeLabel: "\u7B2C\u5341\u4E00\u5E55 \xB7 \u5496\u5561\u5DE5\u574A",
      unlockPoints: 3500,
      requiredStoryIds: ["aff_catkin_10_supply_market"],
      completionPoints: 60,
      backgroundAsset: "assets/affection/scenes/catkin-workshop-coffee.webp",
      openingDialogue: [
        { text: "\u5348\u540E\u7684\u7EB8\u7BB1\u5DE5\u574A\u98D8\u7740\u5496\u5561\u9999\u3002\u5979\u642C\u51FA\u4E24\u4E2A\u676F\u5B50\uFF0C\u4E00\u4E2A\u662F\u8FDC\u5F81\u7EAA\u5FF5\u6B3E\uFF0C\u4E00\u4E2A\u662F\u5D2D\u65B0\u7684\u3002" },
        { speaker: "\u55B5\u55B5", mood: "bright", text: "\u65B0\u676F\u5B50\u662F\u7ED9\u4F60\u300A\u5B9A\u5236\u300B\u7684\uFF01\u628A\u624B\u671D\u5DE6\u8FD8\u662F\u671D\u53F3\uFF0C\u8981\u4F60\u81EA\u5DF1\u8BD5\u51FA\u6765\u624D\u7B97\u6570\u3002" },
        { text: "\u5979\u8BF4\u5B8C\u5C31\u9000\u5F00\u534A\u6B65\uFF0C\u628A\u6311\u9009\u7684\u4F4D\u7F6E\u5B8C\u5B8C\u6574\u6574\u7559\u7ED9\u4F60\u2014\u2014\u8FD9\u662F\u5979\u5B66\u6765\u7684\u793C\u8C8C\u3002" }
      ],
      choices: [
        {
          id: "test_both_hands",
          label: "\u201C\u5DE6\u53F3\u624B\u90FD\u8BD5\u4E00\u904D\uFF0C\u7ED3\u679C\u8981\u5411\u5979\u6C47\u62A5\u3002\u201D",
          mood: "bright",
          responseDialogue: [
            { text: "\u5979\u6367\u7740\u672C\u5B50\u4E00\u672C\u6B63\u7ECF\u5730\u8BB0\u5F55\u201C\u63E1\u59FF\u8BC4\u4F30\u201D\uFF0C\u6700\u540E\u7ED9\u4F60\u76D6\u4E86\u4E2A\u201C\u5408\u683C\u201D\u7AE0\u3002" },
            { speaker: "\u55B5\u55B5", mood: "bright", text: "\u7ED3\u8BBA\uFF1A\u4E24\u53EA\u624B\u90FD\u5408\u683C\uFF01\u6240\u4EE5\u676F\u5B50\u8981\u505A\u6210\u300A\u4E24\u8FB9\u90FD\u80FD\u62FF\u300B\u7684\uFF01" }
          ]
        },
        {
          id: "build_cardboard_counter",
          label: "\u201C\u5496\u5561\u5427\u53F0\u4E00\u8D77\u642D\uFF0C\u56FE\u7EB8\u5979\u51FA\uFF0C\u529B\u6C14\u6211\u51FA\u3002\u201D",
          mood: "moved",
          responseDialogue: [
            { speaker: "\u55B5\u55B5", mood: "playful", text: "\u6279\u51C6\uFF01\u9489\u5B50\u4F60\u6572\uFF0C\u9A8C\u6536\u6211\u6765\u3002" },
            { text: "\u5427\u53F0\u642D\u597D\u65F6\u5979\u7ED5\u7740\u8D70\u4E86\u4E09\u5708\uFF0C\u6700\u540E\u5728\u53F0\u9762\u4E0A\u5E76\u6392\u6446\u4E86\u4E24\u4E2A\u676F\u57AB\u3002" },
            { speaker: "\u55B5\u55B5", mood: "moved", text: "\u8FD9\u4E2A\u4F4D\u7F6E\u4EE5\u540E\u53EB\u300A\u201C\u642D\u6863\u4E13\u5E2D\u201D\u300B\u3002\u4EC5\u9650\u4E24\u4EBA\uFF0C\u6C38\u4E45\u6709\u6548\u3002" }
          ]
        },
        {
          id: "ask_scritch_permission",
          label: "\u201C\u5979\u5FD9\u51FA\u6C57\u4E86\u2014\u2014\u5148\u95EE\u4E00\u53E5\uFF0C\u80FD\u4E0D\u80FD\u5E2E\u5979\u64E6\u3002\u201D",
          mood: "shy",
          responseDialogue: [
            { text: "\u5979\u6123\u4E86\u4E00\u4E0B\uFF0C\u81EA\u5DF1\u5148\u628A\u6BDB\u5DFE\u63A5\u8FC7\u53BB\uFF0C\u53C8\u7B11\u7740\u628A\u53E6\u4E00\u5934\u9012\u56DE\u4F60\u624B\u91CC\u3002" },
            { speaker: "\u55B5\u55B5", mood: "shy", text: "\u95EE\u5F97\u597D\uFF01\u6240\u4EE5\u7B54\u6848\u662F\u2014\u2014\u300A\u4E00\u4EBA\u62FF\u4E00\u5934\u300B\uFF0C\u4E00\u8D77\u53E0\u597D\u5B83\u3002" }
          ]
        }
      ],
      memoryCallbacks: [
        {
          fromStoryId: "aff_catkin_08_sentimental",
          choiceId: "ask_before_view",
          dialogue: [
            { speaker: "\u55B5\u55B5", text: "\u201C\u5148\u95EE\u201D\u8FD9\u4E24\u4E2A\u5B57\uFF0C\u662F\u4F60\u6559\u6211\u7684\u3002\u73B0\u5728\u8F6E\u5230\u6211\u7528\u5728\u4F60\u8EAB\u4E0A\u5566\u3002" }
          ]
        }
      ]
    }
  },
  {
    slot: "night",
    story: {
      id: "aff_catkin_12_night_train",
      classId: "catkin",
      episode: 12,
      title: "\u6708\u53F0\u5C4B\u9876\u770B\u591C\u8F66",
      episodeLabel: "\u7B2C\u5341\u4E8C\u5E55 \xB7 \u591C\u8F66\u6708\u53F0",
      unlockPoints: 4100,
      requiredStoryIds: ["aff_catkin_11_workshop_coffee"],
      completionPoints: 60,
      backgroundAsset: "assets/affection/scenes/catkin-rooftop-platform.webp",
      cgAsset: "assets/affection/cg/catkin-two-tickets.webp",
      openingDialogue: [
        { text: "\u591C\u73ED\u7684\u5217\u8F66\u4ECE\u8FDC\u5904\u8FDB\u7AD9\uFF0C\u706F\u5149\u5728\u8F68\u9053\u4E0A\u4E00\u8282\u8282\u4EAE\u8FC7\u6765\u3002\u5979\u5750\u5728\u6708\u53F0\u5C4B\u9876\u7684\u8001\u4F4D\u7F6E\uFF0C\u62CD\u4E86\u62CD\u8EAB\u8FB9\u3002" },
        { speaker: "\u55B5\u55B5", text: "\u4EE5\u524D\u770B\u591C\u8F66\uFF0C\u662F\u5728\u6570\u201C\u5927\u5BB6\u90FD\u53BB\u591A\u8FDC\u7684\u5730\u65B9\u201D\u3002" },
        { speaker: "\u55B5\u55B5", mood: "moved", text: "\u73B0\u5728\u6570\u7684\u662F\u2014\u2014\u6709\u4E00\u73ED\u8F66\u8FDB\u7AD9\u7684\u65F6\u5019\uFF0C\u300A\u6211\u8EAB\u8FB9\u7684\u4EBA\u6CA1\u6709\u8D70\u300B\u3002" }
      ],
      choices: [
        {
          id: "keep_two_tickets",
          label: "\u201C\u4E70\u4E24\u5F20\u4E0B\u4E00\u73ED\u7684\u7968\uFF0C\u4E0D\u4E0A\u8F66\uFF0C\u5C31\u7559\u7740\u3002\u201D",
          mood: "moved",
          responseDialogue: [
            { text: "\u5979\u628A\u4E24\u5F20\u7968\u5BF9\u9F50\u6495\u89D2\uFF0C\u90D1\u91CD\u5730\u6536\u8FDB\u8FDC\u5F81\u67DC\u7684\u5171\u4EAB\u683C\u3002" },
            { speaker: "\u55B5\u55B5", mood: "moved", text: "\u7968\u6839\u7559\u7740\uFF0C\u4E0D\u662F\u4E3A\u4E86\u8D70\u3002\u662F\u4E3A\u4E86\u8BC1\u660E\u2014\u2014\u60F3\u53BB\u7684\u5730\u65B9\uFF0C\u300A\u5DF2\u7ECF\u6709\u4EBA\u966A\u6211\u5230\u4E86\u300B\u3002" }
          ]
        },
        {
          id: "wave_at_train",
          label: "\u201C\u8F66\u8FDB\u7AD9\u65F6\u4E00\u8D77\u6325\u624B\uFF0C\u7BA1\u5B83\u770B\u4E0D\u770B\u5F97\u89C1\u3002\u201D",
          mood: "bright",
          responseDialogue: [
            { text: "\u591C\u8F66\u7F13\u7F13\u8FDB\u7AD9\uFF0C\u4F60\u4EEC\u6325\u5F97\u50CF\u4E24\u4E2A\u9001\u884C\u7684\u5B69\u5B50\u3002\u5979\u7B11\u5F97\u5DEE\u70B9\u4ECE\u5C4B\u9876\u4E0A\u6ED1\u4E0B\u53BB\u3002" },
            { speaker: "\u55B5\u55B5", mood: "bright", text: "\u53F8\u673A\u521A\u521A\u95EA\u4E86\u4E00\u4E0B\u706F\uFF01\u90A3\u662F\u300A\u56DE\u793C\u300B\uFF01\u6211\u4EEC\u7684\uFF01" }
          ]
        },
        {
          id: "promise_no_sendoff",
          label: "\u201C\u4E0B\u6B21\u8FDC\u5F81\uFF0C\u4E0D\u8BB8\u4E00\u4E2A\u4EBA\u5077\u5077\u4E0A\u8F66\u3002\u201D",
          mood: "shy",
          responseDialogue: [
            { text: "\u5979\u76EF\u7740\u4F60\u770B\u4E86\u597D\u4E00\u4F1A\u513F\uFF0C\u4F38\u51FA\u5C3E\u5DF4\u5C16\u8F7B\u8F7B\u78B0\u4E86\u78B0\u4F60\u7684\u8896\u53E3\u2014\u2014\u8FD9\u662F\u5979\u4E3B\u52A8\u7684\u7EA6\u5B9A\u65B9\u5F0F\u3002" },
            { speaker: "\u55B5\u55B5", mood: "shy", text: "\u6761\u6B3E\u6210\u7ACB\u3002\u8FDD\u53CD\u7684\u4EBA\uFF0C\u8981\u5728\u6708\u53F0\u4E0A\u300A\u7B49\u5230\u88AB\u539F\u8C05\u4E3A\u6B62\u300B\u3002" },
            { speaker: "\u55B5\u55B5", mood: "moved", text: "\u4E0D\u8FC7\u6211\u89C9\u5F97\u2026\u2026\u6211\u4EEC\u53EF\u80FD\u6C38\u8FDC\u7528\u4E0D\u4E0A\u8FD9\u6761\u3002" }
          ]
        }
      ],
      memoryCallbacks: [
        {
          fromStoryId: "aff_catkin_09_reciprocal",
          choiceId: "two_plus_shared",
          dialogue: [
            { speaker: "\u55B5\u55B5", text: "\u5171\u4EAB\u683C\u7684\u7B2C\u4E00\u4EF6\u85CF\u54C1\u60F3\u597D\u4E86\u2014\u2014\u4ECA\u665A\u8FD9\u4E24\u5F20\u7968\uFF0C\u8FD8\u6709\u4E00\u95EA\u4E00\u95EA\u7684\u8F66\u706F\u3002" }
          ]
        }
      ]
    }
  }
];
var AFFECTION_DATES = {
  swordsman: SWORDSMAN_DATES,
  witch: WITCH_DATES,
  shaman: SHAMAN_DATES,
  catkin: CATKIN_DATES
};
var AFFECTION_DATE_STORIES = Object.values(
  AFFECTION_DATES
).flatMap((dates) => dates.map((date) => date.story));
function affectionDateStories(classId) {
  return AFFECTION_DATES[classId].map((date) => date.story);
}

// src/data/affection.ts
var interaction = (id, label, shortDescription, mood, action, lines, requiredStoryId) => ({
  id,
  label,
  shortDescription,
  points: 10,
  mood,
  action,
  lines,
  ...requiredStoryId ? { requiredStoryId } : {}
});
var rememberedChoices = (fromStoryId, speaker, entries) => entries.map(([choiceId, text]) => ({
  fromStoryId,
  choiceId,
  dialogue: [{ speaker, text }]
}));
var SWORDSMAN_STORIES = [
  {
    id: "aff_swordsman_01_dawn",
    classId: "swordsman",
    episode: 1,
    title: "\u6BD4\u6668\u5149\u65E9\u4E00\u6B65",
    episodeLabel: "\u7B2C\u4E00\u5E55 \xB7 \u6668\u6A31\u966A\u7EC3",
    unlockPoints: 0,
    requiredStoryIds: [],
    completionPoints: 30,
    backgroundAsset: "assets/affection/scenes/swordsman-training-dawn.webp",
    openingDialogue: [
      { text: "\u6668\u949F\u8FD8\u6CA1\u54CD\uFF0C\u6A31\u82B1\u8BAD\u7EC3\u573A\u5DF2\u7ECF\u4F20\u6765\u6574\u9F50\u7684\u7834\u98CE\u58F0\u3002" },
      { speaker: "\u5251\u59EC", mood: "bright", text: "\u4F60\u6765\u5F97\u6BD4\u300A\u6668\u949F\u300B\u8FD8\u65E9\u3002\u6B63\u597D\uFF0C\u80FD\u66FF\u6211\u6570\u5230\u4E00\u767E\u5417\uFF1F" },
      { text: "\u5979\u4ECD\u63E1\u7740\u5251\uFF0C\u76EE\u5149\u5374\u5DF2\u7ECF\u5B89\u9759\u5730\u505C\u5728\u4F60\u8EAB\u4E0A\u3002" }
    ],
    choices: [
      {
        id: "watch_breath",
        label: "\u201C\u53EF\u4EE5\u3002\u4F46\u4F60\u547C\u5438\u4E71\u4E86\uFF0C\u6211\u5C31\u558A\u505C\u3002\u201D",
        mood: "moved",
        responseDialogue: [
          { text: "\u5979\u5FAE\u5FAE\u4E00\u6014\uFF0C\u628A\u5251\u5C16\u538B\u4F4E\u4E86\u4E00\u5BF8\u3002" },
          { speaker: "\u5251\u59EC", mood: "moved", text: "\u6BD4\u8D77\u6325\u4E86\u591A\u5C11\u6B21\uFF0C\u300A\u4F60\u5148\u770B\u89C1\u7684\u662F\u6211\u7D2F\u4E0D\u7D2F\u300B\u2026\u2026" },
          { speaker: "\u5251\u59EC", mood: "shy", text: "\u90A3\u5C31\u52B3\u4F60\u300A\u76EF\u7D27\u300B\u4E86\u3002" }
        ]
      },
      {
        id: "wooden_sword",
        label: "\u201C\u6211\u62FF\u6728\u5251\u966A\u4F60\uFF0C\u6570\u6570\u4EA4\u7ED9\u6668\u949F\u3002\u201D",
        mood: "bright",
        responseDialogue: [
          { speaker: "\u5251\u59EC", mood: "playful", text: "\u4E0D\u8BB8\u5077\u61D2\u3002" },
          { text: "\u5979\u8F6C\u8FC7\u8EAB\u85CF\u4F4F\u7B11\u610F\uFF0C\u53C8\u628A\u53E6\u4E00\u628A\u6728\u5251\u63A8\u5230\u4F60\u624B\u8FB9\u3002" },
          { speaker: "\u5251\u59EC", mood: "moved", text: "\u4E0D\u8FC7\uFF0C\u300A\u4E24\u4E2A\u4EBA\u7684\u811A\u6B65\u58F0\u300B\u2026\u2026\u786E\u5B9E\u6BD4\u949F\u58F0\u597D\u542C\u3002" }
        ]
      },
      {
        id: "ask_guard",
        label: "\u201C\u62A4\u8155\u677E\u4E86\u3002\u9700\u8981\u6211\u5E2E\u4F60\u91CD\u65B0\u7CFB\u5417\uFF1F\u201D",
        mood: "shy",
        responseDialogue: [
          { text: "\u5979\u786E\u8BA4\u4F60\u7684\u624B\u505C\u5728\u539F\u5904\uFF0C\u624D\u4E3B\u52A8\u628A\u624B\u8155\u9012\u6765\u3002" },
          { speaker: "\u5251\u59EC", mood: "shy", text: "\u53EA\u8BB8\u7CFB\u62A4\u8155\uFF0C\u4E0D\u8BB8\u8D81\u673A\u7B11\u6211\u3002" },
          { text: "\u6700\u540E\u4E00\u4E2A\u7ED3\u7CFB\u597D\u65F6\uFF0C\u5979\u6CA1\u6709\u7ACB\u523B\u6536\u56DE\u624B\u3002" }
        ]
      }
    ]
  },
  {
    id: "aff_swordsman_02_rain",
    classId: "swordsman",
    episode: 2,
    title: "\u4E00\u628A\u53EA\u5BB9\u4E24\u4EBA\u7684\u4F1E",
    episodeLabel: "\u7B2C\u4E8C\u5E55 \xB7 \u96E8\u5ECA\u540C\u884C",
    unlockPoints: 80,
    requiredStoryIds: ["aff_swordsman_01_dawn"],
    completionPoints: 45,
    backgroundAsset: "assets/affection/scenes/swordsman-rain-gate.webp",
    openingDialogue: [
      { text: "\u8BAD\u7EC3\u7ED3\u675F\u65F6\u9AA4\u96E8\u843D\u4E0B\uFF0C\u5979\u6491\u7740\u4F1E\u7AD9\u5728\u5ECA\u5916\uFF0C\u534A\u8FB9\u80A9\u8180\u5DF2\u7ECF\u6E7F\u900F\u3002" },
      { speaker: "\u5251\u59EC", mood: "calm", text: "\u4F1E\u660E\u660E\u591F\u5927\uFF0C\u600E\u4E48\u8FD8\u662F\u6DCB\u5230\u4E86\uFF1F" },
      { text: "\u4F1E\u6CBF\u671D\u4F60\u7684\u65B9\u5411\u504F\u5F97\u592A\u660E\u663E\uFF0C\u7B54\u6848\u5176\u5B9E\u5C31\u5728\u773C\u524D\u3002" }
    ],
    choices: [
      {
        id: "ask_closer",
        label: "\u201C\u6211\u53EF\u4EE5\u9760\u8FD1\u4E00\u70B9\u5417\uFF1F\u8FD9\u6837\u4E24\u8FB9\u90FD\u4E0D\u4F1A\u6DCB\u6E7F\u3002\u201D",
        mood: "shy",
        responseDialogue: [
          { text: "\u5979\u8F7B\u8F7B\u70B9\u5934\uFF0C\u628A\u4F1E\u67C4\u63E1\u5F97\u66F4\u7A33\u3002" },
          { speaker: "\u5251\u59EC", mood: "moved", text: "\u300A\u5148\u95EE\u8FC7\u518D\u9760\u8FD1\u300B\u2026\u2026\u5F88\u597D\u3002\u90A3\u5C31\u522B\u79BB\u5F00\u4F1E\u6CBF\u3002" }
        ]
      },
      {
        id: "share_half",
        label: "\u201C\u4F60\u603B\u6321\u5728\u524D\u9762\uFF0C\u8FD9\u6B21\u4F1E\u4E5F\u8BE5\u5206\u4F60\u4E00\u534A\u3002\u201D",
        mood: "moved",
        responseDialogue: [
          { text: "\u4F60\u628A\u4F1E\u63A8\u56DE\u6B63\u4E2D\uFF0C\u5979\u5374\u53C8\u6084\u6084\u5411\u4F60\u8FD9\u8FB9\u503E\u4E86\u4E00\u70B9\u3002" },
          { speaker: "\u5251\u59EC", mood: "moved", text: "\u300A\u4FDD\u62A4\u4E0D\u662F\u5355\u65B9\u9762\u7684\u300B\u2026\u2026\u8FD9\u53E5\u8BDD\uFF0C\u6211\u8BB0\u4F4F\u4E86\u3002" }
        ]
      },
      {
        id: "hold_umbrella",
        label: "\u201C\u628A\u4F1E\u67C4\u4EA4\u7ED9\u6211\uFF0C\u4F60\u53EA\u7BA1\u8D70\u3002\u201D",
        mood: "bright",
        responseDialogue: [
          { text: "\u5979\u677E\u624B\u524D\u770B\u4E86\u4F60\u4E00\u4F1A\u513F\u3002" },
          { speaker: "\u5251\u59EC", mood: "shy", text: "\u53EA\u51C6\u9001\u5230\u5ECA\u4E0B\u3002\u300A\u522B\u64C5\u81EA\u628A\u8FD9\u6BB5\u8DEF\u53D8\u957F\u300B\u3002" },
          { text: "\u53EF\u5979\u7684\u811A\u6B65\uFF0C\u660E\u663E\u6BD4\u5E73\u65F6\u6162\u3002" }
        ]
      }
    ]
  },
  {
    id: "aff_swordsman_03_victory",
    classId: "swordsman",
    episode: 3,
    title: "\u80DC\u5229\u4E4B\u540E\uFF0C\u522B\u53EA\u770B\u5251",
    episodeLabel: "\u7B2C\u4E09\u5E55 \xB7 \u80DC\u5229\u7EF6\u5E26",
    unlockPoints: 240,
    requiredStoryIds: ["aff_swordsman_02_rain"],
    completionPoints: 60,
    backgroundAsset: "assets/affection/scenes/swordsman-victory-night.webp",
    cgAsset: "assets/affection/cg/swordsman-ribbon-promise.webp",
    memoryCallbacks: [
      {
        fromStoryId: "aff_swordsman_02_rain",
        choiceId: "ask_closer",
        dialogue: [{ speaker: "\u5251\u59EC", text: "\u4E0A\u6B21\u4F60\u5148\u95EE\u6211\u80FD\u4E0D\u80FD\u9760\u8FD1\u2026\u2026\u4ECA\u5929\u4E5F\u53EF\u4EE5\u3002" }]
      },
      {
        fromStoryId: "aff_swordsman_02_rain",
        choiceId: "share_half",
        dialogue: [{ speaker: "\u5251\u59EC", text: "\u4F60\u8BF4\u4FDD\u62A4\u4E0D\u662F\u5355\u65B9\u9762\u7684\uFF0C\u6240\u4EE5\u8FD9\u6B21\u4E5F\u8BA9\u6211\u7B49\u4F60\u3002" }]
      },
      {
        fromStoryId: "aff_swordsman_02_rain",
        choiceId: "hold_umbrella",
        dialogue: [{ speaker: "\u5251\u59EC", text: "\u90A3\u6BB5\u96E8\u8DEF\u88AB\u4F60\u64C5\u81EA\u8D70\u957F\u4E86\u2026\u2026\u6211\u5176\u5B9E\u6CA1\u6709\u751F\u6C14\u3002" }]
      }
    ],
    openingDialogue: [
      { text: "\u591C\u95F4\u5E86\u5178\u91CC\uFF0C\u6240\u6709\u4EBA\u90FD\u56F4\u7740\u5979\u7684\u65B0\u5251\u8D5E\u53F9\u3002" },
      { speaker: "\u5251\u59EC", mood: "shy", text: "\u5927\u5BB6\u90FD\u5728\u770B\u5251\u2026\u2026\u53EF\u6211\u60F3\u77E5\u9053\uFF0C\u300A\u4F60\u521A\u624D\u5728\u770B\u4EC0\u4E48\u300B\u3002" }
    ],
    choices: [
      {
        id: "her_smile",
        label: "\u201C\u770B\u4F60\u677E\u5F00\u5251\u65F6\uFF0C\u7EC8\u4E8E\u80AF\u7B11\u7684\u6837\u5B50\u3002\u201D",
        mood: "shy",
        responseDialogue: [
          { speaker: "\u5251\u59EC", mood: "shy", text: "\u90A3\u4E2A\u7B11\u5BB9\u672C\u6765\u53EA\u51FA\u73B0\u4E86\u4E00\u77AC\u3002" },
          { text: "\u5979\u907F\u5F00\u76EE\u5149\uFF0C\u628A\u80DC\u5229\u7EF6\u5E26\u7684\u4E00\u7AEF\u7CFB\u5230\u4F60\u8155\u4E0A\u3002" },
          { speaker: "\u5251\u59EC", mood: "moved", text: "\u770B\u6765\u5B83\u65E9\u5C31\u843D\u5230\u4F60\u8FD9\u91CC\u4E86\u3002" }
        ]
      },
      {
        id: "looking_for_me",
        label: "\u201C\u770B\u4F60\u6BCF\u6B21\u6536\u5251\uFF0C\u90FD\u4F1A\u5148\u786E\u8BA4\u6211\u5728\u4E0D\u5728\u3002\u201D",
        mood: "moved",
        responseDialogue: [
          { speaker: "\u5251\u59EC", mood: "moved", text: "\u56E0\u4E3A\u300A\u770B\u89C1\u4F60\u300B\uFF0C\u6211\u624D\u77E5\u9053\u8FD9\u4E00\u6218\u771F\u7684\u7ED3\u675F\u4E86\u3002" },
          { text: "\u53E6\u4E00\u7AEF\u7EF6\u5E26\u4ECD\u7CFB\u5728\u5979\u7684\u5251\u7A57\uFF0C\u4E24\u7AEF\u5728\u591C\u98CE\u91CC\u8F7B\u8F7B\u9760\u8FD1\u3002" }
        ]
      },
      {
        id: "remember_her",
        label: "\u201C\u5251\u5F88\u6F02\u4EAE\uFF0C\u4F46\u63E1\u5251\u7684\u4EBA\u66F4\u503C\u5F97\u6211\u8BB0\u4F4F\u3002\u201D",
        mood: "shy",
        responseDialogue: [
          { text: "\u5979\u8033\u5C16\u5FAE\u7EA2\uFF0C\u7B2C\u4E00\u6B21\u6CA1\u80FD\u7ACB\u523B\u56DE\u8BDD\u3002" },
          { speaker: "\u5251\u59EC", mood: "shy", text: "\u8FD9\u6837\u7684\u5938\u5956\u2026\u2026\u6BD4\u6B63\u9762\u63A5\u4E00\u5251\u66F4\u8BA9\u4EBA\u6CA1\u9632\u5907\u3002" }
        ]
      }
    ]
  },
  {
    id: "aff_swordsman_04_backguard",
    classId: "swordsman",
    episode: 4,
    title: "\u628A\u80CC\u540E\u4EA4\u7ED9\u4F60",
    episodeLabel: "\u7B2C\u56DB\u5E55 \xB7 \u5E76\u80A9\u6218\u672F",
    unlockPoints: 520,
    requiredStoryIds: ["aff_swordsman_03_victory"],
    completionPoints: 60,
    backgroundAsset: "assets/affection/scenes/swordsman-paired-trial-sunset.webp",
    memoryCallbacks: [
      ...rememberedChoices("aff_swordsman_01_dawn", "\u5251\u59EC", [
        ["watch_breath", "\u4F60\u6700\u5148\u770B\u89C1\u7684\u603B\u662F\u6211\u6709\u6CA1\u6709\u52C9\u5F3A\u81EA\u5DF1\u3002\u4ECA\u665A\u4E5F\u8BF7\u4F60\u770B\u7740\u6211\u3002"],
        ["wooden_sword", "\u6668\u7EC3\u65F6\u4F60\u9009\u62E9\u5E76\u80A9\u800C\u7ACB\uFF0C\u8FD9\u6B21\u4E5F\u8BF7\u4E0E\u6211\u4E00\u8D77\u6838\u5BF9\u6BCF\u4E2A\u4FE1\u53F7\u3002"],
        ["ask_guard", "\u90A3\u6B21\u4F60\u5148\u95EE\u8FC7\u624D\u66FF\u6211\u7CFB\u62A4\u8155\uFF0C\u6240\u4EE5\u6211\u613F\u610F\u628A\u80CC\u540E\u4EA4\u7ED9\u4F60\u3002"]
      ]),
      ...rememberedChoices("aff_swordsman_03_victory", "\u5251\u59EC", [
        ["her_smile", "\u4F60\u770B\u89C1\u8FC7\u6211\u5378\u4E0B\u9632\u5907\u7684\u6837\u5B50\uFF0C\u6240\u4EE5\u8FD9\u4EFD\u624B\u672D\u4E5F\u4E0D\u5FC5\u5BF9\u4F60\u85CF\u7740\u3002"],
        ["looking_for_me", "\u6211\u6BCF\u6B21\u6536\u5251\u90FD\u4F1A\u786E\u8BA4\u4F60\u7684\u4F4D\u7F6E\uFF0C\u6B63\u597D\u53EF\u4EE5\u628A\u5B83\u5B9A\u6210\u5B89\u5168\u4FE1\u53F7\u3002"],
        ["remember_her", "\u4F60\u8BB0\u4F4F\u7684\u662F\u63E1\u5251\u7684\u4EBA\uFF0C\u800C\u8FD9\u672C\u624B\u672D\u8981\u8BB0\u4F4F\u6211\u4EEC\u4E24\u4E2A\u4EBA\u7684\u5224\u65AD\u3002"]
      ])
    ],
    openingDialogue: [
      { text: "\u8BAD\u7EC3\u540E\u7684\u6A31\u6728\u4F5C\u6218\u5BA4\u91CC\uFF0C\u644A\u5F00\u7684\u6218\u672F\u624B\u672D\u6709\u51E0\u9875\u88AB\u5251\u98CE\u5212\u7834\u3002" },
      { speaker: "\u5251\u59EC", mood: "calm", text: "\u65E7\u624B\u672D\u53EA\u5199\u4E86\u6211\u5982\u4F55\u6321\u5728\u524D\u9762\u3002\u73B0\u5728\u770B\u6765\uFF0C\u90A3\u4E0D\u662F\u5B8C\u6574\u7684\u5E76\u80A9\u3002" },
      { text: "\u5979\u9012\u6765\u4FEE\u8865\u7EB8\u4E0E\u7F0E\u5E26\uFF0C\u7A7A\u767D\u9875\u4E0A\u7559\u7740\u4FE1\u53F7\u3001\u80CC\u540E\u4E0E\u5171\u540C\u64A4\u9000\u4E09\u4E2A\u4F4D\u7F6E\u3002" }
    ],
    choices: [
      {
        id: "agree_safety_signal",
        label: "\u201C\u5148\u7EA6\u5B9A\u4E00\u4E2A\u53EA\u6709\u6211\u4EEC\u61C2\u7684\u5B89\u5168\u4FE1\u53F7\u3002\u201D",
        mood: "moved",
        responseDialogue: [
          { speaker: "\u5251\u59EC", mood: "bright", text: "\u6536\u5230\u4FE1\u53F7\u5C31\u4E92\u76F8\u786E\u8BA4\uFF0C\u300A\u4E0D\u8BB8\u4EFB\u4F55\u4EBA\u72EC\u81EA\u901E\u5F3A\u300B\u3002" },
          { text: "\u5979\u5728\u4FEE\u597D\u7684\u9875\u89D2\u753B\u4E0B\u4E24\u9053\u5E76\u884C\u5251\u7EB9\uFF0C\u4E0E\u4F60\u4E00\u8D77\u8BD5\u8FC7\u4FE1\u53F7\u3002" }
        ]
      },
      {
        id: "rotate_backguard",
        label: "\u201C\u8F6E\u6D41\u5B88\u4F4F\u80CC\u540E\uFF0C\u8C01\u90FD\u4E0D\u6C38\u8FDC\u7AD9\u5728\u6700\u524D\u9762\u3002\u201D",
        mood: "bright",
        responseDialogue: [
          { speaker: "\u5251\u59EC", mood: "moved", text: "\u300A\u628A\u80CC\u540E\u4EA4\u7ED9\u4F60\u300B\uFF0C\u5E76\u4E0D\u524A\u5F31\u6211\u7684\u5251\u3002\u5B83\u8BA9\u6211\u4EEC\u7684\u89C6\u91CE\u5B8C\u6574\u3002" },
          { text: "\u5979\u628A\u80CC\u9760\u80CC\u9635\u5F62\u753B\u8FDB\u624B\u672D\uFF0C\u4E5F\u5C06\u4F60\u7684\u540D\u5B57\u5199\u5728\u4E0E\u81EA\u5DF1\u5E73\u9F50\u7684\u4F4D\u7F6E\u3002" }
        ]
      },
      {
        id: "retreat_together",
        label: "\u201C\u518D\u5199\u4E00\u6761\uFF1A\u5F62\u52BF\u4E0D\u5BF9\u65F6\u5FC5\u987B\u5171\u540C\u64A4\u9000\u3002\u201D",
        mood: "shy",
        responseDialogue: [
          { text: "\u5979\u505C\u7B14\u7247\u523B\uFF0C\u8BA4\u771F\u628A\u201C\u5171\u540C\u201D\u4E8C\u5B57\u63CF\u5F97\u66F4\u6DF1\u3002" },
          { speaker: "\u5251\u59EC", mood: "moved", text: "\u4E0D\u662F\u8C01\u62D6\u7D2F\u8C01\uFF0C\u662F\u4E3A\u4E86\u4E0B\u4E00\u6B21\u4ECD\u80FD\u5E76\u80A9\u51FA\u53D1\u3002\u300A\u7EA6\u5B9A\u300B\u3002" }
        ]
      }
    ]
  },
  {
    id: "aff_swordsman_05_dayoff",
    classId: "swordsman",
    episode: 5,
    title: "\u4ECA\u591C\u4E0D\u5FC5\u5B88\u5728\u6700\u524D\u9762",
    episodeLabel: "\u7B2C\u4E94\u5E55 \xB7 \u706F\u4E0B\u4F11\u606F\u65E5",
    unlockPoints: 900,
    requiredStoryIds: ["aff_swordsman_04_backguard"],
    completionPoints: 60,
    backgroundAsset: "assets/affection/scenes/swordsman-lantern-dayoff.webp",
    memoryCallbacks: [
      ...rememberedChoices("aff_swordsman_02_rain", "\u5251\u59EC", [
        ["ask_closer", "\u96E8\u4F1E\u4E0B\u4F60\u5148\u95EE\u80FD\u5426\u9760\u8FD1\uFF1B\u4ECA\u665A\u6211\u4E5F\u60F3\u5148\u95EE\u4F60\u613F\u4E0D\u613F\u610F\u4E00\u8D77\u5750\u4E0B\u3002"],
        ["share_half", "\u4F60\u6559\u4F1A\u6211\u4FDD\u62A4\u53EF\u4EE5\u5E73\u5206\uFF0C\u6240\u4EE5\u62C5\u5FE7\u4E5F\u4E0D\u8BE5\u7531\u4E00\u4E2A\u4EBA\u85CF\u7740\u3002"],
        ["hold_umbrella", "\u4F60\u66FF\u6211\u63E1\u8FC7\u4F1E\u67C4\uFF0C\u4ECA\u665A\u80FD\u5426\u4E5F\u66FF\u6211\u628A\u8336\u76CF\u653E\u7A33\uFF1F"]
      ]),
      ...rememberedChoices("aff_swordsman_04_backguard", "\u5251\u59EC", [
        ["agree_safety_signal", "\u6211\u4EEC\u7684\u5B89\u5168\u4FE1\u53F7\u4ECA\u665A\u4E0D\u7528\u4E8E\u51FA\u6218\uFF0C\u53EA\u7528\u6765\u63D0\u9192\u5F7C\u6B64\u597D\u597D\u4F11\u606F\u3002"],
        ["rotate_backguard", "\u4F60\u8BF4\u8F6E\u6D41\u5B88\u4F4F\u80CC\u540E\uFF0C\u6240\u4EE5\u8FD9\u6B21\u8BF7\u8BA9\u6211\u653E\u5FC3\u5750\u5728\u4F60\u8EAB\u8FB9\u3002"],
        ["retreat_together", "\u5171\u540C\u64A4\u9000\u4E5F\u5305\u62EC\u4ECE\u5FD9\u788C\u91CC\u64A4\u9000\u3002\u624B\u672D\u4E0A\u5199\u5F97\u5F88\u6E05\u695A\u3002"]
      ])
    ],
    openingDialogue: [
      { text: "\u706F\u7B3C\u6696\u5149\u94FA\u6EE1\u5ECA\u4E0B\uFF0C\u5979\u6CA1\u6709\u4F69\u5251\uFF0C\u53EA\u5728\u4E24\u5F20\u76F8\u90BB\u5750\u57AB\u65C1\u653E\u4E86\u8336\u4E0E\u70B9\u5FC3\u3002" },
      { speaker: "\u5251\u59EC", mood: "calm", text: "\u4ECA\u665A\u6CA1\u6709\u5DE1\u903B\u8868\u3002\u6211\u5374\u4E60\u60EF\u7AD9\u5728\u6700\u5916\u4FA7\uFF0C\u4E00\u65F6\u4E0D\u77E5\u9053\u600E\u6837\u4F11\u606F\u3002" },
      { speaker: "\u5251\u59EC", mood: "shy", text: "\u4F60\u613F\u610F\u966A\u6211\u7EC3\u4E60\u4E00\u6B21\u300A\u4EC0\u4E48\u90FD\u4E0D\u5B88\u62A4\u7684\u591C\u665A\u300B\u5417\uFF1F" }
    ],
    choices: [
      {
        id: "share_quiet_tea",
        label: "\u201C\u5148\u5750\u4E0B\u559D\u8336\uFF0C\u6C89\u9ED8\u4E5F\u7B97\u4ECA\u665A\u7684\u5B89\u6392\u3002\u201D",
        mood: "moved",
        responseDialogue: [
          { text: "\u5979\u7EC8\u4E8E\u4ECE\u5ECA\u67F1\u65C1\u5750\u4E0B\uFF0C\u628A\u4F69\u5251\u4E60\u60EF\u653E\u7F6E\u7684\u4F4D\u7F6E\u7559\u7A7A\u3002" },
          { speaker: "\u5251\u59EC", mood: "moved", text: "\u539F\u6765\u4E0D\u8BF4\u8BDD\u4E5F\u4E0D\u4F1A\u9519\u8FC7\u4EC0\u4E48\u3002\u300A\u4F60\u5728\u8FD9\u91CC\u300B\uFF0C\u591C\u8272\u5C31\u5F88\u5B8C\u6574\u3002" }
        ]
      },
      {
        id: "choose_snack",
        label: "\u201C\u9009\u4E00\u79CD\u70B9\u5FC3\u5427\uFF0C\u4ECA\u665A\u53EA\u8BA8\u8BBA\u559C\u6B22\u4EC0\u4E48\u3002\u201D",
        mood: "shy",
        responseDialogue: [
          { speaker: "\u5251\u59EC", mood: "playful", text: "\u8FD9\u4E48\u7B80\u5355\u7684\u95EE\u9898\uFF0C\u7ADF\u6BD4\u6218\u672F\u9009\u62E9\u66F4\u96BE\u3002" },
          { text: "\u5979\u628A\u9009\u4E2D\u7684\u70B9\u5FC3\u5206\u6210\u4E24\u534A\uFF0C\u7B11\u610F\u5728\u706F\u5F71\u91CC\u6162\u6162\u677E\u5F00\u3002" }
        ]
      },
      {
        id: "one_safety_check",
        label: "\u201C\u82E5\u8FD8\u662F\u60F3\u786E\u8BA4\u5B89\u5168\uFF0C\u6211\u4EEC\u5C31\u8F6E\u6D41\u770B\u4E00\u773C\uFF0C\u7136\u540E\u7EE7\u7EED\u4F11\u606F\u3002\u201D",
        mood: "calm",
        responseDialogue: [
          { speaker: "\u5251\u59EC", mood: "calm", text: "\u4E0D\u662F\u7981\u6B62\u8B66\u89C9\uFF0C\u800C\u662F\u4E0D\u8BA9\u5B83\u628A\u6574\u665A\u90FD\u5360\u6EE1\u3002\u8FD9\u4E2A\u529E\u6CD5\u5F88\u597D\u3002" },
          { text: "\u5979\u53EA\u786E\u8BA4\u4E00\u6B21\u5EAD\u9662\uFF0C\u56DE\u6765\u540E\u4FBF\u628A\u5EA7\u4F4D\u5411\u4F60\u8FD9\u8FB9\u632A\u8FD1\u3002" }
        ]
      }
    ]
  },
  {
    id: "aff_swordsman_06_homecoming",
    classId: "swordsman",
    episode: 6,
    title: "\u5F52\u6765\u65F6\uFF0C\u5EA7\u4F4D\u4ECD\u5728\u8FD9\u91CC",
    episodeLabel: "\u7B2C\u516D\u5E55 \xB7 \u6668\u5149\u5F52\u5E2D",
    unlockPoints: 1400,
    requiredStoryIds: ["aff_swordsman_05_dayoff"],
    completionPoints: 60,
    backgroundAsset: "assets/affection/scenes/swordsman-homecoming-sunrise.webp",
    cgAsset: "assets/affection/cg/swordsman-homecoming-knot.webp",
    memoryCallbacks: [
      ...rememberedChoices("aff_swordsman_03_victory", "\u5251\u59EC", [
        ["her_smile", "\u4F60\u8BB0\u5F97\u6211\u5378\u4E0B\u9632\u5907\u540E\u7684\u7B11\uFF0C\u6240\u4EE5\u4ECA\u5929\u6211\u60F3\u5766\u7136\u5730\u7B11\u7ED9\u4F60\u770B\u3002"],
        ["looking_for_me", "\u6211\u6536\u5251\u540E\u5BFB\u627E\u7684\u4EBA\uFF0C\u6B64\u523B\u5C31\u5728\u6668\u5149\u91CC\u7B49\u6211\u3002"],
        ["remember_her", "\u4F60\u8BB0\u4F4F\u63E1\u5251\u7684\u4EBA\uFF0C\u6211\u4E5F\u65E9\u5DF2\u8BB0\u4F4F\u63A5\u4F4F\u6211\u771F\u5FC3\u7684\u4EBA\u3002"]
      ]),
      ...rememberedChoices("aff_swordsman_04_backguard", "\u5251\u59EC", [
        ["agree_safety_signal", "\u6211\u4EEC\u7EA6\u597D\u7684\u5B89\u5168\u4FE1\u53F7\u4ECD\u5728\uFF0C\u5F80\u540E\u7684\u8DEF\u66F4\u4E0D\u5FC5\u8C01\u72EC\u81EA\u5224\u65AD\u3002"],
        ["rotate_backguard", "\u80CC\u540E\u53EF\u4EE5\u8F6E\u6D41\u4EA4\u7ED9\u5F7C\u6B64\uFF0C\u5F52\u6765\u7684\u65B9\u5411\u4E5F\u53EF\u4EE5\u5171\u540C\u786E\u8BA4\u3002"],
        ["retreat_together", "\u624B\u672D\u5199\u7740\u5171\u540C\u64A4\u9000\uFF0C\u6240\u4EE5\u6BCF\u4E00\u6B21\u8FDC\u5F81\u90FD\u8981\u4E00\u8D77\u56DE\u6765\u3002"]
      ]),
      ...rememberedChoices("aff_swordsman_05_dayoff", "\u5251\u59EC", [
        ["share_quiet_tea", "\u706F\u4E0B\u90A3\u6BB5\u5B89\u9759\u8BA9\u6211\u77E5\u9053\uFF0C\u5F52\u6765\u540E\u6709\u4EBA\u540C\u5750\u5C31\u5DF2\u7ECF\u8DB3\u591F\u3002"],
        ["choose_snack", "\u6211\u4EEC\u5206\u4EAB\u8FC7\u4E0D\u8C08\u6218\u672F\u7684\u591C\u665A\uFF0C\u6240\u4EE5\u4ECA\u5929\u4E5F\u4E0D\u5FC5\u6025\u7740\u6C47\u62A5\u6218\u679C\u3002"],
        ["one_safety_check", "\u4F60\u5141\u8BB8\u6211\u53EA\u786E\u8BA4\u4E00\u6B21\u5B89\u5168\uFF1B\u73B0\u5728\u6211\u80FD\u5B89\u5FC3\u8D70\u5411\u4E3A\u6211\u7559\u7740\u7684\u5EA7\u4F4D\u3002"]
      ])
    ],
    openingDialogue: [
      { text: "\u8FDC\u5F81\u540E\u7684\u6668\u5149\u7A7F\u8FC7\u6A31\u6728\u7A97\u683C\uFF0C\u4F5C\u6218\u5BA4\u91CC\u90A3\u5F20\u76F8\u90BB\u5EA7\u4F4D\u4ECD\u4FDD\u6301\u7740\u79BB\u5F00\u524D\u7684\u6837\u5B50\u3002" },
      { speaker: "\u5251\u59EC", mood: "calm", text: "\u6211\u4E00\u8DEF\u90FD\u8BB0\u5F97\uFF1A\u5F52\u6765\u65F6\uFF0C\u4E0D\u5FC5\u5148\u8BC1\u660E\u81EA\u5DF1\u8D62\u5F97\u591A\u6F02\u4EAE\u3002" },
      { speaker: "\u5251\u59EC", mood: "moved", text: "\u53EA\u8981\u8FD8\u80FD\u300A\u56DE\u5230\u8FD9\u91CC\u300B\uFF0C\u4E0E\u4F60\u4E00\u8D77\u89E3\u5F00\u8FD9\u679A\u5F52\u6765\u7ED3\u3002" }
    ],
    choices: [
      {
        id: "choose_each_day",
        label: "\u201C\u6B22\u8FCE\u56DE\u6765\u3002\u5148\u5750\u4E0B\uFF0C\u6218\u62A5\u53EF\u4EE5\u4EE5\u540E\u518D\u8BF4\u3002\u201D",
        mood: "moved",
        responseDialogue: [
          { speaker: "\u5251\u59EC", mood: "moved", text: "\u539F\u6765\u8FD9\u56DB\u4E2A\u5B57\uFF0C\u6BD4\u4EFB\u4F55\u51EF\u65CB\u793C\u90FD\u66F4\u8BA9\u6211\u5B89\u5FC3\u3002" },
          { text: "\u5979\u5750\u5230\u4E00\u76F4\u4E3A\u5979\u4FDD\u7559\u7684\u4F4D\u7F6E\uFF0C\u5C06\u5F52\u6765\u7ED3\u7684\u4E00\u7AEF\u4EA4\u7ED9\u4F60\u3002" }
        ]
      },
      {
        id: "share_future_map",
        label: "\u201C\u4E00\u8D77\u628A\u5F52\u6765\u7ED3\u7CFB\u597D\uFF0C\u518D\u7EA6\u5B9A\u4E0B\u4E00\u6B21\u5171\u540C\u64A4\u9000\u3002\u201D",
        mood: "bright",
        responseDialogue: [
          { speaker: "\u5251\u59EC", mood: "bright", text: "\u65E0\u8BBA\u51FA\u53D1\u51E0\u6B21\uFF0C\u90FD\u8981\u628A\u300A\u5F7C\u6B64\u300B\u5E26\u56DE\u8FD9\u5F20\u5EA7\u4F4D\u65C1\u3002" },
          { text: "\u4E24\u6BB5\u7F0E\u5E26\u5728\u4F60\u4EEC\u624B\u4E2D\u5408\u6210\u4E00\u679A\u4E0D\u675F\u7F1A\u4EFB\u4F55\u4EBA\u7684\u5E76\u80A9\u7ED3\u3002" }
        ]
      },
      {
        id: "stand_as_equals",
        label: "\u201C\u5EA7\u4F4D\u4F1A\u7559\u7740\uFF0C\u4F46\u6211\u4EEC\u4E5F\u53EF\u4EE5\u4E00\u8D77\u53BB\u521B\u9020\u65B0\u7684\u5F52\u5904\u3002\u201D",
        mood: "shy",
        responseDialogue: [
          { speaker: "\u5251\u59EC", mood: "moved", text: "\u5F52\u5904\u4E0D\u662F\u8BA9\u4EBA\u505C\u4E0B\u7684\u9501\uFF0C\u800C\u662F\u8BA9\u4EBA\u300A\u6562\u7EE7\u7EED\u5411\u524D\u300B\u7684\u7406\u7531\u3002" },
          { text: "\u5979\u4E0E\u4F60\u5E76\u80A9\u63A8\u5F00\u4F5C\u6218\u5BA4\u7684\u95E8\uFF0C\u6668\u6A31\u6B63\u843D\u5728\u4E0B\u4E00\u6BB5\u8DEF\u4E0A\u3002" }
        ]
      }
    ]
  },
  {
    id: "aff_swordsman_07_gift",
    classId: "swordsman",
    episode: 7,
    title: "\u793C\u7269\u4E0D\u5199\u8FDB\u519B\u9700\u5355",
    episodeLabel: "\u7B2C\u4E03\u5E55 \xB7 \u6A31\u53F6\u8336\u793C",
    unlockPoints: 1700,
    requiredStoryIds: ["aff_swordsman_06_homecoming"],
    completionPoints: 60,
    backgroundAsset: "assets/affection/scenes/swordsman-gift-tea-dawn.webp",
    memoryCallbacks: [
      ...rememberedChoices("aff_swordsman_05_dayoff", "\u5251\u59EC", [
        ["share_quiet_tea", "\u4F60\u66FE\u966A\u6211\u5B89\u9759\u559D\u8336\uFF0C\u6240\u4EE5\u8FD9\u4EFD\u8336\u793C\u4E0D\u9700\u8981\u70ED\u95F9\u7684\u7B54\u8C22\u3002"],
        ["choose_snack", "\u4F60\u8BB0\u5F97\u6211\u4E0D\u559C\u6B22\u592A\u751C\uFF1B\u66F4\u91CD\u8981\u7684\u662F\uFF0C\u4F60\u4ECD\u613F\u610F\u95EE\u6211\u4ECA\u5929\u60F3\u9009\u4EC0\u4E48\u3002"],
        ["one_safety_check", "\u4F60\u5141\u8BB8\u6211\u53EA\u786E\u8BA4\u4E00\u6B21\u5B89\u5168\uFF1B\u8FD9\u6B21\u6211\u4E5F\u53EA\u786E\u8BA4\u4E00\u6B21\u793C\u7269\u662F\u5426\u5B89\u5168\uFF0C\u7136\u540E\u5B89\u5FC3\u6536\u4E0B\u3002"]
      ])
    ],
    openingDialogue: [
      { text: "\u6668\u5149\u843D\u8FDB\u5C0F\u8336\u5BA4\uFF0C\u4E00\u53EA\u672A\u62C6\u7684\u6A31\u53F6\u8336\u7F50\u653E\u5728\u4E24\u53EA\u7A7A\u676F\u4E4B\u95F4\uFF0C\u519B\u9700\u7C3F\u5374\u88AB\u5408\u5728\u4E00\u65C1\u3002" },
      { speaker: "\u5251\u59EC", mood: "calm", text: "\u6211\u7B2C\u4E00\u53CD\u5E94\u662F\u628A\u5B83\u767B\u8BB0\uFF0C\u518D\u60F3\u529E\u6CD5\u56DE\u8D60\u540C\u7B49\u4EF7\u503C\u7684\u7269\u8D44\u3002" },
      { speaker: "\u5251\u59EC", mood: "moved", text: "\u53EF\u4F60\u8BF4\u8FD9\u662F\u793C\u7269\u3002\u90A3\u6211\u60F3\u5148\u5B66\u4F1A\uFF0C\u300A\u4E0D\u628A\u5FC3\u610F\u6362\u7B97\u6210\u6B20\u6B3E\u300B\u3002" }
    ],
    choices: [
      {
        id: "gift_without_debt",
        label: "\u201C\u5B83\u4E0D\u662F\u519B\u9700\uFF0C\u4E5F\u4E0D\u9700\u8981\u7528\u6218\u679C\u507F\u8FD8\u3002\u201D",
        mood: "moved",
        responseDialogue: [
          { speaker: "\u5251\u59EC", mood: "bright", text: "\u90A3\u6211\u53EA\u8BF4\u8C22\u8C22\uFF0C\u4E0D\u5217\u8865\u7ED9\u6E05\u5355\u3002" },
          { text: "\u5979\u628A\u519B\u9700\u7C3F\u63A8\u8FDC\uFF0C\u4EB2\u81EA\u4E3A\u76F8\u90BB\u7684\u4E24\u53EA\u676F\u5B50\u6DFB\u4E0A\u70ED\u8336\u3002" }
        ]
      },
      {
        id: "open_at_own_pace",
        label: "\u201C\u4F60\u53EF\u4EE5\u73B0\u5728\u62C6\uFF0C\u4E5F\u53EF\u4EE5\u7B49\u60F3\u72EC\u5904\u65F6\u518D\u770B\u3002\u201D",
        mood: "calm",
        responseDialogue: [
          { speaker: "\u5251\u59EC", mood: "moved", text: "\u9009\u62E9\u6536\u793C\u7684\u65F6\u673A\uFF0C\u300A\u4E5F\u5C5E\u4E8E\u6536\u5230\u793C\u7269\u7684\u4EBA\u300B\u3002\u8C22\u8C22\u4F60\u7559\u51FA\u8FD9\u4E2A\u4F4D\u7F6E\u3002" },
          { text: "\u5979\u6CA1\u6709\u6025\u7740\u62C6\u5C01\uFF0C\u53EA\u5148\u628A\u5C5E\u4E8E\u4F60\u7684\u676F\u5B50\u653E\u5230\u8EAB\u65C1\u3002" }
        ]
      },
      {
        id: "next_gift_by_request",
        label: "\u201C\u4E0B\u6B21\u60F3\u8981\u4EC0\u4E48\uFF0C\u53EF\u4EE5\u76F4\u63A5\u544A\u8BC9\u6211\uFF1B\u6211\u4E5F\u4F1A\u544A\u8BC9\u4F60\u3002\u201D",
        mood: "shy",
        responseDialogue: [
          { speaker: "\u5251\u59EC", mood: "shy", text: "\u4E0D\u5FC5\u9760\u731C\u6D4B\u8BC1\u660E\u5728\u610F\u2026\u2026\u597D\u3002\u90A3\u4E0B\u4E00\u6B21\uFF0C\u300A\u7531\u6211\u5148\u5F00\u53E3\u300B\u3002" },
          { text: "\u5979\u8BA4\u771F\u8BB0\u4F4F\u7EA6\u5B9A\uFF0C\u5374\u6CA1\u6709\u518D\u628A\u5B83\u5199\u8FDB\u4EFB\u4F55\u503C\u52E4\u8868\u3002" }
        ]
      }
    ]
  },
  {
    id: "aff_swordsman_08_preference",
    classId: "swordsman",
    episode: 8,
    title: "\u559C\u6B22\u53EF\u4EE5\u8BF4\u5F97\u66F4\u5177\u4F53",
    episodeLabel: "\u7B2C\u516B\u5E55 \xB7 \u96E8\u5E02\u8BD5\u5473",
    unlockPoints: 2100,
    requiredStoryIds: ["aff_swordsman_07_gift"],
    completionPoints: 60,
    backgroundAsset: "assets/affection/scenes/swordsman-rain-market-tasting.webp",
    memoryCallbacks: [
      ...rememberedChoices("aff_swordsman_07_gift", "\u5251\u59EC", [
        ["gift_without_debt", "\u4ECA\u5929\u4E0D\u8C08\u4EF7\u683C\u548C\u6218\u679C\uFF0C\u53EA\u8C08\u5404\u81EA\u771F\u6B63\u559C\u6B22\u7684\u5473\u9053\u3002"],
        ["open_at_own_pace", "\u4F60\u628A\u9009\u62E9\u65F6\u673A\u7559\u7ED9\u6211\uFF0C\u6240\u4EE5\u8FD9\u4E00\u6B21\u6211\u60F3\u4E3B\u52A8\u544A\u8BC9\u4F60\u7B54\u6848\u3002"],
        ["next_gift_by_request", "\u6211\u4EEC\u7EA6\u597D\u4E0D\u8BA9\u5BF9\u65B9\u4E00\u76F4\u731C\uFF1B\u4ECA\u5929\u8F6E\u5230\u6211\u5148\u5F00\u53E3\u3002"]
      ])
    ],
    openingDialogue: [
      { text: "\u7EC6\u96E8\u843D\u5728\u6709\u9876\u5C0F\u5E02\u96C6\u5916\uFF0C\u8BD5\u5473\u684C\u4E0A\u6446\u7740\u4E09\u4EFD\u4E0D\u540C\u751C\u5EA6\u7684\u8336\u70B9\u3002" },
      { speaker: "\u5251\u59EC", mood: "calm", text: "\u4EE5\u524D\u6709\u4EBA\u95EE\u6211\u559C\u6B22\u4EC0\u4E48\uFF0C\u6211\u603B\u56DE\u7B54\u201C\u90FD\u53EF\u4EE5\u201D\u3002\u90A3\u5176\u5B9E\u53EA\u662F\u5728\u7701\u7565\u81EA\u5DF1\u3002" },
      { speaker: "\u5251\u59EC", mood: "bright", text: "\u4ECA\u5929\u6211\u60F3\u300A\u8BA4\u771F\u9009\u300B\uFF0C\u4E5F\u60F3\u77E5\u9053\u4F60\u7684\u53E3\u5473\u3002" }
    ],
    choices: [
      {
        id: "ask_today_preference",
        label: "\u201C\u6211\u8BB0\u5F97\u4F60\u504F\u7231\u4F4E\u7CD6\uFF0C\u4F46\u4ECA\u5929\u4ECD\u7531\u4F60\u91CD\u65B0\u9009\u62E9\u3002\u201D",
        mood: "moved",
        responseDialogue: [
          { speaker: "\u5251\u59EC", mood: "moved", text: "\u300A\u88AB\u8BB0\u4F4F\uFF0C\u5374\u4E0D\u88AB\u8FC7\u53BB\u7684\u7B54\u6848\u56F0\u4F4F\u300B\u2026\u2026\u8FD9\u6837\u7684\u4F53\u8D34\u5F88\u6E29\u67D4\u3002" },
          { text: "\u5979\u9009\u4E86\u5E26\u6DE1\u6DE1\u6A31\u53F6\u9999\u7684\u4E00\u4EFD\uFF0C\u4E5F\u628A\u53E6\u4E00\u53EA\u5C0F\u789F\u63A8\u5230\u4F60\u9762\u524D\u3002" }
        ]
      },
      {
        id: "taste_separately",
        label: "\u201C\u6211\u4EEC\u5404\u9009\u4E00\u4EFD\uFF1B\u60F3\u4EA4\u6362\u8BD5\u5473\u65F6\uFF0C\u518D\u5148\u95EE\u5BF9\u65B9\u3002\u201D",
        mood: "bright",
        responseDialogue: [
          { speaker: "\u5251\u59EC", mood: "bright", text: "\u5404\u81EA\u4FDD\u7559\u9009\u62E9\uFF0C\u4E5F\u80FD\u4E3B\u52A8\u5206\u4EAB\u3002\u5F88\u50CF\u6211\u4EEC\u73B0\u5728\u7684\u5E76\u80A9\u3002" },
          { text: "\u5979\u8BA4\u771F\u6BD4\u8F83\u4E09\u4EFD\u8336\u70B9\uFF0C\u6700\u540E\u7B11\u7740\u95EE\u4F60\u613F\u4E0D\u613F\u610F\u4EA4\u6362\u4E00\u5C0F\u5757\u3002" }
        ]
      },
      {
        id: "allow_changed_mind",
        label: "\u201C\u559C\u597D\u4F1A\u53D8\u3002\u6539\u53E3\u4E0D\u7B97\u8F9C\u8D1F\u793C\u7269\uFF0C\u53EA\u662F\u66F4\u8BDA\u5B9E\u5730\u8BA4\u8BC6\u5F7C\u6B64\u3002\u201D",
        mood: "shy",
        responseDialogue: [
          { speaker: "\u5251\u59EC", mood: "moved", text: "\u90A3\u6211\u4EE5\u540E\u4E0D\u518D\u7528\u201C\u90FD\u53EF\u4EE5\u201D\u6321\u4F4F\u4F60\uFF0C\u4E5F\u4E0D\u6321\u4F4F\u81EA\u5DF1\u3002" },
          { text: "\u96E8\u58F0\u8F7B\u843D\uFF0C\u5979\u7B2C\u4E00\u6B21\u81EA\u7136\u5730\u8BF4\u51FA\u81EA\u5DF1\u8FD8\u60F3\u518D\u5C1D\u54EA\u4E00\u79CD\u3002" }
        ]
      }
    ]
  },
  {
    id: "aff_swordsman_09_reciprocal",
    classId: "swordsman",
    episode: 9,
    title: "\u56DE\u793C\u4E0D\u662F\u8FD8\u503A",
    episodeLabel: "\u7B2C\u4E5D\u5E55 \xB7 \u53CC\u5411\u5FC3\u610F",
    unlockPoints: 2600,
    requiredStoryIds: ["aff_swordsman_08_preference"],
    completionPoints: 60,
    backgroundAsset: "assets/affection/scenes/swordsman-reciprocal-gift-sunset.webp",
    cgAsset: "assets/affection/cg/swordsman-two-way-gift-ribbons.webp",
    memoryCallbacks: [
      ...rememberedChoices("aff_swordsman_06_homecoming", "\u5251\u59EC", [
        ["choose_each_day", "\u4F60\u8BF4\u5F52\u6765\u65F6\u4E0D\u5FC5\u5148\u4EA4\u6218\u62A5\uFF0C\u6240\u4EE5\u4ECA\u5929\u4E5F\u4E0D\u5FC5\u5148\u62A5\u544A\u793C\u7269\u4EF7\u503C\u3002"],
        ["share_future_map", "\u5F52\u6765\u7ED3\u7531\u6211\u4EEC\u4E00\u8D77\u7CFB\u597D\uFF0C\u8FD9\u6B21\u56DE\u793C\u4E5F\u8BE5\u7531\u4E24\u4E2A\u4EBA\u4E00\u8D77\u5B9A\u4E49\u3002"],
        ["stand_as_equals", "\u4F60\u8BF4\u5F52\u5904\u53EF\u4EE5\u5171\u540C\u521B\u9020\uFF1B\u8FD9\u4EF6\u56DE\u793C\u6B63\u60F3\u6210\u4E3A\u90A3\u6BB5\u8DEF\u7684\u4E66\u7B7E\u3002"]
      ])
    ],
    openingDialogue: [
      { text: "\u665A\u971E\u843D\u5728\u6728\u684C\u4E0A\uFF0C\u5979\u51C6\u5907\u4E86\u4E00\u679A\u7531\u65E7\u80DC\u5229\u7EF6\u5E26\u7F16\u6210\u7684\u5730\u56FE\u4E66\u7B7E\uFF0C\u65C1\u8FB9\u653E\u7740\u4F60\u9001\u7684\u8336\u7F50\u3002" },
      { speaker: "\u5251\u59EC", mood: "shy", text: "\u8FD9\u4E0D\u662F\u507F\u8FD8\u90A3\u4EFD\u8336\u793C\u3002\u6211\u53EA\u662F\u770B\u89C1\u5B83\u65F6\uFF0C\u300A\u7B2C\u4E00\u65F6\u95F4\u60F3\u628A\u5B83\u9001\u7ED9\u4F60\u300B\u3002" },
      { speaker: "\u5251\u59EC", mood: "moved", text: "\u82E5\u4F60\u613F\u610F\u6536\u4E0B\uFF0C\u4E5F\u8BF7\u5141\u8BB8\u6211\u4E0D\u8BA1\u7B97\u4E24\u4EF6\u793C\u7269\u662F\u5426\u7B49\u4EF7\u3002" }
    ],
    choices: [
      {
        id: "receive_without_balance",
        label: "\u201C\u6211\u613F\u610F\u6536\u4E0B\u3002\u6211\u4EEC\u4E0D\u8BF4\u4E24\u6E05\uFF0C\u53EA\u8BF4\u8C22\u8C22\u3002\u201D",
        mood: "moved",
        responseDialogue: [
          { speaker: "\u5251\u59EC", mood: "moved", text: "\u597D\u3002\u4E0D\u662F\u7ED3\u6E05\uFF0C\u662F\u300A\u5FC3\u610F\u4ECE\u4E00\u4E2A\u4EBA\u8D70\u5411\u53E6\u4E00\u4E2A\u4EBA\u300B\u3002" },
          { text: "\u4E24\u4EFD\u793C\u7269\u5728\u684C\u4E0A\u5E76\u6392\u5C55\u5F00\uFF0C\u7F0E\u5E26\u6CA1\u6709\u7ED1\u4F4F\u4EFB\u4F55\u4E00\u4EF6\u7269\u54C1\u3002" }
        ]
      },
      {
        id: "tell_each_reason",
        label: "\u201C\u4E0D\u6BD4\u8F83\u4EF7\u683C\uFF1B\u6211\u4EEC\u5404\u81EA\u8BF4\u8BF4\u4E3A\u4EC0\u4E48\u60F3\u9001\u5B83\u3002\u201D",
        mood: "bright",
        responseDialogue: [
          { speaker: "\u5251\u59EC", mood: "shy", text: "\u6211\u9009\u5B83\uFF0C\u662F\u56E0\u4E3A\u6BCF\u6B21\u5C55\u5F00\u5730\u56FE\u65F6\uFF0C\u6211\u90FD\u300A\u5E0C\u671B\u4F60\u5728\u4E0B\u4E00\u6761\u8DEF\u4E0A\u300B\u3002" },
          { text: "\u5979\u542C\u5B8C\u4F60\u7684\u7406\u7531\uFF0C\u628A\u4E24\u6BB5\u72EC\u7ACB\u7F0E\u5E26\u8F7B\u8F7B\u6446\u6210\u5E76\u80A9\u65B9\u5411\u3002" }
        ]
      },
      {
        id: "leave_future_ribbon",
        label: "\u201C\u7559\u4E00\u6761\u4E0D\u6253\u7ED3\u7684\u4E1D\u5E26\uFF0C\u7ED9\u4EE5\u540E\u6539\u53D8\u5FC3\u610F\u4E0E\u793C\u7269\u7684\u6211\u4EEC\u3002\u201D",
        mood: "shy",
        responseDialogue: [
          { speaker: "\u5251\u59EC", mood: "calm", text: "\u7A7A\u767D\u4E0D\u662F\u72B9\u8C6B\uFF0C\u662F\u628A\u672A\u6765\u4E5F\u5F53\u4F5C\u5E73\u7B49\u7684\u9009\u62E9\u3002" },
          { text: "\u5979\u5C06\u672A\u6253\u7ED3\u7684\u4E1D\u5E26\u653E\u5728\u4E24\u4EFD\u793C\u7269\u4E4B\u95F4\uFF0C\u665A\u6A31\u843D\u5728\u67D4\u8F6F\u7559\u767D\u4E0A\u3002" }
        ]
      }
    ]
  }
];
var WITCH_STORIES = [
  {
    id: "aff_witch_01_star",
    classId: "witch",
    episode: 1,
    title: "\u4E0D\u542C\u8BDD\u7684\u661F\u661F",
    episodeLabel: "\u7B2C\u4E00\u5E55 \xB7 \u504F\u822A\u661F",
    unlockPoints: 0,
    requiredStoryIds: [],
    completionPoints: 30,
    backgroundAsset: "assets/affection/scenes/witch-atelier-spark.webp",
    openingDialogue: [
      { text: "\u4E00\u9897\u5C0F\u661F\u706B\u7ED5\u7740\u9B54\u6CD5\u684C\u4E71\u98DE\uFF0C\u6700\u540E\u505C\u5728\u4F60\u9762\u524D\u3002" },
      { speaker: "\u9B54\u5973", mood: "playful", text: "\u5B83\u4ECA\u5929\u4E0D\u80AF\u56DE\u74F6\u5B50\u3002\u5947\u602A\uFF0C\u300A\u5B83\u5012\u662F\u5F88\u559C\u6B22\u4F60\u300B\u3002" },
      { text: "\u661F\u706B\u5728\u4F60\u4EEC\u4E4B\u95F4\u6643\u4E86\u6643\uFF0C\u50CF\u662F\u5728\u7B49\u5F85\u5171\u540C\u7684\u51B3\u5B9A\u3002" }
    ],
    choices: [
      {
        id: "ask_both",
        label: "\u201C\u6211\u4F38\u624B\u4EE5\u524D\uFF0C\u5148\u95EE\u95EE\u5B83\u548C\u4F60\u90FD\u540C\u4E0D\u540C\u610F\u3002\u201D",
        mood: "shy",
        responseDialogue: [
          { speaker: "\u9B54\u5973", mood: "bright", text: "\u5B83\u540C\u610F\u4E86\u3002" },
          { text: "\u5979\u6545\u610F\u505C\u987F\uFF0C\u661F\u706B\u4E5F\u8DDF\u7740\u60AC\u5728\u534A\u7A7A\u3002" },
          { speaker: "\u9B54\u5973", mood: "shy", text: "\u6211\u4E5F\u2026\u2026\u300A\u52C9\u5F3A\u540C\u610F\u300B\u3002\u638C\u5FC3\u653E\u5E73\u3002" }
        ]
      },
      {
        id: "hold_notes",
        label: "\u201C\u6211\u66FF\u4F60\u6309\u4F4F\u7B14\u8BB0\uFF0C\u4F60\u4E13\u5FC3\u628A\u5B83\u5F15\u56DE\u6765\u3002\u201D",
        mood: "bright",
        responseDialogue: [
          { speaker: "\u9B54\u5973", mood: "calm", text: "\u5DE6\u8FB9\u7B2C\u4E09\u9875\uFF0C\u522B\u8BA9\u98CE\u7FFB\u8FC7\u53BB\u3002" },
          { text: "\u661F\u706B\u987A\u7740\u5979\u7684\u6307\u5C16\u56DE\u5230\u74F6\u4E2D\uFF0C\u52A8\u4F5C\u4E00\u6C14\u5475\u6210\u3002" },
          { speaker: "\u9B54\u5973", mood: "playful", text: "\u914D\u5408\u5F97\u8FD9\u4E48\u987A\uFF0C\u4F1A\u8BA9\u6211\u8BEF\u4EE5\u4E3A\u6211\u4EEC\u7EC3\u4E60\u8FC7\u5F88\u591A\u6B21\u3002" }
        ]
      },
      {
        id: "name_star",
        label: "\u201C\u7ED9\u5B83\u8D77\u4E2A\u540D\u5B57\u5427\uFF0C\u4E5F\u8BB8\u5B83\u53EA\u662F\u60F3\u88AB\u8BB0\u4F4F\u3002\u201D",
        mood: "playful",
        responseDialogue: [
          { speaker: "\u9B54\u5973", mood: "bright", text: "\u90A3\u5C31\u53EB\u201C\u504F\u822A\u661F\u201D\u3002" },
          { speaker: "\u9B54\u5973", mood: "shy", text: "\u56E0\u4E3A\u5B83\u603B\u4F1A\u504F\u5230\u4F60\u90A3\u91CC\u2026\u2026\u8FD9\u4E2A\u7406\u7531\u4E0D\u8BB8\u7B11\u3002" }
        ]
      }
    ]
  },
  {
    id: "aff_witch_02_observatory",
    classId: "witch",
    episode: 2,
    title: "\u4E24\u4EBA\u4EFD\u7684\u89C2\u6D4B\u8BB0\u5F55",
    episodeLabel: "\u7B2C\u4E8C\u5E55 \xB7 \u4ECA\u591C\u7684\u5EA7\u4F4D",
    unlockPoints: 80,
    requiredStoryIds: ["aff_witch_01_star"],
    completionPoints: 45,
    backgroundAsset: "assets/affection/scenes/witch-observatory-night.webp",
    openingDialogue: [
      { text: "\u89C2\u661F\u53F0\u53EA\u6709\u4E00\u628A\u6905\u5B50\uFF0C\u684C\u4E0A\u5374\u6446\u7740\u4E24\u676F\u70ED\u996E\u3002" },
      { speaker: "\u9B54\u5973", mood: "playful", text: "\u6905\u5B50\u53EA\u6709\u4E00\u5F20\u300A\u662F\u6211\u6545\u610F\u7684\u300B\u3002\u6211\u60F3\u770B\u770B\u4F60\u4F1A\u600E\u4E48\u529E\u3002" }
    ],
    choices: [
      {
        id: "sit_near",
        label: "\u201C\u6211\u53EF\u4EE5\u5750\u8FD1\u4E00\u70B9\u5417\uFF1F\u4F60\u8BF4\u53EF\u4EE5\u6211\u518D\u8FC7\u53BB\u3002\u201D",
        mood: "shy",
        responseDialogue: [
          { speaker: "\u9B54\u5973", mood: "bright", text: "\u5148\u95EE\u8FC7\u624D\u6324\u8FDB\u6765\uFF0C\u5408\u683C\u3002" },
          { text: "\u5979\u628A\u62AB\u80A9\u5F80\u4F60\u8FD9\u8FB9\u5206\u4E86\u4E00\u534A\u3002" }
        ]
      },
      {
        id: "soft_cushion",
        label: "\u201C\u6211\u5750\u8F6F\u57AB\uFF0C\u628A\u6905\u5B50\u7559\u7ED9\u4F60\u3002\u201D",
        mood: "bright",
        responseDialogue: [
          { text: "\u5979\u7528\u6CD5\u6756\u628A\u53E6\u4E00\u53EA\u8F6F\u57AB\u62C9\u5230\u8EAB\u8FB9\u3002" },
          { speaker: "\u9B54\u5973", mood: "playful", text: "\u6545\u4F5C\u4F53\u8D34\u4E5F\u300A\u4E0D\u8BB8\u79BB\u592A\u8FDC\u300B\uFF0C\u8BB0\u5F55\u7EB8\u5728\u8FD9\u91CC\u3002" }
        ]
      },
      {
        id: "came_for_you",
        label: "\u201C\u661F\u661F\u53EF\u4EE5\u6162\u6162\u770B\u3002\u6211\u4ECA\u665A\u4E3B\u8981\u662F\u6765\u89C1\u4F60\u7684\u3002\u201D",
        mood: "shy",
        responseDialogue: [
          { text: "\u9B54\u6CD5\u7B14\u5728\u7EB8\u4E0A\u5212\u51FA\u4E00\u9053\u614C\u4E71\u7684\u5F27\u7EBF\u3002" },
          { speaker: "\u9B54\u5973", mood: "shy", text: "\u5BB3\u6211\u628A\u65E5\u671F\u300A\u5199\u6210\u4F60\u7684\u540D\u5B57\u4E86\u300B\u2026\u2026\u4F60\u8D1F\u8D23\u91CD\u5199\u3002" }
        ]
      }
    ]
  },
  {
    id: "aff_witch_03_recipe",
    classId: "witch",
    episode: 3,
    title: "\u9B54\u5973\u7684\u79D8\u5BC6\u914D\u65B9",
    episodeLabel: "\u7B2C\u4E09\u5E55 \xB7 \u5F52\u822A\u5750\u6807",
    unlockPoints: 240,
    requiredStoryIds: ["aff_witch_02_observatory"],
    completionPoints: 60,
    backgroundAsset: "assets/affection/scenes/witch-secret-festival.webp",
    cgAsset: "assets/affection/cg/witch-coordinate-crystal.webp",
    memoryCallbacks: [
      {
        fromStoryId: "aff_witch_02_observatory",
        choiceId: "sit_near",
        dialogue: [{ speaker: "\u9B54\u5973", text: "\u4ECA\u665A\u4E0D\u7528\u518D\u95EE\u5EA7\u4F4D\u4E86\uFF0C\u6211\u5DF2\u7ECF\u66FF\u4F60\u7559\u597D\u3002" }]
      },
      {
        fromStoryId: "aff_witch_02_observatory",
        choiceId: "soft_cushion",
        dialogue: [{ speaker: "\u9B54\u5973", text: "\u6211\u591A\u51C6\u5907\u4E86\u4E00\u53EA\u8F6F\u57AB\uFF0C\u4E0D\u8FC7\u8FD8\u662F\u653E\u5728\u6211\u65C1\u8FB9\u3002" }]
      },
      {
        fromStoryId: "aff_witch_02_observatory",
        choiceId: "came_for_you",
        dialogue: [{ speaker: "\u9B54\u5973", text: "\u89C2\u6D4B\u8BB0\u5F55\u7684\u65E5\u671F\u91CD\u5199\u4E86\uFF0C\u53EF\u90A3\u884C\u540D\u5B57\u6211\u6CA1\u6709\u64E6\u3002" }]
      }
    ],
    openingDialogue: [
      { text: "\u5979\u5C06\u4E00\u679A\u5C1A\u672A\u523B\u5B57\u7684\u661F\u6676\u63A8\u5230\u4F60\u9762\u524D\u3002" },
      { speaker: "\u9B54\u5973", mood: "calm", text: "\u6700\u540E\u4E00\u9053\u914D\u65B9\u8981\u5199\u4E00\u4E2A\u613F\u671B\u3002\u65E2\u7136\u5B83\u4F1A\u8BA4\u4F60\uFF0C\u4F60\u6765\u51B3\u5B9A\u3002" }
    ],
    choices: [
      {
        id: "wait_home",
        label: "\u201C\u613F\u6BCF\u6B21\u5192\u9669\u90FD\u5E73\u5B89\u56DE\u6765\uFF0C\u6362\u6211\u5728\u95E8\u53E3\u7B49\u4F60\u3002\u201D",
        mood: "moved",
        responseDialogue: [
          { speaker: "\u9B54\u5973", mood: "moved", text: "\u90A3\u6211\u628A\u56DE\u7A0B\u5750\u6807\u300A\u5199\u6210\u4F60\u7AD9\u7740\u7684\u5730\u65B9\u300B\u3002" },
          { text: "\u661F\u6676\u5728\u4E24\u4EBA\u638C\u5FC3\u4E4B\u95F4\u4EAE\u8D77\u67D4\u8F6F\u7684\u5F52\u822A\u5149\u3002" }
        ]
      },
      {
        id: "no_hiding",
        label: "\u201C\u613F\u4F60\u4E0D\u5FC5\u603B\u628A\u5931\u63A7\u85CF\u6210\u73A9\u7B11\u3002\u201D",
        mood: "moved",
        responseDialogue: [
          { text: "\u5979\u5B89\u9759\u4E86\u7247\u523B\uFF0C\u661F\u6676\u7684\u5149\u4E5F\u67D4\u4E0B\u6765\u3002" },
          { speaker: "\u9B54\u5973", mood: "shy", text: "\u89C2\u5BDF\u5F97\u592A\u4ED4\u7EC6\u4E86\u2026\u2026\u4E0D\u8FC7\uFF0C\u300A\u6211\u5E76\u4E0D\u8BA8\u538C\u300B\u3002" }
        ]
      },
      {
        id: "every_secret",
        label: "\u201C\u613F\u4EE5\u540E\u6BCF\u4E00\u4E2A\u79D8\u5BC6\u5B9E\u9A8C\uFF0C\u90FD\u6709\u6211\u7684\u4F4D\u7F6E\u3002\u201D",
        mood: "shy",
        responseDialogue: [
          { speaker: "\u9B54\u5973", mood: "moved", text: "\u4E0D\u662F\u4E0B\u4E00\u4E2A\uFF0C\u662F\u4EE5\u540E\u6BCF\u4E00\u4E2A\u3002" },
          { text: "\u5979\u628A\u661F\u6676\u9012\u5230\u4F60\u638C\u5FC3\u3002" },
          { speaker: "\u9B54\u5973", mood: "shy", text: "\u8FD9\u6837\u5199\u2026\u2026\u4F60\u540C\u610F\u5417\uFF1F" }
        ]
      }
    ]
  },
  {
    id: "aff_witch_04_miscalculation",
    classId: "witch",
    episode: 4,
    title: "\u4E0D\u5B8C\u7F8E\u4E5F\u4F1A\u53D1\u5149",
    episodeLabel: "\u7B2C\u56DB\u5E55 \xB7 \u8BEF\u5DEE\u661F\u5149",
    unlockPoints: 520,
    requiredStoryIds: ["aff_witch_03_recipe"],
    completionPoints: 60,
    backgroundAsset: "assets/affection/scenes/witch-atelier-afterglow.webp",
    memoryCallbacks: [
      ...rememberedChoices("aff_witch_01_star", "\u9B54\u5973", [
        ["ask_both", "\u504F\u822A\u661F\u8FD8\u8BB0\u5F97\u4F60\u4F1A\u5148\u95EE\u8FC7\u6211\u4EEC\u4E24\u4E2A\uFF0C\u6240\u4EE5\u4ECA\u665A\u5B83\u4E3B\u52A8\u98DE\u6765\u9080\u8BF7\u4F60\u3002"],
        ["hold_notes", "\u4F60\u66FF\u6211\u6309\u4F4F\u8FC7\u7B14\u8BB0\uFF0C\u8FD9\u6B21\u4E5F\u6765\u966A\u6211\u628A\u8BEF\u5DEE\u8BB0\u5F55\u5B8C\u6574\u3002"],
        ["name_star", "\u4F60\u8BF4\u661F\u661F\u53EA\u662F\u60F3\u88AB\u8BB0\u4F4F\uFF1B\u6211\u628A\u4ECA\u665A\u7684\u6BCF\u4E00\u9897\u90FD\u8BB0\u5728\u4F60\u7684\u540D\u5B57\u65C1\u8FB9\u3002"]
      ]),
      ...rememberedChoices("aff_witch_03_recipe", "\u9B54\u5973", [
        ["wait_home", "\u4F60\u628A\u56DE\u7A0B\u5750\u6807\u5199\u6210\u7B49\u6211\u7684\u5730\u65B9\uFF0C\u6240\u4EE5\u7B97\u9519\u4E00\u6B65\u4E5F\u4E0D\u4EE3\u8868\u65E0\u6CD5\u56DE\u6765\u3002"],
        ["no_hiding", "\u4F60\u8BF4\u4E0D\u5FC5\u628A\u5931\u63A7\u85CF\u6210\u73A9\u7B11\uFF0C\u90A3\u6211\u5C31\u627F\u8BA4\uFF1A\u8FD9\u6B21\u5B9E\u9A8C\u7B97\u9519\u4E86\u3002"],
        ["every_secret", "\u4F60\u8981\u53C2\u4E0E\u6BCF\u4E2A\u79D8\u5BC6\u5B9E\u9A8C\u3002\u5F88\u597D\uFF0C\u5931\u8D25\u8BB0\u5F55\u4E5F\u7B97\u79D8\u5BC6\u5B9E\u9A8C\u7684\u4E00\u90E8\u5206\u3002"]
      ])
    ],
    openingDialogue: [
      { text: "\u5915\u7167\u843D\u8FDB\u5DE5\u574A\uFF0C\u4E00\u679A\u7B97\u9519\u523B\u5EA6\u7684\u661F\u6676\u6B63\u5FFD\u660E\u5FFD\u6697\uFF0C\u684C\u8FB9\u6563\u7740\u672A\u5B8C\u6210\u7684\u516C\u5F0F\u3002" },
      { speaker: "\u9B54\u5973", mood: "calm", text: "\u5B83\u6CA1\u6709\u6309\u9884\u8BA1\u53D8\u6210\u5B8C\u7F8E\u7403\u4F53\uFF0C\u300A\u5374\u8FD8\u5728\u53D1\u5149\u300B\u3002" },
      { speaker: "\u9B54\u5973", mood: "shy", text: "\u6211\u77E5\u9053\u5931\u8D25\u8BB0\u5F55\u4E5F\u6709\u4EF7\u503C\uFF0C\u53EA\u662F\u4ECA\u5929\u60F3\u542C\u4F60\u966A\u6211\u7ED9\u5B83\u4E00\u4E2A\u65B0\u7ED3\u8BBA\u3002" }
    ],
    choices: [
      {
        id: "keep_unique_shape",
        label: "\u201C\u4FDD\u7559\u5B83\u7684\u5F62\u72B6\u5427\uFF0C\u4E0D\u5B8C\u7F8E\u4E5F\u662F\u8FD9\u6B21\u5B9E\u9A8C\u72EC\u6709\u7684\u7ED3\u679C\u3002\u201D",
        mood: "moved",
        responseDialogue: [
          { speaker: "\u9B54\u5973", mood: "moved", text: "\u300A\u72EC\u6709\uFF0C\u800C\u4E0D\u662F\u6B8B\u6B21\u54C1\u300B\u2026\u2026\u8FD9\u4E2A\u5206\u7C7B\u6BD4\u6211\u7684\u516C\u5F0F\u66F4\u51C6\u786E\u3002" },
          { text: "\u6B6A\u659C\u661F\u6676\u5728\u5979\u638C\u5FC3\u4EAE\u8D77\u67D4\u8F6F\u4F59\u8F89\uFF0C\u50CF\u8BA4\u771F\u63A5\u53D7\u4E86\u81EA\u5DF1\u7684\u6A21\u6837\u3002" }
        ]
      },
      {
        id: "review_without_blame",
        label: "\u201C\u4E00\u8D77\u590D\u76D8\u8BEF\u5DEE\uFF0C\u4F46\u4ECA\u5929\u4E0D\u6025\u7740\u628A\u5B83\u4FEE\u6B63\u3002\u201D",
        mood: "bright",
        responseDialogue: [
          { speaker: "\u9B54\u5973", mood: "bright", text: "\u628A\u6C42\u77E5\u6B32\u7559\u4E0B\uFF0C\u628A\u8D23\u5907\u62FF\u8D70\u3002\u4E0D\u9519\u7684\u590D\u76D8\u539F\u5219\u3002" },
          { text: "\u4F60\u4EEC\u5E76\u6392\u8865\u5B8C\u8BB0\u5F55\uFF0C\u5E76\u5728\u6700\u540E\u4E00\u680F\u5171\u540C\u753B\u4E0B\u4E00\u9897\u4ECD\u5728\u53D1\u5149\u7684\u5C0F\u661F\u3002" }
        ]
      },
      {
        id: "treasure_accident",
        label: "\u201C\u5982\u679C\u4F60\u613F\u610F\uFF0C\u628A\u5B83\u9001\u7ED9\u6211\uFF1B\u6211\u559C\u6B22\u8FD9\u6B21\u610F\u5916\u3002\u201D",
        mood: "shy",
        responseDialogue: [
          { speaker: "\u9B54\u5973", mood: "playful", text: "\u4F60\u8FD9\u6837\u8BF4\uFF0C\u4F1A\u8BA9\u5929\u624D\u9B54\u5973\u5F00\u59CB\u671F\u5F85\u4E0B\u4E00\u6B21\u5C0F\u8BEF\u5DEE\u3002" },
          { text: "\u5979\u4E3A\u661F\u6676\u7CFB\u4E0A\u7EC6\u7EF3\uFF0C\u90D1\u91CD\u653E\u8FDB\u4F60\u4F38\u51FA\u7684\u638C\u5FC3\u3002" }
        ]
      }
    ]
  },
  {
    id: "aff_witch_05_nightflight",
    classId: "witch",
    episode: 5,
    title: "\u628A\u6682\u505C\u5492\u8BED\u4EA4\u7ED9\u4F60",
    episodeLabel: "\u7B2C\u4E94\u5E55 \xB7 \u661F\u821F\u591C\u822A",
    unlockPoints: 900,
    requiredStoryIds: ["aff_witch_04_miscalculation"],
    completionPoints: 60,
    backgroundAsset: "assets/affection/scenes/witch-star-skiff-night.webp",
    memoryCallbacks: [
      ...rememberedChoices("aff_witch_02_observatory", "\u9B54\u5973", [
        ["sit_near", "\u4F60\u603B\u4F1A\u5148\u95EE\u80FD\u5426\u9760\u8FD1\u3002\u4ECA\u665A\u6211\u5148\u56DE\u7B54\uFF1A\u53EF\u4EE5\uFF0C\u5750\u5230\u6211\u8EAB\u8FB9\u3002"],
        ["soft_cushion", "\u89C2\u661F\u53F0\u7684\u8F6F\u57AB\u8FD8\u5728\uFF1B\u661F\u821F\u4E0A\u4E5F\u7ED9\u4F60\u7559\u4E86\u540C\u6837\u7684\u4F4D\u7F6E\u3002"],
        ["came_for_you", "\u90A3\u665A\u4F60\u4E3B\u8981\u662F\u6765\u89C1\u6211\u2026\u2026\u73B0\u5728\u8FD9\u53E5\u8BDD\u6210\u4E86\u5F52\u822A\u5492\u6700\u7A33\u5B9A\u7684\u5750\u6807\u3002"]
      ]),
      ...rememberedChoices("aff_witch_04_miscalculation", "\u9B54\u5973", [
        ["keep_unique_shape", "\u90A3\u679A\u4E0D\u89C4\u5219\u661F\u6676\u8FD8\u5728\u53D1\u5149\uFF0C\u5B83\u63D0\u9192\u6211\u4E0D\u5FC5\u628A\u6BCF\u4E00\u6B65\u90FD\u7B97\u5F97\u5B8C\u7F8E\u3002"],
        ["review_without_blame", "\u4F60\u6559\u6211\u590D\u76D8\u65F6\u62FF\u8D70\u8D23\u5907\uFF0C\u6240\u4EE5\u6682\u505C\u4E5F\u4E0D\u4F1A\u53D8\u6210\u5931\u8D25\u3002"],
        ["treasure_accident", "\u4F60\u559C\u6B22\u90A3\u6B21\u610F\u5916\uFF1B\u8FD9\u6B21\u591C\u822A\u504F\u79BB\u4E00\u70B9\uFF0C\u4E5F\u8BB8\u4F1A\u770B\u89C1\u65B0\u7684\u661F\u6CB3\u3002"]
      ])
    ],
    openingDialogue: [
      { text: "\u661F\u821F\u5212\u8FC7\u591C\u7A7A\uFF0C\u5979\u540C\u65F6\u4FEE\u6B63\u822A\u7EBF\u3001\u8BB0\u5F55\u661F\u8C61\uFF0C\u6307\u5C16\u7684\u9B54\u5149\u8D8A\u6765\u8D8A\u6025\u3002" },
      { speaker: "\u9B54\u5973", mood: "calm", text: "\u6211\u7ED9\u6240\u6709\u6CD5\u672F\u90FD\u5199\u8FC7\u505C\u6B62\u6761\u4EF6\uFF0C\u552F\u72EC\u6CA1\u7ED9\u81EA\u5DF1\u51C6\u5907\u6682\u505C\u5492\u8BED\u3002" },
      { speaker: "\u9B54\u5973", mood: "moved", text: "\u73B0\u5728\u60F3\u628A\u5B83\u300A\u4EA4\u7ED9\u4F60\u300B\uFF0C\u4F46\u4F55\u65F6\u4F7F\u7528\u4ECD\u8981\u7531\u6211\u4EEC\u4E00\u8D77\u5224\u65AD\u3002" }
    ],
    choices: [
      {
        id: "ask_before_pause",
        label: "\u201C\u6211\u4F1A\u5148\u95EE\u4F60\uFF0C\u518D\u5FF5\u6682\u505C\u5492\uFF1B\u51B3\u5B9A\u6743\u4ECD\u5728\u4F60\u3002\u201D",
        mood: "calm",
        responseDialogue: [
          { text: "\u5979\u628A\u5492\u8BED\u5199\u8FDB\u4F60\u7684\u822A\u56FE\uFF0C\u4E5F\u5728\u65C1\u8FB9\u6807\u4E0B\u6CE8\u91CA\uFF1A\u5148\u786E\u8BA4\u3002" },
          { speaker: "\u9B54\u5973", mood: "bright", text: "\u5F88\u597D\u3002\u300A\u5173\u5FC3\u4E0D\u662F\u64C5\u81EA\u593A\u8D70\u63A7\u5236\u6743\u300B\u3002" }
        ]
      },
      {
        id: "shared_pause_signal",
        label: "\u201C\u6211\u4EEC\u8BBE\u4E00\u4E2A\u5171\u540C\u4FE1\u53F7\uFF0C\u8C01\u592A\u7D2F\u90FD\u53EF\u4EE5\u63D0\u51FA\u6682\u505C\u3002\u201D",
        mood: "moved",
        responseDialogue: [
          { speaker: "\u9B54\u5973", mood: "playful", text: "\u53CC\u5411\u751F\u6548\u624D\u516C\u5E73\u3002\u90A3\u6211\u4E5F\u6709\u6743\u63D0\u9192\u4F60\u4F11\u606F\u3002" },
          { text: "\u4E24\u679A\u6682\u505C\u7B26\u53F7\u540C\u65F6\u843D\u5728\u661F\u821F\u8235\u76D8\u4E24\u4FA7\uFF0C\u4EAE\u5EA6\u5B8C\u5168\u76F8\u540C\u3002" }
        ]
      },
      {
        id: "pause_for_stars",
        label: "\u201C\u73B0\u5728\u5C31\u8BD5\u4E00\u6B21\u3002\u505C\u4E0B\u6765\u770B\u770B\u661F\u6CB3\uFF0C\u4E0D\u505A\u4EFB\u4F55\u8BB0\u5F55\u3002\u201D",
        mood: "shy",
        responseDialogue: [
          { speaker: "\u9B54\u5973", mood: "moved", text: "\u547D\u4EE4\u5DF2\u786E\u8BA4\u2014\u2014\u6682\u505C\u3002\u539F\u6765\u661F\u661F\u4E0D\u5199\u8FDB\u62A5\u544A\u4E5F\u4E0D\u4F1A\u6D88\u5931\u3002" },
          { text: "\u661F\u821F\u653E\u6162\u901F\u5EA6\uFF0C\u5979\u4E0E\u4F60\u9760\u5728\u8237\u8FB9\uFF0C\u770B\u65E0\u987B\u8BA1\u7B97\u7684\u5149\u4ECE\u8EAB\u65C1\u6D41\u8FC7\u3002" }
        ]
      }
    ]
  },
  {
    id: "aff_witch_06_constellation",
    classId: "witch",
    episode: 6,
    title: "\u4E0D\u4F1A\u504F\u822A\u7684\u5750\u6807",
    episodeLabel: "\u7B2C\u516D\u5E55 \xB7 \u5171\u4EAB\u661F\u5EA7",
    unlockPoints: 1400,
    requiredStoryIds: ["aff_witch_05_nightflight"],
    completionPoints: 60,
    backgroundAsset: "assets/affection/scenes/witch-observatory-dawn.webp",
    cgAsset: "assets/affection/cg/witch-shared-constellation.webp",
    memoryCallbacks: [
      ...rememberedChoices("aff_witch_03_recipe", "\u9B54\u5973", [
        ["wait_home", "\u5F52\u822A\u5750\u6807\u4ECD\u662F\u4F60\u7B49\u5F85\u7684\u5730\u65B9\uFF0C\u800C\u4ECA\u5929\u6211\u4EEC\u8981\u4E00\u8D77\u5199\u4E0B\u51FA\u53D1\u65B9\u5411\u3002"],
        ["no_hiding", "\u6211\u4E0D\u518D\u628A\u4E0D\u5B89\u85CF\u6210\u73A9\u7B11\uFF0C\u4E5F\u4E0D\u4F1A\u628A\u559C\u6B22\u85CF\u6210\u8C1C\u9898\u3002"],
        ["every_secret", "\u6BCF\u4E2A\u79D8\u5BC6\u5B9E\u9A8C\u90FD\u6709\u4F60\u7684\u4F4D\u7F6E\uFF0C\u8FD9\u5F20\u661F\u56FE\u5F53\u7136\u4E5F\u4E0D\u4F8B\u5916\u3002"]
      ]),
      ...rememberedChoices("aff_witch_04_miscalculation", "\u9B54\u5973", [
        ["keep_unique_shape", "\u90A3\u679A\u4E0D\u5B8C\u7F8E\u661F\u6676\u4ECD\u5728\u53D1\u5149\uFF0C\u6B63\u9002\u5408\u6210\u4E3A\u5171\u4EAB\u661F\u5EA7\u7684\u7B2C\u4E00\u9897\u661F\u3002"],
        ["review_without_blame", "\u6211\u4EEC\u4E00\u8D77\u8BB0\u5F55\u8FC7\u8BEF\u5DEE\uFF0C\u4ECA\u5929\u4E5F\u4E00\u8D77\u5199\u4E0B\u4E0D\u4F1A\u504F\u822A\u7684\u516C\u5F0F\u3002"],
        ["treasure_accident", "\u4F60\u613F\u610F\u73CD\u85CF\u610F\u5916\u7684\u5149\uFF0C\u6240\u4EE5\u8FD9\u5F20\u661F\u56FE\u4E5F\u4E0D\u5FC5\u8FFD\u6C42\u6807\u51C6\u7B54\u6848\u3002"]
      ]),
      ...rememberedChoices("aff_witch_05_nightflight", "\u9B54\u5973", [
        ["ask_before_pause", "\u4F60\u7B54\u5E94\u5148\u786E\u8BA4\u518D\u5FF5\u6682\u505C\u5492\uFF0C\u6240\u4EE5\u8FD9\u4EFD\u5750\u6807\u4E0D\u4F1A\u5265\u593A\u4EFB\u4F55\u4EBA\u7684\u9009\u62E9\u3002"],
        ["shared_pause_signal", "\u6211\u4EEC\u7684\u6682\u505C\u4FE1\u53F7\u53CC\u5411\u751F\u6548\uFF0C\u5171\u4EAB\u5750\u6807\u4E5F\u8BE5\u8BA9\u4E24\u4E2A\u4EBA\u90FD\u80FD\u6539\u5199\u3002"],
        ["pause_for_stars", "\u591C\u822A\u65F6\u6211\u4EEC\u505C\u4E0B\u6765\u53EA\u770B\u661F\u6CB3\uFF0C\u624D\u53D1\u73B0\u6700\u6E05\u695A\u7684\u5750\u6807\u4E00\u76F4\u5728\u8EAB\u8FB9\u3002"]
      ])
    ],
    openingDialogue: [
      { text: "\u6668\u5149\u8FDB\u5165\u89C2\u661F\u53F0\uFF0C\u4E00\u5F20\u7531\u4E24\u6761\u72EC\u7ACB\u661F\u8F68\u7EC4\u6210\u7684\u5171\u4EAB\u661F\u5EA7\u60AC\u5728\u7A79\u9876\u4E0B\u3002" },
      { speaker: "\u9B54\u5973", mood: "calm", text: "\u5B83\u4E0D\u662F\u8BA9\u8C01\u56F4\u7740\u8C01\u8F6C\uFF0C\u800C\u662F\u8BA9\u4E24\u6761\u822A\u7EBF\u90FD\u77E5\u9053\u300A\u600E\u6837\u627E\u5230\u5BF9\u65B9\u300B\u3002" },
      { speaker: "\u9B54\u5973", mood: "moved", text: "\u6700\u540E\u4E00\u4E2A\u5750\u6807\uFF0C\u5E94\u8BE5\u7531\u6211\u4EEC\u5171\u540C\u5199\u4E0B\u3002" }
    ],
    choices: [
      {
        id: "two_home_stars",
        label: "\u201C\u753B\u4E24\u9897\u5404\u81EA\u53D1\u5149\u3001\u5374\u80FD\u5F7C\u6B64\u627E\u5230\u7684\u5F52\u822A\u661F\u3002\u201D",
        mood: "moved",
        responseDialogue: [
          { speaker: "\u9B54\u5973", mood: "bright", text: "\u4E0D\u4F1A\u4E92\u76F8\u541E\u6CA1\uFF0C\u4E5F\u6C38\u8FDC\u77E5\u9053\u5BF9\u65B9\u5728\u54EA\u91CC\u3002\u5B8C\u7F8E\u3002" },
          { text: "\u5171\u4EAB\u661F\u5EA7\u4E2D\u4EAE\u8D77\u4E24\u9897\u5F52\u822A\u661F\uFF0C\u5404\u81EA\u6620\u7740\u53E6\u4E00\u6761\u822A\u7EBF\u7684\u5FAE\u5149\u3002" }
        ]
      },
      {
        id: "open_route",
        label: "\u201C\u5148\u753B\u4E00\u6761\u6CA1\u6709\u7EC8\u70B9\u7684\u8DEF\u7EBF\uFF0C\u4EE5\u540E\u8FB9\u8D70\u8FB9\u8865\u3002\u201D",
        mood: "bright",
        responseDialogue: [
          { speaker: "\u9B54\u5973", mood: "bright", text: "\u90A3\u8FD9\u4F1A\u662F\u5168\u4E16\u754C\u552F\u4E00\u4E00\u5E45\u6301\u7EED\u66F4\u65B0\u7684\u661F\u5EA7\u3002" },
          { text: "\u5979\u4E0E\u4F60\u540C\u65F6\u843D\u7B14\uFF0C\u661F\u8DEF\u671D\u5C1A\u672A\u547D\u540D\u7684\u8FDC\u65B9\u5EF6\u4F38\u3002" }
        ]
      },
      {
        id: "shared_blank",
        label: "\u201C\u7559\u4E00\u5757\u7A7A\u767D\uFF0C\u7ED9\u4EE5\u540E\u6539\u53D8\u4E3B\u610F\u7684\u6211\u4EEC\u3002\u201D",
        mood: "shy",
        responseDialogue: [
          { speaker: "\u9B54\u5973", mood: "playful", text: "\u8A93\u7EA6\u91CC\u4E5F\u5141\u8BB8\u4FEE\u6539\u7B54\u6848\u2026\u2026\u4F60\u679C\u7136\u5F88\u9002\u5408\u548C\u6211\u300A\u7814\u7A76\u4E00\u8F88\u5B50\u300B\u3002" },
          { text: "\u5979\u628A\u7A7A\u767D\u5904\u8BA4\u771F\u5708\u8D77\uFF0C\u4E0E\u4F60\u5404\u7559\u4E0B\u4E00\u9897\u5C1A\u672A\u8FDE\u7EBF\u7684\u661F\u70B9\u3002" }
        ]
      }
    ]
  },
  {
    id: "aff_witch_07_gift",
    classId: "witch",
    episode: 7,
    title: "\u5148\u8BA9\u793C\u7269\u901A\u8FC7\u5B89\u5168\u5492",
    episodeLabel: "\u7B2C\u4E03\u5E55 \xB7 \u504F\u822A\u58A8\u6C34",
    unlockPoints: 1700,
    requiredStoryIds: ["aff_witch_06_constellation"],
    completionPoints: 60,
    backgroundAsset: "assets/affection/scenes/witch-gift-safety-atelier.webp",
    memoryCallbacks: [
      ...rememberedChoices("aff_witch_04_miscalculation", "\u9B54\u5973", [
        ["keep_unique_shape", "\u4F60\u4E0D\u4F1A\u56E0\u4E3A\u5F62\u72B6\u4E0D\u6807\u51C6\u5C31\u5426\u5B9A\u5B83\uFF0C\u6240\u4EE5\u6211\u613F\u610F\u8BA4\u771F\u68C0\u67E5\u8FD9\u74F6\u5947\u602A\u661F\u58A8\u3002"],
        ["review_without_blame", "\u6211\u4EEC\u68C0\u67E5\u7684\u662F\u98CE\u9669\uFF0C\u4E0D\u662F\u5728\u5BA1\u95EE\u9001\u793C\u7684\u4EBA\u3002\u4F60\u4E00\u76F4\u5206\u5F97\u5F88\u6E05\u695A\u3002"],
        ["treasure_accident", "\u4F60\u8FDE\u610F\u5916\u5F62\u6210\u7684\u661F\u6676\u90FD\u613F\u610F\u73CD\u85CF\uFF0C\u8FD9\u74F6\u504F\u822A\u58A8\u5927\u6982\u4F1A\u5F88\u5408\u4F60\u7684\u773C\u5149\u3002"]
      ])
    ],
    openingDialogue: [
      { text: "\u5B89\u5168\u5149\u73AF\u56F4\u4F4F\u4E00\u74F6\u5C1A\u672A\u5F00\u5C01\u7684\u504F\u822A\u661F\u58A8\uFF0C\u68C0\u6D4B\u53F0\u88AB\u8F6C\u5230\u4E24\u5F20\u5EA7\u4F4D\u4E2D\u95F4\u3002" },
      { speaker: "\u9B54\u5973", mood: "calm", text: "\u793C\u7269\u5F88\u8FF7\u4EBA\u3002\u4F46\u8D8A\u8FF7\u4EBA\u7684\u5B9E\u9A8C\u6750\u6599\uFF0C\u8D8A\u5E94\u8BE5\u5148\u786E\u8BA4\u8FB9\u754C\u548C\u98CE\u9669\u3002" },
      { speaker: "\u9B54\u5973", mood: "bright", text: "\u6240\u4EE5\u4ECA\u5929\u7531\u6211\u4EEC\u5171\u540C\u51B3\u5B9A\uFF1A\u68C0\u67E5\u3001\u4FDD\u7559\u5BC6\u5C01\uFF0C\u6216\u8005\u9000\u56DE\u3002" }
    ],
    choices: [
      {
        id: "inspect_together",
        label: "\u201C\u7531\u4F60\u4E3B\u6301\u68C0\u6D4B\uFF1B\u6211\u53EA\u64CD\u4F5C\u4F60\u660E\u786E\u4EA4\u7ED9\u6211\u7684\u90E8\u5206\u3002\u201D",
        mood: "bright",
        responseDialogue: [
          { speaker: "\u9B54\u5973", mood: "playful", text: "\u300A\u4F18\u79C0\u7684\u5171\u72AF\u300B\u4ECE\u6765\u4E0D\u662F\u4E71\u78B0\u4E1C\u897F\uFF0C\u800C\u662F\u77E5\u9053\u4EC0\u4E48\u65F6\u5019\u8BE5\u9012\u5DE5\u5177\u3002" },
          { text: "\u5979\u628A\u68C0\u6D4B\u53F0\u8F6C\u5230\u4E2D\u592E\uFF0C\u4E0E\u4F60\u9010\u9879\u786E\u8BA4\u661F\u58A8\u4FDD\u6301\u7A33\u5B9A\u3002" }
        ]
      },
      {
        id: "keep_sealed",
        label: "\u201C\u5148\u4FDD\u6301\u5BC6\u5C01\u3002\u7B49\u4F60\u60F3\u7814\u7A76\u65F6\uFF0C\u5B83\u4ECD\u7136\u662F\u4F60\u7684\u793C\u7269\u3002\u201D",
        mood: "moved",
        responseDialogue: [
          { speaker: "\u9B54\u5973", mood: "moved", text: "\u4F60\u4E0D\u628A\u597D\u5947\u5FC3\u5F53\u901A\u884C\u8BC1\u2026\u2026\u300A\u8FD9\u6761\u6211\u5F88\u559C\u6B22\u300B\u3002" },
          { text: "\u5979\u4E3A\u58A8\u74F6\u7F69\u4E0A\u67D4\u5149\u73BB\u7483\u7F69\uFF0C\u628A\u5F00\u542F\u65E5\u671F\u7559\u6210\u7A7A\u767D\u3002" }
        ]
      },
      {
        id: "decline_is_allowed",
        label: "\u201C\u82E5\u4E0D\u5408\u9002\u5C31\u9000\u56DE\uFF0C\u4E0D\u9700\u8981\u7F16\u4E00\u4E2A\u7167\u987E\u6211\u9762\u5B50\u7684\u7406\u7531\u3002\u201D",
        mood: "shy",
        responseDialogue: [
          { speaker: "\u9B54\u5973", mood: "playful", text: "\u8FDE\u62D2\u6536\u6743\u90FD\u5305\u88C5\u8FDB\u793C\u7269\u91CC\u4E86\u3002\u4F60\u6BD4\u5F88\u591A\u9B54\u6CD5\u5951\u7EA6\u806A\u660E\u3002" },
          { text: "\u786E\u8BA4\u5B89\u5168\u540E\uFF0C\u5979\u624D\u5F2F\u8D77\u773C\u775B\uFF0C\u628A\u661F\u58A8\u90D1\u91CD\u79FB\u5230\u81EA\u5DF1\u7684\u5B9E\u9A8C\u533A\u3002" }
        ]
      }
    ]
  },
  {
    id: "aff_witch_08_secret",
    classId: "witch",
    episode: 8,
    title: "\u79D8\u5BC6\u4E5F\u6709\u8D60\u9001\u65E5\u671F",
    episodeLabel: "\u7B2C\u516B\u5E55 \xB7 \u672A\u62C6\u661F\u9875",
    unlockPoints: 2100,
    requiredStoryIds: ["aff_witch_07_gift"],
    completionPoints: 60,
    backgroundAsset: "assets/affection/scenes/witch-secret-library-night.webp",
    memoryCallbacks: [
      ...rememberedChoices("aff_witch_05_nightflight", "\u9B54\u5973", [
        ["ask_before_pause", "\u4F60\u7B54\u5E94\u5FF5\u6682\u505C\u5492\u524D\u5148\u786E\u8BA4\uFF0C\u6240\u4EE5\u7FFB\u5F00\u79D8\u5BC6\u524D\u5F53\u7136\u4E5F\u4F1A\u5148\u95EE\u3002"],
        ["shared_pause_signal", "\u6211\u4EEC\u7684\u6682\u505C\u4FE1\u53F7\u53CC\u5411\u6709\u6548\uFF1B\u8FD9\u9875\u661F\u56FE\u7684\u5F00\u542F\u89C4\u5219\u4E5F\u7531\u4E24\u4E2A\u4EBA\u786E\u8BA4\u3002"],
        ["pause_for_stars", "\u90A3\u665A\u6211\u4EEC\u6CA1\u6709\u8BB0\u5F55\u661F\u6CB3\uFF0C\u6240\u4EE5\u4ECA\u665A\u8FD9\u9875\u7A7A\u767D\u4E5F\u4E0D\u9700\u8981\u7ACB\u523B\u586B\u6EE1\u3002"]
      ])
    ],
    openingDialogue: [
      { text: "\u6DF1\u591C\u89C2\u661F\u85CF\u4E66\u5BA4\u91CC\uFF0C\u4E00\u9875\u5C01\u5728\u900F\u660E\u661F\u888B\u4E2D\u7684\u7A7A\u767D\u624B\u672D\u653E\u5728\u4E24\u5F20\u76F8\u90BB\u5EA7\u4F4D\u4E4B\u95F4\u3002" },
      { speaker: "\u9B54\u5973", mood: "calm", text: "\u6211\u60F3\u628A\u4E00\u9879\u5C1A\u672A\u516C\u5F00\u7684\u7814\u7A76\u9001\u7ED9\u4F60\uFF0C\u4F46\u4E0D\u662F\u8BA9\u4F60\u7ACB\u523B\u8BC1\u660E\u503C\u5F97\u4FE1\u4EFB\u3002" },
      { speaker: "\u9B54\u5973", mood: "moved", text: "\u5F00\u542F\u65E5\u671F\u7531\u6211\u8BF4\u660E\uFF0C\u662F\u5426\u6536\u4E0B\u4EE5\u53CA\u4F55\u65F6\u9605\u8BFB\uFF0C\u300A\u4ECD\u7531\u4F60\u51B3\u5B9A\u300B\u3002" }
    ],
    choices: [
      {
        id: "ask_opening_rule",
        label: "\u201C\u5148\u544A\u8BC9\u6211\u5F00\u542F\u8FB9\u754C\uFF1B\u5185\u5BB9\u53EF\u4EE5\u7B49\u4F60\u51C6\u5907\u597D\u518D\u89E3\u91CA\u3002\u201D",
        mood: "moved",
        responseDialogue: [
          { speaker: "\u9B54\u5973", mood: "moved", text: "\u95EE\u89C4\u5219\uFF0C\u4E0D\u8FFD\u95EE\u7B54\u6848\u3002\u4F60\u603B\u80FD\u628A\u300A\u597D\u5947\u548C\u5C0A\u91CD\u300B\u540C\u65F6\u7559\u4E0B\u3002" },
          { text: "\u5979\u53EA\u8BF4\u660E\u5B89\u5168\u8FB9\u754C\uFF0C\u6CA1\u6709\u88AB\u8FEB\u900F\u9732\u661F\u9875\u4E2D\u7684\u4EFB\u4F55\u79D8\u5BC6\u3002" }
        ]
      },
      {
        id: "guard_unopened",
        label: "\u201C\u6211\u613F\u610F\u66FF\u4F60\u4FDD\u7BA1\u672A\u62C6\u7684\u8FD9\u4E00\u9875\uFF0C\u76F4\u5230\u4F60\u4E3B\u52A8\u8BF4\u53EF\u4EE5\u3002\u201D",
        mood: "shy",
        responseDialogue: [
          { speaker: "\u9B54\u5973", mood: "shy", text: "\u628A\u79D8\u5BC6\u4EA4\u7ED9\u4F60\uFF0C\u7ADF\u7136\u4E0D\u9700\u8981\u7ACB\u523B\u5931\u53BB\u5B83\u2026\u2026\u611F\u89C9\u5F88\u65B0\u9C9C\u3002" },
          { text: "\u5979\u4E3A\u661F\u888B\u7559\u4E0B\u53EA\u6709\u81EA\u5DF1\u80FD\u89E3\u9664\u7684\u67D4\u5149\u5C01\u5370\u3002" }
        ]
      },
      {
        id: "share_blank_page",
        label: "\u201C\u6211\u4E5F\u653E\u4E00\u5F20\u7A7A\u767D\u9875\u5728\u65C1\u8FB9\uFF1B\u60F3\u5206\u4EAB\u4EC0\u4E48\uFF0C\u7531\u6211\u4EEC\u5404\u81EA\u51B3\u5B9A\u3002\u201D",
        mood: "bright",
        responseDialogue: [
          { speaker: "\u9B54\u5973", mood: "bright", text: "\u4E24\u4EFD\u79D8\u5BC6\u90FD\u62E5\u6709\u81EA\u5DF1\u7684\u95E8\uFF0C\u5374\u613F\u610F\u628A\u95E8\u5F00\u5411\u540C\u4E00\u5F20\u684C\u5B50\u3002" },
          { text: "\u4E24\u9875\u7A7A\u767D\u624B\u672D\u5E76\u6392\u653E\u597D\uFF0C\u6CA1\u6709\u4EFB\u4F55\u4E00\u9875\u88AB\u64C5\u81EA\u7FFB\u5F00\u3002" }
        ]
      }
    ]
  },
  {
    id: "aff_witch_09_reciprocal",
    classId: "witch",
    episode: 9,
    title: "\u504F\u822A\u4E5F\u4F1A\u62B5\u8FBE\u5F7C\u6B64",
    episodeLabel: "\u7B2C\u4E5D\u5E55 \xB7 \u53CC\u74F6\u661F\u58A8",
    unlockPoints: 2600,
    requiredStoryIds: ["aff_witch_08_secret"],
    completionPoints: 60,
    backgroundAsset: "assets/affection/scenes/witch-reciprocal-star-dawn.webp",
    cgAsset: "assets/affection/cg/witch-reciprocal-star-ink.webp",
    memoryCallbacks: [
      ...rememberedChoices("aff_witch_06_constellation", "\u9B54\u5973", [
        ["two_home_stars", "\u4E24\u9897\u5F52\u822A\u661F\u5404\u81EA\u53D1\u5149\uFF1B\u8FD9\u4E24\u74F6\u661F\u58A8\u4E5F\u4E0D\u9700\u8981\u6DF7\u6210\u540C\u4E00\u79CD\u989C\u8272\u3002"],
        ["open_route", "\u6211\u4EEC\u7684\u661F\u8DEF\u53EF\u4EE5\u6301\u7EED\u66F4\u65B0\uFF0C\u56DE\u793C\u5F53\u7136\u4E5F\u5141\u8BB8\u8FB9\u8D70\u8FB9\u6539\u3002"],
        ["shared_blank", "\u4F60\u4E3A\u672A\u6765\u4FDD\u7559\u7A7A\u767D\uFF0C\u6240\u4EE5\u6211\u628A\u7B2C\u4E8C\u74F6\u5C1A\u672A\u547D\u540D\u7684\u661F\u58A8\u7559\u7ED9\u4F60\u3002"]
      ])
    ],
    openingDialogue: [
      { text: "\u9ECE\u660E\u5B9E\u9A8C\u53F0\u4E0A\uFF0C\u4E24\u74F6\u989C\u8272\u4E0D\u540C\u7684\u661F\u58A8\u505C\u5728\u72EC\u7ACB\u9EC4\u94DC\u5E95\u5EA7\uFF0C\u5149\u8F68\u5728\u4E2D\u95F4\u76F8\u9047\u53C8\u5404\u81EA\u5EF6\u4F38\u3002" },
      { speaker: "\u9B54\u5973", mood: "calm", text: "\u4E00\u74F6\u662F\u4F60\u9001\u6765\u7684\u504F\u822A\u661F\u58A8\uFF0C\u53E6\u4E00\u74F6\u662F\u6211\u91CD\u65B0\u8C03\u51FA\u7684\u56DE\u793C\u3002" },
      { speaker: "\u9B54\u5973", mood: "moved", text: "\u5B83\u4EEC\u4E0D\u7528\u53D8\u6210\u540C\u4E00\u79CD\u989C\u8272\uFF0C\u4E5F\u80FD\u5728\u540C\u4E00\u5F20\u661F\u56FE\u4E0A\u300A\u627E\u5230\u5F7C\u6B64\u300B\u3002" }
    ],
    choices: [
      {
        id: "two_independent_colors",
        label: "\u201C\u4FDD\u7559\u4E24\u79CD\u989C\u8272\uFF0C\u8BA9\u6BCF\u6761\u8F68\u8FF9\u90FD\u80FD\u770B\u89C1\u5BF9\u65B9\u3002\u201D",
        mood: "moved",
        responseDialogue: [
          { speaker: "\u9B54\u5973", mood: "moved", text: "\u4E0D\u4E92\u76F8\u8986\u76D6\uFF0C\u5374\u80FD\u5171\u540C\u5B8C\u6210\u4E00\u5E45\u661F\u56FE\u3002\u300A\u5F88\u50CF\u6211\u4EEC\u300B\u3002" },
          { text: "\u4E24\u675F\u72EC\u7ACB\u661F\u58A8\u8D8A\u8FC7\u73BB\u7483\uFF0C\u5728\u4E2D\u592E\u7559\u4E0B\u4E0D\u76F8\u541E\u6CA1\u7684\u4EA4\u6C47\u5149\u70B9\u3002" }
        ]
      },
      {
        id: "rewrite_coordinates",
        label: "\u201C\u5750\u6807\u53EF\u4EE5\u6539\u5199\uFF1B\u60F3\u504F\u822A\u65F6\uFF0C\u6211\u4EEC\u5148\u544A\u8BC9\u5F7C\u6B64\u3002\u201D",
        mood: "bright",
        responseDialogue: [
          { speaker: "\u9B54\u5973", mood: "bright", text: "\u957F\u671F\u5B9E\u9A8C\u6700\u91CD\u8981\u7684\u4E0D\u662F\u6C38\u4E0D\u53D8\u5316\uFF0C\u800C\u662F\u8BDA\u5B9E\u62A5\u544A\u65B0\u7684\u65B9\u5411\u3002" },
          { text: "\u5979\u628A\u4E24\u53EA\u53EF\u79FB\u52A8\u5E95\u5EA7\u63A8\u5230\u4E2D\u95F4\uFF0C\u9080\u8BF7\u4F60\u5171\u540C\u8C03\u6574\u4E0B\u4E00\u6BB5\u661F\u8F68\u3002" }
        ]
      },
      {
        id: "opt_in_experiment",
        label: "\u201C\u6BCF\u6B21\u5171\u540C\u5B9E\u9A8C\u90FD\u91CD\u65B0\u786E\u8BA4\uFF0C\u79D8\u5BC6\u4E0E\u966A\u4F34\u90FD\u4E0D\u89C6\u4E3A\u9ED8\u8BA4\u6743\u9650\u3002\u201D",
        mood: "shy",
        responseDialogue: [
          { speaker: "\u9B54\u5973", mood: "playful", text: "\u6279\u51C6\u3002\u770B\u6765\u4F60\u5F88\u9002\u5408\u5F53\u4E00\u4F4D\u957F\u671F\u3001\u4F46\u300A\u968F\u65F6\u53EF\u4EE5\u8BF4\u6682\u505C\u300B\u7684\u5171\u72AF\u3002" },
          { text: "\u5979\u8F7B\u8F7B\u78B0\u54CD\u81EA\u5DF1\u7684\u58A8\u74F6\uFF0C\u53E6\u4E00\u74F6\u968F\u5373\u4EAE\u8D77\u6E29\u67D4\u56DE\u5E94\u3002" }
        ]
      }
    ]
  }
];
var SHAMAN_STORIES = [
  {
    id: "aff_shaman_01_bell",
    classId: "shaman",
    episode: 1,
    title: "\u98CE\u94C3\u56DE\u7B54\u4EE5\u524D",
    episodeLabel: "\u7B2C\u4E00\u5E55 \xB7 \u5B89\u9759\u7684\u7B54\u6848",
    unlockPoints: 0,
    requiredStoryIds: [],
    completionPoints: 30,
    backgroundAsset: "assets/affection/scenes/shaman-shrine-morning.webp",
    openingDialogue: [
      { text: "\u6E05\u6668\u795E\u793E\u91CC\u6CA1\u6709\u98CE\uFF0C\u6A90\u4E0B\u98CE\u94C3\u5374\u8F7B\u8F7B\u6447\u7740\u3002" },
      { speaker: "\u7075\u5DEB", mood: "calm", text: "\u5B83\u4ECA\u5929\u4E0D\u80AF\u56DE\u7B54\u3002\u4E5F\u8BB8\u5728\u7B49\u4E00\u4E2A\u300A\u4E0D\u4F1A\u50AC\u4FC3\u5B83\u7684\u4EBA\u300B\u3002" }
    ],
    choices: [
      {
        id: "wait_silently",
        label: "\u201C\u90A3\u6211\u966A\u4F60\u5B89\u9759\u7B49\u4E00\u4F1A\u513F\u3002\u201D",
        mood: "moved",
        responseDialogue: [
          { text: "\u5F88\u4E45\u4EE5\u540E\uFF0C\u94C3\u58F0\u7EC8\u4E8E\u54CD\u8D77\u3002" },
          { speaker: "\u7075\u5DEB", mood: "moved", text: "\u4F60\u6CA1\u6709\u8BF4\u8BDD\uFF0C\u53EF\u5B83\u597D\u50CF\u300A\u5DF2\u7ECF\u542C\u61C2\u4E86\u300B\u3002" }
        ]
      },
      {
        id: "leave_tea",
        label: "\u201C\u6211\u628A\u70ED\u8336\u653E\u5728\u8FD9\u91CC\uFF0C\u4E0D\u6253\u65AD\u4F60\u3002\u201D",
        mood: "calm",
        responseDialogue: [
          { speaker: "\u7075\u5DEB", mood: "moved", text: "\u8C22\u8C22\u3002\u8336\u7684\u70ED\u6C14\u4E5F\u662F\u4E00\u79CD\u5F88\u6E29\u67D4\u7684\u56DE\u7B54\u3002" },
          { text: "\u5979\u628A\u53E6\u4E00\u53EA\u8336\u676F\u653E\u5230\u81EA\u5DF1\u8EAB\u65C1\uFF0C\u4F4D\u7F6E\u79BB\u4F60\u5F88\u8FD1\u3002" }
        ]
      },
      {
        id: "ask_to_sit",
        label: "\u201C\u6211\u53EF\u4EE5\u5750\u5728\u8FD9\u91CC\u5417\uFF1F\u201D",
        mood: "shy",
        responseDialogue: [
          { text: "\u5979\u628A\u8EAB\u65C1\u5750\u57AB\u79FB\u5F00\u4E00\u70B9\u3002" },
          { speaker: "\u7075\u5DEB", mood: "shy", text: "\u53EF\u4EE5\u3002\u9760\u8FD1\u4E9B\u4E5F\u6CA1\u5173\u7CFB\uFF1B\u9700\u8981\u5B89\u9759\u65F6\uFF0C\u6211\u4F1A\u544A\u8BC9\u4F60\u3002" }
        ]
      }
    ]
  },
  {
    id: "aff_shaman_02_firefly",
    classId: "shaman",
    episode: 2,
    title: "\u501F\u7ED9\u4F60\u4E00\u76CF\u7075\u706B",
    episodeLabel: "\u7B2C\u4E8C\u5E55 \xB7 \u5F52\u706F\u5DE1\u591C",
    unlockPoints: 80,
    requiredStoryIds: ["aff_shaman_01_bell"],
    completionPoints: 45,
    backgroundAsset: "assets/affection/scenes/shaman-firefly-lake.webp",
    openingDialogue: [
      { text: "\u4E00\u7C07\u5C0F\u7075\u706B\u79BB\u5F00\u5979\u7684\u706F\u76CF\uFF0C\u56FA\u6267\u5730\u8DDF\u5728\u4F60\u80A9\u8FB9\u3002" },
      { speaker: "\u7075\u5DEB", mood: "calm", text: "\u5B83\u5E73\u65F6\u4E0D\u4F1A\u9760\u8FD1\u964C\u751F\u4EBA\u3002" }
    ],
    choices: [
      {
        id: "wait_until_safe",
        label: "\u201C\u5148\u8BA9\u5B83\u966A\u7740\u4F60\uFF0C\u7B49\u4F60\u653E\u5FC3\u4E86\u518D\u501F\u7ED9\u6211\u3002\u201D",
        mood: "moved",
        responseDialogue: [
          { text: "\u7075\u706B\u5DF2\u7ECF\u5148\u4E00\u6B65\u843D\u5230\u4F60\u7684\u80A9\u5934\u3002" },
          { speaker: "\u7075\u5DEB", mood: "moved", text: "\u770B\u6765\u5B83\u6BD4\u6211\u66F4\u65E9\u77E5\u9053\u2026\u2026\u300A\u6211\u5DF2\u7ECF\u653E\u5FC3\u4E86\u300B\u3002" }
        ]
      },
      {
        id: "walk_together",
        label: "\u201C\u966A\u6211\u7ED5\u6E56\u8D70\u4E00\u5708\u5427\uFF0C\u4F60\u548C\u5B83\u4E00\u8D77\u3002\u201D",
        mood: "bright",
        responseDialogue: [
          { text: "\u6C34\u9762\u6620\u51FA\u4E24\u4E2A\u4EBA\u548C\u4E00\u7C07\u7075\u706B\uFF0C\u50CF\u4E09\u9053\u5E76\u80A9\u7684\u5F71\u5B50\u3002" },
          { speaker: "\u7075\u5DEB", mood: "bright", text: "\u8FD9\u6837\u7684\u5DE1\u591C\uFF0C\u4F3C\u4E4E\u300A\u4E0D\u518D\u6F2B\u957F\u300B\u4E86\u3002" }
        ]
      },
      {
        id: "name_light",
        label: "\u201C\u7ED9\u5B83\u8D77\u4E2A\u53EA\u6709\u6211\u4EEC\u77E5\u9053\u7684\u540D\u5B57\u3002\u201D",
        mood: "shy",
        responseDialogue: [
          { speaker: "\u7075\u5DEB", mood: "calm", text: "\u53EB\u201C\u5F52\u706F\u201D\u5427\u3002" },
          { speaker: "\u7075\u5DEB", mood: "moved", text: "\u56E0\u4E3A\u65E0\u8BBA\u8D70\u591A\u8FDC\uFF0C\u5B83\u90FD\u4F1A\u5E26\u4EBA\u56DE\u5230\u60F3\u89C1\u7684\u4EBA\u8EAB\u8FB9\u3002" }
        ]
      }
    ]
  },
  {
    id: "aff_shaman_03_wish",
    classId: "shaman",
    episode: 3,
    title: "\u5FC3\u613F\u4E0D\u5FC5\u8BF4\u7ED9\u795E\u660E",
    episodeLabel: "\u7B2C\u4E09\u5E55 \xB7 \u4E24\u534A\u613F\u7EB8",
    unlockPoints: 240,
    requiredStoryIds: ["aff_shaman_02_firefly"],
    completionPoints: 60,
    backgroundAsset: "assets/affection/scenes/shaman-bell-corridor-rain.webp",
    cgAsset: "assets/affection/cg/shaman-split-wish.webp",
    memoryCallbacks: [
      {
        fromStoryId: "aff_shaman_02_firefly",
        choiceId: "wait_until_safe",
        dialogue: [{ speaker: "\u7075\u5DEB", text: "\u5F52\u706F\u4ECA\u5929\u76F4\u63A5\u98DE\u5411\u4F60\u3002\u5B83\u548C\u6211\u90FD\u4E0D\u518D\u8FDF\u7591\u4E86\u3002" }]
      },
      {
        fromStoryId: "aff_shaman_02_firefly",
        choiceId: "walk_together",
        dialogue: [{ speaker: "\u7075\u5DEB", text: "\u6E56\u8FB9\u90A3\u5708\u8DEF\u4E0D\u957F\uFF0C\u6211\u5374\u8BB0\u4F4F\u4E86\u6BCF\u4E00\u6B65\u3002" }]
      },
      {
        fromStoryId: "aff_shaman_02_firefly",
        choiceId: "name_light",
        dialogue: [{ speaker: "\u7075\u5DEB", text: "\u4F60\u8FD8\u8BB0\u5F97\u201C\u5F52\u706F\u201D\u7684\u540D\u5B57\u5417\uFF1F\u5B83\u6B63\u5728\u66FF\u6211\u7B49\u4F60\u3002" }]
      }
    ],
    openingDialogue: [
      { text: "\u96E8\u58F0\u76D6\u4F4F\u7948\u613F\u94C3\uFF0C\u5979\u62FF\u7740\u7A7A\u767D\u613F\u7EB8\u8FDF\u8FDF\u6CA1\u6709\u843D\u7B14\u3002" },
      { speaker: "\u7075\u5DEB", mood: "calm", text: "\u5927\u5BB6\u90FD\u628A\u613F\u671B\u4EA4\u7ED9\u6211\u3002\u6211\u5374\u5FFD\u7136\u4E0D\u77E5\u9053\uFF0C\u300A\u81EA\u5DF1\u7684\u613F\u671B\u300B\u662F\u4EC0\u4E48\u3002" }
    ],
    choices: [
      {
        id: "wish_for_her",
        label: "\u201C\u8FD9\u4E00\u6B21\u5148\u5199\u4F60\u7684\uFF0C\u4E0D\u66FF\u4EFB\u4F55\u4EBA\u3002\u201D",
        mood: "moved",
        responseDialogue: [
          { speaker: "\u7075\u5DEB", mood: "shy", text: "\u90A3\u6211\u60F3\u5199\u2014\u2014\u613F\u6709\u4EBA\u4E5F\u4F1A\u300A\u95EE\u6211\u7D2F\u4E0D\u7D2F\u300B\u3002" },
          { text: "\u5979\u628A\u613F\u7EB8\u6298\u6210\u4E24\u534A\uFF0C\u4E00\u534A\u8F7B\u8F7B\u653E\u5165\u4F60\u624B\u4E2D\u3002" }
        ]
      },
      {
        id: "guard_each_other",
        label: "\u201C\u82E5\u4F60\u603B\u66FF\u6211\u5B88\u591C\uFF0C\u4EE5\u540E\u4E5F\u8BA9\u6211\u5B88\u7740\u4F60\u3002\u201D",
        mood: "shy",
        responseDialogue: [
          { speaker: "\u7075\u5DEB", mood: "moved", text: "\u5B88\u62A4\u539F\u6765\u4E0D\u662F\u4E00\u4E2A\u65B9\u5411\uFF0C\u800C\u662F\u4E00\u4E2A\u5706\u3002" },
          { text: "\u5F52\u706F\u6CBF\u7740\u4F60\u4EEC\u4E4B\u95F4\u753B\u51FA\u4E00\u5708\u6E29\u67D4\u5149\u8F68\u3002" }
        ]
      },
      {
        id: "share_tomorrow",
        label: "\u201C\u628A\u660E\u5929\u7559\u4E00\u5C0F\u6BB5\u7ED9\u6211\uFF0C\u6211\u4EEC\u4E00\u8D77\u51B3\u5B9A\u505A\u4EC0\u4E48\u3002\u201D",
        mood: "bright",
        responseDialogue: [
          { text: "\u5979\u5199\u4E0B\u613F\u671B\uFF0C\u5C06\u7EB8\u6298\u6210\u4E24\u534A\u3002" },
          { speaker: "\u7075\u5DEB", mood: "bright", text: "\u4E00\u534A\u7ED9\u795E\u660E\uFF0C\u4E00\u534A\u7ED9\u4F60\u4FDD\u7BA1\u3002\u8FD9\u6837\u660E\u5929\u5C31\u4E0D\u4F1A\u8D70\u4E22\u3002" }
        ]
      }
    ]
  },
  {
    id: "aff_shaman_04_quiet",
    classId: "shaman",
    episode: 4,
    title: "\u628A\u6C89\u9ED8\u4E5F\u5206\u7ED9\u4F60",
    episodeLabel: "\u7B2C\u56DB\u5E55 \xB7 \u5348\u540E\u8336\u5E2D",
    unlockPoints: 520,
    requiredStoryIds: ["aff_shaman_03_wish"],
    completionPoints: 60,
    backgroundAsset: "assets/affection/scenes/shaman-quiet-tea-afternoon.webp",
    memoryCallbacks: [
      ...rememberedChoices("aff_shaman_01_bell", "\u7075\u5DEB", [
        ["wait_silently", "\u4F60\u66FE\u966A\u6211\u7B49\u98CE\u94C3\u56DE\u7B54\uFF0C\u6240\u4EE5\u4ECA\u5929\u4E5F\u613F\u610F\u966A\u6211\u6162\u6162\u559D\u5B8C\u8FD9\u58F6\u8336\u5417\uFF1F"],
        ["leave_tea", "\u90A3\u676F\u6CA1\u6709\u6253\u6270\u6211\u7684\u70ED\u8336\uFF0C\u8BA9\u6211\u7B2C\u4E00\u6B21\u671F\u5F85\u4E0E\u4F60\u5171\u4EAB\u95F2\u6687\u3002"],
        ["ask_to_sit", "\u4F60\u603B\u4F1A\u5148\u95EE\u80FD\u5426\u7559\u4E0B\uFF1B\u4ECA\u5929\u8FD9\u4E2A\u4F4D\u7F6E\u5DF2\u7ECF\u4E3B\u52A8\u66FF\u4F60\u7559\u597D\u3002"]
      ]),
      ...rememberedChoices("aff_shaman_03_wish", "\u7075\u5DEB", [
        ["wish_for_her", "\u4F60\u8BA9\u6211\u5148\u5199\u81EA\u5DF1\u7684\u613F\u671B\uFF0C\u4ECA\u5929\u6211\u60F3\u8981\u7684\u53EA\u662F\u4E0E\u4F60\u5171\u4EAB\u8FD9\u6BB5\u5B89\u9759\u3002"],
        ["guard_each_other", "\u5B88\u62A4\u662F\u4E00\u4E2A\u5706\uFF0C\u6C89\u9ED8\u4E5F\u53EF\u4EE5\u5728\u6211\u4EEC\u4E4B\u95F4\u5E73\u7B49\u6D41\u52A8\u3002"],
        ["share_tomorrow", "\u4F60\u9884\u7EA6\u8FC7\u4E00\u5C0F\u6BB5\u660E\u5929\uFF1B\u6211\u628A\u4ECA\u5929\u7684\u8336\u5E2D\u7559\u6210\u4E86\u4E24\u4EBA\u4EFD\u3002"]
      ])
    ],
    openingDialogue: [
      { text: "\u5348\u540E\u8336\u5E2D\u88AB\u6811\u5F71\u5206\u6210\u67D4\u8F6F\u7684\u660E\u6697\uFF0C\u58F6\u4E2D\u70ED\u6C14\u7F13\u6162\u5347\u8D77\uFF0C\u6CA1\u6709\u4EFB\u4F55\u4EEA\u5F0F\u7B49\u5979\u4E3B\u6301\u3002" },
      { speaker: "\u7075\u5DEB", mood: "calm", text: "\u6211\u4ECA\u5929\u4E0D\u60F3\u89E3\u91CA\u6C89\u9ED8\uFF0C\u4E5F\u4E0D\u60F3\u6025\u7740\u5BFB\u627E\u7B54\u6848\u3002" },
      { speaker: "\u7075\u5DEB", mood: "shy", text: "\u5982\u679C\u4F60\u613F\u610F\uFF0C\u53EF\u4EE5\u966A\u6211\u628A\u8FD9\u6BB5\u5B89\u9759\u300A\u5206\u6210\u4E24\u4EBA\u4EFD\u300B\u3002" }
    ],
    choices: [
      {
        id: "share_silence",
        label: "\u201C\u597D\u3002\u6211\u4EEC\u5148\u559D\u8336\uFF0C\u8C01\u60F3\u8BF4\u8BDD\u65F6\u518D\u5F00\u53E3\u3002\u201D",
        mood: "bright",
        responseDialogue: [
          { speaker: "\u7075\u5DEB", mood: "moved", text: "\u8C22\u8C22\u4F60\u6CA1\u6709\u628A\u5B89\u9759\u8BEF\u89E3\u6210\u758F\u8FDC\u3002" },
          { text: "\u5979\u66FF\u4E24\u53EA\u8336\u676F\u6DFB\u6EE1\u70ED\u8336\uFF0C\u676F\u6CBF\u5728\u684C\u4E0A\u4FDD\u6301\u7740\u81EA\u5728\u7684\u8DDD\u79BB\u3002" }
        ]
      },
      {
        id: "rest_as_equals",
        label: "\u201C\u6211\u4E5F\u6709\u60F3\u5B89\u9759\u7684\u65F6\u5019\u3002\u4ECA\u5929\u4E0D\u9700\u8981\u8C01\u7167\u987E\u8C01\u3002\u201D",
        mood: "calm",
        responseDialogue: [
          { speaker: "\u7075\u5DEB", mood: "moved", text: "\u5E73\u7B49\u5730\u5206\u4EAB\u6C89\u9ED8\uFF0C\u539F\u6765\u4E5F\u80FD\u8BA9\u4EBA\u611F\u5230\u300A\u88AB\u7406\u89E3\u300B\u3002" },
          { text: "\u98CE\u7A7F\u8FC7\u5EAD\u9662\uFF0C\u8336\u9999\u4E0E\u5B89\u9759\u540C\u65F6\u505C\u5728\u4E24\u4EBA\u4E4B\u95F4\u3002" }
        ]
      },
      {
        id: "leave_choice_space",
        label: "\u201C\u82E5\u4F60\u60F3\u7ED3\u675F\u8336\u5E2D\uFF0C\u968F\u65F6\u544A\u8BC9\u6211\uFF1B\u7559\u4E0B\u4E5F\u7531\u4F60\u51B3\u5B9A\u3002\u201D",
        mood: "shy",
        responseDialogue: [
          { speaker: "\u7075\u5DEB", mood: "calm", text: "\u9009\u62E9\u79BB\u5F00\u4E5F\u4E0D\u4F1A\u4F24\u5BB3\u5173\u7CFB\u2026\u2026\u8FD9\u6837\u7684\u4F59\u5730\u8BA9\u6211\u66F4\u613F\u610F\u7559\u4E0B\u3002" },
          { text: "\u5979\u8F7B\u8F7B\u70B9\u5934\uFF0C\u5C06\u4E0B\u4E00\u76CF\u8336\u4E5F\u5012\u6210\u4E86\u4E24\u4EBA\u4EFD\u3002" }
        ]
      }
    ]
  },
  {
    id: "aff_shaman_05_storm",
    classId: "shaman",
    episode: 5,
    title: "\u8FD9\u6B21\u8BA9\u6211\u4E5F\u88AB\u5B88\u62A4",
    episodeLabel: "\u7B2C\u4E94\u5E55 \xB7 \u66B4\u96E8\u706F\u8DEF",
    unlockPoints: 900,
    requiredStoryIds: ["aff_shaman_04_quiet"],
    completionPoints: 60,
    backgroundAsset: "assets/affection/scenes/shaman-storm-lantern-path.webp",
    memoryCallbacks: [
      ...rememberedChoices("aff_shaman_02_firefly", "\u7075\u5DEB", [
        ["wait_until_safe", "\u4F60\u613F\u610F\u7B49\u6211\u653E\u5FC3\u624D\u63A5\u8FC7\u7075\u706B\uFF0C\u6240\u4EE5\u4ECA\u665A\u6211\u4E5F\u613F\u610F\u8BF4\u51FA\u4E0D\u5B89\u3002"],
        ["walk_together", "\u90A3\u6B21\u7ED5\u6E56\u7684\u8DEF\u4E0D\u518D\u6F2B\u957F\uFF1B\u4ECA\u591C\u4E5F\u8BF7\u966A\u6211\u8D70\u8FC7\u8FD9\u4E00\u5C0F\u6BB5\u3002"],
        ["name_light", "\u5F52\u706F\u4F1A\u5E26\u4EBA\u56DE\u5230\u60F3\u89C1\u7684\u4EBA\u8EAB\u8FB9\uFF0C\u800C\u5B83\u5DF2\u7ECF\u505C\u5728\u4F60\u8FD9\u91CC\u3002"]
      ]),
      ...rememberedChoices("aff_shaman_04_quiet", "\u7075\u5DEB", [
        ["share_silence", "\u8336\u5E2D\u4E0A\u4F60\u613F\u610F\u7B49\u6211\u5F00\u53E3\uFF0C\u6240\u4EE5\u8FD9\u6B21\u6211\u4E5F\u80FD\u5766\u767D\u8BF4\u9700\u8981\u5E2E\u52A9\u3002"],
        ["rest_as_equals", "\u6211\u4EEC\u5171\u4EAB\u8FC7\u4E0D\u5FC5\u4E92\u76F8\u7167\u987E\u7684\u5B89\u9759\uFF1B\u73B0\u5728\u6211\u613F\u610F\u63A5\u53D7\u4E00\u6B21\u5B88\u62A4\u3002"],
        ["leave_choice_space", "\u4F60\u628A\u7559\u4E0B\u6216\u79BB\u5F00\u7684\u9009\u62E9\u4EA4\u7ED9\u6211\uFF1B\u66B4\u96E8\u91CC\u6211\u9009\u62E9\u4E0E\u4F60\u5E76\u80A9\u8D70\u3002"]
      ])
    ],
    openingDialogue: [
      { text: "\u66B4\u96E8\u538B\u4F4E\u5C71\u8DEF\u706F\u7B3C\uFF0C\u5979\u62A4\u9001\u6700\u540E\u4E00\u7C07\u7075\u706B\u5F52\u4F4D\u540E\uFF0C\u811A\u6B65\u7EC8\u4E8E\u5728\u77F3\u9636\u8FB9\u505C\u4F4F\u3002" },
      { speaker: "\u7075\u5DEB", mood: "calm", text: "\u6211\u4E60\u60EF\u66FF\u6240\u6709\u4EBA\u4E3E\u706F\uFF0C\u53EF\u4ECA\u665A\u786E\u5B9E\u6709\u4E9B\u8D70\u4E0D\u52A8\u4E86\u3002" },
      { speaker: "\u7075\u5DEB", mood: "shy", text: "\u8FD9\u6B21\u2026\u2026\u53EF\u4EE5\u300A\u8BA9\u6211\u4E5F\u88AB\u5B88\u62A4\u300B\u4E00\u6BB5\u8DEF\u5417\uFF1F" }
    ],
    choices: [
      {
        id: "carry_lantern_together",
        label: "\u201C\u628A\u706F\u4EA4\u7ED9\u6211\uFF0C\u6211\u4EEC\u6309\u4F60\u7684\u901F\u5EA6\u4E00\u8D77\u8D70\u3002\u201D",
        mood: "moved",
        responseDialogue: [
          { speaker: "\u7075\u5DEB", mood: "moved", text: "\u4E0D\u662F\u50AC\u6211\u8FFD\u4E0A\uFF0C\u800C\u662F\u300A\u613F\u610F\u966A\u6211\u653E\u6162\u300B\u2026\u2026\u8C22\u8C22\u3002" },
          { text: "\u4F60\u63A5\u8FC7\u706F\u67C4\uFF0C\u5979\u4ECD\u63E1\u7740\u53E6\u4E00\u4FA7\uFF0C\u6696\u5149\u7A33\u7A33\u843D\u5728\u5171\u540C\u7684\u8DEF\u4E0A\u3002" }
        ]
      },
      {
        id: "rest_under_eaves",
        label: "\u201C\u5148\u5230\u907F\u96E8\u5904\u4F11\u606F\uFF0C\u8DEF\u4E0D\u4F1A\u56E0\u4E3A\u6682\u505C\u800C\u6D88\u5931\u3002\u201D",
        mood: "calm",
        responseDialogue: [
          { speaker: "\u7075\u5DEB", mood: "calm", text: "\u6211\u603B\u544A\u8BC9\u522B\u4EBA\u53EF\u4EE5\u4F11\u606F\uFF0C\u5374\u5FD8\u4E86\u8FD9\u53E5\u8BDD\u4E5F\u9002\u7528\u4E8E\u81EA\u5DF1\u3002" },
          { text: "\u4F60\u4EEC\u5728\u6A90\u4E0B\u5E76\u80A9\u5750\u597D\uFF0C\u706F\u706B\u9694\u7740\u96E8\u5E55\u7167\u4EAE\u524D\u65B9\u77F3\u9636\u3002" }
        ]
      },
      {
        id: "take_guard_turn",
        label: "\u201C\u524D\u534A\u7A0B\u4F60\u62A4\u9001\u7075\u706B\uFF0C\u540E\u534A\u7A0B\u6362\u6211\u5B88\u7740\u4F60\u3002\u201D",
        mood: "shy",
        responseDialogue: [
          { speaker: "\u7075\u5DEB", mood: "moved", text: "\u5B88\u62A4\u539F\u6765\u771F\u7684\u4F1A\u56DE\u5230\u81EA\u5DF1\u8EAB\u8FB9\u3002\u90A3\u5C31\u62DC\u6258\u4F60\u4E86\uFF0C\u540C\u884C\u8005\u3002" },
          { text: "\u5979\u4E0D\u518D\u8D70\u5728\u6700\u524D\u9762\uFF0C\u800C\u662F\u4E0E\u4F60\u5171\u4EAB\u706F\u4E0B\u540C\u4E00\u7247\u5E72\u71E5\u4F4D\u7F6E\u3002" }
        ]
      }
    ]
  },
  {
    id: "aff_shaman_06_firstsnow",
    classId: "shaman",
    episode: 6,
    title: "\u613F\u671B\u91CC\u5DF2\u7ECF\u6709\u4F60",
    episodeLabel: "\u7B2C\u516D\u5E55 \xB7 \u521D\u96EA\u613F\u706F",
    unlockPoints: 1400,
    requiredStoryIds: ["aff_shaman_05_storm"],
    completionPoints: 60,
    backgroundAsset: "assets/affection/scenes/shaman-first-snow-garden.webp",
    cgAsset: "assets/affection/cg/shaman-paired-lantern-charm.webp",
    memoryCallbacks: [
      ...rememberedChoices("aff_shaman_03_wish", "\u7075\u5DEB", [
        ["wish_for_her", "\u4F60\u66FE\u8BA9\u6211\u5148\u5199\u81EA\u5DF1\u7684\u613F\u671B\uFF1B\u73B0\u5728\u6211\u77E5\u9053\u5B83\u662F\u62E5\u6709\u53EF\u4EE5\u56DE\u53BB\u7684\u5730\u65B9\u3002"],
        ["guard_each_other", "\u5B88\u62A4\u662F\u4E00\u4E2A\u5706\uFF0C\u800C\u6211\u4EEC\u5DF2\u7ECF\u7AD9\u5728\u5706\u7684\u4E24\u7AEF\u5F7C\u6B64\u7167\u770B\u3002"],
        ["share_tomorrow", "\u90A3\u5F20\u613F\u7EB8\u7684\u4E00\u534A\u4ECD\u5728\u4F60\u90A3\u91CC\uFF0C\u4ECA\u5929\u6211\u4EEC\u6765\u8865\u4E0A\u660E\u5929\u3002"]
      ]),
      ...rememberedChoices("aff_shaman_04_quiet", "\u7075\u5DEB", [
        ["share_silence", "\u5348\u540E\u90A3\u676F\u5B89\u9759\u7684\u8336\uFF0C\u8BA9\u5E73\u51E1\u65E5\u5B50\u4E5F\u503C\u5F97\u8BA4\u771F\u671F\u5F85\u3002"],
        ["rest_as_equals", "\u8336\u5E2D\u7684\u5B89\u9759\u4E0D\u662F\u7A7A\u767D\uFF0C\u800C\u662F\u6211\u4EEC\u90FD\u53EF\u4EE5\u81EA\u5728\u547C\u5438\u7684\u5730\u65B9\u3002"],
        ["leave_choice_space", "\u4F60\u628A\u505C\u7559\u7684\u9009\u62E9\u7559\u7ED9\u6211\uFF1B\u5F80\u540E\u6211\u4E5F\u613F\u610F\u5C0A\u91CD\u4F60\u7684\u65B9\u5411\u3002"]
      ]),
      ...rememberedChoices("aff_shaman_05_storm", "\u7075\u5DEB", [
        ["carry_lantern_together", "\u66B4\u96E8\u91CC\u4F60\u6309\u6211\u7684\u901F\u5EA6\u4E3E\u706F\uFF0C\u6240\u4EE5\u521D\u96EA\u4E2D\u4E5F\u4E0D\u5FC5\u50AC\u4FC3\u4EFB\u4F55\u7B54\u6848\u3002"],
        ["rest_under_eaves", "\u4F60\u63D0\u9192\u6211\u6682\u505C\u4E0D\u4F1A\u8BA9\u9053\u8DEF\u6D88\u5931\uFF0C\u613F\u671B\u4E5F\u53EF\u4EE5\u6162\u6162\u5199\u3002"],
        ["take_guard_turn", "\u90A3\u665A\u5B88\u62A4\u56DE\u5230\u6211\u8EAB\u8FB9\uFF1B\u4ECA\u5929\u6211\u7684\u613F\u671B\u91CC\u81EA\u7136\u4E5F\u6709\u4F60\u7684\u4F4D\u7F6E\u3002"]
      ])
    ],
    openingDialogue: [
      { text: "\u521D\u96EA\u843D\u5728\u5EAD\u9662\uFF0C\u4E24\u76CF\u6210\u5BF9\u613F\u706F\u6620\u7740\u672A\u88AB\u8E29\u4E71\u7684\u767D\u8272\u5C0F\u5F84\u3002" },
      { speaker: "\u7075\u5DEB", mood: "moved", text: "\u4EE5\u524D\u6211\u7684\u613F\u671B\u603B\u5199\u7ED9\u522B\u4EBA\u3002\u73B0\u5728\u518D\u843D\u7B14\uFF0C\u91CC\u9762\u5DF2\u7ECF\u300A\u81EA\u7136\u5730\u6709\u4E86\u4F60\u300B\u3002" },
      { speaker: "\u7075\u5DEB", mood: "shy", text: "\u4E0D\u662F\u66FF\u4F60\u51B3\u5B9A\u672A\u6765\uFF0C\u53EA\u662F\u9080\u8BF7\u4F60\u4E00\u8D77\u70B9\u4EAE\u8FD9\u5BF9\u613F\u706F\u3002" }
    ],
    choices: [
      {
        id: "write_each_names",
        label: "\u201C\u5404\u5199\u81EA\u5DF1\u7684\u540D\u5B57\uFF0C\u8BA9\u4E24\u76CF\u706F\u81EA\u7531\u9009\u62E9\u76F8\u4E92\u7167\u4EAE\u3002\u201D",
        mood: "moved",
        responseDialogue: [
          { speaker: "\u7075\u5DEB", mood: "bright", text: "\u300A\u5404\u81EA\u5B8C\u6574\u300B\uFF0C\u53C8\u613F\u610F\u628A\u5149\u5206\u7ED9\u5BF9\u65B9\u3002\u6B63\u662F\u6211\u60F3\u8981\u7684\u7B54\u6848\u3002" },
          { text: "\u4E24\u679A\u706F\u5F62\u62A4\u7B26\u540C\u65F6\u4EAE\u8D77\uFF0C\u5149\u7EBF\u5728\u7A7A\u4E2D\u6E29\u67D4\u4EA4\u6C47\u3002" }
        ]
      },
      {
        id: "write_open_door",
        label: "\u201C\u5199\u2018\u968F\u65F6\u6B22\u8FCE\u56DE\u6765\u2019\uFF0C\u4F46\u8C01\u90FD\u4E0D\u5FC5\u653E\u5F03\u81EA\u5DF1\u7684\u65C5\u9014\u3002\u201D",
        mood: "bright",
        responseDialogue: [
          { speaker: "\u7075\u5DEB", mood: "calm", text: "\u95E8\u6C38\u8FDC\u53EF\u4EE5\u6253\u5F00\uFF0C\u811A\u6B65\u4E5F\u6C38\u8FDC\u53EF\u4EE5\u5411\u524D\u3002" },
          { text: "\u5979\u5728\u706F\u9762\u6DFB\u4E0A\u4E00\u6761\u901A\u5F80\u8FDC\u65B9\u3001\u53C8\u6298\u8FD4\u56DE\u6765\u7684\u7EC6\u7EBF\u3002" }
        ]
      },
      {
        id: "leave_space",
        label: "\u201C\u5148\u7559\u4E00\u9762\u7A7A\u767D\uFF0C\u4EE5\u540E\u7684\u613F\u671B\u7531\u672A\u6765\u7684\u6211\u4EEC\u8865\u5199\u3002\u201D",
        mood: "shy",
        responseDialogue: [
          { speaker: "\u7075\u5DEB", mood: "moved", text: "\u597D\u3002\u5FC3\u610F\u4E0D\u662F\u4E00\u6B21\u5199\u5B8C\u7684\u7B26\u5492\uFF0C\u800C\u662F\u957F\u4E45\u7684\u5171\u540C\u7EC3\u4E60\u3002" },
          { text: "\u5979\u628A\u7A7A\u767D\u706F\u9762\u671D\u5411\u4F60\uFF0C\u4E0E\u4F60\u4E00\u8D77\u653E\u5165\u7B2C\u4E00\u7C07\u5F52\u706F\u706B\u3002" }
        ]
      }
    ]
  },
  {
    id: "aff_shaman_07_gift",
    classId: "shaman",
    episode: 7,
    title: "\u7A7A\u767D\u4E5F\u53EF\u4EE5\u88AB\u73CD\u60DC",
    episodeLabel: "\u7B2C\u4E03\u5E55 \xB7 \u65E0\u5B57\u793C\u7EB8",
    unlockPoints: 1700,
    requiredStoryIds: ["aff_shaman_06_firstsnow"],
    completionPoints: 60,
    backgroundAsset: "assets/affection/scenes/shaman-blank-gift-paper-morning.webp",
    memoryCallbacks: [
      ...rememberedChoices("aff_shaman_03_wish", "\u7075\u5DEB", [
        ["wish_for_her", "\u4F60\u66FE\u8BA9\u6211\u5148\u5199\u81EA\u5DF1\u7684\u613F\u671B\uFF0C\u6240\u4EE5\u8FD9\u672C\u7A7A\u767D\u7EB8\u518C\u6CA1\u6709\u66FF\u6211\u51B3\u5B9A\u5185\u5BB9\u3002"],
        ["guard_each_other", "\u5B88\u62A4\u662F\u4E00\u4E2A\u5706\uFF1B\u793C\u7269\u4E5F\u8BE5\u8BA9\u8D60\u4E0E\u548C\u63A5\u53D7\u90FD\u4FDD\u7559\u9009\u62E9\u3002"],
        ["share_tomorrow", "\u90A3\u5F20\u613F\u7EB8\u7684\u4E00\u534A\u4ECD\u88AB\u597D\u597D\u4FDD\u7BA1\uFF0C\u65B0\u7684\u7EB8\u9875\u4FBF\u4ECE\u7A7A\u767D\u5F00\u59CB\u5427\u3002"]
      ])
    ],
    openingDialogue: [
      { text: "\u6E05\u6668\u7EB8\u4F5C\u95F4\u91CC\uFF0C\u4E00\u518C\u65E0\u5B57\u613F\u7EB8\u653E\u5728\u4E24\u76CF\u5C0F\u706F\u4E4B\u95F4\uFF0C\u65C1\u8FB9\u53EA\u6709\u53EF\u4EE5\u968F\u65F6\u53D6\u4E0B\u7684\u82B1\u5939\u3002" },
      { speaker: "\u7075\u5DEB", mood: "calm", text: "\u5F88\u591A\u4EBA\u9001\u613F\u7EB8\u65F6\uFF0C\u5DF2\u7ECF\u66FF\u6536\u793C\u7684\u4EBA\u5199\u597D\u4E86\u5E94\u8BE5\u8BB8\u4E0B\u4EC0\u4E48\u3002" },
      { speaker: "\u7075\u5DEB", mood: "moved", text: "\u800C\u8FD9\u4E00\u672C\u4EC0\u4E48\u90FD\u6CA1\u6709\u3002\u5B83\u8BA9\u6211\u89C9\u5F97\uFF0C\u6C89\u9ED8\u4E5F\u88AB\u5F53\u6210\u4E86\u300A\u5B8C\u6574\u7684\u7B54\u6848\u300B\u3002" }
    ],
    choices: [
      {
        id: "blank_is_complete",
        label: "\u201C\u4E0D\u5199\u4E5F\u53EF\u4EE5\u3002\u7A7A\u767D\u672C\u8EAB\u5C31\u662F\u4F60\u62E5\u6709\u7684\u9009\u62E9\u3002\u201D",
        mood: "moved",
        responseDialogue: [
          { speaker: "\u7075\u5DEB", mood: "moved", text: "\u8C22\u8C22\u4F60\u6CA1\u6709\u628A\u5B89\u9759\u5F53\u4F5C\u7B49\u5F85\u586B\u8865\u7684\u7F3A\u53E3\u3002" },
          { text: "\u5979\u8F7B\u8F7B\u7FFB\u8FC7\u7B2C\u4E00\u9875\uFF0C\u6CA1\u6709\u843D\u7B14\uFF0C\u5374\u628A\u7EB8\u518C\u73CD\u91CD\u5730\u7559\u5728\u8EAB\u8FB9\u3002" }
        ]
      },
      {
        id: "removable_flower",
        label: "\u201C\u82B1\u5939\u53EF\u4EE5\u53D6\u4E0B\uFF1B\u88C5\u9970\u4E5F\u4E0D\u8BE5\u66FF\u4F60\u56FA\u5B9A\u613F\u671B\u3002\u201D",
        mood: "bright",
        responseDialogue: [
          { speaker: "\u7075\u5DEB", mood: "bright", text: "\u53EF\u4EE5\u7559\u4E0B\uFF0C\u4E5F\u53EF\u4EE5\u6539\u53D8\u3002\u8FD9\u6837\u7684\u82B1\uFF0C\u6BD4\u6C38\u4E0D\u51CB\u8C22\u66F4\u6E29\u67D4\u3002" },
          { text: "\u5979\u5C06\u82B1\u5939\u6362\u5230\u53E6\u4E00\u9875\uFF0C\u4E5F\u628A\u9009\u62E9\u4F4D\u7F6E\u7684\u6743\u5229\u7A33\u7A33\u7559\u5728\u81EA\u5DF1\u624B\u4E2D\u3002" }
        ]
      },
      {
        id: "ask_where_to_keep",
        label: "\u201C\u5B83\u653E\u5728\u54EA\u91CC\u7531\u4F60\u51B3\u5B9A\uFF1B\u6211\u4E0D\u4F1A\u7528\u793C\u7269\u6362\u53D6\u67E5\u770B\u7684\u6743\u5229\u3002\u201D",
        mood: "shy",
        responseDialogue: [
          { speaker: "\u7075\u5DEB", mood: "moved", text: "\u88AB\u8D60\u4E88\uFF0C\u5E76\u4E0D\u7B49\u4E8E\u88AB\u8981\u6C42\u516C\u5F00\u3002\u4F60\u603B\u80FD\u542C\u89C1\u300A\u6CA1\u6709\u8BF4\u51FA\u53E3\u7684\u8FB9\u754C\u300B\u3002" },
          { text: "\u5979\u628A\u7EB8\u518C\u6536\u8FDB\u81EA\u5DF1\u7684\u62BD\u5C49\uFF0C\u53EA\u5C06\u4E00\u679A\u65E0\u5B57\u4E66\u7B7E\u7559\u5728\u8336\u5E2D\u4E0A\u3002" }
        ]
      }
    ]
  },
  {
    id: "aff_shaman_08_rest",
    classId: "shaman",
    episode: 8,
    title: "\u4ECA\u665A\u7531\u4F60\u5148\u88AB\u7167\u987E",
    episodeLabel: "\u7B2C\u516B\u5E55 \xB7 \u6708\u8336\u6B47\u706F",
    unlockPoints: 2100,
    requiredStoryIds: ["aff_shaman_07_gift"],
    completionPoints: 60,
    backgroundAsset: "assets/affection/scenes/shaman-moontea-rest-evening.webp",
    memoryCallbacks: [
      ...rememberedChoices("aff_shaman_05_storm", "\u7075\u5DEB", [
        ["carry_lantern_together", "\u66B4\u96E8\u91CC\u6211\u4EEC\u5171\u540C\u4E3E\u706F\uFF1B\u4ECA\u665A\u4E5F\u5171\u540C\u51B3\u5B9A\u4EC0\u4E48\u65F6\u5019\u628A\u706F\u7184\u4E0B\u3002"],
        ["rest_under_eaves", "\u4F60\u63D0\u9192\u6211\u6682\u505C\u4E0D\u4F1A\u8BA9\u9053\u8DEF\u6D88\u5931\uFF0C\u6240\u4EE5\u8FD9\u6B21\u6211\u613F\u610F\u5148\u5750\u4E0B\u3002"],
        ["take_guard_turn", "\u90A3\u665A\u5B88\u62A4\u56DE\u5230\u6211\u8EAB\u8FB9\uFF1B\u4ECA\u665A\u6211\u60F3\u8BA9\u7167\u987E\u4E5F\u771F\u6B63\u8F6E\u6362\u3002"]
      ])
    ],
    openingDialogue: [
      { text: "\u6708\u8272\u843D\u5728\u6709\u9876\u8336\u5ECA\uFF0C\u4E00\u76CF\u503C\u591C\u706F\u5DF2\u7ECF\u7184\u4E0B\uFF0C\u4E24\u676F\u6708\u767D\u8336\u5728\u76F8\u90BB\u5750\u57AB\u524D\u5192\u7740\u70ED\u6C14\u3002" },
      { speaker: "\u7075\u5DEB", mood: "calm", text: "\u6211\u603B\u4F1A\u5148\u95EE\u522B\u4EBA\u9700\u8981\u4EC0\u4E48\uFF0C\u5374\u5F88\u5C11\u7EC3\u4E60\u56DE\u7B54\u81EA\u5DF1\u7684\u9700\u8981\u3002" },
      { speaker: "\u7075\u5DEB", mood: "shy", text: "\u300A\u4ECA\u665A\u6211\u60F3\u5148\u4F11\u606F\u300B\u3002\u82E5\u4F60\u613F\u610F\uFF0C\u53EF\u4EE5\u966A\u6211\u628A\u8FD9\u4EF6\u5C0F\u4E8B\u8BA4\u771F\u505A\u5B8C\u3002" }
    ],
    choices: [
      {
        id: "brew_side_by_side",
        label: "\u201C\u8336\u7531\u6211\u4EEC\u4E00\u8D77\u6CE1\uFF1B\u7167\u987E\u4E0D\u5FC5\u7531\u4E00\u4E2A\u4EBA\u5305\u529E\u3002\u201D",
        mood: "bright",
        responseDialogue: [
          { speaker: "\u7075\u5DEB", mood: "bright", text: "\u4E0D\u662F\u66FF\u6211\u5B8C\u6210\uFF0C\u800C\u662F\u300A\u4E0E\u6211\u4E00\u8D77\u5B8C\u6210\u300B\u3002\u8FD9\u6837\u5F88\u597D\u3002" },
          { text: "\u5979\u5206\u51FA\u8336\u53F6\uFF0C\u4F60\u6DFB\u4E0A\u70ED\u6C34\uFF0C\u4E24\u676F\u8336\u5728\u540C\u4E00\u9635\u9999\u6C14\u91CC\u6162\u6162\u5B89\u9759\u3002" }
        ]
      },
      {
        id: "quiet_counts",
        label: "\u201C\u4E0D\u60F3\u8BF4\u8BDD\u4E5F\u53EF\u4EE5\u3002\u5B89\u9759\u966A\u4F34\u540C\u6837\u7B97\u5B8C\u6574\u7684\u56DE\u5E94\u3002\u201D",
        mood: "moved",
        responseDialogue: [
          { speaker: "\u7075\u5DEB", mood: "moved", text: "\u90A3\u4ECA\u665A\uFF0C\u6211\u628A\u6C89\u9ED8\u548C\u75B2\u5026\u90FD\u653E\u5FC3\u4EA4\u7ED9\u8FD9\u5F20\u8336\u5E2D\u3002" },
          { text: "\u5979\u9760\u56DE\u81EA\u5DF1\u7684\u5750\u57AB\uFF0C\u6708\u706F\u6CA1\u6709\u50AC\u4FC3\u4EFB\u4F55\u4E00\u53E5\u8BDD\u51FA\u73B0\u3002" }
        ]
      },
      {
        id: "care_in_turns",
        label: "\u201C\u4ECA\u665A\u6211\u63D0\u9192\u4F60\u4F11\u606F\uFF1B\u4E0B\u6B21\u7D2F\u7684\u4EBA\u4E5F\u53EF\u4EE5\u662F\u6211\u3002\u201D",
        mood: "shy",
        responseDialogue: [
          { speaker: "\u7075\u5DEB", mood: "moved", text: "\u7167\u987E\u82E5\u80FD\u8F6E\u6D41\uFF0C\u5C31\u4E0D\u4F1A\u628A\u4EFB\u4F55\u4EBA\u6C38\u8FDC\u56FA\u5B9A\u6210\u5B88\u62A4\u8005\u3002" },
          { text: "\u5979\u8BA4\u771F\u7B54\u5E94\uFF0C\u4E5F\u66FF\u4F60\u628A\u7B2C\u4E8C\u676F\u8336\u63A8\u5230\u6700\u987A\u624B\u7684\u4F4D\u7F6E\u3002" }
        ]
      }
    ]
  },
  {
    id: "aff_shaman_09_reciprocal",
    classId: "shaman",
    episode: 9,
    title: "\u60F3\u9001\u7ED9\u4F60\u7684\uFF0C\u662F\u5F52\u5904",
    episodeLabel: "\u7B2C\u4E5D\u5E55 \xB7 \u677E\u7ED3\u56DE\u793C",
    unlockPoints: 2600,
    requiredStoryIds: ["aff_shaman_08_rest"],
    completionPoints: 60,
    backgroundAsset: "assets/affection/scenes/shaman-return-charm-night.webp",
    cgAsset: "assets/affection/cg/shaman-open-knot-keepsakes.webp",
    memoryCallbacks: [
      ...rememberedChoices("aff_shaman_06_firstsnow", "\u7075\u5DEB", [
        ["write_each_names", "\u4E24\u76CF\u706F\u5404\u6709\u81EA\u5DF1\u7684\u540D\u5B57\uFF0C\u8FD9\u4E24\u679A\u62A4\u7B26\u4E5F\u5404\u81EA\u5B8C\u6574\u3002"],
        ["write_open_door", "\u95E8\u53EF\u4EE5\u6B22\u8FCE\u5F52\u6765\uFF0C\u4E5F\u5141\u8BB8\u811A\u6B65\u7EE7\u7EED\u5411\u524D\uFF1B\u62A4\u7B26\u4E0D\u4F1A\u53D8\u6210\u675F\u7F1A\u3002"],
        ["leave_space", "\u4F60\u4E3A\u672A\u6765\u7559\u4E0B\u7A7A\u767D\uFF0C\u6240\u4EE5\u6211\u7279\u610F\u6CA1\u6709\u628A\u8FD9\u679A\u677E\u7ED3\u7CFB\u6B7B\u3002"]
      ])
    ],
    openingDialogue: [
      { text: "\u6708\u591C\u5F52\u706F\u4EAD\u91CC\uFF0C\u4E24\u679A\u65E0\u5B57\u62A4\u7B26\u7531\u4E00\u6761\u53EF\u4EE5\u968F\u65F6\u89E3\u5F00\u7684\u677E\u7ED3\u76F8\u8FDE\uFF0C\u8FDC\u5904\u5C0F\u5F84\u901A\u5411\u655E\u5F00\u7684\u95E8\u3002" },
      { speaker: "\u7075\u5DEB", mood: "calm", text: "\u6211\u60F3\u9001\u4F60\u4E00\u4EF6\u56DE\u793C\u3002\u5B83\u4E0D\u53EC\u56DE\u3001\u4E0D\u8FFD\u8E2A\uFF0C\u4E5F\u4E0D\u4F1A\u66FF\u4F60\u51B3\u5B9A\u65B9\u5411\u3002" },
      { speaker: "\u7075\u5DEB", mood: "moved", text: "\u5B83\u53EA\u5728\u4F60\u300A\u60F3\u8D77\u5F52\u5904\u65F6\u4EAE\u8D77\u300B\uFF1B\u662F\u5426\u4F69\u5E26\uFF0C\u59CB\u7EC8\u7531\u4F60\u51B3\u5B9A\u3002" }
    ],
    choices: [
      {
        id: "use_when_wanted",
        label: "\u201C\u6211\u613F\u610F\u6536\u4E0B\uFF1B\u9700\u8981\u65F6\u4F69\u5E26\uFF0C\u4E0D\u9700\u8981\u65F6\u4E5F\u4F1A\u59A5\u5584\u73CD\u85CF\u3002\u201D",
        mood: "moved",
        responseDialogue: [
          { speaker: "\u7075\u5DEB", mood: "moved", text: "\u88AB\u73CD\u60DC\u4E0D\u7B49\u4E8E\u5FC5\u987B\u65F6\u523B\u4F7F\u7528\u3002\u8C22\u8C22\u4F60\u4E5F\u300A\u5C0A\u91CD\u793C\u7269\u7684\u4F11\u606F\u300B\u3002" },
          { text: "\u4E24\u679A\u62A4\u7B26\u5404\u81EA\u4EAE\u8D77\uFF0C\u53C8\u5728\u4E0D\u88AB\u89E6\u78B0\u65F6\u5B89\u9759\u5F52\u4E8E\u67D4\u5149\u3002" }
        ]
      },
      {
        id: "hang_side_by_side",
        label: "\u201C\u8BA9\u5B83\u4EEC\u5E76\u6392\u6302\u5728\u5F52\u706F\u4EAD\uFF0C\u5404\u81EA\u7167\u4EAE\u6765\u53BB\u7684\u65B9\u5411\u3002\u201D",
        mood: "bright",
        responseDialogue: [
          { speaker: "\u7075\u5DEB", mood: "bright", text: "\u4E0D\u628A\u8C01\u5E26\u56DE\u8C01\u8EAB\u8FB9\uFF0C\u53EA\u8BA9\u5F7C\u6B64\u77E5\u9053\u95E8\u4ECD\u7136\u5F00\u7740\u3002" },
          { text: "\u4E24\u679A\u62A4\u7B26\u88AB\u5206\u522B\u6302\u597D\uFF0C\u706F\u5149\u5728\u4E2D\u95F4\u5F62\u6210\u6E29\u67D4\u800C\u5F00\u653E\u7684\u901A\u8DEF\u3002" }
        ]
      },
      {
        id: "keep_knot_open",
        label: "\u201C\u4FDD\u7559\u8FD9\u4E2A\u677E\u7ED3\uFF1B\u5173\u7CFB\u957F\u4E45\uFF0C\u4E5F\u4ECD\u80FD\u91CD\u65B0\u786E\u8BA4\u4E0E\u8C03\u6574\u3002\u201D",
        mood: "shy",
        responseDialogue: [
          { speaker: "\u7075\u5DEB", mood: "calm", text: "\u613F\u671B\u4E0D\u662F\u7CFB\u5F97\u8D8A\u7D27\u8D8A\u771F\u3002\u80FD\u88AB\u91CD\u65B0\u9009\u62E9\uFF0C\u624D\u4F1A\u4E00\u76F4\u6709\u6E29\u5EA6\u3002" },
          { text: "\u5979\u6CA1\u6709\u6536\u7D27\u4E1D\u7EF3\uFF0C\u53EA\u4E0E\u4F60\u5171\u540C\u786E\u8BA4\u4E24\u7AEF\u90FD\u80FD\u81EA\u7531\u89E3\u5F00\u3002" }
        ]
      }
    ]
  }
];
var CATKIN_STORIES = [
  {
    id: "aff_catkin_01_box",
    classId: "catkin",
    episode: 1,
    title: "\u7EB8\u7BB1\u7684\u4F18\u5148\u5E2D",
    episodeLabel: "\u7B2C\u4E00\u5E55 \xB7 \u7B2C\u4E00\u526F\u961F\u957F",
    unlockPoints: 0,
    requiredStoryIds: [],
    completionPoints: 30,
    backgroundAsset: "assets/affection/scenes/catkin-box-base.webp",
    openingDialogue: [
      { text: "\u623F\u95F4\u4E2D\u592E\u591A\u4E86\u4E00\u5EA7\u7EB8\u7BB1\u636E\u70B9\uFF0C\u95E8\u53E3\u90D1\u91CD\u6446\u7740\u201C\u53EA\u5BB9\u4E00\u4EBA\u201D\u7684\u5750\u57AB\u3002" },
      { speaker: "\u55B5\u55B5", mood: "playful", text: "\u8D35\u5BBE\u5E2D\u53EA\u6709\u4E00\u4E2A\u3002\u9664\u975E\u4F60\u6709\u300A\u5F88\u6709\u8BF4\u670D\u529B\u7684\u7533\u8BF7\u300B\u3002" },
      { text: "\u5979\u62B1\u81C2\u5B88\u5728\u95E8\u8FB9\uFF0C\u795E\u60C5\u50CF\u4E00\u4F4D\u7B49\u5F85\u6B63\u5F0F\u6587\u4E66\u7684\u53EF\u9760\u961F\u957F\u3002" }
    ],
    choices: [
      {
        id: "knock_first",
        label: "\u201C\u5148\u6572\u95E8\u3002\u8BF7\u95EE\u6211\u53EF\u4EE5\u8FDB\u53BB\u5417\uFF1F\u201D",
        mood: "bright",
        responseDialogue: [
          { speaker: "\u55B5\u55B5", mood: "bright", text: "\u4F1A\u6572\u95E8\u7684\u4EBA\u52A0\u5206\uFF01" },
          { speaker: "\u55B5\u55B5", mood: "playful", text: "\u53EF\u4EE5\u8FDB\uFF0C\u4F46\u4E0D\u8BB8\u52A8\u6211\u7684\u6218\u5229\u54C1\u5730\u56FE\u3002" }
        ]
      },
      {
        id: "warm_milk",
        label: "\u201C\u6211\u5E26\u4E86\u70ED\u8393\u5976\uFF0C\u653E\u5728\u95E8\u53E3\uFF0C\u7531\u4F60\u51B3\u5B9A\u3002\u201D",
        mood: "shy",
        responseDialogue: [
          { speaker: "\u55B5\u55B5", mood: "bright", text: "\u793C\u7269\u53EF\u4EE5\u8FDB\u3002" },
          { text: "\u5979\u5411\u65C1\u8FB9\u632A\u4E86\u632A\u3002" },
          { speaker: "\u55B5\u55B5", mood: "shy", text: "\u9001\u793C\u7684\u4EBA\u2026\u2026\u4E5F\u80FD\u6324\u8FDB\u300A\u534A\u4E2A\u4F4D\u7F6E\u300B\u3002" }
        ]
      },
      {
        id: "reinforce_box",
        label: "\u201C\u6211\u5E2E\u4F60\u52A0\u56FA\u67B6\u5B50\uFF0C\u4E1C\u897F\u653E\u54EA\u90FD\u542C\u4F60\u7684\u3002\u201D",
        mood: "playful",
        responseDialogue: [
          { speaker: "\u55B5\u55B5", mood: "bright", text: "\u4F60\u8BB0\u5F97\u8FD9\u662F\u6211\u7684\u636E\u70B9\uFF0C\u4E0D\u662F\u666E\u901A\u7EB8\u7BB1\u3002\u5F88\u597D\u3002" },
          { speaker: "\u55B5\u55B5", mood: "playful", text: "\u6B63\u5F0F\u4EFB\u547D\u4F60\u4E3A\u7B2C\u4E00\u526F\u961F\u957F\uFF01" }
        ]
      }
    ]
  },
  {
    id: "aff_catkin_02_glove",
    classId: "catkin",
    episode: 2,
    title: "\u53EA\u501F\u4F60\u4E00\u4E0B\u7684\u8089\u7403",
    episodeLabel: "\u7B2C\u4E8C\u5E55 \xB7 \u642D\u6863\u96C6\u5408",
    unlockPoints: 80,
    requiredStoryIds: ["aff_catkin_01_box"],
    completionPoints: 45,
    backgroundAsset: "assets/affection/scenes/catkin-workbench-evening.webp",
    openingDialogue: [
      { text: "\u8BAD\u7EC3\u540E\uFF0C\u5979\u7684\u624B\u5957\u6263\u677E\u5F00\u4E86\uFF0C\u4E00\u53EA\u6234\u7740\u6676\u722A\u624B\u5957\u7684\u624B\u4F38\u5230\u4F60\u9762\u524D\u3002" },
      { speaker: "\u55B5\u55B5", mood: "playful", text: "\u53EA\u68C0\u67E5\u624B\u5957\uFF0C\u300A\u4E0D\u8BB8\u987A\u624B\u6478\u8033\u6735\u300B\u3002\u5148\u8BF4\u597D\uFF01" }
    ],
    choices: [
      {
        id: "ask_buckle",
        label: "\u201C\u6211\u53EF\u4EE5\u78B0\u624B\u5957\u6263\u5417\uFF1F\u4F60\u70B9\u5934\u6211\u518D\u52A8\u3002\u201D",
        mood: "shy",
        responseDialogue: [
          { text: "\u5979\u8BA4\u771F\u70B9\u5934\uFF0C\u628A\u624B\u653E\u7A33\u3002" },
          { speaker: "\u55B5\u55B5", mood: "shy", text: "\u4E09\u79D2\u949F\u3002\u2026\u2026\u4F60\u7684\u624B\u600E\u4E48\u6BD4\u6676\u722A\u8FD8\u51C9\u3002" }
        ]
      },
      {
        id: "hold_light",
        label: "\u201C\u4FEE\u7406\u5E26\u7ED9\u4F60\uFF0C\u4F60\u81EA\u5DF1\u6765\uFF0C\u6211\u66FF\u4F60\u7167\u660E\u3002\u201D",
        mood: "moved",
        responseDialogue: [
          { speaker: "\u55B5\u55B5", mood: "playful", text: "\u5C0A\u91CD\u4E13\u4E1A\u732B\u722A\uFF0C\u5224\u65AD\u6B63\u786E\u3002" },
          { speaker: "\u55B5\u55B5", mood: "shy", text: "\u4E0D\u8FC7\u4F60\u8981\u7559\u5728\u8FD9\u91CC\uFF0C\u300A\u4E0D\u8BB8\u628A\u5149\u62FF\u8D70\u300B\u3002" }
        ]
      },
      {
        id: "glove_highfive",
        label: "\u201C\u9694\u7740\u624B\u5957\u51FB\u4E2A\u638C\uFF0C\u4FEE\u597D\u5C31\u5F53\u5E86\u795D\u3002\u201D",
        mood: "bright",
        responseDialogue: [
          { text: "\u6E05\u8106\u4E00\u58F0\uFF0C\u84DD\u8272\u5C0F\u706B\u82B1\u4ECE\u638C\u5FC3\u8DF3\u5F00\u3002" },
          { speaker: "\u55B5\u55B5", mood: "bright", text: "\u8FD9\u4E2A\u58F0\u97F3\u4EE5\u540E\u5C31\u4EE3\u8868\u201C\u642D\u6863\u96C6\u5408\u201D\uFF01" }
        ]
      }
    ]
  },
  {
    id: "aff_catkin_03_rooftop",
    classId: "catkin",
    episode: 3,
    title: "\u5C4B\u9876\u4E0A\u6293\u4F4F\u7684\u6708\u4EAE",
    episodeLabel: "\u7B2C\u4E09\u5E55 \xB7 \u6708\u4E0B\u5EA7\u4F4D",
    unlockPoints: 240,
    requiredStoryIds: ["aff_catkin_02_glove"],
    completionPoints: 60,
    backgroundAsset: "assets/affection/scenes/catkin-rooftop-moon.webp",
    cgAsset: "assets/affection/cg/catkin-paw-highfive.webp",
    memoryCallbacks: [
      {
        fromStoryId: "aff_catkin_02_glove",
        choiceId: "ask_buckle",
        dialogue: [{ speaker: "\u55B5\u55B5", text: "\u624B\u5957\u6263\u5F88\u7262\u3002\u4F60\u4E0A\u6B21\u4FEE\u5F97\u2026\u2026\u52C9\u5F3A\u6709\u4E13\u4E1A\u6C34\u51C6\u3002" }]
      },
      {
        fromStoryId: "aff_catkin_02_glove",
        choiceId: "hold_light",
        dialogue: [{ speaker: "\u55B5\u55B5", text: "\u4ECA\u665A\u4E0D\u7528\u66FF\u6211\u7167\u660E\uFF0C\u5750\u5728\u65C1\u8FB9\u5C31\u591F\u4EAE\u4E86\u3002" }]
      },
      {
        fromStoryId: "aff_catkin_02_glove",
        choiceId: "glove_highfive",
        dialogue: [{ speaker: "\u55B5\u55B5", text: "\u542C\u89C1\u96C6\u5408\u6697\u53F7\u4E86\u5417\uFF1F\u8FD9\u6B21\u662F\u5C4B\u9876\u7279\u522B\u884C\u52A8\u3002" }]
      }
    ],
    openingDialogue: [
      { text: "\u5979\u5750\u5728\u5C4B\u9876\u8FB9\u7F18\uFF0C\u5C3E\u5DF4\u89C4\u89C4\u77E9\u77E9\u76D8\u5728\u81EA\u5DF1\u8EAB\u4FA7\u3002" },
      { speaker: "\u55B5\u55B5", mood: "playful", text: "\u6708\u4EAE\u8FFD\u4E86\u6211\u534A\u665A\u3002\u4E0D\u8FC7\u6211\u77E5\u9053\uFF0C\u300A\u4F60\u5176\u5B9E\u662F\u6765\u627E\u6211\u7684\u300B\u3002" }
    ],
    choices: [
      {
        id: "wait_invite",
        label: "\u201C\u6211\u5750\u8FDC\u4E00\u70B9\u3002\u60F3\u8BA9\u6211\u9760\u8FD1\u65F6\uFF0C\u4F60\u518D\u53EB\u6211\u3002\u201D",
        mood: "moved",
        responseDialogue: [
          { text: "\u5979\u7684\u5C3E\u5C16\u5728\u4E24\u4EBA\u4E4B\u95F4\u8F7B\u8F7B\u6572\u4E86\u4E00\u4E0B\u74E6\u7247\u3002" },
          { speaker: "\u55B5\u55B5", mood: "shy", text: "\u8FD9\u662F\u53EC\u96C6\u4FE1\u53F7\uFF0C\u300A\u53EF\u4E0D\u662F\u4E0D\u5C0F\u5FC3\u300B\u3002" }
        ]
      },
      {
        id: "share_candy",
        label: "\u201C\u6218\u5229\u54C1\u7CD6\u4E00\u4EBA\u4E00\u534A\uFF0C\u4F60\u5148\u6311\u3002\u201D",
        mood: "bright",
        responseDialogue: [
          { speaker: "\u55B5\u55B5", mood: "shy", text: "\u660E\u660E\u4E24\u5757\u4E00\u6837\u5927\u2026\u2026" },
          { text: "\u5979\u628A\u5176\u4E2D\u4E00\u5757\u63A8\u7ED9\u4F60\u3002" },
          { speaker: "\u55B5\u55B5", mood: "playful", text: "\u6211\u91CF\u8FC7\u4E86\uFF0C\u771F\u7684\u4E00\u6837\u5927\u3002" }
        ]
      },
      {
        id: "came_for_her",
        label: "\u201C\u6211\u662F\u6765\u627E\u4F60\u7684\uFF0C\u6708\u4EAE\u53EA\u662F\u987A\u4FBF\u3002\u201D",
        mood: "shy",
        responseDialogue: [
          { text: "\u5979\u7684\u5C3E\u5DF4\u4E00\u4E0B\u626C\u8D77\uFF0C\u53C8\u7ACB\u523B\u538B\u56DE\u8EAB\u8FB9\u3002" },
          { speaker: "\u55B5\u55B5", mood: "shy", text: "\u518D\u8BF4\u4E00\u6B21\u3002\u521A\u624D\u6211\u5728\u770B\u6708\u4EAE\uFF0C\u6CA1\u542C\u6E05\u3002" }
        ]
      }
    ]
  },
  {
    id: "aff_catkin_04_expansion",
    classId: "catkin",
    episode: 4,
    title: "\u4E24\u628A\u5E73\u7B49\u7684\u94A5\u5319",
    episodeLabel: "\u7B2C\u56DB\u5E55 \xB7 \u636E\u70B9\u6269\u5EFA",
    unlockPoints: 520,
    requiredStoryIds: ["aff_catkin_03_rooftop"],
    completionPoints: 60,
    backgroundAsset: "assets/affection/scenes/catkin-base-expansion-day.webp",
    memoryCallbacks: [
      ...rememberedChoices("aff_catkin_01_box", "\u55B5\u55B5", [
        ["knock_first", "\u4F60\u7B2C\u4E00\u6B21\u8FDB\u636E\u70B9\u4F1A\u8BA4\u771F\u6572\u95E8\uFF0C\u6240\u4EE5\u65B0\u533A\u57DF\u4E5F\u53EF\u4EE5\u653E\u5FC3\u7ED9\u4F60\u5E73\u7B49\u94A5\u5319\u3002"],
        ["warm_milk", "\u90A3\u676F\u8393\u5976\u6362\u5230\u7684\u534A\u4E2A\u4F4D\u7F6E\uFF0C\u65E9\u5C31\u6269\u5EFA\u6210\u526F\u961F\u957F\u4E13\u5E2D\u4E86\u3002"],
        ["reinforce_box", "\u4F60\u5C0A\u91CD\u6211\u7684\u636E\u70B9\u89C4\u5212\uFF0C\u6240\u4EE5\u6269\u5EFA\u89C4\u5219\u4E5F\u8981\u542C\u542C\u4F60\u7684\u4E13\u4E1A\u610F\u89C1\u3002"]
      ]),
      ...rememberedChoices("aff_catkin_03_rooftop", "\u55B5\u55B5", [
        ["wait_invite", "\u5C4B\u9876\u4E0A\u4F60\u7B49\u6211\u53D1\u51FA\u9080\u8BF7\uFF0C\u6240\u4EE5\u65B0\u636E\u70B9\u7684\u94A5\u5319\u4E5F\u7531\u6211\u6B63\u5F0F\u4EA4\u7ED9\u4F60\u3002"],
        ["share_candy", "\u6218\u5229\u54C1\u7CD6\u80FD\u516C\u5E73\u5206\uFF0C\u65B0\u636E\u70B9\u7684\u6743\u9650\u5F53\u7136\u4E5F\u80FD\u4E00\u4EBA\u4E00\u534A\u3002"],
        ["came_for_her", "\u4F60\u8BF4\u90A3\u665A\u662F\u6765\u627E\u6211\u7684\u2026\u2026\u6240\u4EE5\u6211\u60F3\u7ED9\u4F60\u4E00\u628A\u968F\u65F6\u80FD\u6765\u627E\u6211\u7684\u94A5\u5319\u3002"]
      ])
    ],
    openingDialogue: [
      { text: "\u767D\u5929\u7684\u636E\u70B9\u6269\u5EFA\u521A\u7ED3\u675F\uFF0C\u4E24\u628A\u9020\u578B\u76F8\u540C\u7684\u94A5\u5319\u5E76\u6392\u653E\u5728\u65B0\u95E8\u524D\u3002" },
      { speaker: "\u55B5\u55B5", mood: "bright", text: "\u4E0D\u662F\u5907\u7528\u94A5\u5319\uFF0C\u4E5F\u4E0D\u662F\u8C01\u66FF\u8C01\u4FDD\u7BA1\u3002\u300A\u4E24\u628A\u6743\u9650\u5B8C\u5168\u4E00\u6837\u300B\u3002" },
      { speaker: "\u55B5\u55B5", mood: "moved", text: "\u65B0\u533A\u57DF\u7684\u7B2C\u4E00\u6761\u4F7F\u7528\u89C4\u5219\uFF0C\u6211\u4EEC\u4E00\u8D77\u5B9A\u3002" }
    ],
    choices: [
      {
        id: "equal_door_rights",
        label: "\u201C\u8C01\u5148\u56DE\u6765\u8C01\u5F00\u95E8\uFF0C\u4E0D\u9700\u8981\u5411\u53E6\u4E00\u4F4D\u7533\u8BF7\u3002\u201D",
        mood: "moved",
        responseDialogue: [
          { speaker: "\u55B5\u55B5", mood: "bright", text: "\u901A\u8FC7\uFF01\u5E73\u7B49\u94A5\u5319\u5C31\u8BE5\u6709\u5E73\u7B49\u7684\u5F00\u95E8\u6743\u3002" },
          { text: "\u5979\u628A\u5176\u4E2D\u4E00\u628A\u63A8\u7ED9\u4F60\uFF0C\u81EA\u5DF1\u62FF\u8D77\u53E6\u4E00\u628A\u540C\u65F6\u8BD5\u9501\u3002" }
        ]
      },
      {
        id: "respect_work_zones",
        label: "\u201C\u5404\u81EA\u7684\u5DE5\u4F5C\u533A\u5148\u6572\u95E8\uFF0C\u5171\u4EAB\u533A\u968F\u65F6\u6B22\u8FCE\u3002\u201D",
        mood: "shy",
        responseDialogue: [
          { speaker: "\u55B5\u55B5", mood: "playful", text: "\u8FB9\u754C\u660E\u786E\uFF0C\u96C6\u5408\u65B9\u4FBF\u3002\u526F\u961F\u957F\u63D0\u6848\u300A\u975E\u5E38\u4E13\u4E1A\u300B\uFF01" },
          { text: "\u5979\u5728\u5E73\u9762\u56FE\u4E0A\u5708\u51FA\u4E24\u4E2A\u72EC\u7ACB\u89D2\u843D\uFF0C\u4E5F\u753B\u51FA\u5BBD\u655E\u7684\u5171\u540C\u684C\u9762\u3002" }
        ]
      },
      {
        id: "renegotiate_rules",
        label: "\u201C\u82E5\u89C4\u5219\u4E0D\u5408\u9002\uFF0C\u4EFB\u4F55\u4E00\u65B9\u90FD\u80FD\u63D0\u51FA\u91CD\u8C08\u3002\u201D",
        mood: "bright",
        responseDialogue: [
          { speaker: "\u55B5\u55B5", mood: "bright", text: "\u6279\u51C6\u3002\u642D\u6863\u534F\u8BAE\u5F53\u7136\u8981\u80FD\u5347\u7EA7\uFF0C\u4E0D\u80FD\u628A\u8C01\u56F0\u4F4F\u3002" },
          { text: "\u5979\u5C06\u4E24\u628A\u94A5\u5319\u518D\u6B21\u5E76\u6392\u653E\u597D\uFF0C\u8BA4\u771F\u4E0E\u4F60\u786E\u8BA4\u8FD9\u9879\u89C4\u5219\u3002" }
        ]
      }
    ]
  },
  {
    id: "aff_catkin_05_rainwatch",
    classId: "catkin",
    episode: 5,
    title: "\u961F\u957F\u4E5F\u53EF\u4EE5\u8BF4\u7D2F",
    episodeLabel: "\u7B2C\u4E94\u5E55 \xB7 \u96E8\u591C\u8F6E\u503C",
    unlockPoints: 900,
    requiredStoryIds: ["aff_catkin_04_expansion"],
    completionPoints: 60,
    backgroundAsset: "assets/affection/scenes/catkin-rainy-workshop-night.webp",
    memoryCallbacks: [
      ...rememberedChoices("aff_catkin_02_glove", "\u55B5\u55B5", [
        ["ask_buckle", "\u4F60\u4F1A\u5148\u95EE\u8FC7\u624D\u78B0\u88C5\u5907\uFF0C\u6240\u4EE5\u96E8\u591C\u91CC\u6211\u4E5F\u80FD\u653E\u5FC3\u8BF7\u4F60\u786E\u8BA4\u5DE5\u5177\u5B89\u5168\u3002"],
        ["hold_light", "\u4F60\u66FF\u6211\u7167\u8FC7\u706F\u5374\u628A\u4FEE\u7406\u6743\u7559\u7ED9\u6211\uFF0C\u8FD9\u624D\u662F\u4F18\u79C0\u642D\u6863\u7684\u914D\u5408\u3002"],
        ["glove_highfive", "\u642D\u6863\u96C6\u5408\u6697\u53F7\u4ECD\u7136\u6709\u6548\uFF0C\u5F00\u5DE5\u548C\u6536\u5DE5\u90FD\u8981\u51FB\u638C\u786E\u8BA4\uFF01"]
      ]),
      ...rememberedChoices("aff_catkin_04_expansion", "\u55B5\u55B5", [
        ["equal_door_rights", "\u4E24\u628A\u94A5\u5319\u6743\u9650\u76F8\u540C\uFF0C\u6240\u4EE5\u7D2F\u7684\u65F6\u5019\u4E5F\u6709\u540C\u6837\u7684\u4F11\u606F\u6743\u3002"],
        ["respect_work_zones", "\u4F60\u66FF\u72EC\u7ACB\u5DE5\u4F5C\u533A\u4FDD\u7559\u8FB9\u754C\uFF0C\u6240\u4EE5\u6211\u53EF\u4EE5\u653E\u5FC3\u8BF4\u73B0\u5728\u60F3\u5B89\u9759\u4E00\u4F1A\u513F\u3002"],
        ["renegotiate_rules", "\u89C4\u5219\u53EF\u4EE5\u91CD\u8C08\u2014\u2014\u90A3\u6211\u73B0\u5728\u6B63\u5F0F\u63D0\u51FA\uFF1A\u4ECA\u665A\u6682\u505C\u961F\u957F\u503C\u73ED\u3002"]
      ])
    ],
    openingDialogue: [
      { text: "\u96E8\u591C\u7684\u5DE5\u4F5C\u95F4\u91CC\uFF0C\u4FEE\u7406\u5DE5\u5177\u5DF2\u7ECF\u6536\u597D\uFF0C\u5979\u5374\u8FD8\u5B88\u7740\u7184\u6697\u4E00\u534A\u7684\u53F0\u706F\u3002" },
      { speaker: "\u55B5\u55B5", mood: "calm", text: "\u961F\u957F\u4ECA\u5929\u5224\u65AD\u5931\u8BEF\uFF1A\u660E\u660E\u5F88\u7D2F\uFF0C\u8FD8\u5B89\u6392\u4E86\u989D\u5916\u68C0\u4FEE\u3002" },
      { speaker: "\u55B5\u55B5", mood: "shy", text: "\u6211\u4E0D\u9700\u8981\u547D\u4EE4\uFF0C\u53EA\u60F3\u542C\u642D\u6863\u63D0\u51FA\u4E00\u4E2A\u300A\u5E73\u7B49\u7684\u4F11\u606F\u65B9\u6848\u300B\u3002" }
    ],
    choices: [
      {
        id: "two_work_desks",
        label: "\u201C\u4ECA\u665A\u4E00\u8D77\u6536\u5DE5\uFF0C\u5269\u4E0B\u7684\u5DE5\u4F5C\u660E\u5929\u5E73\u5206\u3002\u201D",
        mood: "moved",
        responseDialogue: [
          { speaker: "\u55B5\u55B5", mood: "moved", text: "\u4E0D\u662F\u66FF\u6211\u5305\u529E\uFF0C\u662F\u300A\u628A\u660E\u5929\u4E5F\u4E00\u8D77\u5206\u62C5\u300B\u3002\u6279\u51C6\u3002" },
          { text: "\u5979\u5173\u6389\u5269\u4E0B\u7684\u53F0\u706F\uFF0C\u4E0E\u4F60\u4E00\u8D77\u786E\u8BA4\u5DE5\u5177\u90FD\u5B89\u5168\u5F52\u4F4D\u3002" }
        ]
      },
      {
        id: "quiet_corner",
        label: "\u201C\u4F60\u53EF\u4EE5\u53BB\u5B89\u9759\u89D2\u843D\u4F11\u606F\uFF0C\u6211\u5728\u5171\u4EAB\u533A\u5904\u7406\u81EA\u5DF1\u7684\u4E8B\u3002\u201D",
        mood: "calm",
        responseDialogue: [
          { speaker: "\u55B5\u55B5", mood: "moved", text: "\u4E0D\u8FFD\u95EE\u3001\u4E0D\u56F4\u89C2\uFF0C\u4E5F\u4E0D\u628A\u72EC\u5904\u5F53\u6210\u751F\u6C14\u3002\u4F18\u79C0\u642D\u6863\u3002" },
          { text: "\u5979\u5E26\u7740\u81EA\u5DF1\u7684\u94A5\u5319\u8D70\u5411\u5B89\u9759\u89D2\u843D\uFF0C\u56DE\u5934\u5411\u4F60\u6BD4\u4E86\u4E2A\u5B89\u5FC3\u624B\u52BF\u3002" }
        ]
      },
      {
        id: "rain_window_seat",
        label: "\u201C\u53BB\u7A97\u8FB9\u542C\u96E8\u5427\u3002\u60F3\u804A\u5929\u5C31\u804A\uFF0C\u4E0D\u60F3\u8BF4\u8BDD\u4E5F\u53EF\u4EE5\u3002\u201D",
        mood: "shy",
        responseDialogue: [
          { speaker: "\u55B5\u55B5", mood: "shy", text: "\u961F\u957F\u7533\u8BF7\u4E00\u4EFD\u4E0D\u9700\u8981\u6D3B\u8DC3\u6C14\u6C1B\u7684\u966A\u4F34\u3002" },
          { text: "\u5979\u4E0E\u4F60\u5404\u5750\u957F\u6905\u4E00\u4FA7\uFF0C\u96E8\u58F0\u628A\u5DE5\u4F5C\u95F4\u53D8\u6210\u5B89\u9759\u7684\u4F11\u606F\u7AD9\u3002" }
        ]
      }
    ]
  },
  {
    id: "aff_catkin_06_departure",
    classId: "catkin",
    episode: 6,
    title: "\u4E0B\u4E00\u6B21\u4E5F\u5E76\u80A9\u51FA\u53D1",
    episodeLabel: "\u7B2C\u516D\u5E55 \xB7 \u6668\u5149\u7AD9\u53F0",
    unlockPoints: 1400,
    requiredStoryIds: ["aff_catkin_05_rainwatch"],
    completionPoints: 60,
    backgroundAsset: "assets/affection/scenes/catkin-sunrise-departure-platform.webp",
    cgAsset: "assets/affection/cg/catkin-partner-badges.webp",
    memoryCallbacks: [
      ...rememberedChoices("aff_catkin_03_rooftop", "\u55B5\u55B5", [
        ["wait_invite", "\u4F60\u4ECE\u4E0D\u64C5\u81EA\u9760\u8FD1\uFF0C\u800C\u6211\u73B0\u5728\u4F1A\u4E3B\u52A8\u5411\u4F60\u53D1\u51FA\u5E76\u80A9\u9080\u8BF7\u3002"],
        ["share_candy", "\u8FDE\u6218\u5229\u54C1\u7CD6\u90FD\u516C\u5E73\u5206\u8FC7\uFF0C\u6211\u4EEC\u5F53\u7136\u80FD\u5E73\u7B49\u51B3\u5B9A\u66F4\u5927\u7684\u4E8B\u60C5\u3002"],
        ["came_for_her", "\u4F60\u6765\u627E\u7684\u662F\u6211\uFF1B\u800C\u6211\u6BCF\u6B21\u96C6\u5408\u7B2C\u4E00\u4E2A\u60F3\u627E\u7684\u4E5F\u662F\u4F60\u3002"]
      ]),
      ...rememberedChoices("aff_catkin_04_expansion", "\u55B5\u55B5", [
        ["equal_door_rights", "\u4E24\u628A\u94A5\u5319\u6743\u9650\u5E73\u7B49\uFF0C\u4E24\u679A\u542F\u7A0B\u5FBD\u7AE0\u5F53\u7136\u4E5F\u5C5E\u4E8E\u5E73\u7B49\u642D\u6863\u3002"],
        ["respect_work_zones", "\u72EC\u7ACB\u5DE5\u4F5C\u533A\u7684\u8FB9\u754C\u4E00\u76F4\u6709\u6548\uFF0C\u8FDC\u884C\u4E5F\u4E0D\u9700\u8981\u653E\u5F03\u81EA\u5DF1\u7684\u65B9\u5411\u3002"],
        ["renegotiate_rules", "\u89C4\u5219\u968F\u65F6\u53EF\u4EE5\u91CD\u8C08\uFF0C\u6240\u4EE5\u6BCF\u4E00\u6B21\u51FA\u53D1\u90FD\u7531\u73B0\u5728\u7684\u6211\u4EEC\u91CD\u65B0\u786E\u8BA4\u3002"]
      ]),
      ...rememberedChoices("aff_catkin_05_rainwatch", "\u55B5\u55B5", [
        ["two_work_desks", "\u96E8\u591C\u6211\u4EEC\u5171\u540C\u6536\u5DE5\uFF0C\u4ECA\u5929\u4E5F\u8981\u4E00\u8D77\u51B3\u5B9A\u51FA\u53D1\uFF0C\u800C\u4E0D\u662F\u8C01\u50AC\u4FC3\u8C01\u3002"],
        ["quiet_corner", "\u4F60\u5C0A\u91CD\u6211\u72EC\u5904\u4F11\u606F\uFF0C\u6240\u4EE5\u8FDC\u884C\u65F6\u6211\u4EEC\u4E5F\u80FD\u4FDD\u7559\u5404\u81EA\u7684\u8282\u594F\u3002"],
        ["rain_window_seat", "\u90A3\u573A\u96E8\u91CC\u6211\u4EEC\u53EF\u4EE5\u5B89\u9759\u540C\u5750\uFF0C\u8FD9\u6B21\u4E5F\u53EF\u4EE5\u5B89\u9759\u5E76\u80A9\u7B49\u8F66\u3002"]
      ])
    ],
    openingDialogue: [
      { text: "\u6668\u5149\u94FA\u4E0A\u542F\u7A0B\u7AD9\u53F0\uFF0C\u4E24\u679A\u642D\u6863\u5FBD\u7AE0\u653E\u5728\u5E76\u6392\u7684\u884C\u56CA\u4E4B\u95F4\uFF0C\u8FDC\u5904\u5217\u8F66\u5373\u5C06\u5230\u7AD9\u3002" },
      { speaker: "\u55B5\u55B5", mood: "bright", text: "\u8FD9\u6B21\u4E0D\u662F\u961F\u957F\u5E26\u526F\u961F\u957F\u51FA\u53D1\uFF0C\u662F\u300A\u4E24\u4F4D\u642D\u6863\u300B\u5171\u540C\u9009\u62E9\u4E0B\u4E00\u7AD9\u3002" },
      { speaker: "\u55B5\u55B5", mood: "calm", text: "\u65E0\u8BBA\u7B54\u6848\u662F\u54EA\u6761\u8DEF\u7EBF\uFF0C\u6211\u4EEC\u90FD\u4FDD\u7559\u8BF4\u7D2F\u3001\u6682\u505C\u548C\u6539\u9053\u7684\u6743\u5229\u3002" }
    ],
    choices: [
      {
        id: "renew_by_choice",
        label: "\u201C\u6BCF\u6B21\u51FA\u53D1\u90FD\u91CD\u65B0\u786E\u8BA4\u613F\u610F\u540C\u884C\uFF0C\u4E0D\u628A\u966A\u4F34\u5F53\u6210\u7406\u6240\u5F53\u7136\u3002\u201D",
        mood: "moved",
        responseDialogue: [
          { speaker: "\u55B5\u55B5", mood: "moved", text: "\u901A\u8FC7\uFF01\u4E0B\u4E00\u6B21\u3001\u4E0B\u4E0B\u6B21\uFF0C\u4E5F\u90FD\u8981\u542C\u89C1\u5F7C\u6B64\u300A\u4EB2\u53E3\u8BF4\u613F\u610F\u300B\u3002" },
          { text: "\u5979\u62FF\u8D77\u81EA\u5DF1\u7684\u5FBD\u7AE0\uFF0C\u4E0E\u4F60\u540C\u65F6\u522B\u5728\u5404\u81EA\u884C\u56CA\u4E0A\u3002" }
        ]
      },
      {
        id: "equal_captains",
        label: "\u201C\u8DEF\u7EBF\u4E00\u4EBA\u63D0\u6848\u3001\u4E00\u8D77\u786E\u8BA4\uFF0C\u4EFB\u4F55\u65F6\u5019\u90FD\u80FD\u6539\u9053\u3002\u201D",
        mood: "bright",
        responseDialogue: [
          { speaker: "\u55B5\u55B5", mood: "playful", text: "\u5E76\u5217\u9886\u822A\u5458\u5236\u5EA6\u6210\u7ACB\uFF01\u7B2C\u4E00\u7AD9\u7531\u6211\u63D0\u6848\uFF0C\u4F60\u8D1F\u8D23\u5BA1\u6838\u3002" },
          { text: "\u5979\u5C06\u8DEF\u7EBF\u56FE\u653E\u5728\u4E24\u4EBA\u4E2D\u95F4\uFF0C\u6CA1\u6709\u66FF\u4F60\u5708\u5B9A\u4EFB\u4F55\u7EC8\u70B9\u3002" }
        ]
      },
      {
        id: "keep_own_dreams",
        label: "\u201C\u5E76\u80A9\u51FA\u53D1\uFF0C\u4E5F\u5141\u8BB8\u5404\u81EA\u63A2\u7D22\uFF0C\u60F3\u4F1A\u5408\u65F6\u5C31\u7528\u96C6\u5408\u6697\u53F7\u3002\u201D",
        mood: "shy",
        responseDialogue: [
          { speaker: "\u55B5\u55B5", mood: "bright", text: "\u8FD9\u624D\u662F\u6700\u5389\u5BB3\u7684\u642D\u6863\uFF1A\u5404\u81EA\u770B\u4E16\u754C\uFF0C\u4E5F\u603B\u80FD\u8BA4\u51FA\u96C6\u5408\u4FE1\u53F7\u3002" },
          { text: "\u5979\u4E0E\u4F60\u78B0\u4E86\u78B0\u5FBD\u7AE0\uFF0C\u6E05\u8106\u58F0\u54CD\u4E0E\u8FDB\u7AD9\u94C3\u4E00\u540C\u54CD\u8D77\u3002" }
        ]
      }
    ]
  },
  {
    id: "aff_catkin_07_gift",
    classId: "catkin",
    episode: 7,
    title: "\u793C\u7269\u8981\u5148\u8FC7\u642D\u6863\u9A8C\u6536",
    episodeLabel: "\u7B2C\u4E03\u5E55 \xB7 \u8FDC\u5F81\u6536\u7EB3\u5323",
    unlockPoints: 1700,
    requiredStoryIds: ["aff_catkin_06_departure"],
    completionPoints: 60,
    backgroundAsset: "assets/affection/scenes/catkin-gift-inspection-workshop.webp",
    memoryCallbacks: [
      ...rememberedChoices("aff_catkin_04_expansion", "\u55B5\u55B5", [
        ["equal_door_rights", "\u4E24\u628A\u94A5\u5319\u6743\u9650\u5E73\u7B49\uFF0C\u6240\u4EE5\u793C\u7269\u9A8C\u6536\u5F53\u7136\u4E5F\u4E0D\u662F\u5355\u65B9\u9762\u7A81\u88AD\u3002"],
        ["respect_work_zones", "\u4F60\u4E00\u76F4\u5C0A\u91CD\u72EC\u7ACB\u5DE5\u4F5C\u533A\uFF0C\u8FD9\u53EA\u6536\u7EB3\u5323\u4E5F\u4E0D\u4F1A\u64C5\u81EA\u5408\u5E76\u79C1\u4EBA\u7A7A\u95F4\u3002"],
        ["renegotiate_rules", "\u636E\u70B9\u89C4\u5219\u53EF\u4EE5\u91CD\u8C08\uFF0C\u793C\u7269\u7684\u7528\u9014\u548C\u6743\u9650\u5F53\u7136\u4E5F\u968F\u65F6\u80FD\u6539\u3002"]
      ])
    ],
    openingDialogue: [
      { text: "\u767D\u663C\u5DE5\u574A\u91CC\uFF0C\u4E00\u53EA\u73CA\u745A\u7C89\u4E0E\u6E56\u84DD\u6A21\u5757\u5316\u8FDC\u5F81\u5323\u505C\u5728\u68C0\u6D4B\u53F0\u4E0A\uFF0C\u6240\u6709\u6807\u7B7E\u724C\u90FD\u4FDD\u6301\u7A7A\u767D\u3002" },
      { speaker: "\u55B5\u55B5", mood: "playful", text: "\u9632\u6C34\u3001\u53EF\u62C6\u3001\u6297\u51B2\u51FB\u3002\u5916\u89C2\u5206\u5148\u62FF\u9AD8\u5206\uFF0C\u6743\u9650\u8BBE\u8BA1\u8FD8\u9700\u8981\u642D\u6863\u9A8C\u6536\u3002" },
      { speaker: "\u55B5\u55B5", mood: "bright", text: "\u5148\u8BF4\u660E\uFF1A\u6536\u5230\u793C\u7269\u7684\u4EBA\u62E5\u6709\u6700\u7EC8\u5206\u7C7B\u6743\uFF0C\u4E5F\u6709\u4E0D\u5171\u4EAB\u5185\u5BB9\u7684\u6743\u5229\u3002" }
    ],
    choices: [
      {
        id: "owner_sets_labels",
        label: "\u201C\u6807\u7B7E\u7531\u4F60\u586B\u5199\uFF1B\u9001\u793C\u7684\u4EBA\u4E0D\u66FF\u4F60\u5B9A\u4E49\u91CC\u9762\u8BE5\u653E\u4EC0\u4E48\u3002\u201D",
        mood: "moved",
        responseDialogue: [
          { speaker: "\u55B5\u55B5", mood: "bright", text: "\u51C6\u786E\uFF01\u7A7A\u767D\u6807\u7B7E\u4E0D\u662F\u6F0F\u505A\uFF0C\u662F\u300A\u6700\u9AD8\u7EA7\u7684\u6743\u9650\u8BBE\u8BA1\u300B\u3002" },
          { text: "\u5979\u628A\u6807\u7B7E\u7247\u9010\u4E00\u6536\u597D\uFF0C\u53EA\u5728\u81EA\u5DF1\u9009\u4E2D\u7684\u4F4D\u7F6E\u88C5\u4E0A\u4E00\u679A\u84DD\u8272\u8BC6\u522B\u6263\u3002" }
        ]
      },
      {
        id: "inspection_invite",
        label: "\u201C\u62C6\u89E3\u68C0\u67E5\u7531\u4F60\u4E3B\u6301\uFF1B\u9700\u8981\u534F\u52A9\u65F6\u518D\u5411\u6211\u53D1\u51FA\u642D\u6863\u9080\u8BF7\u3002\u201D",
        mood: "bright",
        responseDialogue: [
          { speaker: "\u55B5\u55B5", mood: "playful", text: "\u4E0D\u62A2\u5DE5\u5177\u3001\u4E0D\u7A81\u7136\u63A5\u7BA1\u3002\u526F\u961F\u957F\u4E13\u4E1A\u7B49\u7EA7\u63D0\u5347\u3002" },
          { text: "\u5979\u6253\u5F00\u68C0\u6D4B\u706F\uFF0C\u4E3B\u52A8\u628A\u5176\u4E2D\u4E00\u9879\u8010\u538B\u6D4B\u8BD5\u5206\u914D\u7ED9\u4F60\u3002" }
        ]
      },
      {
        id: "privacy_compartments",
        label: "\u201C\u5171\u4EAB\u5DE5\u5177\u683C\u4E0E\u79C1\u4EBA\u6536\u7EB3\u683C\u5206\u5F00\uFF0C\u8C01\u90FD\u4E0D\u9ED8\u8BA4\u62E5\u6709\u67E5\u770B\u6743\u3002\u201D",
        mood: "shy",
        responseDialogue: [
          { speaker: "\u55B5\u55B5", mood: "moved", text: "\u642D\u6863\u53EF\u4EE5\u5171\u4EAB\u4EFB\u52A1\uFF0C\u300A\u4E0D\u4EE3\u8868\u8981\u4E0A\u4EA4\u5168\u90E8\u79C1\u4EBA\u7269\u8D44\u300B\u3002\u6279\u51C6\u3002" },
          { text: "\u5979\u88C5\u597D\u4E24\u79CD\u4E0D\u540C\u9501\u6263\uFF0C\u53C8\u628A\u5171\u4EAB\u683C\u7684\u53CC\u63A7\u5F00\u5173\u653E\u5728\u6B63\u4E2D\u592E\u3002" }
        ]
      }
    ]
  },
  {
    id: "aff_catkin_08_sentimental",
    classId: "catkin",
    episode: 8,
    title: "\u559C\u6B22\u4E0D\u662F\u7269\u8D44\u7F16\u53F7",
    episodeLabel: "\u7B2C\u516B\u5E55 \xB7 \u79C1\u85CF\u5C55\u793A\u683C",
    unlockPoints: 2100,
    requiredStoryIds: ["aff_catkin_07_gift"],
    completionPoints: 60,
    backgroundAsset: "assets/affection/scenes/catkin-sentimental-shelf-rain.webp",
    memoryCallbacks: [
      ...rememberedChoices("aff_catkin_05_rainwatch", "\u55B5\u55B5", [
        ["two_work_desks", "\u96E8\u591C\u6211\u4EEC\u5171\u540C\u6536\u5DE5\uFF0C\u6240\u4EE5\u4ECA\u5929\u8FD9\u6B21\u5C55\u793A\u4E5F\u4E0D\u7B97\u989D\u5916\u503C\u73ED\u3002"],
        ["quiet_corner", "\u4F60\u5C0A\u91CD\u6211\u7684\u72EC\u5904\u89D2\u843D\uFF0C\u79C1\u85CF\u5C55\u793A\u683C\u4E5F\u53EF\u4EE5\u53EA\u6253\u5F00\u6211\u60F3\u5206\u4EAB\u7684\u90E8\u5206\u3002"],
        ["rain_window_seat", "\u90A3\u573A\u96E8\u91CC\u6211\u4EEC\u5B89\u9759\u540C\u5750\uFF1B\u73B0\u5728\u6211\u4E5F\u80FD\u5B89\u9759\u544A\u8BC9\u4F60\u67D0\u4E9B\u7269\u54C1\u4E3A\u4EC0\u4E48\u91CD\u8981\u3002"]
      ])
    ],
    openingDialogue: [
      { text: "\u96E8\u591C\u5DE5\u574A\u7684\u4E00\u9762\u6536\u7EB3\u5899\u6253\u5F00\u5C0F\u534A\uFF0C\u65E7\u7968\u7247\u3001\u7A7A\u767D\u5FBD\u7AE0\u4E0E\u88AB\u4FEE\u8865\u8FC7\u7684\u7EB8\u7BB1\u89D2\u6574\u9F50\u653E\u5728\u72EC\u7ACB\u683C\u4E2D\u3002" },
      { speaker: "\u55B5\u55B5", mood: "calm", text: "\u5B83\u4EEC\u6CA1\u6709\u6218\u6597\u6570\u503C\uFF0C\u4E5F\u4E0D\u5C5E\u4E8E\u4EFB\u52A1\u5FC5\u9700\u54C1\u3002\u6309\u7269\u8D44\u6807\u51C6\uFF0C\u5E94\u8BE5\u65E9\u5C31\u6E05\u7406\u3002" },
      { speaker: "\u55B5\u55B5", mood: "shy", text: "\u300A\u53EF\u6211\u559C\u6B22\u300B\u3002\u4ECA\u5929\u53EA\u5C55\u793A\u6211\u4E3B\u52A8\u6253\u5F00\u7684\u8FD9\u4E9B\uFF0C\u5176\u4ED6\u683C\u4ECD\u7136\u4FDD\u5BC6\u3002" }
    ],
    choices: [
      {
        id: "ask_before_view",
        label: "\u201C\u6211\u53EA\u770B\u4F60\u4E3B\u52A8\u6253\u5F00\u7684\u683C\u5B50\uFF1B\u60F3\u5173\u4E0A\u65F6\u4E0D\u7528\u89E3\u91CA\u3002\u201D",
        mood: "moved",
        responseDialogue: [
          { speaker: "\u55B5\u55B5", mood: "playful", text: "\u6536\u5230\u3002\u53C2\u89C2\u6743\u9650\u6309\u5B9E\u65F6\u610F\u613F\u751F\u6548\uFF0C\u4E0D\u81EA\u52A8\u7EED\u671F\u3002" },
          { text: "\u5979\u653E\u677E\u5730\u6253\u5F00\u7B2C\u4E8C\u4E2A\u5C0F\u683C\uFF0C\u53C8\u4FDD\u7559\u5176\u4F59\u906E\u677F\u539F\u6837\u4E0D\u52A8\u3002" }
        ]
      },
      {
        id: "no_inventory_report",
        label: "\u201C\u559C\u6B22\u4E0D\u9700\u8981\u63D0\u4EA4\u7528\u9014\u62A5\u544A\uFF0C\u4E5F\u4E0D\u5FC5\u8BC1\u660E\u503C\u5F97\u4FDD\u7559\u3002\u201D",
        mood: "shy",
        responseDialogue: [
          { speaker: "\u55B5\u55B5", mood: "moved", text: "\u526F\u961F\u957F\u6279\u51C6\u4E00\u6279\u201C\u6CA1\u6709\u7528\u9014\u4F46\u5C31\u662F\u820D\u4E0D\u5F97\u201D\u7684\u300A\u6700\u9AD8\u7EA7\u7269\u8D44\u300B\u3002" },
          { text: "\u5979\u628A\u65E7\u5FBD\u7AE0\u6446\u5F97\u66F4\u6B63\u4E86\u4E00\u70B9\uFF0C\u8BED\u6C14\u5F97\u610F\uFF0C\u52A8\u4F5C\u5374\u683C\u5916\u8F7B\u3002" }
        ]
      },
      {
        id: "shared_memory_slot",
        label: "\u201C\u82E5\u4F60\u613F\u610F\uFF0C\u6211\u4EEC\u53EF\u4EE5\u7559\u4E00\u4E2A\u5171\u540C\u7EAA\u5FF5\u683C\uFF1B\u5404\u81EA\u79C1\u85CF\u4ECD\u5F52\u5404\u81EA\u3002\u201D",
        mood: "bright",
        responseDialogue: [
          { speaker: "\u55B5\u55B5", mood: "bright", text: "\u4E2D\u592E\u5171\u4EAB\u683C\u6210\u7ACB\uFF0C\u4F46\u65B0\u589E\u7269\u54C1\u5FC5\u987B\u53CC\u4EBA\u786E\u8BA4\u3002" },
          { text: "\u5979\u6253\u5F00\u6700\u4E2D\u95F4\u7684\u7A7A\u683C\uFF0C\u4E0E\u4F60\u7EA6\u5B9A\u7B2C\u4E00\u4EF6\u7EAA\u5FF5\u7269\u4EE5\u540E\u5171\u540C\u9009\u62E9\u3002" }
        ]
      }
    ]
  },
  {
    id: "aff_catkin_09_reciprocal",
    classId: "catkin",
    episode: 9,
    title: "\u4E0B\u4E00\u7AD9\u4E5F\u6709\u4F60\u7684\u6536\u7EB3\u683C",
    episodeLabel: "\u7B2C\u4E5D\u5E55 \xB7 \u53CC\u683C\u8FDC\u5F81\u67DC",
    unlockPoints: 2600,
    requiredStoryIds: ["aff_catkin_08_sentimental"],
    completionPoints: 60,
    backgroundAsset: "assets/affection/scenes/catkin-shared-expedition-locker-sunrise.webp",
    cgAsset: "assets/affection/cg/catkin-two-way-supply-tags.webp",
    memoryCallbacks: [
      ...rememberedChoices("aff_catkin_06_departure", "\u55B5\u55B5", [
        ["renew_by_choice", "\u6BCF\u6B21\u51FA\u53D1\u90FD\u91CD\u65B0\u786E\u8BA4\u540C\u884C\uFF0C\u6240\u4EE5\u8FDC\u5F81\u67DC\u6743\u9650\u4E5F\u4E0D\u4F1A\u9ED8\u8BA4\u6C38\u4E45\u7EED\u8BA2\u3002"],
        ["equal_captains", "\u5E76\u5217\u9886\u822A\u5458\u5404\u6709\u4E2A\u4EBA\u6536\u7EB3\u683C\uFF0C\u4E2D\u592E\u5171\u4EAB\u683C\u5219\u4E00\u8D77\u5BA1\u6838\u3002"],
        ["keep_own_dreams", "\u6211\u4EEC\u5141\u8BB8\u5404\u81EA\u63A2\u7D22\uFF1B\u4E24\u679A\u6807\u7B7E\u53EA\u8D1F\u8D23\u5E2E\u52A9\u6211\u4EEC\u91CD\u65B0\u4F1A\u5408\u3002"]
      ])
    ],
    openingDialogue: [
      { text: "\u671D\u9633\u7167\u8FDB\u8FDC\u5F81\u6574\u5907\u5BA4\uFF0C\u4E24\u53EA\u72EC\u7ACB\u50A8\u7269\u683C\u5206\u5217\u5DE6\u53F3\uFF0C\u4E2D\u592E\u662F\u4E00\u53EA\u9700\u8981\u53CC\u63A7\u5F00\u542F\u7684\u5171\u4EAB\u683C\u3002" },
      { speaker: "\u55B5\u55B5", mood: "bright", text: "\u8FD9\u662F\u6211\u51C6\u5907\u7684\u56DE\u793C\uFF1A\u4E00\u679A\u5C5E\u4E8E\u4F60\u7684\u8FDC\u5F81\u6807\u7B7E\uFF0C\u4EE5\u53CA\u4E00\u683C\u4E0D\u4F1A\u88AB\u6211\u64C5\u81EA\u6574\u7406\u7684\u7A7A\u95F4\u3002" },
      { speaker: "\u55B5\u55B5", mood: "shy", text: "\u522B\u8BEF\u4F1A\uFF0C\u4E0D\u662F\u628A\u4F60\u56FA\u5B9A\u5728\u636E\u70B9\u3002\u5B83\u53EA\u662F\u8868\u793A\u2014\u2014\u4E0B\u4E00\u6B21\u96C6\u5408\u300A\u4ECD\u7136\u6709\u4F60\u7684\u4F4D\u7F6E\u300B\u3002" }
    ],
    choices: [
      {
        id: "two_plus_shared",
        label: "\u201C\u4FDD\u7559\u4E24\u4E2A\u79C1\u4EBA\u683C\uFF0C\u518D\u7559\u4E00\u4E2A\u7531\u53CC\u65B9\u786E\u8BA4\u7684\u5171\u4EAB\u683C\u3002\u201D",
        mood: "bright",
        responseDialogue: [
          { speaker: "\u55B5\u55B5", mood: "playful", text: "\u5B8C\u7F8E\u7ED3\u6784\uFF01\u5E76\u80A9\u4E0D\u7B49\u4E8E\u5408\u5E76\u5E93\u5B58\uFF0C\u8FD9\u624D\u53EB\u6210\u719F\u642D\u6863\u3002" },
          { text: "\u5979\u5206\u522B\u68C0\u67E5\u4E24\u8FB9\u9501\u6263\uFF0C\u6700\u540E\u4E0E\u4F60\u540C\u65F6\u70B9\u4EAE\u4E2D\u592E\u5171\u4EAB\u683C\u3002" }
        ]
      },
      {
        id: "renew_access",
        label: "\u201C\u6BCF\u6B21\u8FDC\u5F81\u524D\u91CD\u65B0\u786E\u8BA4\u6743\u9650\uFF0C\u4EFB\u4F55\u4E00\u65B9\u90FD\u80FD\u8C03\u6574\u6216\u6536\u56DE\u3002\u201D",
        mood: "moved",
        responseDialogue: [
          { speaker: "\u55B5\u55B5", mood: "moved", text: "\u957F\u671F\u642D\u6863\u4E5F\u8981\u300A\u5C0A\u91CD\u4ECA\u5929\u7684\u7B54\u6848\u300B\u3002\u6743\u9650\u534F\u8BAE\u6B63\u5F0F\u901A\u8FC7\u3002" },
          { text: "\u4E24\u679A\u7A7A\u767D\u6807\u7B7E\u5404\u81EA\u4EAE\u8D77\uFF0C\u6CA1\u6709\u4EFB\u4F55\u4E00\u679A\u8986\u76D6\u53E6\u4E00\u679A\u7684\u63A7\u5236\u4FE1\u53F7\u3002" }
        ]
      },
      {
        id: "signal_for_meeting",
        label: "\u201C\u5404\u81EA\u63A2\u7D22\u4E5F\u6CA1\u5173\u7CFB\uFF1B\u60F3\u4F1A\u5408\u65F6\uFF0C\u7528\u8FD9\u679A\u6807\u7B7E\u53D1\u96C6\u5408\u4FE1\u53F7\u3002\u201D",
        mood: "shy",
        responseDialogue: [
          { speaker: "\u55B5\u55B5", mood: "shy", text: "\u90A3\u6211\u5927\u6982\u4F1A\u7ECF\u5E38\u6D4B\u8BD5\u4FE1\u53F7\u2026\u2026\u53EA\u662F\u4E3A\u4E86\u786E\u8BA4\u8BBE\u5907\u7A33\u5B9A\u3002" },
          { text: "\u5979\u8BA9\u4E24\u679A\u6807\u7B7E\u8F7B\u8F7B\u76F8\u89E6\uFF0C\u73CA\u745A\u4E0E\u6E56\u84DD\u5149\u70B9\u540C\u65F6\u8DF3\u4EAE\u3002" }
        ]
      }
    ]
  }
];
var AFFECTION_CHARACTERS = {
  swordsman: {
    classId: "swordsman",
    adult: true,
    name: "\u5251\u59EC",
    roomTitle: "\u6668\u6A31\u5251\u5EAD",
    personality: "\u8BA4\u771F\u514B\u5236\u3001\u4E60\u60EF\u4FDD\u62A4\u522B\u4EBA\uFF0C\u4E5F\u5728\u6162\u6162\u5B66\u4F1A\u63A5\u53D7\u4F60\u7684\u7167\u987E\u3002",
    boundaries: ["\u63A5\u89E6\u62A4\u8155\u3001\u5251\u7A57\u6216\u624B\u90E8\u524D\u5148\u8BE2\u95EE", "\u4E0D\u62FF\u5979\u7684\u8BA4\u771F\u4E0E\u8D23\u4EFB\u611F\u5F00\u4F4E\u4FD7\u73A9\u7B11"],
    accent: "#ff7fa6",
    glow: "#ffd6e4",
    hubBackgroundAsset: "assets/affection/scenes/swordsman-training-dawn.webp",
    interactions: [
      interaction(
        "morning",
        "\u6668\u95F4\u95EE\u5019",
        "\u966A\u5979\u8FCE\u63A5\u4ECA\u5929\u7684\u7B2C\u4E00\u5251",
        "bright",
        "victory",
        ["\u4F60\u6765\u4E86\u3002\u4ECA\u5929\u7684\u7B2C\u4E00\u5251\uFF0C\u6211\u60F3\u8BA9\u4F60\u770B\u3002", "\u6668\u949F\u8FD8\u6CA1\u54CD\uFF0C\u4E0D\u8FC7\u4F60\u5DF2\u7ECF\u5230\u4E86\u3002\u5F88\u597D\u3002"]
      ),
      interaction(
        "training",
        "\u966A\u7EC3\u8BA1\u6570",
        "\u66FF\u5979\u6570\u5251\uFF0C\u4E5F\u63D0\u9192\u4F11\u606F",
        "calm",
        "cast",
        ["\u522B\u53EA\u6570\u5251\uFF0C\u4E5F\u66FF\u6211\u8BB0\u5F97\u4EC0\u4E48\u65F6\u5019\u8BE5\u4F11\u606F\u3002", "\u6570\u5230\u4E00\u767E\u5C31\u505C\u2014\u2014\u8FD9\u6B21\u6211\u4F1A\u542C\u4F60\u7684\u3002"]
      ),
      interaction(
        "tea",
        "\u9012\u4E0A\u70ED\u8336",
        "\u8BAD\u7EC3\u540E\u7684\u5B89\u9759\u7247\u523B",
        "moved",
        "idle",
        ["\u539F\u6765\u6709\u4EBA\u8BB0\u5F97\u6211\u559C\u6B22\u4E0D\u592A\u751C\u7684\u3002\u8C22\u8C22\u3002", "\u5251\u5148\u653E\u4E00\u4F1A\u513F\u3002\u8336\u51C9\u4EE5\u524D\uFF0C\u4F60\u4E5F\u5750\u4E0B\u5427\u3002"]
      ),
      interaction(
        "walk",
        "\u96E8\u540E\u6563\u6B65",
        "\u6CBF\u7740\u6A31\u5ECA\u5E76\u80A9\u8D70\u8D70",
        "calm",
        "idle",
        ["\u4F1E\u7559\u5728\u4E2D\u95F4\uFF0C\u8C01\u90FD\u4E0D\u8BB8\u6DCB\u5230\u3002", "\u4ECA\u5929\u6CA1\u6709\u96E8\uFF0C\u53EF\u4F60\u8FD8\u662F\u8D70\u5728\u4F1E\u6CBF\u7684\u4F4D\u7F6E\u3002"],
        "aff_swordsman_01_dawn"
      ),
      interaction(
        "guard",
        "\u68C0\u67E5\u62A4\u8155",
        "\u5148\u8BE2\u95EE\uFF0C\u518D\u66FF\u5979\u7CFB\u597D",
        "shy",
        "cast",
        ["\u53EF\u4EE5\u3002\u56E0\u4E3A\u4F60\u6709\u5148\u95EE\u3002", "\u6700\u540E\u4E00\u4E2A\u7ED3\u4EA4\u7ED9\u4F60\u2026\u2026\u522B\u7CFB\u5F97\u592A\u7D27\u3002"],
        "aff_swordsman_01_dawn"
      ),
      interaction(
        "ribbon",
        "\u6574\u7406\u5251\u7A57",
        "\u628A\u80DC\u5229\u7EF6\u5E26\u8F7B\u8F7B\u7406\u987A",
        "shy",
        "victory",
        ["\u5200\u5203\u6211\u6765\uFF0C\u5251\u7A57\u2026\u2026\u53EF\u4EE5\u4EA4\u7ED9\u4F60\u3002", "\u8FD9\u4E00\u7AEF\u7559\u5728\u5251\u4E0A\uFF0C\u53E6\u4E00\u7AEF\u7684\u4F4D\u7F6E\u4F60\u77E5\u9053\u3002"],
        "aff_swordsman_03_victory"
      )
    ],
    stories: [...SWORDSMAN_STORIES, ...affectionDateStories("swordsman")]
  },
  witch: {
    classId: "witch",
    adult: true,
    name: "\u9B54\u5973",
    roomTitle: "\u504F\u822A\u661F\u5DE5\u574A",
    personality: "\u81EA\u4FE1\u4FCF\u76AE\uFF0C\u5E38\u7528\u73A9\u7B11\u85CF\u8D77\u4E0D\u5B89\uFF1B\u5979\u6700\u73CD\u60DC\u88AB\u8BA4\u771F\u5C0A\u91CD\u7684\u80FD\u529B\u4E0E\u79D8\u5BC6\u3002",
    boundaries: ["\u4E0D\u64C5\u81EA\u89E6\u78B0\u6CD5\u6756\u3001\u661F\u706B\u548C\u5B9E\u9A8C\u54C1", "\u4E0D\u5F3A\u8FEB\u5979\u628A\u5C1A\u672A\u51C6\u5907\u597D\u7684\u79D8\u5BC6\u8BF4\u51FA\u6765"],
    accent: "#ff72b7",
    glow: "#d9c7ff",
    hubBackgroundAsset: "assets/affection/scenes/witch-atelier-spark.webp",
    interactions: [
      interaction(
        "spark",
        "\u661F\u706B\u95EE\u5019",
        "\u770B\u770B\u504F\u822A\u661F\u4ECA\u5929\u98DE\u5411\u8C01",
        "playful",
        "cast",
        ["\u5B83\u4E00\u770B\u89C1\u4F60\u5C31\u4EAE\uFF0C\u771F\u662F\u6BEB\u65E0\u539F\u5219\u3002", "\u504F\u822A\u661F\u53C8\u8DD1\u8FC7\u53BB\u4E86\u2026\u2026\u7B97\u4E86\uFF0C\u66FF\u6211\u7167\u987E\u5B83\u4E00\u4F1A\u513F\u3002"]
      ),
      interaction(
        "notes",
        "\u6574\u7406\u7B14\u8BB0",
        "\u53EA\u7FFB\u5979\u5141\u8BB8\u4F60\u770B\u7684\u9875\u6570",
        "calm",
        "idle",
        ["\u8FD9\u9875\u53EF\u4EE5\u770B\uFF0C\u5939\u7740\u4E66\u7B7E\u7684\u90A3\u9875\u8981\u7B49\u6211\u4E3B\u52A8\u544A\u8BC9\u4F60\u3002", "\u5B57\u8FF9\u4E71\u7684\u5730\u65B9\u4E0D\u8BB8\u7B11\uFF0C\u90A3\u662F\u9B54\u529B\u592A\u6D3B\u6CFC\u3002"]
      ),
      interaction(
        "drink",
        "\u70ED\u996E\u4F11\u606F",
        "\u8BA9\u5B9E\u9A8C\u684C\u6682\u65F6\u5B89\u9759",
        "shy",
        "idle",
        ["\u4E0D\u662F\u6015\u4F60\u51B7\uFF0C\u662F\u5B9E\u9A8C\u9700\u8981\u7A33\u5B9A\u6E29\u5EA6\u3002", "\u7B2C\u4E8C\u676F\u53EA\u662F\u521A\u597D\u591A\u505A\u4E86\u2026\u2026\u4F4D\u7F6E\u4E5F\u521A\u597D\u5728\u4F60\u9762\u524D\u3002"]
      ),
      interaction(
        "starmap",
        "\u89C2\u6D4B\u661F\u56FE",
        "\u5171\u4EAB\u671B\u8FDC\u955C\u65C1\u7684\u5EA7\u4F4D",
        "shy",
        "cast",
        ["\u5750\u8FD1\u4E00\u70B9\uFF0C\u671B\u8FDC\u955C\u4E0D\u4F1A\u66FF\u6211\u4FDD\u7559\u4F4D\u7F6E\u3002", "\u4ECA\u665A\u7684\u4E91\u5F88\u5C11\uFF0C\u4F60\u8FDF\u5230\u7684\u7406\u7531\u4E5F\u5E94\u8BE5\u5F88\u5C11\u3002"],
        "aff_witch_01_star"
      ),
      interaction(
        "spell-name",
        "\u5492\u8BED\u547D\u540D",
        "\u7ED9\u65B0\u6CD5\u672F\u8D77\u4E00\u4E2A\u79D8\u5BC6\u540D\u5B57",
        "playful",
        "victory",
        ["\u540D\u5B57\u5F52\u4F60\u8D77\uFF0C\u4F46\u4E0D\u8BB8\u6BD4\u201C\u504F\u822A\u661F\u201D\u66F4\u53EF\u7231\u3002", "\u8FD9\u4E2A\u540D\u5B57\u53EA\u5199\u8FDB\u6211\u4EEC\u7684\u5B9E\u9A8C\u8BB0\u5F55\u3002"],
        "aff_witch_01_star"
      ),
      interaction(
        "secret",
        "\u79D8\u5BC6\u5B9E\u9A8C",
        "\u6210\u4E3A\u4ECA\u665A\u552F\u4E00\u7684\u5171\u72AF",
        "bright",
        "cast",
        ["\u62A4\u76EE\u955C\u6234\u597D\u3002\u4ECA\u5929\u7684\u5171\u72AF\u53EA\u6709\u4F60\u3002", "\u56DE\u7A0B\u5750\u6807\u786E\u8BA4\u2014\u2014\u8FD8\u662F\u4F60\u7AD9\u7740\u7684\u5730\u65B9\u3002"],
        "aff_witch_03_recipe"
      )
    ],
    stories: [...WITCH_STORIES, ...affectionDateStories("witch")]
  },
  shaman: {
    classId: "shaman",
    adult: true,
    name: "\u7075\u5DEB",
    roomTitle: "\u5F52\u706F\u7948\u613F\u6240",
    personality: "\u6E29\u67D4\u5B89\u9759\uFF0C\u64C5\u957F\u7167\u987E\u6240\u6709\u4EBA\uFF1B\u5728\u4F60\u9762\u524D\uFF0C\u5979\u4E5F\u53EF\u4EE5\u6162\u6162\u8BF4\u51FA\u81EA\u5DF1\u7684\u613F\u671B\u3002",
    boundaries: ["\u5C0A\u91CD\u6C89\u9ED8\uFF0C\u4E0D\u628A\u5B89\u9759\u8BEF\u89E3\u6210\u9700\u8981\u50AC\u4FC3", "\u4E0D\u5F3A\u8FEB\u901A\u7075\u6216\u4EFB\u4F55\u80A2\u4F53\u63A5\u89E6"],
    accent: "#8e78df",
    glow: "#d8e4ff",
    hubBackgroundAsset: "assets/affection/scenes/shaman-shrine-morning.webp",
    interactions: [
      interaction(
        "bell",
        "\u6E05\u6668\u542C\u94C3",
        "\u4E0D\u50AC\u4FC3\u98CE\u94C3\u7684\u56DE\u7B54",
        "calm",
        "idle",
        ["\u4E0D\u7528\u6025\u7740\u8BF4\u8BDD\uFF0C\u6211\u77E5\u9053\u4F60\u5DF2\u7ECF\u6765\u4E86\u3002", "\u94C3\u58F0\u521A\u597D\u54CD\u4E86\u4E00\u4E0B\uFF0C\u50CF\u662F\u5728\u66FF\u6211\u95EE\u5019\u4F60\u3002"]
      ),
      interaction(
        "tea",
        "\u5171\u996E\u70ED\u8336",
        "\u628A\u7B2C\u4E8C\u676F\u7559\u7ED9\u5F7C\u6B64",
        "moved",
        "idle",
        ["\u7B2C\u4E00\u676F\u7ED9\u795E\u660E\uFF0C\u7B2C\u4E8C\u676F\u7ED9\u4F60\u3002", "\u8336\u8FD8\u70ED\u3002\u82E5\u4E0D\u8D76\u8DEF\uFF0C\u5C31\u518D\u5750\u4E00\u4F1A\u513F\u3002"]
      ),
      interaction(
        "wish",
        "\u6298\u613F\u7EB8",
        "\u66FF\u5F7C\u6B64\u628A\u5FC3\u613F\u6536\u597D",
        "calm",
        "cast",
        ["\u613F\u671B\u4E0D\u7528\u544A\u8BC9\u6211\uFF0C\u6211\u66FF\u4F60\u628A\u5B83\u6298\u597D\u3002", "\u6298\u75D5\u4F1A\u8BB0\u5F97\u65B9\u5411\uFF0C\u5C31\u50CF\u5F52\u706F\u8BB0\u5F97\u4F60\u3002"]
      ),
      interaction(
        "firewalk",
        "\u7075\u706B\u6563\u6B65",
        "\u8BA9\u5F52\u706F\u7167\u4EAE\u5E76\u80A9\u7684\u8DEF",
        "bright",
        "cast",
        ["\u5F52\u706F\u5728\u524D\u9762\uFF0C\u4F60\u8D70\u5728\u6211\u8EAB\u8FB9\u3002", "\u5B83\u4ECA\u5929\u7ED5\u4E86\u8FDC\u8DEF\uFF0C\u4E5F\u8BB8\u662F\u60F3\u8BA9\u6211\u4EEC\u591A\u8D70\u4E00\u4F1A\u513F\u3002"],
        "aff_shaman_01_bell"
      ),
      interaction(
        "nightwatch",
        "\u5E76\u80A9\u5DE1\u591C",
        "\u8BA9\u591C\u8DEF\u4E0D\u518D\u53EA\u5C5E\u4E8E\u4E00\u4E2A\u4EBA",
        "shy",
        "victory",
        ["\u4E24\u4E2A\u4EBA\u7684\u591C\u8DEF\uFF0C\u98CE\u58F0\u4E5F\u4F1A\u8F7B\u4E00\u70B9\u3002", "\u4F60\u82E5\u56F0\u4E86\u5C31\u544A\u8BC9\u6211\uFF1B\u6211\u4E5F\u4F1A\u544A\u8BC9\u4F60\u3002"],
        "aff_shaman_02_firefly"
      ),
      interaction(
        "charm",
        "\u7CFB\u4E0A\u62A4\u7B26",
        "\u7531\u5979\u4E3B\u52A8\u5B8C\u6210\u6700\u540E\u4E00\u4E2A\u7ED3",
        "moved",
        "cast",
        ["\u6211\u6765\u7CFB\u6700\u540E\u4E00\u4E2A\u7ED3\uFF1B\u4F60\u82E5\u613F\u610F\uFF0C\u5C31\u522B\u6025\u7740\u89E3\u5F00\u3002", "\u8FD9\u4E0D\u662F\u675F\u7F1A\uFF0C\u662F\u63D0\u9192\u4F60\u6709\u4EBA\u5728\u7B49\u3002"],
        "aff_shaman_03_wish"
      )
    ],
    stories: [...SHAMAN_STORIES, ...affectionDateStories("shaman")]
  },
  catkin: {
    classId: "catkin",
    adult: true,
    name: "\u55B5\u55B5",
    roomTitle: "\u7B2C\u4E00\u526F\u961F\u957F\u636E\u70B9",
    personality: "\u6210\u5E74\u7684\u53EF\u9760\u642D\u6863\uFF0C\u6D3B\u6CFC\u673A\u7075\u53C8\u7565\u5E26\u5F97\u610F\uFF1B\u5979\u628A\u771F\u6B63\u4FE1\u4EFB\u7684\u4EBA\u9080\u8BF7\u8FDB\u81EA\u5DF1\u7684\u636E\u70B9\u3002",
    boundaries: ["\u8033\u6735\u4E0E\u5C3E\u5DF4\u4ECE\u4E0D\u4F5C\u4E3A\u9ED8\u8BA4\u89E6\u6478\u5165\u53E3", "\u53EA\u5728\u5979\u4E3B\u52A8\u4F38\u51FA\u624B\u5957\u65F6\u8FDB\u884C\u8089\u7403\u51FB\u638C"],
    accent: "#f39d6a",
    glow: "#a9e8ff",
    hubBackgroundAsset: "assets/affection/scenes/catkin-box-base.webp",
    interactions: [
      interaction(
        "knock",
        "\u6572\u636E\u70B9\u95E8",
        "\u7528\u6B63\u5F0F\u6697\u53F7\u7533\u8BF7\u8FDB\u5165",
        "playful",
        "victory",
        ["\u6697\u53F7\u6B63\u786E\uFF01\u526F\u961F\u957F\u83B7\u51C6\u8FDB\u5165\u3002", "\u4ECA\u5929\u7684\u8D35\u5BBE\u5E2D\u8FD8\u662F\u4E00\u4E2A\u2014\u2014\u4F46\u53EF\u4EE5\u6324\u6210\u4E24\u4E2A\u3002"]
      ),
      interaction(
        "loot",
        "\u6574\u7406\u6218\u5229\u54C1",
        "\u6309\u961F\u957F\u89C4\u5B9A\u91CD\u65B0\u5206\u7C7B",
        "shy",
        "idle",
        ["\u4E0D\u8BB8\u5077\u770B\u85CF\u5B9D\u683C\u2026\u2026\u7B97\u4E86\uFF0C\u53EF\u4EE5\u770B\u4E00\u773C\u3002", "\u8FD9\u9897\u4EAE\u6676\u6676\u5F52\u4F60\u4FDD\u7BA1\uFF0C\u4E22\u4E86\u8981\u8D54\u4E24\u6B21\u51FB\u638C\u3002"]
      ),
      interaction(
        "light",
        "\u8FFD\u5149\u6E38\u620F",
        "\u4E00\u8D77\u6293\u4F4F\u8DD1\u6389\u7684\u5C0F\u5149\u70B9",
        "playful",
        "cast",
        ["\u6293\u5230\u5149\u70B9\u7B97\u6211\u8D62\uFF0C\u6293\u5230\u6211\u65C1\u8FB9\u7684\u4F4D\u7F6E\u4E5F\u7B97\u4F60\u8D62\u3002", "\u8FD9\u4E00\u5C40\u5E73\u624B\u3002\u4E0B\u4E00\u5C40\u8FD8\u662F\u5728\u8FD9\u91CC\u96C6\u5408\u3002"]
      ),
      interaction(
        "highfive",
        "\u8089\u7403\u51FB\u638C",
        "\u9694\u7740\u624B\u5957\u786E\u8BA4\u642D\u6863\u6697\u53F7",
        "bright",
        "victory",
        ["\u53EA\u9694\u7740\u624B\u5957\uFF0C\u4E00\u3001\u4E8C\u3001\u556A\uFF01", "\u84DD\u8272\u706B\u82B1\u51FA\u73B0\u4E86\u2014\u2014\u642D\u6863\u96C6\u5408\u6210\u529F\u3002"],
        "aff_catkin_02_glove"
      ),
      interaction(
        "repair",
        "\u4FEE\u7406\u624B\u5957",
        "\u7167\u660E\u5F52\u4F60\uFF0C\u6676\u722A\u5F52\u5979",
        "calm",
        "cast",
        ["\u7167\u660E\u4EA4\u7ED9\u4F60\uFF0C\u6676\u722A\u4EA4\u7ED9\u4E13\u4E1A\u4EBA\u58EB\u3002", "\u522B\u628A\u5149\u79FB\u5F00\u2026\u2026\u6211\u662F\u8BF4\uFF0C\u5DE5\u4F5C\u8FD8\u6CA1\u7ED3\u675F\u3002"],
        "aff_catkin_02_glove"
      ),
      interaction(
        "moon",
        "\u5C4B\u9876\u770B\u6708",
        "\u5171\u4EAB\u636E\u70B9\u5916\u7684\u7279\u522B\u5EA7\u4F4D",
        "moved",
        "idle",
        ["\u6708\u4EAE\u5F52\u5929\u7A7A\uFF0C\u65C1\u8FB9\u8FD9\u4E2A\u4F4D\u7F6E\u5F52\u4F60\u3002", "\u4ECA\u5929\u6CA1\u6709\u4EFB\u52A1\u3002\u53EA\u662F\u961F\u957F\u60F3\u53EB\u526F\u961F\u957F\u6765\u3002"],
        "aff_catkin_03_rooftop"
      )
    ],
    stories: [...CATKIN_STORIES, ...affectionDateStories("catkin")]
  }
};
var AFFECTION_STORIES = Object.values(
  AFFECTION_CHARACTERS
).flatMap((character) => character.stories);

// src/data/affectionRules.ts
var AFFECTION_RULES = {
  dailyInteractionLimit: 4,
  resetHourCst: 4,
  maxPoints: 99999,
  gearBaseChance: 0.03,
  gearSoftPityStart: 8,
  gearSoftPityStep: 0.05,
  gearHardPity: 16,
  tiers: [
    { id: "first-meeting", label: "\u521D\u89C1", minPoints: 0, combatBonusRatio: 0 },
    { id: "familiar", label: "\u719F\u7EDC", minPoints: 80, combatBonusRatio: 0.01 },
    { id: "in-sync", label: "\u9ED8\u5951", minPoints: 240, combatBonusRatio: 0.02 },
    { id: "heart-flutter", label: "\u5FC3\u52A8", minPoints: 520, combatBonusRatio: 0.035 },
    { id: "devoted", label: "\u503E\u5FC3", minPoints: 900, combatBonusRatio: 0.05 },
    { id: "vow", label: "\u8A93\u7EA6", minPoints: 1400, combatBonusRatio: 0.07 }
  ]
};

// src/save/schema.ts
var SAVE_VERSION = 12;
var classIdSchema = z.enum(CLASS_IDS);
var qualitySchema = z.enum(QUALITY_ORDER);
var affectionMoodSchema = z.enum(["calm", "bright", "shy", "moved", "playful"]);
var elementSchema = z.enum(["fire", "ice", "thunder", "none"]);
var persistedAffixKeys = Object.keys(AFFIX_RUNTIME_RULES);
var affixKeySchema = z.enum(persistedAffixKeys);
var generalAffixKeys = new Set(AFFIX_POOL.map((entry4) => entry4.key));
var professionAffixKeys = new Set(
  Object.values(PROFESSION_AFFIX_POOLS).flat().map((entry4) => entry4.key)
);
var affixTierSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5)
]);
var affixChangeOperationSchema = z.enum(["reforge", "temper", "inscribe", "resonate"]);
var finiteNumber = z.number().finite();
var nonNegativeNumber = finiteNumber.nonnegative();
var nonNegativeInteger = z.number().int().nonnegative();
var timestamp = nonNegativeInteger;
var equipmentDungeonStageIds = new Set(EQUIPMENT_DUNGEON_STAGE_LIST.map((stage) => stage.id));
var equipmentDungeonStageIdSchema = z.string().refine((stageId2) => equipmentDungeonStageIds.has(stageId2), "\u88C5\u5907\u526F\u672C\u5173\u5361\u4E0D\u5B58\u5728");
var affixSchema = z.object({
  key: affixKeySchema,
  value: finiteNumber,
  element: elementSchema.optional(),
  tier: affixTierSchema
}).strict().superRefine((affix, ctx) => {
  const requiresElement = affix.key === "elemDmg" || affix.key === "wit_elem";
  if (requiresElement && !["fire", "ice", "thunder"].includes(affix.element ?? "")) {
    ctx.addIssue({
      code: "custom",
      path: ["element"],
      message: "\u5C5E\u6027\u4F24\u5BB3\u7C7B\u8BCD\u6761\u5FC5\u987B\u7ED1\u5B9A fire\u3001ice \u6216 thunder"
    });
  }
  if (!requiresElement && affix.element !== void 0) {
    ctx.addIssue({
      code: "custom",
      path: ["element"],
      message: "\u975E\u5C5E\u6027\u4F24\u5BB3\u8BCD\u6761\u4E0D\u80FD\u643A\u5E26\u5143\u7D20"
    });
  }
});
var pendingAffixChangeSchema = z.object({
  operation: affixChangeOperationSchema,
  affixIndex: nonNegativeInteger,
  candidate: affixSchema
}).strict();
var enhanceGainSchema = z.array(
  z.number().int().refine(
    (gain) => gain === 0 || ENHANCE_GAIN_TIERS.some((tier) => gain >= tier.min && gain <= tier.max),
    "\u5F3A\u5316\u589E\u5E45\u4E0D\u5728\u914D\u7F6E\u6863\u4F4D\u5185"
  )
).length(ENHANCE_MAX);
var enhanceLuckKeySchema = z.string().regex(/^(?:[1-9]|1[0-5])$/);
var equipmentInstanceSchema = z.object({
  uid: z.string().min(1),
  defId: z.string().min(1),
  enhance: z.number().int().min(0).max(ENHANCE_MAX),
  baseRollPermille: z.number().int().min(EQUIPMENT_BASE_ROLL_MIN).max(EQUIPMENT_BASE_ROLL_MAX),
  enhanceGainPermille: enhanceGainSchema,
  enhanceLuck: z.record(enhanceLuckKeySchema, z.number().int().min(1).max(LUCK_FULL)),
  affixes: z.array(affixSchema),
  reforgeResonance: z.number().int().min(0).max(20),
  pendingAffixChange: pendingAffixChangeSchema.optional(),
  locked: z.boolean()
}).strict().superRefine((instance, ctx) => {
  for (let index = 0; index < instance.enhance; index++) {
    if (instance.enhanceGainPermille[index] === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["enhanceGainPermille", index],
        message: `\u5DF2\u5F3A\u5316\u5230 +${instance.enhance}\uFF0C\u524D ${instance.enhance} \u683C\u589E\u5E45\u5FC5\u987B\u5B58\u5728`
      });
    }
  }
  const definition = getEquipment(instance.defId);
  if (!definition) {
    ctx.addIssue({
      code: "custom",
      path: ["defId"],
      message: `\u88C5\u5907\u5B9A\u4E49\u4E0D\u5B58\u5728\uFF1A${instance.defId}`
    });
    return;
  }
  const fixedAffixes = definition.fixedAffixes ?? [];
  const extraSlots = definition.extraAffixSlots ?? 0;
  const remainingCapacity = QUALITY_AFFIX_COUNT[definition.quality] + extraSlots - fixedAffixes.length;
  if (remainingCapacity < 0) {
    ctx.addIssue({
      code: "custom",
      path: ["defId"],
      message: `\u88C5\u5907\u5B9A\u4E49 ${definition.id} \u7684\u56FA\u5B9A\u8BCD\u6761\u8D85\u8FC7\u54C1\u8D28\u5BB9\u91CF`
    });
    return;
  }
  if (definition.fixedTemplate && instance.affixes.length > extraSlots) {
    ctx.addIssue({
      code: "custom",
      path: ["affixes"],
      message: `\u5B8C\u6574\u56FA\u5B9A\u6A21\u677F\u7684\u968F\u673A\u8BCD\u6761\u4E0D\u5F97\u8D85\u8FC7\u989D\u5916\u69FD\u4F4D ${extraSlots}`
    });
  }
  if (instance.affixes.length > remainingCapacity) {
    ctx.addIssue({
      code: "custom",
      path: ["affixes"],
      message: `\u968F\u673A\u8BCD\u6761\u8D85\u8FC7 ${definition.quality} \u54C1\u8D28\u5269\u4F59\u5BB9\u91CF ${remainingCapacity}`
    });
  }
  const fixedKeys = /* @__PURE__ */ new Set();
  for (const fixedAffix2 of fixedAffixes) {
    if (fixedKeys.has(fixedAffix2.key)) {
      ctx.addIssue({
        code: "custom",
        path: ["defId"],
        message: `\u88C5\u5907\u5B9A\u4E49 ${definition.id} \u7684\u56FA\u5B9A\u8BCD\u6761\u952E\u91CD\u590D\uFF1A${fixedAffix2.key}`
      });
    }
    fixedKeys.add(fixedAffix2.key);
  }
  const randomKeys = /* @__PURE__ */ new Set();
  for (const [index, affix] of instance.affixes.entries()) {
    if (fixedKeys.has(affix.key) || randomKeys.has(affix.key)) {
      ctx.addIssue({
        code: "custom",
        path: ["affixes", index, "key"],
        message: `\u968F\u673A\u8BCD\u6761\u952E\u4E0E\u73B0\u6709\u8BCD\u6761\u91CD\u590D\uFF1A${affix.key}`
      });
    }
    randomKeys.add(affix.key);
    if (professionAffixKeys.has(affix.key) && !isProfessionAffixSlot(definition.quality, instance.affixes.length, index)) {
      ctx.addIssue({
        code: "custom",
        path: ["affixes", index, "key"],
        message: `\u804C\u4E1A\u8BCD\u6761 ${affix.key} \u53EA\u80FD\u4F4D\u4E8E\u54C1\u8D28\u9884\u7559\u7684\u804C\u4E1A\u69FD`
      });
    }
  }
  const pending = instance.pendingAffixChange;
  if (pending && pending.affixIndex >= instance.affixes.length) {
    ctx.addIssue({
      code: "custom",
      path: ["pendingAffixChange", "affixIndex"],
      message: "\u5F85\u5904\u7406\u8BCD\u6761\u7D22\u5F15\u5FC5\u987B\u6307\u5411\u88C5\u5907\u73B0\u6709\u968F\u673A\u8BCD\u6761"
    });
    return;
  }
  if (!pending) return;
  const target = instance.affixes[pending.affixIndex];
  const candidate = pending.candidate;
  const occupiedAfterReplace = /* @__PURE__ */ new Set([
    ...fixedKeys,
    ...instance.affixes.filter((_, index) => index !== pending.affixIndex).map((affix) => affix.key)
  ]);
  if (occupiedAfterReplace.has(candidate.key)) {
    ctx.addIssue({
      code: "custom",
      path: ["pendingAffixChange", "candidate", "key"],
      message: `\u6D17\u7EC3\u5019\u9009\u4E0E\u5176\u4ED6\u968F\u673A\u6216\u56FA\u5B9A\u8BCD\u6761\u91CD\u590D\uFF1A${candidate.key}`
    });
  }
  if ((pending.operation === "temper" || pending.operation === "resonate") && !isAffixSettlementActive(target.key)) {
    ctx.addIssue({
      code: "custom",
      path: ["pendingAffixChange", "candidate", "key"],
      message: `${pending.operation === "temper" ? "\u6DEC\u70BC" : "\u540C\u8C03"}\u4E0D\u80FD\u7EE7\u7EED\u517B\u6210\u5EF6\u540E\u7ED3\u7B97\u8BCD\u6761`
    });
  }
  if (!isAffixGenerationActive(candidate.key)) {
    ctx.addIssue({
      code: "custom",
      path: ["pendingAffixChange", "candidate", "key"],
      message: `\u5F85\u5904\u7406\u5019\u9009\u8BCD\u6761\u5C1A\u672A\u5F00\u653E\u751F\u6210\uFF1A${candidate.key}`
    });
  }
  if (pending.operation === "reforge") {
    const professionSlot = isProfessionAffixSlot(
      definition.quality,
      instance.affixes.length,
      pending.affixIndex
    );
    const expectedPool = professionSlot ? professionAffixKeys : generalAffixKeys;
    if (!expectedPool.has(candidate.key)) {
      ctx.addIssue({
        code: "custom",
        path: ["pendingAffixChange", "candidate", "key"],
        message: `\u91CD\u94F8\u5019\u9009\u4E0D\u5C5E\u4E8E\u76EE\u6807${professionSlot ? "\u804C\u4E1A" : "\u901A\u7528"}\u8BCD\u6761\u69FD`
      });
    }
  }
  if (pending.operation === "inscribe" && !professionAffixKeys.has(candidate.key)) {
    ctx.addIssue({
      code: "custom",
      path: ["pendingAffixChange", "candidate", "key"],
      message: "\u94ED\u523B\u5019\u9009\u5FC5\u987B\u5C5E\u4E8E\u804C\u4E1A\u4E13\u5C5E\u8BCD\u6761\u6C60"
    });
  }
  if (pending.operation === "inscribe" && !isProfessionAffixSlot(
    definition.quality,
    instance.affixes.length,
    pending.affixIndex
  )) {
    ctx.addIssue({
      code: "custom",
      path: ["pendingAffixChange", "affixIndex"],
      message: "\u94ED\u523B\u53EA\u80FD\u4F5C\u7528\u4E8E\u54C1\u8D28\u9884\u7559\u7684\u804C\u4E1A\u69FD"
    });
  }
  if ((pending.operation === "reforge" || pending.operation === "inscribe") && candidate.key === target.key) {
    ctx.addIssue({
      code: "custom",
      path: ["pendingAffixChange", "candidate", "key"],
      message: `${pending.operation === "reforge" ? "\u91CD\u94F8" : "\u94ED\u523B"}\u5019\u9009\u5FC5\u987B\u66F4\u6362\u8BCD\u6761\u7C7B\u578B`
    });
  }
  if (pending.operation !== "resonate" && !isRolledAffixValue(candidate.key, definition.level, candidate.tier, candidate.value)) {
    ctx.addIssue({
      code: "custom",
      path: ["pendingAffixChange", "candidate", "value"],
      message: "\u968F\u673A\u6D17\u7EC3\u5019\u9009\u6570\u503C\u4E0D\u7B26\u5408\u88C5\u5907\u7B49\u7EA7\u3001\u54C1\u9636\u3001\u6D6E\u52A8\u8303\u56F4\u6216\u5C0F\u6570\u7CBE\u5EA6"
    });
  }
  if (pending.operation === "temper" && (candidate.key !== target.key || candidate.element !== target.element)) {
    ctx.addIssue({
      code: "custom",
      path: ["pendingAffixChange", "candidate"],
      message: "\u6DEC\u70BC\u5019\u9009\u5FC5\u987B\u4FDD\u6301\u539F\u8BCD\u6761\u7C7B\u578B\u4E0E\u5143\u7D20"
    });
  }
  if (pending.operation === "resonate" && (candidate.key !== target.key || candidate.element !== target.element || candidate.tier !== target.tier + 1)) {
    ctx.addIssue({
      code: "custom",
      path: ["pendingAffixChange", "candidate"],
      message: "\u540C\u8C03\u5019\u9009\u5FC5\u987B\u4FDD\u6301\u7C7B\u578B\u4E0E\u5143\u7D20\uFF0C\u5E76\u4E14\u54C1\u9636\u6070\u597D\u63D0\u5347\u4E00\u7EA7"
    });
  }
  if (pending.operation === "resonate" && target.tier < 5) {
    const expected = promoteAffix(target);
    if (candidate.value !== expected.value) {
      ctx.addIssue({
        code: "custom",
        path: ["pendingAffixChange", "candidate", "value"],
        message: `\u540C\u8C03\u5019\u9009\u6570\u503C\u5FC5\u987B\u7CBE\u786E\u63D0\u5347\u4E3A ${expected.value}`
      });
    }
  }
});
var equippedSchema = z.object({
  weapon: equipmentInstanceSchema.nullable(),
  head: equipmentInstanceSchema.nullable(),
  body: equipmentInstanceSchema.nullable(),
  necklace: equipmentInstanceSchema.nullable(),
  bracelet: equipmentInstanceSchema.nullable(),
  ring: equipmentInstanceSchema.nullable(),
  belt: equipmentInstanceSchema.nullable(),
  shoes: equipmentInstanceSchema.nullable()
}).strict();
var affectionCharacterProgressSchema = z.object({
  points: nonNegativeInteger.max(AFFECTION_RULES.maxPoints),
  mood: affectionMoodSchema,
  dayKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  interactionsToday: z.number().int().min(0).max(AFFECTION_RULES.dailyInteractionLimit),
  totalInteractions: nonNegativeInteger,
  gearPity: z.number().int().min(0).max(AFFECTION_RULES.gearHardPity - 1),
  discoveredGearIds: z.array(z.string().min(1)).refine((ids) => new Set(ids).size === ids.length, "\u5FC3\u8679\u56FE\u9274\u4E0D\u80FD\u91CD\u590D"),
  completedStoryIds: z.array(z.string().min(1)).refine((ids) => new Set(ids).size === ids.length, "\u597D\u611F\u5267\u60C5\u5B8C\u6210\u8BB0\u5F55\u4E0D\u80FD\u91CD\u590D"),
  choiceHistory: z.record(z.string().min(1), z.string().min(1))
}).strict().refine(
  (progress) => progress.totalInteractions >= progress.interactionsToday,
  "\u603B\u4E92\u52A8\u6B21\u6570\u4E0D\u80FD\u5C11\u4E8E\u4ECA\u65E5\u4E92\u52A8\u6B21\u6570"
);
var trialBracketIds = new Set(TRIAL_BRACKETS.map((b) => b.id));
var trialBestSchema = z.object({
  seasonId: z.string().min(1).max(16),
  weekIndex: nonNegativeInteger,
  bracketId: z.string().refine((id) => trialBracketIds.has(id), "\u8BD5\u70BC\u5206\u6BB5\u4E0D\u5B58\u5728"),
  classId: classIdSchema,
  damage: nonNegativeInteger,
  at: timestamp,
  submitted: z.boolean()
}).strict();
var saveDataSchema = z.object({
  version: z.literal(SAVE_VERSION),
  createdAt: timestamp,
  lastActiveAt: timestamp,
  seed: z.number().int(),
  rngState: z.number().int(),
  nextUid: z.number().int().positive(),
  player: z.object({
    name: z.string().min(1).max(20),
    classId: classIdSchema,
    level: z.number().int().positive(),
    exp: nonNegativeInteger,
    gold: nonNegativeInteger,
    stamina: nonNegativeInteger,
    staminaRecoverAt: timestamp
  }).strict(),
  equipped: equippedSchema,
  bag: z.object({
    equipment: z.array(equipmentInstanceSchema),
    items: z.record(z.string(), nonNegativeInteger)
  }).strict(),
  progress: z.object({
    currentStageId: z.string().min(1),
    clearedStageIds: z.array(z.string().min(1)),
    stageKills: z.record(z.string(), nonNegativeInteger),
    pity: z.record(z.string(), nonNegativeInteger),
    seenTutorials: z.array(z.string().min(1))
  }).strict(),
  settings: z.object({
    autoDecomposeBelow: z.union([qualitySchema, z.literal("none")]),
    bgm: z.boolean(),
    sfx: z.boolean(),
    haptics: z.boolean(),
    reduceMotion: z.boolean()
  }).strict(),
  stats: z.object({
    totalKills: nonNegativeInteger,
    totalPlaySec: nonNegativeNumber,
    bossKills: z.record(z.string(), nonNegativeInteger)
  }).strict(),
  shop: z.object({
    purchasedOfferIds: z.array(z.string().min(1))
  }).strict(),
  encounters: z.object({
    progressSec: nonNegativeNumber,
    generatedCount: nonNegativeInteger,
    resolvedCount: nonNegativeInteger,
    pending: z.array(
      z.object({
        uid: z.string().min(1),
        encounterId: z.string().min(1),
        regionId: z.string().min(1),
        storyChoiceId: z.string().min(1).optional()
      }).strict()
    ).max(3),
    characters: z.record(
      z.string().min(1),
      z.object({
        bond: nonNegativeInteger,
        completedEncounterIds: z.array(z.string().min(1)).refine((ids) => new Set(ids).size === ids.length, "\u5DF2\u5B8C\u6210\u7BC7\u7AE0\u4E0D\u80FD\u91CD\u590D"),
        choiceHistory: z.record(z.string().min(1), z.string().min(1))
      }).strict()
    )
  }).strict(),
  equipmentDungeon: z.object({
    dayKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    clearsToday: z.number().int().min(0).max(EQUIPMENT_DUNGEON_RULES.dailyClears),
    totalClears: nonNegativeInteger,
    records: z.record(
      equipmentDungeonStageIdSchema,
      z.object({
        clears: z.number().int().positive(),
        firstClearedAt: timestamp,
        bestDurationMs: z.number().int().positive()
      }).strict()
    )
  }).strict(),
  affection: z.object({
    characters: z.object({
      swordsman: affectionCharacterProgressSchema,
      witch: affectionCharacterProgressSchema,
      shaman: affectionCharacterProgressSchema,
      catkin: affectionCharacterProgressSchema
    }).strict()
  }).strict(),
  trial: z.object({
    bests: z.array(trialBestSchema).max(TRIAL_BEST_KEEP)
  }).strict()
}).strict().superRefine((save, ctx) => {
  for (const [index, entry4] of save.encounters.pending.entries()) {
    if (!entry4.storyChoiceId) continue;
    const storyChoices = ENCOUNTERS[entry4.encounterId]?.storyArc?.storyChoices;
    if (!storyChoices?.some((choice) => choice.id === entry4.storyChoiceId)) {
      ctx.addIssue({
        code: "custom",
        path: ["encounters", "pending", index, "storyChoiceId"],
        message: `\u5267\u60C5\u56DE\u7B54 ${entry4.storyChoiceId} \u4E0D\u5C5E\u4E8E\u5947\u9047 ${entry4.encounterId}`
      });
    }
  }
  for (const [characterId, progress] of Object.entries(save.encounters.characters)) {
    for (const [encounterId, choiceId] of Object.entries(progress.choiceHistory)) {
      const arc = ENCOUNTERS[encounterId]?.storyArc;
      if (arc?.characterId !== characterId || !arc.storyChoices.some((choice) => choice.id === choiceId)) {
        ctx.addIssue({
          code: "custom",
          path: ["encounters", "characters", characterId, "choiceHistory", encounterId],
          message: `\u5267\u60C5\u8BB0\u5FC6 ${encounterId}/${choiceId} \u4E0E\u89D2\u8272 ${characterId} \u4E0D\u5339\u914D`
        });
      }
    }
  }
  for (const classId of CLASS_IDS) {
    const progress = save.affection.characters[classId];
    const character = AFFECTION_CHARACTERS[classId];
    const storyById = new Map(character.stories.map((story) => [story.id, story]));
    const completed = new Set(progress.completedStoryIds);
    const validGearIds = new Set(affectionEquipmentIdsForClass(classId));
    for (const [index, gearId] of progress.discoveredGearIds.entries()) {
      if (!validGearIds.has(gearId)) {
        ctx.addIssue({
          code: "custom",
          path: ["affection", "characters", classId, "discoveredGearIds", index],
          message: `${gearId} \u4E0D\u662F ${classId} \u7684\u5FC3\u8679\u73CD\u85CF`
        });
      }
    }
    for (const [index, storyId] of progress.completedStoryIds.entries()) {
      const story = storyById.get(storyId);
      if (!story) {
        ctx.addIssue({
          code: "custom",
          path: ["affection", "characters", classId, "completedStoryIds", index],
          message: `${classId} \u7684\u597D\u611F\u5267\u60C5\u4E0D\u5B58\u5728\uFF1A${storyId}`
        });
        continue;
      }
      for (const requiredId of story.requiredStoryIds) {
        if (!completed.has(requiredId)) {
          ctx.addIssue({
            code: "custom",
            path: ["affection", "characters", classId, "completedStoryIds", index],
            message: `${storyId} \u7F3A\u5C11\u524D\u7F6E\u597D\u611F\u5267\u60C5 ${requiredId}`
          });
        }
      }
    }
    for (const [storyId, choiceId] of Object.entries(progress.choiceHistory)) {
      const story = storyById.get(storyId);
      if (!story || !completed.has(storyId)) {
        ctx.addIssue({
          code: "custom",
          path: ["affection", "characters", classId, "choiceHistory", storyId],
          message: `\u672A\u5B8C\u6210\u7684\u597D\u611F\u5267\u60C5\u4E0D\u80FD\u4FDD\u5B58\u56DE\u7B54\uFF1A${storyId}`
        });
        continue;
      }
      if (!story.choices.some((choice) => choice.id === choiceId)) {
        ctx.addIssue({
          code: "custom",
          path: ["affection", "characters", classId, "choiceHistory", storyId],
          message: `${storyId} \u4E0D\u5B58\u5728\u56DE\u7B54\uFF1A${choiceId}`
        });
      }
    }
    for (const storyId of completed) {
      if (!(storyId in progress.choiceHistory)) {
        ctx.addIssue({
          code: "custom",
          path: ["affection", "characters", classId, "choiceHistory"],
          message: `\u5DF2\u5B8C\u6210\u5267\u60C5\u7F3A\u5C11\u56DE\u7B54\u8BB0\u5F55\uFF1A${storyId}`
        });
      }
    }
  }
  const seenUids = /* @__PURE__ */ new Set();
  let maxNumericUid = 0;
  for (const [slot, instance] of Object.entries(save.equipped)) {
    if (!instance) continue;
    const definition = getEquipment(instance.defId);
    if (definition && definition.slot !== slot) {
      ctx.addIssue({
        code: "custom",
        path: ["equipped", slot, "defId"],
        message: `\u88C5\u5907 ${definition.id} \u5C5E\u4E8E ${definition.slot} \u69FD\uFF0C\u4E0D\u80FD\u7A7F\u6234\u5728 ${slot} \u69FD`
      });
    }
  }
  const instances = [
    ...save.bag.equipment.map((instance, index) => ({
      instance,
      path: ["bag", "equipment", index]
    })),
    ...Object.entries(save.equipped).flatMap(
      ([slot, instance]) => instance ? [
        {
          instance,
          path: ["equipped", slot]
        }
      ] : []
    )
  ];
  for (const { instance, path } of instances) {
    if (seenUids.has(instance.uid)) {
      ctx.addIssue({
        code: "custom",
        path: [...path, "uid"],
        message: `\u88C5\u5907 UID \u91CD\u590D\uFF1A${instance.uid}`
      });
    }
    seenUids.add(instance.uid);
    const match = /^e(\d+)$/.exec(instance.uid);
    if (match) maxNumericUid = Math.max(maxNumericUid, Number(match[1]));
  }
  if (save.nextUid <= maxNumericUid) {
    ctx.addIssue({
      code: "custom",
      path: ["nextUid"],
      message: `nextUid \u5FC5\u987B\u5927\u4E8E\u73B0\u6709\u6700\u5927\u88C5\u5907\u7F16\u53F7 e${maxNumericUid}`
    });
  }
  const recordedClears = Object.values(save.equipmentDungeon.records).reduce(
    (sum, record) => sum + record.clears,
    0
  );
  if (save.equipmentDungeon.totalClears !== recordedClears) {
    ctx.addIssue({
      code: "custom",
      path: ["equipmentDungeon", "totalClears"],
      message: `totalClears \u5E94\u4E3A\u901A\u5173\u8BB0\u5F55\u5408\u8BA1 ${recordedClears}`
    });
  }
  if (save.equipmentDungeon.clearsToday > save.equipmentDungeon.totalClears) {
    ctx.addIssue({
      code: "custom",
      path: ["equipmentDungeon", "clearsToday"],
      message: "\u4ECA\u65E5\u901A\u5173\u6B21\u6570\u4E0D\u80FD\u8D85\u8FC7\u5386\u53F2\u603B\u901A\u5173\u6B21\u6570"
    });
  }
  for (const stageId2 of Object.keys(save.equipmentDungeon.records)) {
    const previousStageId = EQUIPMENT_DUNGEON_STAGES[stageId2]?.previousStageId;
    if (previousStageId && !save.equipmentDungeon.records[previousStageId]) {
      ctx.addIssue({
        code: "custom",
        path: ["equipmentDungeon", "records", stageId2],
        message: `\u7F3A\u5C11\u524D\u7F6E\u5173\u5361\u8BB0\u5F55 ${previousStageId}`
      });
    }
  }
});
export {
  ARENA_JOIN_HONOR,
  CLASS_IDS,
  SLOT_ORDER,
  arenaTierFor,
  buildTrialCombatant,
  equipmentInstanceSchema,
  getEquipment,
  trialPlausibilityCap
};
