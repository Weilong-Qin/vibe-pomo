import React from 'react'
import { Box, Text } from 'ink'
import { STATE } from '../../shared/protocol.mjs'

interface Session {
  sessionId: string
  projectDir: string
  task: string
  state: string
  remaining: number
  overtime: number
  queuedNotifications: number
  plannedMs: number
}

function fmtMs(ms: number): string {
  const s = Math.floor(Math.abs(ms) / 1000)
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

function projectName(dir: string): string {
  return dir.split('/').filter(Boolean).pop() ?? dir
}

interface ActiveSessionsProps {
  sessions: Session[]
  width: number
}

export function ActiveSessions({ sessions, width }: ActiveSessionsProps) {
  if (sessions.length === 0) {
    return (
      <Box marginBottom={1}>
        <Text color="gray" dimColor>  No active sessions</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color="white"> Active Sessions</Text>
      {sessions.map((s) => {
        const isOvertime = s.state === STATE.OVERTIME
        const timeDisplay = isOvertime ? `+${fmtMs(s.overtime)}` : fmtMs(s.remaining)
        const timeColor = isOvertime ? 'yellow' : 'green'
        const proj = projectName(s.projectDir)
        const taskTrunc = s.task
          ? s.task.slice(0, width - 28)
          : '(no task)'
        const queued = s.queuedNotifications > 0
          ? ` [${s.queuedNotifications} queued]`
          : ''

        return (
          <Box key={s.sessionId} paddingLeft={1} marginTop={0}>
            <Text color={timeColor} bold>{timeDisplay}  </Text>
            <Text color="cyan">{proj.slice(0, 14).padEnd(14)}  </Text>
            <Text>{taskTrunc}</Text>
            {queued ? <Text color="yellow">{queued}</Text> : null}
          </Box>
        )
      })}
    </Box>
  )
}
