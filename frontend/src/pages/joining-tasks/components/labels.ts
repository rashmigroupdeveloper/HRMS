import type { Tone } from '@/components/Pill'
import type { client } from '@/lib/orpc'

// Types and labels of the joining-tasks pages (typed from the API).

export type JoiningTask = Awaited<ReturnType<typeof client.joiningTasks.list>>['items'][number]
export type TaskType = Awaited<ReturnType<typeof client.joiningTasks.types.list>>[number]
export type JoiningType = TaskType['joiningTypes'][number]

// My tasks / All tasks
export type Scope = 'MINE' | 'ALL'

// the task list's default input - the page asks the same (cached) query for the count on its tab
export const openTasksInput = (scope: Scope) => ({ scope, status: 'OPEN' as const, team: undefined, search: undefined })

export const JOINING_TYPE: Record<JoiningType, string> = { REGULAR: 'Regular', CONSULTANT_INTERN: 'Consultant & Intern', OVERSEAS: 'Overseas' }

// Days from today to a calendar date (dates come as midnight UTC, like formatDate reads them): -3 = three days ago
export function daysFromToday(date: Date) {
  const now = new Date()
  return Math.round((date.getTime() - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / 86_400_000)
}

// A task's due date as a status: "3 days overdue" / "Due today" / "Due tomorrow" / "Due in 4 days" (the server's
// `overdue` decides lateness)
export function dueStatus(task: Pick<JoiningTask, 'dueDate' | 'overdue' | 'doneAt'>): { tone: Tone; text: string } {
  if (task.doneAt) return { tone: 'positive', text: 'Done' }
  const days = daysFromToday(task.dueDate)
  if (task.overdue) {
    const late = Math.max(1, -days)
    return { tone: 'negative', text: `${late} day${late === 1 ? '' : 's'} overdue` }
  }
  if (days <= 0) return { tone: 'warning', text: 'Due today' }
  if (days === 1) return { tone: 'neutral', text: 'Due tomorrow' }
  return { tone: 'neutral', text: `Due in ${days} days` }
}

// The same team always gets the same colour dot (teams are free text, so the colour comes from the name)
// (no red - red means overdue; FNV-1a, which spreads short names like "IT" / "Admin" / "HR" over the colours)
const TEAM_DOTS = ['bg-chart-3', 'bg-chart-2', 'bg-chart-1', 'bg-chart-4']
export function teamDot(team: string) {
  let hash = 2166136261
  for (const ch of team.trim().toLowerCase()) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619) >>> 0
  return TEAM_DOTS[(hash >>> 8) % TEAM_DOTS.length]!
}
