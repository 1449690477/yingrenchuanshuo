// ═══════════════════════════════════════════════════
// 生成文件，请勿手改。来源：src/core（见 _core-entry.ts）
// 重新生成：npm run edge:build
// ═══════════════════════════════════════════════════

// src/data/constants.ts
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
var OFFLINE_CAP_SECONDS = 8 * 3600;
var SWEEP_EQUIV_SECONDS = 30 * 60;

// src/core/rng.ts
var Rng = class _Rng {
  state;
  constructor(seed) {
    this.state = seed >>> 0 || 2654435769;
  }
  /** [0, 1) 均匀分布 */
  next() {
    this.state = this.state + 1831565813 >>> 0;
    let t = this.state;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  /** [min, max) 浮点 */
  float(min, max) {
    return min + this.next() * (max - min);
  }
  /** [min, max] 整数，闭区间 */
  int(min, max) {
    return Math.floor(this.float(min, max + 1));
  }
  /** 以 p 的概率返回 true。p 为 0~1 */
  chance(p) {
    return this.next() < p;
  }
  /** 从数组等概率取一个 */
  pick(arr) {
    if (arr.length === 0) throw new Error("Rng.pick: \u6570\u7EC4\u4E3A\u7A7A");
    return arr[this.int(0, arr.length - 1)];
  }
  /**
   * 按权重取一个。权重不必归一化。
   * 见 docs/02-数据表规范.md —— 掉落表用权重制而非概率制，
   * 这样加新掉落物时不用重算所有概率。
   */
  weighted(items, weightOf) {
    if (items.length === 0) throw new Error("Rng.weighted: \u6570\u7EC4\u4E3A\u7A7A");
    let total = 0;
    for (const it of items) {
      const w = weightOf(it);
      if (w < 0) throw new Error("Rng.weighted: \u6743\u91CD\u4E0D\u80FD\u4E3A\u8D1F");
      total += w;
    }
    if (total <= 0) throw new Error("Rng.weighted: \u603B\u6743\u91CD\u5FC5\u987B\u5927\u4E8E 0");
    let r = this.next() * total;
    for (const it of items) {
      r -= weightOf(it);
      if (r < 0) return it;
    }
    return items[items.length - 1];
  }
  /**
   * 派生一个子生成器。
   * 用途：每场战斗 / 每次强化 / 每次掉落各自持有独立的 Rng，
   * 互不干扰，且整体仍由一个主种子决定。
   */
  derive(salt) {
    const s = Math.imul(this.state ^ salt >>> 0, 2246822507) >>> 0;
    return new _Rng(s);
  }
  /** 导出当前状态，用于存档 */
  getState() {
    return this.state;
  }
  /** 从存档恢复状态 */
  setState(state) {
    this.state = state >>> 0;
  }
};

// src/core/dayKey.ts
function businessDayKey(now, resetHourCst = 4) {
  if (!Number.isFinite(now) || now < 0) {
    throw new Error(`[\u65E5\u5207] now \u5FC5\u987B\u662F\u975E\u8D1F\u6709\u9650\u65F6\u95F4\u6233\uFF0C\u6536\u5230 ${now}`);
  }
  if (!Number.isInteger(resetHourCst) || resetHourCst < 0 || resetHourCst > 23) {
    throw new Error(`[\u65E5\u5207] resetHourCst \u5FC5\u987B\u662F 0~23 \u7684\u6574\u6570\uFF0C\u6536\u5230 ${resetHourCst}`);
  }
  const shifted = new Date(now + (8 - resetHourCst) * 36e5);
  return shifted.toISOString().slice(0, 10);
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
var classSpecs = (classId, baseTheme, entries) => entries.map((entry, index) => ({
  ...entry,
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
var AFFECTION_EQUIPMENT = Object.fromEntries(AFFECTION_EQUIPMENT_LIST.map((entry) => [entry.definition.id, entry]));

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

// src/data/region7.ts
var REGION_7 = {
  id: "r7",
  index: 7,
  name: "\u8840\u6708\u5CE1\u8C37",
  subtitle: "\u8D64\u6708\u7167\u7740\u96FE\u6D77\uFF0C\u4E5F\u7167\u4EAE\u5CE1\u8C37\u5C3D\u5934\u7684\u796D\u53F0",
  levelFrom: 65,
  levelTo: 78,
  theme: ["#8e263f", "#e86f8e"],
  mapAsset: "assets/maps/r7.webp",
  chapters: [
    {
      id: "7-1",
      name: "\u5CE1\u8C37\u5165\u53E3",
      levelFrom: 65,
      levelTo: 68,
      element: "fire",
      normals: ["\u8840\u6708\u7ED2\u8760", "\u5CE1\u8C37\u706F\u7B3C\u9B3C", "\u8D64\u6676\u89D2\u5154", "\u96FE\u884C\u5C0F\u6076\u9B54"],
      materials: ["dew_bloodmist", "herb_soulbreak"],
      tutorial: "\u8840\u6708\u5CE1\u8C37\u7684\u654C\u4EBA\u504F\u708E\u5C5E\u6027\uFF1B\u65B0\u533A\u96F7\u5C5E\u6027\u6B66\u5668\u80FD\u591F\u514B\u5236\u5B83\u4EEC\u3002",
      mapAsset: "assets/maps/chapter-7-1.webp",
      battleAsset: "assets/battlefields/chapter-7-1.webp"
    },
    {
      id: "7-2",
      name: "\u8840\u96FE\u6CBC\u6CFD",
      levelFrom: 68,
      levelTo: 70,
      element: "fire",
      normals: ["\u8840\u6CBC\u8F6F\u6CE5\u602A", "\u7EEF\u96FE\u9B45\u7075", "\u6CBC\u6CFD\u9B54\u8548\u5A18", "\u8840\u82D4\u56E2\u5B50"],
      elite: "\u8840\u96FE\u9B54\u5973",
      materials: ["dew_bloodmist", "herb_soulbreak", "horn_demon"],
      mapAsset: "assets/maps/chapter-7-2.webp",
      battleAsset: "assets/battlefields/chapter-7-2.webp"
    },
    {
      id: "7-3",
      name: "\u65AD\u9B42\u5D16",
      levelFrom: 70,
      levelTo: 73,
      element: "fire",
      normals: ["\u65AD\u9B42\u5D16\u9E26", "\u8D64\u85E4\u6500\u884C\u8005", "\u5D16\u98CE\u9B45\u5F71", "\u9B42\u706F\u89D2\u517D"],
      materials: ["dew_bloodmist", "herb_soulbreak"],
      mapAsset: "assets/maps/chapter-7-3.webp",
      battleAsset: "assets/battlefields/chapter-7-3.webp"
    },
    {
      id: "7-4",
      name: "\u6076\u9B54\u96C6\u4F1A\u6240",
      levelFrom: 73,
      levelTo: 76,
      element: "fire",
      normals: ["\u6076\u9B54\u4F8D\u7AE5", "\u6708\u75D5\u77F3\u50CF\u9B3C", "\u7EA2\u7F0E\u9B45\u7075", "\u4E09\u53C9\u621F\u5C0F\u9B3C"],
      elite: "\u5C0F\u6076\u9B54\u5A18\u4E09\u59D0\u59B9",
      materials: ["dew_bloodmist", "herb_soulbreak", "horn_demon"],
      mapAsset: "assets/maps/chapter-7-4.webp",
      battleAsset: "assets/battlefields/chapter-7-4.webp"
    },
    {
      id: "7-5",
      name: "\u8840\u6708\u796D\u53F0",
      levelFrom: 76,
      levelTo: 78,
      element: "fire",
      normals: ["\u8840\u6708\u796D\u53F8", "\u7329\u7EA2\u7977\u7075", "\u6708\u8680\u5B88\u536B", "\u8389\u8389\u59C6\u8FD1\u4F8D"],
      elite: "\u8840\u6708\u5927\u796D\u53F8",
      boss: "\u8840\u6708\u6076\u9B54\xB7\u8389\u8389\u59C6",
      materials: ["dew_bloodmist", "herb_soulbreak", "horn_demon", "eye_bloodmoon"],
      mapAsset: "assets/maps/chapter-7-5.webp",
      battleAsset: "assets/battlefields/chapter-7-5.webp"
    }
  ]
};
var REGION_7_EQUIPMENT_THEME = {
  regionId: "r7",
  themeName: "\u8840\u6708\u5CE1\u8C37\u7CFB",
  level: 69,
  qualities: ["epic", "legendary"],
  visualKeywords: ["\u8840\u7EA2", "\u7384\u9ED1", "\u94F6\u767D\u6708\u7EB9", "\u6076\u9B54\u89D2"],
  names: {
    weapon: "\u8840\u6708\u65AD\u9B42\u5203",
    head: "\u8D64\u89D2\u6708\u51A0",
    body: "\u7EEF\u96FE\u5CE1\u8C37\u793C\u88C5",
    necklace: "\u8840\u96FE\u51DD\u9732\u5760",
    bracelet: "\u6076\u9B54\u89D2\u956F",
    ring: "\u6708\u8680\u8A93\u6212",
    belt: "\u7384\u7EA2\u675F\u9B42\u5E26",
    shoes: "\u65AD\u5D16\u591C\u884C\u9774"
  },
  weaponNames: {
    swordsman: "\u8840\u6708\u65AD\u9B42\u5251",
    witch: "\u6708\u8680\u7EEF\u661F\u6756",
    shaman: "\u8D64\u96FE\u5F15\u9B42\u6247",
    catkin: "\u8840\u6708\u88C2\u9B42\u53CC\u722A"
  }
};
var REGION_7_SET_ID = "set_region_bloodmoon";
var REGION_7_SET_LEVEL = 76;
var REGION_7_SET_QUALITY = "legendary";
var REGION_7_SET_SLOTS = [
  "weapon",
  "head",
  "body",
  "necklace",
  "bracelet",
  "ring",
  "belt",
  "shoes"
];
var REGION_7_SET_NAMES = {
  weapon: "\u8389\u8389\u59C6\u6708\u8680\u5203",
  head: "\u8840\u6708\u7737\u5C5E\u51A0",
  body: "\u8389\u8389\u59C6\u6DF1\u7EA2\u793C\u88C5",
  necklace: "\u6708\u77B3\u9B42\u5760",
  bracelet: "\u6076\u9B54\u8A93\u956F",
  ring: "\u6708\u8680\u8840\u6212",
  belt: "\u6DF1\u7EA2\u675F\u9B42\u5E26",
  shoes: "\u7EEF\u96FE\u8E0F\u6708\u9774"
};
var REGION_7_SET_WEAPON_NAMES = {
  swordsman: "\u8389\u8389\u59C6\u6708\u8680\u5251",
  witch: "\u8389\u8389\u59C6\u8840\u661F\u6756",
  shaman: "\u8389\u8389\u59C6\u5524\u6708\u6247",
  catkin: "\u8389\u8389\u59C6\u7EEF\u6708\u53CC\u722A"
};
function region7SetEquipmentId(slot) {
  return `eq_set_region_bloodmoon_${slot}`;
}

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
  REGION_6,
  REGION_7
];
var ALL_CHAPTERS = REGIONS.flatMap((r) => r.chapters);

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

// src/data/arenaEquipment.ts
var ARENA_SET_ID = "set_arena_stigma";
var MAX_CONTENT_LEVEL = Math.max(...ALL_CHAPTERS.map((chapter) => chapter.levelTo));
var ARENA_EQUIPMENT_LEVEL = MAX_CONTENT_LEVEL;
var ARENA_EQUIPMENT_QUALITY = typicalQualityAt(MAX_CONTENT_LEVEL);
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
    quality: ARENA_EQUIPMENT_QUALITY,
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
  r6: "ice",
  // 血月峡谷以炎属性怪为主，R7 雷武器闭合炎 → 冰 → 雷 → 炎教学环。
  r7: "thunder"
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
  },
  {
    regionId: REGION_7_EQUIPMENT_THEME.regionId,
    level: REGION_7_EQUIPMENT_THEME.level,
    weaponElement: REGION_WEAPON_ELEMENTS.r7,
    qualities: [...REGION_7_EQUIPMENT_THEME.qualities],
    icons: Object.fromEntries(
      SLOT_ORDER.map((slot) => [slot, `assets/equipment/r7/${slot}.png`])
    ),
    names: REGION_7_EQUIPMENT_THEME.names,
    weaponNames: REGION_7_EQUIPMENT_THEME.weaponNames
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
var BOUTIQUE_EXTRA_AFFIX_SLOTS = {
  epic: 1,
  legendary: 1,
  mythic: 2
};
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
  for (const slot of REGION_7_SET_SLOTS) {
    const id = region7SetEquipmentId(slot);
    const common = {
      id,
      name: REGION_7_SET_NAMES[slot],
      quality: REGION_7_SET_QUALITY,
      level: REGION_7_SET_LEVEL,
      setId: REGION_7_SET_ID,
      icon: `assets/equipment/sets/r7-bloodmoon/${slot}.png`,
      appearanceId: `r7-set-${slot}`
    };
    out[id] = slot === "weapon" ? {
      ...common,
      slot,
      element: REGION_WEAPON_ELEMENTS.r7,
      classPresentations: weaponClassPresentations(
        "r7-set-weapon",
        REGION_7_SET_WEAPON_NAMES
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
        // 额外可洗槽（2026-07-30 品质平衡）：珍品的固定词条是「身份」，
        // 额外槽是「养成空间」。没有它，商店装买回来就定死、越玩越弱 ——
        // 所有者反馈「红装卖得贵却不如掉落黄装」的核心原因。
        // 按品质递增，让越贵的珍品越值得长期养。
        extraAffixSlots: BOUTIQUE_EXTRA_AFFIX_SLOTS[theme.quality],
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
  for (const entry of AFFECTION_EQUIPMENT_LIST) {
    const definition = entry.definition;
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
var REGION_BLOODMOON_SET_ID = "set_region_bloodmoon";
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
  },
  [REGION_BLOODMOON_SET_ID]: {
    id: REGION_BLOODMOON_SET_ID,
    name: "\u8840\u6708\u5957",
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
        label: "\u8D64\u6708\u950B\u8292",
        description: "\u653B\u51FB +10%",
        statPercent: { atk: 0.1 }
      },
      {
        pieces: 4,
        label: "\u6708\u8680\u5FC3\u8DF3",
        description: "\u66B4\u51FB\u7387 +8%",
        statFlat: { critRate: 8 }
      },
      {
        pieces: 6,
        label: "\u5CE1\u8C37\u7737\u987E",
        description: "\u6280\u80FD\u4F24\u5BB3 +18%",
        skillMultiplierBonus: 0.18
      },
      {
        pieces: 8,
        label: "\u8840\u6708\u7684\u7737\u5C5E",
        description: "\u89E3\u9501\u540C\u540D\u79F0\u53F7\u4E0E\u8840\u6708\u5FBD\u8BB0\u5916\u89C2\uFF08\u65E0\u6218\u6597\u5C5E\u6027\uFF09"
      }
    ]
  }
};
var REGION_CRIMSON_SET = REGION_EQUIPMENT_SETS[REGION_CRIMSON_SET_ID];
var REGION_SHADOW_SET = REGION_EQUIPMENT_SETS[REGION_SHADOW_SET_ID];
var REGION_BLOODMOON_SET = REGION_EQUIPMENT_SETS[REGION_BLOODMOON_SET_ID];

// src/data/equipmentSets.ts
var EQUIPMENT_SETS = {
  ...EQUIPMENT_DUNGEON_SETS,
  ...REGION_EQUIPMENT_SETS,
  [ARENA_SET_ID]: ARENA_EQUIPMENT_SET
};
var ARENA_SET_FIELD_STUB = {
  ...ARENA_EQUIPMENT_SET,
  bonuses: []
};

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

// src/data/arenaRules.ts
var ARENA_RESET_HOUR_CST = 4;
var ARENA_DEFENSE_REWARD_HELD = 8;
var ARENA_DEFENSE_REWARD_BROKEN = 3;
var ARENA_DEFENSE_REWARD_DAILY_CAP = 200;
var ARENA_TIERS = [
  { id: "yingguan", name: "\u6A31\u51A0", topRank: 10, topPercent: null, dailyHonor: 300, dailyBoxes: { sacred: 2, starlight: 0 } },
  { id: "feiying", name: "\u7EEF\u6A31", topRank: 100, topPercent: null, dailyHonor: 200, dailyBoxes: { sacred: 1, starlight: 0 } },
  { id: "hupo", name: "\u7425\u73C0", topRank: null, topPercent: 0.3, dailyHonor: 120, dailyBoxes: { sacred: 0, starlight: 2 } },
  { id: "feiyue", name: "\u7EEF\u6708", topRank: null, topPercent: 0.6, dailyHonor: 80, dailyBoxes: { sacred: 0, starlight: 1 } },
  { id: "qingying", name: "\u9752\u6A31", topRank: null, topPercent: null, dailyHonor: 50, dailyBoxes: { sacred: 0, starlight: 1 } }
];

// src/core/duel.ts
function arenaDayKey(now) {
  return businessDayKey(now, ARENA_RESET_HOUR_CST);
}
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

// src/data/arenaShop.ts
var ARENA_SHOP_PRICES = {
  weapon: 1500,
  head: 1200,
  body: 1200,
  ring: 900
};
var ARENA_SHOP_SLOTS = ["weapon", "head", "body", "ring"];
var ARENA_SHOP_CLASSES = ["swordsman", "witch", "shaman", "catkin"];
var ARENA_SHOP_ENTRIES = ARENA_SHOP_CLASSES.flatMap(
  (classId) => ARENA_SHOP_SLOTS.map((slot) => ({
    id: `arena_${classId}_${slot}`,
    classId,
    slot,
    price: ARENA_SHOP_PRICES[slot]
  }))
);
var ARENA_BOXES = {
  box_starlight: {
    id: "box_starlight",
    name: "\u661F\u8F89\u5323",
    reward: {
      honor: { min: 30, max: 80 },
      items: {
        stone_reforge: [3, 8],
        sand_crystal: [1, 3]
      }
    }
  },
  box_sacred: {
    id: "box_sacred",
    name: "\u5723\u75D5\u5323",
    reward: {
      honor: { min: 120, max: 200 },
      items: {
        stone_reforge: 10,
        frag_stigma: [1, 3]
      }
    }
  }
};
export {
  ARENA_BOXES,
  ARENA_DEFENSE_REWARD_BROKEN,
  ARENA_DEFENSE_REWARD_DAILY_CAP,
  ARENA_DEFENSE_REWARD_HELD,
  ARENA_RESET_HOUR_CST,
  ARENA_TIERS,
  Rng,
  arenaDayKey,
  arenaTierFor,
  fnv1a32
};
