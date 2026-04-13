import React from 'react'
import { Box, Text } from 'ink'

interface TaskBarProps {
  task: string
  width: number
}

export function TaskBar({ task, width }: TaskBarProps) {
  if (!task) return null

  const maxLen = Math.max(width - 10, 20)
  const display = task.length > maxLen
    ? task.slice(0, maxLen - 1) + '…'
    : task

  return (
    <Box marginBottom={1}>
      <Text color="cyan" bold>Task  </Text>
      <Text>{display}</Text>
    </Box>
  )
}
