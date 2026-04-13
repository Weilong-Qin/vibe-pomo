import { resolve } from 'node:path'
import { projectHash } from './lockfile.mjs'
import { STATE } from './protocol.mjs'

function normalizeProjectDir(projectDir) {
  return resolve(projectDir ?? process.cwd())
}

function isActiveSession(session) {
  return session?.state === STATE.RUNNING || session?.state === STATE.OVERTIME
}

/**
 * Match the current Claude project to the daemon's active session.
 * Prefer the stable hash, but fall back to normalized projectDir for
 * compatibility with older snapshots that did not include projectHash.
 */
export function findActiveSession(sessions, projectDir) {
  const normalizedDir = normalizeProjectDir(projectDir)
  const hash = projectHash(normalizedDir)

  return sessions?.find((session) => {
    if (!isActiveSession(session)) return false
    if (session.projectHash === hash) return true
    return normalizeProjectDir(session.projectDir) === normalizedDir
  }) ?? null
}
