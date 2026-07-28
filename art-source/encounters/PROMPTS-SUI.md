# 穗（char_sui）Galgame 美术首批提示词

> 生产方式：Codex 内置 `image_gen`。
> 身份锚点：`art-source/encounters/portraits/sui/anchor-chroma.png`。
> 所有动作差分均以该锚点作为唯一身份参考，最终调用提示 =「人物母提示」+ 对应动作提示。
> 场景风格参考仅使用 `public/assets/affection/scenes/swordsman-training-dawn.webp` 的渲染完成度，不复制其建筑或物件。

## 1. 固定人物设定

- 成年女性草原信使，明确 20+；可爱灵动但不幼态。
- 麦金长发，一条向前垂落的粗侧辫，保留一撮睡翘；湖蓝绿眼。
- 奶油衬衣、天空蓝短斗篷与领巾、深湖蓝收腰裙裤、珊瑚围巾、棕色长靴、麦穗帽针。
- 超大棕皮信袋与肩带始终存在；翼形袋盖、红蜡印图形，但绝不出现可读文字。
- 固定旅行道具：水壶、捆绳、象牙信封。
- 立绘用于 Galgame 右侧站位：身体略朝左，完整全身或大腿以上，底部锚定。

## 2. 身份锚点提示词

输出：`art-source/encounters/portraits/sui/anchor-chroma.png`

```text
Use case: stylized-concept + background-extraction
Asset type: production-ready 2D Japanese mobile game Galgame character standing sprite identity anchor
Primary request: Create one definitive identity anchor for Sui, an ADULT WOMAN age 20+ who works as a cheerful but slightly sleepy grassland courier. She must read clearly as a capable young adult, never a child or teenager.
Scene/backdrop: perfectly flat solid #ff00ff chroma-key background for local removal. One exact uniform color, no shadow, no gradient, no texture, no floor plane, no reflection, no lighting variation.
Subject identity: warm wheat-gold long hair, one thick side braid draped forward, plus one charming small cowlick; clear lake-blue-teal eyes; gentle adult facial proportions and confident courier energy. Cream blouse, short sky-blue capelet and neck scarf, deep teal fitted skirt-shorts/travel culottes (avoid magenta anywhere), coral-red scarf accent, brown knee-high travel boots, tiny wheat-ear hat pin. Always include an oversized brown leather mail satchel with a thick shoulder strap, wing-shaped flap, and a red wax-seal GRAPHIC with absolutely no readable letters. Include a small canteen, neatly coiled rope, and one plain ivory envelope as restrained fixed courier props.
Style/medium: polished 2D Japanese fantasy mobile game character illustration, clean deep-blue/brown linework, cel shading with delicate painterly highlights, fresh cute blue-white-coral palette, premium soft rendering matching the quality level of a shipped anime mobile RPG; no chibi.
Composition/framing: portrait 2:3. Full body or complete thigh-up body with all limbs and props intact. Bottom-anchored, generous clear padding on every side, subject positioned toward the RIGHT side and body turned slightly LEFT for dialogue UI. Neutral friendly standing pose, one hand naturally steadying the satchel strap, the other lightly holding the canteen; hands anatomically clean, five fingers each, no overlap ambiguity.
Lighting/mood: bright soft key light on subject only; clear silhouette; cheerful, dependable, slightly drowsy personality.
Constraints: this is the canonical identity anchor; adult age 20+; same single character only. The satchel and shoulder strap must be fully visible and physically coherent. Perfectly crisp separable silhouette. Do not use #ff00ff or any magenta/pink/purple hue anywhere in the subject, clothing, props, antialiasing, highlights, or outline. No cast/contact shadow. No text, letters, numerals, logo, UI, watermark, scenery, extra people, animals, mascot, weapon, school uniform, maid outfit, cat ears, childlike proportions, sexualized clothing, cropped feet, cropped hair, cropped bag, malformed hands, extra fingers, extra limbs.
```

## 3. 人物动作母提示

