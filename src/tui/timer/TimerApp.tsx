import React, { useState, useEffect, useCallback } from 'react'
import { Box, Text, useInput, useStdout } from 'ink'
import TextInput from 'ink-text-input'
import { subscribe, sendAndReceive } from '../../shared/ipcClient.mjs'
import { EVT, MSG, STATE } from '../../shared/protocol.mjs'
import { Timer } from '../components/Timer.js'
import { TaskBar } from '../components/TaskBar.js'
import { NotificationLog } from '../components/NotificationLog.js'

interface TimerAppProps {
  sessionId: string
  task: string
  plannedMs: number
  initialState: string
  initialRemaining: number
  initialOvertime: number
}

interface NotificationEntry {
  notification: Record<string, unknown>
  receivedAt: number
  releasedAt: number
}

type Phase = 'timer' | 'activity-input' | 'done'

export function TimerApp({
  sessionId,
  task,
  plannedMs,
  initialState,
  initialRemaining,
  initialOvertime,
}: TimerAppProps) {
  const { stdout } = useStdout()
  const width = stdout?.columns ?? 60
  const isModal = process.env.POMODORO_MODAL === '1'

  const [timerState, setTimerState] = useState(initialState)
  const [remaining, setRemaining] = useState(initialRemaining)
  const [overtime, setOvertime] = useState(initialOvertime)
  const [queued, setQueued] = useState(0)
  const [notifications, setNotifications] = useState<NotificationEntry[]>([])
  const [phase, setPhase] = useState<Phase>('timer')
  const [userActivity, setUserActivity] = useState('')
  const [activitySaved, setActivitySaved] = useState(false)

  useEffect(() => {
    const conn = subscribe(
      (event) => {
        if (event.sessionId !== sessionId) return

        if (event.type === EVT.TICK) {
          setTimerState(event.state)
          setRemaining(event.remaining ?? 0)
          setOvertime(event.overtime ?? 0)
          setQueued(event.queuedNotifications ?? 0)
        }
        if (event.type === EVT.NOTIFICATION) {
          setNotifications((prev) => [...prev, {
            notification: event.notification,
            receivedAt: event.receivedAt,
            releasedAt: event.releasedAt,
          }])
        }
        if (event.type === EVT.SESSION_ENDED) {
          setTimerState(STATE.ENDED)
          setPhase('activity-input')
        }
      },
      () => {}
    )
    return () => conn.close()
  }, [sessionId])

  const saveAndExit = useCallback(async (activity: string) => {
    if (activity.trim()) {
      try {
        await sendAndReceive({
          type: MSG.SESSION_UPDATE_ACTIVITY,
          sessionId,
          userActivity: activity.trim(),
        })
      } catch {}
    }
    setActivitySaved(true)
    setTimeout(() => process.exit(0), 600)
  }, [sessionId])

  const sendEnd = useCallback(async () => {
    try { await sendAndReceive({ type: MSG.SESSION_END, sessionId }) } catch {}
  }, [sessionId])

  const sendBreak = useCallback(async () => {
    try { await sendAndReceive({ type: MSG.SESSION_BREAK, sessionId }) } catch {}
  }, [sessionId])

  useInput((input, key) => {
    if (phase === 'activity-input') return // TextInput handles keys in this phase
    if (phase === 'done') {
      if (!isModal && (input === 'q' || key.escape)) process.exit(0)
      return
    }
    if (timerState === STATE.ENDED) return
    if (input === 'e' || input === 'E') sendEnd()
    if (input === 'b' || input === 'B') sendBreak()
    if (!isModal && (input === 'q' || key.escape)) process.exit(0)
  })

  const isOvertime = timerState === STATE.OVERTIME
  const isEnded = timerState === STATE.ENDED

  // ── Activity input phase ──────────────────────────────────────────────────
  if (phase === 'activity-input') {
    return (
      <Box flexDirection="column" width={width} paddingX={2} paddingY={1}>
        <Box marginBottom={1}>
          <Text bold color="green">🍅 Session ended</Text>
          {task ? <Text color="gray">  {task.slice(0, width - 24)}</Text> : null}
        </Box>

        <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={2} paddingY={1} marginBottom={1}>
          <Text bold color="cyan">你在这个番茄钟里做了什么？</Text>
          <Text color="gray" dimColor>（可不填，直接 Enter 跳过）</Text>
          <Box marginTop={1}>
            <Text color="white">› </Text>
            <TextInput
              value={userActivity}
              onChange={setUserActivity}
              onSubmit={saveAndExit}
              placeholder="简要描述你的专注内容..."
            />
          </Box>
        </Box>

        {activitySaved && (
          <Text color="green">已保存，正在退出…</Text>
        )}
      </Box>
    )
  }

  // ── Timer phase ───────────────────────────────────────────────────────────
  const keybindings = isEnded
    ? (isModal ? 'Submit your notes to close the Pomodoro overlay' : '[Q] Quit')
    : isOvertime
      ? (isModal ? '[E] End Session    [B] Break' : '[E] End Session    [B] Break    [Q] Quit')
      : (isModal ? '[B] Break' : '[B] Break    [Q] Quit')

  return (
    <Box flexDirection="column" width={width} paddingX={2} paddingY={1}>
      <Box marginBottom={1}>
        <Text bold color={isOvertime ? 'yellow' : isEnded ? 'gray' : 'red'}>🍅 Pomodoro</Text>
      </Box>

      <Timer state={timerState} remaining={remaining} overtime={overtime} />
      <TaskBar task={task} width={width} />
      <NotificationLog notifications={notifications} queued={queued} width={width - 4} />

      <Box marginTop={1}>
        <Text color="gray" dimColor>{keybindings}</Text>
      </Box>

      {isModal && (
        <Box marginTop={1}>
          <Text color="gray" dimColor>The current Claude Code pane will stay covered until you end or break this Pomodoro.</Text>
        </Box>
      )}
    </Box>
  )
}
