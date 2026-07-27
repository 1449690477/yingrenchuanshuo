/**
 * 存档版本迁移链。
 *
 * 规则（AGENTS.md 铁律 5）：
 *   - key 为「从哪个版本迁移」，函数把该版本的存档改成 key+1 版本
 *   - 迁移必须是幂等且不丢数据的
 *   - 每加一条迁移，必须在 __tests__/migrations.spec.ts 加一个测试
 *
 * v0 是开发期原型存档：与 v1 相同，但 settings 里没有 reduceMotion。
 * 保留这条真实可执行的示例，确保以后升级时有可照着做的模板。
 */

import { SAVE_VERSION, parseSave, type SaveData } from './schema';

/** 迁移函数接收上一版本的存档（结构未知，故用宽类型），返回下一版本 */
export type Migration = (save: Record<string, unknown>) => Record<string, unknown>;

export const migrations: Record<number, Migration> = {
  0: (save) => {
    const settings = save.settings;
    if (typeof settings !== 'object' || settings === null || Array.isArray(settings)) {
      throw new MigrationError(0, 'settings 缺失或格式错误');
    }
    return {
      ...save,
      version: 1,
      settings: {
        ...(settings as Record<string, unknown>),
        reduceMotion: (settings as Record<string, unknown>).reduceMotion ?? false,
      },
    };
  },
  1: (save) => {
    const progress = save.progress;
    if (typeof progress !== 'object' || progress === null || Array.isArray(progress)) {
      throw new MigrationError(1, 'progress 缺失或格式错误');
    }
    return {
      ...save,
      version: 2,
      progress: {
        ...(progress as Record<string, unknown>),
        stageKills: {},
      },
    };
  },
  2: (save) => ({
    ...save,
    version: 3,
    shop: {
      purchasedOfferIds: [],
    },
  }),
};

export class SaveTooNewError extends Error {
  constructor(saveVersion: number) {
    super(`存档版本 ${saveVersion} 高于当前程序支持的 ${SAVE_VERSION}，可能是用了更新版本的游戏。`);
    this.name = 'SaveTooNewError';
  }
}

export class MigrationError extends Error {
  constructor(fromVersion: number, reason: string) {
    super(`无法把 v${fromVersion} 存档迁移到 v${fromVersion + 1}：${reason}`);
    this.name = 'MigrationError';
  }
}

/**
 * 把任意旧版本存档升级到当前版本。
 *
 * @throws SaveTooNewError 存档版本比程序还新时抛出 ——
 *         这种情况绝不能静默降级，会丢玩家数据。
 */
export function migrate(raw: Record<string, unknown>): SaveData {
  let cur = { ...raw };
  const rawVersion = cur.version ?? 0;
  if (!Number.isInteger(rawVersion) || (rawVersion as number) < 0) {
    throw new MigrationError(0, 'version 必须是非负整数');
  }
  let version = rawVersion as number;

  if (version > SAVE_VERSION) throw new SaveTooNewError(version);

  while (version < SAVE_VERSION) {
    const fn = migrations[version];
    if (!fn) {
      throw new MigrationError(version, '缺少对应迁移函数');
    }
    cur = fn(cur);
    const expectedVersion = version + 1;
    if (cur.version !== expectedVersion) {
      throw new MigrationError(version, `迁移结果 version 应为 ${expectedVersion}`);
    }
    version = expectedVersion;
  }

  return parseSave(cur);
}
