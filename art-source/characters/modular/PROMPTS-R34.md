# R3 / R4 四职业模块化角色资产生产记录

生成模式：Codex 内置 ImageGen，24 个资产各自独立调用一次；没有复制、改色或重命名复用。

## 统一生成约束

- 图 1：同职业 `r2` 同槽位图，只用于槽位、朝向和手位参考。
- 图 2：同职业 `base.png`，只用于 640×960 人物注册参考。
- 输出：单槽位装备，纯色 `#00ff00` 绿幕，2:3 竖图，主体完整并留安全边距。
- 画风：清新可爱二次元手游立绘、柔和赛璐璐、深棕描边、适合缩小显示。
- 隔离：body 不含脸、头发、皮肤、手脚；head 不含脸、头发、猫耳；weapon 不含手和皮肤。
- R3「虫境」：深绿 / 青绿、青色微光、薄翼与昆虫甲片，非血腥。
- R4「月坠」：月蓝、银色、浅薰衣草、骨白仅作为颜色、月纹，优雅且非恐怖。

## 统一后处理

每张绿幕源图都用官方脚本独立去绿：

```powershell
python "C:\Users\Administrator\.codex\skills\.system\imagegen\scripts\remove_chroma_key.py" --input <chroma> --out <alpha> --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill
```

运行时图由 Node + Sharp 内联命令（`node -`）确定性生成：读取 `*-alpha.png`，以 `alpha > 16` 求主体包围盒，裁切后用 Lanczos3 填充到本节记录的目标框，再合成到透明 640×960 画布。喵喵双爪以原图水平中线分成左右两个独立包围盒，分别对齐左右手。没有 CSS 位移补偿。

## swordsman/r3-body

- 参考：`public/assets/characters/modular/swordsman/r2-body.png`；`public/assets/characters/modular/swordsman/base.png`
- 提示词：轻型深绿 / 青绿昆虫甲战裙，青色发光接缝、薄翼肩饰、清晰领口与手臂开口；只生成 body 层。
- 原始生成：`C:\Users\Administrator\.codex\generated_images\019fa752-f332-7000-9427-383c1363a451\exec-a73aa69a-ad67-470a-b1e4-22d365883bef.png`
- 绿幕：`art-source/characters/modular/swordsman/r34-source/r3-body-chroma.png`
- 去绿命令：`python "C:\Users\Administrator\.codex\skills\.system\imagegen\scripts\remove_chroma_key.py" --input "art-source/characters/modular/swordsman/r34-source/r3-body-chroma.png" --out "art-source/characters/modular/swordsman/r34-source/r3-body-alpha.png" --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill`
- 对位框：`x=164, y=164, w=311, h=362`
- 运行时：`public/assets/characters/modular/swordsman/r3-body.png`

## swordsman/r3-head

- 参考：`public/assets/characters/modular/swordsman/r2-head.png`；`public/assets/characters/modular/swordsman/base.png`
- 提示词：轻巧昆虫翼战斗额冠，青色翼片、甲虫宝石，开放式且不遮脸；只生成 head 层。
- 原始生成：`C:\Users\Administrator\.codex\generated_images\019fa752-f332-7000-9427-383c1363a451\exec-e5acde4d-22d6-48bd-891d-0ecc5cec6c07.png`
- 绿幕：`art-source/characters/modular/swordsman/r34-source/r3-head-chroma.png`
- 去绿命令：`python "C:\Users\Administrator\.codex\skills\.system\imagegen\scripts\remove_chroma_key.py" --input "art-source/characters/modular/swordsman/r34-source/r3-head-chroma.png" --out "art-source/characters/modular/swordsman/r34-source/r3-head-alpha.png" --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill`
- 对位框：`x=230, y=2, w=180, h=107`
- 运行时：`public/assets/characters/modular/swordsman/r3-head.png`

## swordsman/r3-weapon

