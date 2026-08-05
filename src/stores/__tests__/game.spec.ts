import 'fake-indexeddb/auto';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { battleMonsterIdAt } from '@/core/battleVisual';
import { combatEfficiency } from '@/core/combat';
import { dailyDungeonReward, dailyDungeonThemeIdOfDay } from '@/core/dailyDungeons';
import { decomposeGold } from '@/core/economy';
import { businessDayKey } from '@/core/dayKey';
import { createInstance, rollAffixForKey } from '@/core/equipment';
import { averageSkillMultiplier, expToNext, makeMonster, makePlayer } from '@/core/progression';
import { CLASS_IDS, type EquipmentInstance } from '@/core/types';
import { Rng } from '@/core/rng';
import {
  ENHANCE_MAX,
  ENHANCE_MATERIAL_IDS,
  SLOT_ORDER,
  STAGE_CHALLENGE_STAMINA_COST,
} from '@/data/constants';
import { requireEquipment } from '@/data/equipment';
import { EQUIPMENT_DUNGEON_STAGES } from '@/data/equipmentDungeons';
import { requireMonster } from '@/data/monsters';
import { SHOP_OFFERS } from '@/data/shop';
import { battleRhythmSkills } from '@/data/skills';
import {
  FIRST_STAGE_ID,
  ORDERED_STAGE_IDS,
  STAGES,
  stageClearTarget,
  nextStageId,
  totalMonsterCount,
} from '@/data/stages';
import {
  EQUIPMENT_DUNGEON_CRYSTAL_MAX,
  EQUIPMENT_DUNGEON_CRYSTAL_MIN,
  IMPRINT_CRYSTAL_COST,
  IMPRINT_CRYSTAL_IDS,
  IMPRINT_GOLD_PER_LEVEL,
} from '@/data/imprintRules';
import { createSave, SAVE_VERSION, type SaveData } from '@/save/schema';
import { clearSave, loadSave, saveSave } from '@/save/storage';
import { useGameStore } from '../game';
import { useInventoryStore } from '../inventory';
import { usePlayerStore } from '../player';
import { useStageStore } from '../stage';

beforeEach(async () => {
  setActivePinia(createPinia());
  await clearSave();
});

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  await clearSave();
});

describe('game store persistence', () => {
  it('新建角色后立即写入 IndexedDB', async () => {
    const game = useGameStore();
    await game.startNewGame('小樱', 'swordsman');

    const loaded = await loadSave();
    expect(loaded?.player.name).toBe('小樱');
    expect(loaded?.player.classId).toBe('swordsman');
  });

  it('喵喵创角会以稳定 catkin 职业标识写入 IndexedDB', async () => {
    const game = useGameStore();
    await game.startNewGame('喵喵', 'catkin');

    const loaded = await loadSave();
    expect(loaded?.version).toBe(SAVE_VERSION);
    expect(loaded?.player.name).toBe('喵喵');
    expect(loaded?.player.classId).toBe('catkin');
  });

  it('樱酱存档加载后由唯一生产入口生成真实技能栏', () => {
    const game = useGameStore();
    const save = createSave('樱酱', 'kenshi', 20260801, Date.now());
    save.player.level = 120;
    game.loadFrom(save);

    expect(game.playerSkillKit?.active).toHaveLength(4);
    expect(game.playerSkillKit?.passives.length).toBeGreaterThan(0);
    expect(
      [...(game.playerSkillKit?.active ?? []), ...(game.playerSkillKit?.passives ?? [])].every(
        (entry) => entry.skill.class === 'kenshi',
      ),
    ).toBe(true);
  });

  it('四个领域 store 读取同一份响应式存档', async () => {
    const game = useGameStore();
    game.loadFrom(createSave('领域测试', 'witch', 7, Date.now()));

    expect(usePlayerStore().player?.name).toBe('领域测试');
    expect(usePlayerStore().playerSkillMultiplier).toBe(game.playerSkillMultiplier);
    expect(useInventoryStore().bag?.equipment).toEqual([]);
    expect(useStageStore().current.id).toBe(game.currentStage.id);
    await game.persist();
  });

  it('满体力消费会重置恢复起点，立即重开不会把刚花掉的体力补回', async () => {
    let now = Date.UTC(2026, 6, 31, 19, 45);
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn(() => 1),
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    const game = useGameStore();
    const save = createSave('体力刷新测试', 'swordsman', 20260731, now);
    save.player.level = 69;
    game.loadFrom(save);
    game.save!.player.stamina = game.staminaMax;
    game.save!.player.staminaRecoverAt = now - 24 * 60 * 60 * 1000;

    expect(game.selectStage(FIRST_STAGE_ID)).toBe(true);
    expect(game.save!.player.stamina).toBe(game.staminaMax - STAGE_CHALLENGE_STAMINA_COST);
    expect(game.save!.player.staminaRecoverAt).toBe(now);
    await game.persist();

    now += 1_000;
    setActivePinia(createPinia());
    const reopened = useGameStore();
    await reopened.init();
    reopened.stopLoop();

    expect(reopened.save!.player.stamina).toBe(reopened.staminaMax - STAGE_CHALLENGE_STAMINA_COST);
  });

  it('战力低于推荐值 60% 仍持续挂机，只由承伤效率软性降速', () => {
    const game = useGameStore();
    const save = createSave('低战挂机测试', 'witch', 701, Date.now());
    save.progress.currentStageId = 'stage_2-5_6';
    game.loadFrom(save);

    expect(game.cpRatio).toBeLessThan(0.6);
    expect(game.canIdle).toBe(true);
    expect(game.battleEfficiency).toBeGreaterThan(0);
    expect(game.kps).toBeGreaterThan(0);
  });

  it('玩家攻击元素只来自已穿武器，不被元素伤害词条反向伪造', () => {
    const game = useGameStore();
    const emptySave = createSave('元素权威测试', 'witch', 702, Date.now());
    emptySave.player.level = 99;
    game.loadFrom(emptySave);
    expect(game.playerCombatElement).toBe('none');

    const neutralSave = createSave('无属性武器测试', 'witch', 703, Date.now());
    neutralSave.player.level = 99;
    const neutralWeapon = createInstance(
      requireEquipment('eq_r1_weapon_common'),
      new Rng(703),
      'neutral-weapon',
      neutralSave.player.classId,
    );
    neutralWeapon.affixes = [{ key: 'elemDmg', tier: 5, value: 16, element: 'fire' }];
    neutralSave.equipped.weapon = neutralWeapon;
    game.loadFrom(neutralSave);
    expect(game.playerCombatElement).toBe('none');

    const fireSave = createSave('炎武器测试', 'witch', 704, Date.now());
    fireSave.player.level = 99;
    const fireWeapon = createInstance(
      requireEquipment('eq_r2_weapon_fine'),
      new Rng(704),
      'fire-weapon',
      fireSave.player.classId,
    );
    fireWeapon.affixes = [];
    fireSave.equipped.weapon = fireWeapon;
    game.loadFrom(fireSave);
    expect(game.playerCombatElement).toBe('fire');
  });

  it('载入超容旧背包时不会清掉低战力装备上的 T4+ 战斗词条', async () => {
    const save = createSave('清包保护测试', 'witch', 705, Date.now());
    save.player.level = 99;
    const common = requireEquipment('eq_r1_ring_common');
    const rare = requireEquipment('eq_r1_ring_rare');
    const champion = createInstance(rare, new Rng(706), 'slot-champion', save.player.classId);
    champion.affixes = [rollAffixForKey('atk', rare.level, new Rng(707), true)];
    const combatAffix = createInstance(
      common,
      new Rng(708),
      'combat-affix-champion',
      save.player.classId,
    );
    combatAffix.affixes = [rollAffixForKey('dmgReduce', common.level, new Rng(709), true)];
    const junk = Array.from({ length: 300 }, (_, index) => {
      const instance = createInstance(
        common,
        new Rng(800 + index),
        `trim-junk-${index}`,
        save.player.classId,
      );
      instance.affixes = [rollAffixForKey('atk', common.level, new Rng(2_000 + index))];
      return instance;
    });
    save.bag.equipment = [champion, combatAffix, ...junk];
    save.lastActiveAt = Date.now();
    await saveSave(save);
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn(() => 1),
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    const game = useGameStore();
    await game.init();
    game.stopLoop();

    expect(game.save?.bag.equipment).toHaveLength(300);
    expect(game.save?.bag.equipment.map((item) => item.uid)).toContain('combat-affix-champion');
  });

  it('离线击杀会推进通关、累计统计并发放首通奖励', async () => {
    const game = useGameStore();
    const save = createSave('离线测试', 'swordsman', 11, Date.now() - 120_000);
    const clearedStageId = save.progress.currentStageId;
    const expectedNextStageId = nextStageId(clearedStageId);
    game.loadFrom(save);

    expect(game.save?.stats.totalKills).toBeGreaterThan(0);
    expect(game.save?.progress.clearedStageIds).toContain(clearedStageId);
    expect(game.save?.progress.stageKills[clearedStageId]).toBe(
      totalMonsterCount(STAGES[clearedStageId]!),
    );
    expect(game.currentStage.id).toBe(expectedNextStageId);
    expect(game.save?.progress.stageKills[game.currentStage.id]).toBeUndefined();
    expect(game.save?.bag.items.stone_enhance).toBeGreaterThan(0);
    expect(game.save?.encounters.pending.length).toBeGreaterThan(0);
    await game.persist();
  });

  it('离线结算按真实波次触发精英玄铁掉落，并在欢迎回来弹窗中展示', async () => {
    const game = useGameStore();
    const eliteStageId = 'stage_2-4_3';
    const save = createSave('精英玄铁测试', 'swordsman', 13, Date.now() - 120_000);
    save.player.level = 120;
    save.progress.currentStageId = eliteStageId;
    const weapon = createInstance(
      requireEquipment('eq_r1_weapon_common'),
      new Rng(14),
      'elite-e1',
      save.player.classId,
    );
    weapon.affixes = [{ key: 'atk', value: 1_000_000, tier: 3 }];
    save.equipped.weapon = weapon;
    save.nextUid = 2;

    game.loadFrom(save);

    const oreInBag = game.save?.bag.items[ENHANCE_MATERIAL_IDS.ore] ?? 0;
    const oreInOfflineModal =
      game.offlineResult?.yield.loot.find((drop) => drop.itemId === ENHANCE_MATERIAL_IDS.ore)
        ?.count ?? 0;
    expect(oreInBag).toBeGreaterThan(0);
    expect(oreInOfflineModal).toBe(oreInBag);
    await game.persist();
  });
});

