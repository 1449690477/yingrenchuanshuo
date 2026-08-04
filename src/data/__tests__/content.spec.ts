import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { CLASS_IDS } from '../../core/types';
import { countStageMonsterKills } from '../../core/stageLoot';
import { CLASS_VISUALS } from '../classVisuals';
import {
  BASIC_ATTACK_EFFECTS,
  CHARACTER_BASE_ASSETS,
  CHARACTER_BASE_NOSHOES_ASSETS,
  EQUIPMENT_APPEARANCES,
  growthTierFor,
} from '../characterAppearance';
import {
  ALL_SKILLS,
  CATKIN_VISUAL_SKILLS,
  KENSHI_VISUAL_SKILLS,
  SHAMAN_VISUAL_SKILLS,
  SWORDSMAN_VISUAL_SKILLS,
  WITCH_VISUAL_SKILLS,
  battleRhythmSkills,
  rhythmSkillEffect,
} from '../skills';

function requireSkill(skillId: string) {
  const skill = ALL_SKILLS.find((entry) => entry.id === skillId);
  if (!skill) throw new Error(`测试引用了不存在的技能：${skillId}`);
  return skill;
}
import { EQUIPMENT } from '../equipment';
import { ITEMS } from '../items';
import { LOOT_TABLES } from '../lootTables';
import { MONSTERS } from '../monsters';
import { MONSTER_VISUALS } from '../monsterVisuals';
import { ALL_CHAPTERS, REGIONS } from '../regions';
import { FIRST_STAGE_ID, ORDERED_STAGE_IDS, STAGES } from '../stages';
import { SYSTEM_VISUALS } from '../systemVisuals';
import { BOUTIQUE_SHELF_LIST, BOUTIQUE_THEME_LIST } from '../boutique';
import { SHOP_OFFERS } from '../shop';
import {
  AFFIX_ELEMENT_OPTIONS,
  AFFIX_ELEMENT_UNLOCK_LEVELS,
  ENHANCE_MATERIAL_IDS,
  QUALITY_AFFIX_COUNT,
  SLOT_ORDER,
} from '../constants';
import {
  ENHANCE_PROGRESSION,
  ENHANCE_PROGRESSION_MATERIAL_IDS,
  requireEnhanceProgression,
} from '../enhanceProgression';

