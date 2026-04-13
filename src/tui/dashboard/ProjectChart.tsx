import React from 'react'
import { Box, Text } from 'ink'

interface Project {
  project_path: string
  total_sessions: number
  total_minutes: number
  total_cycles: number
  last_active: number
}

interface ProjectChartProps {
  projects: Project[]
  width: number
}

const BAR_CHARS = '▏▎▍▌▋▊▉█'

function bar(value: number, max: number, width: number): string {
  if (max === 0) return '░'.repeat(width)
  const filled = Math.round((value / max) * width)
  const empty = width - filled
  return '█'.repeat(filled) + '░'.repeat(empty)
}

function projectName(dir: string): string {
  return dir.split('/').filter(Boolean).pop() ?? dir
}

function fmtMinutes(min: number): string {
  if (min < 60) return `${min}m`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export function ProjectChart({ projects, width }: ProjectChartProps) {
  const BAR_WIDTH = Math.min(30, width - 36)
  const maxMinutes = Math.max(...projects.map((p) => p.total_minutes ?? 0), 1)

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color="white"> Project Focus Time</Text>
      {projects.slice(0, 8).map((p) => {
        const name = projectName(p.project_path).slice(0, 16).padEnd(16)
        const mins = p.total_minutes ?? 0
        const b = bar(mins, maxMinutes, BAR_WIDTH)
        const label = fmtMinutes(mins).padStart(7)

        return (
          <Box key={p.project_path} paddingLeft={1}>
            <Text color="cyan">{name}  </Text>
            <Text color="green">{b}</Text>
            <Text color="white">{label}</Text>
          </Box>
        )
      })}
    </Box>
  )
}
