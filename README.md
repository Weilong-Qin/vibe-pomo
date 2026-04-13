# vibe-pomo 🍅

> You and your agent, both in flow.

[![npm version](https://img.shields.io/npm/v/vibe-pomo)](https://www.npmjs.com/package/vibe-pomo)
[![npm downloads](https://img.shields.io/npm/dm/vibe-pomo)](https://www.npmjs.com/package/vibe-pomo)

<!-- screenshot: dashboard terminal showing active sessions + project stats -->

<!-- README-I18N:START -->

**English** | [中文](./README.zh.md)

<!-- README-I18N:END -->

---

## Why vibe-pomo

Most AI coding tools assume you're always watching — the agent pings you, waits for you, interrupts you. **vibe-pomo flips this.** Start a Pomodoro, hand the agent a task, and step away. Tool calls auto-approved, notifications silenced, decisions queued. When the timer ends, *you* decide when to come back.

Every session is logged — what the agent did, what you did — giving you a clear record across projects.

---

## Installation

**Prerequisites:** Node.js 20+, Claude Code CLI

```bash
npm i -g vibe-pomo
pomodoro install
```

`pomodoro install` registers three Claude Code hooks in `~/.claude/settings.json` and installs the `/pomodoro`, `/pomodoro-stats`, and `/pomodoro-stop` slash commands:

- **PreToolUse** — auto-approves all tool calls during an active session
- **Notification** — silently queues notifications until the timer ends
- **Stop** — holds the agent in place until you end the session

> All three hooks **exit immediately with no effect** when no Pomodoro is active. They won't interfere with any other Claude Code setup or slash command frameworks.

---

## Usage

### 1. Start the daemon (once, keep this terminal open)

```bash
pomodoro daemon
```

```
🍅 Pomodoro  daemon running · 1 active session  [Q] Quit daemon

 Active Sessions
 23:41  my-project      Fix auth bug [3 queued]

 Project Focus Time
 my-project        ████████████████████████████ 4h 25m
 side-project      ███████████░░░░░░░░░░░░░░░░░ 1h 45m

 Recent Sessions
 4/13  my-project    Refactor auth module  28m  completed
         🤖 Rewrote JWT middleware, pending: refresh token expiry strategy
         👤 Read RFC, had planning call with team
 4/13  my-project    Fix payment webhook  18m  completed
         🤖 Found and fixed Stripe signature validation bug
         👤 Coffee, cleared inbox
```

### 2. Start a session

```bash
# From Claude Code (recommended)
/pomodoro 25m Refactor the auth module

# From any terminal
pomodoro start 25m Refactor the auth module
pomodoro start Refactor the auth module    # uses default duration
```

A timer window opens in a new terminal. The agent starts working. You're free.

```
🍅 Pomodoro

                             23:45
                            RUNNING

Task  Refactor the auth module

 Notifications  (3 queued, releasing at overtime…)
┌────────────────────────────────────────────────────────────┐
│  —                                                         │
└────────────────────────────────────────────────────────────┘

[B] Break    [Q] Quit
```

### 3. When the timer ends

The display switches to overtime and queued notifications are released. Press **E** to end the session and log what you did.

```
🍅 Pomodoro

                             +02:13
                            OVERTIME

Task  Refactor the auth module

 Notifications
┌────────────────────────────────────────────────────────────┐
│ 09:42:01  Build passed                                     │
│ 09:42:01  Tests: 42 passed                                 │
└────────────────────────────────────────────────────────────┘

[E] End Session   [B] Break   [Q] Quit
```

The agent's summary and any pending decisions are saved to `.claude/pomodoro-summary.md` and `.claude/pomodoro-pending.md`.

### 4. Review your stats

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

## Configuration

`~/.claude/pomodoro.json` is created on first run:

```json
{
  "defaultDurationMs": 1500000,
  "decisionStrategy": "wait",
  "terminalEmulator": "auto",
  "soundOnOvertime": true
}
```

| Option | Values | Description |
|--------|--------|-------------|
| `defaultDurationMs` | ms | Default session duration (25 min = `1500000`) |
| `decisionStrategy` | `"wait"` / `"break"` | When the agent is blocked: wait silently until you end the session (default), or end immediately |
| `terminalEmulator` | `"auto"` / name | Terminal for the timer window. Auto-detects from `$TERM_PROGRAM`, `$KITTY_WINDOW_ID`, etc. |
| `soundOnOvertime` | bool | Play a sound when the timer hits zero |

---

## Commands

```
pomodoro daemon                  Start daemon + live dashboard
pomodoro start [dur] [task]      Start a session
pomodoro stop                    Break the current session
pomodoro stats                   Show time tracking statistics
pomodoro install                 Register hooks with Claude Code
pomodoro stop-daemon             Stop the global daemon
```

Duration formats: `25m`, `1h`, `90s`, or a plain number (treated as minutes).

---

## Compatibility

vibe-pomo hooks activate only when the daemon is running. When no session is active, all three hooks exit immediately — no output, no side effects. One global daemon handles all your Claude Code projects simultaneously.

---

## License

MIT
