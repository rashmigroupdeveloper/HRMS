import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, Ellipsis, KeyRound, LockOpen, LogOut, Plus, Power, PowerOff, Search, UserCog, UserPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useBlocker } from 'react-router'
import { FormError } from '@/components/FormError'
import { SharedListNote } from '@/components/SharedListNote'
import { Pill } from '@/components/Pill'
import { SessionsList } from '@/components/SessionsList'
import { RoleWorkspaceSkeleton } from '@/components/skeletons/access/RoleWorkspaceSkeleton'
import { LoginsTableSkeleton } from '@/components/skeletons/access/LoginsTableSkeleton'
import { SessionsSkeleton } from '@/components/skeletons/access/SessionsSkeleton'
import { SecurityRules } from './components/SecurityRules'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PillTabsList, PillTabsTrigger } from '@/components/PillTabs'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { useAccess } from '@/hooks/useAccess'
import { client, orpc } from '@/lib/orpc'
import { downloadFile, formatDateTime } from '@/lib/utils'
import { RoleWorkspace } from './components/RoleWorkspace'
import { DisableLoginDialog } from './components/DisableLoginDialog'
import { ACCOUNT_STATUS, type Account, describeDataAccess, LEVEL_LABEL, type Role } from './components/labels'
import { LoginDialog } from './components/LoginDialog'
import { PersonRolesDialog } from './components/PersonRolesDialog'
import { RoleDialog } from './components/RoleDialog'

