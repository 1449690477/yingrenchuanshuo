import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { createFixedInstance, createInstance } from '../src/core/equipment';
import { planAffixChange } from '../src/core/reforge';
import { Rng } from '../src/core/rng';
import { requireEquipment } from '../src/data/equipment';
import { REFORGE_MATERIAL_IDS, requireRegionReforgeMaterials } from '../src/data/reforgeRules';
import { SHOP_OFFERS } from '../src/data/shop';
import { createSave, parseSave } from '../src/save/schema';

const qaNow = Date.now();
const output = resolve(process.argv[2] ?? resolve(tmpdir(), 'sakura-reforge-browser-save.json'));
const save = createSave('词条洗练验收', 'swordsman', 0x20260728, qaNow);

save.player.level = 35;
save.player.gold = 1_000_000;
save.bag.items = {
  [REFORGE_MATERIAL_IDS.reforge]: 999,
  [REFORGE_MATERIAL_IDS.temper]: 999,
  [REFORGE_MATERIAL_IDS.bind]: 999,
  [REFORGE_MATERIAL_IDS.resonance]: 99,
  sigil_swordsman: 99,
  petal_sakura: 999,
  grass_soft: 999,
  bell_wood: 999,
};

const main = createInstance(
  requireEquipment('eq_r2_weapon_epic'),
  new Rng(20260728),
  'qa-reforge-main',
  save.player.classId,
);
const visibleTiers = [1, 2, 4, 5] as const;
main.affixes.forEach((affix, index) => {
  affix.tier = visibleTiers[index] ?? 3;
});
main.reforgeResonance = 20;
save.equipped.weapon = main;

const pendingSource = createInstance(
  requireEquipment('eq_r2_ring_epic'),
  new Rng(20260729),
  'qa-reforge-pending',
  save.player.classId,
);
const pendingPlan = planAffixChange({
  instance: pendingSource,
  definition: requireEquipment(pendingSource.defId),
  operation: 'temper',
  classId: save.player.classId,
  lockedIndices: pendingSource.affixes.map((_, index) => index).slice(1),
  regionMaterials: requireRegionReforgeMaterials('r1'),
  wallet: { gold: save.player.gold, items: save.bag.items },
  rngState: 20260730,
});
if (!pendingPlan.ok) {
  throw new Error(`无法生成洗练待决验收装备：${pendingPlan.reason}`);
}
save.bag.equipment.push(pendingPlan.instance);

const fixedDefinition = requireEquipment(SHOP_OFFERS[0]!.defId);
save.bag.equipment.push(createFixedInstance(fixedDefinition, 'qa-reforge-fixed', true));
save.nextUid = 4;

const validated = parseSave(save);
await writeFile(output, `${JSON.stringify(validated, null, 2)}\n`, 'utf8');
console.log(`词条洗练浏览器验收存档已生成：${output}`);
