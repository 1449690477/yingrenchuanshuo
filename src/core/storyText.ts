/**
 * R1 文字演出：对白源文本的轻量标记与打字机节奏。
 *
 * 设计约束：
 * - 源文本仍是可读的纯中文——标记即使原样显示也不破坏阅读；
 * - 语料普查后选定 `《…》` 为强调标记（三个数据文件的对白中零使用，
 *   且书名号在中文里天然带"请注意我"的语义）；
 * - 标点节奏不写任何标记：逗号稍顿、句读长停、省略号拖慢，
   让打字机自己"会读句子"；
 * - reduced-motion 由组件层处理（直接全显），这里只提供节奏与分段。
 */

export interface StoryTextSegment {
  text: string;
  emphasis: boolean;
}

/**
 * 把含 `《…》` 标记的对白解析为分段。标记嵌套/未闭合时按纯文本处理，
 * 绝不让一个手滑的括号吃掉整句台词。
 */
export function parseStoryEmphasis(text: string): readonly StoryTextSegment[] {
  const segments: StoryTextSegment[] = [];
  let plain = '';
  let index = 0;
  while (index < text.length) {
    const open = text.indexOf('《', index);
    if (open === -1) {
      plain += text.slice(index);
      break;
    }
    const close = text.indexOf('》', open + 1);
    if (close === -1) {
      // 未闭合：剩余全部按纯文本，书名号原样保留
      plain += text.slice(index);
      break;
    }
    plain += text.slice(index, open);
    if (plain) {
      segments.push({ text: plain, emphasis: false });
      plain = '';
    }
    const inner = text.slice(open + 1, close);
    if (inner) segments.push({ text: inner, emphasis: true });
    index = close + 1;
  }
  if (plain) segments.push({ text: plain, emphasis: false });
  return segments;
}

/** 去掉全部演出标记的纯文本（回看面板、日志、读屏用）。 */
export function stripStoryEmphasis(text: string): string {
  return parseStoryEmphasis(text)
    .map((segment) => segment.text)
    .join('');
}

/** 基础打字速度（毫秒/字），与组件既有 TYPE_SPEED_MS 一致。 */
export const STORY_TYPE_BASE_MS = 32;

/**
 * 标点节奏：返回"打完 char 这个字之后"应等待的毫秒数。
 * - `，、；：` 小顿；` 。！？` 长停；省略号与破折号逐字拖慢；
 * - 其余字用基础速度。
 */
export function storyTypeDelayAfter(char: string): number {
  if ('，、；：,.;:'.includes(char)) return 120;
  if ('。！？!?'.includes(char)) return 300;
  if (char === '…' || char === '—' || char === '·') return 90;
  return STORY_TYPE_BASE_MS;
}