describe('shared-progress class switching', () => {
  it('只切职业并安全卸下旧职业武器，完整保留账号进度与装备实例', async () => {
    const game = useGameStore();
    const save = classSwitchSave();
    const exclusiveWeapon = createInstance(
      requireEquipment('eq_shop_berry-cream_weapon_witch'),
      new Rng(302),
      'switch-witch-weapon',
      save.player.classId,
    );
    exclusiveWeapon.enhance = 2;
    exclusiveWeapon.enhanceGainPermille[0] = 80;
    exclusiveWeapon.enhanceGainPermille[1] = 95;
    exclusiveWeapon.enhanceLuck['3'] = 37;
    exclusiveWeapon.locked = false;
    const universalBody = createInstance(
      requireEquipment('eq_r1_body_rare'),
      new Rng(303),
      'switch-universal-body',
      save.player.classId,
    );
    save.equipped.weapon = exclusiveWeapon;
    save.equipped.body = universalBody;
    game.loadFrom(save);
    await game.persist();

    const progressBefore = sharedProgressSnapshot(game.save!);
    const weaponBefore = jsonClone(game.save!.equipped.weapon!);
    const bodyBefore = jsonClone(game.save!.equipped.body!);
    const result = await game.switchClass('catkin');

    expect(result).toMatchObject({
      ok: true,
      fromClassId: 'witch',
      toClassId: 'catkin',
      movedCount: 1,
      newlyLockedCount: 1,
    });
    expect(game.save?.player.classId).toBe('catkin');
    expect(game.save?.equipped.weapon).toBeNull();
    expect(game.save?.equipped.body).toEqual(bodyBefore);
    expect(game.save?.bag.equipment).toContainEqual({
      ...weaponBefore,
      locked: true,
    });
    expect(sharedProgressSnapshot(game.save!)).toEqual(progressBefore);

    const allUids = ownedEquipmentUids(game.save!);
    expect(allUids).toEqual(['switch-universal-body', 'switch-witch-weapon']);
    expect(new Set(allUids).size).toBe(allUids.length);

    const persisted = await loadSave();
    expect(persisted?.player.classId).toBe('catkin');
    expect(persisted?.equipped.body).toEqual(bodyBefore);
    expect(persisted?.bag.equipment).toContainEqual({
      ...weaponBefore,
      locked: true,
    });
  });

  it('同职业切换是明确的 no-op，重复轮换四职业也不会复制或丢失资产', async () => {
    const game = useGameStore();
    const save = classSwitchSave();
    save.bag.equipment.push(
      createInstance(
        requireEquipment('eq_r1_ring_fine'),
        new Rng(304),
        'switch-ring',
        save.player.classId,
      ),
    );
    game.loadFrom(save);
    await game.persist();

    const before = jsonClone(game.save!);
    expect(await game.switchClass('witch')).toEqual({
      ok: false,
      reason: 'same-class',
    });
    expect(game.save).toEqual(before);

    for (let index = 0; index < 100; index++) {
      const classId = CLASS_IDS[index % CLASS_IDS.length]!;
      if (classId === game.save?.player.classId) continue;
      expect((await game.switchClass(classId)).ok).toBe(true);
    }

    expect(ownedEquipmentUids(game.save!)).toEqual(['switch-ring']);
    expect(game.save?.nextUid).toBe(before.nextUid);
    expect(game.save?.player.level).toBe(before.player.level);
    expect(game.save?.progress).toEqual(before.progress);
  });

  it('满背包切换时宁可临时超容，也不会分解或吞掉职业专属装备', async () => {
    const game = useGameStore();
    const save = classSwitchSave();
    save.bag.equipment = Array.from({ length: 300 }, (_, index) =>
      createInstance(
        requireEquipment('eq_r1_ring_common'),
        new Rng(index + 400),
        `switch-bag-${index}`,
        save.player.classId,
      ),
    );
    save.equipped.weapon = createInstance(
      requireEquipment('eq_shop_berry-cream_weapon_witch'),
      new Rng(701),
      'switch-full-bag-weapon',
      save.player.classId,
    );
    game.loadFrom(save);
    await game.persist();
    const goldBefore = game.save!.player.gold;

    expect((await game.switchClass('shaman')).ok).toBe(true);

    expect(game.save?.bag.equipment).toHaveLength(301);
    expect(ownedEquipmentUids(game.save!)).toHaveLength(301);
    expect(game.save?.player.gold).toBe(goldBefore);
    expect(game.save?.bag.equipment.at(-1)).toMatchObject({
      uid: 'switch-full-bag-weapon',
      locked: true,
    });
  });

  it('战斗中切换保留当前怪物掉血比例，并清掉旧职业的攻击拍子', async () => {
    const game = useGameStore();
    game.loadFrom(classSwitchSave());
    await game.persist();

    const frames: FrameRequestCallback[] = [];
    let rafSequence = 0;
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        frames.push(callback);
        return ++rafSequence;
      }),
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    let clock = 1_000;
    vi.spyOn(performance, 'now').mockImplementation(() => clock);

    game.startLoop();
    const firstFrame = frames.shift();
    expect(firstFrame).toBeDefined();
    if (!firstFrame) throw new Error('实时挂机循环没有登记首帧回调');
    // 实时循环小于 0.25 秒会主动跳帧；0.9 / 最高 3 KPS 仍有 0.3 秒，
    // 既能进入主流程，又不会真的结算一只怪。
    clock += (0.9 / game.kps) * 1_000;
    firstFrame(clock);

    const liveRhythmSnapshot = game.battleRhythmSnapshot;
    expect(liveRhythmSnapshot).not.toBeNull();
    if (!liveRhythmSnapshot) throw new Error('实时循环没有发布技能节奏快照');
    expect(liveRhythmSnapshot).toMatchObject({
      source: 'visual-projection',
      contextId: 'witch',
      running: true,
    });
    expect(liveRhythmSnapshot.skills.map((skill) => skill.skillId)).toEqual(
      battleRhythmSkills('witch', game.save!.player.level).map((skill) => skill.id),
    );
    const skillBeats = game.battleBeats.filter((beat) => beat.kind === 'player-skill');
    expect(skillBeats.length).toBeGreaterThan(0);
    expect(
      skillBeats.every((beat) =>
        liveRhythmSnapshot.skills.some((skill) => skill.skillId === beat.skillId),
      ),
    ).toBe(true);
    expect(liveRhythmSnapshot.basic.lastCastSeq).toBe(
      [...game.battleBeats].reverse().find((beat) => beat.kind === 'player-attack')?.seq ?? null,
    );
    for (const runtime of liveRhythmSnapshot.skills) {
      expect(runtime.lastCastSeq).toBe(
        [...skillBeats].reverse().find((beat) => beat.skillId === runtime.skillId)?.seq ?? null,
      );
    }
    const rhythmEpochBeforeSwitch = liveRhythmSnapshot.epoch;
    const snapshotBeforePause = jsonClone(liveRhythmSnapshot);

    game.pauseForBackground();
    expect(game.battleRhythmSnapshot).toEqual({
      ...snapshotBeforePause,
      running: false,
    });
    game.resumeFromBackground();
    expect(game.battleRhythmSnapshot).toEqual({
      ...snapshotBeforePause,
      running: true,
    });

    expect(game.battleProgress).toBeCloseTo(0.9, 5);
    expect(game.battleBeats.length).toBeGreaterThan(0);
    expect(game.battleRhythmSnapshot?.running).toBe(true);
    const progressBefore = game.battleProgress;
    const killsBefore = game.save!.stats.totalKills;
    const stageKillsBefore = jsonClone(game.save!.progress.stageKills);

    expect((await game.switchClass('swordsman')).ok).toBe(true);

    expect(game.battleProgress).toBeCloseTo(progressBefore, 10);
    expect(game.battleBeats).toEqual([]);
    expect(game.battlePulse).toBeNull();
    expect(game.battleRhythmSnapshot).toMatchObject({
      contextId: 'swordsman',
      running: true,
      seq: 0,
    });
    expect(game.battleRhythmSnapshot?.skills.map((skill) => skill.skillId)).toEqual(
      battleRhythmSkills('swordsman', game.save!.player.level).map((skill) => skill.id),
    );
    expect(game.battleRhythmSnapshot?.epoch).toBeGreaterThan(rhythmEpochBeforeSwitch);
    expect(game.save?.stats.totalKills).toBe(killsBefore);
    expect(game.save?.progress.stageKills).toEqual(stageKillsBefore);
    game.stopLoop();
  });

  it('同职业切关会开启新节奏纪元，同时保留运行态和真实技能卡配置', () => {
    const game = useGameStore();
    game.loadFrom(classSwitchSave());

    const frames: FrameRequestCallback[] = [];
    let rafSequence = 0;
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        frames.push(callback);
        return ++rafSequence;
      }),
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    let clock = 4_000;
    vi.spyOn(performance, 'now').mockImplementation(() => clock);

    game.startLoop();
    const firstFrame = frames.shift();
    expect(firstFrame).toBeDefined();
    if (!firstFrame) throw new Error('实时挂机循环没有登记首帧回调');
    clock += 300;
    firstFrame(clock);

    const before = game.battleRhythmSnapshot;
    expect(before?.seq).toBeGreaterThan(0);
    expect(before?.basic.lastCastSeq).not.toBeNull();
    if (!before) throw new Error('切关测试缺少旧节奏快照');

    expect(game.selectStage(game.currentStage.id)).toBe(true);

    const after = game.battleRhythmSnapshot;
    expect(after).not.toBeNull();
    expect(after).toMatchObject({
      contextId: 'witch',
      running: true,
      seq: 0,
    });
    expect(after?.epoch).toBe(before.epoch + 1);
    expect(after?.basic.lastCastSeq).toBeNull();
    expect(after?.skills.map((skill) => skill.skillId)).toEqual(
      battleRhythmSkills('witch', game.save!.player.level).map((skill) => skill.id),
    );
    expect(after?.skills.every((skill) => skill.lastCastSeq === null)).toBe(true);
    expect(game.battleBeats).toEqual([]);
    game.stopLoop();
  });

  it('单帧升级解锁技能时会原子同步节奏快照，不留下旧等级技能表', () => {
    const game = useGameStore();
    const save = createSave('技能解锁测试', 'swordsman', 317, Date.now() + 60_000);
    save.player.level = 3;
    save.player.exp = expToNext(3) - 1;
    const weapon = createInstance(
      requireEquipment('eq_r1_weapon_common'),
      new Rng(19),
      'e-unlock',
      save.player.classId,
    );
    weapon.affixes = [{ key: 'atk', value: 1_000_000, tier: 3 }];
    save.equipped.weapon = weapon;
    save.nextUid = 2;
    game.loadFrom(save);

    expect(game.battleRhythmSnapshot?.skills).toHaveLength(0);

    const frames: FrameRequestCallback[] = [];
    let rafSequence = 0;
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        frames.push(callback);
        return ++rafSequence;
      }),
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    let clock = 8_000;
    vi.spyOn(performance, 'now').mockImplementation(() => clock);

    game.startLoop();
    const firstFrame = frames.shift();
    expect(firstFrame).toBeDefined();
    if (!firstFrame) throw new Error('升级同步测试缺少实时挂机帧');
    clock += (1.1 / game.kps) * 1_000;
    firstFrame(clock);

    expect(game.save?.player.level).toBe(4);
    expect(game.battleRhythmSnapshot?.skills.map((skill) => skill.skillId)).toEqual(
      battleRhythmSkills('swordsman', 4).map((skill) => skill.id),
    );
    expect(game.battleRhythmSnapshot?.skills[0]).toMatchObject({
      skillId: 'skill_swordsman_attack',
      lastCastSeq: null,
    });
    expect(game.battleRhythmSnapshot?.running).toBe(true);
    game.stopLoop();
  });

  it('回刷已通关关卡时切换职业不会把当前波次目标倒退到第一只怪', async () => {
    const game = useGameStore();
    const save = classSwitchSave();
    const stage = STAGES[save.progress.currentStageId]!;
    save.progress.clearedStageIds.push(stage.id);
    save.progress.stageKills[stage.id] = totalMonsterCount(stage);
    game.loadFrom(save);
    await game.persist();

    const firstTargetId = battleMonsterIdAt(stage, 0);
    const nextTargetCursor = Array.from(
      { length: totalMonsterCount(stage) },
      (_, index) => index,
    ).find((index) => index > 0 && battleMonsterIdAt(stage, index) !== firstTargetId);
    expect(nextTargetCursor).toBeDefined();
    if (!nextTargetCursor) throw new Error('测试关卡没有第二种可用于验收的怪物');

    const frames: FrameRequestCallback[] = [];
    let rafSequence = 0;
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        frames.push(callback);
        return ++rafSequence;
      }),
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    let clock = 2_000;
    vi.spyOn(performance, 'now').mockImplementation(() => clock);

    game.startLoop();
    const firstFrame = frames.shift();
    expect(firstFrame).toBeDefined();
    if (!firstFrame) throw new Error('实时挂机循环没有登记首帧回调');
    clock += ((nextTargetCursor + 0.4) / game.kps) * 1_000;
    firstFrame(clock);
    game.stopLoop();

    const expectedTargetId = battleMonsterIdAt(stage, nextTargetCursor);
    expect(expectedTargetId).not.toBe(firstTargetId);
    expect(game.battlePulse).not.toBeNull();

    expect((await game.switchClass('catkin')).ok).toBe(true);

    expect(game.battlePulse).toBeNull();
    expect(game.battleTargetId).toBe(expectedTargetId);
    expect(game.battleProgress).toBeCloseTo(0.4, 5);
  });
});

