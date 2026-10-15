/**
 * Public Candidate Pre-join Self-Service Portal (LC-01, SOW-024).
 *
 * Implements:
 * - 72-hour cryptographic token verification.
 * - Branded self-service intake of personal, statutory, and banking information.
 * - Single-use token invalidation upon successful submission.
 */

import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CheckCircle2,
  AlertCircle,
  Building2,
  Send,
  Lock,
} from 'lucide-react';
import {
  Button,
  Card,
  CardHeader,
  DarkCard,
  TextField,
  Select,
  type SelectOption,
} from '../../ui';

const BLOOD_GROUPS: SelectOption[] = [
  { value: 'A+', label: 'A Positive (A+)' },
  { value: 'A-', label: 'A Negative (A-)' },
  { value: 'B+', label: 'B Positive (B+)' },
  { value: 'B-', label: 'B Negative (B-)' },
  { value: 'AB+', label: 'AB Positive (AB+)' },
  { value: 'AB-', label: 'AB Negative (AB-)' },
  { value: 'O+', label: 'O Positive (O+)' },
  { value: 'O-', label: 'O Negative (O-)' },
];

export function PrejoinPortalPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState<boolean>(true);
  const [tokenValid, setTokenValid] = useState<boolean>(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [candidateInfo, setCandidateInfo] = useState<{
    candidateId?: number;
    candidateName?: string;
    positionTitle?: string;
  } | null>(null);

  const [submitted, setSubmitted] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const [form, setForm] = useState({
    presentAddress: '',
    permanentAddress: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelation: 'Spouse / Parent',
    bloodGroup: 'B+',
    pan: '',
    aadhaar: '',
    uan: '',
    bankName: '',
    bankAccount: '',
    bankIfsc: '',
  });

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function validate() {
      if (!token) {
        setTokenError('Pre-join link token is missing in URL.');
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/lifecycle/prejoin/validate?token=${encodeURIComponent(token)}`);
        const data = (await res.json()) as {
          isValid: boolean;
          candidateId?: number;
          candidateName?: string;
          positionTitle?: string;
          error?: string;
        };

        if (data.isValid) {
          setTokenValid(true);
          setCandidateInfo(data);
        } else {
          setTokenValid(false);
          setTokenError(data.error ?? 'Invalid or expired pre-join link token (72-hour window expired).');
        }
      } catch {
        setTokenValid(false);
        setTokenError('Failed to communicate with HRMS onboarding service.');
      }
      setLoading(false);
    }

    void validate();
  }, [token]);

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!token) return;

    if (!form.presentAddress || !form.permanentAddress) {
      setError('Both present and permanent addresses are required.');
      return;
    }
    if (form.pan.length !== 10) {
      setError('Permanent Account Number (PAN) must be exactly 10 alphanumeric characters.');
      return;
    }
    if (form.aadhaar.length !== 12) {
      setError('Aadhaar number must be exactly 12 numeric digits.');
      return;
    }
    if (!form.bankAccount || !form.bankIfsc) {
      setError('Bank account number and IFSC code are required for salary disbursement.');
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/lifecycle/prejoin/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          data: {
            presentAddress: form.presentAddress,
            permanentAddress: form.permanentAddress,
            emergencyContactName: form.emergencyContactName,
            emergencyContactPhone: form.emergencyContactPhone,
            emergencyContactRelation: form.emergencyContactRelation,
            bloodGroup: form.bloodGroup,
            pan: form.pan.toUpperCase().trim(),
            aadhaar: form.aadhaar.trim(),
            uan: form.uan ? form.uan.trim() : undefined,
            bankName: form.bankName.trim(),
            bankAccount: form.bankAccount.trim(),
            bankIfsc: form.bankIfsc.toUpperCase().trim(),
          },
        }),
      });

      if (!res.ok) {
        const errData = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(errData?.message ?? 'Failed to submit onboarding form.');
      }

      setSubmitted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-1 p-6">
        <div className="text-center">
          <p className="text-sm font-medium text-ink">Verifying secure pre-join link token…</p>
        </div>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-1 p-6">
        <Card className="max-w-md p-8 text-center space-y-4">
          <AlertCircle className="mx-auto h-12 w-12 text-amber-600" />
          <h2 className="text-xl font-light text-ink">Pre-join Link Invalid</h2>
          <p className="text-sm text-ink-muted leading-relaxed">
            {tokenError}
          </p>
          <p className="text-xs text-ink-faint">
            Please contact Rashmi Group HR Operations to request a new pre-joining link.
          </p>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-1 p-6">
        <Card className="max-w-md p-8 text-center space-y-4 border-emerald-300">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
          <h2 className="text-2xl font-light text-ink">Details Submitted!</h2>
          <p className="text-sm text-ink-muted leading-relaxed">
            Thank you, {candidateInfo?.candidateName ?? 'Candidate'}. Your statutory, contact, and banking details
            have been successfully encrypted and submitted into the Rashmi Group HRMS.
          </p>
          <div className="rounded-lg bg-surface-2 p-3 text-xs text-ink-muted">
            Our HR Operations team is preparing your Day-1 orientation, ID badge, and IT provisioning.
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-1 py-10 px-4 md:px-8">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-surface border border-brand-accent/40">
            <Building2 className="h-6 w-6 text-brand-accent" />
          </div>
          <div>
            <h1 className="text-lg font-medium text-ink">Rashmi Group</h1>
            <p className="text-xs text-ink-muted">Employee Self-Onboarding Portal</p>
          </div>
        </div>

        <DarkCard padded={false} className="p-8">
          <p className="text-xs uppercase tracking-widest text-hero-muted font-semibold">Welcome to Rashmi Group</p>
          <h2 className="mt-2 text-3xl font-light text-hero-ink">
            {candidateInfo?.candidateName ?? 'Candidate'}
          </h2>
          <p className="mt-1 text-sm text-hero-muted">
            Position: <span className="text-hero-ink font-medium">{candidateInfo?.positionTitle ?? 'Joining Member'}</span>
          </p>
          <p className="mt-4 text-xs leading-relaxed text-hero-muted">
            Please provide your verified statutory identifiers (PAN, Aadhaar) and bank account details for payroll
            deposit. This portal uses bank-grade encryption and will expire once submitted.
          </p>
        </DarkCard>

        {error && (
          <Card className="border-amber-400 bg-amber-50/70 p-4">
            <div className="flex items-center gap-3 text-amber-900 text-sm">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
              <span>{error}</span>
            </div>
          </Card>
        )}

        <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-6">
          <Card className="p-6 space-y-4">
            <CardHeader
              title="1. Residential Address Details"
              subtitle="Required for statutory PF/ESIC records and official communication."
            />
            <TextField
              label="Present Address (Current Residence)"
              value={form.presentAddress}
              onChange={(e) => { setForm({ ...form, presentAddress: e.target.value }); }}
              placeholder="House/Flat No, Street, City, State, PIN Code"
            />
            <TextField
              label="Permanent Address (As per Aadhaar)"
              value={form.permanentAddress}
              onChange={(e) => { setForm({ ...form, permanentAddress: e.target.value }); }}
              placeholder="Permanent native address"
            />
          </Card>

          <Card className="p-6 space-y-4">
            <CardHeader
              title="2. Emergency Contact & Medical"
              subtitle="Contact in case of workplace emergency or plant safety alerts."
            />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <TextField
                label="Emergency Contact Name"
                value={form.emergencyContactName}
                onChange={(e) => { setForm({ ...form, emergencyContactName: e.target.value }); }}
                placeholder="Full name of contact person"
              />
              <TextField
                label="Emergency Contact Phone"
                value={form.emergencyContactPhone}
                onChange={(e) => { setForm({ ...form, emergencyContactPhone: e.target.value }); }}
                placeholder="10-digit mobile number"
              />
              <TextField
                label="Relationship"
                value={form.emergencyContactRelation}
                onChange={(e) => { setForm({ ...form, emergencyContactRelation: e.target.value }); }}
                placeholder="e.g. Spouse, Father, Mother"
              />
              <Select
                label="Blood Group"
                value={form.bloodGroup}
                onChange={(val) => { setForm({ ...form, bloodGroup: val }); }}
                options={BLOOD_GROUPS}
              />
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <CardHeader
              title="3. Statutory Identifiers (Government Compliance)"
              subtitle="Mandatory for Income Tax TDS, EPFO provident fund, and statutory gratuity."
            />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <TextField
                label="PAN Number (10 characters)"
                value={form.pan}
                onChange={(e) => { setForm({ ...form, pan: e.target.value.toUpperCase() }); }}
                placeholder="ABCDE1234F"
              />
              <TextField
                label="Aadhaar Number (12 numeric digits)"
                value={form.aadhaar}
                onChange={(e) => { setForm({ ...form, aadhaar: e.target.value }); }}
                placeholder="1234 5678 9012"
              />
            </div>
            <TextField
              label="Existing UAN (EPF Universal Account Number - Optional)"
              value={form.uan}
              onChange={(e) => { setForm({ ...form, uan: e.target.value }); }}
              placeholder="Leave blank if this is your first formal employment"
            />
          </Card>

          <Card className="p-6 space-y-4">
            <CardHeader
              title="4. Direct Bank Account for Salary Credit"
              subtitle="Monthly net salary is disbursed directly into this savings account."
            />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <TextField
                label="Bank Name"
                value={form.bankName}
                onChange={(e) => { setForm({ ...form, bankName: e.target.value }); }}
                placeholder="State Bank of India / HDFC Bank"
              />
              <TextField
                label="IFSC Code (11 alphanumeric characters)"
                value={form.bankIfsc}
                onChange={(e) => { setForm({ ...form, bankIfsc: e.target.value.toUpperCase() }); }}
                placeholder="SBIN0001234"
              />
            </div>
            <TextField
              label="Savings Bank Account Number"
              value={form.bankAccount}
              onChange={(e) => { setForm({ ...form, bankAccount: e.target.value }); }}
              placeholder="Account number as printed on bank passbook / cheque"
            />
          </Card>

          <div className="flex items-center justify-between pt-4">
            <div className="flex items-center gap-2 text-xs text-ink-faint">
              <Lock className="h-4 w-4" />
              <span>TLS encrypted • Rashmi Group Privacy Policy</span>
            </div>

            <Button
              variant="primary"
              leadingIcon={<Send className="h-4 w-4" />}
              disabled={submitting}
            >
              {submitting ? 'Encrypting & Submitting…' : 'Submit Onboarding Information'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
