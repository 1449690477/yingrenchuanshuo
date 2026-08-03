/**
 * M4-11 音效播放框架：真实音频存在时才出声，框架整体可删除。
 *
 * 设计约束（与 affectionVoice 同一先例）：
 * - sfxId → 真实音频路径的显式清单，不许约定式拼路径、不许 404 兜底；
 * - 清单为空（尚未投放任何音效资产）时 play 一律返回 no-cue，
 *   组件端可据 resolveSfx 是否为 null 决定不渲染任何声音反馈；
 * - sfx 开关由调用方传入（save.settings.sfx），本模块不读存档不读 store；
 * - 浏览器未收到用户手势前禁止自动出声：框架只提供手动 play；
 * - 加载失败记入 failedSfxIds 可查询，不抛异常打断交互；
 * - 可删除性：本模块与 bgm.ts 均为纯新增，删掉两个文件 + spec +
 *   调用点即完整移除，不残留存档字段（sfx/bgm 开关是既有设置字段）。
 *
 * 首批音效投放时：把文件放进 public/assets/system/sfx/ 并在
 * SFX_MANIFEST 登记 sfxId → 路径即可，无需改本文件逻辑。
 */

/** 显式清单：只有登记在册、且文件真实存在的 sfxId 才会被播放。 */
export const SFX_MANIFEST: Readonly<Record<string, string>> = {
  // M4-11 框架首版：尚无音效资产投放。清单为空是诚实状态——
  // 项目当前没有任何音频文件，先立框架后投资产，避免假路径 404。
} as const;

export function resolveSfx(sfxId: string): string | null {
  return SFX_MANIFEST[sfxId] ?? null;
}

export function hasSfx(sfxId: string): boolean {
  return resolveSfx(sfxId) !== null;
}

/** 可测试的 Audio 抽象：默认用浏览器 Audio，测试注入假实现。 */
export interface SfxAudioLike {
  src: string;
  volume: number;
  play(): Promise<void>;
}

export type SfxAudioFactory = (src: string) => SfxAudioLike;

const defaultFactory: SfxAudioFactory = (src) => {
  const AudioCtor = (globalThis as { Audio?: new (src: string) => SfxAudioLike }).Audio;
  if (!AudioCtor) {
    throw new Error('当前环境没有 Audio，无法播放音效');
  }
  return new AudioCtor(src);
};

export type SfxPlayResult =
  | { ok: true }
  | { ok: false; reason: 'disabled' | 'no-cue' | 'load-failed' };

export class SfxPlayer {
  private enabled = true;
  private readonly failedSfxIds = new Set<string>();

  constructor(private readonly createAudio: SfxAudioFactory = defaultFactory) {}

  get isEnabled(): boolean {
    return this.enabled;
  }

  hasFailed(sfxId: string): boolean {
    return this.failedSfxIds.has(sfxId);
  }

  /** 由设置开关联动（save.settings.sfx）；关闭后 play 一律不发声。 */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * 播放指定音效；开关关闭或未登记一律静默。
   * 音效短促独立，允许多声交叠，不做单实例抢占。
   */
  async play(sfxId: string): Promise<SfxPlayResult> {
    if (!this.enabled) return { ok: false, reason: 'disabled' };
    const src = resolveSfx(sfxId);
    if (!src) return { ok: false, reason: 'no-cue' };
    try {
      const audio = this.createAudio(src);
      await audio.play();
      return { ok: true };
    } catch {
      this.failedSfxIds.add(sfxId);
      return { ok: false, reason: 'load-failed' };
    }
  }
}
