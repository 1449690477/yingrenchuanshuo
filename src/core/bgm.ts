/**
 * M4-11 背景音乐框架：默认关闭 BGM，真实曲目存在且玩家开启才播放。
 *
 * 设计约束（与 affectionVoice / sfx 同一先例）：
 * - bgmId → 真实音频路径的显式清单，不许约定式拼路径、不许 404 兜底；
 * - 默认关闭（save.settings.bgm 初值 false）：setEnabled(false) 或
 *   未开启时 play 一律不发声，且 setEnabled(false) 立即停掉在播曲目；
 * - 单实例循环播放：切曲先停旧曲，避免两首叠播；
 * - bgm 开关由调用方传入，本模块不读存档不读 store；
 * - 加载失败记入 failedBgmIds 可查询，不抛异常；
 * - 可删除性：纯新增模块，删掉本文件 + spec + 调用点即完整移除。
 *
 * 首批曲目投放时：把文件放进 public/assets/system/bgm/ 并在
 * BGM_MANIFEST 登记 bgmId → 路径即可，无需改本文件逻辑。
 */

/** 显式清单：只有登记在册、且文件真实存在的 bgmId 才会被播放。 */
export const BGM_MANIFEST: Readonly<Record<string, string>> = {
  // M4-11 框架首版：尚无曲目投放（且 BGM 默认关闭）。
  // 清单为空是诚实状态——先立框架后投资产，避免假路径 404。
} as const;

export function resolveBgm(bgmId: string): string | null {
  return BGM_MANIFEST[bgmId] ?? null;
}

export function hasBgm(bgmId: string): boolean {
  return resolveBgm(bgmId) !== null;
}

/** 可测试的 Audio 抽象：默认用浏览器 Audio，测试注入假实现。 */
export interface BgmAudioLike {
  src: string;
  loop: boolean;
  currentTime: number;
  play(): Promise<void>;
  pause(): void;
}

export type BgmAudioFactory = (src: string) => BgmAudioLike;

const defaultFactory: BgmAudioFactory = (src) => {
  const AudioCtor = (globalThis as { Audio?: new (src: string) => BgmAudioLike }).Audio;
  if (!AudioCtor) {
    throw new Error('当前环境没有 Audio，无法播放背景音乐');
  }
  return new AudioCtor(src);
};

export type BgmPlayResult =
  | { ok: true }
  | { ok: false; reason: 'disabled' | 'no-cue' | 'load-failed' };

export class BgmPlayer {
  private audio: BgmAudioLike | null = null;
  private currentBgmId: string | null = null;
  private enabled = false; // 默认关闭 BGM（M4-11 硬性要求）
  private readonly failedBgmIds = new Set<string>();

  constructor(private readonly createAudio: BgmAudioFactory = defaultFactory) {}

  get playingBgmId(): string | null {
    return this.currentBgmId;
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  hasFailed(bgmId: string): boolean {
    return this.failedBgmIds.has(bgmId);
  }

  /** 由设置开关联动（save.settings.bgm）；关闭时立即停掉在播曲目。 */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.stop();
  }

  /** 播放指定曲目（循环）；开关关闭或未登记一律静默。切曲先停旧曲。 */
  async play(bgmId: string): Promise<BgmPlayResult> {
    if (!this.enabled) return { ok: false, reason: 'disabled' };
    const src = resolveBgm(bgmId);
    if (!src) return { ok: false, reason: 'no-cue' };

    this.stop();
    const audio = this.createAudio(src);
    audio.loop = true;
    this.audio = audio;
    this.currentBgmId = bgmId;
    try {
      await audio.play();
      return { ok: true };
    } catch {
      this.failedBgmIds.add(bgmId);
      if (this.audio === audio) {
        this.audio = null;
        this.currentBgmId = null;
      }
      return { ok: false, reason: 'load-failed' };
    }
  }

  /** 停止并释放当前曲目；没有在播时静默忽略。 */
  stop(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
    }
    this.audio = null;
    this.currentBgmId = null;
  }
}
