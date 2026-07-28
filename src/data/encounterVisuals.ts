import type { EncounterPortraitCue } from '@/core/encounters';

export interface EncounterCharacterVisual {
  characterId: string;
  displayName: string;
  speakerAliases: readonly string[];
  journalPortraitId: string;
  portraits: Readonly<Record<string, string>>;
}

const AKANE_PORTRAITS = {
  'nervous-request': 'assets/encounters/portraits/akane/nervous-request.png',
  'lasting-grip': 'assets/encounters/portraits/akane/lasting-grip.png',
  'prove-it': 'assets/encounters/portraits/akane/prove-it.png',
  'rejected-clutch': 'assets/encounters/portraits/akane/rejected-clutch.png',
  'ask-herself': 'assets/encounters/portraits/akane/ask-herself.png',
  'not-wrong': 'assets/encounters/portraits/akane/not-wrong.png',
  'first-blade-present': 'assets/encounters/portraits/akane/first-blade-present.png',
  'give-name': 'assets/encounters/portraits/akane/give-name.png',
  'test-blade': 'assets/encounters/portraits/akane/test-blade.png',
  'blind-grip-trust': 'assets/encounters/portraits/akane/blind-grip-trust.png',
  'rain-wrap-trust': 'assets/encounters/portraits/akane/rain-wrap-trust.png',
  'small-hands-trust': 'assets/encounters/portraits/akane/small-hands-trust.png',
  'soft-response': 'assets/encounters/portraits/akane/soft-response.png',
  'steady-response': 'assets/encounters/portraits/akane/steady-response.png',
} as const;

const SUI_PORTRAITS = {
  'hay-sleep': 'assets/encounters/portraits/sui/hay-sleep.png',
  'take-breath': 'assets/encounters/portraits/sui/take-breath.png',
  'go-together': 'assets/encounters/portraits/sui/go-together.png',
  'old-letter-anxious': 'assets/encounters/portraits/sui/old-letter-anxious.png',
  apologize: 'assets/encounters/portraits/sui/apologize.png',
  'still-matters': 'assets/encounters/portraits/sui/still-matters.png',
  'storm-run-ready': 'assets/encounters/portraits/sui/storm-run-ready.png',
  'trust-her': 'assets/encounters/portraits/sui/trust-her.png',
  'run-beside': 'assets/encounters/portraits/sui/run-beside.png',
  'morning-route-trust': 'assets/encounters/portraits/sui/morning-route-trust.png',
  'windy-knot-trust': 'assets/encounters/portraits/sui/windy-knot-trust.png',
  'quiet-letter-trust': 'assets/encounters/portraits/sui/quiet-letter-trust.png',
  'praise-response': 'assets/encounters/portraits/sui/praise-response.png',
  'rest-response': 'assets/encounters/portraits/sui/rest-response.png',
} as const;

export const ENCOUNTER_CHARACTER_VISUALS: Readonly<Record<string, EncounterCharacterVisual>> = {
  char_akane: {
    characterId: 'char_akane',
    displayName: '刀匠·茜',
    speakerAliases: ['见习刀匠·茜', '刀匠·茜'],
    journalPortraitId: 'steady-response',
    portraits: AKANE_PORTRAITS,
  },
  char_sui: {
    characterId: 'char_sui',
    displayName: '草原信使·穗',
    speakerAliases: ['草原信使·穗'],
    journalPortraitId: 'morning-route-trust',
    portraits: SUI_PORTRAITS,
  },
};

export function requireEncounterCharacterVisual(characterId: string): EncounterCharacterVisual {
  const visual = ENCOUNTER_CHARACTER_VISUALS[characterId];
  if (!visual) throw new Error(`[配置错误] 奇遇角色视觉不存在：${characterId}`);
  return visual;
}

export function requireEncounterPortraitAsset(cue: EncounterPortraitCue): string {
  const character = requireEncounterCharacterVisual(cue.characterId);
  const asset = character.portraits[cue.portraitId];
  if (!asset) {
    throw new Error(`[配置错误] 奇遇角色 ${cue.characterId} 的立绘不存在：${cue.portraitId}`);
  }
  return asset;
}

export function journalPortraitCue(characterId: string): EncounterPortraitCue {
  const visual = requireEncounterCharacterVisual(characterId);
  return { characterId, portraitId: visual.journalPortraitId };
}

export function encounterPortraitAssets(): string[] {
  return Object.values(ENCOUNTER_CHARACTER_VISUALS).flatMap((visual) =>
    Object.values(visual.portraits),
  );
}