下列母提示与每个动作小节的「变化项」合并使用；Image 1 恒为身份锚点。

```text
Use case: identity-preserve + background-extraction
Asset type: Galgame standing sprite action differential
Input images: Image 1 is the canonical Sui identity anchor and the only identity/design authority.
Identity invariants: preserve exactly the same adult Sui face, lake-blue-teal eyes, wheat-gold long hair with one thick side braid and cowlick, cream blouse, sky-blue capelet, coral scarf, deep-teal travel culottes, brown knee-high boots, wheat-ear hat pin, oversized wing-flap brown leather mail satchel and coherent shoulder strap. Preserve the same premium 2D Japanese mobile RPG cel-shaded rendering, proportions, linework and palette.
Scene/backdrop: perfectly flat uniform solid #ff00ff only; no shadow, gradient, texture, floor plane, reflection or lighting variation.
Composition/framing: portrait 2:3; full body or complete thigh-up; bottom anchored with generous padding; subject on the RIGHT facing slightly LEFT for dialogue UI; all hair, hands, props, bag and limbs inside frame.
Constraints: adult age 20+; change only the named pose/expression. Do not use magenta/pink/purple anywhere in the subject. No readable letters, text, logo, watermark, scenery, extra people, animals, mascot, school uniform, maid outfit, chibi/childlike proportions, cast shadow, crop, malformed hands, extra fingers or extra limbs.
```

### `hay-sleep`

源图：`art-source/encounters/portraits/sui/hay-sleep-chroma.png`

```text
Change only pose and expression: a cute tired courier dozing while hugging the large mail satchel to her chest as if it were a hay bale; eyelids closed, tiny peaceful sleepy smile, head gently tilted; standing/kneeling self-contained pose that can be cleanly cut out with no actual hay bale and no scenery. Keep the satchel fully visible and physically coherent. Hands naturally wrap around the satchel, anatomically clear.
```

### `take-breath`

源图：`art-source/encounters/portraits/sui/take-breath-chroma.png`

```text
Change only pose and expression: she steadies herself and seriously cradles her canteen with both hands at mid-chest, takes one measured breath, brows gently focused, calm responsible expression. Satchel remains on shoulder and visibly secured. Two natural anatomically correct hands clearly hold one canteen; no duplicate canteen.
```

### `go-together`

源图：`art-source/encounters/portraits/sui/go-together-chroma.png`

```text
Change only pose and expression: energetic first stride into a run after correcting the satchel securely on her back; lean forward, one boot stepping out, one arm pumping and the other pointing ahead in an inviting “let's go together” gesture; bright determined smile. Satchel, broad shoulder strap, coiled rope and plain ivory envelope remain secure and clearly visible, with believable motion and no loose floating pieces. Full body including both boots.
```

### `old-letter-anxious`

源图：`art-source/encounters/portraits/sui/old-letter-anxious-chroma.png`

```text
Change only pose and expression: she anxiously holds one old ivory envelope with a slightly wrinkled corner and red wax seal between both hands close to her chest; shoulders slightly tense and toes subtly turned as if she has walked around the route three times; worried sideways glance, furrowed brows, embarrassed uncertainty. Satchel stays worn securely and fully visible. Envelope has no readable text or symbols.
```

### `apologize`

源图：`art-source/encounters/portraits/sui/apologize-chroma.png`

```text
Change only pose and expression: nervous but courageous apology at a doorway that is NOT shown; she takes one small forward step, torso politely inclined, one hand over her heart and the other presenting the old ivory red-wax envelope forward; anxious blush but sincere eye contact, visibly choosing to face the recipient instead of retreating. Satchel and strap remain worn and fully visible.
```

### `still-matters`

源图：`art-source/encounters/portraits/sui/still-matters-chroma.png`

```text
Change only pose and expression: she protectively presses the old ivory red-wax envelope flat against her heart with both hands; shoulders lift as she suddenly understands that the delayed letter still matters; eyes wide and moist but hopeful, small awakened smile, posture straightening from doubt to resolve. Satchel remains on shoulder, fully visible and coherent.
```

