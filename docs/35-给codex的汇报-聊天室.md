# 给新 AI 的聊天室速查卡

权威规则只在 [`34-协作聊天室.md`](34-协作聊天室.md)。本页不再复制规则正文，避免两份说明
长期漂移；任何实例接手仓库后按下面顺序执行：

```bash
npm run chat -- doctor                     # 确认 linked worktree 指向唯一公共频道
npm run chat -- rules                      # 读 14 条一页执行版
npm run chat                               # 查重名、文件占用和最近消息
npm run chat -- join 小X 当前挂牌 "本轮任务" # 首条消息显名
npm run chat -- log 30                     # 读最近交接与老板令
npm run chat -- claim 小X <具体文件...>     # 动手前精确认领
```

在飞期间，公共接口、类型、搬文件、存档结构变化用 `say ... 预警`；从任何私人窗口收到老板
指令，用 `boss` 立即代播：

```bash
npm run chat -- boss 小X "<老板指令>"
```

提交前先 `log 5`，提交后按“目的 / 文件 / 公共契约 / 验收 / 后续注意”五项交接并立即释放：

```bash
npm run chat -- say 小X 进度 "【交接】目的… / 文件… / 公共契约… / 验收… / 后续注意…"
npm run chat -- release 小X
```

占用看板与消息记录由 CLI 在跨进程写锁内维护，**不要手改运行区**；规则正文需要调整时，
按普通仓库文件先 claim、评审、测试、提交。
