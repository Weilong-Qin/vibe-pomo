/**
 * Global Pomodoro Daemon
 * Manages multiple concurrent sessions across all Claude Code projects.
 *
 * Started by `pomodoro daemon` (foreground, inside Dashboard TUI)
 * or spawned detached if no dashboard is running.
 */
import { createHash } from 'node:crypto'
import { getSocketPath, writeLock, removeLock, projectHash } from '../shared/lockfile.mjs'
import { EVT, MSG, STATE, DECISION } from '../shared/protocol.mjs'
import { IpcServer } from './ipc.mjs'
import { Session } from './session.mjs'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { startSession, endSession, saveNotification, updateSessionActivity } from './db.mjs'

const ipc = new IpcServer()

/** sessionId → Session */
const sessions = new Map()

/** sessionId → DB row id */
const dbIds = new Map()

// ── IPC Handlers ─────────────────────────────────────────────────────────────

ipc.on(MSG.QUERY, () => ({
  sessions: [...sessions.values()].map((s) => s.snapshot()),
}))

ipc.on(MSG.SESSION_QUERY, (msg) => {
  const session = sessions.get(msg.sessionId)
  if (!session) return { error: 'session not found' }
  return session.snapshot()
})

ipc.on(MSG.SESSION_CREATE, (msg) => {
  const { projectDir, task, plannedMs, decisionStrategy = DECISION.WAIT } = msg
  const hash = projectHash(projectDir ?? process.cwd())

  const session = new Session({
    projectDir: projectDir ?? process.cwd(),
    projectHash: hash,
    task: task ?? '',
    plannedMs: plannedMs ?? 25 * 60 * 1000,
    decisionStrategy,
  })

  sessions.set(session.id, session)
  wireSessionEvents(session)

  const dbId = startSession({
    projectHash: hash,
    projectPath: projectDir ?? process.cwd(),
    plannedMs: session.plannedMs,
    task: session.task,
  })
  dbIds.set(session.id, dbId)

  // Broadcast snapshot to dashboard subscribers
  ipc.broadcast({ type: EVT.SNAPSHOT, sessions: [...sessions.values()].map((s) => s.snapshot()) })

  return { sessionId: session.id, ...session.snapshot() }
})

ipc.on(MSG.SESSION_END, (msg) => {
  const session = sessions.get(msg.sessionId)
  if (!session) return { error: 'session not found' }
  session.end()
  return { ok: true }
})

ipc.on(MSG.SESSION_BREAK, (msg) => {
  const session = sessions.get(msg.sessionId)
  if (!session) return { error: 'session not found' }
  session.break()
  return { ok: true }
})

ipc.on(MSG.SESSION_UPDATE_ACTIVITY, (msg) => {
  const dbId = dbIds.get(msg.sessionId)
  if (!dbId) return { error: 'session not found' }
  updateSessionActivity(dbId, { userActivity: msg.userActivity })
  return { ok: true }
})

ipc.on(MSG.QUEUE_NOTIFICATION, (msg) => {
  const session = sessions.get(msg.sessionId)
  if (!session) return { ok: false, error: 'session not found' }
  session.enqueueNotification(msg.notification)
  return { ok: true, queued: session.queueSize }
})

ipc.on(MSG.AGENT_STOPPING, (msg) => {
  const session = sessions.get(msg.sessionId)
  if (!session || session.state === STATE.ENDED) return { action: 'allow' }

  if (session.decisionStrategy === DECISION.BREAK) {
    session.break()
    return { action: 'allow' }
  }

  // Default: WAIT
  return {
    action: 'block',
    remainingFormatted: formatMs(session.remaining),
  }
})

// ── Session event wiring ──────────────────────────────────────────────────────

function wireSessionEvents(session) {
  session.on('tick', (data) => {
    ipc.broadcast({ type: EVT.TICK, ...data })
  })

  session.on('overtime', () => {
    const now = Date.now()
    session.flushNotifications((item) => {
      const releasedAt = now
      const event = {
        type: EVT.NOTIFICATION,
        sessionId: session.id,
        notification: item.notification,
        receivedAt: item.receivedAt,
        releasedAt,
      }
      ipc.broadcast(event)
      const dbId = dbIds.get(session.id)
      if (dbId) saveNotification(dbId, {
        notificationJson: JSON.stringify(item.notification),
        receivedAt: item.receivedAt,
        releasedAt,
      })
    })
  })

  session.on('ended', ({ sessionId, status, actualMs }) => {
    // Flush remaining notifications (if ended before overtime)
    const now = Date.now()
    session.flushNotifications((item) => {
      const releasedAt = now
      const event = {
        type: EVT.NOTIFICATION,
        sessionId,
        notification: item.notification,
        receivedAt: item.receivedAt,
        releasedAt,
      }
      ipc.broadcast(event)
      const dbId = dbIds.get(sessionId)
      if (dbId) saveNotification(dbId, {
        notificationJson: JSON.stringify(item.notification),
        receivedAt: item.receivedAt,
        releasedAt,
      })
    })

    const dbId = dbIds.get(sessionId)
    if (dbId) {
      const agentSummary = readAgentSummary(session.projectDir)
      endSession(dbId, { actualMs, status, agentSummary })
    }

    sessions.delete(sessionId)
    dbIds.delete(sessionId)

    ipc.broadcast({ type: EVT.SESSION_ENDED, sessionId, status, actualMs })
    ipc.broadcast({ type: EVT.SNAPSHOT, sessions: [...sessions.values()].map((s) => s.snapshot()) })
  })
}

// ── Startup ───────────────────────────────────────────────────────────────────

export async function startDaemon() {
  const socketPath = getSocketPath()
  await ipc.listen(socketPath)

  writeLock({ pid: process.pid, socketPath, startedAt: Date.now() })

  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)

  return ipc
}

function shutdown() {
  for (const session of sessions.values()) session.break()
  removeLock()
  ipc.close()
  setTimeout(() => process.exit(0), 300)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatMs(ms) {
  const m = Math.floor(ms / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function readAgentSummary(projectDir) {
  const summaryPath = join(projectDir, '.claude', 'pomodoro-summary.md')
  if (!existsSync(summaryPath)) return null
  try {
    const text = readFileSync(summaryPath, 'utf8').trim()
    // Keep first 500 chars for storage; full file stays on disk
    return text.slice(0, 500) || null
  } catch {
    return null
  }
}