describe('encounter transaction', () => {
  it('材料充足时只结算一次并移除待处理奇遇', async () => {
    const game = useGameStore();
    const save = createSave('奇遇测试', 'witch', 99, Date.now());
    save.bag.items = { petal_sakura: 3, grass_soft: 2 };
    save.encounters.pending.push({
      uid: 'enc_1',
      encounterId: 'enc_r1_petalsmith',
      regionId: 'r1',
      storyChoiceId: 'lasting_grip',
    });
    save.encounters.generatedCount = 1;
    game.loadFrom(save);

    const resolution = game.resolvePendingEncounter('enc_1', 'trade');
    expect(resolution.ok).toBe(true);
    if (!resolution.ok) return;
    expect(resolution.outcome).toBe('刀匠把一份沉甸甸的谢礼塞到了你手里。');
    expect(game.save?.player.gold).toBe(resolution.rewards.gold ?? 0);
    expect(game.save?.bag.items).toEqual(resolution.rewards.items ?? {});
    expect(game.save?.encounters.pending).toHaveLength(0);
    expect(game.resolvePendingEncounter('enc_1', 'trade')).toEqual({
      ok: false,
      reason: 'not-found',
    });
    await game.persist();
  });

  it('材料不足时资产和奇遇都保持不变', async () => {
    const game = useGameStore();
    const save = createSave('奇遇测试', 'witch', 100, Date.now());
    save.bag.items = { petal_sakura: 3, grass_soft: 1 };
    save.encounters.pending.push({
      uid: 'enc_1',
      encounterId: 'enc_r1_petalsmith',
      regionId: 'r1',
      storyChoiceId: 'lasting_grip',
    });
    game.loadFrom(save);
    const before = JSON.parse(JSON.stringify(game.save));

    expect(game.resolvePendingEncounter('enc_1', 'trade')).toEqual({
      ok: false,
      reason: 'insufficient-resource',
    });
    expect(game.save).toEqual(before);
    await game.persist();
  });

  it('角色篇章会先记住回答，再在援助或告别时完成且只增加一次关系', async () => {
    const game = useGameStore();
    const save = createSave('角色奇遇测试', 'witch', 101, Date.now());
    save.bag.items = { petal_sakura: 3, grass_soft: 2 };
    save.encounters.pending.push({
      uid: 'enc_story_1',
      encounterId: 'enc_r1_petalsmith',
      regionId: 'r1',
    });
    game.loadFrom(save);

    expect(game.resolvePendingEncounter('enc_story_1', 'trade')).toEqual({
      ok: false,
      reason: 'story-choice-required',
    });
    expect(game.rememberPendingEncounterChoice('enc_story_1', 'lasting_grip')).toEqual({
      ok: true,
    });
    expect(game.save?.encounters.pending[0]?.storyChoiceId).toBe('lasting_grip');

    const resolution = game.resolvePendingEncounter('enc_story_1', 'trade');
    expect(resolution.ok).toBe(true);
    expect(game.save?.encounters.characters.char_akane).toEqual({
      bond: 1,
      completedEncounterIds: ['enc_r1_petalsmith'],
      choiceHistory: { enc_r1_petalsmith: 'lasting_grip' },
    });
    expect(game.save?.encounters.pending).toHaveLength(0);
  });

  it('材料援助失败时保留已经作出的剧情回答，稍后可以继续', async () => {
    const game = useGameStore();
    const save = createSave('角色奇遇恢复测试', 'witch', 102, Date.now());
    save.bag.items = { petal_sakura: 3, grass_soft: 1 };
    save.encounters.pending.push({
      uid: 'enc_story_2',
      encounterId: 'enc_r1_petalsmith',
      regionId: 'r1',
      storyChoiceId: 'lasting_grip',
    });
    game.loadFrom(save);

    expect(game.resolvePendingEncounter('enc_story_2', 'trade')).toEqual({
      ok: false,
      reason: 'insufficient-resource',
    });
    expect(game.save?.encounters.pending[0]?.storyChoiceId).toBe('lasting_grip');
    expect(game.save?.encounters.characters.char_akane).toBeUndefined();
  });

  it('Store 对同一日常返回稳定展示，并按历史最高章节统一显示和结算档位', () => {
    const game = useGameStore();
    const save = createSave('动态日常测试', 'witch', 2026, Date.now());
    save.progress.clearedStageIds = [...ORDERED_STAGE_IDS];
    save.encounters.characters.char_akane = {
      bond: 3,
      completedEncounterIds: [
        'enc_r1_petalsmith',
        'enc_r1_petalsmith_doubt',
        'enc_r1_petalsmith_first_blade',
      ],
      choiceHistory: {
        enc_r1_petalsmith: 'lasting_grip',
        enc_r1_petalsmith_doubt: 'own_way',
        enc_r1_petalsmith_first_blade: 'name_it',
      },
    };
    save.encounters.pending.push({
      uid: 'enc_daily_store',
      encounterId: 'enc_r1_petalsmith_daily',
      regionId: 'r1',
      storyChoiceId: 'soft',
    });
    save.bag.items = { petal_sakura: 99, grass_soft: 99 };
    game.loadFrom(save);

    const firstView = game.pendingEncounterView('enc_daily_store');
    expect(game.pendingEncounterView('enc_daily_store')).toEqual(firstView);
    expect(firstView?.variantId).toBeDefined();
    expect(firstView?.choices[0].costs?.items).toEqual({
      crystal_altar: 1,
      jelly_cotton: 2,
    });
    const before = JSON.parse(JSON.stringify(game.save));
    expect(game.resolvePendingEncounter('enc_daily_store', 'materials')).toEqual({
      ok: false,
      reason: 'insufficient-resource',
    });
    expect(game.save).toEqual(before);

    game.save!.bag.items = { crystal_altar: 1, jelly_cotton: 2 };
    const resolution = game.resolvePendingEncounter('enc_daily_store', 'materials');
    expect(resolution.ok).toBe(true);
    expect(game.save?.encounters.characters.char_akane?.bond).toBe(3);
    expect(game.save?.encounters.pending).toHaveLength(0);
  });

  it('手札摘要和剧情回顾只读，不改变存档或随机状态', () => {
    const game = useGameStore();
    const save = createSave('旅途手札测试', 'witch', 303, Date.now());
    save.encounters.characters.char_akane = {
      bond: 1,
      completedEncounterIds: ['enc_r1_petalsmith'],
      choiceHistory: { enc_r1_petalsmith: 'lasting_grip' },
    };
    game.loadFrom(save);
    const before = JSON.parse(JSON.stringify(game.save));

    expect(game.encounterJournal).toHaveLength(1);
    expect(game.encounterJournal[0]?.completedEpisodes[0]?.answerLabel).toContain('握得更久');
    expect(game.replayEncounterStory('enc_r1_petalsmith').at(-1)?.text).toContain('草图');
    expect(game.save).toEqual(before);
    expect(game.save?.rngState).toBe(303);
    expect(game.save?.version).toBe(SAVE_VERSION);
  });
  it('在线首通会在旧关结算结束后进入下一关，并保留新关的初始演出状态', async () => {
    const game = useGameStore();
    const createdAt = Date.now() + 60_000;
    const save = createSave('在线切关测试', 'swordsman', 17, createdAt);
    const clearedStageId = save.progress.currentStageId;
    const clearedStage = STAGES[clearedStageId]!;
    const expectedNextStageId = nextStageId(clearedStageId)!;
    const target = totalMonsterCount(clearedStage);
    save.progress.stageKills[clearedStageId] = target - 1;
    game.loadFrom(save);
    expect(game.canIdle).toBe(true);

    const frames: FrameRequestCallback[] = [];
    let rafSequence = 0;
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        frames.push(callback);
        return ++rafSequence;
      }),
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    let clock = 1_000;
    vi.spyOn(performance, 'now').mockImplementation(() => clock);

    const settledKills = 3;
    const dt = (settledKills + 0.25) / game.kps;
    game.startLoop();
    const firstFrame = frames[0];
    expect(firstFrame).toBeDefined();
    if (!firstFrame) throw new Error('实时挂机循环没有登记首帧回调');
    clock += dt * 1_000;
    firstFrame(clock);

    expect(game.save?.progress.stageKills[clearedStageId]).toBe(target);
    expect(game.save?.progress.clearedStageIds).toContain(clearedStageId);
    expect(game.currentStage.id).toBe(expectedNextStageId);
    expect(game.currentStageKills).toBe(0);
    expect(game.battleProgress).toBe(0);
    expect(game.battlePulse).toBeNull();
    expect(game.battleTargetId).toBe(battleMonsterIdAt(STAGES[expectedNextStageId]!, 0));
    expect(game.battleBeats).toEqual([]);

    const newStageFrame = frames[1];
    expect(newStageFrame).toBeDefined();
    if (!newStageFrame) throw new Error('切换新关后没有登记下一帧回调');
    clock += 300;
    newStageFrame(clock);
    game.stopLoop();

    expect(game.battleBeats.length).toBeGreaterThan(0);
    expect(game.battleBeats[0]?.seq).toBe(1);
    expect(game.save?.bag.items.stone_enhance).toBeGreaterThan(0);
    await game.persist();
  });

  it('手动回刷已通关旧关时，离线结算后仍停留在该关', async () => {
    const game = useGameStore();
    const stageId = ORDERED_STAGE_IDS[0]!;
    const save = createSave('旧关回刷测试', 'swordsman', 19, Date.now() - 120_000);
    save.progress.currentStageId = stageId;
    save.progress.clearedStageIds.push(stageId);
    save.progress.stageKills[stageId] = totalMonsterCount(STAGES[stageId]!);
    game.loadFrom(save);

    expect(game.save?.stats.totalKills).toBeGreaterThan(0);
    expect(game.currentStage.id).toBe(stageId);
    expect(game.save?.progress.stageKills[stageId]).toBe(totalMonsterCount(STAGES[stageId]!));
    await game.persist();
  });

  it('含 BOSS 关首通会先完整发放首通与 BOSS 掉落，再自动进入下一关', async () => {
    const game = useGameStore();
    const bossStageId = ORDERED_STAGE_IDS.find(
      (stageId) => STAGES[stageId]?.bossId && nextStageId(stageId),
    )!;
    const bossStage = STAGES[bossStageId]!;
    const save = createSave('BOSS 切关测试', 'swordsman', 23, Date.now() - 120_000);
    save.player.level = 120;
    save.progress.currentStageId = bossStageId;
    game.loadFrom(save);

    expect(game.save?.progress.clearedStageIds).toContain(bossStageId);
    expect(game.currentStage.id).toBe(nextStageId(bossStageId));
    expect(game.save?.stats.bossKills[bossStage.bossId!]).toBeGreaterThan(0);
    expect(game.save?.bag.items.stone_reforge).toBeGreaterThan(2);
    expect(game.save?.bag.items.ore_black).toBeGreaterThan(10);
    await game.persist();
  });

  it('最后一关首次通关会保留奖励与 BOSS 掉落，并停留在最后一关', async () => {
    const game = useGameStore();
    const lastStageId = ORDERED_STAGE_IDS.at(-1)!;
    const lastStage = STAGES[lastStageId]!;
    const save = createSave('末关测试', 'swordsman', 29, Date.now() - 120_000);
    save.player.level = 120;
    const weapon = createInstance(
      requireEquipment('eq_r1_weapon_common'),
      new Rng(31),
      'e-final',
      save.player.classId,
    );
    weapon.affixes = [{ key: 'atk', value: 1_000_000, tier: 3 }];
    save.equipped.weapon = weapon;
    save.nextUid = 2;
    save.progress.currentStageId = lastStageId;
    // 节奏重排后末关首通要打满 clearCycles 轮（docs/56 §8），两分钟离线
    // 打不完是设计使然；本测试验证的是「首通结算」而非「从零打穿」，
    // 预置到只差 5 只，让这次结算恰好跨过终点线。
    save.progress.stageKills[lastStageId] = stageClearTarget(lastStage) - 5;
    game.loadFrom(save);

    expect(game.save?.progress.clearedStageIds).toContain(lastStageId);
    expect(game.currentStage.id).toBe(lastStageId);
    expect(game.save?.stats.bossKills[lastStage.bossId!]).toBeGreaterThan(0);
    expect(game.save?.bag.items.stone_reforge).toBeGreaterThan(2);
    expect(game.save?.bag.items.ore_black).toBeGreaterThan(10);
    await game.persist();
  });
});