### `storm-run-ready`

源图：`art-source/encounters/portraits/sui/storm-run-ready-chroma.png`

```text
Change only pose and expression: a low storm-running ready stance, torso leaned forward and knees bent; one arm shields a single clean blue-edged urgent envelope firmly against her chest while the other hand grips the satchel strap; fierce determined eyes, jaw set; braid and cape swept back by implied wind but with no wind graphics. Bag is closed, strapped tightly and fully visible. Envelope blue trim only, no readable text.
```

### `trust-her`

源图：`art-source/encounters/portraits/sui/trust-her-chroma.png`

```text
Change only pose and expression: she charges confidently through imagined tall grass but with NO grass or scenery shown; dynamic forward run, one knee lifted, one arm pumping, other hand holding the secured satchel strap; fierce focused eyes and a slight fearless smile that says “trust her.” Braid and short cape flow backward; mail bag stays closed and fully visible. Full body including both boots.
```

### `run-beside`

源图：`art-source/encounters/portraits/sui/run-beside-chroma.png`

```text
Change only pose and expression: light jogging stride while looking back over her left shoulder with a confident warm grin; one open hand gestures “keep up beside me” toward the unseen companion, the other hand holds the satchel strap; braid and cape show modest motion, bag closed and fully visible. Full body including both boots.
```

### `morning-route-trust`

源图：`art-source/encounters/portraits/sui/morning-route-trust-chroma.png`

```text
Change only pose and expression: relaxed morning-route greeting; one hand raised in an open friendly wave, the other neatly straightening the closed mail satchel; warm trusted smile. Add one tiny dew-blue wildflower tucked by the neatly organized bag strap, with no magenta petals. Canteen and coiled rope remain restrained and secure.
```

### `windy-knot-trust`

源图：`art-source/encounters/portraits/sui/windy-knot-trust-chroma.png`

```text
Change only pose and expression: comical strong-wind knot lesson with no wind graphics—her LEFT hand presses the blue courier cap safely onto her head; her RIGHT hand clearly displays a short rope sample ending in exactly TWO different neat knots side by side. She wears a sheepish playful “which knot is right?” smile, one eyebrow raised. Bag remains worn, closed and visible. Exactly two rope knots, not more; rope never tangles with fingers.
```

### `quiet-letter-trust`

源图：`art-source/encounters/portraits/sui/quiet-letter-trust-chroma.png`

```text
Change only pose and expression: quiet intimate trust beat; she holds one perfectly flat plain ivory envelope gently between both open hands at chest height, offering it to an unseen companion as an invitation to walk the quiet route together; soft direct eye contact, small serene smile, calm upright posture. Bag stays worn, closed and visible. Envelope is flat, uncreased, and has no readable text or symbols.
```

### `praise-response`

源图：`art-source/encounters/portraits/sui/praise-response-chroma.png`

```text
Change only pose and expression: proud playful response to praise for arriving exactly on time—upright courier salute with RIGHT hand at brow, chin slightly raised, satisfied closed-mouth grin and one confident wink; LEFT hand rests on the securely packed satchel. Bag, strap, rope and canteen remain coherent and visible.
```

### `rest-response`

源图：`art-source/encounters/portraits/sui/rest-response-chroma.png`

```text
Change only pose and expression: sheepish promise to rest; one small involuntary yawn covered politely by her RIGHT hand, eyes half-lidded and slightly guilty, tiny embarrassed smile; LEFT hand keeps the satchel strap secure while posture relaxes. The bag, rope and canteen remain coherent and visible. The yawning hand must not hide the whole face.
```

## 4. 主线场景

以下三张由并行场景批次补充；正式源文件已经预留。

### `hayfield-wakeup`

<!-- 主线场景辅助代理合并精确提示词 -->

### `old-letter-door`

<!-- 主线场景辅助代理合并精确提示词 -->

### `storm-delivery`

<!-- 主线场景辅助代理合并精确提示词 -->

