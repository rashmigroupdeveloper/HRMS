/**
 * Public Candidate Pre-join Self-Service Portal (LC-01, SOW-024).
 *
 * Implements:
 * - Server-configured cryptographic token verification.
 * - Branded self-service intake of personal, statutory, and banking information.
 * - Single-use token invalidation upon successful submission.
 */

import { useState, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import { EMPTY_PREJOIN_FORM, educationRows, familyRows, nominationRows, stepError, structured, validatePrejoinForm, type JoiningFormKind, type PrejoinForm } from './prejoin-form';

function patchRow<K extends 'educationRows' | 'familyRows' | 'nominations'>(form: PrejoinForm, key: K, index: number, patch: Partial<PrejoinForm[K][number]>): PrejoinForm {
  const rows = form[key].map((row, i) => (i === index ? { ...row, ...patch } : row));
  return { ...form, [key]: rows };
}

async function readJoiningFile(
  file: File | undefined,
  documentType: 'photo' | 'id_proof',
  setFiles: Dispatch<SetStateAction<{ documentType: 'photo' | 'id_proof'; fileName: string; mime: 'application/pdf' | 'image/png' | 'image/jpeg'; content: string }[]>>,
): Promise<void> {
  if (!file) return;
  if (file.type !== 'application/pdf' && file.type !== 'image/png' && file.type !== 'image/jpeg') return;
  const mime = file.type;
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const content = btoa(binary);
  setFiles((current) => [...current.filter((item) => item.documentType !== documentType), { documentType, fileName: file.name, mime, content }]);
}
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, AlertCircle, Building2, Send, Lock } from 'lucide-react';
import { Button, Card, CardHeader, DarkCard, TextField, Select, type SelectOption } from '../../ui';

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
          category?: string;
        } | null>(null);

  const [submitted, setSubmitted] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const [form, setForm] = useState({ ...EMPTY_PREJOIN_FORM });
  const [step, setStep] = useState(0);
  const [files, setFiles] = useState<{ documentType: 'photo' | 'id_proof'; fileName: string; mime: 'application/pdf' | 'image/png' | 'image/jpeg'; content: string }[]>([]);
  const submittingRef = useRef(false);
  const tokenVersion = useRef(0);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    tokenVersion.current += 1;
    setLoading(true);
    setTokenValid(false);
    setTokenError(null);
    setCandidateInfo(null);
    setForm({ ...EMPTY_PREJOIN_FORM });
    setError(null);
    setSubmitted(false);
    setSubmitting(false);
    submittingRef.current = false;
    async function validate() {
      try {
        if (!token) {
          if (!cancelled) setTokenError('Pre-join link token is missing in URL.');
          return;
        }
        const res = await fetch(
          `/api/lifecycle/prejoin/validate?token=${encodeURIComponent(token)}`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error('Prejoin link could not be validated. Please contact HR.');
        const data = (await res.json()) as {
          isValid: boolean;
          candidateId?: number;
          candidateName?: string;
          positionTitle?: string;
          category?: string;
          error?: string;
        };
        if (cancelled) return;
        if (data.isValid && typeof data.candidateId === 'number') {
          setTokenValid(true);
          setCandidateInfo(data);
          if (data.category === 'consultant') {
            setForm((current) => ({ ...current, formKind: 'consultant' }));
          }
        } else
          setTokenError(
            data.error ??
              'This prejoin link is invalid or expired. Please request a new link from HR.',
          );
      } catch (cause: unknown) {
        if (!cancelled)
          setTokenError(
            cause instanceof Error ? cause.message : 'Failed to contact the onboarding service.',
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void validate();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [token]);

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!token || !tokenValid || submittingRef.current) return;
    const validationError = validatePrejoinForm(form);
    if (validationError) {
      setError(validationError);
      return;
    }
    const version = tokenVersion.current;
    submittingRef.current = true;
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
            bloodGroup: form.bloodGroup.trim() ? form.bloodGroup.trim() : undefined,
            pan: form.formKind === 'overseas' ? undefined : form.pan.toUpperCase().trim(),
            aadhaar: form.formKind === 'overseas' ? undefined : form.aadhaar.trim(),
            uan: form.formKind === 'regular' && form.uan ? form.uan.trim() : undefined,
            bankName: form.bankName.trim(),
            bankAccount: form.bankAccount.trim(),
            bankIfsc: form.bankIfsc.toUpperCase().trim(),
            formKind: form.formKind,
            declarationAccepted: true,
            ...(form.fatherName.trim() ? { fatherName: form.fatherName.trim() } : {}),
            ...(form.passportNo.trim() ? { passportNo: form.passportNo.trim() } : {}),
            ...(form.nomineeName.trim() ? { nomineeName: form.nomineeName.trim(), nomineeRelation: form.nomineeRelation.trim() } : {}),
            ...(form.gender === 'Male' || form.gender === 'Female' || form.gender === 'Transgender'
              ? { gender: form.gender === 'Male' ? 'male' : form.gender === 'Female' ? 'female' : 'transgender' }
              : {}),
            ...(structured(form.presentHouse, form.presentCity, form.presentDistrict, form.presentState, form.presentPin)
              ? { presentStructured: structured(form.presentHouse, form.presentCity, form.presentDistrict, form.presentState, form.presentPin) }
              : {}),
            ...(form.sameAsPresent
              ? {}
              : structured(form.permanentHouse, form.permanentCity, form.permanentDistrict, form.permanentState, form.permanentPin)
                ? { permanentStructured: structured(form.permanentHouse, form.permanentCity, form.permanentDistrict, form.permanentState, form.permanentPin) }
                : {}),
            ...(educationRows(form).length ? { educationRows: educationRows(form) } : {}),
            ...(familyRows(form).length ? { familyRows: familyRows(form) } : {}),
            ...(nominationRows(form).length ? { nominations: nominationRows(form) } : {}),
            ...(files.length ? { documents: files } : {}),
            ...(form.formKind !== 'overseas' && form.medicalNotes.trim() ? { medicalNotes: form.medicalNotes.trim() } : {}),
          },
        }),
      });

      if (!res.ok) {
        const errData = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(errData?.message ?? 'Failed to submit onboarding form.');
      }

      const receipt = (await res.json()) as { success?: boolean; candidateId?: number };
      if (tokenVersion.current !== version) return;
      if (receipt.success !== true || receipt.candidateId !== candidateInfo?.candidateId)
        throw new Error(
          'The server did not confirm this application submission. Please contact HR.',
        );
      setSubmitted(true);
    } catch (err: unknown) {
      if (tokenVersion.current === version)
        setError(err instanceof Error ? err.message : 'Submission failed.');
    } finally {
      if (tokenVersion.current === version) {
        submittingRef.current = false;
        setSubmitting(false);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-canvas p-6">
        <div className="text-center">
          <p className="text-sm font-medium text-ink">Verifying secure pre-join link token…</p>
        </div>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-canvas p-6">
        <Card className="max-w-md p-8 text-center space-y-4">
          <AlertCircle className="mx-auto h-12 w-12 text-warning-ink" />
          <h2 className="text-xl font-light text-ink">Pre-join Link Invalid</h2>
          <p className="text-sm text-ink-muted leading-relaxed">{tokenError}</p>
          <p className="text-xs text-ink-subtle">
            Please contact Rashmi Group HR Operations to request a new pre-joining link.
          </p>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-canvas p-6">
        <Card className="max-w-md p-8 text-center space-y-4 border-line">
          <CheckCircle2 className="mx-auto h-12 w-12 text-positive-ink" />
          <h2 className="text-2xl font-light text-ink">Details Submitted!</h2>
          <p className="text-sm text-ink-muted leading-relaxed">
            Thank you, {candidateInfo?.candidateName ?? 'Candidate'}. Your statutory, contact, and
            banking details have been submitted for HR review.
          </p>
          <div className="rounded-lg bg-surface-2 p-3 text-xs text-ink-muted">
            HR will review your application. Your employee ID is created only after HR confirms
            actual joining.
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-canvas py-10 px-4 md:px-8">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-2">
            <Building2 className="h-6 w-6 text-ink" />
          </div>
          <div>
            <h1 className="text-lg font-medium text-ink">Rashmi Group</h1>
            <p className="text-xs text-ink-muted">Employee Self-Onboarding Portal</p>
          </div>
        </div>

        <DarkCard padded={false} className="p-8">
          <p className="text-sm font-medium text-hero-muted">Rashmi Group · joining form</p>
          <h2 className="mt-2 text-4xl font-light tracking-tight text-hero-ink">
            Hello, {candidateInfo?.candidateName ?? 'there'}
          </h2>
          <p className="mt-2 text-sm text-hero-muted">
            {candidateInfo?.positionTitle ?? 'Your role'} · one submission on this link
          </p>
        </DarkCard>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Joining form">
          {([
            ['regular', 'Regular'],
            ['consultant', 'Consultant & intern'],
            ['overseas', 'Overseas'],
          ] as const).map(([kind, label]) => (
            <Button
              key={kind}
              type="button"
              size="sm"
              variant={form.formKind === kind ? 'primary' : 'ghost'}
              onClick={() => { setForm({ ...form, formKind: kind satisfies JoiningFormKind }); }}
            >
              {label}
            </Button>
          ))}
        </div>

        {error && (
          <Card className="border-line bg-surface-2 p-4">
            <div className="flex items-center gap-3 text-ink text-sm">
              <AlertCircle className="h-5 w-5 text-warning-ink shrink-0" />
              <span>{error}</span>
            </div>
          </Card>
        )}

        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Joining steps">
          {['You and address', 'Statutory and bank', 'Education and family', 'Documents and declaration'].map((label, index) => (
            <Button key={label} type="button" size="sm" variant={step === index ? 'primary' : 'ghost'} onClick={() => { setStep(index); }}>
              {label}
            </Button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            if (step < 3) {
              e.preventDefault();
              const problem = stepError(form, step);
              setError(problem);
              if (!problem) setStep(step + 1);
              return;
            }
            void handleSubmit(e);
          }}
          className="space-y-6"
        >
          {step === 0 && <Card className="p-6 space-y-4">
            <CardHeader
              title="1. Residential Address Details"
              subtitle="Required for statutory PF/ESIC records and official communication."
            />
            <Select label="Gender" value={form.gender} onChange={(val) => { setForm({ ...form, gender: val }); }} placeholder="Choose…" options={['Male', 'Female', 'Transgender'].map((g) => ({ value: g, label: g }))} />
            <TextField
              label="Father's name"
              value={form.fatherName}
              onChange={(e) => { setForm({ ...form, fatherName: e.target.value }); }}
            />
            <TextField
              label="Passport number"
              value={form.passportNo}
              onChange={(e) => { setForm({ ...form, passportNo: e.target.value.toUpperCase() }); }}
              hint={form.formKind === 'overseas' ? 'Required for overseas joining' : 'Optional'}
            />
            <TextField
              label="Present Address (Current Residence)"
              value={form.presentAddress}
              onChange={(e) => {
                setForm({ ...form, presentAddress: e.target.value });
              }}
              placeholder="House/Flat No, Street, City, State, PIN Code"
            />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <TextField label="Present house" value={form.presentHouse} onChange={(e) => { setForm({ ...form, presentHouse: e.target.value }); }} />
              <TextField label="Present city" value={form.presentCity} onChange={(e) => { setForm({ ...form, presentCity: e.target.value }); }} />
              <TextField label="Present district" value={form.presentDistrict} onChange={(e) => { setForm({ ...form, presentDistrict: e.target.value }); }} />
              <TextField label="Present state" value={form.presentState} onChange={(e) => { setForm({ ...form, presentState: e.target.value.toUpperCase() }); }} hint="Two letters, such as WB" />
              <TextField label="Present PIN" value={form.presentPin} onChange={(e) => { setForm({ ...form, presentPin: e.target.value }); }} hint="6 digits" />
            </div>
            <TextField
              label="Permanent Address (As per Aadhaar)"
              value={form.permanentAddress}
              onChange={(e) => {
                setForm({ ...form, permanentAddress: e.target.value });
              }}
              placeholder="Permanent native address"
            />
          </Card>}

          {step === 0 && <Card className="p-6 space-y-4">
            <CardHeader
              title="2. Emergency Contact"
              subtitle="Contact in case of workplace emergency or plant safety alerts."
            />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <TextField
                label="Emergency Contact Name"
                value={form.emergencyContactName}
                onChange={(e) => {
                  setForm({ ...form, emergencyContactName: e.target.value });
                }}
                placeholder="Full name of contact person"
              />
              <TextField
                label="Emergency Contact Phone"
                value={form.emergencyContactPhone}
                onChange={(e) => {
                  setForm({ ...form, emergencyContactPhone: e.target.value });
                }}
                placeholder="10-digit mobile number"
              />
              <TextField
                label="Relationship"
                value={form.emergencyContactRelation}
                onChange={(e) => {
                  setForm({ ...form, emergencyContactRelation: e.target.value });
                }}
                placeholder="e.g. Spouse, Father, Mother"
              />
              <Select
                label="Blood Group"
                value={form.bloodGroup}
                onChange={(val) => {
                  setForm({ ...form, bloodGroup: val });
                }}
                options={BLOOD_GROUPS}
              />
            </div>
          </Card>}

          {step === 1 && <Card className="p-6 space-y-4">
            <CardHeader
              title="3. Statutory Identifiers (Government Compliance)"
              subtitle="Mandatory for Income Tax TDS, EPFO provident fund, and statutory gratuity."
            />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <TextField
                label="PAN Number (10 characters)"
                value={form.pan}
                onChange={(e) => {
                  setForm({ ...form, pan: e.target.value.toUpperCase() });
                }}
                placeholder="ABCDE1234F"
              />
              <TextField
                label="Aadhaar Number (12 numeric digits)"
                value={form.aadhaar}
                onChange={(e) => {
                  setForm({ ...form, aadhaar: e.target.value });
                }}
                placeholder="1234 5678 9012"
              />
            </div>
            <TextField
              label="Existing UAN (EPF Universal Account Number - Optional)"
              value={form.uan}
              onChange={(e) => {
                setForm({ ...form, uan: e.target.value });
              }}
              placeholder="Leave blank if this is your first formal employment"
            />
          </Card>}

          {step === 1 && <Card className="p-6 space-y-4">
            <CardHeader
              title="4. Direct Bank Account for Salary Credit"
              subtitle="Monthly net salary is disbursed directly into this savings account."
            />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <TextField
                label="Bank Name"
                value={form.bankName}
                onChange={(e) => {
                  setForm({ ...form, bankName: e.target.value });
                }}
                placeholder="State Bank of India / HDFC Bank"
              />
              <TextField
                label="IFSC Code (11 alphanumeric characters)"
                value={form.bankIfsc}
                onChange={(e) => {
                  setForm({ ...form, bankIfsc: e.target.value.toUpperCase() });
                }}
                placeholder="SBIN0001234"
              />
            </div>
            <TextField
              label="Savings Bank Account Number"
              value={form.bankAccount}
              onChange={(e) => {
                setForm({ ...form, bankAccount: e.target.value });
              }}
              placeholder="Account number as printed on bank passbook / cheque"
            />
          </Card>}

          {step === 2 && (
            <Card className="p-6 space-y-4">
              <CardHeader title="Education" subtitle="One row per qualification." />
              {form.educationRows.map((row, index) => (
                <div key={index} className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <TextField label="Qualification" value={row.qualification} onChange={(e) => { setForm(patchRow(form, 'educationRows', index, { qualification: e.target.value })); }} />
                  <TextField label="Institute" value={row.institute} onChange={(e) => { setForm(patchRow(form, 'educationRows', index, { institute: e.target.value })); }} />
                  <TextField label="Year" value={row.year} onChange={(e) => { setForm(patchRow(form, 'educationRows', index, { year: e.target.value })); }} />
                </div>
              ))}
              <Button type="button" variant="ghost" onClick={() => { setForm({ ...form, educationRows: [...form.educationRows, { qualification: '', institute: '', year: '' }] }); }}>Add education</Button>
            </Card>
          )}

          {step === 2 && (
            <Card className="p-6 space-y-4">
              <CardHeader title="Family" subtitle="Name, relationship and gender." />
              {form.familyRows.map((row, index) => (
                <div key={index} className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <TextField label="Family member" value={row.name} onChange={(e) => { setForm(patchRow(form, 'familyRows', index, { name: e.target.value })); }} />
                  <TextField label="Family relationship" value={row.relation} onChange={(e) => { setForm(patchRow(form, 'familyRows', index, { relation: e.target.value })); }} />
                  <Select label="Family gender" value={row.gender} onChange={(val) => { setForm(patchRow(form, 'familyRows', index, { gender: val })); }} placeholder="Choose…" options={['Male', 'Female', 'Transgender'].map((g) => ({ value: g, label: g }))} />
                </div>
              ))}
              <Button type="button" variant="ghost" onClick={() => { setForm({ ...form, familyRows: [...form.familyRows, { name: '', relation: '', gender: '' }] }); }}>Add family member</Button>
            </Card>
          )}

          {step === 2 && form.formKind === 'regular' && (
            <Card className="p-6 space-y-4">
              <CardHeader title="Scheme nominations" subtitle="PF, gratuity and ESIC are separate. Shares of one scheme total 100." />
              {form.nominations.map((row, index) => (
                <div key={index} className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <Select label="Scheme" value={row.scheme} onChange={(val) => { setForm(patchRow(form, 'nominations', index, { scheme: val })); }} options={['pf', 'eps', 'gratuity', 'esic', 'gpa'].map((s) => ({ value: s, label: s.toUpperCase() }))} />
                  <TextField label="Nominee name" value={row.name} onChange={(e) => { setForm(patchRow(form, 'nominations', index, { name: e.target.value })); }} />
                  <TextField label="Nominee relationship" value={row.relation} onChange={(e) => { setForm(patchRow(form, 'nominations', index, { relation: e.target.value })); }} />
                  <TextField label="Share percent" value={row.share} onChange={(e) => { setForm(patchRow(form, 'nominations', index, { share: e.target.value })); }} />
                  <TextField label="Nominee address" value={row.address} onChange={(e) => { setForm(patchRow(form, 'nominations', index, { address: e.target.value })); }} />
                </div>
              ))}
              <Button type="button" variant="ghost" onClick={() => { setForm({ ...form, nominations: [...form.nominations, { scheme: 'pf', name: '', relation: '', share: '', address: '' }] }); }}>Add nominee</Button>
            </Card>
          )}

          {step === 3 && (
            <Card className="p-6 space-y-4">
              <CardHeader title="Documents" subtitle="Photo and an identity proof. PDF, PNG or JPEG." />
              <TextField label="Photo file" type="file" onChange={(e) => { void readJoiningFile(e.target.files?.[0], 'photo', setFiles); }} />
              <TextField label="Identity proof" type="file" onChange={(e) => { void readJoiningFile(e.target.files?.[0], 'id_proof', setFiles); }} />
            </Card>
          )}

          {step === 3 && form.formKind !== 'overseas' && (
            <Card className="p-6 space-y-4">
              <CardHeader title="Medical notes" subtitle="Stored for HR medical review. A manager cannot open this section." />
              <TextField label="Medical notes" value={form.medicalNotes} onChange={(e) => { setForm({ ...form, medicalNotes: e.target.value }); }} />
            </Card>
          )}

          {step === 3 && <label className="flex items-start gap-3 text-sm text-ink">
            <input
              type="checkbox"
              className="mt-1 size-4"
              checked={form.declarationAccepted}
              onChange={(e) => { setForm({ ...form, declarationAccepted: e.target.checked }); }}
            />
            <span>I declare that this information is true, and I consent to verification for employment and statutory compliance.</span>
          </label>}

          <div className="flex items-center justify-between pt-4">
            <div className="flex items-center gap-2 text-xs text-ink-subtle">
              <Lock className="h-4 w-4" />
              <span>Personal details are collected for HR review.</span>
            </div>

            <Button
              type="submit"
              variant="primary"
              leadingIcon={<Send className="h-4 w-4" />}
              disabled={submitting}
            >
              {step < 3 ? 'Continue' : submitting ? 'Submitting…' : 'Submit Onboarding Information'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