function classSwitchSave(): SaveData {
  const now = Date.now() + 60_000;
  const save = createSave('共享进度测试', 'witch', 301, now);
  save.player.level = 20;
  save.player.exp = 7_654;
  save.player.gold = 987_654;
  save.player.stamina = 43;
  save.bag.items = { stone_enhance: 88, ore_black: 13 };
  save.progress.stageKills[save.progress.currentStageId] = 7;
  save.progress.pity['loot_r1:eq_r1_ring_rare'] = 11;
  save.progress.seenTutorials = ['chapter_1'];
  save.settings.autoDecomposeBelow = 'rare';
  save.stats.totalKills = 4321;
  save.stats.totalPlaySec = 123.5;
  save.stats.bossKills.mon_slime_king = 2;
  save.shop.purchasedOfferIds = ['shop-proof'];
  save.encounters = {
    progressSec: 45,
    generatedCount: 3,
    resolvedCount: 2,
    pending: [
      {
        uid: 'enc-switch-proof',
        encounterId: 'enc_r1_petalsmith',
        regionId: 'r1',
      },
    ],
    characters: {},
  };
  return save;
}

describe('设置 setter（M4-12 设置页）', () => {
  it('setReduceMotion 写入省电动画开关', () => {
    const game = useGameStore();
    game.loadFrom(createSave('设置测试', 'swordsman', 1, Date.now()));
    expect(game.setReduceMotion(true)).toBe(true);
    expect(game.save?.settings.reduceMotion).toBe(true);
    expect(game.setReduceMotion(false)).toBe(true);
    expect(game.save?.settings.reduceMotion).toBe(false);
  });

  it('setAutoDecomposeBelow 写入自动分解门槛', () => {
    const game = useGameStore();
    game.loadFrom(createSave('设置测试', 'swordsman', 1, Date.now()));
    expect(game.setAutoDecomposeBelow('fine')).toBe(true);
    expect(game.save?.settings.autoDecomposeBelow).toBe('fine');
    expect(game.setAutoDecomposeBelow('none')).toBe(true);
    expect(game.save?.settings.autoDecomposeBelow).toBe('none');
  });

  it('setVisualQuality 写入画质档位', () => {
    const game = useGameStore();
    game.loadFrom(createSave('设置测试', 'swordsman', 1, Date.now()));
    expect(game.setVisualQuality('lite')).toBe(true);
    expect(game.save?.settings.visualQuality).toBe('lite');
    expect(game.setVisualQuality('standard')).toBe(true);
    expect(game.save?.settings.visualQuality).toBe('standard');
  });

  it('setSfx/setBgm 写入声音开关（M4-11：音效默认开、BGM 默认关）', () => {
    const game = useGameStore();
    game.loadFrom(createSave('设置测试', 'swordsman', 1, Date.now()));
    // 新档默认：sfx 开、bgm 关
    expect(game.save?.settings.sfx).toBe(true);
    expect(game.save?.settings.bgm).toBe(false);
    expect(game.setSfx(false)).toBe(true);
    expect(game.save?.settings.sfx).toBe(false);
    expect(game.setSfx(true)).toBe(true);
    expect(game.save?.settings.sfx).toBe(true);
    expect(game.setBgm(true)).toBe(true);
    expect(game.save?.settings.bgm).toBe(true);
    expect(game.setBgm(false)).toBe(true);
    expect(game.save?.settings.bgm).toBe(false);
  });

  it('无存档时 setter 返回 false 且不抛错', () => {
    const game = useGameStore();
    expect(game.setReduceMotion(true)).toBe(false);
    expect(game.setAutoDecomposeBelow('rare')).toBe(false);
    expect(game.setVisualQuality('lite')).toBe(false);
  });
});

function sharedProgressSnapshot(save: SaveData): unknown {
  const snapshot = jsonClone(save);
  return {
    version: snapshot.version,
    createdAt: snapshot.createdAt,
    lastActiveAt: snapshot.lastActiveAt,
    seed: snapshot.seed,
    rngState: snapshot.rngState,
    nextUid: snapshot.nextUid,
    player: {
      name: snapshot.player.name,
      level: snapshot.player.level,
      exp: snapshot.player.exp,
      gold: snapshot.player.gold,
      stamina: snapshot.player.stamina,
      staminaRecoverAt: snapshot.player.staminaRecoverAt,
    },
    bagItems: snapshot.bag.items,
    progress: snapshot.progress,
    settings: snapshot.settings,
    stats: snapshot.stats,
    shop: snapshot.shop,
    encounters: snapshot.encounters,
  };
}

function ownedEquipmentUids(save: SaveData): string[] {
  return [
    ...save.bag.equipment,
    ...Object.values(save.equipped).filter(
      (instance): instance is EquipmentInstance => instance !== null,
    ),
  ]
    .map((instance) => instance.uid)
    .sort();
}

function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe('equipment decisions', () => {
  function presetScenario() {
    const game = useGameStore();
    const save = createSave('预设测试', 'witch', 18, Date.now());
    save.player.level = 99;
    save.nextUid = 3;
    const neutral = createInstance(
      requireEquipment('eq_r1_weapon_common'),
      new Rng(181),
      'e1',
      save.player.classId,
    );
    const fire = createInstance(
      requireEquipment('eq_r2_weapon_fine'),
      new Rng(182),
      'e2',
      save.player.classId,
    );
    save.equipped.weapon = fire;
    save.bag.equipment.push(neutral);
    const targetStageId = ORDERED_STAGE_IDS.find(
      (stageId) => STAGES[stageId]?.chapterId === '2-5',
    )!;
    const targetIndex = ORDERED_STAGE_IDS.indexOf(targetStageId);
    save.progress.clearedStageIds = ORDERED_STAGE_IDS.slice(0, targetIndex);
    game.loadFrom(save);
    return { game, neutral, fire, targetStageId };
  }

  it('预设保存会锁定装备，自动切入属性关时整套应用并给出反馈', async () => {
    const { game, neutral, fire, targetStageId } = presetScenario();

    expect(game.captureEquipmentPreset('preset-1')).toMatchObject({ ok: true });
    expect(fire.locked).toBe(true);
    expect(game.equip(neutral.uid)).toBe(true);
    expect(game.setEquipmentPresetAutoSwitch(true)).toBe(true);
    const staminaBefore = game.save!.player.stamina;

    expect(game.selectStage(targetStageId)).toBe(true);
    expect(game.save!.equipped.weapon?.uid).toBe(fire.uid);
    expect(game.save!.bag.equipment.map((instance) => instance.uid)).toContain(neutral.uid);
    expect(game.save!.player.stamina).toBeLessThan(staminaBefore);
    expect(game.equipmentPresetNotice).toMatchObject({
      kind: 'switched',
      presetId: 'preset-1',
      counterElement: 'fire',
    });
    await game.persist();
  });

  it('预设装备不能被解锁；删除预设后由玩家自行决定是否解除保护', async () => {
    const { game, neutral, fire } = presetScenario();
    expect(game.captureEquipmentPreset('preset-1')).toMatchObject({ ok: true });
    expect(game.equip(neutral.uid)).toBe(true);

    game.toggleLock(fire.uid);
    expect(fire.locked).toBe(true);
    expect(game.deleteEquipmentPreset('preset-1')).toBe(true);
    expect(fire.locked).toBe(true);
    game.toggleLock(fire.uid);
    expect(fire.locked).toBe(false);
    await game.persist();
  });

  it('自动预设存在坏引用时不切关、不扣体力，也不提交半套装备', async () => {
    const { game, neutral, targetStageId } = presetScenario();
    expect(game.captureEquipmentPreset('preset-1')).toMatchObject({ ok: true });
    expect(game.equip(neutral.uid)).toBe(true);
    expect(game.setEquipmentPresetAutoSwitch(true)).toBe(true);
    await game.persist();

    game.save!.equipmentPresets.presets[0]!.equipmentUids.ring = 'missing-ring';
    const staminaBefore = game.save!.player.stamina;
    const stageBefore = game.currentStage.id;

    expect(game.selectStage(targetStageId)).toBe(false);
    expect(game.save!.player.stamina).toBe(staminaBefore);
    expect(game.currentStage.id).toBe(stageBefore);
    expect(game.save!.equipped.weapon?.uid).toBe(neutral.uid);
    expect(game.equipmentPresetNotice).toMatchObject({
      kind: 'blocked',
      presetId: 'preset-1',
      reason: 'missing-equipment',
    });
  });

  it('装备比较使用角色整套属性，普通武器不会再被攻速 0 乘成零战力', async () => {
    const game = useGameStore();
    const save = createSave('装备测试', 'swordsman', 8, Date.now());
    save.player.level = 2;
    const definition = requireEquipment('eq_r1_weapon_common');
    const item = createInstance(definition, new Rng(1), 'e1', save.player.classId);
    save.bag.equipment.push(item);
    game.loadFrom(save);

    const before = game.cp;
    expect(game.equipmentContributionCp(item)).toBeGreaterThan(0);
    expect(game.equipmentCandidateCp(item)).toBeGreaterThan(before);
    expect(game.equipBest()).toBe(1);
    expect(game.cp).toBeGreaterThan(before);
    await game.persist();
  });

  it('未达到需求等级不能穿戴，也不会被一键最优选中', async () => {
    const game = useGameStore();
    const save = createSave('等级测试', 'swordsman', 9, Date.now());
    const definition = requireEquipment('eq_r2_weapon_epic');
    const item = createInstance(definition, new Rng(2), 'e2', save.player.classId);
    save.bag.equipment.push(item);
    game.loadFrom(save);

    expect(game.equip(item.uid)).toBe(false);
    expect(game.equipBest()).toBe(0);
    expect(game.save?.equipped.weapon).toBeNull();
    await game.persist();
  });

  it('职业专属武器不能被其他职业穿戴或一键选中', async () => {
    const game = useGameStore();
    const save = createSave('职业测试', 'swordsman', 10, Date.now());
    save.player.level = 20;
    const witchWeapon = requireEquipment('eq_shop_berry-cream_weapon_witch');
    const item = createInstance(witchWeapon, new Rng(3), 'e3', save.player.classId);
    save.bag.equipment.push(item);
    game.loadFrom(save);

    expect(game.equip(item.uid)).toBe(false);
    expect(game.equipBest()).toBe(0);
    expect(game.save?.equipped.weapon).toBeNull();
    await game.persist();
  });

  it('批量分解可处理蓝色和紫色装备，但始终跳过锁定装备', async () => {
    const game = useGameStore();
    const save = createSave('分解测试', 'swordsman', 12, Date.now());
    const blueDef = requireEquipment('eq_r1_weapon_rare');
    const purpleDef = requireEquipment('eq_r2_weapon_epic');
    const blue = createInstance(blueDef, new Rng(4), 'blue', save.player.classId);
    const purple = createInstance(purpleDef, new Rng(5), 'purple', save.player.classId);
    const locked = createInstance(purpleDef, new Rng(6), 'locked', save.player.classId);
    blue.locked = false;
    purple.locked = false;
    locked.locked = true;
    save.bag.equipment.push(blue, purple, locked);
    game.loadFrom(save);

    const result = game.decompose([blue.uid, purple.uid, locked.uid]);

    expect(result).toEqual({
      count: 2,
      gold: decomposeGold(blueDef, blue) + decomposeGold(purpleDef, purple),
    });
    expect(game.save?.bag.equipment.map((item) => item.uid)).toEqual([locked.uid]);
    expect(game.save?.player.gold).toBe(result.gold);
    await game.persist();
  });
});

function enhancedInstance(
  enhance: number,
  overrides: Partial<EquipmentInstance> = {},
): EquipmentInstance {
  return {
    uid: 'e1',
    // docs/73 批 3 乘法投影：Lv20 强化 Lv2 白装只涨 0.23 真实战力（取整后 +0），
    // 用例改用同等级区域掉落（r2 epic Lv20），强化 +5 真实增量 ≈7.5 才看得见。
    defId: 'eq_r2_weapon_epic',
    enhance,
    baseRollPermille: 1000,
    enhanceGainPermille: Array.from({ length: ENHANCE_MAX }, (_, index) =>
      index < enhance ? 80 : 0,
    ),
    enhanceLuck: {},
    affixes: [],
    reforgeResonance: 0,
    locked: false,
    ...overrides,
  };
}