- 参考：`public/assets/characters/modular/swordsman/r2-weapon.png`；`public/assets/characters/modular/swordsman/base.png`
- 提示词：单手螳螂翼弯刀，深绿刀脊、青光刃、薄翼护手，沿原左手武器方向；只生成 weapon 层。
- 原始生成：`C:\Users\Administrator\.codex\generated_images\019fa752-f332-7000-9427-383c1363a451\exec-7c8cbd7e-fe88-4a2e-8060-4db98ad34de9.png`
- 绿幕：`art-source/characters/modular/swordsman/r34-source/r3-weapon-chroma.png`
- 去绿命令：`python "C:\Users\Administrator\.codex\skills\.system\imagegen\scripts\remove_chroma_key.py" --input "art-source/characters/modular/swordsman/r34-source/r3-weapon-chroma.png" --out "art-source/characters/modular/swordsman/r34-source/r3-weapon-alpha.png" --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill`
- 对位框：`x=43, y=175, w=163, h=276`
- 运行时：`public/assets/characters/modular/swordsman/r3-weapon.png`

## swordsman/r4-body

- 参考：`public/assets/characters/modular/swordsman/r2-body.png`；`public/assets/characters/modular/swordsman/base.png`
- 提示词：月蓝 / 银 / 浅紫轻甲战裙，骨白分层裙摆、弯月肩甲和星月纹；只生成 body 层。
- 原始生成：`C:\Users\Administrator\.codex\generated_images\019fa752-f332-7000-9427-383c1363a451\exec-af573386-ff36-4e00-92f2-c7a84bee9069.png`
- 绿幕：`art-source/characters/modular/swordsman/r34-source/r4-body-chroma.png`
- 去绿命令：`python "C:\Users\Administrator\.codex\skills\.system\imagegen\scripts\remove_chroma_key.py" --input "art-source/characters/modular/swordsman/r34-source/r4-body-chroma.png" --out "art-source/characters/modular/swordsman/r34-source/r4-body-alpha.png" --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill`
- 对位框：`x=164, y=149, w=311, h=377`
- 运行时：`public/assets/characters/modular/swordsman/r4-body.png`

## swordsman/r4-head

- 参考：`public/assets/characters/modular/swordsman/r2-head.png`；`public/assets/characters/modular/swordsman/base.png`
- 提示词：开放式月蓝银冠，中央弯月与两侧浅紫翼片，不遮脸；只生成 head 层。
- 原始生成：`C:\Users\Administrator\.codex\generated_images\019fa752-f332-7000-9427-383c1363a451\exec-b45c48cd-c7dd-4eec-9a71-e8d04291080a.png`
- 绿幕：`art-source/characters/modular/swordsman/r34-source/r4-head-chroma.png`
- 去绿命令：`python "C:\Users\Administrator\.codex\skills\.system\imagegen\scripts\remove_chroma_key.py" --input "art-source/characters/modular/swordsman/r34-source/r4-head-chroma.png" --out "art-source/characters/modular/swordsman/r34-source/r4-head-alpha.png" --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill`
- 对位框：`x=225, y=38, w=190, h=64`
- 运行时：`public/assets/characters/modular/swordsman/r4-head.png`

## swordsman/r4-weapon

- 参考：`public/assets/characters/modular/swordsman/r2-weapon.png`；`public/assets/characters/modular/swordsman/base.png`
- 提示词：银色宽弯月刀、月蓝刀脊、浅紫月晶护手与短缠柄，维持左手斜向；只生成 weapon 层。
- 原始生成：`C:\Users\Administrator\.codex\generated_images\019fa752-f332-7000-9427-383c1363a451\call_NSOt3h0gaDkheLipN3GZnvN8.png`
- 绿幕：`art-source/characters/modular/swordsman/r34-source/r4-weapon-chroma.png`
- 去绿命令：`python "C:\Users\Administrator\.codex\skills\.system\imagegen\scripts\remove_chroma_key.py" --input "art-source/characters/modular/swordsman/r34-source/r4-weapon-chroma.png" --out "art-source/characters/modular/swordsman/r34-source/r4-weapon-alpha.png" --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill`
- 对位框：`x=15, y=210, w=205, h=223`
- 运行时：`public/assets/characters/modular/swordsman/r4-weapon.png`

