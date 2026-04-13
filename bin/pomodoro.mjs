#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { readLock, removeLock } from '../src/shared/lockfile.mjs'
import { sendAndReceive } from '../src/shared/ipcClient.mjs'
import { loadConfig, parseDuration, ensureConfigFile } from '../src/shared/config.mjs'
import { MSG, DECISION } from '../src/shared/protocol.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const isWin = process.platform === 'win32'
const TSX = join(ROOT, 'node_modules', '.bin', isWin ? 'tsx.cmd' : 'tsx')

const [,, cmd, ...args] = process.argv

const HELP = `Usage: pomodoro <command> [options]

Commands:
  daemon                           Start daemon + live dashboard (run this first)
  start [duration] [task...]       Start a Pomodoro session
  stop [sessionId]                 Break the current (or specified) session
  stats                            Show time tracking statistics
  install                          Register hooks in ~/.claude/settings.json
  stop-daemon                      Stop the global daemon

Examples:
  pomodoro daemon                  (keep this terminal open)
  pomodoro start 25m Fix login bug
  pomodoro start Fix login bug     (uses default 25m)
  pomodoro stop
  pomodoro stats
`

const COMMANDS = {
  daemon:        cmdDaemon,
  start:         cmdStart,
  stop:          cmdStop,
  stats:         cmdStats,
  stat:          cmdStats,    // alias
  install:       cmdInstall,
  'stop-daemon': cmdStopDaemon,
}

const handler = COMMANDS[cmd]
if (!handler) {
  process.stdout.write(HELP)
  process.exit(cmd ? 1 : 0)
}
await handler(args)

// ── Commands ──────────────────────────────────────────────────────────────────

async function cmdDaemon() {
  // Launch dashboard TUI (which also starts the daemon in-process)
  const dashboardEntry = join(ROOT, 'src', 'tui', 'dashboard', 'index.tsx')
  const child = spawn(TSX, [dashboardEntry], { stdio: 'inherit', shell: isWin })
  child.on('exit', (code) => process.exit(code ?? 0))
}

async function cmdStart(args) {
  ensureConfigFile()
  const config = loadConfig()

  const lock = readLock()
  if (!lock) {
    console.error('Pomodoro daemon is not running.')
    console.error('Start it first with: pomodoro daemon')
    process.exit(1)
  }

  // Parse optional leading duration, rest is task
  let durationMs = config.defaultDurationMs
  let taskParts = [...args]

  if (taskParts[0] && !taskParts[0].startsWith('-')) {
    const parsed = parseDuration(taskParts[0])
    if (parsed) { durationMs = parsed; taskParts.shift() }
  }
  const task = taskParts.join(' ')

  const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd()

  let resp
  try {
    resp = await sendAndReceive({
      type: MSG.SESSION_CREATE,
      projectDir,
      task,
      plannedMs: durationMs,
      decisionStrategy: config.decisionStrategy,
    })
  } catch {
    console.error('Could not reach daemon. Is `pomodoro daemon` running?')
    process.exit(1)
  }

  if (resp.error) {
    console.error('Error:', resp.error)
    process.exit(1)
  }

  console.log(`Session started (${formatMs(durationMs)})`)
  if (task) console.log(`Task: ${task}`)

  // If running inside Claude Code, start a PPID watcher for auto-break on exit
  if (isInsideClaudeCode()) {
    spawnWatcher(resp.sessionId)
  }

  // Only launch an interactive timer UI when we can safely cover the current
  // Claude Code pane with a tmux popup. Otherwise stay headless and let the
  // daemon/dashboard own visualization so the conversation flow is not disturbed.
  const timerEntry = join(ROOT, 'src', 'tui', 'timer', 'index.tsx')
  await launchTerminal({
    tsx: TSX,
    entryFile: timerEntry,
    sessionId: resp.sessionId,
    termPref: config.terminalEmulator,
  })
}

async function cmdStop(args) {
  const lock = readLock()
  if (!lock) { console.log('No daemon running.'); process.exit(0) }

  // If sessionId given, stop that session; otherwise stop first active
  let sessionId = args[0]
  if (!sessionId) {
    let state
    try { state = await sendAndReceive({ type: MSG.QUERY }) } catch {
      console.error('Daemon unreachable.')
      process.exit(1)
    }
    const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd()
    const active = state.sessions?.find((s) => s.projectDir === projectDir)
      ?? state.sessions?.[0]
    if (!active) { console.log('No active sessions.'); process.exit(0) }
    sessionId = active.sessionId
  }

  try {
    await sendAndReceive({ type: MSG.SESSION_BREAK, sessionId })
    console.log('Session broken.')
  } catch {
    console.error('Could not reach daemon.')
  }
}

