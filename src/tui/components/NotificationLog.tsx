import React from 'react'
import { Box, Text } from 'ink'

interface NotificationEntry {
  notification: Record<string, unknown>
  receivedAt: number
  releasedAt: number
}

interface NotificationLogProps {
  notifications: NotificationEntry[]
  queued: number
  width: number
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString()
}

export function NotificationLog({ notifications, queued, width }: NotificationLogProps) {
  const maxVisible = 8

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box marginBottom={0}>
        <Text bold color="white"> Notifications </Text>
        {queued > 0 && (
          <Text color="yellow"> ({queued} queued, releasing at overtime…)</Text>
        )}
        {queued === 0 && notifications.length === 0 && (
          <Text color="gray"> (will appear when timer ends)</Text>
        )}
      </Box>

      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor="gray"
        paddingX={1}
        width={width - 2}
      >
        {notifications.length === 0 ? (
          <Text color="gray" dimColor> —</Text>
        ) : (
          notifications.slice(-maxVisible).map((entry, i) => {
            const n = entry.notification as any
            const title = n?.title ?? n?.message ?? JSON.stringify(n).slice(0, 60)
            const time = formatTime(entry.releasedAt)
            return (
              <Box key={i}>
                <Text color="gray">{time}  </Text>
                <Text>{title}</Text>
              </Box>
            )
          })
        )}
      </Box>
    </Box>
  )
}
