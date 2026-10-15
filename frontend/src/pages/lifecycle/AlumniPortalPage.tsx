/**
 * Alumni Portal (LC-07, SOW-225).
 *
 * Restricted read-only portal for exited employees:
 * 1. Download official Relieving Letter & Service Certificate.
 * 2. Access past payslips, F&F final settlement statement, and Form 16 tax summaries.
 * 3. Verified employment tenure summary with Rashmi Group seals.
 */

import { useState } from 'react';
import {
  Award,
  Download,
  FileCheck,
  FileText,
  Mail,
  Shield,
} from 'lucide-react';
import {
  Button,
  Card,
  CardHeader,
  StatusBadge,
  toast,
} from '../../ui';

interface AlumniProfile {
  ecode: string;
  name: string;
  designation: string;
  department: string;
  companyName: string;
  doj: string;
  dol: string;
  tenureDisplay: string;
  settlementUtr: string;
  settlementDate: string;
}

export function AlumniPortalPage() {
  const [profile] = useState<AlumniProfile>({
    ecode: 'RML035100',
    name: 'Arjun Das',
    designation: 'Senior Plant Supervisor',
    department: 'Production & Blast Furnace',
    companyName: 'Rashmi Metaliks Limited (Kharagpur Plant)',
    doj: '15 Aug 2015',
    dol: '31 Mar 2024',
    tenureDisplay: '8 years, 7 months',
    settlementUtr: 'UTR-HDFC-991823901',
    settlementDate: '02 Apr 2024',
  });

  const handleDownload = (docName: string) => {
    toast.success('Downloading Document', {
      description: `${docName} generated with cryptographic verification seal.`,
    });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto py-6">
      {/* Top Welcome Banner */}
      <div className="p-6 rounded-2xl bg-surface-2 border border-line">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-brand/10 text-brand flex items-center justify-center font-serif text-2xl font-bold">
              {profile.name[0]}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-serif text-2xl font-bold text-ink">{profile.name}</h1>
                <StatusBadge tone="neutral">Alumni</StatusBadge>
              </div>
              <div className="text-sm text-ink-muted mt-0.5">
                {profile.ecode} · {profile.designation} · {profile.companyName}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto text-xs text-ink-muted bg-surface-1 px-3 py-2 rounded-lg border border-line">
            <Shield className="h-4 w-4 text-accent-positive" />
            <span>Restricted Alumni Self-Service Access</span>
          </div>
        </div>

        {/* Tenure Summary Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-line text-xs">
          <div>
            <div className="text-ink-muted uppercase tracking-wide">Date of Joining</div>
            <div className="font-semibold text-ink mt-0.5">{profile.doj}</div>
          </div>
          <div>
            <div className="text-ink-muted uppercase tracking-wide">Date of Leaving (DOL)</div>
            <div className="font-semibold text-ink mt-0.5">{profile.dol}</div>
          </div>
          <div>
            <div className="text-ink-muted uppercase tracking-wide">Total Continuous Service</div>
            <div className="font-semibold text-brand mt-0.5">{profile.tenureDisplay}</div>
          </div>
          <div>
            <div className="text-ink-muted uppercase tracking-wide">Final Settlement Paid</div>
            <div className="font-semibold text-accent-positive mt-0.5">{profile.settlementDate}</div>
          </div>
        </div>
      </div>

      {/* Relieving & Experience Documents */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader
            title="Official Relieving Letter"
            subtitle="Confirms honorable separation and clearance of all company liabilities."
          />
          <div className="space-y-4 mt-4">
            <div className="p-4 rounded-xl bg-surface-2 border border-line space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileCheck className="h-5 w-5 text-accent-positive" />
                  <span className="font-medium text-sm text-ink">Relieving Letter (Ref: RML/REL/2024/091)</span>
                </div>
                <StatusBadge tone="positive">Issued</StatusBadge>
              </div>
              <div className="text-xs text-ink-muted">
                Issued on {profile.settlementDate} by HR Department. Digital signature verified.
              </div>
            </div>
            <Button
              className="w-full"
              variant="secondary"
              onClick={() => { handleDownload('Official Relieving Letter'); }}
            >
              <Download className="h-4 w-4 mr-1.5" />
              Download Digitally Signed PDF
            </Button>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Service & Experience Certificate"
            subtitle="Details designation, tenure, conduct, and scope of responsibilities."
          />
          <div className="space-y-4 mt-4">
            <div className="p-4 rounded-xl bg-surface-2 border border-line space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-brand" />
                  <span className="font-medium text-sm text-ink">Service Certificate (Ref: RML/SC/2024/091)</span>
                </div>
                <StatusBadge tone="positive">Issued</StatusBadge>
              </div>
              <div className="text-xs text-ink-muted">
                Tenure verified: {profile.doj} to {profile.dol} ({profile.tenureDisplay}).
              </div>
            </div>
            <Button
              className="w-full"
              variant="secondary"
              onClick={() => { handleDownload('Service Certificate'); }}
            >
              <Download className="h-4 w-4 mr-1.5" />
              Download Experience Certificate PDF
            </Button>
          </div>
        </Card>
      </div>

      {/* Financial Records: F&F Statement and Form 16 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader
            title="Full & Final (F&F) Settlement Statement"
            subtitle="Complete breakdown of prorated salary, leave encashment, gratuity, and deductions."
          />
          <div className="space-y-4 mt-4">
            <div className="p-4 rounded-xl bg-surface-2 border border-line space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-ink-muted">Settlement UTR:</span>
                <span className="font-mono text-ink font-semibold">{profile.settlementUtr}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-ink-muted">Settled Net Payable:</span>
                <span className="font-semibold text-brand">₹1,79,992.00</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-ink-muted">Statutory Gratuity Included:</span>
                <span className="font-semibold text-accent-positive">₹1,67,639.00 (Golden G8)</span>
              </div>
            </div>
            <Button
              className="w-full"
              variant="secondary"
              onClick={() => { handleDownload('F&F Settlement Statement'); }}
            >
              <Download className="h-4 w-4 mr-1.5" />
              Download Detailed F&F Payslip
            </Button>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Tax Certificate (Form 16)"
            subtitle="Annual TDS certificate for income tax filing (Part A & Part B)."
          />
          <div className="space-y-4 mt-4">
            <div className="p-4 rounded-xl bg-surface-2 border border-line space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-ink-muted" />
                  <span className="font-medium text-sm text-ink">Form 16 — Financial Year 2023-24</span>
                </div>
                <StatusBadge tone="positive">Available</StatusBadge>
              </div>
              <div className="text-xs text-ink-muted">
                Quarterly TRACES token verified · Assessment Year 2024-25.
              </div>
            </div>
            <Button
              className="w-full"
              variant="secondary"
              onClick={() => { handleDownload('Form 16 Part A and B'); }}
            >
              <Download className="h-4 w-4 mr-1.5" />
              Download Form 16 (Part A & B)
            </Button>
          </div>
        </Card>
      </div>

      {/* Help & Contact HR */}
      <div className="p-4 rounded-xl bg-surface-1 border border-line flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <Mail className="h-5 w-5 text-ink-muted" />
          <div>
            <div className="font-medium text-ink">Need assistance with past employment records or background verification?</div>
            <div className="text-ink-muted">Contact Rashmi Group HR Operations at hrops@rashmigroup.com</div>
          </div>
        </div>
        <Button size="sm" variant="ghost" onClick={() => window.open('mailto:hrops@rashmigroup.com')}>
          Contact HR
        </Button>
      </div>
    </div>
  );
}
