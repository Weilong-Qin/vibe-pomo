/**
 * install.mjs — Register Pomodoro hooks in ~/.claude/settings.json
 *
 * Run once: node install.mjs   or   pomodoro install
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const HOOKS_DIR = join(__dirname, 'src', 'hooks')
const SETTINGS_PATH = join(homedir(), '.claude', 'settings.json')

// Normalize path separators for bash compatibility on Windows.
// Claude Code runs hooks via bash even on Windows, so backslashes must
// become forward slashes. E.g. E:\path\node.exe → E:/path/node.exe
const normPath = (p) => p.replace(/\\/g, '/')

// Quote a path only if it contains spaces.
const q = (p) => { const n = normPath(p); return n.includes(' ') ? `"${n}"` : n }

// The hook script files vibe-pomo owns — used to detect and replace stale entries.
const HOOK_SCRIPTS = ['preToolUse.mjs', 'notification.mjs', 'stop.mjs']

function isVibePomоHook(hookEntry) {
  return hookEntry.hooks?.some((h) =>
    HOOK_SCRIPTS.some((f) => h.command?.includes(f))
  )
}

export function runInstall() {
  // Use 'node' from PATH rather than process.execPath so the command works
  // across all shells (bash, PowerShell, cmd) without platform-specific path issues.
  const nodeCmd = 'node'
  const scriptPath = (name) => q(join(HOOKS_DIR, name))

  const hookDefs = {
    PreToolUse: [{
      matcher: '.*',
      hooks: [{ type: 'command', command: `${nodeCmd} ${scriptPath('preToolUse.mjs')}` }],
    }],
    Notification: [{
      hooks: [{ type: 'command', command: `${nodeCmd} ${scriptPath('notification.mjs')}` }],
    }],
    Stop: [{
      hooks: [{ type: 'command', command: `${nodeCmd} ${scriptPath('stop.mjs')}` }],
    }],
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

  settings.hooks = settings.hooks ?? {}

  // Replace any existing vibe-pomo hooks (removes stale/duplicate entries
  // from previous installs that may have used backslash paths or full node paths).
  for (const [event, defs] of Object.entries(hookDefs)) {
    settings.hooks[event] = (settings.hooks[event] ?? []).filter(
      (entry) => !isVibePomоHook(entry)
    )
    settings.hooks[event].push(...defs)
  }

  writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2) + '\n', 'utf8')
  console.log(`✓ Registered hooks in ${SETTINGS_PATH}`)

  // Also install project-local slash commands
  installSlashCommand()
}

function installSlashCommand() {
  const globalCommandsDir = join(homedir(), '.claude', 'commands')
  mkdirSync(globalCommandsDir, { recursive: true })

  const pomodoroPath = q(join(__dirname, 'bin', 'pomodoro.mjs'))

  const commands = [
    { file: 'pomodoro.md',       content: pomodoroCommand(pomodoroPath) },
    { file: 'pomodoro-stats.md', content: statsCommand(pomodoroPath) },
    { file: 'pomodoro-stop.md',  content: stopCommand(pomodoroPath) },
  ]

  for (const { file, content } of commands) {
    writeFileSync(join(globalCommandsDir, file), content, 'utf8')
    console.log(`✓ Slash command: ~/.claude/commands/${file}`)
  }
}

function pomodoroCommand(pomodoroPath) {
  return `---
description: Start a Pomodoro focus session — agent works autonomously until timer ends
argument-hint: "[duration e.g. 25m] [task description]"
---

## Step 1: Start the Pomodoro timer

\`\`\`bash
node ${pomodoroPath} start $ARGUMENTS
\`\`\`

## Step 2: Work autonomously during the focus session

The user has started a Pomodoro focus session and **will not be checking the screen** until the timer ends. Do not interrupt them.

**Current project**: Check \`\$CLAUDE_PROJECT_DIR\` or run \`pwd\` — work only on files in that directory. Do not reference or modify any other project.

**Task**: $ARGUMENTS

- Focus only on what is **unambiguously clear** from the task description
- If you encounter something that requires a user decision, **stop and record it** in \`.claude/pomodoro-pending.md\` — do NOT make assumptions or proceed on the user's behalf
- Do not send notifications or ask questions — the user is in focus mode
- If a timer UI is available, it may appear as a tmux popup. If not, continue headlessly — do not mention missing timer UI to the user unless they ask
- When you have done all you can, write a summary to \`.claude/pomodoro-summary.md\`
- Then wait quietly — the Pomodoro hook will manage the session lifecycle
`
}

function statsCommand(pomodoroPath) {
  return `---
description: Show Pomodoro time tracking statistics
---

Run the following command and display the output to the user:

\`\`\`bash
node ${pomodoroPath} stats
\`\`\`
`
}

function stopCommand(pomodoroPath) {
  return `---
description: Break (stop) the current Pomodoro session
---

Run the following command to break the active Pomodoro session:

\`\`\`bash
node ${pomodoroPath} stop
\`\`\`

Then confirm to the user that the session has been stopped.
`
}

// Run directly if called as script
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runInstall()
}
