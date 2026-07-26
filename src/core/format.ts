/**
 * 数值与时间的显示格式化。
 *
 * 放置游戏的数字会变得很大，直接显示 12000000000 玩家读不出来。
 * 中文玩家习惯「万 / 亿 / 兆」而不是 K / M / B，所以用中文单位。
 */

const UNITS = [
  { v: 1e16, s: '京' },
  { v: 1e12, s: '兆' },
  { v: 1e8, s: '亿' },
  { v: 1e4, s: '万' },
];

/**
 * 缩写数字。
 *   999      → "999"
 *   12345    → "1.23万"
 *   1e8      → "1亿"
 *   -5000    → "-5000"
 */
export function abbr(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return '—';
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);

  if (abs < 1e4) {
    return sign + (Number.isInteger(abs) ? String(abs) : abs.toFixed(1));
  }

  for (const u of UNITS) {
    if (abs >= u.v) {
      const val = abs / u.v;
      // 去掉多余的 .00 / .10 尾零
      const str = val.toFixed(val >= 100 ? 0 : digits).replace(/\.?0+$/, '');
      return sign + str + u.s;
    }
  }
  return sign + String(Math.round(abs));
}

/** 整数千分位，用于金币等需要看清确切数值的场景 */
export function comma(n: number): string {
  return Math.round(n).toLocaleString('zh-CN');
}

/** 百分比。0.1234 → "12.3%" */
export function pct(ratio: number, digits = 1): string {
  return (ratio * 100).toFixed(digits) + '%';
}

/**
 * 时长。用于离线收益、体力恢复倒计时。
 *   90      → "1分30秒"
 *   3700    → "1小时1分"
 *   90000   → "1天1小时"
 */
export function duration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  if (s < 60) return `${s}秒`;

  const m = Math.floor(s / 60);
  if (m < 60) {
    const rs = s % 60;
    return rs > 0 ? `${m}分${rs}秒` : `${m}分`;
  }

  const h = Math.floor(m / 60);
  if (h < 24) {
    const rm = m % 60;
    return rm > 0 ? `${h}小时${rm}分` : `${h}小时`;
  }

  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh > 0 ? `${d}天${rh}小时` : `${d}天`;
}

/** 倒计时 mm:ss，用于体力恢复这类短时间 */
export function countdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const rs = s % 60;
  return `${String(m).padStart(2, '0')}:${String(rs).padStart(2, '0')}`;
}

/** 带正负号，用于属性对比 */
export function signed(n: number): string {
  if (n === 0) return '0';
  return (n > 0 ? '+' : '') + abbr(n);
}
