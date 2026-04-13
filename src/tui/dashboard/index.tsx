#!/usr/bin/env tsx
/**
 * Dashboard TUI entry point.
 * Starts the global daemon then renders the live dashboard in current terminal.
 *
 * Usage: pomodoro daemon
 */
import React from 'react'
import { render } from 'ink'
import { startDaemon } from '../../daemon/index.mjs'
import { DashboardApp } from './DashboardApp.js'
import { readLock } from '../../shared/lockfile.mjs'

async function main() {
  const existing = readLock()
  if (existing) {
    console.error('Pomodoro daemon is already running (PID ' + existing.pid + ').')
    console.error('Run `pomodoro stop-daemon` to stop it first.')
    process.exit(1)
  }

  // Start the daemon in-process (not detached — this terminal IS the daemon)
  await startDaemon()

  render(<DashboardApp />, { exitOnCtrlC: false })
}

main().catch((err) => {
  console.error('Dashboard error:', err)
  process.exit(1)
})
