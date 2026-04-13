# vibe-pomo 🍅

> 你和你的 AI 代理，同时进入心流。

<!-- screenshot: dashboard terminal showing active sessions + project stats -->

<!-- README-I18N:START -->

[English](./README.md) | **中文**

<!-- README-I18N:END -->

---

## 为什么选择 vibe-pomo

大多数 AI 编码工具都建立在一个假设上：你始终在旁边盯着。每一次工具调用、每一个决策、每一次完成——代理 ping 你、等你、打断你。每次交互看似微小，但累积起来代价巨大：你从未能获得超过几分钟的不间断专注。

**vibe-pomo 反转了这一切。** 启动一个番茄钟，把任务交给代理，然后离开。代理自主工作——通知静音、决策排队、零打扰。计时结束后，由*你*决定何时回来，而不是代理。

**双向深度专注。**
为自己屏蔽干扰，让代理同时运行不间断的工作会话。没有上下文切换，没有被动响应循环。两条并行的心流，在你准备好时汇聚。

**清楚地知道时间去哪了。**
每次会话都会记录代理完成的工作以及你自己做的事情。查看每个项目的专注时间、浏览会话历史，精确了解时间的流向——为个人复盘和项目规划提供清晰的记录。

---

## 工作原理

两个终端，两个角色：

```
终端 A — 守护进程（保持打开）        终端 B — Claude Code 对话
─────────────────────────────────    ───────────────────────────────────────
$ pomodoro daemon                    /pomodoro 25m Fix auth bug
                                                |
  🍅 Pomodoro  daemon running                   +---> 计时器窗口打开
                                                      代理开始工作
  Active Sessions                               通知静音
   23:41  my-project  Fix auth bug              工具调用自动批准

  Project Focus Time
   my-project  ████████████░░  3h 45m

  Recent Sessions
   my-project  Fix auth bug
    🤖 Rewrote JWT middleware
    👤 Had a planning call
```

```
计时器窗口（每个会话）
──────────────────────────────────
  🍅 Pomodoro

        +02:13  OVERTIME

  Task: Fix auth bug

  Notifications
  ┌──────────────────────────────┐
  │ Build passed                 │
  │ Tests: 42 passed             │
  └──────────────────────────────┘

  [E] End Session   [B] Break   [Q] Quit
```

计时结束后，排队的通知会被释放，并提示你记录在此期间*你*做了什么：

```
What did you do during this session?
(optional — press Enter to skip)

> Reviewed the RFC, had a planning call with the team
```

这条记录会与代理的总结一同保存，为每次会话提供双视角记录。

---

## 安装

**前置条件：** Node.js 20+、Claude Code CLI

```bash
npm install -g vibe-pomo
pomodoro install
```

`pomodoro install` 会在 `~/.claude/settings.json` 中注册三个 Claude Code 钩子，并安装 `/pomodoro`、`/pomodoro-stats` 和 `/pomodoro-stop` 斜杠命令：

- **PreToolUse** — 在会话期间自动批准所有工具调用
- **Notification** — 静默排队通知，直到计时结束
- **Stop** — 在会话结束前让代理保持等待状态

> 这三个钩子在**没有活跃番茄钟时会立即退出且无任何效果**，不会干扰其他任何 Claude Code 配置或斜杠命令框架。

---

## 使用方法

### 1. 启动守护进程（一次，保持该终端打开）

```bash
pomodoro daemon
```

显示实时仪表板：带倒计时的活跃会话、各项目专注时间及最近会话历史。

### 2. 开始一个会话

```bash
# 在 Claude Code 中（推荐）
/pomodoro 25m Refactor the auth module

# 在任意终端中
pomodoro start 25m Refactor the auth module
pomodoro start Refactor the auth module    # 使用默认时长
```

如果 Claude Code 跑在 `tmux` 里，vibe-pomo 会在当前 pane 上弹出一个覆盖式 popup，把正在进行的任务界面盖住，直到你结束或中断番茄钟。非 `tmux` 环境下则回退到单独的计时器终端窗口。

### 3. 会话进行中

代理自主工作——工具调用自动批准、通知排队、决策记录。你可以在不退出的情况下通过 Claude Code 查看进度：

```
/pomodoro-stats    查看时间追踪统计
/pomodoro-stop     中断当前会话
```

### 4. 计时结束后

计时器切换为超时模式，排队的通知显示出来。按 **E** 结束会话，记录你的工作内容，然后在 `.claude/pomodoro-summary.md` 和 `.claude/pomodoro-pending.md` 中查看代理的总结及待处理决策。

### 5. 查看统计数据

```bash
pomodoro stats
```

```
Project Focus Time
──────────────────────────────────────────────────────────────────
my-project      ████████████████░░░░░░░░░░░░░░    4h 20m
side-project    ██████░░░░░░░░░░░░░░░░░░░░░░░░    1h 45m

Recent Sessions
──────────────────────────────────────────────────────────────────
4/13  my-project   Refactor auth module      28m  completed
  🤖  Rewrote JWT middleware, pending: refresh token expiry strategy
  👤  Read RFC, had planning call with team

4/13  my-project   Fix payment webhook       18m  completed
  🤖  Found and fixed Stripe signature validation bug
  👤  Coffee, cleared inbox
```

---

## 配置

首次运行时会创建 `~/.claude/pomodoro.json`：

```json
{
  "defaultDurationMs": 1500000,
  "decisionStrategy": "wait",
  "terminalEmulator": "auto",
  "soundOnOvertime": true
}
```

| 选项 | 取值 | 说明 |
|------|------|------|
| `defaultDurationMs` | 毫秒数 | 默认会话时长（25 分钟 = `1500000`） |
| `decisionStrategy` | `"wait"` / `"break"` | 代理被阻塞时的策略：静默等待直到你结束会话（默认），或立即结束 |
| `terminalEmulator` | `"auto"` / `"tmux"` / `"tmux-window"` / 名称 | 计时器展示方式。`"tmux"` 打开覆盖式 popup，`"tmux-window"` 使用新的 tmux window，`"auto"` 在检测到 `$TMUX` 时优先使用 popup |
| `soundOnOvertime` | 布尔值 | 计时归零时播放提示音 |

---

## 命令

```
pomodoro daemon                  启动守护进程及实时仪表板
pomodoro start [dur] [task]      开始一个会话
pomodoro stop                    中断当前会话
pomodoro stats                   显示时间追踪统计
pomodoro install                 向 Claude Code 注册钩子
pomodoro stop-daemon             停止全局守护进程
```

时长格式：`25m`、`1h`、`90s`，或纯数字（按分钟处理）。

---

## 兼容性

vibe-pomo 的钩子仅在守护进程运行时激活。没有活跃会话时，三个钩子均立即退出——无输出、无副作用。一个全局守护进程可同时处理你所有的 Claude Code 项目。

---

## 许可证

MIT
