import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, KeyRound, LockOpen, LogOut, Plus, Power, PowerOff, Search, UserCog, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { FormError } from '@/components/FormError'
import { SharedListNote } from '@/components/SharedListNote'
import { Pill } from '@/components/Pill'
import { SessionsList } from '@/components/SessionsList'
import { AccessGridSkeleton } from '@/components/skeletons/access/AccessGridSkeleton'
import { LoginsTableSkeleton } from '@/components/skeletons/access/LoginsTableSkeleton'
import { SessionsSkeleton } from '@/components/skeletons/access/SessionsSkeleton'
import { SecurityRules } from './components/SecurityRules'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PillTabsList, PillTabsTrigger } from '@/components/PillTabs'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { useAccess } from '@/hooks/useAccess'
import { client, orpc } from '@/lib/orpc'
import { downloadFile, formatDateTime } from '@/lib/utils'
import { AccessGrid } from './components/AccessGrid'
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
  const [editingRole, setEditingRole] = useState<Role | 'new' | null>(null)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [search, setSearch] = useState('')
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

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-sm text-muted-foreground">Administration</p>
          <h1 className="mt-1 text-3xl font-light tracking-tight sm:text-4xl">Roles &amp; access</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground max-sm:hidden">
            A role gives <strong className="font-medium text-foreground">View</strong> or{' '}
            <strong className="font-medium text-foreground">Edit</strong> access to each part of the system. An employee can have several
            roles and gets the highest level any of them gives.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="lg" onClick={() => void downloadFile(() => client.accounts.roles.export(), setExportError)}>
            <Download /> Excel
          </Button>
          {canChangeRoles ? (
            <Button variant="gold" size="lg" onClick={() => setEditingRole('new')} disabled={!roles.data}>
              <Plus /> New role
            </Button>
          ) : canChange ? null : (
            <span className="rounded-full bg-card px-4 py-2 text-sm text-muted-foreground shadow-card">View only</span>
          )}
        </div>
        {exportError && <p className="w-full text-right text-sm text-negative-ink">{exportError}</p>}
      </header>

      <Tabs defaultValue="roles">
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

        <TabsContent value="roles" className="mt-5">
          <SharedListNote area="ACCESS" label="Roles & access" what="changing a role" className="mb-3" />
          <FormError error={roles.error} />
          {roles.isPending ? (
            <AccessGridSkeleton canChange={canChangeRoles} label="Loading roles" />
          ) : (
            <AccessGrid roles={roleList} areas={areas} canChange={canChangeRoles} onEdit={setEditingRole} />
          )}
        </TabsContent>

        <TabsContent value="people" className="mt-5">
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
                  <Input className="h-9 rounded-full pl-9 sm:h-8" placeholder="Search name or code" value={search} onChange={(e) => setSearch(e.target.value)} />
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
            ) : people.length === 0 ? (
              <p className="text-sm text-muted-foreground">{term ? 'Nobody matches.' : 'Nobody has a login yet.'}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 z-10 bg-card">Employee</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead>Last login</TableHead>
                    <TableHead className="text-right" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {people.map((account) => {
                    const isMe = account.employeeCode === me?.employeeCode
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
                        <TableCell className="whitespace-normal">
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
                          {isMe ? (
                            <span className="text-xs text-muted-foreground" title="Nobody can change their own roles or reset their own password here">
                              You
                            </span>
                          ) : (
                            canChange && (
                              <div className="flex justify-end gap-1">
                                {account.lockedUntil && (
                                  <Button variant="ghost" size="sm" disabled={unlock.isPending} onClick={() => unlock.mutate({ employeeCode: account.employeeCode })}>
                                    <LockOpen /> Unlock
                                  </Button>
                                )}
                                <Button variant="ghost" size="sm" onClick={() => setLoginDialog({ reset: account })}>
                                  <KeyRound /> Reset password
                                </Button>
                                {account.disabled ? (
                                  <Button variant="ghost" size="sm" disabled={enable.isPending} onClick={() => enable.mutate({ employeeCode: account.employeeCode })}>
                                    <Power /> Turn on
                                  </Button>
                                ) : (
                                  <Button variant="ghost" size="sm" onClick={() => setDisabling(account)}>
                                    <PowerOff /> Turn off
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={endAll.isPending || !sessions.data?.some((s) => s.employee?.employeeCode === account.employeeCode)}
                                  onClick={() => endAll.mutate({ employeeCode: account.employeeCode })}
                                >
                                  <LogOut /> Log out everywhere
                                </Button>
                                <Button variant="secondary" size="sm" disabled={!roles.data} onClick={() => setEditingAccount(account)}>
                                  <UserCog /> Change roles
                                </Button>
                              </div>
                            )
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </section>
        </TabsContent>

        <TabsContent value="security" className="mt-5">
          <SharedListNote area="ACCESS" label="Roles & access" what="changing the security rules" className="mb-3" />
          <SecurityRules canChange={canChangeRoles} />
        </TabsContent>

        <TabsContent value="sessions" className="mt-5">
          <section className="space-y-3 rounded-3xl bg-card p-4 shadow-card sm:p-5">
            <div>
              <h2 className="text-lg font-light tracking-tight">Signed in now</h2>
              <p className="text-xs text-muted-foreground">Everyone with a session that has not ended - a session ends at log out, when its time is up (Security rules), or here.</p>
            </div>
            <FormError error={sessions.error ?? endSession.error ?? endAll.error} />
            {sessions.isPending ? (
              <SessionsSkeleton canEnd={canChange} label="Loading who is signed in" />
            ) : (
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