function forgeSave(instance: EquipmentInstance, seed: number) {
  const save = createSave('强化测试', 'swordsman', seed, Date.now());
  save.player.level = 20;
  save.player.gold = 10_000_000;
  save.nextUid = 2;
  save.bag.items = {
    [ENHANCE_MATERIAL_IDS.stone]: 100_000,
    [ENHANCE_MATERIAL_IDS.ore]: 100_000,
    [ENHANCE_MATERIAL_IDS.lucky]: 100_000,
    [ENHANCE_MATERIAL_IDS.protection]: 10,
  };
  save.bag.equipment.push(instance);
  return save;
}

function seedForRoll(predicate: (roll: number) => boolean): number {
  for (let seed = 1; seed < 100_000; seed++) {
    if (predicate(new Rng(seed).next())) return seed;
  }
  throw new Error('测试未找到符合条件的种子');
}

describe('enhancement transaction', () => {
  it('一键单件会连续强化到目标，并把钱包、装备和 RNG 一次提交', async () => {
    const instance = enhancedInstance(0);
    const save = forgeSave(instance, 90);
    save.bag.equipment = [];
    save.equipped.weapon = instance;
    const beforeGold = save.player.gold;
    const beforeStone = save.bag.items[ENHANCE_MATERIAL_IDS.stone]!;
    const game = useGameStore();
    game.loadFrom(save);

    const result = game.autoEnhanceEquipment(instance.uid, 5);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.stopReason).toBe('target-reached');
    expect(result.attempts).toHaveLength(5);
    expect(result.instances[0]?.enhance).toBe(5);
    expect(game.save?.equipped.weapon?.enhance).toBe(5);
    expect(game.save?.player.gold).toBe(
      beforeGold - result.attempts.reduce((sum, attempt) => sum + attempt.cost.gold, 0),
    );
    expect(game.save?.bag.items[ENHANCE_MATERIAL_IDS.stone]).toBe(
      beforeStone - result.attempts.reduce((sum, attempt) => sum + attempt.cost.stone, 0),
    );
    expect(result.cpDelta).toBeGreaterThan(0);
    await game.persist();
  });

  it('一键全身按固定槽位逐轮均衡强化，不让第一件先吃光材料', async () => {
    const weapon = enhancedInstance(0, { uid: 'weapon' });
    const head = enhancedInstance(0, { uid: 'head', defId: 'eq_r2_head_epic' });
    const save = forgeSave(weapon, 92);
    save.bag.equipment = [];
    save.equipped.weapon = weapon;
    save.equipped.head = head;
    const game = useGameStore();
    game.loadFrom(save);

    const result = game.autoEnhanceAllEquipped(5);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.stopReason).toBe('target-reached');
    expect(result.attempts.map((attempt) => attempt.uid)).toEqual([
      'weapon',
      'head',
      'weapon',
      'head',
      'weapon',
      'head',
      'weapon',
      'head',
      'weapon',
      'head',
    ]);
    expect(game.save?.equipped.weapon?.enhance).toBe(5);
    expect(game.save?.equipped.head?.enhance).toBe(5);
    expect(result.cpDelta).toBeGreaterThan(0);
    await game.persist();
  });

  it('一键强化资源不足时不推进 RNG，也不触碰任何存档字段', async () => {
    const instance = enhancedInstance(12);
    const save = forgeSave(instance, 93);
    save.bag.equipment = [];
    save.equipped.weapon = instance;
    delete save.bag.items[ENHANCE_MATERIAL_IDS.protection];
    const game = useGameStore();
    game.loadFrom(save);
    const before = JSON.parse(JSON.stringify(game.save));

    const result = game.autoEnhanceEquipment(instance.uid, 13);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.stopReason).toBe('blocked');
    expect(result.attempts).toHaveLength(0);
    expect(result.blocked[0]?.reason).toBe('insufficient-protection');
    expect(game.save).toEqual(before);
    await game.persist();
  });

  it('没有穿戴装备时，一键全身会明确拒绝且不改存档', async () => {
    const game = useGameStore();
    const save = createSave('空装备强化测试', 'witch', 94, Date.now());
    game.loadFrom(save);
    const before = JSON.parse(JSON.stringify(game.save));

    expect(game.autoEnhanceAllEquipped()).toEqual({ ok: false, reason: 'no-equipped' });
    expect(game.save).toEqual(before);
    await game.persist();
  });

  it('非法一键目标会在进入纯逻辑前拒绝，不改装备或 RNG', async () => {
    const instance = enhancedInstance(0);
    const game = useGameStore();
    game.loadFrom(forgeSave(instance, 95));
    const before = JSON.parse(JSON.stringify(game.save));

    expect(game.autoEnhanceEquipment(instance.uid, 0)).toEqual({
      ok: false,
      reason: 'invalid-target',
    });
    expect(game.autoEnhanceAllEquipped(ENHANCE_MAX + 1)).toEqual({
      ok: false,
      reason: 'invalid-target',
    });
    expect(game.save).toEqual(before);
    await game.persist();
  });

  it('满幸运成功只推进一格主 RNG，并固定首次成功的随机增幅', async () => {
    const seed = 91;
    const instance = enhancedInstance(5, { enhanceLuck: { '6': 100 } });
    const game = useGameStore();
    const save = forgeSave(instance, seed);
    save.bag.equipment = [];
    save.equipped.weapon = instance;
    game.loadFrom(save);
    const expectedRng = new Rng(seed);
    expectedRng.next();

    const result = game.enhanceEquipment(instance.uid, false);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result).toMatchObject({
      outcome: 'success',
      targetLevel: 6,
      nextLevel: 6,
      guaranteed: true,
      protectionConsumed: false,
    });
    expect(result.gainRoll).not.toBeNull();
    expect(result.instance?.enhance).toBe(6);
    expect(result.instance?.enhanceGainPermille[5]).toBe(result.gainRoll?.permille);
    expect(result.instance?.enhanceLuck).not.toHaveProperty('6');
    expect(game.save?.rngState).toBe(expectedRng.getState());
    expect(result.cpDelta).toBeGreaterThan(0);
    await game.persist();
  });

  it('普通失败保级、增加当前目标幸运，并照常扣基础材料', async () => {
    const seed = seedForRoll((roll) => roll >= 0.85);
    const instance = enhancedInstance(5);
    const save = forgeSave(instance, seed);
    const beforeGold = save.player.gold;
    const beforeStone = save.bag.items[ENHANCE_MATERIAL_IDS.stone]!;
    const game = useGameStore();
    game.loadFrom(save);

    const result = game.enhanceEquipment(instance.uid, false);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.outcome).toBe('failed');
    expect(result.instance?.enhance).toBe(5);
    expect(result.instance?.enhanceLuck['6']).toBe(2);
    expect(game.save?.player.gold).toBe(beforeGold - result.cost.gold);
    expect(game.save?.bag.items[ENHANCE_MATERIAL_IDS.stone]).toBe(beforeStone - result.cost.stone);
    await game.persist();
  });

  it('冲 +10 失败会掉级，但保留已掷出的高位增幅供复升复用', async () => {
    const seed = seedForRoll((roll) => roll >= 0.45);
    const instance = enhancedInstance(9);
    const game = useGameStore();
    game.loadFrom(forgeSave(instance, seed));

    const result = game.enhanceEquipment(instance.uid, false);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.outcome).toBe('downgraded');
    expect(result.instance?.enhance).toBe(8);
    expect(result.instance?.enhanceGainPermille[8]).toBe(80);
    expect(result.instance?.enhanceLuck['10']).toBe(3);
    await game.persist();
  });

  it('保护符只在实际防住碎裂时消耗', async () => {
    const seed = seedForRoll((roll) => roll >= 0.22);
    const instance = enhancedInstance(12);
    const save = forgeSave(instance, seed);
    save.bag.items[ENHANCE_MATERIAL_IDS.protection] = 1;
    const game = useGameStore();
    game.loadFrom(save);

    const result = game.enhanceEquipment(instance.uid, true);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.outcome).toBe('protected');
    expect(result.result.protectionConsumed).toBe(true);
    expect(result.instance?.enhance).toBe(12);
    expect(result.instance?.enhanceLuck['13']).toBe(5);
    expect(game.save?.bag.items[ENHANCE_MATERIAL_IDS.protection]).toBeUndefined();
    await game.persist();
  });

  it('碎裂会从背包或穿戴槽删除整件装备及其全部幸运桶', async () => {
    const seed = seedForRoll((roll) => roll >= 0.22);

    for (const location of ['bag', 'equipped'] as const) {
      setActivePinia(createPinia());
      const instance = enhancedInstance(12, { enhanceLuck: { '13': 40, '14': 12 } });
      const save = forgeSave(instance, seed);
      if (location === 'equipped') {
        save.bag.equipment = [];
        save.equipped.weapon = instance;
      }
      const game = useGameStore();
      game.loadFrom(save);

      const result = game.enhanceEquipment(instance.uid, false);

      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.result.outcome).toBe('broken');
      expect(result.instance).toBeNull();
      expect(game.save?.bag.equipment).toHaveLength(0);
      expect(game.save?.equipped.weapon).toBeNull();
      await game.persist();
    }
  });

  it('幸运保底成功不要求也不消耗保护符', async () => {
    const instance = enhancedInstance(12, { enhanceLuck: { '13': 100 } });
    const save = forgeSave(instance, 12);
    delete save.bag.items[ENHANCE_MATERIAL_IDS.protection];
    const game = useGameStore();
    game.loadFrom(save);

    const quote = game.quoteEnhance(instance.uid, true);
    expect(quote.ok && quote.guaranteed).toBe(true);
    const result = game.enhanceEquipment(instance.uid, true);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.outcome).toBe('success');
    expect(result.result.protectionConsumed).toBe(false);
    expect(game.save?.bag.items[ENHANCE_MATERIAL_IDS.protection]).toBeUndefined();
    await game.persist();
  });

  it('掉级后复升已有增幅时不重掷该格', async () => {
    const gains: number[] = Array.from({ length: ENHANCE_MAX }, (_, index) => (index < 8 ? 80 : 0));
    gains[8] = 110;
    const instance = enhancedInstance(8, {
      enhanceGainPermille: gains,
      enhanceLuck: { '9': 100 },
    });
    const game = useGameStore();
    game.loadFrom(forgeSave(instance, 44));

    const result = game.enhanceEquipment(instance.uid, false);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.outcome).toBe('success');
    expect(result.gainRoll).toBeNull();
    expect(result.instance?.enhanceGainPermille[8]).toBe(110);
    await game.persist();
  });

  it.each([
    ['insufficient-gold', 'gold'],
    ['insufficient-stone', 'stone'],
    ['insufficient-ore', 'ore'],
    ['insufficient-lucky', 'lucky'],
    ['insufficient-protection', 'protection'],
  ] as const)('%s 时资产与 RNG 完全不变', async (reason, missing) => {
    const instance = enhancedInstance(12);
    const save = forgeSave(instance, 77);
    if (missing === 'gold') save.player.gold = 0;
    else delete save.bag.items[ENHANCE_MATERIAL_IDS[missing]];
    const game = useGameStore();
    game.loadFrom(save);
    const before = JSON.parse(JSON.stringify(game.save));

    const result = game.enhanceEquipment(instance.uid, missing === 'protection');

    expect(result).toEqual({ ok: false, reason });
    expect(game.save).toEqual(before);
    await game.persist();
  });
});

