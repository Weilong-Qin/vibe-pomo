import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const CLAUDE_DIR = join(homedir(), '.claude')
const LOCK_PATH = join(CLAUDE_DIR, 'pomodoro.lock')
// Windows requires named pipe paths; Unix uses a socket file
const SOCKET_PATH = process.platform === 'win32'
  ? '\\\\.\\pipe\\vibe-pomo'
  : join(CLAUDE_DIR, 'pomodoro.sock')

export function getSocketPath() {
  return SOCKET_PATH
}

export function getLockPath() {
  return LOCK_PATH
}

/**
 * Read global lock. Returns null if file missing, malformed, or PID dead.
 */
export function readLock() {
  if (!existsSync(LOCK_PATH)) return null
  let data
  try {
    data = JSON.parse(readFileSync(LOCK_PATH, 'utf8'))
  } catch {
    return null
  }
  try {
    process.kill(data.pid, 0)
  } catch {
    try { unlinkSync(LOCK_PATH) } catch {}
    // Named pipes on Windows are kernel-managed; only unlink on Unix
    if (process.platform !== 'win32') try { unlinkSync(SOCKET_PATH) } catch {}
    return null
  }
  return data
}

export function writeLock(data) {
  writeFileSync(LOCK_PATH, JSON.stringify(data), 'utf8')
}

export function removeLock() {
  try { unlinkSync(LOCK_PATH) } catch {}
  // Named pipes on Windows are kernel-managed; only unlink on Unix
  if (process.platform !== 'win32') try { unlinkSync(SOCKET_PATH) } catch {}
}

/** Stable short ID for a project directory */
export function projectHash(dir) {
  return createHash('sha1').update(dir).digest('hex').slice(0, 12)
}