## witch/r3-body

- 参考：`public/assets/characters/modular/witch/r2-body.png`；`public/assets/characters/modular/witch/base.png`
- 提示词：深青绿蘑菇灯笼法袍，分层菌伞裙、青光晶点与透明小翼袖；只生成 body 层。
- 原始生成：`C:\Users\Administrator\.codex\generated_images\019fa752-f332-7000-9427-383c1363a451\exec-8fd0dac4-d8c9-4cfa-bbd3-91d9d6284694.png`
- 绿幕：`art-source/characters/modular/witch/r34-source/r3-body-chroma.png`
- 去绿命令：`python "C:\Users\Administrator\.codex\skills\.system\imagegen\scripts\remove_chroma_key.py" --input "art-source/characters/modular/witch/r34-source/r3-body-chroma.png" --out "art-source/characters/modular/witch/r34-source/r3-body-alpha.png" --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill`
- 对位框：`x=175, y=168, w=326, h=372`
- 运行时：`public/assets/characters/modular/witch/r3-body.png`

## witch/r3-head

- 参考：`public/assets/characters/modular/witch/r2-head.png`；`public/assets/characters/modular/witch/base.png`
- 提示词：细窄触角发带、蘑菇灯尖和透明翼发夹，保留完整发型；只生成 head 层。
- 原始生成：`C:\Users\Administrator\.codex\generated_images\019fa752-f332-7000-9427-383c1363a451\exec-4e48aa0d-28dd-45ca-8229-8754a4195173.png`
- 绿幕：`art-source/characters/modular/witch/r34-source/r3-head-chroma.png`
- 去绿命令：`python "C:\Users\Administrator\.codex\skills\.system\imagegen\scripts\remove_chroma_key.py" --input "art-source/characters/modular/witch/r34-source/r3-head-chroma.png" --out "art-source/characters/modular/witch/r34-source/r3-head-alpha.png" --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill`
- 对位框：`x=220, y=20, w=200, h=100`
- 运行时：`public/assets/characters/modular/witch/r3-head.png`

## witch/r3-weapon

- 参考：`public/assets/characters/modular/witch/r2-weapon.png`；`public/assets/characters/modular/witch/base.png`
- 提示词：青色发光蘑菇晶杖，短柄、菌伞水晶与小薄翼，末端落在左拳；只生成 weapon 层。
- 原始生成：`C:\Users\Administrator\.codex\generated_images\019fa752-f332-7000-9427-383c1363a451\exec-07cb800d-1ecc-417c-8ee5-86165abac553.png`
- 绿幕：`art-source/characters/modular/witch/r34-source/r3-weapon-chroma.png`
- 去绿命令：`python "C:\Users\Administrator\.codex\skills\.system\imagegen\scripts\remove_chroma_key.py" --input "art-source/characters/modular/witch/r34-source/r3-weapon-chroma.png" --out "art-source/characters/modular/witch/r34-source/r3-weapon-alpha.png" --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill`
- 对位框：`x=145, y=225, w=125, h=169`
- 运行时：`public/assets/characters/modular/witch/r3-weapon.png`

## witch/r4-body

- 参考：`public/assets/characters/modular/witch/r2-body.png`；`public/assets/characters/modular/witch/base.png`
- 提示词：月蓝魔女裙、骨白泡袖、浅紫星月分层裙摆与开放手臂孔；只生成 body 层。
- 原始生成：`C:\Users\Administrator\.codex\generated_images\019fa752-f332-7000-9427-383c1363a451\exec-e2a3c8ff-6cb5-4688-a72e-a33cc39e2626.png`
- 绿幕：`art-source/characters/modular/witch/r34-source/r4-body-chroma.png`
- 去绿命令：`python "C:\Users\Administrator\.codex\skills\.system\imagegen\scripts\remove_chroma_key.py" --input "art-source/characters/modular/witch/r34-source/r4-body-chroma.png" --out "art-source/characters/modular/witch/r34-source/r4-body-alpha.png" --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill`
- 对位框：`x=175, y=159, w=326, h=381`
- 运行时：`public/assets/characters/modular/witch/r4-body.png`

