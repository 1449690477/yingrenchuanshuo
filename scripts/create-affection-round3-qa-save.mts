import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { CLASS_IDS } from '../src/core/types';
import { AFFECTION_CHARACTERS } from '../src/data/affection';
import { AFFECTION_GIFT_LIST } from '../src/data/affectionGifts';
import { createSave, parseSave } from '../src/save/schema';

const qaNow = Date.now();
const output = resolve(
  process.argv[2] ?? resolve(tmpdir(), 'sakura-affection-round3-browser-save.json'),
);
const save = createSave('好感第三批验收', 'catkin', 20260728, qaNow);

save.player.level = 45;
save.player.gold = 1_000_000;

for (const gift of AFFECTION_GIFT_LIST) {
  save.bag.items[gift.cost.itemId] = 99;
}

for (const classId of CLASS_IDS) {
  const stories = AFFECTION_CHARACTERS[classId].stories;
  const progress = save.affection.characters[classId];
  progress.points = 2_600;
  for (const story of stories.slice(0, 8)) {
    progress.completedStoryIds.push(story.id);
    progress.choiceHistory[story.id] = story.choices[0]!.id;
  }
}

const validated = parseSave(save);
await writeFile(output, `${JSON.stringify(validated, null, 2)}\n`, 'utf8');
console.log(`第三批好感浏览器验收存档已生成：${output}`);