describe('equipment dungeon transaction', () => {
  const now = Date.parse('2026-07-28T10:00:00+08:00');

  beforeEach(() => vi.setSystemTime(now));
  afterEach(() => vi.useRealTimers());

  function dungeonSave(powerful: boolean): SaveData {
    const save = createSave('副本测试', 'witch', 20260728, now);
    // 强场景用 Lv90 + 超模词条保证必胜；弱场景用刚好解锁副本的 Lv20 裸装。
    //
    // 原来弱场景是 Lv90 裸装，刚好卡在平衡线附近 —— 怪物攻击一下调它就打赢了，
    // 「失败不消耗次数」这条测试跟着变红。测试要验的是「输了不扣次数」，
    // 夹具就该确定性地输，不该随平衡调整摇摆。
    // 用 Lv20 而不是更低：副本有等级门槛，再低会返回 level-locked，
    // 那样测的就不是「战斗失败」而是「没解锁」了。
    save.player.level = powerful ? 90 : 20;
    if (powerful) {
      const weapon = createInstance(
        requireEquipment('eq_dungeon_crimson_weapon_witch'),
        new Rng(20260729),
        'dungeon-power',
        save.player.classId,
      );
      weapon.affixes = [
        { key: 'def', value: 1_000_000, tier: 3 },
        { key: 'hp', value: 10_000_000, tier: 3 },
        { key: 'acc', value: 100_000, tier: 3 },
        // 史诗武器的最后一格是唯一职业预留槽；超模测试值可以很大，
        // 但结构本身仍必须是 v11 可持久化布局。
        { key: 'wit_power', value: 10_000_000, tier: 3 },
      ];
      save.equipped.weapon = weapon;
    }
    return save;
  }

  it('胜利原子提交次数、RNG、UID、定向装备与持久化记录', async () => {
    const game = useGameStore();
    const save = dungeonSave(true);
    const beforeRng = save.rngState;
    const beforeUid = save.nextUid;
    game.loadFrom(save);

    const result = game.runEquipmentDungeon('equipment_weapon_azure', now);

    expect(result.ok && result.win).toBe(true);
    if (!result.ok || !result.win) return;

    // 烙印激活批次（docs/58 §3.3）：副本只掉材料，不再产出装备实例。
    // 原断言「生成 2 件定向装备」描述的正是被取代的设计。
    /*
     * 首破必掉 1 件胚子（docs/66 §4.2），所以这里从「零装备」变成「一件主线胚子」。
     * docs/58 的红线是「副本不再产出带定义级 setId 的整装」——
     * 主线胚子没有 setId、可烙印，不违反它。
     */
    expect(result.instances).toHaveLength(1);
    expect(result.instances[0]?.defId).toMatch(/^eq_r\d+_weapon_/);

    // 材料直接进背包（首通两轮掷骰，各 2~3 颗）
    const crystalId = IMPRINT_CRYSTAL_IDS.azure;
    const gained = game.save?.bag.items[crystalId] ?? 0;
    expect(gained).toBeGreaterThanOrEqual(EQUIPMENT_DUNGEON_CRYSTAL_MIN * 2);
    expect(gained).toBeLessThanOrEqual(EQUIPMENT_DUNGEON_CRYSTAL_MAX * 2);
    // 首通同样计次（2026-07-30 回滚 docs/47 §4.1，理由见 core 注释）
    expect(game.save?.equipmentDungeon).toMatchObject({
      clearsToday: 1,
      totalClears: 1,
    });
    expect(game.save?.equipmentDungeon.records.equipment_weapon_azure_d1?.clears).toBe(1);
    expect(game.save?.equipmentDungeon.depth.azure).toBe(1);
    expect(game.save?.rngState).not.toBe(beforeRng);
    // 没有装备实例产出，uid 计数器不该前进
    expect(game.save?.nextUid).toBe(beforeUid + 1);
    expect(game.equipmentDungeonRemaining).toBe(2);

    await game.persist();
    const loaded = await loadSave();
    expect(loaded?.equipmentDungeon.records.equipment_weapon_azure_d1?.clears).toBe(1);
    expect(loaded?.bag.items[crystalId]).toBe(gained);
  });

  it('失败不消耗次数、不生成装备、不推进 RNG 与保底', async () => {
    const game = useGameStore();
    const save = dungeonSave(false);
    save.progress.pity.keep = 9;
    const before = jsonClone(save);
    game.loadFrom(save);

    const result = game.runEquipmentDungeon('equipment_weapon_azure', now);

    expect(result.ok && !result.win).toBe(true);
    expect(game.save?.equipmentDungeon).toEqual(before.equipmentDungeon);
    expect(game.save?.progress.pity).toEqual(before.progress.pity);
    expect(game.save?.rngState).toBe(before.rngState);
    expect(game.save?.nextUid).toBe(before.nextUid);
    expect(game.save?.bag.equipment).toEqual(before.bag.equipment);
    await game.persist();
  });

  it('同部位前一档未通关和每日次数用完都会阻止发奖', () => {
    const game = useGameStore();
    const save = dungeonSave(true);
    game.loadFrom(save);

    /*
     * 档位链已被深度链取代（docs/66 §2.1）：绛紫档不再要求先通苍蓝，
     * 而是要求「该档已通过的最高深度 + 1」。所以直接打绛紫 d1 是允许的，
     * 打 d2 才会被拒 —— 等级与档位顺序都不再是门槛，**打得过就能打**。
     */
    expect(game.runEquipmentDungeon('equipment_weapon_violet', now, 2)).toEqual({
      ok: false,
      reason: 'previous-depth-locked',
    });

    game.save!.equipmentDungeon.clearsToday = 3;
    expect(game.runEquipmentDungeon('equipment_weapon_azure', now)).toEqual({
      ok: false,
      reason: 'daily-limit',
    });
    expect(game.save?.bag.equipment).toHaveLength(0);
  });

  it('跨 04:00 日切恢复三次，永久纪录保留', async () => {
    const game = useGameStore();
    const save = dungeonSave(true);
    save.equipmentDungeon = {
      dayKey: '2026-07-27',
      clearsToday: 3,
      totalClears: 2,
      depth: { azure: 1 },
      records: {
        equipment_ring_azure_d1: {
          clears: 2,
          firstClearedAt: now - 86_400_000,
          bestDurationMs: 22_000,
        },
      },
    };
    game.loadFrom(save);

    const result = game.runEquipmentDungeon('equipment_weapon_azure', now);

    expect(result.ok && result.win).toBe(true);
    expect(game.save?.equipmentDungeon.dayKey).toBe('2026-07-28');
    // 日切清零后这次首通胜利计 1 次
    expect(game.save?.equipmentDungeon.clearsToday).toBe(1);
    expect(game.save?.equipmentDungeon.totalClears).toBe(3);
    expect(game.save?.equipmentDungeon.records.equipment_ring_azure_d1?.clears).toBe(2);
    // 日切不动深度：只升不降（docs/40 红线）
    expect(game.save?.equipmentDungeon.depth.azure).toBe(1);
    await game.persist();
  });

  /**
   * 深度 UI 契约（docs/66 §八 第 6 步）。
   *
   * 这三个签名由 DungeonView 直接消费。测试守住真实 store 公共接口，UI 挂载
   * 直接消费 core 评估结果，不再通过第二套 adapter 自证。
   */
  it('深度 UI 契约三件套：进度、评估、按部位挑战', () => {
    const game = useGameStore();
    game.loadFrom(dungeonSave(true));

    // ① 进度：新档一层未过
    expect(game.equipmentDungeonDepth).toEqual({});

    // ② 评估：返回 UI 要展示的全部字段
    const evaluation = game.evaluateDungeonDepth('azure', 1);
    expect(evaluation).toMatchObject({
      unlocked: true,
      reason: 'ok',
      isFirstBreak: true,
    });
    expect(evaluation.nominalLevel).toBeGreaterThan(0);
    expect(evaluation.anchorLevel).toBeGreaterThan(0);
    expect(evaluation.recommendCp).toBeGreaterThan(0);
    expect(evaluation.blankChance).toBeGreaterThan(0);

    // 跳级要被拒，且原因可读
    expect(game.evaluateDungeonDepth('azure', 2).reason).toBe('previous-depth');
    // crimson 只开 d1
    expect(game.evaluateDungeonDepth('crimson', 2).reason).toBe('not-opened');

    // ③ 按部位挑战：UI 不用拼关卡 id
    const result = game.runEquipmentDungeonDepth('weapon', 'azure', 1, now);
    expect(result.ok).toBe(true);
    // 打赢之后深度进度真的推进了
    expect(game.equipmentDungeonDepth.azure).toBe(1);
    // M4-8 怪物图鉴：打赢后本档位遭遇怪全部入账（只增不删）
    const dungeonStage = EQUIPMENT_DUNGEON_STAGES['equipment_weapon_azure'];
    const discovered = new Set(game.save!.monsterCodex.discoveredMonsterIds);
    for (const encounter of dungeonStage.encounters) {
      expect(discovered.has(encounter.monster.id), `副本图鉴缺 ${encounter.monster.id}`).toBe(true);
    }
  });

  it('穿齐八件副本套装后，属性与技能共鸣真实进入 store 结算', () => {
    const game = useGameStore();
    const save = dungeonSave(false);
    const ids = [
      'eq_dungeon_azure_weapon_witch',
      'eq_dungeon_azure_head_1',
      'eq_dungeon_azure_body_witch',
      'eq_dungeon_azure_necklace_1',
      'eq_dungeon_azure_bracelet_1',
      'eq_dungeon_azure_ring_1',
      'eq_dungeon_azure_belt_1',
      'eq_dungeon_azure_shoes_1',
    ];
    SLOT_ORDER.forEach((slot, index) => {
      save.equipped[slot] = createInstance(
        requireEquipment(ids[index]!),
        new Rng(80_000 + index),
        `set-${index}`,
        save.player.classId,
      );
    });
    game.loadFrom(save);

    expect(game.equipmentSetResolution.sets[0]).toMatchObject({
      equippedPieces: 8,
      activeBonuses: [{ pieces: 2 }, { pieces: 4 }, { pieces: 6 }, { pieces: 8 }],
    });
    // 8 件档已降级为纯外观（docs/58 §四）：它仍然「激活」并授予称号，
    // 但**一分战斗收益都不给**。这条端到端证明降级真的落到了结算里，
    // 而不只是改了数据表 —— 数据改了但结算仍在加成，是最难发现的一类漏改。
    expect(game.equipmentSetResolution.skillMultiplierBonus).toBe(0);
    const expectedSkillMultiplier = averageSkillMultiplier(save.player.level);
    expect(game.playerSkillMultiplier).toBeCloseTo(expectedSkillMultiplier, 10);
    expect(usePlayerStore().playerSkillMultiplier).toBeCloseTo(expectedSkillMultiplier, 10);
    expect(game.equipmentSetResolution.statPercent).toMatchObject({
      atk: 0.04,
      def: 0.06,
      hp: 0.08,
    });
    expect(game.equipmentSetResolution.combatBonuses).toEqual({
      damageReduction: 0,
      lifesteal: 0,
      elementDamage: { fire: 0, ice: 0, thunder: 0 },
    });
    expect(game.equipmentSetResolution.onHitTriggers).toEqual([]);
    expect(usePlayerStore().playerOnHitTriggers).toEqual([]);
    expect(game.finalStats.critRate).toBeGreaterThanOrEqual(10);

    const firstMonsterId = game.currentStage.waves[0]?.monsters[0]?.id;
    if (!firstMonsterId) throw new Error('[测试配置错误] 当前关卡缺少代表怪');
    const modeledPlayer = makePlayer(
      game.player!.name,
      game.player!.level,
      game.finalStats,
      game.playerCombatElement,
      game.equipCombatBonuses,
    );
    expect(game.battleEfficiency).toBeCloseTo(
      combatEfficiency(
        modeledPlayer,
        makeMonster(requireMonster(firstMonsterId)),
        expectedSkillMultiplier,
      ),
      10,
    );
  });
});