## witch/r4-head

- 参考：`public/assets/characters/modular/witch/r2-head.png`；`public/assets/characters/modular/witch/base.png`
- 提示词：轻巧浅紫弯月与月蓝星粒发环，细小、开放、不遮眼；只生成 head 层。
- 原始生成：`C:\Users\Administrator\.codex\generated_images\019fa752-f332-7000-9427-383c1363a451\exec-ba7147a3-21d0-4b02-a592-1187f070fe17.png`
- 绿幕：`art-source/characters/modular/witch/r34-source/r4-head-chroma.png`
- 去绿命令：`python "C:\Users\Administrator\.codex\skills\.system\imagegen\scripts\remove_chroma_key.py" --input "art-source/characters/modular/witch/r34-source/r4-head-chroma.png" --out "art-source/characters/modular/witch/r34-source/r4-head-alpha.png" --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill`
- 对位框：`x=260, y=35, w=120, h=61`
- 运行时：`public/assets/characters/modular/witch/r4-head.png`

## witch/r4-weapon

- 参考：`public/assets/characters/modular/witch/r2-weapon.png`；`public/assets/characters/modular/witch/base.png`
- 提示词：月蓝短杖、银色弯月托、浅紫切面月晶与小星坠；柄尾落在左拳；只生成 weapon 层。
- 原始生成：`C:\Users\Administrator\.codex\generated_images\019fa752-f332-7000-9427-383c1363a451\call_XgIfanK5lWeUFzHdh1zYOX2y.png`
- 绿幕：`art-source/characters/modular/witch/r34-source/r4-weapon-chroma.png`
- 去绿命令：`python "C:\Users\Administrator\.codex\skills\.system\imagegen\scripts\remove_chroma_key.py" --input "art-source/characters/modular/witch/r34-source/r4-weapon-chroma.png" --out "art-source/characters/modular/witch/r34-source/r4-weapon-alpha.png" --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill`
- 对位框：`x=135, y=160, w=140, h=241`
- 运行时：`public/assets/characters/modular/witch/r4-weapon.png`

## shaman/r3-body

- 参考：`public/assets/characters/modular/shaman/r2-body.png`；`public/assets/characters/modular/shaman/base.png`
- 提示词：青绿蝶翼祭仪服，晶蓝蝶翼裙片、仪式结饰与开放手臂；只生成 body 层。
- 原始生成：`C:\Users\Administrator\.codex\generated_images\019fa752-f332-7000-9427-383c1363a451\exec-ca3ad20b-d3ca-4e60-aef3-248fa32c5ec4.png`
- 绿幕：`art-source/characters/modular/shaman/r34-source/r3-body-chroma.png`
- 去绿命令：`python "C:\Users\Administrator\.codex\skills\.system\imagegen\scripts\remove_chroma_key.py" --input "art-source/characters/modular/shaman/r34-source/r3-body-chroma.png" --out "art-source/characters/modular/shaman/r34-source/r3-body-alpha.png" --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill`
- 对位框：`x=185, y=181, w=270, h=344`
- 运行时：`public/assets/characters/modular/shaman/r3-body.png`

## shaman/r3-head

