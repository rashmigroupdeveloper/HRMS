import { reportFile, reportSheet } from '#core/excel/report'
import { assertGroupWide, assertWholeSlice } from '#core/auth/scope'
import type { AccessArea, ApprovalBreachAction, ApprovalKind, ApproverType } from '#core/db/prisma'
import type { CurrentUser } from '#core/rpc/procedures'
import { accountsService } from '#modules/accounts'
import { employeesService } from '#modules/employees'
import { companiesService } from '#modules/organization'
import { ORPCError } from '@orpc/server'
import type { z } from 'zod'
import * as chainsRepository from './chains.repository.js'
import type { removeChainInput, saveChainInput } from './chains.schema.js'

// The approval chains (the user, 2026-11-20): for each kind of request, the steps it goes through in order - free-form
// (any steps, any order, any number: "manager only", "manager -> HOD -> HR -> HR Head"...). Chains are settings shared by
// every company, with a company's own chain winning over the shared one - their own access area, "Approval chains"
// (the user, 2026-11-20): Edit for all companies for the shared chain, for the whole company for its own.

// What each kind is, and what its confidential part is (shown only to steps set to see it)
export const KIND_INFO: Record<ApprovalKind, { label: string; confidential: string | null }> = {
  JOB_CHANGE: { label: 'Job / position change', confidential: null },
  SALARY_REVISION: { label: 'Salary revision', confidential: 'the salary figures' },
  SHIFT_CHANGE: { label: 'Shift change', confidential: null },
  LEAVE: { label: 'Leave', confidential: null },
  LEAVE_CANCEL: { label: 'Cancelling approved leave', confidential: null },
  REGULARIZATION: { label: 'Regularization (missed punch)', confidential: null },
  ON_DUTY: { label: 'On duty', confidential: null },
  COMP_OFF: { label: 'Comp-off claim', confidential: null },
}

export type ChainStep = {
  approverType: ApproverType
  roleId: number | null
  roleName: string | null
  accessArea: AccessArea | null
  // a ROLE / ACCESS step named to one holder (null: anyone holding it - the user, 2026-11-20)
  approverId: number | null
  seesConfidential: boolean
  // the time limit (2026-11-20): hours (null: none), what happens when it passes, the role to escalate to
  slaHours: number | null
  onBreach: ApprovalBreachAction
  escalateRoleId: number | null
  escalateRoleName: string | null
}

// Two steps decided by the same people (the same role, the same access, the same manager, the same named holder...) -
// asked once
type ApproverOf = Pick<ChainStep, 'approverType' | 'roleId' | 'accessArea'> & { approverId?: number | null }
export const sameApprover = (a: ApproverOf, b: ApproverOf) =>
  a.approverType === b.approverType &&
  (a.roleId ?? null) === (b.roleId ?? null) &&
  (a.accessArea ?? null) === (b.accessArea ?? null) &&
  (a.approverId ?? null) === (b.approverId ?? null)

// The steps of a request that follows several chains (a promotion with a hike: the job and the salary chain): every step
// once, in an order that keeps each chain's own order - a step both chains have is asked once, and sees the
// confidential part if either chain says so
export function mergeChains(chains: ChainStep[][]): ChainStep[] {
  const merged: ChainStep[] = []
  for (const chain of chains) {
    let at = 0
    for (const step of chain) {
      const found = merged.findIndex((m) => sameApprover(m, step))
      if (found >= 0) {
        merged[found] = { ...merged[found]!, seesConfidential: merged[found]!.seesConfidential || step.seesConfidential }
        at = Math.max(at, found + 1)
      } else {
        merged.splice(at, 0, step)
        at++
      }
    }
  }
  return merged
}

const toSteps = (chain: chainsRepository.ChainRow): ChainStep[] =>
  chain.steps.map((s) => ({
    approverType: s.approverType,
    roleId: s.roleId,
    roleName: s.role?.name ?? null,
    accessArea: s.accessArea,
    approverId: s.approverId,
    seesConfidential: s.seesConfidential,
    slaHours: s.slaHours,
    onBreach: s.onBreach,
    escalateRoleId: s.escalateRoleId,
    escalateRoleName: s.escalateRole?.name ?? null,
  }))

