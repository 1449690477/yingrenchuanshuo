import type { CharacterAction } from './characterAppearance';

export type SkillVisualKind =
  | 'projectile'
  | 'ring'
  | 'lightning'
  | 'slash'
  | 'multi-slash'
  | 'arc'
  | 'flame'
  | 'heal'
  | 'poison'
  | 'summon'
  | 'dash-impact'
  | 'counter'
  | 'ambush'
  | 'vortex'
  | 'storm'
  | 'aura'
  | 'ultimate';

export interface SkillVisualDefinition {
  skillId: string;
  effectAsset: string;
  visualKind: SkillVisualKind;
  characterAction: CharacterAction;
  /** 多段飘字/闪光的相对毫秒时序；不参与伤害结算。 */
  hitOffsetsMs: readonly number[];
}

const visual = (
  skillId: string,
  effectAsset: string,
  visualKind: SkillVisualKind,
  characterAction: CharacterAction,
  hitOffsetsMs: readonly number[] = [0],
): SkillVisualDefinition => ({
  skillId,
  effectAsset,
  visualKind,
  characterAction,
  hitOffsetsMs,
});

export const SKILL_VISUALS: Readonly<Record<string, SkillVisualDefinition>> = Object.fromEntries(
  [
    visual(
      'skill_swordsman_attack',
      'assets/effects/swordsman-attack.png',
      'slash',
      'attack',
    ),
    visual(
      'skill_swordsman_halfmoon',
      'assets/effects/swordsman-halfmoon.png',
      'arc',
      'spin',
    ),
    visual(
      'skill_swordsman_flame',
      'assets/effects/swordsman-flame.png',
      'flame',
      'cast',
    ),
    visual(
      'skill_witch_fireball',
      'assets/effects/witch-fireball.png',
      'projectile',
      'cast',
    ),
    visual('skill_witch_fire_ring', 'assets/effects/witch-fire-ring.png', 'ring', 'spin'),
    visual(
      'skill_witch_hell_lightning',
      'assets/effects/witch-lightning.png',
      'lightning',
      'cast',
    ),
    visual('skill_shaman_heal', 'assets/effects/shaman-heal.png', 'heal', 'cast'),
    visual('skill_shaman_poison', 'assets/effects/shaman-poison.png', 'poison', 'cast'),
    visual('skill_shaman_skeleton', 'assets/effects/shaman-skeleton.png', 'summon', 'cast'),

    visual(
      'skill_catkin_paw_combo',
      'assets/effects/catkin-paw-combo.png',
      'multi-slash',
      'flurry',
      [0, 105, 210],
    ),
    visual(
      'skill_catkin_keen_whiskers',
      'assets/icons/skills/catkin-keen-whiskers.png',
      'aura',
      'victory',
    ),
    visual(
      'skill_catkin_light_pounce',
      'assets/effects/catkin-light-pounce.png',
      'dash-impact',
      'dash',
    ),
    visual(
      'skill_catkin_nimble_step',
      'assets/icons/skills/catkin-nimble-step.png',
      'aura',
      'victory',
    ),
    visual(
      'skill_catkin_scratch_frenzy',
      'assets/effects/catkin-scratch-frenzy.png',
      'multi-slash',
      'flurry',
      [0, 70, 140, 210, 280, 350],
    ),
    visual(
      'skill_catkin_bristle_counter',
      'assets/effects/catkin-bristle-counter.png',
      'counter',
      'counter',
    ),
    visual(
      'skill_catkin_claw_mark',
      'assets/icons/skills/catkin-claw-mark.png',
      'aura',
      'victory',
    ),
    visual(
      'skill_catkin_tail_sweep',
      'assets/effects/catkin-tail-sweep.png',
      'arc',
      'spin',
      [0, 180],
    ),
    visual(
      'skill_catkin_box_ambush',
      'assets/effects/catkin-box-ambush.png',
      'ambush',
      'dash',
    ),
    visual(
      'skill_catkin_nine_life_spin',
      'assets/effects/catkin-nine-life-spin.png',
      'vortex',
      'spin',
      [0, 135, 270],
    ),
    visual(
      'skill_catkin_hunting_instinct',
      'assets/icons/skills/catkin-hunting-instinct.png',
      'aura',
      'victory',
    ),
    visual(
      'skill_catkin_moonshadow_step',
      'assets/effects/catkin-moonshadow-step.png',
      'dash-impact',
      'dash',
      [0, 90, 180, 270],
    ),
    visual(
      'skill_catkin_furball_storm',
      'assets/effects/catkin-furball-storm.png',
      'storm',
      'cast',
      [0, 55, 110, 165, 220, 275, 330, 385],
    ),
    visual(
      'skill_catkin_hundred_claw',
      'assets/effects/catkin-hundred-claw.png',
      'ultimate',
      'flurry',
      [0, 45, 90, 135, 180, 225, 270, 315, 360, 405, 450, 495],
    ),
  ].map((entry) => [entry.skillId, entry]),
);