async function cmdStats() {
  const lock = readLock()
  if (!lock) {
    // Show static stats from DB
    const { printStats } = await import('../src/daemon/db.mjs')
    printStats()
    return
  }
  // Launch the dashboard in read-only mode (connect to existing daemon)
  // For now, print stats — a full "attach to dashboard" is future work
  const { printStats } = await import('../src/daemon/db.mjs')
  printStats()
}

async function cmdInstall() {
  const { runInstall } = await import('../install.mjs')
  runInstall()
}

async function cmdStopDaemon() {
  const lock = readLock()
  if (!lock) { console.log('No daemon running.'); process.exit(0) }
  try {
    process.kill(lock.pid, 'SIGTERM')
    removeLock()
    console.log('Daemon stopped.')
  } catch {
    removeLock()
    console.log('Daemon was already stopped; lock cleaned up.')
  }
}

// ── Terminal launch helpers ───────────────────────────────────────────────────

async function launchTerminal({ tsx, entryFile, sessionId, termPref }) {
  const mode = resolveTimerMode(termPref)
  if (mode === 'none') return false
  return trySpawn(mode, tsx, entryFile, sessionId)
}

function resolveTimerMode(termPref) {
  const pref = termPref ?? 'auto'
  if (pref === 'none' || pref === 'headless') return 'none'
  if ((pref === 'auto' || pref === 'tmux' || pref === 'tmux-popup') && process.env.TMUX) {
    return 'tmux-popup'
  }
  if ((pref === 'auto' || pref === 'kitty' || pref === 'kitty-overlay') && process.env.KITTY_WINDOW_ID) {
    return 'kitty-overlay'
  }
  return 'none'
}

function buildCmd(term, tsx, entryFile, sessionId) {
  switch (term) {
    case 'tmux-popup':     return buildTmuxPopupCmd(tsx, entryFile, sessionId)
    case 'kitty-overlay':  return buildKittyOverlayCmd(tsx, entryFile, sessionId)
    default:               return null
  }
}

function trySpawn(term, tsx, entryFile, sessionId) {
  const cmd = buildCmd(term, tsx, entryFile, sessionId)
  if (!cmd) return Promise.resolve(false)
  return new Promise((resolve) => {
    let done = false
    try {
      const child = spawn(cmd[0], cmd.slice(1), { detached: true, stdio: 'ignore', shell: isWin })
      child.on('error', () => { if (!done) { done = true; resolve(false) } })
      child.on('spawn', () => { if (!done) { done = true; child.unref(); resolve(true) } })
      setTimeout(() => { if (!done) { done = true; child.unref(); resolve(true) } }, 300)
    } catch { resolve(false) }
  })
}

function isInsideClaudeCode() {
  // Claude Code sets CLAUDE_PROJECT_DIR; also check for CLAUDE_CODE_ENTRYPOINT
  return !!(process.env.CLAUDE_PROJECT_DIR || process.env.CLAUDE_CODE_ENTRYPOINT)
}

function spawnWatcher(sessionId) {
  const watcherPath = join(ROOT, 'src', 'watcher.mjs')
  const watchPid = getWatchPid()
  const child = spawn(process.execPath, [watcherPath, String(watchPid), sessionId], {
    detached: true,
    stdio: 'ignore',
  })
  child.unref()
}

function buildTmuxPopupCmd(tsx, entryFile, sessionId) {
  const timerCmd = [
    'POMODORO_MODAL=1',
    shellQuote(process.execPath),
    shellQuote(tsx),
    shellQuote(entryFile),
    shellQuote(sessionId),
  ].join(' ')

  return [
    'tmux',
    'display-popup',
    '-E',
    '-w', '100%',
    '-h', '100%',
    '-x', '0',
    '-y', '0',
    '-B',
    '-T', 'Pomodoro',
    `bash -lc ${shellQuote(timerCmd)}`,
  ]
}

function buildKittyOverlayCmd(tsx, entryFile, sessionId) {
  return [
    'kitty',
    '@',
    'launch',
    '--type=overlay-main',
    '--cwd=current',
    '--title=Pomodoro',
    '--env=POMODORO_MODAL=1',
    process.execPath,
    tsx,
    entryFile,
    sessionId,
  ]
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`
}

function getWatchPid() {
  if (isWin) return process.ppid

  try {
    const out = execFileSync('ps', ['-o', 'ppid=', '-p', String(process.ppid)], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    const ppid = Number.parseInt(out, 10)
    if (Number.isInteger(ppid) && ppid > 1) return ppid
  } catch {}

  return process.ppid
}

function formatMs(ms) {
  const m = Math.floor(ms / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}
