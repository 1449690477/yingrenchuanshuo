# 纸箱键帽摸鱼套 · ImageGen 生产记录

生成模式：Codex 内置 ImageGen（identity-preserve / stylized game asset），统一先生成
纯 `#00FF00` 绿幕，再使用系统 `remove_chroma_key.py` 的 `--soft-matte --despill`
输出透明母版。运行时文件由 `npm run assets:catkin-cardboard` 确定性重建。

## 整身母版

以 `public/assets/characters/modular/catkin/base.png` 为身份与构图参考，严格保留成年猫灵、
焦糖短发、奶油猫耳、蓝眼、双颊蓝泪滴、尾巴、全身姿势和 2:3 画布；只替换为奶油白 /
深海军蓝 / 樱粉配色的机动工装，加入纸箱小包、键帽细节、肉球腰扣、紧身裤和猫爪短靴。
猫耳、额头、双眼与脸颊必须完全无遮挡；不生成帽子、武器、文字、水印或裁切。

## 双爪母版

以 `public/assets/characters/modular/shop/berry-cream/catkin-weapon.png` 为双手位置与旋转参考，
保持 640×960 同画布的左右双爪包围盒，改造为深蓝奶油色肉球手套、樱粉束带与半透明
天蓝键帽晶爪；只生成两个互不相连的武器主体，不生成人物、手臂或背景物件。

## 攻击特效母版

以键帽晶爪为配色参考，生成六道天蓝交错爪痕、中央粉色肉球冲击、纸箱碎屑和键帽光块；
要求 80px 下仍能读出剪影，四周留透明安全边距，不生成角色、武器本体、文字或地面阴影。
