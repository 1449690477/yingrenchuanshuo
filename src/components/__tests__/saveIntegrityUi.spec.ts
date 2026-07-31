import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const recoverySource = read('../SaveRecoveryPanel.vue');
const cardSource = read('../SaveIntegrityCard.vue');
const appSource = read('../../App.vue');
const moreSource = read('../../views/MoreView.vue');

describe('存档完整性竖屏交互', () => {
  it('启动失败页提供显式恢复、诊断导出和二次确认清除，不使用叠层弹窗', () => {
    expect(appSource).toContain('<SaveRecoveryPanel');
    expect(recoverySource).toContain('恢复上一版备份');
    expect(recoverySource).toContain('导出原始诊断');
    expect(recoverySource).toContain('确认永久清除');
    expect(recoverySource).toContain('confirmClear');
    expect(recoverySource).not.toContain('<Teleport');
    expect(recoverySource).not.toContain('role="dialog"');
  });

  it('长错误可换行滚动，按钮达到 44px，并覆盖 320/390 宽度的单列布局', () => {
    expect(recoverySource).toMatch(/overflow-wrap:\s*anywhere/);
    expect(recoverySource).toMatch(/max-height:\s*9rem/);
    expect(recoverySource).toMatch(/min-height:\s*2\.75rem/);
    expect(recoverySource).toMatch(/grid-template-columns:\s*1fr/);
    expect(recoverySource).toContain('@media (min-width: 360px)');
    expect(recoverySource).toContain('prefers-reduced-motion: reduce');
  });

  it('更多页展示完整性状态与真实安全边界，导入档不会被描述成可信档', () => {
    expect(moreSource).toContain('<SaveIntegrityCard');
    expect(cardSource).toContain('本地导入档');
    expect(cardSource).toContain('未来联网资产需重新与服务端对账');
    expect(cardSource).toContain('不是绝对防作弊');
    expect(cardSource).toMatch(/min-height:\s*2\.75rem/);
  });
});

function read(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}
