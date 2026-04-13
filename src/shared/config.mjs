import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import { DECISION } from './protocol.mjs'

const CONFIG_PATH = join(homedir(), '.claude', 'pomodoro.json')

const DEFAULTS = {
  defaultDurationMs: 25 * 60 * 1000,   // 25 minutes
  decisionStrategy: DECISION.WAIT,
  terminalEmulator: 'auto',
  soundOnOvertime: true,
}

export function loadConfig() {
  if (!existsSync(CONFIG_PATH)) {
    return { ...DEFAULTS }
  }
  try {
    const raw = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'))
    return { ...DEFAULTS, ...raw }
  } catch {
    return { ...DEFAULTS }
  }
}

export function ensureConfigFile() {
  if (!existsSync(CONFIG_PATH)) {
    mkdirSync(dirname(CONFIG_PATH), { recursive: true })
    writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULTS, null, 2) + '\n', 'utf8')
    return true
  }
  return false
}

export function formatDuration(ms) {
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/**
 * Parse duration string like "25m", "1h", "90s", or plain number (minutes).
 * Returns milliseconds.
 */
export function parseDuration(str) {
  if (!str) return null
  const s = String(str).trim()
  const match = s.match(/^(\d+)(m|h|s)?$/)
  if (!match) return null
  const n = parseInt(match[1], 10)
  const unit = match[2] || 'm'
  if (unit === 'h') return n * 60 * 60 * 1000
  if (unit === 'm') return n * 60 * 1000
  if (unit === 's') return n * 1000
  return null
}
