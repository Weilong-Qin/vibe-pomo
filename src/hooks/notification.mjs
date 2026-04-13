/**
 * Notification hook — queue notifications during an active Pomodoro session.
 */
import { readLock } from '../shared/lockfile.mjs'
import { sendAndReceive } from '../shared/ipcClient.mjs'
import { MSG } from '../shared/protocol.mjs'
import { findActiveSession } from '../shared/findActiveSession.mjs'

async function readStdin() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) return resolve('')
    let data = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (c) => { data += c })
    process.stdin.on('end', () => resolve(data))
  })
}

async function main() {
  const lock = readLock()
  if (!lock) process.exit(0)

  const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd()
  let state
  try {
    state = await sendAndReceive({ type: MSG.QUERY })
  } catch {
    process.exit(0)
  }

  const active = findActiveSession(state.sessions, projectDir)
  if (!active) process.exit(0)

  const raw = await readStdin()
  let notification = {}
  try { notification = JSON.parse(raw) } catch {}

  try {
    await sendAndReceive({
      type: MSG.QUEUE_NOTIFICATION,
      sessionId: active.sessionId,
      notification,
    })
  } catch {}

  process.exit(0)
}

main().catch(() => process.exit(0))
