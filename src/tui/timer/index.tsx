#!/usr/bin/env tsx
/**
 * Per-session Timer TUI.
 * Launched in a new terminal window for each `pomodoro start`.
 *
 * Usage: tsx src/tui/timer/index.tsx <sessionId>
 */
import React from 'react'
import { render } from 'ink'
import { TimerApp } from './TimerApp.js'
import { sendAndReceive } from '../../shared/ipcClient.mjs'
import { MSG } from '../../shared/protocol.mjs'

const sessionId = process.argv[2]
if (!sessionId) {
  console.error('Usage: pomodoro-timer <sessionId>')
  process.exit(1)
}

async function main() {
  // Fetch initial session state
  let session: any = {}
  try {
    session = await sendAndReceive({ type: MSG.SESSION_QUERY, sessionId })
  } catch {
    console.error('Could not connect to Pomodoro daemon.')
    process.exit(1)
  }

  if (session.error) {
    console.error('Session not found:', sessionId)
    process.exit(1)
  }

  render(
    <TimerApp
      sessionId={sessionId}
      task={session.task ?? ''}
      plannedMs={session.plannedMs ?? 25 * 60 * 1000}
      initialState={session.state}
      initialRemaining={session.remaining}
      initialOvertime={session.overtime}
    />,
    { exitOnCtrlC: false }
  )
}

main().catch((err) => {
  console.error('Timer error:', err)
  process.exit(1)
})
