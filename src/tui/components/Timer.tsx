import React from 'react'
import { Box, Text } from 'ink'
import { STATE } from '../../shared/protocol.mjs'

interface TimerProps {
  state: string
  remaining: number   // ms
  overtime: number    // ms
}

function formatMs(ms: number): string {
  const totalSec = Math.floor(Math.abs(ms) / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function Timer({ state, remaining, overtime }: TimerProps) {
  const isOvertime = state === STATE.OVERTIME
  const isEnded = state === STATE.ENDED

  const timeDisplay = isOvertime
    ? `+${formatMs(overtime)}`
    : formatMs(remaining)

  const statusLabel = isEnded
    ? 'ENDED'
    : isOvertime
      ? 'OVERTIME'
      : 'RUNNING'

  const timeColor = isEnded ? 'gray' : isOvertime ? 'yellow' : 'green'
  const statusColor = isEnded ? 'gray' : isOvertime ? 'yellow' : 'greenBright'

  return (
    <Box flexDirection="column" alignItems="center" marginY={1}>
      <Text color={timeColor} bold>
        {timeDisplay.split('').map((ch, i) => (
          <Text key={i} color={timeColor}>{ch}</Text>
        ))}
      </Text>
      <Text color={statusColor} dimColor={isEnded}>
        {statusLabel}
      </Text>
    </Box>
  )
}