describe('boutique purchase transaction', () => {
  const offer = SHOP_OFFERS.find((entry) => entry.defId === 'eq_shop_berry-cream_body')!;

  function richSave() {
    const save = createSave('商店测试', 'witch', 88, Date.now());
    save.player.level = 20;
    save.player.gold = offer.price * 2;
    save.progress.clearedStageIds.push(offer.unlockStageId);
    return save;
  }

  it('成功购买只扣一次金币、只生成一件装备并持久化限购状态', async () => {
    const game = useGameStore();
    const save = richSave();
    const beforeUid = save.nextUid;
    game.loadFrom(save);

    const result = game.purchaseShopOffer(offer.id);
    expect(result.ok).toBe(true);
    expect(game.save?.player.gold).toBe(offer.price);
    expect(game.save?.bag.equipment).toHaveLength(1);
    const bought = game.save!.bag.equipment[0]!;
    expect(bought).toMatchObject({
      uid: `e${beforeUid}`,
      defId: offer.defId,
      locked: true,
    });
    // 珍品现在带额外可洗槽（2026-07-30 品质平衡）：固定词条仍写死在
    // def.fixedAffixes 不进实例，实例里应恰好是额外槽数条随机词条。
    const purchasedDef = requireEquipment(offer.defId);
    expect(bought.affixes).toHaveLength(purchasedDef.extraAffixSlots ?? 0);
    expect(game.save?.nextUid).toBe(beforeUid + 1);
    expect(game.save?.shop.purchasedOfferIds).toEqual([offer.id]);

    const second = game.purchaseShopOffer(offer.id);
    expect(second).toEqual({ ok: false, reason: 'sold-out' });
    expect(game.save?.player.gold).toBe(offer.price);
    expect(game.save?.bag.equipment).toHaveLength(1);
    expect(game.save?.nextUid).toBe(beforeUid + 1);

    await game.persist();
    const loaded = await loadSave();
    expect(loaded?.shop.purchasedOfferIds).toEqual([offer.id]);
    expect(loaded?.bag.equipment[0]?.defId).toBe(offer.defId);
  });

  it('金币、等级或关卡不足时不修改任何资产字段', async () => {
    const game = useGameStore();
    const save = richSave();
    save.player.gold = offer.price - 1;
    game.loadFrom(save);
    const before = JSON.parse(JSON.stringify(game.save));

    expect(game.purchaseShopOffer(offer.id)).toEqual({
      ok: false,
      reason: 'insufficient-gold',
    });
    expect(game.save).toEqual(before);
    await game.persist();
  });
});

describe('套装烙印端到端（docs/58）', () => {
  const SET = 'set_dungeon_azure';

  function imprintReadySave() {
    const save = createSave('烙印测试', 'swordsman', 4242, Date.now());
    save.player.level = 40;
    save.player.gold = 500_000;
    // 首通苍蓝任意入口 → 解锁该套可烙
    save.equipmentDungeon.records.equipment_ring_azure = {
      clears: 1,
      firstClearedAt: Date.now() - 1000,
      bestDurationMs: 20_000,
    };
    save.bag.items[IMPRINT_CRYSTAL_IDS.azure] = 20;
    return save;
  }

  function plainPiece(slot: 'ring' | 'belt', uid: string): EquipmentInstance {
    const definition = requireEquipment(`eq_r2_${slot}_rare`);
    const instance = createInstance(definition, new Rng(77), uid, 'swordsman');
    instance.affixes = [{ key: 'atk', value: 30, tier: 4 }];
    return instance;
  }

  it('未首通该档时不可烙，首通后进入可烙列表', () => {
    const game = useGameStore();
    const save = imprintReadySave();
    delete save.equipmentDungeon.records.equipment_ring_azure;
    save.bag.equipment = [plainPiece('ring', 'imp-1')];
    game.loadFrom(save);

    expect(game.unlockedImprintSetIds).not.toContain(SET);
    expect(game.evaluateImprint('imp-1', SET, false)).toMatchObject({
      ok: false,
      reason: 'set-locked',
    });

    game.save!.equipmentDungeon.records.equipment_ring_azure = {
      clears: 1,
      firstClearedAt: Date.now() - 1000,
      bestDurationMs: 20_000,
    };
    expect(game.unlockedImprintSetIds).toContain(SET);
  });

  it('烙印原子扣款并保留全部养成成果，穿戴中的装备也能烙', async () => {
    const game = useGameStore();
    const save = imprintReadySave();
    const worn = plainPiece('ring', 'imp-worn');
    worn.enhance = 6;
    worn.enhanceGainPermille = worn.enhanceGainPermille.map((_, i) => (i < 6 ? 80 : 0));
    save.equipped.ring = worn;
    game.loadFrom(save);

    const before = game.evaluateImprint('imp-worn', SET, false);
    expect(before.ok).toBe(true);
    expect(before.owned.crystals).toBe(20);

    const goldBefore = game.save!.player.gold;
    expect(game.imprintEquipment('imp-worn', SET, false)).toBe(true);

    const after = game.save!.equipped.ring!;
    expect(after.imprintSetId).toBe(SET);
    // 四不原则：品质由 defId 决定、词条与强化原样
    expect(after.defId).toBe(worn.defId);
    expect(after.enhance).toBe(6);
    expect(after.affixes).toEqual([{ key: 'atk', value: 30, tier: 4 }]);
    // 扣款精确
    expect(game.save!.bag.items[IMPRINT_CRYSTAL_IDS.azure]).toBe(20 - IMPRINT_CRYSTAL_COST);
    expect(goldBefore - game.save!.player.gold).toBe(
      requireEquipment(worn.defId).level * IMPRINT_GOLD_PER_LEVEL,
    );
    await game.persist();
  });

  it('烙满两件即激活 2 件套效果，战力随之上升', () => {
    const game = useGameStore();
    const save = imprintReadySave();
    save.equipped.ring = plainPiece('ring', 'imp-a');
    save.equipped.belt = plainPiece('belt', 'imp-b');
    game.loadFrom(save);

    const cpBefore = game.cp;
    expect(game.imprintEquipment('imp-a', SET, false)).toBe(true);
    expect(game.imprintEquipment('imp-b', SET, false)).toBe(true);

    // 烙印本身不改任何基础属性，战力上升只可能来自套装效果生效
    expect(game.cp).toBeGreaterThan(cpBefore);
    expect(game.save!.bag.items[IMPRINT_CRYSTAL_IDS.azure]).toBe(20 - IMPRINT_CRYSTAL_COST * 2);
  });

  it('材料不足时拒绝且分文不扣', () => {
    const game = useGameStore();
    const save = imprintReadySave();
    save.bag.items[IMPRINT_CRYSTAL_IDS.azure] = 1;
    save.bag.equipment = [plainPiece('ring', 'imp-poor')];
    game.loadFrom(save);

    const goldBefore = game.save!.player.gold;
    expect(game.evaluateImprint('imp-poor', SET, false)).toMatchObject({
      ok: false,
      reason: 'materials',
    });
    expect(game.imprintEquipment('imp-poor', SET, false)).toBe(false);
    expect(game.save!.bag.items[IMPRINT_CRYSTAL_IDS.azure]).toBe(1);
    expect(game.save!.player.gold).toBe(goldBefore);
    expect(game.save!.bag.equipment[0]?.imprintSetId).toBeUndefined();
  });
});

// ─────────────── 登顶速度榜的达成记录（docs/51 §4 榜 4） ───────────────

describe('里程碑记录挂在等级变化的唯一收口上', () => {
  const NOW = 1_800_000_000_000;
  const DAY_MS = 86_400_000;

  /**
   * loadFrom 内部会跑一次离线结算，所以「攒经验 + 回拨 lastActiveAt」即可触发升级。
   *
   * 必须先解锁足量关卡：等级软上限 = 可达关卡等级 + 3（docs/56 §2），
   * 新档只解锁第一关时软上限约 Lv8，攒再多经验也升不到 Lv20 ——
   * 这恰恰是软上限在正常工作，不是测试环境的怪癖。
   */
  function loadWithOfflineGains(
    name: string,
    classId: 'swordsman' | 'witch' | 'shaman',
    seed: number,
    offlineDays: number,
    exp: number,
    clearedStageCount: number,
  ) {
    vi.setSystemTime(NOW + offlineDays * DAY_MS);
    const game = useGameStore();
    const save = createSave(name, classId, seed, NOW);
    // 通关记录决定软上限；但挂机关卡留在第一关 ——
    // applyYield（升级收口的调用者）只在 kills > 0 时执行，
    // 让 Lv1 无装备的测试档站在第 90 关会打不死怪，一次升级都不会发生。
    save.progress.clearedStageIds = ORDERED_STAGE_IDS.slice(0, clearedStageCount);
    save.progress.currentStageId = FIRST_STAGE_ID;
    save.player.exp = exp;
    save.lastActiveAt = NOW + offlineDays * DAY_MS - 60_000;
    game.loadFrom(save);
    return game;
  }

  it('连升数级时跨过的档位全部记下，用时从建号算起而不是从本次结算算起', () => {
    // 解锁 90 关（约到区域 3 末），软上限足以放行 Lv20 与 Lv40
    const game = loadWithOfflineGains('里程碑', 'swordsman', 31, 9, 5_000_000_000, 90);

    const records = game.save!.milestones;
    expect(records.length).toBeGreaterThan(0);
    const levels = records.map((m) => m.level);
    expect(levels).toEqual([...levels].sort((a, b) => a - b));
    expect(new Set(levels).size).toBe(levels.length);
    for (const record of records) {
      expect(record.level).toBeLessThanOrEqual(game.save!.player.level);
      // 关键断言：用时是「建号 → 达成」的 9 天，不是本次离线的 60 秒
      expect(record.elapsedMs).toBeGreaterThanOrEqual(9 * DAY_MS - 60_000);
      expect(record.submitted).toBe(false);
    }
  });

  it('再次结算不会改写已记录的档位（里程碑是不可变的历史事实）', () => {
    const game = loadWithOfflineGains('里程碑幂等', 'witch', 32, 9, 5_000_000_000, 90);
    // 响应式代理不能 structuredClone，手动展开成普通对象
    const first = game.save!.milestones.map((m) => ({ ...m }));
    expect(first.length).toBeGreaterThan(0);

    // 时间推进很久后再跑一次结算：旧记录的 at / elapsedMs 一个字节都不许变
    vi.setSystemTime(NOW + 40 * DAY_MS);
    const again = game.save!;
    again.player.exp += 5_000_000_000;
    again.lastActiveAt = NOW + 40 * DAY_MS - 60_000;
    game.loadFrom(again);

    for (const old of first) {
      expect(game.save!.milestones.find((m) => m.level === old.level)).toEqual(old);
    }
  });

  it('升了级但没跨过任何档位时不产生记录', () => {
    const game = loadWithOfflineGains('未达档位', 'shaman', 33, 0, 0, 1);
    expect(game.save!.player.level).toBeLessThan(20);
    expect(game.save!.milestones).toEqual([]);
  });
});

// ────────── M3-10 战力变化飘字：全来源覆盖 ──────────

describe('M3-10 战力变化飘字', () => {
  const NOW = 1_800_000_000_000;
  const DAY_MS = 86_400_000;

  it('升级是战力变化来源：离线结算连升后必须留下正向飘字', () => {
    vi.setSystemTime(NOW + 9 * DAY_MS);
    const game = useGameStore();
    const save = createSave('飘字升级', 'swordsman', 51, NOW);
    // 软上限需要足量通关关卡放行连升（docs/56 §2）；挂机关卡留在第一关保证能击杀。
    save.progress.clearedStageIds = ORDERED_STAGE_IDS.slice(0, 90);
    save.progress.currentStageId = FIRST_STAGE_ID;
    save.player.exp = 5_000_000_000;
    save.lastActiveAt = NOW + 9 * DAY_MS - 60_000;

    game.loadFrom(save);

    expect(game.save!.player.level).toBeGreaterThan(1);
    expect(game.cpDelta).not.toBeNull();
    expect(game.cpDelta!.value).toBeGreaterThan(0);
  });

  it('加载未产生任何战力变化时不得虚报飘字', () => {
    vi.setSystemTime(NOW);
    const game = useGameStore();
    const save = createSave('无飘字', 'swordsman', 52, NOW);
    save.lastActiveAt = NOW;

    game.loadFrom(save);

    expect(game.save!.player.level).toBe(1);
    expect(game.cpDelta).toBeNull();
  });
});

// ────────── 首通时刻捕获（进度榜「同关按最早达成排」，docs/63 §一） ──────────

