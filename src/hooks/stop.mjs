/**
 * Stop hook — called when Claude Code agent finishes.
 * Blocks the agent if a Pomodoro is active for this project.
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
  let input = {}
  try { input = JSON.parse(raw) } catch {}

  let resp
  try {
    resp = await sendAndReceive({
      type: MSG.AGENT_STOPPING,
      sessionId: active.sessionId,
      stopReason: input.stop_reason ?? input.reason,
    })
  } catch {
    process.exit(0)
  }

  if (resp.action === 'block') {
    process.stdout.write(JSON.stringify({
      decision: 'block',
      reason: `Pomodoro active (${resp.remainingFormatted} remaining). Waiting for user to end session.`,
      systemMessage: [
        'The Pomodoro focus session is still running.',
        `Time remaining: ${resp.remainingFormatted}.`,
        'The user is not available. Do not send messages or notifications.',
        'Record any pending decisions in `.claude/pomodoro-pending.md` and wait quietly.',
        'If the user asks how to end the session, tell them to run: pomodoro stop',
      ].join(' '),
    }) + '\n')
  }

  process.exit(0)
}

main().catch(() => process.exit(0))