- 参考：`public/assets/characters/modular/shaman/r2-head.png`；`public/assets/characters/modular/shaman/base.png`
- 提示词：萤火虫青光冠，三枚发光灯珠、蝶翼细丝和开放环形结构；只生成 head 层。
- 原始生成：`C:\Users\Administrator\.codex\generated_images\019fa752-f332-7000-9427-383c1363a451\exec-88a2c459-11e9-49c1-ab66-f52ee22f7c7d.png`
- 绿幕：`art-source/characters/modular/shaman/r34-source/r3-head-chroma.png`
- 去绿命令：`python "C:\Users\Administrator\.codex\skills\.system\imagegen\scripts\remove_chroma_key.py" --input "art-source/characters/modular/shaman/r34-source/r3-head-chroma.png" --out "art-source/characters/modular/shaman/r34-source/r3-head-alpha.png" --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill`
- 对位框：`x=225, y=20, w=190, h=114`
- 运行时：`public/assets/characters/modular/shaman/r3-head.png`

## shaman/r3-weapon

- 参考：`public/assets/characters/modular/shaman/r2-weapon.png`；`public/assets/characters/modular/shaman/base.png`
- 提示词：昆虫鸣唱蝶翼铃扇，深青扇面、青色灯珠与小铃，扇柄落在内侧手位；只生成 weapon 层。
- 原始生成：`C:\Users\Administrator\.codex\generated_images\019fa752-f332-7000-9427-383c1363a451\exec-d76d59a4-2f77-41cf-a760-ebb833cf0107.png`
- 绿幕：`art-source/characters/modular/shaman/r34-source/r3-weapon-chroma.png`
- 去绿命令：`python "C:\Users\Administrator\.codex\skills\.system\imagegen\scripts\remove_chroma_key.py" --input "art-source/characters/modular/shaman/r34-source/r3-weapon-chroma.png" --out "art-source/characters/modular/shaman/r34-source/r3-weapon-alpha.png" --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill`
- 对位框：`x=310, y=185, w=140, h=163`
- 运行时：`public/assets/characters/modular/shaman/r3-weapon.png`

## shaman/r4-body

- 参考：`public/assets/characters/modular/shaman/r2-body.png`；`public/assets/characters/modular/shaman/base.png`
- 提示词：月蓝祭仪裙、骨白内层、浅紫侧带与银色月相纹，保留巫祝修长轮廓；只生成 body 层。
- 原始生成：`C:\Users\Administrator\.codex\generated_images\019fa752-f332-7000-9427-383c1363a451\exec-51dbdcb1-a277-4ccf-bdc3-1fd6b0f28ced.png`
- 绿幕：`art-source/characters/modular/shaman/r34-source/r4-body-chroma.png`
- 去绿命令：`python "C:\Users\Administrator\.codex\skills\.system\imagegen\scripts\remove_chroma_key.py" --input "art-source/characters/modular/shaman/r34-source/r4-body-chroma.png" --out "art-source/characters/modular/shaman/r34-source/r4-body-alpha.png" --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill`
- 对位框：`x=185, y=181, w=270, h=344`
- 运行时：`public/assets/characters/modular/shaman/r4-body.png`

## shaman/r4-head

- 参考：`public/assets/characters/modular/shaman/r2-head.png`；`public/assets/characters/modular/shaman/base.png`
- 提示词：银 / 浅紫弯月冠，中央月晶与三枚月铃，开放且不遮脸；只生成 head 层。
- 原始生成：`C:\Users\Administrator\.codex\generated_images\019fa752-f332-7000-9427-383c1363a451\exec-88c33067-0838-45a7-b388-343734d37cf2.png`
- 绿幕：`art-source/characters/modular/shaman/r34-source/r4-head-chroma.png`
- 去绿命令：`python "C:\Users\Administrator\.codex\skills\.system\imagegen\scripts\remove_chroma_key.py" --input "art-source/characters/modular/shaman/r34-source/r4-head-chroma.png" --out "art-source/characters/modular/shaman/r34-source/r4-head-alpha.png" --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill`
- 对位框：`x=220, y=28, w=200, h=95`
- 运行时：`public/assets/characters/modular/shaman/r4-head.png`

## shaman/r4-weapon

