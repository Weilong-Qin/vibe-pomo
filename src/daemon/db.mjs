import Database from 'better-sqlite3'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'

const DB_PATH = join(homedir(), '.claude', 'pomodoro.db')

function openDb() {
  mkdirSync(join(homedir(), '.claude'), { recursive: true })
  const db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')

  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      project_hash   TEXT NOT NULL,
      project_path   TEXT NOT NULL,
      started_at     INTEGER NOT NULL,
      ended_at       INTEGER,
      planned_ms     INTEGER NOT NULL,
      actual_ms      INTEGER,
      cycles         INTEGER DEFAULT 1,
      status         TEXT NOT NULL,
      task           TEXT,
      agent_summary  TEXT,   -- from .claude/pomodoro-summary.md
      user_activity  TEXT    -- what the user did during this session (entered at session end)
    );

    -- Migrate existing tables: add new columns if they don't exist yet
    -- (SQLite doesn't support IF NOT EXISTS for columns, so we use a safe approach)


    CREATE TABLE IF NOT EXISTS notifications (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id        INTEGER REFERENCES sessions(id),
      received_at       INTEGER NOT NULL,
      released_at       INTEGER,
      notification_json TEXT NOT NULL
    );

    CREATE VIEW IF NOT EXISTS project_stats AS
    SELECT
      project_path,
      COUNT(*)               AS total_sessions,
      SUM(cycles)            AS total_cycles,
      SUM(actual_ms) / 60000 AS total_minutes,
      MAX(started_at)        AS last_active
    FROM sessions
    WHERE status != 'broken'
    GROUP BY project_path;
  `)

  // Safe column migrations for existing databases
  const cols = db.prepare(`PRAGMA table_info(sessions)`).all().map((c) => c.name)
  if (!cols.includes('agent_summary')) {
    db.exec(`ALTER TABLE sessions ADD COLUMN agent_summary TEXT`)
  }
  if (!cols.includes('user_activity')) {
    db.exec(`ALTER TABLE sessions ADD COLUMN user_activity TEXT`)
  }

  return db
}

let _db = null
function getDb() {
  if (!_db) _db = openDb()
  return _db
}

export function startSession({ projectHash, projectPath, plannedMs, task }) {
  const db = getDb()
  const result = db.prepare(`
    INSERT INTO sessions (project_hash, project_path, started_at, planned_ms, task, status)
    VALUES (?, ?, ?, ?, ?, 'running')
  `).run(projectHash, projectPath, Date.now(), plannedMs, task ?? null)
  return result.lastInsertRowid
}

export function endSession(sessionId, { actualMs, status, agentSummary }) {
  const db = getDb()
  db.prepare(`
    UPDATE sessions
    SET ended_at = ?, actual_ms = ?, status = ?, agent_summary = ?
    WHERE id = ?
  `).run(Date.now(), actualMs, status, agentSummary ?? null, sessionId)
}

export function updateSessionActivity(sessionId, { userActivity }) {
  const db = getDb()
  db.prepare(`UPDATE sessions SET user_activity = ? WHERE id = ?`)
    .run(userActivity ?? null, sessionId)
}

export function saveNotification(sessionId, { notificationJson, receivedAt, releasedAt }) {
  const db = getDb()
  db.prepare(`
    INSERT INTO notifications (session_id, received_at, released_at, notification_json)
    VALUES (?, ?, ?, ?)
  `).run(sessionId, receivedAt, releasedAt ?? null, notificationJson)
}

/** Return stats for Dashboard TUI */
export function getStats() {
  const db = getDb()
  const projects = db.prepare(`
    SELECT project_path, total_sessions, total_cycles, total_minutes, last_active
    FROM project_stats ORDER BY last_active DESC LIMIT 10
  `).all()

  const recent = db.prepare(`
    SELECT project_path, task, actual_ms, status, started_at, agent_summary, user_activity
    FROM sessions ORDER BY started_at DESC LIMIT 8
  `).all()

  return { projects, recent }
}

/** Return all sessions for a project, for detailed review */
export function getProjectSessions(projectPath) {
  const db = getDb()
  return db.prepare(`
    SELECT id, task, started_at, ended_at, actual_ms, status, agent_summary, user_activity
    FROM sessions
    WHERE project_path = ?
    ORDER BY started_at DESC
  `).all(projectPath)
}

/** Print stats to stdout as a formatted table */
export function printStats() {
  const db = getDb()

  const projects = db.prepare(`
    SELECT
      project_path,
      total_sessions,
      total_cycles,
      total_minutes,
      last_active
    FROM project_stats
    ORDER BY last_active DESC
  `).all()

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
      String(row.total_minutes ?? 0).padStart(9) +
      `  ${date}`
    )
  }

  // Recent sessions
  const recent = db.prepare(`
    SELECT project_path, task, actual_ms, cycles, status, started_at
    FROM sessions
    ORDER BY started_at DESC
    LIMIT 10
  `).all()

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
    const cyc = String(s.cycles).padStart(5)
    const status = s.status.padEnd(12)
    const date = new Date(s.started_at).toLocaleDateString()
    console.log(`${taskLabel}${mins}${cyc}  ${status}  ${date}`)
    if (s.agent_summary) {
      const line = s.agent_summary.split('\n')[0].slice(0, 68)
      console.log(`  🤖 ${line}`)
    }
    if (s.user_activity) {
      const line = s.user_activity.slice(0, 68)
      console.log(`  👤 ${line}`)
    }
  }

  console.log()
}
