/** 公会徽标展示工具：由公会名确定性地推导首字与柔和渐变色，零随机、零副作用。 */

const CREST_TINT_COUNT = 5;

export function crestInitial(name: string): string {
  return name.trim().slice(0, 1) || '樱';
}

export function crestTintClass(name: string): string {
  let hash = 0;
  for (const char of name.trim()) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `crest-tint-${hash % CREST_TINT_COUNT}`;
}
