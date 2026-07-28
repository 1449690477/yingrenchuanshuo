import type { Affix, AffixKey, AffixTier, ClassId, Element } from '@/core/types';
import { abbr } from '@/core/format';
import {
  AFFIX_LABELS,
  AFFIX_POOL,
  AFFIX_RUNTIME_RULES,
  AFFIX_TIERS,
  CLASS_INFO,
  PROFESSION_AFFIX_POOLS,
  type AffixPoolEntry,
} from '@/data/constants';

const ELEMENT_LABELS: Readonly<Record<Exclude<Element, 'none'>, string>> = {
  fire: '炎',
  ice: '冰',
  thunder: '雷',
};

const PERCENT_AFFIX_KEYS = new Set<AffixKey>([
  'critRate',
  'critDmg',
  'dmgReduce',
  'elemDmg',
  'lifesteal',
  'skillMul',
  'swd_heavy',
  'wit_elem',
  'sha_drain',
  'sha_ward',
]);

/** 数值以 0.039 = 3.9% 小数比例保存的攻速词条。 */
const RATIO_AFFIX_KEYS = new Set<AffixKey>(['spd', 'cat_swift']);

const AFFIX_SPECS = new Map<AffixKey, AffixPoolEntry>();
const PROFESSION_BY_AFFIX = new Map<AffixKey, ClassId>();

for (const spec of AFFIX_POOL) AFFIX_SPECS.set(spec.key, spec);
for (const [classId, pool] of Object.entries(PROFESSION_AFFIX_POOLS) as [
  ClassId,
  readonly AffixPoolEntry[],
][]) {
  for (const spec of pool) {
    if (PROFESSION_BY_AFFIX.has(spec.key)) {
      throw new Error(`[配置错误] 职业词条重复归属：${spec.key}`);
    }
    PROFESSION_BY_AFFIX.set(spec.key, classId);
    AFFIX_SPECS.set(spec.key, spec);
  }
}

export function affixTierName(tier: AffixTier): string {
  const config = AFFIX_TIERS.find((entry) => entry.tier === tier);
  if (!config) throw new Error(`[配置错误] 未登记的词条品阶：T${tier}`);
  return config.name;
}

export function affixTierLabel(tier: AffixTier): string {
  return `T${tier} ${affixTierName(tier)}`;
}

export function affixProfession(key: AffixKey): ClassId | null {
  return PROFESSION_BY_AFFIX.get(key) ?? null;
}

export function affixProfessionLabel(key: AffixKey): string | null {
  const classId = affixProfession(key);
  return classId ? `${CLASS_INFO[classId].name}专属` : null;
}

export function affixRuntimeNotice(key: AffixKey): string | null {
  const rule = AFFIX_RUNTIME_RULES[key];
  return rule.generation === 'deferred' ? rule.notice : null;
}

export function affixDisplayName(affix: Affix): string {
  if (!affix.element || affix.element === 'none') return AFFIX_LABELS[affix.key];
  return `${AFFIX_LABELS[affix.key]}·${ELEMENT_LABELS[affix.element]}`;
}

export function formatAffixValue(affix: Affix): string {
  const spec = AFFIX_SPECS.get(affix.key);
  if (!spec) throw new Error(`[配置错误] 词条缺少数值规格：${affix.key}`);
  if (PERCENT_AFFIX_KEYS.has(affix.key)) {
    return `+${affix.value.toFixed(spec.decimals)}%`;
  }
  if (RATIO_AFFIX_KEYS.has(affix.key)) {
    return `+${(affix.value * 100).toFixed(Math.max(0, spec.decimals - 2))}%`;
  }
  if (Math.abs(affix.value) < 10) return `+${affix.value.toFixed(spec.decimals)}`;
  return `+${abbr(Math.round(affix.value))}`;
}
