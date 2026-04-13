---
description: Start a Pomodoro focus session — agent works autonomously until timer ends
argument-hint: "[duration e.g. 25m] [task description]"
---

## Step 1: Start the Pomodoro timer

Run the following to start the daemon and open the timer UI:

```bash
/home/qinweilong/.hermes/node/bin/node /home/qinweilong/Pomodoro/bin/pomodoro.mjs start $ARGUMENTS
```

## Step 2: Work autonomously during the focus session

The user has started a Pomodoro focus session and **will not be checking the screen** until the timer ends. Do not interrupt them.

**Task**: $ARGUMENTS

Work on the clearly defined parts of this task:

- Focus only on what is **unambiguously clear** from the task description
- If you encounter something that requires a user decision, **stop and record it** in `.claude/pomodoro-pending.md` — do NOT make assumptions or proceed on the user's behalf
- Do not send notifications or ask questions — the user is in focus mode
- When you have done all you can, write a summary of what was completed and any pending decisions to `.claude/pomodoro-summary.md`
- Then wait quietly — the Pomodoro hook will manage the session lifecycle
