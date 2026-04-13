import React, { useState, useEffect } from 'react'
import { Box, Text, useInput, useStdout } from 'ink'
import { subscribe } from '../../shared/ipcClient.mjs'
import { EVT, STATE } from '../../shared/protocol.mjs'
import { getStats } from '../../daemon/db.mjs'
import { ActiveSessions } from './ActiveSessions.js'
import { ProjectChart } from './ProjectChart.js'
import { RecentSessions } from './RecentSessions.js'

interface SessionSnapshot {
  sessionId: string
  projectDir: string
  task: string
  state: string
  remaining: number
  overtime: number
  queuedNotifications: number
  startedAt: number
  plannedMs: number
}

export function DashboardApp() {
  const { stdout } = useStdout()
  const width = stdout?.columns ?? 80

  const [sessions, setSessions] = useState<SessionSnapshot[]>([])
  const [stats, setStats] = useState<any[]>([])
  const [recent, setRecent] = useState<any[]>([])
  const [tick, setTick] = useState(0)

  // Load stats from DB on mount and after session ends
  const refreshStats = () => {
    try {
      const s = getStats()
      setStats(s.projects)
      setRecent(s.recent)
    } catch {}
  }

  useEffect(() => {
    refreshStats()

    const conn = subscribe(
      (event) => {
        if (event.type === EVT.SNAPSHOT) {
          setSessions(event.sessions ?? [])
        }
        if (event.type === EVT.TICK) {
          // Update the specific session
          setSessions((prev) => prev.map((s) =>
            s.sessionId === event.sessionId
              ? { ...s, state: event.state, remaining: event.remaining, overtime: event.overtime, queuedNotifications: event.queuedNotifications }
              : s
          ))
          setTick((t) => t + 1)
        }
        if (event.type === EVT.SESSION_ENDED) {
          setSessions((prev) => prev.filter((s) => s.sessionId !== event.sessionId))
          refreshStats()
        }
      },
      () => {} // ignore disconnect errors — daemon is in-process
    )

    return () => conn.close()
  }, [])

  useInput((input, key) => {
    if (input === 'q' || key.escape) {
      process.exit(0)
    }
  })

  const activeSessions = sessions.filter(
    (s) => s.state === STATE.RUNNING || s.state === STATE.OVERTIME
  )

  return (
    <Box flexDirection="column" width={width} paddingX={1} paddingY={0}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="red">🍅 Pomodoro</Text>
        <Text color="gray">  daemon running · </Text>
        <Text color="green">{activeSessions.length} active session{activeSessions.length !== 1 ? 's' : ''}</Text>
        <Text color="gray">  [Q] Quit daemon</Text>
      </Box>

      {/* Active sessions */}
      <ActiveSessions sessions={activeSessions} width={width} />

      {/* Project stats bar chart */}
      {stats.length > 0 && (
        <ProjectChart projects={stats} width={width} />
      )}

      {/* Recent sessions */}
      {recent.length > 0 && (
        <RecentSessions sessions={recent} width={width} />
      )}

      {activeSessions.length === 0 && stats.length === 0 && (
        <Box marginTop={1}>
          <Text color="gray" dimColor>
            No sessions yet. Start one with: /pomodoro &lt;task&gt;
          </Text>
        </Box>
      )}
    </Box>
  )
}
