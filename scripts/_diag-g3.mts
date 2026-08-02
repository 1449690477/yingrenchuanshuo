import { combatPower, addStats } from '../src/core/formula';
import { baseStatsFor } from '../src/core/progression';
import { expectedBuildCp, expectedGearStats, TYPICAL_ENHANCE_MUL } from '../src/data/expectedPower';
import { typicalQualityAt } from '../src/data/qualitySchedule';

for (const L of [6, 10, 15, 20, 25, 30, 40, 50, 60, 68, 78]) {
  const q = typicalQualityAt(L);
  const gear = expectedGearStats(L, q);
  const enhanced = {
    atk: gear.atk * TYPICAL_ENHANCE_MUL,
    def: gear.def * TYPICAL_ENHANCE_MUL,
    hp: gear.hp * TYPICAL_ENHANCE_MUL,
    acc: gear.acc * TYPICAL_ENHANCE_MUL,
    eva: gear.eva * TYPICAL_ENHANCE_MUL,
    critRate: gear.critRate,
    critDmg: gear.critDmg,
    spd: gear.spd,
  };
  const simCp = combatPower(addStats(baseStatsFor('swordsman', L), enhanced));
  const recCp = expectedBuildCp(L);
  console.log(`Lv${L} q=${q} sim=${Math.round(simCp)} rec=${Math.round(recCp)} ratio=${(simCp / recCp).toFixed(2)}`);
}