## 5. 日常场景提示词

### `daily-morning-route`

源图：`art-source/encounters/scenes/sui/daily-morning-route-source.png`

```text
Use case: stylized-concept
Asset type: 3:2 Galgame background for mobile game encounter, slug daily-morning-route
Input images: Image 1 is STYLE/RENDERING QUALITY reference only; do not copy its architecture or objects.
Primary request: Create an unpopulated early-morning grassland courier route where a trusted daily meeting can happen.
Scene/backdrop: fresh dawn over rolling soft-green and blue grasslands; a forked dirt courier road emerging from the LEFT-middle foreground; dew on pale blue and cream wildflowers, low pearly mist, tiny parcel-rest stone and a simple unmarked wooden route post near the left-middle; distant windmill and softly layered hills. No characters or animals.
Style/medium: polished 2D Japanese fantasy mobile-game visual-novel background, premium painterly/cel-shaded clarity and atmospheric depth, rounded gentle shapes, clean fresh blue-white-coral-gold palette, not photorealistic.
Composition/framing: exact wide 3:2 establishing shot. Story props and visual detail concentrated in left 62%. Reserve the RIGHTMOST 38% as quiet low-contrast open grass and sky for a character sprite; no tall object or focal point there.
Lighting/mood: bright cool sunrise, dew sparkle, calm dependable route, soft warm rim light on distant clouds.
Constraints: environment only; absolutely no people, body parts, faces, silhouettes, animals, birds, mascot, readable writing, letters, numerals, signs with text, logos, UI, watermark, frame or speech bubble.
```

### `daily-windy-knot`

源图：`art-source/encounters/scenes/sui/daily-windy-knot-source.png`

```text
Use case: stylized-concept + precise-object-edit
Asset type: 3:2 Galgame background for mobile game encounter, slug daily-windy-knot
Primary request: Create an unpopulated bright daytime long-distance grassland courier road around a harmless windy rope-practice moment.
Scene/backdrop: broad sunlit trail through tall pale-green grass under vivid blue sky; strong wind is visible only through bent grass and streaming cloud shapes. On the LEFT-middle stands a simple wooden practice rack with exactly two plain short UNTIED practice ropes hanging straight from simple pegs, each with only a basic stopper end and no finished knot pattern; nearby are a small stone windbreak and an unmarked resting crate.
Style/medium: polished 2D Japanese fantasy mobile-game visual-novel background, premium painterly/cel-shaded clarity, rounded soft forms, fresh sky-blue/white/wheat-gold/deep-teal palette.
Composition/framing: exact wide 3:2. Practice rack and story props live in left 62%; RIGHTMOST 38% remains quiet open low-contrast grass and sky for a character sprite.
Constraints: environment only; no finished decorative knots because the character sprite carries the unique two-knot sample. No mail bag, envelope, people, silhouettes, animals, birds, readable text, logo, UI or watermark.
```

### `daily-quiet-letter`

源图：`art-source/encounters/scenes/sui/daily-quiet-letter-source.png`

```text
Use case: stylized-concept + lighting-weather + precise-object-edit
Asset type: 3:2 Galgame background for mobile game encounter, slug daily-quiet-letter
Primary request: Create an unpopulated quiet grassland postal route at golden evening for a gentle shared walk and letter conversation.
Scene/backdrop: narrow warm dirt lane through wheat-gold grasses; an unmarked blue-roof courier mailbox and completely EMPTY wooden bench on the LEFT-middle; distant cozy cottage with warm window light, low hills and a calm sunset sky. No envelope, mail bag, rope, canteen, characters or animals.
Style/medium: polished 2D Japanese fantasy mobile-game visual-novel background, premium painterly/cel-shaded rendering, rounded gentle shapes, fresh sky-blue/cream/coral-gold/deep-teal palette.
Composition/framing: exact wide 3:2. Mailbox, bench and cottage stay within left 62%. Reserve RIGHTMOST 38% as quiet muted low-contrast path, grasses and soft sky for a character sprite; no sun disk, hotspot, focal prop, tall post or bright window on the right.
Lighting/mood: golden hour transitioning to soft blue evening; warmest glow sits toward LEFT-CENTER behind the cottage; intimate, safe and quietly hopeful.
Constraints: environment only; no unique letter prop because the character sprite carries it. No people, silhouettes, animals, birds, readable text, logos, UI or watermark.
```

