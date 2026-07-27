import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { CLASS_VISUALS } from '../classVisuals';
import {
  BASIC_ATTACK_EFFECTS,
  CHARACTER_BASE_ASSETS,
  EQUIPMENT_APPEARANCES,
  growthTierFor,
} from '../characterAppearance';
import {
  SHAMAN_VISUAL_SKILLS,
  SWORDSMAN_VISUAL_SKILLS,
  WITCH_VISUAL_SKILLS,
  battleVisualSkillFor,
} from '../skills';
import { EQUIPMENT } from '../equipment';
import { ITEMS } from '../items';
import { LOOT_TABLES } from '../lootTables';
import { MONSTERS } from '../monsters';
import { MONSTER_VISUALS } from '../monsterVisuals';
import { ALL_CHAPTERS, REGIONS } from '../regions';
import { FIRST_STAGE_ID, ORDERED_STAGE_IDS, STAGES } from '../stages';
import { SYSTEM_VISUALS } from '../systemVisuals';
import { BOUTIQUE_THEME_LIST } from '../boutique';
import { SHOP_OFFERS } from '../shop';
import { QUALITY_AFFIX_COUNT } from '../constants';

describe('区域 1–2 内容完整性', () => {
  it('已登记的职业立绘文件都真实存在', () => {
    for (const [classId, visual] of Object.entries(CLASS_VISUALS)) {
      for (const asset of [visual.portrait, visual.castPortrait]) {
        if (!asset) continue;
        expect(existsSync(resolve('public', asset)), `${classId} → ${asset}`).toBe(true);
      }
    }
    expect(CLASS_VISUALS.witch.portrait).toBe('assets/characters/witch-sakura.png');
    expect(CLASS_VISUALS.witch.castPortrait).toBe('assets/characters/witch-sakura-cast.png');
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

  it('数量达到 M2 内容目标', () => {
    expect(REGIONS).toHaveLength(2);
    expect(ALL_CHAPTERS).toHaveLength(10);
    expect(Object.keys(STAGES)).toHaveLength(60);
    expect(Object.keys(MONSTERS)).toHaveLength(49);
    expect(Object.keys(EQUIPMENT)).toHaveLength(78);
    expect(Object.keys(LOOT_TABLES)).toHaveLength(30);
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
    expect(Object.keys(MONSTER_VISUALS)).toHaveLength(49);
    for (const monster of region2Monsters) {
      expect(monster.sprite, monster.id).toBe(MONSTER_VISUALS[monster.id]?.asset);
      expect(
        existsSync(resolve('public', monster.sprite)),
        `${monster.id} → ${monster.sprite}`,
      ).toBe(true);
    }
  });

  it('49 张怪物运行时贴图均为统一尺寸、透明画布与脚底锚点', async () => {
    const assets = Object.values(MONSTER_VISUALS).map((visual) => visual.asset);
    expect(assets).toHaveLength(49);

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
  });

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

  it('三职业纸娃娃底模与两区主要装备层全部透明对齐', async () => {
    const layerAssets = Object.values(EQUIPMENT_APPEARANCES)
      .filter((appearance) => appearance.renderMode === 'layer')
      .flatMap((appearance) => Object.values(appearance.assets));
    const assets = [...new Set([...Object.values(CHARACTER_BASE_ASSETS), ...layerAssets])];
    expect(assets).toHaveLength(57);

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
  });

  it('珍品商店首发 30 件定义，每个职业可见 24 件且价格与词条合法', () => {
    expect(BOUTIQUE_THEME_LIST).toHaveLength(3);
    expect(SHOP_OFFERS).toHaveLength(30);
    expect(new Set(SHOP_OFFERS.map((offer) => offer.id)).size).toBe(30);

    for (const classId of ['swordsman', 'witch', 'shaman'] as const) {
      const visible = SHOP_OFFERS.filter((offer) => {
        const equipment = EQUIPMENT[offer.defId]!;
        return !equipment.classId || equipment.classId === classId;
      });
      expect(visible, classId).toHaveLength(24);
    }

    for (const offer of SHOP_OFFERS) {
      const equipment = EQUIPMENT[offer.defId];
      expect(equipment, offer.id).toBeDefined();
      expect(Number.isInteger(offer.price), offer.id).toBe(true);
      expect(offer.price, offer.id).toBeGreaterThan(0);
      expect(equipment!.fixedAffixes, equipment!.id).toHaveLength(
        QUALITY_AFFIX_COUNT[equipment!.quality],
      );
      expect(new Set(equipment!.fixedAffixes!.map((affix) => affix.key)).size).toBe(
        equipment!.fixedAffixes!.length,
      );
      expect(equipment!.uniqueEffect?.length, equipment!.id).toBeGreaterThan(8);
    }
  });

  it('全部金色与红色商店同款都有 BOSS 掉落路径', () => {
    const bossEntryIds = new Set(
      Object.values(LOOT_TABLES)
        .filter((table) => table.id.endsWith('_boss'))
        .flatMap((table) => table.entries.map((entry) => entry.itemId)),
    );
    for (const offer of SHOP_OFFERS) {
      const equipment = EQUIPMENT[offer.defId]!;
      if (equipment.quality !== 'legendary' && equipment.quality !== 'mythic') continue;
      expect(bossEntryIds.has(equipment.id), equipment.id).toBe(true);
    }
  });

  it('珍品商品图标、三职业换装层与九套攻击特效符合移动端规格', async () => {
    const iconAssets = [...new Set(SHOP_OFFERS.map((offer) => EQUIPMENT[offer.defId]!.icon))];
    expect(iconAssets).toHaveLength(30);
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

    const boutiqueLayers = Object.entries(EQUIPMENT_APPEARANCES)
      .filter(([id, appearance]) => id.startsWith('boutique-') && appearance.renderMode === 'layer')
      .flatMap(([, appearance]) =>
        appearance.renderMode === 'layer' ? Object.values(appearance.assets) : [],
      );
    expect(new Set(boutiqueLayers).size).toBe(36);
    for (const asset of boutiqueLayers) {
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
    expect(new Set(effects).size).toBe(9);
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
    const skills = [...SWORDSMAN_VISUAL_SKILLS, ...WITCH_VISUAL_SKILLS, ...SHAMAN_VISUAL_SKILLS];
    expect(skills).toHaveLength(9);
    for (const skill of skills) {
      const icon = await sharp(resolve('public', skill.icon)).metadata();
      const effect = await sharp(resolve('public', skill.effectAsset)).metadata();
      expect({ width: icon.width, height: icon.height }, `${skill.id} icon`).toEqual({
        width: 256,
        height: 256,
      });
      expect({ width: effect.width, height: effect.height }, `${skill.id} effect`).toEqual({
        width: 512,
        height: 512,
      });
    }
  });

  it('战斗演出保持三次普攻接一次伤害技能，治疗和召唤不冒充攻击', () => {
    expect(battleVisualSkillFor('witch', 1, 1)).toBeNull();
    expect(battleVisualSkillFor('witch', 1, 4)?.id).toBe('skill_witch_fireball');
    expect(battleVisualSkillFor('shaman', 1, 4)).toBeNull();
    expect(battleVisualSkillFor('shaman', 10, 4)?.id).toBe('skill_shaman_poison');
    expect(battleVisualSkillFor('swordsman', 35, 4)?.id).toBe('skill_swordsman_attack');
    expect(battleVisualSkillFor('swordsman', 35, 8)?.id).toBe('skill_swordsman_halfmoon');
  });

  it('全部物品都引用真实存在的正式图标', () => {
    expect(Object.keys(ITEMS)).toHaveLength(16);
    for (const [id, item] of Object.entries(ITEMS)) {
      expect(item.icon).toBe(`assets/items/${id}.png`);
      expect(existsSync(resolve('public', item.icon)), `${id} → ${item.icon}`).toBe(true);
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
