import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { createInstance } from '../src/core/equipment';
import { Rng } from '../src/core/rng';
import { SLOT_ORDER, ENHANCE_MAX } from '../src/data/constants';
import { requireEquipment } from '../src/data/equipment';
import { ORDERED_STAGE_IDS } from '../src/data/stages';
import { REGION_34_MATERIALS } from '../src/data/region34';
import { createSave, parseSave } from '../src/save/schema';

const QA_NOW = Date.now();
const output = resolve(
  process.argv[2] ?? resolve(tmpdir(), 'sakura-region34-browser-save.json'),
);
const save = createSave('区域三四验收', 'catkin', 20260728, QA_NOW);
const rng = new Rng(20260728);
const currentStageId = 'stage_4-5_6';
const currentIndex = ORDERED_STAGE_IDS.indexOf(currentStageId);

if (currentIndex < 0) {
  throw new Error(`区域 3/4 尚未原子接入关卡顺序：${currentStageId}`);
}

save.player.level = 40;
save.player.exp = 0;
save.player.gold = 10_000_000;
save.player.stamina = 120;
save.progress.currentStageId = currentStageId;
save.progress.clearedStageIds = ORDERED_STAGE_IDS.slice(0, currentIndex);
save.progress.stageKills = {};

for (const material of REGION_34_MATERIALS) {
  save.bag.items[material.id] = 999;
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
]) {
  save.bag.items[itemId] = 999;
}

for (const slot of SLOT_ORDER) {
  const definition = requireEquipment(`eq_r4_${slot}_epic`);
  const instance = createInstance(definition, rng, `qa-r4-${slot}`, 'catkin');
  instance.enhance = 12;
  instance.enhanceGainPermille = Array.from(
    { length: ENHANCE_MAX },
    (_, index) => (index < instance.enhance ? 80 : 0),
  );
  save.equipped[slot] = instance;
}

const validated = parseSave(save);
await writeFile(output, `${JSON.stringify(validated, null, 2)}\n`, 'utf8');
console.log(`区域 3/4 浏览器验收存档已生成：${output}`);
