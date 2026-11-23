import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { Navigate, useSearchParams } from 'react-router'
import { PillTabsList, PillTabsTrigger } from '@/components/PillTabs'
import { TaskCardsSkeleton } from '@/components/skeletons/joining-tasks/TaskCardsSkeleton'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { useAccess } from '@/hooks/useAccess'
import { orpc } from '@/lib/orpc'
import { openTasksInput } from './components/labels'
import { TasksView } from './components/TasksView'
import { TaskTypesSection } from './components/TaskTypesSection'

// Joining tasks (/joining-tasks, 2026-11-16): the tasks other teams do for a new employee (e-mail ID, laptop, ID
// card...). "My tasks" - the tasks given to me ("Joining tasks" access; Edit marks them done). "All tasks" - HR's view of
// every task (Onboarding: View; Edit gives a task to someone else and marks any done). "Task types" - the tasks every new
// employee gets, with the default person for each ("Joining task types": View sees it, Edit changes it - its own area
// since 2026-11-21, hidden from everyone else). Each task tab shows how many are open.

export function JoiningTasksPage() {
  const { ready, can } = useAccess()
  const [params, setParams] = useSearchParams()
  // the open counts on the tabs - the same queries the lists ask first, so they cost nothing extra
  const mine = useQuery({ ...orpc.joiningTasks.list.queryOptions({ input: openTasksInput('MINE') }), enabled: can('JOINING_TASKS') })
  const all = useQuery({ ...orpc.joiningTasks.list.queryOptions({ input: openTasksInput('ALL') }), enabled: can('ONBOARDING') })
  const tabs = [
    ...(can('JOINING_TASKS') ? [['mine', 'My tasks', mine.data?.items.length]] : []),
    ...(can('ONBOARDING') ? [['all', 'All tasks', all.data?.items.length]] : []),
    ...(can('JOINING_TASK_TYPES') ? [['list', 'Task types', undefined]] : []),
  ] as [string, string, number | undefined][]
  if (!ready) return <JoiningTasksLoading />
  if (!tabs.length) return <Navigate to="/" replace />
  const asked = params.get('tab')
  const tab = tabs.some(([value]) => value === asked) ? asked! : tabs[0]![0]

  return (
    <div className="space-y-5">
      <Intro />
      <Tabs value={tab} onValueChange={(value) => setParams(value === tabs[0]![0] ? {} : { tab: String(value) }, { replace: true })}>
        <PillTabsList>
          {tabs.map(([value, label, count]) => (
            <PillTabsTrigger key={value} value={value}>
              {label} {!!count && <span className="text-xs tabular-nums opacity-70">{count}</span>}
            </PillTabsTrigger>
          ))}
        </PillTabsList>
        <TabsContent value="mine" className="mt-4">
          <TasksView scope="MINE" />
        </TabsContent>
        <TabsContent value="all" className="mt-4">
          <TasksView scope="ALL" />
        </TabsContent>
        <TabsContent value="list" className="mt-4">
          <TaskTypesSection />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// the page's heading and what it is for
function Intro() {
  return (
    <div>
      <p className="text-sm text-muted-foreground">New employees</p>
      <h1 className="mt-1 text-3xl font-light tracking-tight sm:text-4xl">Joining checklist</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground max-sm:hidden">
        What other teams do when someone joins - e-mail ID, laptop, ID card... Each task is given to one person; you are reminded each morning of yours that
        are due.
      </p>
    </div>
  )
}

// before accounts.me answers (a hard refresh) the tabs are not known: the real heading, bars for the tabs, then the open
// tab as TasksView draws it - its filter row (real, disabled) and the task cards
function JoiningTasksLoading() {
  return (
    <div className="space-y-5">
      <Intro />
      {/* as the page's Tabs: the tab list, then the open tab */}
      <div className="flex flex-col gap-2">
        <div className="flex max-w-full gap-0.5 rounded-full bg-card p-1 shadow-card">
          {['w-16', 'w-16', 'w-20'].map((width, i) => (
            <span key={i} className="flex h-9 items-center px-4 sm:h-8">
              <Skeleton className={`h-3.5 rounded-full ${width}`} />
            </span>
          ))}
        </div>
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-card p-2 shadow-card">
            <div className="flex gap-1 rounded-full bg-surface-2 p-1">
              <span className="rounded-full bg-card px-3.5 py-1.5 text-xs font-medium text-foreground shadow-card">To do</span>
              <span className="rounded-full px-3.5 py-1.5 text-xs font-medium text-muted-foreground">Done</span>
            </div>
            <NativeSelect className="[&_select]:h-9 [&_select]:rounded-full" disabled aria-label="Team">
              <NativeSelectOption value="">Every team</NativeSelectOption>
            </NativeSelect>
            <div className="relative w-full sm:w-auto">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="h-9 w-full rounded-full pl-9 sm:w-56" placeholder="Name or employee code" disabled />
            </div>
            <div className="flex flex-wrap gap-1.5 sm:ml-auto">
              {[
                ['Overdue', 'bg-destructive'],
                ['Due today', 'bg-warning'],
              ].map(([text, dot]) => (
                <span key={text} className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-muted-foreground opacity-45 ring-1 ring-border">
                  <span aria-hidden className={`size-1.5 rounded-full ${dot}`} />
                  {text}
                  <Skeleton className="h-3 w-2 rounded-full" />
                </span>
              ))}
            </div>
          </div>
          <TaskCardsSkeleton columns="2.25rem minmax(0,1fr) 8.5rem 11rem" label="Loading joining tasks" />
        </div>
      </div>
    </div>
  )
}