- 参考：`public/assets/characters/modular/shaman/r2-weapon.png`；`public/assets/characters/modular/shaman/base.png`
- 提示词：月蓝 / 浅紫折扇，银色弯月扇骨、满月晶核与三枚月铃，扇柄落在内侧手位；只生成 weapon 层。
- 原始生成：`C:\Users\Administrator\.codex\generated_images\019fa752-f332-7000-9427-383c1363a451\call_0LpWJoA3HymaEXmu0r8psD8x.png`
- 绿幕：`art-source/characters/modular/shaman/r34-source/r4-weapon-chroma.png`
- 去绿命令：`python "C:\Users\Administrator\.codex\skills\.system\imagegen\scripts\remove_chroma_key.py" --input "art-source/characters/modular/shaman/r34-source/r4-weapon-chroma.png" --out "art-source/characters/modular/shaman/r34-source/r4-weapon-alpha.png" --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill`
- 对位框：`x=300, y=175, w=150, h=168`
- 运行时：`public/assets/characters/modular/shaman/r4-weapon.png`

## catkin/r3-body

- 参考：`public/assets/characters/modular/catkin/r2-body.png`；`public/assets/characters/modular/catkin/base.png`
- 提示词：轻型深绿甲壳短裙、青光缝线、翼形髋甲、猫爪扣与尾部安全开口；不生成猫耳、尾巴或皮肤。
- 原始生成：`C:\Users\Administrator\.codex\generated_images\019fa752-f332-7000-9427-383c1363a451\exec-b69eb968-a84b-4182-a582-52192f40f0f6.png`
- 绿幕：`art-source/characters/modular/catkin/r34-source/r3-body-chroma.png`
- 去绿命令：`python "C:\Users\Administrator\.codex\skills\.system\imagegen\scripts\remove_chroma_key.py" --input "art-source/characters/modular/catkin/r34-source/r3-body-chroma.png" --out "art-source/characters/modular/catkin/r34-source/r3-body-alpha.png" --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill`
- 对位框：`x=163, y=145, w=346, h=388`
- 运行时：`public/assets/characters/modular/catkin/r3-body.png`

## catkin/r3-head

- 参考：`public/assets/characters/modular/catkin/r2-head.png`；`public/assets/characters/modular/catkin/base.png`
- 提示词：小型 V 字猫爪甲壳额饰、青色宝石与短薄翼，严格位于两只猫耳之间；只生成 head 层。
- 原始生成：`C:\Users\Administrator\.codex\generated_images\019fa752-f332-7000-9427-383c1363a451\exec-e1a636dd-63df-4e54-bbb4-78a1c0c8b4a6.png`
- 绿幕：`art-source/characters/modular/catkin/r34-source/r3-head-chroma.png`
- 去绿命令：`python "C:\Users\Administrator\.codex\skills\.system\imagegen\scripts\remove_chroma_key.py" --input "art-source/characters/modular/catkin/r34-source/r3-head-chroma.png" --out "art-source/characters/modular/catkin/r34-source/r3-head-alpha.png" --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill`
- 对位框：`x=268, y=83, w=105, h=50`
- 运行时：`public/assets/characters/modular/catkin/r3-head.png`

## catkin/r3-weapon

- 参考：`public/assets/characters/modular/catkin/r2-weapon.png`；`public/assets/characters/modular/catkin/base.png`
- 提示词：一对深绿甲壳猫爪套，青色短爪与薄翼装饰，左右独立且不含手；只生成 weapon 层。
- 原始生成：`C:\Users\Administrator\.codex\generated_images\019fa752-f332-7000-9427-383c1363a451\exec-c0e44c1c-117e-4c37-8d6a-f47d8dae355d.png`
- 绿幕：`art-source/characters/modular/catkin/r34-source/r3-weapon-chroma.png`
- 去绿命令：`python "C:\Users\Administrator\.codex\skills\.system\imagegen\scripts\remove_chroma_key.py" --input "art-source/characters/modular/catkin/r34-source/r3-weapon-chroma.png" --out "art-source/characters/modular/catkin/r34-source/r3-weapon-alpha.png" --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill`
- 对位框：左爪 `x=145, y=350, w=90, h=124`；右爪 `x=470, y=285, w=115, h=112`
- 运行时：`public/assets/characters/modular/catkin/r3-weapon.png`

