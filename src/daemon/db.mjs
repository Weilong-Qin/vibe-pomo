import { homedir } from 'node:os'
import { join } from 'node:path'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'

const DATA_PATH = join(homedir(), '.claude', 'pomodoro-data.json')

// ── In-memory store (loaded once, flushed on every write) ─────────────────────

let _data = null

function load() {
  if (_data) return _data
  mkdirSync(join(homedir(), '.claude'), { recursive: true })
  if (existsSync(DATA_PATH)) {
    try { _data = JSON.parse(readFileSync(DATA_PATH, 'utf8')) } catch {}
  }
  if (!_data) _data = { sessions: [], notifications: [], nextId: 1 }
  // Backfill nextId in case file was created without it
  if (!_data.nextId) {
    const maxId = Math.max(0, ...(_data.sessions ?? []).map((s) => s.id ?? 0))
    _data.nextId = maxId + 1
  }
  return _data
}

function flush() {
  writeFileSync(DATA_PATH, JSON.stringify(_data, null, 2), 'utf8')
}

// ── Public API (mirrors the old better-sqlite3 interface exactly) ─────────────

export function startSession({ projectHash, projectPath, plannedMs, task }) {
  const data = load()
  const id = data.nextId++
  data.sessions.push({
    id,
    project_hash:   projectHash,
    project_path:   projectPath,
    started_at:     Date.now(),
    ended_at:       null,
    planned_ms:     plannedMs,
    actual_ms:      null,
    cycles:         1,
    status:         'running',
    task:           task ?? null,
    agent_summary:  null,
    user_activity:  null,
  })
  flush()
  return id
}

export function endSession(id, { actualMs, status, agentSummary }) {
  const data = load()
  const s = data.sessions.find((s) => s.id === id)
  if (!s) return
  s.ended_at     = Date.now()
  s.actual_ms    = actualMs
  s.status       = status
  s.agent_summary = agentSummary ?? null
  flush()
}

export function updateSessionActivity(id, { userActivity }) {
  const data = load()
  const s = data.sessions.find((s) => s.id === id)
  if (!s) return
  s.user_activity = userActivity ?? null
  flush()
}

export function saveNotification(sessionId, { notificationJson, receivedAt, releasedAt }) {
  const data = load()
  data.notifications.push({
    id:                data.nextId++,
    session_id:        sessionId,
    received_at:       receivedAt,
    released_at:       releasedAt ?? null,
    notification_json: notificationJson,
  })
  flush()
}

// ── Aggregation helpers ───────────────────────────────────────────────────────

function projectStats() {
  const data = load()
  const map = new Map()
  for (const s of data.sessions) {
    if (s.status === 'broken') continue
    const key = s.project_path
    if (!map.has(key)) map.set(key, { project_path: key, total_sessions: 0, total_cycles: 0, total_minutes: 0, last_active: 0 })
    const row = map.get(key)
    row.total_sessions++
    row.total_cycles  += s.cycles ?? 1
    row.total_minutes += Math.floor((s.actual_ms ?? 0) / 60000)
    if (s.started_at > row.last_active) row.last_active = s.started_at
  }
  return [...map.values()].sort((a, b) => b.last_active - a.last_active)
}

/** Return stats for Dashboard TUI */
export function getStats() {
  const data = load()
  const projects = projectStats().slice(0, 10)
  const recent = [...data.sessions]
    .sort((a, b) => b.started_at - a.started_at)
    .slice(0, 8)
    .map(({ project_path, task, actual_ms, status, started_at, agent_summary, user_activity }) =>
      ({ project_path, task, actual_ms, status, started_at, agent_summary, user_activity }))
  return { projects, recent }
}

/** Return all sessions for a project, for detailed review */
export function getProjectSessions(projectPath) {
  const data = load()
  return data.sessions
    .filter((s) => s.project_path === projectPath)
    .sort((a, b) => b.started_at - a.started_at)
    .map(({ id, task, started_at, ended_at, actual_ms, status, agent_summary, user_activity }) =>
      ({ id, task, started_at, ended_at, actual_ms, status, agent_summary, user_activity }))
}

/** Print stats to stdout as a formatted table */
export function printStats() {
  const data = load()
  const projects = projectStats()

  if (projects.length === 0) {
    console.log('No completed sessions yet.')
    return
  }

  console.log('\nProject Statistics\n' + '─'.repeat(72))
  console.log(
    'Project'.padEnd(36) +
    'Sessions'.padStart(9) +
    'Cycles'.padStart(8) +
    'Minutes'.padStart(9) +
    '  Last Active'
  )
  console.log('─'.repeat(72))

  for (const row of projects) {
    const path = row.project_path.replace(homedir(), '~')
    const truncated = path.length > 35 ? '…' + path.slice(-34) : path
    const date = new Date(row.last_active).toLocaleDateString()
    console.log(
      truncated.padEnd(36) +
      String(row.total_sessions).padStart(9) +
      String(row.total_cycles).padStart(8) +
      String(row.total_minutes).padStart(9) +
      `  ${date}`
    )
  }

  const recent = [...data.sessions]
    .sort((a, b) => b.started_at - a.started_at)
    .slice(0, 10)

  console.log('\nRecent Sessions\n' + '─'.repeat(72))
  console.log(
    'Task'.padEnd(38) +
    'Min'.padStart(5) +
    'Cyc'.padStart(5) +
    '  Status'.padEnd(14) +
    '  Date'
  )
  console.log('─'.repeat(72))

  for (const s of recent) {
    const taskLabel = (s.task ?? '(no task)').slice(0, 37).padEnd(38)
    const mins = s.actual_ms ? String(Math.round(s.actual_ms / 60000)).padStart(5) : '   —'
    const cyc = String(s.cycles ?? 1).padStart(5)
    const status = s.status.padEnd(12)
    const date = new Date(s.started_at).toLocaleDateString()
    console.log(`${taskLabel}${mins}${cyc}  ${status}  ${date}`)
    if (s.agent_summary) {
      console.log(`  🤖 ${s.agent_summary.split('\n')[0].slice(0, 68)}`)
    }
    if (s.user_activity) {
      console.log(`  👤 ${s.user_activity.slice(0, 68)}`)
    }
  }

  console.log()
}
