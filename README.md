# vibe-pomo 🍅

> You and your agent, both in flow.

Most AI coding tools are built around one assumption: you're always watching. Every tool call, every decision, every completion — the agent pings you, waits for you, interrupts you.

**vibe-pomo flips this.** Start a Pomodoro, hand the agent a task, and walk away. The agent works autonomously. Notifications are silenced. Decisions that require you are queued, not thrown at you mid-thought. When the timer ends, *you* decide when to come back — not the agent.

The result: uninterrupted stretches of time where both you and your agent are in flow, doing their best work independently, syncing up on your terms.

---

<!-- screenshot: dashboard terminal showing active sessions + project stats -->

## Philosophy

Modern deep work is constantly threatened by reactive loops — you ask the AI something, it asks something back, you respond, it responds. Each exchange is small, but the cumulative cost is enormous: you never get more than a few minutes of unbroken attention.

vibe-pomo is built on a different model:

- **Batch, don't stream.** Agent outputs accumulate during the session. You process them all at once when you're ready, not one by one as they arrive.
- **Protect the human's time.** If the agent finishes early, it waits. If it hits a decision point, it records it and waits. It does not interrupt.
- **Trust, then verify.** The agent handles what's clear. Anything ambiguous gets flagged in `.claude/pomodoro-pending.md` for you to review at session end.
- **Both sides get flow.** The agent isn't context-switching either — it runs a full uninterrupted work session, which tends to produce better results than stop-start interaction.

---

## How It Works

```
Terminal A (always open)          Terminal B (Claude Code)
────────────────────────          ────────────────────────
$ pomodoro daemon                 /pomodoro 25m Fix auth bug
                                        │
🍅 Pomodoro · 1 active session          └─► Timer window opens
                                            Agent starts working
 Active Sessions                            Notifications silenced
  23:41  my-project  Fix auth bug           Tool calls auto-approved

 Project Focus Time
 my-project  ████████████░░  3h 45m

 Recent Sessions                  [Timer window]
 my-project  Fix auth bug  ────────────────────────────────
   🤖 Refactored JWT middleware    🍅 Pomodoro
   👤 Read system design docs
                                   +02:13  OVERTIME

                                   Task: Fix auth bug

                                   ┌─ Notifications ──────┐
                                   │ Build passed          │
                                   │ Tests: 42 passed      │
                                   └──────────────────────┘

                                   [E] End Session  [Q] Quit
```

When the timer hits zero, it doesn't stop — it switches to **overtime mode** (`+00:01`, `+00:02`...), releases the queued notifications, and waits for *you* to press End. No forced interruptions.

At session end, you're prompted:

```
你在这个番茄钟里做了什么？
（可不填，直接 Enter 跳过）

› Reviewed design docs, had a planning call
```

This gets saved alongside the agent's own summary, giving you a full picture of each session when you review your stats.

---

## Installation

### Prerequisites

- Node.js 20+
- Claude Code CLI

### Install

```bash
npm install -g vibe-pomo
```

### Register hooks with Claude Code

```bash
pomodoro install
```

This registers three Claude Code hooks globally (`~/.claude/settings.json`) and installs the `/pomodoro`, `/pomodoro-stats`, and `/pomodoro-stop` slash commands:

- **PreToolUse** — auto-approves all tool calls during an active session
- **Notification** — silently queues notifications until the timer ends
- **Stop** — blocks the agent from completing until you end the session

> These hooks are **completely transparent** when no Pomodoro is active. They exit immediately with no effect, so they won't interfere with any other Claude Code workflows or slash command frameworks.

---

## Usage

### 1. Start the daemon (once, in a dedicated terminal)

```bash
pomodoro daemon
```

Keep this terminal open. It runs the global daemon and shows a live dashboard: active sessions with countdowns, project focus time, and recent session history.

### 2. Start a session (from Claude Code or any terminal)

```bash
# In Claude Code — the recommended way
/pomodoro 25m Refactor the auth module

# Or directly from any terminal
pomodoro start 25m Refactor the auth module
pomodoro start Refactor the auth module   # uses default duration (25m)
pomodoro start 45m                        # no task description
```

A timer window opens automatically. The agent starts working. You're free.

### 3. During the session

The agent works autonomously:
- All tool calls are auto-approved
- Notifications are queued (released when the timer ends)
- If the agent finishes early, it waits quietly
- Decision points get logged to `.claude/pomodoro-pending.md`

You can check in from Claude Code without exiting:
```
/pomodoro-stats    show time tracking statistics
/pomodoro-stop     break the current session
```

### 4. When the timer ends

The timer switches to overtime. Queued notifications appear in the timer window. Press **E** to end the session — you'll be prompted to log what you did during that time. Then review the agent's summary and any pending decisions.

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

4/13  my-project   Fix payment webhook        18m  completed
  🤖  Found and fixed Stripe signature validation bug
  👤  Coffee, cleared inbox
```

---

## Configuration

On first run, `~/.claude/pomodoro.json` is created with defaults:

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
| `decisionStrategy` | `"wait"` / `"break"` | What to do when the agent is blocked: wait silently (default) or end the session immediately |
| `terminalEmulator` | `"auto"` / name | Terminal to use for timer window. Auto-detects from `$TERM_PROGRAM`, `$KITTY_WINDOW_ID`, etc. |
| `soundOnOvertime` | bool | Play a sound when the timer hits zero |

---

## Commands

```
pomodoro daemon                  Start daemon + live dashboard
pomodoro start [dur] [task]      Start a session (connects to daemon)
pomodoro stop                    Break the current session
pomodoro stats                   Show time tracking statistics
pomodoro install                 Register hooks in ~/.claude/settings.json
pomodoro stop-daemon             Stop the global daemon
```

Duration format: `25m`, `1h`, `90s`, or a plain number (minutes).

---

## Compatibility

vibe-pomo hooks are registered globally but only activate when the daemon is running. When no session is active, all three hooks **exit 0 immediately** — no output, no side effects. This makes vibe-pomo compatible with any other Claude Code setup:

- Works alongside other slash command frameworks (`superpowers`, `get-shit-done`, etc.)
- Won't interfere with existing `PreToolUse`, `Notification`, or `Stop` hooks
- The daemon is global — one instance handles all your Claude Code projects simultaneously

---

## License

MIT
