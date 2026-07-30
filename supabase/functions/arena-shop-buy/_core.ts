// ═══════════════════════════════════════════════════
// 生成文件，请勿手改。来源：src/core（见 _core-entry.ts）
// 重新生成：npm run edge:build
// ═══════════════════════════════════════════════════

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

// src/data/region5.ts
var REGION_5_SET_LEVEL = 50;

// src/data/arenaEquipment.ts
var ARENA_SET_ID = "set_arena_stigma";
var ARENA_EQUIPMENT_LEVEL = REGION_5_SET_LEVEL + 10;
var SPECS = [
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
function buildDefinition(spec) {
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
var ARENA_EQUIPMENT_LIST = SPECS.map(buildDefinition);
var ARENA_EQUIPMENT = Object.fromEntries(
  ARENA_EQUIPMENT_LIST.map((definition) => [definition.id, definition])
);

// src/core/types.ts
var CLASS_IDS = ["swordsman", "witch", "shaman", "catkin"];
export {
  ARENA_EQUIPMENT_LIST,
  ARENA_SHOP_ENTRIES,
  CLASS_IDS
};
