/**
 * Session lifecycle watcher.
 *
 * Monitors a target PID (the Claude Code process). When that process exits,
 * automatically breaks the associated Pomodoro session.
 *
 * Spawned detached by `pomodoro start` when called from inside Claude Code.
 *
 * Usage: node src/watcher.mjs <watchPid> <sessionId>
 */
import { sendAndReceive } from './shared/ipcClient.mjs'
import { readLock } from './shared/lockfile.mjs'
import { MSG } from './shared/protocol.mjs'

const [,, watchPidStr, sessionId] = process.argv
const watchPid = parseInt(watchPidStr, 10)

if (!watchPid || !sessionId) {
  process.exit(1)
}

function isAlive(pid) {
  try { process.kill(pid, 0); return true }
  catch { return false }
}

async function breakSession() {
  const lock = readLock()
  if (!lock) return
  try {
    await sendAndReceive({ type: MSG.SESSION_BREAK, sessionId })
  } catch {}
}

// Poll every 3 seconds
const interval = setInterval(async () => {
  if (!isAlive(watchPid)) {
    clearInterval(interval)
    await breakSession()
    process.exit(0)
  }
}, 3000)

// Don't keep event loop alive for other reasons
interval.unref()

// Also exit cleanly if daemon disappears
setTimeout(function check() {
  if (!readLock()) { clearInterval(interval); process.exit(0) }
  setTimeout(check, 10000).unref()
}, 10000).unref()