// The steps a new request follows: per kind, the company's own chain or else the shared one, merged. A kind with no
// chain adds no step (the request then goes to the fallback approver). A kind whose chain is switched off refuses it.
export async function stepsFor(kinds: ApprovalKind[], companyId: number) {
  const chains = await chainsRepository.listFor(kinds, companyId)
  return mergeChains(
    kinds.map((kind) => {
      const chain = chains.find((c) => c.kind === kind && c.companyId === companyId) ?? chains.find((c) => c.kind === kind && c.companyId === null)
      if (chain && !chain.isActive) {
        throw new ORPCError('CONFLICT', {
          message: `${KIND_INFO[kind].label} requests are switched off${chain.companyId ? ` for ${chain.company?.name ?? 'this company'}` : ''} - its approval chain is inactive (Approval rules page)`,
        })
      }
      return chain ? toSteps(chain) : []
    }),
  )
}

// --- Settings (the Approval rules page) ---

// Every kind with its shared chain and the companies' own chains - and what a step can name: the roles (which one is the
// fallback approver) and the access areas (whoever sets chains need not have Roles & access), each with its holders - a
// step can be named to one of them (the user, 2026-11-20)
export async function listChains() {
  const chains = await chainsRepository.list()
  const person = await employeesService.lookupPeople(chains.flatMap((c) => [c.updatedById, ...c.steps.map((s) => s.approverId)]))
  const holders = await accountsService.listChainApproverChoices()
  return {
    kinds: (Object.keys(KIND_INFO) as ApprovalKind[]).map((kind) => ({
      kind,
      ...KIND_INFO[kind],
      chains: chains
        .filter((c) => c.kind === kind)
        .map((c) => ({
          companyId: c.companyId,
          company: c.company,
          isActive: c.isActive,
          steps: toSteps(c).map((s) => ({ ...s, approver: person(s.approverId) })),
          updatedAt: c.updatedAt,
          updatedBy: person(c.updatedById),
        })),
    })),
    roles: (await accountsService.listRoleChoices()).map((role) => ({ ...role, holders: holders.byRole[role.id] ?? [] })),
    areas: accountsService.listAreaChoices().map((area) => ({ ...area, holders: holders.byArea[area.area] ?? [] })),
  }
}

function assertMayChange(viewer: CurrentUser, companyId: number | null) {
  if (companyId === null) assertGroupWide(viewer, 'APPROVAL_CHAINS', 'The shared approval chain')
  else assertWholeSlice(viewer, 'APPROVAL_CHAINS', { companyId, plantId: null, departmentId: null }, "The company's own approval chain")
}

