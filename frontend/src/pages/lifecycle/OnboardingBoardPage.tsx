/**
 * Onboarding Bridge & Conversion Console (LC-01, LC-02, SOW-022..026, SOW-032).
 *
 * Implements:
 * - Candidate Pipeline with status filters (Awaiting Pre-join, Link Sent, Pre-join Done, Converted).
 * - ATS / LOI candidate intake with a server-validated pre-join link.
 * - Real-time Duplicate Detection against employee master (Mobile, Email, PAN).
 * - Atomic HR Conversion Wizard (ecode generation, master record, probation salary, task fan-out).
 * - Post-conversion Stakeholder Task Orchestration across IT, Admin, HR, Payroll with SLA tracking.
 * - Kent Biometric Enrollment verification gate.
 */

import { useState, useEffect, useId, useCallback, useRef } from 'react';
import { UserPlus, Copy, ShieldCheck, ShieldAlert } from 'lucide-react';
import { Button, Card, CardHeader, DataTable, PageHeader, StatGrid, StatTile, toast, type SelectOption } from '../../ui';
import { OnboardingDrawers } from './OnboardingDrawers';
import { OnboardingTasks } from './OnboardingBoardViews';
import { onboardingColumns } from './onboarding-columns';
import type { CandidateItem, StakeholderTaskItem, SelectOptionSource } from './onboarding-types';
import { useOnboardingReferences } from './useOnboardingReferences';
import { todayISOIST } from '../../lib/date';
import { apiFetch } from '../../lib/api';

const STATUS_OPTIONS: { code: string; label: string }[] = [
  { code: 'all', label: 'All Candidates' },
  { code: 'link_sent', label: 'Link Sent' },
  { code: 'prejoin_done', label: 'Pre-join Done' },
  { code: 'converted', label: 'Converted' },
  { code: 'awaiting_prejoin', label: 'Awaiting Link' },
  { code: 'no_show', label: 'Did not join' },
];

const referenceOptions = (rows: SelectOptionSource[] | undefined): SelectOption[] => rows?.map(row=>({value:String(row.id),label:row.name})) ?? [];

