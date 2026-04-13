#!/usr/bin/env tsx
/**
 * TUI entry point — launched in a separate terminal window by `pomodoro start`.
 *
 * Usage: tsx src/tui/index.tsx <projectDir>
 */
import React from 'react'
import { render } from 'ink'
import { App } from './App.js'
import { readLock } from '../shared/lockfile.mjs'
import { sendAndReceive } from '../shared/ipcClient.mjs'

const projectDir = process.argv[2] ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd()

async function main() {
  // Wait for daemon to be ready (in case TUI starts slightly before daemon writes lock)
  const lock = await waitForLock(projectDir, 5000)
  if (!lock) {
    console.error('Could not connect to Pomodoro daemon. Is it running?')
    console.error(`Project: ${projectDir}`)
    process.exit(1)
  }

  // Fetch initial state
  let initialState: any = {}
  try {
    initialState = await sendAndReceive(lock.socketPath, { type: 'query' })
  } catch {}

  render(
    <App
      socketPath={lock.socketPath}
      task={initialState.task ?? lock.task ?? ''}
      plannedMs={initialState.plannedMs ?? lock.durationMs ?? 25 * 60 * 1000}
    />,
    { exitOnCtrlC: false }
  )
}

function waitForLock(projectDir: string, timeoutMs: number): Promise<any> {
  return new Promise((resolve) => {
    const start = Date.now()
    const check = () => {
      const lock = readLock(projectDir)
      if (lock) return resolve(lock)
      if (Date.now() - start > timeoutMs) return resolve(null)
      setTimeout(check, 100)
    }
    check()
  })
}

main().catch((err) => {
  console.error('TUI error:', err)
  process.exit(1)
})
