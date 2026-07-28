# 洗练系统美术生产索引

本目录保留 10 张运行时素材对应的原始绿幕母图、提示词与可复建命令。

- 四职业徽记、同调结晶：见 `PROMPTS-SIGILS.md`
- 凝晶砂、定契符与三张洗练特效：见 `PROMPTS-MATERIALS-EFFECTS.md`

全部母图使用纯 `#00ff00` 绿幕，运行时 PNG 统一通过 ImageGen 技能附带的
`remove_chroma_key.py` 去背；材料图标输出为 256×256 RGBA，特效输出为
512×512 RGBA。禁止直接把绿幕母图放入 `public/`。

完整复建命令、抠图参数和逐张生成提示词均记录在上述两个分卷中。
