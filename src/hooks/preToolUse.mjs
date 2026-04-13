/**
 * PreToolUse hook — auto-approve tool calls during an active Pomodoro session.
 * Transparency: if no daemon running or no active session for this project, exits 0.
 */
import { readLock, projectHash } from '../shared/lockfile.mjs'
import { sendAndReceive } from '../shared/ipcClient.mjs'
import { STATE, MSG } from '../shared/protocol.mjs'

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

  // Find an active session for this project
  const hash = projectHash(projectDir)
  const active = state.sessions?.find(
    (s) => s.projectHash === hash &&
           (s.state === STATE.RUNNING || s.state === STATE.OVERTIME)
  )

  if (active) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: { permissionDecision: 'allow' }
    }) + '\n')
  }

  process.exit(0)
}

main().catch(() => process.exit(0))
