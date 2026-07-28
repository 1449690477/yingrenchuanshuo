import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { CLASS_IDS } from '../src/core/types';
import { AFFECTION_CHARACTERS } from '../src/data/affection';
import { createSave, parseSave } from '../src/save/schema';

const QA_NOW = Date.now();
const output = resolve(
  process.argv[2] ?? resolve(tmpdir(), 'sakura-affection-round2-browser-save.json'),
);
const save = createSave('好感二批验收', 'witch', 20260728, QA_NOW);

save.player.level = 45;
save.player.gold = 1_000_000;
for (const classId of CLASS_IDS) {
  const stories = AFFECTION_CHARACTERS[classId].stories;
  const progress = save.affection.characters[classId];
  progress.points = 1_400;
  for (const story of stories.slice(0, 5)) {
    progress.completedStoryIds.push(story.id);
    progress.choiceHistory[story.id] = story.choices[0]!.id;
  }
}

const validated = parseSave(save);
await writeFile(output, `${JSON.stringify(validated, null, 2)}\n`, 'utf8');
console.log(`第二批好感浏览器验收存档已生成：${output}`);