describe('关卡首通时刻', () => {
  const NOW = 1_800_000_000_000;
  const DAY_MS = 86_400_000;

  it('首通时写入时刻，之后再刷同一关不覆盖（最早达成才是榜单口径）', () => {
    // 走离线结算：loadFrom 内部会跑一次，足够长的离线时长能打穿首关。
    vi.setSystemTime(NOW + DAY_MS);
    const game = useGameStore();
    const save = createSave('首通时刻', 'swordsman', 41, NOW);
    save.lastActiveAt = NOW;
    game.loadFrom(save);

    const cleared = game.save!.progress.clearedStageIds;
    expect(cleared.length).toBeGreaterThan(0);
    const stamps = game.save!.progress.stageFirstClearedAt;
    // 每个新通关的关卡都必须有时刻
    for (const stageId of cleared) {
      expect(stamps[stageId]).toBeGreaterThan(0);
    }
    const firstStageId = cleared[0]!;
    const firstAt = stamps[firstStageId]!;

    // 一天后再结算一次：已记录的时刻一个字节都不许变
    vi.setSystemTime(NOW + 5 * DAY_MS);
    const again = game.save!;
    again.lastActiveAt = NOW + 4 * DAY_MS;
    game.loadFrom(again);

    expect(game.save!.progress.stageFirstClearedAt[firstStageId]).toBe(firstAt);
  });

  it('老档迁移后没有时刻，但新通关的关卡照常记下', () => {
    vi.setSystemTime(NOW + DAY_MS);
    const game = useGameStore();
    const save = createSave('老档续推', 'witch', 42, NOW);
    // 模拟迁移后的状态：已通关若干关但一个时刻都没有
    save.progress.clearedStageIds = ORDERED_STAGE_IDS.slice(0, 3);
    save.progress.currentStageId = ORDERED_STAGE_IDS[3]!;
    save.progress.stageFirstClearedAt = {};
    save.lastActiveAt = NOW;
    game.loadFrom(save);

    const stamps = game.save!.progress.stageFirstClearedAt;
    // 老的三关不许被补记
    for (const stageId of ORDERED_STAGE_IDS.slice(0, 3)) {
      expect(stamps[stageId]).toBeUndefined();
    }
    // 这次新通关的关卡必须有时刻
    const newlyCleared = game.save!.progress.clearedStageIds.filter(
      (id) => !ORDERED_STAGE_IDS.slice(0, 3).includes(id),
    );
    for (const stageId of newlyCleared) {
      expect(stamps[stageId]).toBeGreaterThan(0);
    }
  });
});

describe('M4-1 日常任务接线', () => {
  const NOW = 1_800_000_000_000;

  it('recordDailyTask 累计进度并随档持久化；跨日自动重置', async () => {
    vi.setSystemTime(NOW);
    const game = useGameStore();
    await game.startNewGame('小樱', 'swordsman');

    game.recordDailyTask('challenge');
    game.recordDailyTask('challenge');
    game.recordDailyTask('sweep');
    expect(game.save!.dailyTasks.progress.challenge).toBe(2);
    expect(game.save!.dailyTasks.progress.sweep).toBe(1);

    // 封顶：超目标不累计
    for (let i = 0; i < 5; i += 1) game.recordDailyTask('challenge');
    expect(game.save!.dailyTasks.progress.challenge).toBe(3);

    // 跨日：进度归零（store 直接改写存档日期模拟次日）
    const tomorrow = NOW + 24 * 3_600_000;
    game.save!.dailyTasks.day = '';
    game.recordDailyTask('sweep', 1, tomorrow);
    expect(game.save!.dailyTasks.progress.sweep).toBe(1);
    expect(game.save!.dailyTasks.progress.challenge).toBe(0);
  });

  it('活跃度宝箱：达成档位发奖（金币/体力/材料）并记录已领，重复领被拒', async () => {
    vi.setSystemTime(NOW);
    const game = useGameStore();
    await game.startNewGame('小樱', 'swordsman');
    const goldBefore = game.save!.player.gold;
    const staminaBefore = game.save!.player.stamina;
    const stoneBefore = game.save!.bag.items.stone_enhance ?? 0;

    // 活跃度不够：拒领
    expect(game.claimDailyTier(20)).toBeNull();

    // 完成 2 条任务 = 20 活跃度，领第一档（金币 5000 + 体力 20）
    game.recordDailyTask('challenge', 3);
    game.recordDailyTask('sweep', 5);
    const claim = game.claimDailyTier(20);
    expect(claim).not.toBeNull();
    expect(claim!.rewardId).toBe('daily_tier_1');
    expect(game.save!.player.gold).toBe(goldBefore + 5000);
    expect(game.save!.player.stamina).toBe(
      Math.min(staminaBefore + 20, game.staminaMax),
    );
    expect(game.save!.dailyTasks.claimedTiers).toEqual([20]);

    // 重复领同一档：拒领，且不再重复发奖
    expect(game.claimDailyTier(20)).toBeNull();
    expect(game.save!.player.gold).toBe(goldBefore + 5000);

    // 全完成 = 80 活跃度，可领 40/60/80 三档
    for (const task of ['enhance', 'reforge', 'affection', 'dungeon', 'arena', 'idle-minutes'] as const) {
      game.recordDailyTask(task, 99);
    }
    const last = game.claimDailyTier(80);
    expect(last).not.toBeNull();
    expect(last!.rewardId).toBe('daily_tier_4');
    expect(game.save!.dailyTasks.claimedTiers).toEqual([20, 80]);
    expect((game.save!.bag.items.stone_enhance ?? 0)).toBe(stoneBefore); // 80 档无强化石
    expect(game.save!.bag.items.lucky_nine).toBe(2);

    // M4-7 成就计数（v27）：六来源与日常任务同事件点累计；challenge / idle-minutes 不计
    expect(game.save!.stats.enhanceCount).toBe(99);
    expect(game.save!.stats.reforgeCount).toBe(99);
    expect(game.save!.stats.sweepCount).toBe(5);
    expect(game.save!.stats.affectionCount).toBe(99);
    expect(game.save!.stats.dungeonCount).toBe(99);
    expect(game.save!.stats.arenaCount).toBe(99);
  });
});

describe('M4-4 日常材料副本接线', () => {
  const NOW = 1_800_000_000_000;

  it('挑战成功：扣体力、发主题材料+金币、记今日次数与历史通过', async () => {
    vi.setSystemTime(NOW);
    const game = useGameStore();
    await game.startNewGame('小樱', 'swordsman');
    game.save!.player.level = 15;

    const goldBefore = game.save!.player.gold;
    const staminaBefore = game.save!.player.stamina;
    const themeId = dailyDungeonThemeIdOfDay(businessDayKey(NOW));
    const expected = dailyDungeonReward(themeId, 'tier-1');
    const [materialId, materialCount] = Object.entries(expected.items)[0]!;
    const materialBefore = game.save!.bag.items[materialId] ?? 0;

    const result = game.challengeDailyDungeon('tier-1');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.firstClear).toBe(true);
    expect(game.save!.player.gold).toBe(goldBefore + expected.gold);
    expect(game.save!.player.stamina).toBe(staminaBefore - 10);
    expect(game.save!.bag.items[materialId]).toBe(materialBefore + materialCount);
    expect(game.save!.dailyDungeons.todayRuns['tier-1']).toBe(1);
    expect(game.save!.dailyDungeons.clearedTierIds).toEqual(['tier-1']);
  });

  it('次数耗尽：同档第二次被拒（失败也消耗次数，防无限试）', async () => {
    vi.setSystemTime(NOW);
    const game = useGameStore();
    await game.startNewGame('小樱', 'swordsman');
    game.save!.player.level = 15;

    expect(game.challengeDailyDungeon('tier-1').ok).toBe(true);
    const second = game.challengeDailyDungeon('tier-1');
    expect(second).toEqual({ ok: false, reason: 'runs-exhausted' });
  });

  it('等级不足与前置未通过分别拒绝', async () => {
    vi.setSystemTime(NOW);
    const game = useGameStore();
    await game.startNewGame('小樱', 'swordsman');

    // Lv1 < Lv15：总开放等级未到
    expect(game.challengeDailyDungeon('tier-1')).toEqual({
      ok: false,
      reason: 'level-locked',
    });

    // Lv20 未通过 tier-1：tier-2 前置锁定
    game.save!.player.level = 20;
    expect(game.challengeDailyDungeon('tier-2')).toEqual({
      ok: false,
      reason: 'tier-locked',
    });
  });

  it('体力不足被拒且零消费', async () => {
    vi.setSystemTime(NOW);
    const game = useGameStore();
    await game.startNewGame('小樱', 'swordsman');
    game.save!.player.level = 15;
    game.save!.player.stamina = 5;
    const goldBefore = game.save!.player.gold;

    const result = game.challengeDailyDungeon('tier-1');
    expect(result).toEqual({ ok: false, reason: 'stamina-insufficient' });
    expect(game.save!.player.gold).toBe(goldBefore);
    expect(game.save!.player.stamina).toBe(5);
    expect(game.save!.dailyDungeons.todayRuns['tier-1']).toBeUndefined();
  });

  it('跨日对齐：次日次数清零，历史通过难度保留可挑战更高档', async () => {
    vi.setSystemTime(NOW);
    const game = useGameStore();
    await game.startNewGame('小樱', 'swordsman');
    game.save!.player.level = 30;

    game.challengeDailyDungeon('tier-1');
    game.challengeDailyDungeon('tier-2');
    game.challengeDailyDungeon('tier-3');
    expect(game.save!.dailyDungeons.clearedTierIds).toEqual(['tier-1', 'tier-2', 'tier-3']);

    vi.setSystemTime(NOW + 24 * 3_600_000);
    const nextDay = game.challengeDailyDungeon('tier-1');
    expect(nextDay.ok).toBe(true);
    expect(game.save!.dailyDungeons.day).toBe(businessDayKey(NOW + 24 * 3_600_000));
    expect(game.save!.dailyDungeons.clearedTierIds).toEqual(['tier-1', 'tier-2', 'tier-3']);
  });
});

describe('M6-7 背包扩容接线', () => {
  const NOW = 1_800_000_000_000;

  it('buyBagCapacity：扣金币升容量 +50，金币不足/满档返回 null', async () => {
    vi.setSystemTime(NOW);
    const game = useGameStore();
    await game.startNewGame('小樱', 'swordsman');
    const s = game.save!;
    s.player.gold = 200_000;

    // 第一档：300 → 350，价格 100_000
    const next = game.buyBagCapacity();
    expect(next).toBe(350);
    expect(s.bagCapacity).toBe(350);
    expect(s.player.gold).toBe(100_000);

    // 第二档：350 → 400，价格 120_000——金币不足
    expect(game.buyBagCapacity()).toBeNull();
    expect(s.bagCapacity).toBe(350);
    expect(s.player.gold).toBe(100_000);

    // 补足金币后成功
    s.player.gold = 120_000;
    expect(game.buyBagCapacity()).toBe(400);
    expect(s.bagCapacity).toBe(400);
  });

  it('满档 800 后不可再扩容', async () => {
    vi.setSystemTime(NOW);
    const game = useGameStore();
    await game.startNewGame('小樱', 'swordsman');
    const s = game.save!;
    s.bagCapacity = 800;
    s.player.gold = 999_999_999;
    expect(game.buyBagCapacity()).toBeNull();
  });

  it('扩容后 enforceBagCapacity 读存档容量：350 容量下 320 件不被自动分解', async () => {
    vi.setSystemTime(NOW);
    const game = useGameStore();
    await game.startNewGame('小樱', 'swordsman');
    const s = game.save!;
    s.bagCapacity = 350;
    // 320 件在 350 容量内：不裁剪（小督前瞻警告的守卫：扩容后第 301 件起不得被常量 300 误裁）
    s.bag.equipment = Array.from({ length: 320 }, (_, index) =>
      createInstance(
        requireEquipment('eq_r1_weapon_common'),
        new Rng(index + 1),
        `e${index + 1}`,
        'swordsman',
      ),
    );
    // 直接调用内部裁剪逻辑：用 loadFrom 触发载入裁剪路径
    game.loadFrom(s);
    expect(game.save!.bag.equipment.length).toBe(320);
    // 若误读常量 300 会被裁到 300——断言 320 保持即证明读的是存档容量
    expect(game.save!.bag.equipment.length).toBeGreaterThan(300);
  });
});
