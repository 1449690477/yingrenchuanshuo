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
var ALL_CHAPTERS = REGIONS.flatMap((r) => r.chapters);

// src/data/constants.ts
var OFFLINE_CAP_SECONDS = 8 * 3600;
var SWEEP_EQUIV_SECONDS = 30 * 60;

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