describe('区域 1–5 内容完整性', () => {
  it('每把武器显式登记攻击元素，非武器禁止携带元素字段', () => {
    const validElements = new Set(['none', 'fire', 'ice', 'thunder']);
    for (const definition of Object.values(EQUIPMENT)) {
      if (definition.slot === 'weapon') {
        expect(Object.hasOwn(definition, 'element'), `${definition.id} 必须显式登记武器元素`).toBe(
          true,
        );
        expect(validElements.has(definition.element), `${definition.id} 元素非法`).toBe(true);
      } else {
        expect(
          Object.hasOwn(definition, 'element'),
          `${definition.id} 非武器不应携带 element`,
        ).toBe(false);
      }
    }

    expect(EQUIPMENT.eq_r1_weapon_common?.element).toBe('none');
    expect(EQUIPMENT.eq_r2_weapon_fine?.element).toBe('fire');
    expect(EQUIPMENT.eq_r3_weapon_rare?.element).toBe('fire');
    expect(EQUIPMENT.eq_r4_weapon_rare?.element).toBe('none');
  });

  it('每种元素词条都有不晚于解锁等级的真实武器来源', () => {
    const weapons = Object.values(EQUIPMENT).filter((definition) => definition.slot === 'weapon');

    for (const element of AFFIX_ELEMENT_OPTIONS) {
      const sources = weapons
        .filter((definition) => definition.element === element)
        .sort((a, b) => a.level - b.level || a.id.localeCompare(b.id));
      expect(sources.length, `${element} 必须至少有一把真实武器`).toBeGreaterThan(0);
      expect(
        sources[0]!.level,
        `${element} 最早来源 ${sources[0]!.id} 晚于词条解锁等级`,
      ).toBeLessThanOrEqual(AFFIX_ELEMENT_UNLOCK_LEVELS[element]);
    }
  });

  it('已登记的职业立绘文件都真实存在', () => {
    for (const [classId, visual] of Object.entries(CLASS_VISUALS)) {
      for (const asset of [visual.portrait, visual.castPortrait]) {
        if (!asset) continue;
        expect(existsSync(resolve('public', asset)), `${classId} → ${asset}`).toBe(true);
      }
    }
    expect(CLASS_VISUALS.witch.portrait).toBe('assets/characters/witch-sakura.png');
    expect(CLASS_VISUALS.witch.castPortrait).toBe('assets/characters/witch-sakura-cast.png');
    expect(CLASS_VISUALS.kenshi.portrait).toBe('assets/characters/kenshi-sakura.png');
    expect(CLASS_VISUALS.kenshi.castPortrait).toBe('assets/characters/kenshi-sakura-cast.png');
  });

  it('樱酱主立绘与拔刀施法立绘均为 640×960 RGBA，四角透明且无明显绿幕残留', async () => {
    for (const asset of [CLASS_VISUALS.kenshi.portrait, CLASS_VISUALS.kenshi.castPortrait]) {
      expect(asset).not.toBeNull();
      const { data, info } = await sharp(resolve('public', asset!))
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      expect({ width: info.width, height: info.height, channels: info.channels }, asset!).toEqual({
        width: 640,
        height: 960,
        channels: 4,
      });
      const cornerAlpha = [
        data[3],
        data[(info.width - 1) * info.channels + 3],
        data[(info.height - 1) * info.width * info.channels + 3],
        data[(info.height * info.width - 1) * info.channels + 3],
      ];
      expect(cornerAlpha, `${asset} 四角透明`).toEqual([0, 0, 0, 0]);

      let visible = 0;
      let greenResidue = 0;
      for (let offset = 0; offset < data.length; offset += info.channels) {
        const [red, green, blue, alpha] = data.subarray(offset, offset + info.channels);
        if (!alpha) continue;
        visible += 1;
        if (green! > 210 && green! > red! * 1.4 && green! > blue! * 1.4) {
          greenResidue += 1;
        }
      }
      expect(greenResidue / visible, `${asset} 绿幕残留比例`).toBeLessThanOrEqual(0.0005);
    }
  });

  it('魔女首批技能特效配置与文件完整', () => {
    expect(WITCH_VISUAL_SKILLS).toHaveLength(3);
    expect(WITCH_VISUAL_SKILLS.map((skill) => skill.name)).toEqual([
      '火球术',
      '抗拒火环',
      '地狱雷光',
    ]);
    for (const skill of WITCH_VISUAL_SKILLS) {
      expect(skill.class).toBe('witch');
      expect(skill.type).toBe('active');
      expect(skill.unlockLevel).toBeGreaterThan(0);
      expect(existsSync(resolve('public', skill.icon)), `${skill.id} icon`).toBe(true);
      expect(existsSync(resolve('public', skill.effectAsset)), `${skill.id} effect`).toBe(true);
    }
  });

  it('剑姬首批技能特效配置与文件完整', () => {
    expect(SWORDSMAN_VISUAL_SKILLS).toHaveLength(3);
    expect(SWORDSMAN_VISUAL_SKILLS.map((skill) => skill.name)).toEqual([
      '攻杀剑术',
      '半月弯刀',
      '烈火剑法',
    ]);
    for (const skill of SWORDSMAN_VISUAL_SKILLS) {
      expect(skill.class).toBe('swordsman');
      expect(skill.type).toBe('active');
      expect(skill.unlockLevel).toBeGreaterThan(0);
      expect(existsSync(resolve('public', skill.icon)), `${skill.id} icon`).toBe(true);
      expect(existsSync(resolve('public', skill.effectAsset)), `${skill.id} effect`).toBe(true);
    }
  });

  it('灵巫首批技能特效配置与文件完整', () => {
    expect(SHAMAN_VISUAL_SKILLS).toHaveLength(3);
    expect(SHAMAN_VISUAL_SKILLS.map((skill) => skill.name)).toEqual([
      '治愈术',
      '施毒术',
      '召唤骷髅',
    ]);
    for (const skill of SHAMAN_VISUAL_SKILLS) {
      expect(skill.class).toBe('shaman');
      expect(skill.type).toBe('active');
      expect(skill.unlockLevel).toBeGreaterThan(0);
      expect(existsSync(resolve('public', skill.icon)), `${skill.id} icon`).toBe(true);
      expect(existsSync(resolve('public', skill.effectAsset)), `${skill.id} effect`).toBe(true);
    }
  });

  it('喵喵 14 个技能与十套主动特效完整', () => {
    expect(CATKIN_VISUAL_SKILLS).toHaveLength(14);
    expect(CATKIN_VISUAL_SKILLS.filter((skill) => skill.type === 'active')).toHaveLength(10);
    expect(CATKIN_VISUAL_SKILLS.filter((skill) => skill.type === 'passive')).toHaveLength(4);
    for (const skill of CATKIN_VISUAL_SKILLS) {
      expect(skill.class).toBe('catkin');
      expect(skill.unlockLevel).toBeGreaterThan(0);
      expect(existsSync(resolve('public', skill.icon)), `${skill.id} icon`).toBe(true);
      expect(existsSync(resolve('public', skill.effectAsset)), `${skill.id} effect`).toBe(true);
    }
  });

  it('樱酱 14 个技能、9 套主动特效与 5 个被动图标完整且零猫灵别名', () => {
    expect(KENSHI_VISUAL_SKILLS).toHaveLength(14);
    expect(KENSHI_VISUAL_SKILLS.filter((skill) => skill.type === 'active')).toHaveLength(9);
    expect(KENSHI_VISUAL_SKILLS.filter((skill) => skill.type === 'passive')).toHaveLength(5);
    for (const skill of KENSHI_VISUAL_SKILLS) {
      expect(skill.class).toBe('kenshi');
      expect(skill.icon).toContain('assets/icons/skills/kenshi-');
      expect(skill.effectAsset).not.toContain('catkin');
      expect(existsSync(resolve('public', skill.icon)), `${skill.id} icon`).toBe(true);
      expect(existsSync(resolve('public', skill.effectAsset)), `${skill.id} effect`).toBe(true);
    }
    expect(
      KENSHI_VISUAL_SKILLS.find((skill) => skill.id === 'skill_kenshi_sakura_blizzard')
        ?.hitOffsetsMs,
    ).toEqual([0, 110, 220]);
    expect(
      KENSHI_VISUAL_SKILLS.find((skill) => skill.id === 'skill_kenshi_ice_heart')?.hitOffsetsMs,
    ).toEqual([0, 180]);
    expect(
      KENSHI_VISUAL_SKILLS.find((skill) => skill.id === 'skill_kenshi_thousand_sakura')
        ?.hitOffsetsMs,
    ).toEqual([0, 75, 150, 225, 300]);
  });

  it('数量达到区域 1–8 的内容目标', () => {
    expect(REGIONS).toHaveLength(8);
    expect(ALL_CHAPTERS).toHaveLength(40);
    expect(Object.keys(STAGES)).toHaveLength(240);
    expect(Object.keys(MONSTERS)).toHaveLength(192);
    // 原有 364 件 + 樱酱心虹好感装备 10 件 + 瞬樱竞技场装备 4 件，
    // 冰雪华年再增加五职业武器 5 件与七个通用槽 7 件。
    expect(Object.keys(EQUIPMENT)).toHaveLength(422);
    expect(Object.keys(LOOT_TABLES)).toHaveLength(120);
  });

  it('区域 3/4 各有八部位 × 精良/稀有/史诗 24 件装备', () => {
    const qualities = ['fine', 'rare', 'epic'] as const;
    const fineLevelByRegion = { r3: 26, r4: 36 } as const;

    for (const regionId of ['r3', 'r4'] as const) {
      const regionalDefinitions = Object.values(EQUIPMENT).filter((definition) =>
        definition.id.startsWith(`eq_${regionId}_`),
      );
      expect(regionalDefinitions, regionId).toHaveLength(24);

      for (const slot of SLOT_ORDER) {
        const variants = qualities.map((quality) => {
          const definition = EQUIPMENT[`eq_${regionId}_${slot}_${quality}`];
          expect(definition, `${regionId}/${slot}/${quality}`).toBeDefined();
          expect(definition?.slot).toBe(slot);
          expect(definition?.quality).toBe(quality);
          return definition!;
        });

        expect(variants[0].level, `${regionId}/${slot}/fine`).toBe(fineLevelByRegion[regionId]);
        expect(new Set(variants.map((definition) => definition.icon)).size).toBe(1);
        expect(new Set(variants.map((definition) => definition.appearanceId)).size).toBe(1);
      }
    }
  });

  it('所有 id 唯一且关卡顺序从第一关开始', () => {
    expect(new Set(ORDERED_STAGE_IDS).size).toBe(ORDERED_STAGE_IDS.length);
    expect(FIRST_STAGE_ID).toBe('stage_1-1_1');
    expect(ORDERED_STAGE_IDS[0]).toBe(FIRST_STAGE_ID);
  });

  it('每关都引用存在的章节、怪物和掉落表', () => {
    const chapterIds = new Set(ALL_CHAPTERS.map((chapter) => chapter.id));
    for (const stage of Object.values(STAGES)) {
      expect(chapterIds.has(stage.chapterId), stage.id).toBe(true);
      expect(stage.waves.length, stage.id).toBeGreaterThan(0);
      expect(LOOT_TABLES[stage.lootTableId], stage.id).toBeDefined();
      expect(stage.firstClearRewards.length, stage.id).toBeGreaterThan(0);
      for (const reward of stage.firstClearRewards) {
        expect(
          EQUIPMENT[reward.itemId] ?? ITEMS[reward.itemId],
          `${stage.id} 首通奖励 → ${reward.itemId}`,
        ).toBeDefined();
        expect(reward.count).toBeGreaterThan(0);
      }

      const waveMonsterIds = stage.waves.flatMap((wave) =>
        wave.monsters.map((monster) => monster.id),
      );
      expect(waveMonsterIds.length, stage.id).toBeGreaterThan(0);
      for (const monsterId of waveMonsterIds) {
        expect(MONSTERS[monsterId], `${stage.id} → ${monsterId}`).toBeDefined();
      }
      if (stage.bossId) {
        expect(MONSTERS[stage.bossId]?.type, stage.id).toBe('boss');
        expect(waveMonsterIds, stage.id).toContain(stage.bossId);
      }
    }
  });

  it('最终关普通击杀使用 normal 表，BOSS 表只由完整波次结算', () => {
    for (const stage of Object.values(STAGES)) {
      expect(stage.lootTableId.endsWith('_normal'), stage.id).toBe(true);
      if (!stage.bossId) continue;
      expect(MONSTERS[stage.bossId]!.lootTableId.endsWith('_boss'), stage.bossId).toBe(true);
    }
  });

  it('每只怪物都引用存在的掉落表', () => {
    for (const monster of Object.values(MONSTERS)) {
      expect(LOOT_TABLES[monster.lootTableId], monster.id).toBeDefined();
      expect(monster.level).toBeGreaterThan(0);
    }
  });

  it('区域 1 的全部怪物都有经过注册和校验的正式立绘', () => {
    const region1Monsters = Object.values(MONSTERS).filter((monster) =>
      monster.id.startsWith('mon_1-'),
    );
    expect(region1Monsters).toHaveLength(24);
    expect(Object.keys(MONSTER_VISUALS).filter((id) => id.startsWith('mon_1-'))).toHaveLength(24);
    for (const monster of region1Monsters) {
      expect(monster.sprite, monster.id).toBe(MONSTER_VISUALS[monster.id]?.asset);
      expect(
        existsSync(resolve('public', monster.sprite)),
        `${monster.id} → ${monster.sprite}`,
      ).toBe(true);
    }
  });

  it('区域 2 的全部怪物都有经过注册和校验的正式立绘', () => {
    const region2Monsters = Object.values(MONSTERS).filter((monster) =>
      monster.id.startsWith('mon_2-'),
    );
    expect(region2Monsters).toHaveLength(25);
    expect(Object.keys(MONSTER_VISUALS).filter((id) => id.startsWith('mon_2-'))).toHaveLength(25);
    expect(Object.keys(MONSTER_VISUALS)).toHaveLength(192);
    for (const monster of region2Monsters) {
      expect(monster.sprite, monster.id).toBe(MONSTER_VISUALS[monster.id]?.asset);
      expect(
        existsSync(resolve('public', monster.sprite)),
        `${monster.id} → ${monster.sprite}`,
      ).toBe(true);
    }
  });

  it('168 张怪物运行时贴图均为统一尺寸、透明画布与脚底锚点', async () => {
    const assets = Object.values(MONSTER_VISUALS).map((visual) => visual.asset);
    expect(assets).toHaveLength(168);

    for (const asset of assets) {
      expect(asset.endsWith('.webp'), asset).toBe(true);
      const assetPath = resolve('public', asset);
      const { data, info } = await sharp(assetPath).ensureAlpha().raw().toBuffer({
        resolveWithObject: true,
      });
      expect({ width: info.width, height: info.height, channels: info.channels }, asset).toEqual({
        width: 512,
        height: 512,
        channels: 4,
      });

      const cornerAlpha = [
        data[3],
        data[(info.width - 1) * info.channels + 3],
        data[(info.height - 1) * info.width * info.channels + 3],
        data[(info.height * info.width - 1) * info.channels + 3],
      ];
      expect(cornerAlpha, `${asset} 四角透明`).toEqual([0, 0, 0, 0]);

      let bottomVisibleY = -1;
      for (let y = 0; y < info.height; y++) {
        for (let x = 0; x < info.width; x++) {
          if (data[(y * info.width + x) * info.channels + 3]! > 8) {
            bottomVisibleY = y;
          }
        }
      }
      expect(bottomVisibleY, `${asset} 脚底锚点`).toBe(503);
    }
    // 168 张图逐张 sharp 解码，全量并行负载下会突破 5s 默认超时（单跑恒绿）；
    // 显式放宽到 30s，只改时长不改断言。
  }, 30_000);

  it('全部区域和章节都引用真实存在的地图场景', async () => {
    for (const region of REGIONS) {
      expect(region.mapAsset).toBe(`assets/maps/${region.id}.webp`);
      expect(existsSync(resolve('public', region.mapAsset)), region.id).toBe(true);
      for (const chapter of region.chapters) {
        expect(chapter.mapAsset).toBe(`assets/maps/chapter-${chapter.id}.webp`);
        expect(
          existsSync(resolve('public', chapter.mapAsset)),
          `${chapter.id} → ${chapter.mapAsset}`,
        ).toBe(true);

        expect(chapter.battleAsset).toBe(`assets/battlefields/chapter-${chapter.id}.webp`);
        const battlefieldPath = resolve('public', chapter.battleAsset);
        expect(existsSync(battlefieldPath), `${chapter.id} → ${chapter.battleAsset}`).toBe(true);
        const battlefieldMetadata = await sharp(battlefieldPath).metadata();
        expect(
          {
            format: battlefieldMetadata.format,
            width: battlefieldMetadata.width,
            height: battlefieldMetadata.height,
          },
          `${chapter.id} → ${chapter.battleAsset}`,
        ).toEqual({
          format: 'webp',
          width: 1536,
          height: 1024,
        });
      }
    }
  });

  it('所有掉落项都能解析成装备或物品，权重和数量合法', () => {
    for (const table of Object.values(LOOT_TABLES)) {
      expect(table.rolls).toBeGreaterThanOrEqual(0);
      expect(table.entries.length, table.id).toBeGreaterThan(0);
      for (const entry of [...table.entries, ...(table.guaranteed ?? [])]) {
        expect(
          EQUIPMENT[entry.itemId] ?? ITEMS[entry.itemId],
          `${table.id} → ${entry.itemId}`,
        ).toBeDefined();
        expect(entry.weight).toBeGreaterThanOrEqual(0);
        expect(entry.minCount).toBeGreaterThan(0);
        expect(entry.maxCount).toBeGreaterThanOrEqual(entry.minCount);
      }
    }
  });

  it('强化成长配置完整覆盖二十五章，推荐目标与首通强化石逐章递进', () => {
    expect(Object.keys(ENHANCE_PROGRESSION).sort()).toEqual(
      ALL_CHAPTERS.map((chapter) => chapter.id).sort(),
    );

    let previousAll = -1;
    let previousMain = -1;
    for (const chapter of ALL_CHAPTERS) {
      const progression = requireEnhanceProgression(chapter.id);
      expect(progression.chapterId).toBe(chapter.id);
      expect(progression.recommendedAllEnhance).toBeGreaterThanOrEqual(previousAll);
      expect(progression.recommendedMainEnhance).toBeGreaterThanOrEqual(previousMain);
      expect(progression.recommendedMainEnhance).toBeGreaterThanOrEqual(
        progression.recommendedAllEnhance,
      );
      expect(progression.recommendedMainEnhance).toBeLessThanOrEqual(15);

      const stones = progression.firstClear.stoneByStage;
      expect(stones).toHaveLength(6);
      stones.forEach((count, index) => {
        expect(count, `${chapter.id} 第 ${index + 1} 关首通强化石`).toBeGreaterThan(0);
        if (index > 0) {
          expect(count, `${chapter.id} 首通强化石阶梯`).toBeGreaterThanOrEqual(stones[index - 1]!);
        }
      });

      const normalStone = progression.loot.normal.entries.find(
        (entry) => entry.itemId === ENHANCE_MATERIAL_IDS.stone,
      );
      expect(normalStone, `${chapter.id} 普通怪缺少强化石来源`).toBeDefined();

      previousAll = progression.recommendedAllEnhance;
      previousMain = progression.recommendedMainEnhance;
    }
  });

  it('强化材料配置只使用合法物品，概率项与必掉项边界明确', () => {
    const allowedIds = new Set<string>([...ENHANCE_PROGRESSION_MATERIAL_IDS, 'stone_reforge']);
    const highTierIds = new Set<string>([
      ENHANCE_MATERIAL_IDS.ore,
      ENHANCE_MATERIAL_IDS.lucky,
      ENHANCE_MATERIAL_IDS.protection,
    ]);

    for (const progression of Object.values(ENHANCE_PROGRESSION)) {
      for (const [type, source] of Object.entries(progression.loot)) {
        for (const entry of source.entries) {
          expect(allowedIds.has(entry.itemId), `${progression.chapterId}/${type}`).toBe(true);
          expect(entry.weight).toBeGreaterThan(0);
          if (type === 'normal') {
            // 离线 normal 基础表走 expectedLoot，不推进 pity；在这里配保底会制造假承诺。
            expect(
              entry.pityCount,
              `${progression.chapterId}/normal/${entry.itemId} 的离线保底不会推进`,
            ).toBeUndefined();
            expect(
              highTierIds.has(entry.itemId),
              `${progression.chapterId}/normal/${entry.itemId} 应放入真实掷骰的特殊表`,
            ).toBe(false);
          } else if (highTierIds.has(entry.itemId)) {
            expect(
              entry.pityCount,
              `${progression.chapterId}/${type}/${entry.itemId} 缺保底`,
            ).toBeTypeOf('number');
            expect(entry.pityCount).toBeGreaterThan(0);
          }
        }
        for (const entry of source.guaranteed) {
          expect(allowedIds.has(entry.itemId), `${progression.chapterId}/${type}`).toBe(true);
          expect(entry.weight).toBe(0);
          expect(entry.pityCount).toBeUndefined();
        }
      }

      for (const reward of progression.firstClear.finalBonus) {
        expect(allowedIds.has(reward.itemId), `${progression.chapterId} 最终关首通`).toBe(true);
        expect(reward.count).toBeGreaterThan(0);
      }
    }
  });

  it('两区首个 BOSS 的高阶强化材料首通数量达到承诺', () => {
    const rewardCount = (stageId: string, itemId: string) =>
      STAGES[stageId]!.firstClearRewards.find((reward) => reward.itemId === itemId)?.count ?? 0;

    expect(rewardCount('stage_1-5_6', ENHANCE_MATERIAL_IDS.ore)).toBeGreaterThanOrEqual(10);
    expect(rewardCount('stage_1-5_6', ENHANCE_MATERIAL_IDS.lucky)).toBeGreaterThanOrEqual(1);
    expect(rewardCount('stage_1-5_6', ENHANCE_MATERIAL_IDS.protection)).toBeGreaterThanOrEqual(1);

    expect(rewardCount('stage_2-5_6', ENHANCE_MATERIAL_IDS.ore)).toBeGreaterThanOrEqual(30);
    expect(rewardCount('stage_2-5_6', ENHANCE_MATERIAL_IDS.lucky)).toBeGreaterThanOrEqual(2);
    expect(rewardCount('stage_2-5_6', ENHANCE_MATERIAL_IDS.protection)).toBeGreaterThanOrEqual(2);
  });

  it('精英与 BOSS 特殊掉落表都能由真实关卡循环触达', () => {
    const reachableTableIds = new Set<string>();
    const reachableMonsterIds = new Set<string>();

    for (const stage of Object.values(STAGES)) {
      const cycleKills = stage.waves.reduce(
        (sum, wave) => sum + wave.monsters.reduce((waveSum, monster) => waveSum + monster.count, 0),
        0,
      );
      const distribution = countStageMonsterKills(stage, 0, cycleKills);
      for (const monsterId of Object.keys(distribution.counts)) {
        reachableMonsterIds.add(monsterId);
        reachableTableIds.add(MONSTERS[monsterId]!.lootTableId);
      }
    }

    for (const monster of Object.values(MONSTERS)) {
      expect(reachableMonsterIds.has(monster.id), `${monster.id} 未进入任何关卡循环`).toBe(true);
    }

    const highTierMaterials = [
      ENHANCE_MATERIAL_IDS.ore,
      ENHANCE_MATERIAL_IDS.lucky,
      ENHANCE_MATERIAL_IDS.protection,
    ];
    for (const itemId of highTierMaterials) {
      expect(
        Object.values(STAGES).some((stage) =>
          stage.firstClearRewards.some((reward) => reward.itemId === itemId),
        ),
        `${itemId} 缺少首通来源`,
      ).toBe(true);

      const repeatableTables = Object.values(LOOT_TABLES).filter((table) =>
        [...table.entries, ...(table.guaranteed ?? [])].some((entry) => entry.itemId === itemId),
      );
      expect(repeatableTables.length, `${itemId} 缺少可重复来源`).toBeGreaterThan(0);
      for (const table of repeatableTables) {
        expect(reachableTableIds.has(table.id), `${table.id} 配置存在但关卡不可达`).toBe(true);
      }
    }
  });

  it('装备定义满足槽位、等级和品质基本约束', () => {
    for (const [id, equipment] of Object.entries(EQUIPMENT)) {
      expect(equipment.id).toBe(id);
      expect(equipment.level).toBeGreaterThan(0);
      expect(equipment.name.length).toBeGreaterThan(0);
      expect(equipment.icon.length).toBeGreaterThan(0);
      expect(EQUIPMENT_APPEARANCES[equipment.appearanceId], equipment.appearanceId).toBeDefined();
      expect(existsSync(resolve('public', equipment.icon)), `${id} → ${equipment.icon}`).toBe(true);
    }
  });

  it('五职业纸娃娃底模、七区与装备副本外观全部透明对齐', async () => {
    const layerAssets = Object.values(EQUIPMENT_APPEARANCES)
      .filter((appearance) => appearance.renderMode !== 'slot-only')
      .flatMap((appearance) => Object.values(appearance.assets));
    const assets = [
      ...new Set([
        ...Object.values(CHARACTER_BASE_ASSETS),
        ...Object.values(CHARACTER_BASE_NOSHOES_ASSETS),
        ...layerAssets,
      ]),
    ];
    // 五职业底模、七区、四套完整精品、四档副本、竞技与心虹珍藏的运行时可见层
    // 均不得别名复用；冰雪华年再增加五职业 × 身/鞋/帽/武器 20 张独立层。
    expect(assets).toHaveLength(383);

    for (const asset of assets) {
      const assetPath = resolve('public', asset);
      expect(existsSync(assetPath), asset).toBe(true);
      const { data, info } = await sharp(assetPath).ensureAlpha().raw().toBuffer({
        resolveWithObject: true,
      });
      expect({ width: info.width, height: info.height, channels: info.channels }, asset).toEqual({
        width: 640,
        height: 960,
        channels: 4,
      });
      expect(
        [
          data[3],
          data[(info.width - 1) * info.channels + 3],
          data[(info.height - 1) * info.width * info.channels + 3],
          data[(info.height * info.width - 1) * info.channels + 3],
        ],
        `${asset} 四角透明`,
      ).toEqual([0, 0, 0, 0]);
    }
    // 383 张换装层逐张解码同上：全量并行负载 flaky，显式放宽到 30s。
  }, 30_000);

  it('珍品商店 50 件定义中，纸箱套与冰雪套均完整注册且价格与词条合法', () => {
    expect(BOUTIQUE_THEME_LIST).toHaveLength(5);
    expect(SHOP_OFFERS).toHaveLength(50);
    expect(new Set(SHOP_OFFERS.map((offer) => offer.id)).size).toBe(50);

    for (const classId of CLASS_IDS) {
      const visible = SHOP_OFFERS.filter((offer) => {
        const equipment = EQUIPMENT[offer.defId]!;
        return !equipment.classId || equipment.classId === classId;
      });
      expect(visible, classId).toHaveLength(classId === 'catkin' ? 34 : 32);
    }

    for (const offer of SHOP_OFFERS) {
      const equipment = EQUIPMENT[offer.defId];
      expect(equipment, offer.id).toBeDefined();
      expect(Number.isInteger(offer.price), offer.id).toBe(true);
      expect(offer.price, offer.id).toBeGreaterThan(0);
      expect(equipment!.fixedAffixes, equipment!.id).toHaveLength(
        QUALITY_AFFIX_COUNT[equipment!.quality],
      );
      expect(equipment!.fixedTemplate, equipment!.id).toBe(true);
      expect(new Set(equipment!.fixedAffixes!.map((affix) => affix.key)).size).toBe(
        equipment!.fixedAffixes!.length,
      );
      expect(equipment!.uniqueEffect?.length, equipment!.id).toBeGreaterThan(8);
    }
  });

  it('全部在售的金色与红色商店同款都有 BOSS 掉落路径', () => {
    const bossEntries = Object.values(LOOT_TABLES)
      .filter((table) => table.id.endsWith('_boss'))
      .flatMap((table) => table.entries);
    const bossEntryIds = new Set(bossEntries.map((entry) => entry.itemId));
    // 「装备靠打不靠抽」这条铁律约束的是**在售内容**：商店卖什么，就必须也能打到。
    // 已下架的主题两条获取路径一起关闭（见 shopIceSnowDelisted.spec.ts），
    // 它没有 BOSS 掉落是下架的正确形状，不是违反铁律。
    // ★ 重新上架时，货架与 BOUTIQUE_BOSS_DROP_THEME 必须同时恢复，
    //   届时该主题会重新落入本用例的检查范围。
    const listedThemeIds = new Set(BOUTIQUE_SHELF_LIST.flatMap((shelf) => shelf.themeIds));
    for (const offer of SHOP_OFFERS) {
      const equipment = EQUIPMENT[offer.defId]!;
      if (equipment.quality !== 'legendary' && equipment.quality !== 'mythic') continue;
      const themeId = [...listedThemeIds].find((id) => equipment.id.includes(`eq_shop_${id}_`));
      if (!themeId) continue;
      expect(bossEntryIds.has(equipment.id), equipment.id).toBe(true);
      if (equipment.classId) {
        expect(bossEntries.find((entry) => entry.itemId === equipment.id)?.classId).toBe(
          equipment.classId,
        );
      }
    }
  });

  it('珍品商品图标、纸娃娃换装层与二十一套职业攻击特效符合移动端规格', async () => {
    const iconAssets = [...new Set(SHOP_OFFERS.map((offer) => EQUIPMENT[offer.defId]!.icon))];
    expect(iconAssets).toHaveLength(50);
    for (const asset of iconAssets) {
      const path = resolve('public', asset);
      expect(existsSync(path), asset).toBe(true);
      const metadata = await sharp(path).metadata();
      expect(
        { width: metadata.width, height: metadata.height, channels: metadata.channels },
        asset,
      ).toEqual({ width: 256, height: 256, channels: 4 });
      expect(statSync(path).size, `${asset} 文件大小`).toBeLessThan(82_000);
    }

    const boutiqueAssets = Object.entries(EQUIPMENT_APPEARANCES)
      .filter(
        ([id, appearance]) => id.startsWith('boutique-') && appearance.renderMode !== 'slot-only',
      )
      .flatMap(([, appearance]) =>
        appearance.renderMode === 'slot-only' ? [] : Object.values(appearance.assets),
      );
    expect(new Set(boutiqueAssets).size).toBe(82);
    for (const asset of boutiqueAssets) {
      expect(asset).toBeDefined();
      const path = resolve('public', asset!);
      expect(existsSync(path), asset).toBe(true);
      const metadata = await sharp(path).metadata();
      expect(
        { width: metadata.width, height: metadata.height, channels: metadata.channels },
        asset,
      ).toEqual({ width: 640, height: 960, channels: 4 });
      expect(statSync(path).size, `${asset} 文件大小`).toBeLessThan(305_000);
    }

    const effects = BOUTIQUE_THEME_LIST.flatMap((theme) => Object.values(theme.attackEffects));
    expect(new Set(effects).size).toBe(21);
    for (const asset of effects) {
      const path = resolve('public', asset);
      expect(existsSync(path), asset).toBe(true);
      const metadata = await sharp(path).metadata();
      expect(
        { width: metadata.width, height: metadata.height, channels: metadata.channels },
        asset,
      ).toEqual({ width: 512, height: 512, channels: 4 });
      expect(statSync(path).size, `${asset} 文件大小`).toBeLessThan(185_000);
    }
  });

  it('普通攻击特效规格统一且成长外观在阈值切换', async () => {
    expect(growthTierFor(1).id).toBe('bud');
    expect(growthTierFor(9).id).toBe('bud');
    expect(growthTierFor(10).id).toBe('bloom');
    expect(growthTierFor(20).id).toBe('moon');
    expect(growthTierFor(35).id).toBe('star');
    expect(growthTierFor(50).id).toBe('legend');

    for (const asset of Object.values(BASIC_ATTACK_EFFECTS)) {
      const assetPath = resolve('public', asset);
      expect(existsSync(assetPath), asset).toBe(true);
      const metadata = await sharp(assetPath).metadata();
      expect(
        {
          width: metadata.width,
          height: metadata.height,
          channels: metadata.channels,
        },
        asset,
      ).toEqual({ width: 512, height: 512, channels: 4 });
    }
  });

  it('技能图标与大特效使用各自清晰度规格', async () => {
    const skills = [
      ...SWORDSMAN_VISUAL_SKILLS,
      ...WITCH_VISUAL_SKILLS,
      ...SHAMAN_VISUAL_SKILLS,
      ...CATKIN_VISUAL_SKILLS,
      ...KENSHI_VISUAL_SKILLS,
    ];
    expect(skills).toHaveLength(37);
    for (const skill of skills) {
      const icon = await sharp(resolve('public', skill.icon)).metadata();
      const effect = await sharp(resolve('public', skill.effectAsset)).metadata();
      expect({ width: icon.width, height: icon.height }, `${skill.id} icon`).toEqual({
        width: 256,
        height: 256,
      });
      expect({ width: effect.width, height: effect.height }, `${skill.id} effect`).toEqual(
        skill.type === 'active' ? { width: 512, height: 512 } : { width: 256, height: 256 },
      );
    }
  });

  it('冷却视觉节奏收录全部已解锁主动技，治疗/召唤以专属拍语义参演（2026-08-04）', () => {
    // 旧契约整类排除治疗、召唤与条件技（一级灵巫挂机画面因此零技能、
    // 治愈术永不释放）。节奏机现支持 heal/summon 拍与血量门槛，收录口径
    // 改为「已登记视觉的全部已解锁主动技」，语义由 rhythmSkillEffect 区分。
    expect(battleRhythmSkills('witch', 1).map((skill) => skill.id)).toEqual([
      'skill_witch_fireball',
    ]);
    expect(battleRhythmSkills('shaman', 1).map((skill) => skill.id)).toEqual([
      'skill_shaman_heal',
    ]);
    const shaman10 = battleRhythmSkills('shaman', 10).map((skill) => skill.id);
    expect(shaman10).toContain('skill_shaman_heal');
    expect(shaman10).toContain('skill_shaman_poison');
    const swordsman35 = battleRhythmSkills('swordsman', 35).map((skill) => skill.id);
    expect(swordsman35).toEqual(
      expect.arrayContaining([
        'skill_swordsman_attack',
        'skill_swordsman_halfmoon',
        'skill_swordsman_flame',
      ]),
    );
    const catkin20 = battleRhythmSkills('catkin', 20).map((skill) => skill.id);
    expect(catkin20).toEqual(
      expect.arrayContaining([
        'skill_catkin_paw_combo',
        'skill_catkin_light_pounce',
        'skill_catkin_scratch_frenzy',
      ]),
    );
    // ★ 玩家原始报障是「治愈术**和召唤骷髅**挂机从不释放」，而召唤骷髅
    //   unlockLevel=20 —— 上面 shaman@1 与 @10 都够不到它，下面的
    //   rhythmSkillEffect 又只测分类函数、不测它是否真在轮转里。
    //   ⇒ 若日后有人恢复任何一条「排除召唤/非伤害技」的过滤，报障的那一半
    //   会静默回归而全部现有断言仍然全绿。这里用精确集合钉死 20 级轮转：
    //   三种拍语义（damage/heal/summon）恰好在此等级同时出现。
    expect(battleRhythmSkills('shaman', 20).map((skill) => skill.id)).toEqual([
      'skill_shaman_heal',
      'skill_shaman_poison',
      'skill_shaman_skeleton',
    ]);
    // 语义提取：治疗与召唤不再冒充攻击 —— 由 effect 字段承载差异
    expect(rhythmSkillEffect(requireSkill('skill_shaman_heal'))).toBe('heal');
    expect(rhythmSkillEffect(requireSkill('skill_shaman_skeleton'))).toBe('summon');
    expect(rhythmSkillEffect(requireSkill('skill_shaman_poison'))).toBe('damage');
  });

  it('全部物品都引用真实存在的正式图标', () => {
    // 数量断言的作用是「加物品时逼人来看一眼图标」，不是锁死内容规模。
    // 2026-08-01 加入樱酱专属印记后 55 → 56；五职业均使用独立正式图标。
    expect(Object.keys(ITEMS)).toHaveLength(62);
    for (const [id, item] of Object.entries(ITEMS)) {
      expect(item.icon).toBe(`assets/items/${id}.png`);
      expect(existsSync(resolve('public', item.icon)), `${id} → ${item.icon}`).toBe(true);
    }
  });

  it('四种强化材料图标均为 256 RGBA 且四角透明', async () => {
    for (const itemId of ENHANCE_PROGRESSION_MATERIAL_IDS) {
      const item = ITEMS[itemId]!;
      const assetPath = resolve('public', item.icon);
      const metadata = await sharp(assetPath).metadata();
      expect(
        {
          format: metadata.format,
          width: metadata.width,
          height: metadata.height,
          channels: metadata.channels,
          hasAlpha: metadata.hasAlpha,
        },
        itemId,
      ).toEqual({
        format: 'png',
        width: 256,
        height: 256,
        channels: 4,
        hasAlpha: true,
      });

      const { data, info } = await sharp(assetPath).raw().toBuffer({ resolveWithObject: true });
      const cornerAlpha = [
        data[3],
        data[(info.width - 1) * info.channels + 3],
        data[(info.height - 1) * info.width * info.channels + 3],
        data[(info.height * info.width - 1) * info.channels + 3],
      ];
      expect(cornerAlpha, `${itemId} 四角透明`).toEqual([0, 0, 0, 0]);
    }
  });

  it('强化、分解、扫荡与副本系统插画文件完整', () => {
    expect(Object.keys(SYSTEM_VISUALS)).toEqual(['enhance', 'salvage', 'sweep', 'dungeon']);
    for (const visual of Object.values(SYSTEM_VISUALS)) {
      expect(visual.asset).toBe(`assets/system/${visual.asset.split('/').at(-1)}`);
      expect(existsSync(resolve('public', visual.asset)), `${visual.id} → ${visual.asset}`).toBe(
        true,
      );
    }
  });

  it('PWA 品牌徽记与各尺寸安装图标文件完整', () => {
    const brandAssets = [
      'assets/brand/sakura-blade-emblem.png',
      'icons/icon-192.png',
      'icons/icon-512.png',
      'icons/icon-maskable-512.png',
      'icons/apple-touch-icon.png',
      'favicon-32.png',
    ];
    for (const asset of brandAssets) {
      expect(existsSync(resolve('public', asset)), asset).toBe(true);
    }
  });
});
