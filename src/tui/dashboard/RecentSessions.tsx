import React from 'react'
import { Box, Text } from 'ink'

interface RecentSession {
  task: string
  actual_ms: number
  status: string
  started_at: number
  project_path: string
  agent_summary?: string
  user_activity?: string
}

function fmtMins(ms: number): string {
  if (!ms) return '—'
  const m = Math.round(ms / 60000)
  return `${m}m`
}

function projectName(dir: string): string {
  return (dir.split('/').filter(Boolean).pop() ?? dir).slice(0, 12)
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
}

function statusColor(s: string): string {
  return s === 'completed' ? 'green' : s === 'broken' ? 'red' : 'yellow'
}

interface RecentSessionsProps {
  sessions: RecentSession[]
  width: number
}

export function RecentSessions({ sessions, width }: RecentSessionsProps) {
  return (
    <Box flexDirection="column">
      <Text bold color="white"> Recent Sessions</Text>

      {sessions.map((s, i) => {
        const proj = projectName(s.project_path)
        const task = s.task ?? '—'
        const time = fmtMins(s.actual_ms)
        const date = fmtDate(s.started_at)

        return (
          <Box key={i} flexDirection="column" paddingLeft={1} marginBottom={0}>
            {/* Session header line */}
            <Box>
              <Text color="gray">{date}  </Text>
              <Text color="cyan">{proj.padEnd(12)}  </Text>
              <Text color="white" bold>{task.slice(0, width - 38)}</Text>
              <Text color="gray">  {time}  </Text>
              <Text color={statusColor(s.status)}>{s.status}</Text>
            </Box>

            {/* Agent summary */}
            {s.agent_summary && (
              <Box paddingLeft={8}>
                <Text color="gray">🤖 </Text>
                <Text color="gray" dimColor>{s.agent_summary.split('\n')[0].slice(0, width - 16)}</Text>
              </Box>
            )}

            {/* User activity */}
            {s.user_activity && (
              <Box paddingLeft={8}>
                <Text color="blue">👤 </Text>
                <Text color="blueBright">{s.user_activity.slice(0, width - 16)}</Text>
              </Box>
            )}
          </Box>
        )
      })}
    </Box>
  )
}
