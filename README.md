# 樱刃传说 · Sakura Legend

> 二次元竖版放置类传奇手游。浏览器优先、手机竖屏优先，可作为 PWA 安装到桌面。

挂机刷图，掉落装备与材料，强化养成，再挑战更高关卡。核心原则是：**装备靠打，不靠抽。**

[在线试玩](https://1449690477.github.io/yingrenchuanshuo/) · [开发路线图](docs/30-ROADMAP.md) · [当前进度](docs/31-PROGRESS.md)

## 当前状态

项目已进入 **M3「养成深度第一层」**，不是概念或空壳 Demo。目前已经可以完整体验：

- 三职业创角与竖屏挂机战斗
- 区域、章节、波次、BOSS 与首次通关自动续推
- 装备掉落、背包、穿戴、分解与战力比较
- +1～+15 强化、幸运值保底、掉级、碎裂与保护符
- 离线收益、体力恢复与 IndexedDB 自动存档
- 樱花珍品店试穿、金币购买和 BOSS 同款掉落
- 不打断挂机的旅途奇遇、隐藏随机奖励与积压事件切换
- 三职业分层换装、战场演出、PWA 与 GitHub Pages 自动部署

仍在开发中的主要内容包括真实技能优先级与冷却、扫荡、日常、副本、套装和后续区域。具体完成度以 [PROGRESS](docs/31-PROGRESS.md) 为准。

## 本地运行

需要 Node.js 20 或更高版本。

```bash
git clone https://github.com/1449690477/yingrenchuanshuo.git
cd yingrenchuanshuo
npm ci
npm run dev
```

Vite 会在终端显示本地访问地址。推荐用浏览器移动设备模式按 **390 × 844** 验收界面。

## 常用命令

| 命令 | 用途 |
|---|---|
| `npm run dev` | 启动本地开发服务器 |
| `npm run verify` | 依次运行 ESLint、TypeScript 检查和全部测试 |
| `npm run sim` | 校验成长曲线、职业效率与装备随机分布 |
| `npm run build` | 类型检查并生成生产包到 `dist/` |
| `npm run preview` | 本地预览生产包 |

提交功能前必须保证 `npm run verify` 全绿。推送到 `main` 后，GitHub Actions 会再次校验并自动部署 GitHub Pages。

## 项目结构

```text
src/
├─ core/        # 战斗、掉落、装备、强化等纯 TypeScript 逻辑
├─ data/        # 怪物、关卡、装备、技能与数值配置
├─ save/        # IndexedDB 存档、校验与版本迁移
├─ stores/      # Pinia 领域状态与事务入口
├─ components/  # 通用 Vue 组件
└─ views/       # 五个主页面与商店页面

docs/           # 设计、数值、路线图、进度与决策记录
openspec/       # 重要变更的提案、规格、设计与任务清单
scripts/        # 数值模拟和资源生成脚本
```

核心公式必须放在 `src/core/` 并保持纯函数；怪物、装备、技能和关卡数值必须放在 `src/data/`；随机行为统一使用 seeded RNG，禁止直接调用 `Math.random()`。

## 存档与平台

- 游戏是纯静态前端，没有自建服务器。
- 主存档保存在浏览器 IndexedDB，并支持版本迁移。
- 更换浏览器、清除站点数据或无痕模式可能导致本地进度不可用。
- 项目以 390 × 844 手机竖屏为设计基准，桌面端采用居中信箱布局。

## 协作入口

AI 或人类开发者开始修改代码前，请先完整阅读 [AGENTS.md](AGENTS.md)。标准流程是：

```text
AGENTS.md → PROGRESS → ROADMAP → 模块设计文档
→ 实现与测试 → npm run verify → 更新进度文档 → 提交
```

重要文档：

| 文档 | 内容 |
|---|---|
| [项目宪章](docs/00-项目宪章.md) | 游戏定位、核心循环与设计铁律 |
| [技术架构](docs/01-技术架构.md) | 技术栈、分层、存档与部署 |
| [数值与战斗](docs/10-数值与战斗.md) | 公式、成长曲线与平衡参数 |
| [地图与关卡](docs/11-地图与关卡.md) | 区域、章节和怪物分布 |
| [装备体系](docs/12-装备体系.md) | 部位、品质、词条、强化和套装 |
| [技能体系](docs/13-技能体系.md) | 三职业技能树与倍率 |
| [系统清单](docs/14-系统清单.md) | 全部玩法系统及优先级 |
| [开发路线图](docs/30-ROADMAP.md) | 里程碑与任务清单 |
| [进度快照](docs/31-PROGRESS.md) | 当前状态、下一步和已知问题 |
| [决策记录](docs/32-决策记录.md) | 重大技术与玩法决策 |
| [美术资产规范](docs/33-美术资产生产与清单.md) | 素材尺寸、命名、抠图和资产清单 |

## License

MIT
