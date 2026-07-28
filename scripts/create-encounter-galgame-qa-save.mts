import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { createSave, parseSave } from '../src/save/schema';

const QA_NOW = Date.now();
const output = resolve(
  process.argv[2] ?? resolve(tmpdir(), 'sakura-encounter-galgame-browser-save.json'),
);
const save = createSave('奇遇演出验收', 'swordsman', 20260728, QA_NOW);

save.player.level = 25;
save.player.gold = 1_000_000;
save.bag.items = {
  petal_sakura: 99,
  grass_soft: 99,
  bell_wood: 99,
  core_barrier: 99,
  straw_sleepy: 99,
  jelly_cotton: 99,
  honey_bee: 99,
  crystal_altar: 99,
};

save.encounters = {
  progressSec: 0,
  generatedCount: 12,
  resolvedCount: 9,
  pending: [
    {
      uid: 'qa-akane-daily',
      encounterId: 'enc_r1_petalsmith_daily',
      regionId: 'r1',
    },
    {
      uid: 'qa-sui-climax',
      encounterId: 'enc_r2_napper_true_delivery',
      regionId: 'r2',
      storyChoiceId: 'trust_her',
    },
    {
      uid: 'qa-ordinary-environment',
      encounterId: 'enc_r1_bell',
      regionId: 'r1',
    },
  ],
  characters: {
    char_akane: {
      bond: 3,
      completedEncounterIds: [
        'enc_r1_petalsmith',
        'enc_r1_petalsmith_doubt',
        'enc_r1_petalsmith_first_blade',
      ],
      choiceHistory: {
        enc_r1_petalsmith: 'lasting_grip',
        enc_r1_petalsmith_doubt: 'ask_herself',
        enc_r1_petalsmith_first_blade: 'give_name',
      },
    },
    char_sui: {
      bond: 2,
      completedEncounterIds: ['enc_r2_napper', 'enc_r2_napper_old_letter'],
      choiceHistory: {
        enc_r2_napper: 'take_breath',
        enc_r2_napper_old_letter: 'apologize',
      },
    },
  },
};

const validated = parseSave(save);
await writeFile(output, `${JSON.stringify(validated, null, 2)}\n`, 'utf8');
console.log(`奇遇 Galgame 浏览器验收存档已生成：${output}`);
