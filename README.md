# vibe-pomo 🍅

> You and your agent, both in flow.

<!-- screenshot: dashboard terminal showing active sessions + project stats -->

---

## Why vibe-pomo

Most AI coding tools are built around one assumption: you're always watching. Every tool call, every decision, every completion — the agent pings you, waits for you, interrupts you. Each exchange is small, but the cumulative cost is enormous: you never get more than a few minutes of unbroken attention.

**vibe-pomo flips this.** Start a Pomodoro, hand the agent a task, and step away. Do whatever you need to do — work on something else, take a walk, have a meeting. The agent runs uninterrupted. Notifications are silenced. If it finishes early, it waits. If it hits a decision point, it records it and waits. It does not interrupt.

When the timer ends, *you* decide when to come back. Not the agent.

- **Batch, don't stream.** Agent outputs accumulate during the session. You review them all at once, on your terms.
- **Protect attention.** No mid-thought pings. No context switches. Just a clean block of unbroken time.
- **Trust, then verify.** The agent handles what's clear. Anything ambiguous gets flagged in `.claude/pomodoro-pending.md` for you to review at session end.
- **Both sides get flow.** The agent runs a full uninterrupted work session too — which tends to produce better results than stop-start interaction.

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

When the timer hits zero, it switches to **overtime mode** (`+00:01`, `+00:02`...), releases the queued notifications, and waits for you to press **E**. No forced cutoffs.

At session end, you're prompted to log what *you* did during that time:

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
npm install -g vibe-pomo
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

vibe-pomo hooks activate only when the daemon is running. When no session is active, all three hooks exit immediately — no output, no side effects. One global daemon handles all your projects simultaneously.

Works alongside any other Claude Code setup: `superpowers`, `get-shit-done`, or any custom slash command framework.

---

## License

MIT
