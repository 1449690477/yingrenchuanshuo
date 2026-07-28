# 38 · 奇遇 Galgame 美术与演出管线

> 本文定义旅途奇遇从「带两项选择的弹窗」升级为 Galgame 短篇演出的首批生产边界。
> 它只改变表现配置，不改变奇遇生成、奖励随机、材料扣除或存档结构。

---

## 1. 为什么必须重做

此前虽然 12 项奇遇都填写了 `sceneAsset`，但实际引用的是 `768×1024` 竖版章节地图。
奇遇舞台约为 `336×190` 横幅，`object-fit: cover` 后只能留下原图约 42% 的高度。
同时茜与穗没有任何真实立绘，舞台和旅途手札只能显示 emoji。

问题的根因不是 CSS 不够华丽，而是内容模型只有「整件奇遇一张背景、一张可选头像」：

- 日常的三个变体不能各自选择场景。
- 对白不能逐句切换动作或表情。
- 图片路径没有严格注册表，拼错时只能退回 emoji 或区域地图。
- 测试只检查文件存在，没有验证比例、透明度和生产清单。

本轮直接修正主流程，不保留会掩盖缺图的舞台兜底。

---

## 2. 首批交付规模

| 类别 | 茜 | 穗 | 普通奇遇 | 合计 |
|---|---:|---:|---:|---:|
| 人物动作 / 表情差分 | 14 | 14 | 0 | 28 |
| 主线与日常无人场景 | 6 | 6 | 4 | 16 |
| 第三幕纯物件高潮 CG | 1 | 1 | 0 | 2 |
| **运行时素材** | **21** | **21** | **4** | **46** |

另保留茜、穗各一张身份锚点源图。所有差分必须引用自己的身份锚点编辑，不能逐张重新
设计脸、发型和服装。

### 2.1 茜的 14 张人物差分

`nervous-request / lasting-grip / prove-it / rejected-clutch / ask-herself /
not-wrong / first-blade-present / give-name / test-blade / blind-grip-trust /
rain-wrap-trust / small-hands-trust / soft-response / steady-response`

身份锚点：成年年轻刀匠；暖赤棕短发、樱花发饰、琥珀眼；象牙与藏蓝工坊上衣、
樱粉细节、棕皮围裙与护腕。固定叙事道具包括粉白缠带、木槌、草图和银白短刀
「久握」。

### 2.2 穗的 14 张人物差分

`hay-sleep / take-breath / go-together / old-letter-anxious / apologize /
still-matters / storm-run-ready / trust-her / run-beside / morning-route-trust /
windy-knot-trust / quiet-letter-trust / praise-response / rest-response`

身份锚点：成年草原信使；麦金单侧粗辫、湖蓝绿眼；奶油衬衣、天空蓝短斗篷、
珊瑚领巾、棕长靴；大号棕皮信袋和肩带始终存在。固定叙事道具包括水壶、捆绳、
旧信和蓝边急件。

### 2.3 16 张场景

- 茜：`petalsmith-road / rejected-workbench / first-blade-gate /
  daily-blind-grip / daily-rain-wrap / daily-small-hands`
- 穗：`hayfield-wakeup / old-letter-door / storm-delivery /
  daily-morning-route / daily-windy-knot / daily-quiet-letter`
- 普通奇遇：`r1-bell-path / r1-barrier-glade / r2-honey-tea / r2-altar-echo`

场景必须无人、无动物、无剪影和可读文字。关键道具放在左侧或中部，右侧约 38%
保持安静，给实时人物层留出空间。

正常进度固定为第一幕「初遇」→第二幕「熟悉」→第三幕「亲近」→日常「信赖」。
当前日常配置里的早期关系问候在合法存档中不可达，因此首批不为这些不可达分支另画
18 张差分；若未来调整开放规则，必须再补对应视觉，而不是误用信赖阶段表情。

---

## 3. 运行时接口

### 3.1 逐句立绘

`EncounterLine.portraitCue` 使用稳定的 `characterId + portraitId`：

- `undefined`：延续上一句的立绘。
- `null`：这一句明确让角色退场。
- 对象：从 `src/data/encounterVisuals.ts` 严格解析并切换差分。

不存在的人物或差分键直接抛出配置错误，不能换成 emoji 或默认图。核心层只处理稳定键，
不读取图片路径，仍保持纯 TypeScript。

### 3.2 日常变体

每个 `EncounterDailyVariant` 必须显式配置：

- `sceneAsset`
- `initialPortrait`

同一 pending UID 仍由现有 seeded RNG 稳定选择同一变体；视觉字段不进入存档，也不改变
随机序列。

### 3.3 高潮 CG

第三幕回答播放完毕后，舞台才切换到 `climaxAsset`。这样玩家先看见对应回答动作，再看到
纯物件高潮图；CG 不固定玩家外观，也不会让角色突然换回旧衣服。

---