// Roles & access: the super admin (or anyone with Edit on "Roles & access") creates roles, chooses View / Edit per
// area, and gives roles to employees. Nothing about access is fixed in code except the list of areas.
export function RolesPage() {
  const { can, coversGroup, me } = useAccess()
  // giving logins and roles to people: Edit (each person checked by the backend)
  const canChange = can('ACCESS', 'WRITE')
  // the roles themselves and the security rules are shared by every company: Edit for all companies (B13, 2026-11-21)
  const canChangeRoles = coversGroup('ACCESS')
  const roles = useQuery(orpc.accounts.roles.list.queryOptions())
  const accounts = useQuery(orpc.accounts.list.queryOptions())
  const [tab, setTab] = useState('roles')
  const [editingRole, setEditingRole] = useState<Role | 'new' | null>(null)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [search, setSearch] = useState('')
  const [securityDirty, setSecurityDirty] = useState(false)
  const blocker = useBlocker(securityDirty)
  useEffect(() => {
    if (!securityDirty) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [securityDirty])
  // "give a login" (null) or "reset password" (an account)
  const [loginDialog, setLoginDialog] = useState<{ reset: Account | null } | null>(null)
  const queryClient = useQueryClient()
  const refresh = () => void queryClient.invalidateQueries({ queryKey: orpc.accounts.key() })
  const unlock = useMutation(orpc.accounts.unlock.mutationOptions({ onSuccess: refresh }))
  const enable = useMutation(orpc.accounts.enable.mutationOptions({ onSuccess: refresh }))
  const [disabling, setDisabling] = useState<Account | null>(null)
  // where everyone is signed in
  const sessions = useQuery({ ...orpc.accounts.sessions.list.queryOptions(), refetchInterval: 60_000 })
  const endSession = useMutation(orpc.accounts.sessions.end.mutationOptions({ onSuccess: refresh }))
  const endAll = useMutation(orpc.accounts.sessions.endAll.mutationOptions({ onSuccess: refresh }))
  const [exportError, setExportError] = useState<string | null>(null)

  const areas = roles.data?.areas ?? []
  const roleList = roles.data?.roles ?? []
  const term = search.trim().toLowerCase()
  const people = (accounts.data ?? []).filter(
    (a) => !term || a.name.toLowerCase().includes(term) || a.employeeCode.toLowerCase().includes(term),
  )

  const accountActions = (account: Account) => <>
                          {account.employeeCode === me?.employeeCode ? (
                            <span className="text-xs text-muted-foreground" title="Nobody can change their own roles or reset their own password here">
                              You
                            </span>
                          ) : (
                            canChange && (
                              <div className="flex justify-end gap-1">
                                <DropdownMenu>
                                  <DropdownMenuTrigger aria-label={`Account actions for ${account.name}`} className="grid size-9 place-items-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-surface-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"><Ellipsis aria-hidden className="size-4" /></DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-56 rounded-2xl p-1.5 shadow-float motion-reduce:animate-none">
                                    {account.lockedUntil && <DropdownMenuItem disabled={unlock.isPending} onClick={() => unlock.mutate({ employeeCode: account.employeeCode })}><LockOpen />Unlock login</DropdownMenuItem>}
                                    <DropdownMenuItem onClick={() => setLoginDialog({ reset: account })}><KeyRound />Reset password</DropdownMenuItem>
                                    {account.disabled
                                      ? <DropdownMenuItem disabled={enable.isPending} onClick={() => enable.mutate({ employeeCode: account.employeeCode })}><Power />Turn on login</DropdownMenuItem>
                                      : <DropdownMenuItem onClick={() => setDisabling(account)}><PowerOff />Turn off login</DropdownMenuItem>}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem disabled={endAll.isPending || !sessions.data?.some((s) => s.employee?.employeeCode === account.employeeCode)} onClick={() => endAll.mutate({ employeeCode: account.employeeCode })}><LogOut />Log out everywhere</DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                                <Button variant="secondary" size="sm" disabled={!roles.data} onClick={() => setEditingAccount(account)}>
                                  <UserCog /> Change roles
                                </Button>
                              </div>
                            )
                          )}
  </>

  return (
    <div className="access-workspace space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-light tracking-tight sm:text-[2rem]">Roles &amp; access</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Define permissions, assign roles and manage sign-ins.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="default" onClick={() => void downloadFile(() => client.accounts.roles.export(), setExportError)}>
            <Download /> Excel
          </Button>
          {canChangeRoles && tab === 'roles' ? (
            <Button variant="gold" size="default" onClick={() => setEditingRole('new')} disabled={!roles.data}>
              <Plus /> New role
            </Button>
          ) : canChange ? null : (
            <span className="rounded-full bg-card px-4 py-2 text-sm text-muted-foreground shadow-card">View only</span>
          )}
        </div>
        {exportError && <p className="w-full text-right text-sm text-negative-ink">{exportError}</p>}
      </header>

      {blocker.state === 'blocked' && <div role="alertdialog" aria-label="Unsaved security rules" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gold-soft px-4 py-3"><p className="text-sm">You have unsaved security rules. Discard them and leave?</p><div className="flex gap-2"><Button variant="secondary" onClick={() => blocker.reset()}>Keep editing</Button><Button variant="destructive" onClick={() => blocker.proceed()}>Discard</Button></div></div>}
      <Tabs value={tab} onValueChange={(value) => setTab(String(value))}>
        <PillTabsList>
          <PillTabsTrigger value="roles">
            Roles {roles.data && <span className="text-xs opacity-70">{roleList.length}</span>}
          </PillTabsTrigger>
          <PillTabsTrigger value="people">
            People {accounts.data && <span className="text-xs opacity-70">{accounts.data.length}</span>}
          </PillTabsTrigger>
          <PillTabsTrigger value="sessions">
            Signed in {sessions.data && <span className="text-xs opacity-70">{sessions.data.length}</span>}
          </PillTabsTrigger>
          <PillTabsTrigger value="security">
            Security rules
          </PillTabsTrigger>
        </PillTabsList>

        <TabsContent value="roles" className="access-tab-panel mt-4">
          <p className="mb-3 text-xs text-muted-foreground">Only the active role supplies permissions and data access.</p>
          <SharedListNote area="ACCESS" label="Roles & access" what="changing a role" className="mb-3" />
          <FormError error={roles.error} />
          {roles.isPending ? (
            <RoleWorkspaceSkeleton label="Loading roles" />
          ) : roles.isError ? null : (
            <RoleWorkspace roles={roleList} areas={areas} canChange={canChangeRoles} onEdit={setEditingRole} />
          )}
        </TabsContent>

        <TabsContent value="people" className="access-tab-panel mt-4">
          <section className="space-y-3 rounded-3xl bg-card p-4 shadow-card sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-light tracking-tight">Employees with a login</h2>
                <p className="text-xs text-muted-foreground">
                  New logins and password resets get a temporary password, shown once, that must be changed at the next sign-in.
                </p>
              </div>
              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                <div className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
                  <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input aria-label="Search logins by name or code" className="h-9 rounded-full pl-9" placeholder="Search name or code" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                {canChange && (
                  <Button size="sm" className="max-sm:h-9" onClick={() => setLoginDialog({ reset: null })}>
                    <UserPlus /> Give login
                  </Button>
                )}
              </div>
            </div>
            <FormError error={accounts.error ?? unlock.error ?? enable.error} />
            {accounts.isPending ? (
              <LoginsTableSkeleton canChange={canChange} label="Loading logins" />
            ) : accounts.isError ? null : people.length === 0 ? (
              <p className="text-sm text-muted-foreground">{term ? 'Nobody matches.' : 'Nobody has a login yet.'}</p>
            ) : (
              <>
              <ul className="divide-y divide-border sm:hidden">
                {people.map((account) => <li key={account.employeeCode} className="space-y-3 py-4 first:pt-1">
                  <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words text-sm font-medium">{account.name}</h3><p className="text-xs text-muted-foreground">{account.employeeCode}</p></div><Pill tone={ACCOUNT_STATUS[account.status].tone}>{ACCOUNT_STATUS[account.status].label}</Pill></div>
                  <div className="flex flex-wrap gap-1.5">{account.disabled && <Pill tone="negative">Login turned off</Pill>}{account.lockedUntil && <Pill tone="negative">Locked</Pill>}{account.mustChangePassword && <Pill tone="warning">Temporary password</Pill>}</div>
                  {account.disabled?.reason && <p className="text-xs text-muted-foreground">{account.disabled.reason}</p>}
                  <div className="space-y-1.5">{account.roles.length === 0 ? <p className="text-xs text-muted-foreground">Self-service only</p> : account.roles.map((role) => <div key={role.id} className="text-xs"><span className="font-medium">{role.name}</span><span className="text-muted-foreground"> · {describeDataAccess(role.dataAccess, role.isSuperAdmin)}</span></div>)}</div>
                  <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-muted-foreground">Last login: {account.lastLoginAt ? formatDateTime(account.lastLoginAt) : 'Never'}</p>{accountActions(account)}</div>
                </li>)}
              </ul>
              <div className="max-sm:hidden"><Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 z-10 bg-card">Employee</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead>Last login</TableHead>
                    <TableHead className="text-right"><span className="sr-only">Actions</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {people.map((account) => {
                    return (
                      <TableRow key={account.employeeCode} className="group/row">
                        <TableCell className="sticky left-0 z-10 bg-card py-1.5 group-hover/row:bg-[color-mix(in_srgb,var(--muted)_50%,var(--card))] max-sm:max-w-36 max-sm:whitespace-normal">
                          <span className="block font-medium">{account.name}</span>
                          <span className="block text-xs text-muted-foreground">{account.employeeCode}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1.5">
                            <Pill tone={ACCOUNT_STATUS[account.status].tone}>{ACCOUNT_STATUS[account.status].label}</Pill>
                            {account.disabled && (
                              <Pill tone="negative">
                                <span title={`${account.disabled.reason ?? ''} - by ${account.disabled.by?.name ?? '?'}, ${formatDateTime(account.disabled.at)}`}>Login turned off</span>
                              </Pill>
                            )}
                            {account.lockedUntil && <Pill tone="negative">Locked</Pill>}
                            {account.mustChangePassword && <Pill tone="warning">Temporary password</Pill>}
                          </div>
                          {account.disabled?.reason && <p className="mt-1 max-w-56 truncate text-xs text-muted-foreground">{account.disabled.reason}</p>}
                        </TableCell>
                        <TableCell className="max-w-80 whitespace-normal">
                          <div className="flex flex-wrap gap-1.5">
                            {account.roles.length === 0 && <span className="text-xs text-muted-foreground">Self-service only</span>}
                            {account.roles.map((r) => (
                              <Pill key={r.id} tone={r.isSuperAdmin ? 'info' : 'neutral'}>
                                <span
                                  title={r.dataAccess
                                    .map((row) => `${[row.company ?? 'All companies', row.plant ?? 'all plants', row.department ?? 'all departments'].join(' · ')} (${LEVEL_LABEL[row.level]})`)
                                    .join(' / ')}
                                >
                                  {r.name} <span className="font-normal text-muted-foreground">· {describeDataAccess(r.dataAccess, r.isSuperAdmin)}</span>
                                </span>
                              </Pill>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                          {account.lastLoginAt ? formatDateTime(account.lastLoginAt) : 'Never'}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {accountActions(account)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table></div>
              </>
            )}
          </section>
        </TabsContent>

        <TabsContent value="security" keepMounted className="access-tab-panel mt-4">
          <SharedListNote area="ACCESS" label="Roles & access" what="changing the security rules" className="mb-3" />
          <SecurityRules canChange={canChangeRoles} onDirtyChange={setSecurityDirty} />
        </TabsContent>

        <TabsContent value="sessions" className="access-tab-panel mt-4">
          <section className="space-y-3 rounded-3xl bg-card p-4 shadow-card sm:p-5">
            <div>
              <h2 className="text-lg font-light tracking-tight">Signed in now</h2>
              <p className="text-xs text-muted-foreground">Everyone with a session that has not ended - a session ends at log out, when its time is up (Security rules), or here.</p>
            </div>
            <FormError error={sessions.error ?? endSession.error ?? endAll.error} />
            {sessions.isPending ? (
              <SessionsSkeleton canEnd={canChange} label="Loading who is signed in" />
            ) : sessions.isError ? null : (
              <SessionsList
                sessions={sessions.data ?? []}
                ending={endSession.isPending}
                onEnd={canChange ? (session) => endSession.mutate({ sessionId: session.id }) : undefined}
              />
            )}
            {canChange && (sessions.data?.length ?? 0) > 0 && (
              <p className="text-xs text-muted-foreground">
                To log someone out on every device, use{' '}
                <span className="inline-flex items-center gap-1 font-medium">
                  <LogOut className="size-3" /> Log out everywhere
                </span>{' '}
                on the People tab.
              </p>
            )}
          </section>
        </TabsContent>
      </Tabs>

      {editingRole && (
        <RoleDialog role={editingRole === 'new' ? null : editingRole} areas={areas} onClose={() => setEditingRole(null)} />
      )}
      {editingAccount && (
        <PersonRolesDialog account={editingAccount} roles={roleList} areas={areas} onClose={() => setEditingAccount(null)} />
      )}
      {loginDialog && <LoginDialog reset={loginDialog.reset} onClose={() => setLoginDialog(null)} />}
      {disabling && <DisableLoginDialog account={disabling} onClose={() => setDisabling(null)} />}
    </div>
  )
}