## catkin/r4-body

- 参考：`public/assets/characters/modular/catkin/r2-body.png`；`public/assets/characters/modular/catkin/base.png`
- 提示词：月蓝无袖猫装、浅紫短裙、银色月纹、猫爪扣与清晰尾部开口；不生成猫耳、尾巴或皮肤。
- 原始生成：`C:\Users\Administrator\.codex\generated_images\019fa752-f332-7000-9427-383c1363a451\exec-40706a47-76dd-4492-bd6c-a13bf0eb3fa4.png`
- 绿幕：`art-source/characters/modular/catkin/r34-source/r4-body-chroma.png`
- 去绿命令：`python "C:\Users\Administrator\.codex\skills\.system\imagegen\scripts\remove_chroma_key.py" --input "art-source/characters/modular/catkin/r34-source/r4-body-chroma.png" --out "art-source/characters/modular/catkin/r34-source/r4-body-alpha.png" --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill`
- 对位框：`x=163, y=140, w=346, h=393`
- 运行时：`public/assets/characters/modular/catkin/r4-body.png`

## catkin/r4-head

- 参考：`public/assets/characters/modular/catkin/r2-head.png`；`public/assets/characters/modular/catkin/base.png`
- 提示词：细窄银 / 浅紫弯月猫爪额饰，严格位于两耳之间，不重画也不横切猫耳；只生成 head 层。
- 原始生成：`C:\Users\Administrator\.codex\generated_images\019fa752-f332-7000-9427-383c1363a451\exec-b01b49ac-a391-4206-8cc8-2b40516d93ac.png`
- 绿幕：`art-source/characters/modular/catkin/r34-source/r4-head-chroma.png`
- 去绿命令：`python "C:\Users\Administrator\.codex\skills\.system\imagegen\scripts\remove_chroma_key.py" --input "art-source/characters/modular/catkin/r34-source/r4-head-chroma.png" --out "art-source/characters/modular/catkin/r34-source/r4-head-alpha.png" --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill`
- 对位框：`x=270, y=84, w=100, h=34`
- 运行时：`public/assets/characters/modular/catkin/r4-head.png`

## catkin/r4-weapon

- 参考：`public/assets/characters/modular/catkin/r2-weapon.png`；`public/assets/characters/modular/catkin/base.png`
- 提示词：一对月蓝猫爪套，银色弯月甲片、浅紫月晶与三枚短银爪，左右独立且不含手；只生成 weapon 层。
- 原始生成：`C:\Users\Administrator\.codex\generated_images\019fa752-f332-7000-9427-383c1363a451\call_4bJRjP7vD4n01KIgO2DiuLd0.png`
- 绿幕：`art-source/characters/modular/catkin/r34-source/r4-weapon-chroma.png`
- 去绿命令：`python "C:\Users\Administrator\.codex\skills\.system\imagegen\scripts\remove_chroma_key.py" --input "art-source/characters/modular/catkin/r34-source/r4-weapon-chroma.png" --out "art-source/characters/modular/catkin/r34-source/r4-weapon-alpha.png" --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill`
- 对位框：左爪 `x=135, y=355, w=110, h=118`；右爪 `x=470, y=282, w=110, h=120`
- 运行时：`public/assets/characters/modular/catkin/r4-weapon.png`

## QA

- 接触表：`art-source/qa/r34-modular-contact.png`
- 接触表内容：4 职业 × 2 区域 × body/head/weapon，共 24 个「base + 单层」对位格。
- 验收重点：body 不压脸；head 不替换发型，喵喵额饰不切猫耳；weapon 落在手位；喵喵双爪左右分开且裙摆不遮尾。
- 自动校验：24 / 24 为 640×960 RGBA；四角透明；主体非空且不触画布边缘；无高亮纯绿残留；24 个原始 RGBA 哈希全部唯一。
