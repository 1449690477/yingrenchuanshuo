# 31 · 进度快照

> **每个 AI 结束工作时必须更新本文件。**
> 下一个接手的 AI 只看这一页就应该知道现在什么状况。

---

## 当前状态

| 项 | 值 |
|---|---|
| **更新时间** | 2026-07-26 |
| **当前里程碑** | **M0 已完成** → 下一步 M1 核心数值层 |
| **完成度** | 7 / 178 |
| **代码状态** | 工程骨架可跑，`npm run verify` 全绿，`npm run build` 通过 |
| **可玩状态** | 不可玩（仅有 UI 骨架与 5 个占位页） |
| **GitHub 仓库** | https://github.com/1449690477/yingrenchuanshuo |
| **部署地址** | https://1449690477.github.io/yingrenchuanshuo/ （首次 push 后由 Actions 自动部署） |

## M0 实测结果

| 验证项 | 结果 |
|---|---|
| `npm run verify`（lint + typecheck + test） | ✅ 通过 |
| `npm run build` | ✅ 通过，产物 71.5 kB（gzip 28.8 kB） |
| 5 个 Tab 切换 | ✅ 挂机 / 背包 / 养成 / 副本 / 更多 全部正常 |
| 手机布局 375×812 | ✅ 56 + 698 + 58 = 812，无横向溢出 |
| 桌面布局 | ✅ 480px 信箱式居中 |
| PWA manifest + Service Worker | ✅ 已生成（图标为脚本生成的占位资源） |

## 下一个任务

**M1-1** `core/types.ts`：定义 Stats / Combatant / Equipment / Skill / Monster 等全局类型

M1 阶段是纯 TypeScript 逻辑层，**不碰 UI**。顺序做 M1-1 → M1-10，
做完 M1-10（模拟器校验曲线）才算 M1 结束。

**注意**：`vitest.config.ts` 里有 `passWithNoTests: true`，
这是 M0 的临时妥协。写完 M1-2 的第一个测试后请删掉它。

## 环境状态

| 项 | 状态 |
|---|---|
| Node.js | ✅ v24.18.0 |
| npm | ✅ 11.16.0 |
| Git | ✅ 2.54.0，仓库已 init，remote 已配置 |
| GitHub 仓库 | ✅ 已创建 |
| Supabase | ⬜ 未注册（M7 才需要） |

## 已知问题 / 技术债

| # | 问题 | 处理时机 |
|---|---|---|
| 1 | PWA 图标是脚本生成的渐变占位图（`scripts/gen-icons.mjs`） | M12-3 替换为正式美术 |
| 2 | `vitest.config.ts` 的 `passWithNoTests: true` 需在 M1-2 后移除 | M1-2 |
| 3 | `TopBar.vue` 数据为硬编码占位 | M2-11 接入 player store |
| 4 | 未使用 vue-router，Tab 切换是 Pinia 状态。若后期需要浏览器返回键支持，需改为 hash 路由 | 待评估 |
| 5 | npm 提示 esbuild 的 install script 未授权（不影响构建，二进制已就位） | 忽略 |

## 待项目所有者决定

| 问题 | 选项 | 影响 |
|---|---|---|
| **美术风格基调** | 明亮日系 / 暗黑哥特 / Q 版 SD | 影响全部 AI 立绘生成的 prompt。当前 UI 配色按「暗色 + 樱粉」做的，偏日系轻暗 |
| 是否做内购 | 纯免费 / 预留接口 | 影响数值松紧，M11 前要定 |
| 游戏名 | 当前《樱刃传说》，仓库名 `yingrenchuanshuo` | 已可沿用 |

## 变更日志

| 日期 | AI | 做了什么 |
|---|---|---|
| 2026-07-26 | Claude | 建立完整文档体系（宪章、架构、数值、地图、装备、技能、系统、路线图、决策记录） |
| 2026-07-26 | Claude | 完成 M0 全部 7 个任务：工程骨架、校验链、分层 lint 规则、CI/CD、PWA、竖屏布局、移动端适配 |
