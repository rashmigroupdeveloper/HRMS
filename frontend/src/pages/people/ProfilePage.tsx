/**
 * Employee profile shell (P0-T33, docs/05 §4.2) — identity header + tab set.
 * Tab bodies are placeholders where Phase 1+ data is not yet available.
 * Compensation tab is omitted when `canViewCompensation` is false.
 */
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CalendarCheck, FileText, Inbox, Laptop, Palmtree, UserRound, Wallet } from 'lucide-react';
import { apiFetch, ApiError } from '../../lib/api';
import {
  Card,
  CardHeader,
  EmptyState,
  Pill,
  Skeleton,
  StatusBadge,
} from '../../ui';
import type { StatusTone } from '../../ui';

interface EmployeeProfile {
  ecode: string;
  name: string;
  photoPath: string | null;
  gender: string | null;
  dob: string | null;
  maritalStatus: string | null;
  bloodGroup: string | null;
  personalEmail: string | null;
  workEmail: string | null;
  mobile: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  presentAddress: string | null;
  permanentAddress: string | null;
  category: string | null;
  contractType: string | null;
  doj: string | null;
  dol: string | null;
  status: string;
  statusLabel: string;
  exitReason: string | null;
  confirmationDate: string | null;
  probationDueDate: string | null;
  entity: string;
  entityName: string;
  designation: string | null;
  department: string | null;
  locationName: string | null;
  gradeName: string | null;
  reportingManagerEcode: string | null;
  reportingManagerName: string | null;
  statutoryMasked: boolean;
  pan: string | null;
  aadhaar: string | null;
  uan: string | null;
  pfNumber: string | null;
  esicIpNumber: string | null;
  bankName: string | null;
  bankAccount: string | null;
  bankIfsc: string | null;
  paymentMode: string;
  canViewCompensation: boolean;
}

type TabId =
  | 'overview'
  | 'job'
  | 'compensation'
  | 'statutory'
  | 'documents'
  | 'attendance'
  | 'leave'
  | 'assets'
  | 'requests';

function toneForStatus(label: string): StatusTone {
  if (label === 'Confirmed') return 'positive';
  if (label === 'Probation' || label === 'Onboarding') return 'warning';
  if (label === 'Notice period') return 'info';
  if (label === 'Exited') return 'negative';
  return 'neutral';
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs font-medium text-ink-subtle">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{value && value !== '' ? value : '—'}</dd>
    </div>
  );
}

function MaskedNote({ masked }: { masked: boolean }) {
  if (!masked) return null;
  return (
    <p className="text-sm text-ink-muted">
      Statutory and bank details are hidden for your role.
    </p>
  );
}

/**
 * @param self When true, render the signed-in user's OWN profile via the
 *   self-service endpoint (/me route) — no e-code param, no directory back-link.
 */