// (the input as sent: the defaults - no time limit, wait - are filled in here too)
export async function saveChain(viewer: CurrentUser, { kind, companyId, isActive = true, steps }: z.input<typeof saveChainInput>) {
  assertMayChange(viewer, companyId)
  if (companyId !== null) await companiesService.getCompany(companyId)
  const roles = await accountsService.roleNames()
  const holders = steps.some((s) => s.approverId) ? await accountsService.listChainApproverChoices() : null
  const clean = steps.map((step, index) => {
    const at = `Step ${index + 1}`
    const pool = step.approverType === 'ROLE' || step.approverType === 'ACCESS'
    // a named holder must hold the role / access over the chain's whole reach (the user, 2026-11-20)
    if (pool && step.approverId) {
      const list = step.approverType === 'ROLE' ? holders!.byRole[step.roleId ?? 0] : holders!.byArea[step.accessArea!]
      const holder = list?.find((h) => h.employeeId === step.approverId)
      if (!holder || !(holder.everyCompany || (companyId !== null && holder.companyIds.includes(companyId)))) {
        throw new ORPCError('BAD_REQUEST', {
          message: `${at}: the person picked must hold this ${step.approverType === 'ROLE' ? 'role' : 'access'} for ${companyId === null ? 'every company' : 'the whole company'} and be able to sign in`,
        })
      }
    }
    if (step.approverType === 'ROLE' && (!step.roleId || !roles.has(step.roleId))) throw new ORPCError('BAD_REQUEST', { message: `${at}: pick the role that decides it` })
    if (step.approverType === 'ACCESS' && !step.accessArea) throw new ORPCError('BAD_REQUEST', { message: `${at}: pick the access that decides it` })
    if (step.escalateRoleId && !roles.has(step.escalateRoleId)) throw new ORPCError('BAD_REQUEST', { message: `${at}: the role to escalate to does not exist` })
    if (step.escalateRoleId && step.approverType === 'ROLE' && step.escalateRoleId === step.roleId) {
      throw new ORPCError('BAD_REQUEST', { message: `${at}: it escalates to its own role - pick another, or leave it empty` })
    }
    const slaHours = step.slaHours ?? null
    const onBreach = step.onBreach ?? 'WAIT'
    // "wait" without SLA hours: no reminder; every other action needs the hours it waits
    if (onBreach !== 'WAIT' && slaHours === null) throw new ORPCError('BAD_REQUEST', { message: `${at}: set the SLA hours after which it is done` })
    return {
      stepNo: index + 1,
      approverType: step.approverType,
      roleId: step.approverType === 'ROLE' ? step.roleId! : null,
      accessArea: step.approverType === 'ACCESS' ? step.accessArea! : null,
      approverId: pool ? (step.approverId ?? null) : null,
      seesConfidential: step.seesConfidential ?? false,
      slaHours,
      onBreach,
      escalateRoleId: onBreach === 'ESCALATE' ? (step.escalateRoleId ?? null) : null,
    }
  })
  clean.forEach((step, index) => {
    if (clean.slice(0, index).some((earlier) => sameApprover(earlier, step))) {
      throw new ORPCError('BAD_REQUEST', { message: `Step ${index + 1} is decided by the same people as an earlier step - each is asked once` })
    }
  })
  await chainsRepository.save(kind, companyId, isActive, clean, viewer.employeeId)
  return { kind, companyId, isActive, saved: true }
}

export async function removeChain(viewer: CurrentUser, { kind, companyId }: z.infer<typeof removeChainInput>) {
  assertMayChange(viewer, companyId)
  const removed = await chainsRepository.remove(kind, companyId)
  if (!removed.count) throw new ORPCError('NOT_FOUND', { message: 'This company has no chain of its own for that kind' })
  return { kind, companyId, removed: true }
}

export async function exportChains(viewer:CurrentUser){
  const data=await listChains()
  const rows=data.kinds.flatMap(k=>(k.chains.length?k.chains:[null]).flatMap(c=>(c?.steps.length?c.steps:[null]).map((step,index)=>({kind:k.label,chain:c,step,number:step?index+1:null}))))
  return reportFile([reportSheet('Approval steps',rows,[
    {header:'Request kind',value:r=>r.kind},{header:'Company',value:r=>r.chain ? r.chain.company?.code??'Shared' : 'No chain configured'},
    {header:'Status',value:r=>r.chain ? (r.chain.isActive?'Active':'Inactive') : 'Not configured'},{header:'Step',value:r=>r.number},
    {header:'Approver type',value:r=>r.step?.approverType},{header:'Role',value:r=>r.step?.roleName},
    {header:'Access area',value:r=>r.step?.accessArea},{header:'Named approver',value:r=>r.step?.approver?.name},
    {header:'Confidential data',value:r=>r.step ? (r.step.seesConfidential?'Yes':'No') : null},
    {header:'Time limit (hours)',value:r=>r.step?.slaHours},{header:'When overdue',value:r=>r.step?.onBreach},
    {header:'Updated by',value:r=>r.chain?.updatedBy?.name},{header:'Updated at',dateTime:true,value:r=>r.chain?.updatedAt},
  ])],{title:'Approval chains',preparedBy:`${viewer.name} (${viewer.employeeCode})`,
    coverage:'Shared and company approval-chain settings visible on this page; one row per configured step, with explicit rows for empty or unconfigured chains. Exporting does not decide requests.'},'approval-chains')
}
