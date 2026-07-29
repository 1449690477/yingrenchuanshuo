import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createInstance } from '../src/core/equipment';
import { Rng } from '../src/core/rng';
import type { EquipmentInstance } from '../src/core/types';
import { ENHANCE_MAX, SLOT_ORDER } from '../src/data/constants';
import { requireEquipment } from '../src/data/equipment';
import {
  REGION_5_FRAGMENT_ID,
  REGION_5_MATERIALS,
  region5SetEquipmentId,
} from '../src/data/region5';
import { ORDERED_STAGE_IDS } from '../src/data/stages';
import { createSave, parseSave } from '../src/save/schema';

const QA_NOW = Date.now();
const QA_CLASS = 'catkin';
const output = resolve(process.argv[2] ?? resolve(tmpdir(), 'sakura-region5-browser-save.json'));
const save = createSave('熔岩神殿验收', QA_CLASS, 20260729, QA_NOW);
const rng = new Rng(20260729);
const currentStageId = 'stage_5-5_6';
const currentIndex = ORDERED_STAGE_IDS.indexOf(currentStageId);

if (currentIndex < 0) {
  throw new Error(`区域 5 尚未原子接入关卡顺序：${currentStageId}`);
}

save.player.level = 52;
save.player.exp = 0;
save.player.gold = 50_000_000;
save.player.stamina = 120;
save.progress.currentStageId = currentStageId;
save.progress.clearedStageIds = ORDERED_STAGE_IDS.slice(0, currentIndex);
save.progress.stageKills = {};

for (const material of REGION_5_MATERIALS) {
  save.bag.items[material.id] = material.id === REGION_5_FRAGMENT_ID ? 240 : 999;
}
for (const itemId of [
  'stone_enhance',
  'ore_black',
  'lucky_nine',
  'charm_protect',
  'stone_reforge',
  'sand_crystal',
  'charm_bind',
  'sigil_catkin',
  'crystal_resonance',
  // r4 → r5 升阶的两档真实材料。
  'rubbing_epitaph',
  'tear_eternal',
]) {
  save.bag.items[itemId] = 999;
}

function qaEquipment(
  defId: string,
  uid: string,
  enhance: number,
  locked = false,
): EquipmentInstance {
  const instance = createInstance(requireEquipment(defId), rng, uid, QA_CLASS);
  instance.enhance = enhance;
  instance.enhanceGainPermille = Array.from({ length: ENHANCE_MAX }, (_, index) =>
    index < enhance ? 80 : 0,
  );
  instance.locked = locked;
  return instance;
}

// 先穿一身 R5 史诗普通装，保持普通换装、强化光效和终章战斗可直接检查。
for (const slot of SLOT_ORDER) {
  save.equipped[slot] = qaEquipment(
    `eq_r5_${slot}_epic`,
    `qa-r5-equipped-${slot}`,
    slot === 'weapon' ? 15 : 13,
  );
}

// 再把武器与头冠换成绯焰件：进入页面时真实激活 2 件效果，
// 玩家可继续重铸衣裙看到 2 → 3 件进度，不会一上来就把全套目标做完。
save.equipped.weapon = qaEquipment(
  region5SetEquipmentId('weapon'),
  'qa-crimson-equipped-weapon',
  15,
  true,
);
save.equipped.head = qaEquipment(
  region5SetEquipmentId('head'),
  'qa-crimson-equipped-head',
  13,
  true,
);

// 八个 R5 传说普通装都留在背包，用于检查同部位共图、品质边框和掉落峰值展示。
for (const slot of SLOT_ORDER) {
  save.bag.equipment.push(qaEquipment(`eq_r5_${slot}_legendary`, `qa-r5-legendary-${slot}`, 0));
}

// 两条 r4 → r5 候选分别覆盖 rare / epic；实例投入必须在升阶后完整保留。
for (const quality of ['rare', 'epic'] as const) {
  const candidate = qaEquipment(
    `eq_r4_weapon_${quality}`,
    `qa-r4-r5-advancement-${quality}`,
    quality === 'epic' ? 12 : 9,
    true,
  );
  candidate.enhanceLuck[String(candidate.enhance + 1)] = quality === 'epic' ? 57 : 31;
  candidate.reforgeResonance = quality === 'epic' ? 19 : 12;
  save.bag.equipment.push(candidate);
}

const validated = parseSave(save);
await writeFile(output, `${JSON.stringify(validated, null, 2)}\n`, 'utf8');
console.log(`区域 5 浏览器验收存档已生成：${output}`);
console.log('验收起点：5-5-6，绯焰 2/6 件已穿戴，绯焰碎片 240 枚。');
