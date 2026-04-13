# vibe-pomo 🍅

> You and your agent, both in flow.

[![npm version](https://img.shields.io/npm/v/vibe-pomo)](https://www.npmjs.com/package/vibe-pomo)
[![npm downloads](https://img.shields.io/npm/dm/vibe-pomo)](https://www.npmjs.com/package/vibe-pomo)

<!-- screenshot: dashboard terminal showing active sessions + project stats -->

<!-- README-I18N:START -->

**English** | [汉语](./README.zh.md)

<!-- README-I18N:END -->

---

## Why vibe-pomo

Most AI coding tools are built around one assumption: you're always watching. Every tool call, every decision, every completion — the agent pings you, waits for you, interrupts you. Each exchange is small, but the cumulative cost is enormous: you never get more than a few minutes of unbroken attention.

**vibe-pomo flips this.** Start a Pomodoro, hand the agent a task, and step away. The agent works autonomously — notifications silenced, decisions queued, no interruptions. When the timer ends, *you* decide when to come back. Not the agent.

**Deep focus, on both sides.**
Block out distraction-free time for yourself while the agent runs its own uninterrupted work session. No context switches. No reactive loops. Just two parallel flows converging when you're ready.

**Know where your time goes.**
Every session is logged with what the agent accomplished and what you worked on. Review per-project focus time, browse session history, and see exactly how your hours were spent — a clear record for personal retrospectives and project planning.

---

## How It Works

Two terminals, two roles:

```
Terminal A — daemon (always open)       Terminal B — Claude Code conversation
─────────────────────────────────       ───────────────────────────────────────
$ pomodoro daemon                       /pomodoro 25m Fix auth bug
                                                   |
  🍅 Pomodoro  daemon running                      +---> Timer window opens
                                                         Agent starts working
  Active Sessions                                        Notifications silenced
   23:41  my-project  Fix auth bug                       Tool calls auto-approved

  Project Focus Time
   my-project  ████████████░░  3h 45m

  Recent Sessions
   my-project  Fix auth bug
    🤖 Rewrote JWT middleware
    👤 Had a planning call
```

```
Timer window (per session)
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

When the timer ends, queued notifications are released and you're prompted to log what *you* did during that time:

```
What did you do during this session?
(optional — press Enter to skip)

> Reviewed the RFC, had a planning call with the team
```

This gets saved alongside the agent's summary, giving you a dual-perspective record of every session.

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

Shows a live dashboard: active sessions with countdowns, per-project focus time, and recent session history.

### 2. Start a session

```bash
# From Claude Code (recommended)
/pomodoro 25m Refactor the auth module

# From any terminal
pomodoro start 25m Refactor the auth module
pomodoro start Refactor the auth module    # uses default duration
```

A timer window opens. The agent starts working. You're free.

### 3. During the session

The agent works autonomously — tool calls approved, notifications queued, decisions logged. You can check in from Claude Code without exiting:

```
/pomodoro-stats    view time tracking statistics
/pomodoro-stop     break the current session
```

### 4. When the timer ends

Timer switches to overtime. Queued notifications appear. Press **E** to end, log what you did, then review the agent's summary and any pending decisions in `.claude/pomodoro-summary.md` and `.claude/pomodoro-pending.md`.

### 5. Review your stats

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