## 6. 高潮 CG 提示词

输出：`art-source/encounters/cg/sui-return-letter-source.png`

```text
Use case: precise-object-edit
Asset type: 3:2 Galgame climax CG narrative correction, formal sui-return-letter
Primary request: One perfectly flat blue-edged reply envelope with one small abstract non-language postmark graphic is the hero object in left-center. Under it lies one worn unfolded OLD ROUTE MAP drawn only with abstract colored route lines and terrain shapes, absolutely no words, place names, letters or numerals. Beside the reply is one independent polished metal courier badge removed from the bag: a small wing-shaped brass-and-blue enamel insignia visibly worn smooth at the edges from use. Add one small separate red sealing-wax cake/seal stamp nearby. An open courier satchel is scaled down substantially and moved into the LEFT-BACKGROUND so it does not dominate; its wing flap is plain leather with NO metal badge attached, and the bag is open and empty.
Scene/backdrop: twilight grassland at the delivery destination with a warm route lantern in the right background; a few wind-bent grass blades and layered mountains.
Style/medium: polished 2D Japanese fantasy mobile-game visual-novel event CG, premium painterly/cel-shaded detail, gentle rounded shapes, tactile leather/paper/metal/wax/grass textures, fresh blue-cream-coral-gold-deep-teal palette.
Composition/framing: exact wide 3:2, intimate low camera; visual hierarchy is return letter + earned courier badge + old route + red wax.
Lighting/mood: golden-blue twilight after an on-time delivery; destination glow catches the polished badge and blue envelope edge; relief, trust and growth.
Constraints: exactly ONE envelope total. Exactly ONE independent metal courier badge beside the envelope and no badge attached to the bag. One old map sheet beneath, one red wax prop. No hands, people, bodies, faces, silhouettes, animals, readable text, letters, numerals, logos, UI or watermark. No extra mail, written pages or duplicate bag.
```

## 7. 运行时后处理

### 7.1 人物色键转透明

对除 `anchor-chroma.png` 外的 14 张动作源图逐一执行：

```powershell
python "C:\Users\Administrator\.codex\skills\.system\imagegen\scripts\remove_chroma_key.py" `
  --input "art-source\encounters\portraits\sui\<slug>-chroma.png" `
  --out "art-source\qa\.tmp-sui-alpha\<slug>.png" `
  --auto-key border `
  --soft-matte `
  --transparent-threshold 12 `
  --opaque-threshold 220 `
  --despill `
  --force
```

随后用项目现有 `sharp`：

```js
sharp(input)
  .ensureAlpha()
  .resize({
    width: 640,
    height: 960,
    fit: "contain",
    position: "bottom",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png({
    compressionLevel: 9,
    adaptiveFiltering: true,
    palette: true,
    quality: 100,
    colours: 256,
    dither: 0.5,
    effort: 10,
  })
  .toFile("public/assets/encounters/portraits/sui/<slug>.png")
```

### 7.2 场景与 CG

```js
sharp(source)
  .resize(1536, 1024, { fit: "cover" })
  .webp({ quality: 82, effort: 6, smartSubsample: true })
  .toFile(runtimePath)
```

### 7.3 QA

- 14 张运行时人物均为 `640×960 RGBA PNG`，四角 alpha 必须为 0，主体包围盒不得触边。
- 禁止可见品红残边；肤色、珊瑚围巾、蓝边、金发发梢不得被误抽为半透明。
- 场景与 CG 为 `1536×1024 WebP`，无人、无动物、无文字、无水印。
- 人物联系表：`art-source/qa/encounter-sui-portraits.png`，4 列。