## 4. 文件与尺寸

```text
art-source/encounters/portraits/<character>/<slug>-chroma.png
public/assets/encounters/portraits/<character>/<slug>.png

art-source/encounters/scenes/<group>/<slug>-source.png
public/assets/encounters/scenes/<group>/<slug>.webp

art-source/encounters/cg/<slug>-source.png
public/assets/encounters/cg/<slug>.webp
```

- 人物运行时：`640×960` RGBA PNG，目标不超过 `550KB`。
- 场景 / CG：严格 `1536×1024`、无透明 WebP，目标不超过 `520KB`。
- 人物源图使用纯 `#ff00ff` 键色；背景无阴影、渐变、地面和反射。
- 人物底部锚定、四角透明、主体不触边，适配 390×844 与 320px 窄屏舞台。
- `assets/encounters/**` 不进入 PWA 首次预缓存，访问时由独立
  `StaleWhileRevalidate` 缓存按需保存；稳定剧情路径重绘后会在后台刷新，不会被旧图锁住
  30 天。

完整提示词分别保存在：

- `art-source/encounters/PROMPTS-AKANE.md`
- `art-source/encounters/PROMPTS-SUI.md`
- `art-source/encounters/PROMPTS-MAIN-SCENES.md`
- `art-source/encounters/PROMPTS-ORDINARY.md`

---

## 5. 生产与验收

不同资产必须分别调用内置 `image_gen`。人物先做身份锚点，再以锚点执行
identity-preserve 编辑；抠图复用系统脚本，但不能把同一组软遮罩参数盲用到所有角色。

茜的赤棕发、肤色与粉色配饰会被 `soft-matte + despill` 当成接近洋红的背景，造成整个人物
灰白半透明。均匀纯色幕的正确主流程是只移除从画布边界连通进来的近键色：

```powershell
python "$env:USERPROFILE\.codex\skills\.system\imagegen\scripts\remove_chroma_key.py" `
  --input <chroma-source.png> `
  --out <alpha-output.png> `
  --auto-key border `
  --tolerance 40 `
  --edge-contract 1 `
  --force
```

茜的阈值对照与最终命令记录在 `PROMPTS-AKANE.md`。穗的蓝 / 金 / 棕配色经逐张检查不与键色
冲突，因此 `PROMPTS-SUI.md` 保留了通过验证的软边参数；新增人物必须先看阈值对照和联系表，
再选择处理方式，不能靠 UI 滤镜掩盖被误删的角色颜色。色键完成后统一由 Sharp 缩放产生正常
抗锯齿边缘。

运行时统一执行：

```powershell
npm run assets:encounters:check
npm run verify
npm run qa:encounter-save
```

审计器检查精确清单、源图存在、人物尺寸 / alpha / 四角 / 包围盒 / 底锚 / 残余键色 /
体积，场景尺寸 / 比例 / alpha / 体积，以及全部运行时图解码后的规范像素 SHA-256
重复。

最后一条命令会在系统临时目录生成浏览器验收存档，里面同时放入茜的信赖日常、穗的
第三幕高潮和一项纯环境普通奇遇；旅途手札也预置了两人的已完成章节。它只用于导入测试，
不会写入仓库或改变正式存档结构。

脚本审计通过后，还必须查看人物联系表和 390×844 实机截图，人工检查换脸、断手、道具融合、
错误文字、人物裁切、背景抢占右侧以及差分切换时的跳位。开启系统减少动态效果后，场景推镜
和差分过渡必须停止，但对白、立绘与高潮 CG 仍完整可见。

本批验收证据：

- `art-source/qa/encounter-akane-portraits.png`
- `art-source/qa/encounter-sui-portraits.png`
- `art-source/qa/encounter-main-scenes.png`
- `art-source/qa/encounter-scenes-contact.png`
- `art-source/qa/encounter-galgame-390x844.png`
- `art-source/qa/encounter-galgame-320x568.png`
- `art-source/qa/encounter-journal-390x844.png`
- `art-source/qa/encounter-climax-390x844.png`

---

## 6. 后续新增奇遇角色

新增角色不需要再改一套 UI，按同一接口扩展：

1. 先确定稳定 `characterId`、成年角色身份锚点和全部说话称谓。
2. 在 `src/data/encounterVisuals.ts` 注册命名差分和手札默认立绘。
3. 每个主线 / 日常显式填写 `sceneAsset` 与 `initialPortrait`，需要换动作的对白填写
   `portraitCue`；高潮图只使用纯物件或无人构图。
4. 把运行时文件、源图和提示文档加入精确资产清单；禁止用复制图、默认头像或旧区域地图
   冒充完成。
5. 补齐“所有差分都有真实剧情引用”的数据测试，再跑资产审计、全量验证和两档手机实机。

核心层只认识稳定键，图片路径集中在数据注册表中；因此加第五位、第六位同行者时不会把
资源判断散落到组件里。
