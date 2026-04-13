import React, { useState, useEffect, useCallback } from 'react'
import { Box, Text, useInput, useStdout } from 'ink'
import { Timer } from './components/Timer.js'
import { TaskBar } from './components/TaskBar.js'
import { NotificationLog } from './components/NotificationLog.js'
import { TuiIpcClient } from './ipcClient.mjs'
import { STATE } from '../shared/protocol.mjs'

interface AppProps {
  socketPath: string
  task: string
  plannedMs: number
}

interface TickState {
  state: string
  remaining: number
  overtime: number
  queuedNotifications?: number
}

interface NotificationEntry {
  notification: Record<string, unknown>
  receivedAt: number
  releasedAt: number
}

export function App({ socketPath, task: initialTask, plannedMs }: AppProps) {
  const { stdout } = useStdout()
  const width = stdout?.columns ?? 60

  const [tick, setTick] = useState<TickState>({
    state: STATE.RUNNING,
    remaining: plannedMs,
    overtime: 0,
    queuedNotifications: 0,
  })
  const [notifications, setNotifications] = useState<NotificationEntry[]>([])
  const [task, setTask] = useState(initialTask)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [ipc] = useState(() => new TuiIpcClient(socketPath))

  useEffect(() => {
    ipc.connect({
      onTick: (event) => {
        setTick({
          state: event.state,
          remaining: event.remaining ?? 0,
          overtime: event.overtime ?? 0,
          queuedNotifications: event.queuedNotifications ?? 0,
        })
        if (event.task) setTask(event.task)
      },
      onNotification: (event) => {
        setNotifications((prev) => [...prev, {
          notification: event.notification,
          receivedAt: event.receivedAt,
          releasedAt: event.releasedAt,
        }])
      },
      onEnded: () => {
        setTick((prev) => ({ ...prev, state: STATE.ENDED }))
        // Give time for final notifications to render, then exit
        setTimeout(() => process.exit(0), 3000)
      },
      onError: (err) => {
        if (tick.state !== STATE.ENDED) {
          setConnectionError(err.message)
        }
      },
    })

    return () => ipc.close()
  }, [])

  const handleEnd = useCallback(async () => {
    await ipc.sendEnd()
  }, [ipc])

  const handleBreak = useCallback(async () => {
    await ipc.sendBreak()
  }, [ipc])

  useInput((input, key) => {
    if (tick.state === STATE.ENDED) {
      if (input === 'q' || key.escape) process.exit(0)
      return
    }
    if (input === 'e' || input === 'E') handleEnd()
    if (input === 'b' || input === 'B') handleBreak()
    if (input === 'q' || key.escape) process.exit(0)
  })

  const isOvertime = tick.state === STATE.OVERTIME
  const isEnded = tick.state === STATE.ENDED

  const keybindings = isEnded
    ? '[Q] Quit'
    : isOvertime
      ? '[E] End Session    [B] Break    [Q] Quit'
      : '[B] Break    [Q] Quit'

  return (
    <Box flexDirection="column" width={width} paddingX={2} paddingY={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color={isOvertime ? 'yellow' : isEnded ? 'gray' : 'red'}>
          🍅 Pomodoro
        </Text>
      </Box>

      {/* Timer */}
      <Timer
        state={tick.state}
        remaining={tick.remaining}
        overtime={tick.overtime}
      />

      {/* Task */}
      <TaskBar task={task} width={width} />

      {/* Notification log */}
      <NotificationLog
        notifications={notifications}
        queued={tick.queuedNotifications ?? 0}
        width={width - 4}
      />

      {/* Error */}
      {connectionError && (
        <Box marginTop={1}>
          <Text color="red">Connection lost: {connectionError}</Text>
        </Box>
      )}

      {/* Ended message */}
      {isEnded && (
        <Box marginTop={1}>
          <Text color="green" bold>Session complete. Press Q to exit.</Text>
        </Box>
      )}

      {/* Keybindings */}
      <Box marginTop={1}>
        <Text color="gray" dimColor>{keybindings}</Text>
      </Box>
    </Box>
  )
}
