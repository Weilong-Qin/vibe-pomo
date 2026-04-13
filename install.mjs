/**
 * install.mjs — Register Pomodoro hooks in ~/.claude/settings.json
 *
 * Run once: node install.mjs   or   pomodoro install
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const __dirname = dirname(fileURLToPath(import.meta.url))
const HOOKS_DIR = join(__dirname, 'src', 'hooks')
const SETTINGS_PATH = join(homedir(), '.claude', 'settings.json')

export function runInstall() {
  const nodeExec = process.execPath
  // On Windows, backslashes in paths break bash (used by Claude Code hooks).
  // Convert to forward slashes, which work in both cmd/PowerShell and Git Bash.
  const normPath = (p) => p.replace(/\\/g, '/')
  const q = (p) => { const n = normPath(p); return n.includes(' ') ? `"${n}"` : n }

  const hookDefs = {
    PreToolUse: [
      {
        matcher: '.*',
        hooks: [{
          type: 'command',
          command: `${q(nodeExec)} ${q(join(HOOKS_DIR, 'preToolUse.mjs'))}`,
        }],
      },
    ],
    Notification: [
      {
        hooks: [{
          type: 'command',
          command: `${q(nodeExec)} ${q(join(HOOKS_DIR, 'notification.mjs'))}`,
        }],
      },
    ],
    Stop: [
      {
        hooks: [{
          type: 'command',
          command: `${q(nodeExec)} ${q(join(HOOKS_DIR, 'stop.mjs'))}`,
        }],
      },
    ],
  }

  // Read existing settings
  let settings = {}
  if (existsSync(SETTINGS_PATH)) {
    try {
      settings = JSON.parse(readFileSync(SETTINGS_PATH, 'utf8'))
    } catch {
      console.error(`Could not parse ${SETTINGS_PATH}. Aborting.`)
      process.exit(1)
    }
  } else {
    mkdirSync(dirname(SETTINGS_PATH), { recursive: true })
  }

  // Merge hooks — avoid duplicates by checking command paths
  settings.hooks = settings.hooks ?? {}

  let added = 0
  for (const [event, defs] of Object.entries(hookDefs)) {
    settings.hooks[event] = settings.hooks[event] ?? []
    for (const def of defs) {
      const commandToAdd = def.hooks[0].command
      const alreadyRegistered = settings.hooks[event].some(
        (existing) => existing.hooks?.some((h) => h.command === commandToAdd)
      )
      if (!alreadyRegistered) {
        settings.hooks[event].push(def)
        added++
      }
    }
  }

  writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2) + '\n', 'utf8')

  if (added > 0) {
    console.log(`✓ Registered ${added} hook(s) in ${SETTINGS_PATH}`)
  } else {
    console.log(`Hooks already registered in ${SETTINGS_PATH}`)
  }

  // Also install project-local slash command
  installSlashCommand()
}

function installSlashCommand() {
  const globalCommandsDir = join(homedir(), '.claude', 'commands')
  mkdirSync(globalCommandsDir, { recursive: true })

  const commands = [
    { file: 'pomodoro.md',       writer: writePomodoroCommand },
    { file: 'pomodoro-stats.md', writer: writeStatsCommand },
    { file: 'pomodoro-stop.md',  writer: writeStopCommand },
  ]

  for (const { file, writer } of commands) {
    const dest = join(globalCommandsDir, file)
    writer(dest)
    console.log(`✓ Slash command: ~/.claude/commands/${file}`)
  }
}

function writePomodoroCommand(dest) {
  const pomodoroPath = join(__dirname, 'bin', 'pomodoro.mjs')
  const nodeExec = process.execPath
  const normPath = (p) => p.replace(/\\/g, '/')
  const q = (p) => { const n = normPath(p); return n.includes(' ') ? `"${n}"` : n }
  writeFileSync(dest, `---
description: Start a Pomodoro focus session — agent works autonomously until timer ends
argument-hint: "[duration e.g. 25m] [task description]"
---

## Step 1: Start the Pomodoro timer

\`\`\`bash
${q(nodeExec)} ${q(pomodoroPath)} start $ARGUMENTS
\`\`\`

## Step 2: Work autonomously during the focus session

The user has started a Pomodoro focus session and **will not be checking the screen** until the timer ends. Do not interrupt them.

**Task**: $ARGUMENTS

- Focus only on what is **unambiguously clear** from the task description
- If you encounter something that requires a user decision, **stop and record it** in \`.claude/pomodoro-pending.md\` — do NOT make assumptions or proceed on the user's behalf
- Do not send notifications or ask questions — the user is in focus mode
- When you have done all you can, write a summary to \`.claude/pomodoro-summary.md\`
- Then wait quietly — the Pomodoro hook will manage the session lifecycle
`, 'utf8')
}

function writeStatsCommand(dest) {
  const pomodoroPath = join(__dirname, 'bin', 'pomodoro.mjs')
  const nodeExec = process.execPath
  const normPath = (p) => p.replace(/\\/g, '/')
  const q = (p) => { const n = normPath(p); return n.includes(' ') ? `"${n}"` : n }
  writeFileSync(dest, `---
description: Show Pomodoro time tracking statistics
---

Run the following command and display the output to the user:

\`\`\`bash
${q(nodeExec)} ${q(pomodoroPath)} stats
\`\`\`
`, 'utf8')
}

function writeStopCommand(dest) {
  const pomodoroPath = join(__dirname, 'bin', 'pomodoro.mjs')
  const nodeExec = process.execPath
  const normPath = (p) => p.replace(/\\/g, '/')
  const q = (p) => { const n = normPath(p); return n.includes(' ') ? `"${n}"` : n }
  writeFileSync(dest, `---
description: Break (stop) the current Pomodoro session
---

Run the following command to break the active Pomodoro session:

\`\`\`bash
${q(nodeExec)} ${q(pomodoroPath)} stop
\`\`\`

Then confirm to the user that the session has been stopped.
`, 'utf8')
}

// Run directly if called as script
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runInstall()
}