export function OnboardingBoardPage() {
  const [candidates, setCandidates] = useState<CandidateItem[]>([]);
  const [tasks, setTasks] = useState<StakeholderTaskItem[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(true);

  // Ingest candidate drawer
  const [ingestError,setIngestError]=useState<string|null>(null);
  const [ingesting,setIngesting]=useState(false);
  const ingestingRef=useRef(false);
  const [ingestOpen, setIngestOpen] = useState<boolean>(false);
  const [ingestForm, setIngestForm] = useState({
    fullName: '',
    personalEmail: '',
    mobile: '',
    positionTitle: '',
    department: '',
    companyId: '',
    offeredCtc: '',
    proposedDoj: '',
    offerDate: '',
    totalExperienceYears: '',
    previousCompany: '',
  });

  // Conversion wizard drawer
  const [convertOpen, setConvertOpen] = useState<boolean>(false);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateItem | null>(null);
  const [convertForm, setConvertForm] = useState({
    companyId: '',
    orgUnitId: '', departmentId: '',
    designationId: '',
    locationId: '',
    workEmail: '',
    doj: '',
    salaryStructureId: '',
  });

  const [candidateError, setCandidateError] = useState<string | null>(null);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [applicationReady,setApplicationReady]=useState(false);
  const [joiningConfirmed, setJoiningConfirmed] = useState(false);
  const [conversionError, setConversionError] = useState<string|null>(null);
  const [converting, setConverting] = useState(false);
  const convertingRef = useRef(false);
  const referenceCompany = convertOpen ? convertForm.companyId : ingestForm.companyId;
  const references = useOnboardingReferences(referenceCompany);
  const COMPANY_OPTIONS: SelectOption[] = references.data?.companies.map(c=>({value:String(c.id),label:`${c.name} (${c.ecodePrefix}…)`})) ?? [];
  const DEPARTMENT_OPTIONS = referenceOptions(references.data?.departments);
  const DESIGNATION_OPTIONS = referenceOptions(references.data?.designations);
  const ORG_UNIT_OPTIONS=referenceOptions(references.data?.orgUnits);
  const LOCATION_OPTIONS = referenceOptions(references.data?.locations);
  const STRUCTURE_OPTIONS = referenceOptions(references.data?.salaryStructures);

  // Duplicate check state
  const [dupResult, setDupResult] = useState<{ checked: boolean; isDup: boolean; detail?: string }>({
    checked: false,
    isDup: false,
  });

  // Generated link feedback
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const filterSelectId = useId();

  const loadData = useCallback(async () => {
    setLoading(true); setCandidateError(null); setTaskError(null);
    try {
    const [candidateResult, taskResult] = await Promise.allSettled([
      apiFetch<{candidates:CandidateItem[]}>('/api/lifecycle/candidates'),
      apiFetch<{tasks:StakeholderTaskItem[]}>('/api/lifecycle/tasks'),
    ]);
    if(candidateResult.status==='fulfilled') setCandidates(candidateResult.value.candidates);
    else { setCandidates([]); setCandidateError(candidateResult.reason instanceof Error ? candidateResult.reason.message : 'Candidate queue could not be loaded.'); }
    if(taskResult.status==='fulfilled') setTasks(taskResult.value.tasks);
    else { setTasks([]); setTaskError(taskResult.reason instanceof Error ? taskResult.reason.message : 'Onboarding tasks could not be loaded.'); }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredCandidates = candidates.filter((c) => {
    if (selectedStatus === 'all') return true;
    return c.status === selectedStatus;
  });

  const handleIngestSubmit = async () => {
    if(ingestingRef.current) return;
    if(references.loading || references.error || !references.data?.companies.some(company=>String(company.id)===ingestForm.companyId)) {setIngestError('Load and select the accepted employing company.');return;}
    if(!ingestForm.fullName.trim() || !ingestForm.personalEmail.trim() || !ingestForm.mobile.trim() || !ingestForm.positionTitle.trim() || !ingestForm.offerDate || !ingestForm.proposedDoj || !ingestForm.offeredCtc.trim() || !Number.isFinite(Number(ingestForm.offeredCtc)) || Number(ingestForm.offeredCtc)<0) {setIngestError('Complete the candidate identity, position, offer dates and annual CTC.');return;}
    ingestingRef.current=true;setIngesting(true);setIngestError(null);
    try {
      const res = await apiFetch<{ candidateId: number; rawToken: string }>('/api/lifecycle/candidates/ingest', {
        method: 'POST',
        body: JSON.stringify({
          fullName: ingestForm.fullName,
          personalEmail: ingestForm.personalEmail,
          mobile: ingestForm.mobile,
          positionTitle: ingestForm.positionTitle,
          department: ingestForm.department,
          companyId: Number(ingestForm.companyId),
          offeredCtc: Number(ingestForm.offeredCtc),
          proposedDoj: ingestForm.proposedDoj,
          offerDate: ingestForm.offerDate,
          totalExperienceYears: ingestForm.totalExperienceYears ? Number(ingestForm.totalExperienceYears) : undefined,
          previousCompany: ingestForm.previousCompany,
        }),
      });

      toast.success('Candidate added to the pipeline. Pre-join link generated.');
      setIngestOpen(false);
      setCopiedToken(res.rawToken);
      void loadData();
    } catch (err: unknown) {
      setIngestError(err instanceof Error ? err.message : 'Failed to ingest candidate');
    } finally {ingestingRef.current=false;setIngesting(false);}
  };

  const handleCheckDuplicate = async (c: CandidateItem) => {
    try {
      const res = await apiFetch<{
        hasDuplicate: boolean;
        duplicateField?: string;
        existingEcode?: string;
        existingName?: string;
      }>('/api/lifecycle/candidates/check-duplicate', {
        method: 'POST',
        body: JSON.stringify({
          email: c.personalEmail,
          mobile: c.mobile,
        }),
      });

      if (res.hasDuplicate) {
        setDupResult({
          checked: true,
          isDup: true,
          detail: `Matched existing employee ${res.existingEcode ?? ''} (${res.existingName ?? ''}) on ${res.duplicateField ?? ''}`,
        });
        toast.error(`Duplicate detected! Matched ${res.existingEcode ?? ''}`);
      } else {
        setDupResult({
          checked: true,
          isDup: false,
          detail: 'No matching employee found within your permitted data scope. Final conversion checks identities again.',
        });
        toast.success('No duplicate employee found.');
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Duplicate check failed');
    }
  };

  const openConvertWizard = (c: CandidateItem) => {
    setSelectedCandidate(c);
    setJoiningConfirmed(false); setApplicationReady(false); setConversionError(null);
    setConvertForm({
      companyId: c.companyId ? String(c.companyId) : '',
      orgUnitId: '', departmentId: '',
      designationId: '',
      locationId: '',
      workEmail: '',
      doj: c.proposedDoj,
      salaryStructureId: '',
    });
    setConvertOpen(true);
  };

  const handleConvertSubmit = async () => {
    if (!selectedCandidate || convertingRef.current) return;
    if (!applicationReady) { setConversionError('Load and review the submitted application first.'); return; }
    if (!joiningConfirmed) { toast.error('Confirm that HR reviewed the completed application and verified actual joining.'); return; }
    if (selectedCandidate.status !== 'prejoin_done' || !selectedCandidate.hasPrejoinData) { toast.error('The candidate must submit the completed application first.'); return; }
    if (!convertForm.doj || convertForm.doj > todayISOIST()) { setConversionError('Enter an actual joining date that is today or earlier.'); return; }
    if (references.loading || references.error) { toast.error('Load the verified master choices before creating the employee.'); return; }
    if (![convertForm.companyId,convertForm.orgUnitId,convertForm.departmentId,convertForm.designationId,convertForm.locationId,convertForm.salaryStructureId].every(value => Number.isSafeInteger(Number(value)) && Number(value)>0)) { setConversionError('Select the employing company, department, designation, location and approved salary structure.'); return; }
    setConversionError(null); convertingRef.current=true; setConverting(true);
    try {
      const res = await apiFetch<{ employeeId: number; ecode: string }>('/api/lifecycle/candidates/convert', {
        method: 'POST',
        body: JSON.stringify({
          candidateId: selectedCandidate.id,
          joiningConfirmed: true,
          companyId: Number(convertForm.companyId),
          designationId: Number(convertForm.designationId),
          departmentId: Number(convertForm.departmentId),
          locationId: Number(convertForm.locationId),
          orgUnitId:Number(convertForm.orgUnitId),
          workEmail: convertForm.workEmail || undefined,
          doj: convertForm.doj,
          salaryStructureId: Number(convertForm.salaryStructureId),
        }),
      });

      toast.success(`Candidate successfully converted! Generated e-code: ${res.ecode}`);
      setConvertOpen(false);
      void loadData();
    } catch (err: unknown) {
      setConversionError(err instanceof Error ? err.message : 'Conversion failed');
    } finally { convertingRef.current=false; setConverting(false); }
  };

  const handleVerifyBiometric = async (employeeId: number) => {
    try {
      await apiFetch<{ success: boolean }>('/api/lifecycle/biometric/verify', {
        method: 'POST',
        body: JSON.stringify({ employeeId }),
      });
      toast.success('Kent biometric enrollment verified and task marked complete.');
      void loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Biometric verification failed');
    }
  };

  const handleCompleteTask = async (taskId: number) => {
    try {
      await apiFetch<{ success: boolean }>('/api/lifecycle/tasks/complete', {
        method: 'POST',
        body: JSON.stringify({ taskId, notes: 'Completed via HRMS Onboarding Board' }),
      });
      toast.success('Onboarding task marked complete.');
      void loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Task completion failed');
    }
  };

  const issuingLink=useRef(false);
  async function issuePrejoinLink(candidate:CandidateItem){
    if(issuingLink.current)throw new Error('Another prejoin link is being created. Please try again.');issuingLink.current=true;
    try{
      const result=await apiFetch<{rawToken:string;expiresAt:string}>(`/api/lifecycle/candidates/${String(candidate.id)}/prejoin-link`,{method:'POST',body:JSON.stringify({candidateId:candidate.id})});
      setCopiedToken(result.rawToken);toast.success('New prejoin link created. Any earlier unsubmitted link is now invalid.');
    }finally{issuingLink.current=false;}
  }
  const columns = onboardingColumns(references.data?.companies, handleCheckDuplicate, openConvertWizard, issuePrejoinLink);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Lifecycle / Onboarding"
        title="Onboarding"
        description="Keep accepted candidates separate from employee MIS while they complete onboarding. A permanent company-prefix ID is issued only after HR confirms actual joining."
        actions={
          <Button
            variant="primary"
            leadingIcon={<UserPlus className="h-4 w-4" />}
            onClick={() => { setIngestOpen(true); }}
          >
            Add candidate
          </Button>
        }
      />

      {candidateError && <div role="alert" className="space-y-2"><p className="text-sm text-negative-ink">{candidateError}</p><Button variant="secondary" onClick={()=>{void loadData();}}>Retry onboarding data</Button></div>}
      {/* Quick KPI stats row */}
      <StatGrid>
        <StatTile tone="accent" label="In pipeline" value={candidateError ? '—' : candidates.filter(c=>['awaiting_prejoin','link_sent','prejoin_done'].includes(c.status)).length} />
        <StatTile label="Pre-join completed" value={candidateError ? '—' : candidates.filter((c) => c.status === 'prejoin_done').length} />
        <StatTile label="Employees created" value={candidateError ? '—' : candidates.filter((c) => c.status === 'converted').length} />
        <StatTile tone="hatched" label="Open IT/Admin tasks" value={taskError ? '—' : tasks.filter((t) => t.status === 'open' || t.status === 'escalated').length} />
      </StatGrid>

      {/* Copied token notification box */}
      {copiedToken && (
        <Card className="border border-line bg-surface-2 p-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium text-ink">Active Candidate Pre-join Portal Link</p>
              <p className="text-xs text-ink-muted">
                Share this generated link through the approved onboarding channel. Expiry is checked by the server.
              </p>
              <code className="mt-1 block text-xs font-mono text-ink">
                {window.location.origin}/onboard/prejoin?token={copiedToken}
              </code>
            </div>
            <Button
              size="sm"
              variant="secondary"
              leadingIcon={<Copy className="h-4 w-4" />}
              onClick={() => {
                void navigator.clipboard.writeText(`${window.location.origin}/onboard/prejoin?token=${copiedToken}`).then(() => { toast.success('Pre-join link copied.'); }).catch(() => { toast.error('Could not copy the link. Select and copy it manually.'); });
              }}
            >
              Copy Link
            </Button>
          </div>
        </Card>
      )}

      {/* Duplicate Check Banner Result */}
      {dupResult.checked && (
        <Card className={`p-4 border ${dupResult.isDup ? 'border-line bg-surface-2' : 'border-line bg-surface-2'}`}>
          <div className="flex items-center gap-3">
            {dupResult.isDup ? (
              <ShieldAlert className="h-5 w-5 text-warning-ink" />
            ) : (
              <ShieldCheck className="h-5 w-5 text-positive-ink" />
            )}
            <p className={`text-sm ${dupResult.isDup ? 'text-ink' : 'text-ink'}`}>
              {dupResult.detail}
            </p>
          </div>
        </Card>
      )}

      {/* Main Candidate Table */}
      <Card>
        <CardHeader headingLevel={2}
          title="Onboarding Pipeline"
          subtitle="Candidate records awaiting submission, pre-join completion, or master conversion."
          action={
            <div className="flex items-center gap-2">
              <label htmlFor={filterSelectId} className="sr-only">
                Filter by Status
              </label>
              <select
                id={filterSelectId}
                aria-label="Filter candidates by status"
                className="rounded-lg border border-line bg-surface-1 px-3 py-1.5 text-xs text-ink"
                value={selectedStatus}
                onChange={(e) => { setSelectedStatus(e.target.value); }}
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.code} value={opt.code}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          }
        />

        {loading ? (
          <div className="p-8 text-center text-sm text-ink-muted">Loading onboarding board…</div>
        ) : (
          <DataTable
            rows={filteredCandidates}
            columns={columns}
            rowKey={(r) => String(r.id)}
          />
        )}
      </Card>

      <OnboardingTasks tasks={tasks} taskError={taskError} onVerifyBiometric={handleVerifyBiometric} onCompleteTask={handleCompleteTask} />

      <OnboardingDrawers {...{applicationReady,setApplicationReady,ingestError,ingesting,ingestOpen,setIngestOpen,ingestForm,setIngestForm,convertOpen,setConvertOpen,convertForm,setConvertForm,selectedCandidate,joiningConfirmed,setJoiningConfirmed,converting,conversionError,references,ORG_UNIT_OPTIONS,COMPANY_OPTIONS,DEPARTMENT_OPTIONS,DESIGNATION_OPTIONS,LOCATION_OPTIONS,STRUCTURE_OPTIONS,handleIngestSubmit,handleConvertSubmit}} />
    </div>
  );
}