export function ProfilePage({ self = false }: { self?: boolean } = {}) {
  const { ecode = '' } = useParams<{ ecode: string }>();
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>('overview');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const path = self ? '/api/employees/me' : `/api/employees/${encodeURIComponent(ecode)}`;
    void apiFetch<EmployeeProfile>(path)
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setProfile(null);
          setError(e instanceof ApiError ? e.message : 'Could not load this profile.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ecode, self]);

  if (loading) {
    return (
      <div className="space-y-4" aria-busy>
        <Skeleton className="h-8 w-48 rounded-lg" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (error !== null || profile === null) {
    return (
      <EmptyState
        icon={<UserRound />}
        title="Profile not found"
        description={error ?? (self ? 'We could not load your profile.' : `No employee with e-code ${ecode}.`)}
        action={
          <Link
            to={self ? '/' : '/people'}
            className="u-press inline-flex h-10 items-center gap-2 rounded-full bg-surface-2 px-5 text-sm font-medium text-ink"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {self ? 'Back to home' : 'Back to directory'}
          </Link>
        }
      />
    );
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'job', label: 'Job & Reporting' },
    ...(profile.canViewCompensation
      ? [{ id: 'compensation' as const, label: 'Compensation' }]
      : []),
    { id: 'statutory', label: 'Statutory & Bank' },
    { id: 'documents', label: 'Documents & Letters' },
    { id: 'attendance', label: 'Attendance' },
    { id: 'leave', label: 'Leave' },
    { id: 'assets', label: 'Assets' },
    { id: 'requests', label: 'Requests' },
  ];

  return (
    <div className="space-y-6">
      {self ? (
        <p className="text-sm text-ink-muted">My information</p>
      ) : (
        <Link
          to="/people"
          className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
        >
          <ArrowLeft className="size-4" aria-hidden />
          People
        </Link>
      )}

      <Card>
        <div className="flex flex-wrap items-start gap-4">
          <span className="grid size-16 place-items-center rounded-full bg-surface-2 text-lg font-semibold text-ink">
            {profile.name.charAt(0)}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-light tracking-tight text-ink">{profile.name}</h1>
            <p className="mt-1 text-sm text-ink-muted">
              {[profile.designation, profile.department].filter(Boolean).join(' · ') ||
                'No designation on file'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Pill accent>{profile.entity}</Pill>
              <Pill>{profile.ecode}</Pill>
              <StatusBadge tone={toneForStatus(profile.statusLabel)}>
                {profile.statusLabel}
              </StatusBadge>
            </div>
          </div>
        </div>
      </Card>

      <div
        role="tablist"
        aria-label="Profile sections"
        className="flex flex-wrap gap-1 border-b border-line/60 pb-px"
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={
              'u-press rounded-t-lg px-3.5 py-2 text-sm font-medium transition-colors ' +
              (tab === t.id
                ? 'border-b-2 border-accent text-ink'
                : 'text-ink-muted hover:text-ink')
            }
            onClick={() => {
              setTab(t.id);
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <Card>
          <CardHeader title="Overview" />
          <dl className="grid gap-4 sm:grid-cols-2">
            <Field label="Work email" value={profile.workEmail} />
            <Field label="Personal email" value={profile.personalEmail} />
            <Field label="Mobile" value={profile.mobile} />
            <Field label="Gender" value={profile.gender} />
            <Field label="Date of birth" value={profile.dob} />
            <Field label="Blood group" value={profile.bloodGroup} />
            <Field label="Marital status" value={profile.maritalStatus} />
            <Field label="Category" value={profile.category} />
            <Field label="Present address" value={profile.presentAddress} />
            <Field label="Permanent address" value={profile.permanentAddress} />
            <Field label="Emergency contact" value={profile.emergencyContactName} />
            <Field label="Emergency phone" value={profile.emergencyContactPhone} />
          </dl>
        </Card>
      )}

      {tab === 'job' && (
        <Card>
          <CardHeader title="Job & Reporting" />
          <dl className="grid gap-4 sm:grid-cols-2">
            <Field label="Entity" value={`${profile.entity} · ${profile.entityName}`} />
            <Field label="Designation" value={profile.designation} />
            <Field label="Department" value={profile.department} />
            <Field label="Location" value={profile.locationName} />
            <Field label="Grade" value={profile.gradeName} />
            <Field label="Date of joining" value={profile.doj} />
            <Field label="Confirmation" value={profile.confirmationDate} />
            <Field label="Probation due" value={profile.probationDueDate} />
            <Field label="Contract type" value={profile.contractType} />
            <Field label="Date of leaving" value={profile.dol} />
            <Field
              label="Reporting manager"
              value={
                profile.reportingManagerName
                  ? `${profile.reportingManagerName} (${profile.reportingManagerEcode ?? ''})`
                  : profile.reportingManagerEcode
              }
            />
            <Field label="Exit reason" value={profile.exitReason} />
          </dl>
        </Card>
      )}

      {tab === 'compensation' && (
        <Card>
          <EmptyState
            icon={<Wallet />}
            title="Compensation"
            description={self ? 'Your payslips, salary breakup and tax view live on My Pay.' : 'Salary structure and revision history are kept in Payroll, visible to payroll roles only.'}
            action={self ? <LinkButton to="/my/pay">Open My Pay</LinkButton> : undefined}
          />
        </Card>
      )}

      {tab === 'statutory' && (
        <Card>
          <CardHeader title="Statutory & Bank" />
          <MaskedNote masked={profile.statutoryMasked} />
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="PAN" value={profile.pan} />
            <Field label="Aadhaar" value={profile.aadhaar} />
            <Field label="UAN" value={profile.uan} />
            <Field label="PF number" value={profile.pfNumber} />
            <Field label="ESIC IP" value={profile.esicIpNumber} />
            <Field label="Bank" value={profile.bankName} />
            <Field label="Account" value={profile.bankAccount} />
            <Field label="IFSC" value={profile.bankIfsc} />
            <Field label="Payment mode" value={profile.paymentMode} />
          </dl>
        </Card>
      )}

      {tab === 'documents' && (
        <Card>
          <EmptyState
            icon={<FileText />}
            title="Documents & letters"
            description={self ? 'Appointment, confirmation and other letters issued to you are on My Letters.' : 'Letters issued to this employee are listed under Letters.'}
            action={<LinkButton to={self ? '/my/letters' : '/letters'}>{self ? 'Open My Letters' : 'Open Letters'}</LinkButton>}
          />
        </Card>
      )}
      {tab === 'attendance' && (
        <Card>
          <EmptyState
            icon={<CalendarCheck />}
            title="Attendance"
            description={self ? 'Your month calendar, punches and regularisations are on My Attendance.' : 'Day-by-day attendance for this employee is in the team grid and muster.'}
            action={<LinkButton to={self ? '/my/attendance' : '/attendance/muster'}>{self ? 'Open My Attendance' : 'Open muster'}</LinkButton>}
          />
        </Card>
      )}
      {tab === 'leave' && (
        <Card>
          <EmptyState
            icon={<Palmtree />}
            title="Leave"
            description={self ? 'Balances, applications and their status are on My Leave.' : 'Leave balances and the ledger are managed under Leave.'}
            action={<LinkButton to={self ? '/my/leave' : '/leave'}>{self ? 'Open My Leave' : 'Open Leave'}</LinkButton>}
          />
        </Card>
      )}
      {tab === 'assets' && (
        <Card>
          <EmptyState
            icon={<Laptop />}
            title="Assets"
            description="Laptops, phones, SIMs and other company assets issued to this employee are tracked in the asset register."
          />
        </Card>
      )}
      {tab === 'requests' && (
        <Card>
          <EmptyState
            icon={<Inbox />}
            title="Requests"
            description={self ? 'Leave, regularisation and OD requests you raised — with who has them now — are listed on My Leave and My Attendance.' : 'Requests this employee raised appear in the approvals inbox of whoever holds them.'}
            action={self ? <LinkButton to="/my/leave">See my requests</LinkButton> : undefined}
          />
        </Card>
      )}
    </div>
  );
}

/** A link that looks like the secondary Button — never a <button> nested in an <a>. */
function LinkButton({ to, children }: { to: string; children: string }) {
  return (
    <Link
      to={to}
      className="u-press inline-flex h-10 items-center gap-2 rounded-full bg-surface-2 px-5 text-sm font-medium text-ink transition-colors duration-(--motion-micro) hover:bg-[color-mix(in_srgb,var(--ink)_7%,var(--surface-2))]"
    >
      {children}
      <ArrowRight className="size-4" aria-hidden />
    </Link>
  );
}
