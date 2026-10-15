/**
 * Outputs Card (PAY-05, PAY-06, SOW-166..178).
 *
 * Displays download controls and readiness status for all finalized run outputs:
 * - Bank Bulk Transfer File (NEFT/RTGS CSV; holds excluded; trailer control totals)
 * - SAP Journal Voucher (GL mapping & cost-center debits == credits)
 * - Variance Report (R10)
 * - PF ECR, ESIC return, PT register, TDS 24Q
 * - Payslips batch
 */

import { Download, FileSpreadsheet, Landmark, Receipt, CheckCircle, Clock } from 'lucide-react';
import { Button, Card, CardHeader, StatusBadge } from '../../ui';

interface OutputsCardProps {
  runId: number;
  month: string;
  isFinalized: boolean;
  onDownloadOutput: (code: string) => void;
}

export function OutputsCard({
  month,
  isFinalized,
  onDownloadOutput,
}: OutputsCardProps) {
  const OUTPUT_ITEMS = [
    {
      code: 'bank',
      label: 'Bank Payment File (NEFT/RTGS)',
      note: 'Bulk transfer CSV formatted to Finance specification; payment holds left out.',
      icon: Landmark,
      readyTone: isFinalized ? ('positive' as const) : ('neutral' as const),
    },
    {
      code: 'jv',
      label: 'SAP Journal Voucher (JV)',
      note: 'GL account breakdown by cost-center; Total Debits == Credits == CTC.',
      icon: FileSpreadsheet,
      readyTone: isFinalized ? ('positive' as const) : ('neutral' as const),
    },
    {
      code: 'variance',
      label: 'Variance Report (R10)',
      note: 'Per-employee delta comparison vs previous month; anomaly highlights.',
      icon: FileSpreadsheet,
      readyTone: isFinalized ? ('positive' as const) : ('neutral' as const),
    },
    {
      code: 'ecr',
      label: 'Provident Fund (ECR Text)',
      note: 'EPFO portal #~# format with NCP days and UAN identifiers.',
      icon: FileSpreadsheet,
      readyTone: isFinalized ? ('positive' as const) : ('neutral' as const),
    },
    {
      code: 'esic',
      label: 'ESIC Monthly Return File',
      note: 'IP numbers, payable days, and contributions rounded UP.',
      icon: FileSpreadsheet,
      readyTone: isFinalized ? ('positive' as const) : ('neutral' as const),
    },
    {
      code: 'pt',
      label: 'PT West Bengal Register',
      note: 'State slab-wise deduction summary and annual PTRC register.',
      icon: FileSpreadsheet,
      readyTone: isFinalized ? ('positive' as const) : ('neutral' as const),
    },
    {
      code: 'tds',
      label: 'TDS / Quarterly 24Q Data',
      note: 'Income tax deducted u/s 192 under New & Old regimes.',
      icon: FileSpreadsheet,
      readyTone: isFinalized ? ('positive' as const) : ('neutral' as const),
    },
    {
      code: 'payslips',
      label: 'Batch Payslips Archive',
      note: 'Fixed RML layout PDFs archived for all employees.',
      icon: Receipt,
      readyTone: isFinalized ? ('positive' as const) : ('neutral' as const),
    },
  ];

  return (
    <Card className="space-y-4">
      <CardHeader
        title={
          <div className="flex items-center gap-2">
            <span>Outputs & Regulatory Filings</span>
            {isFinalized ? (
              <StatusBadge tone="positive">
                <CheckCircle className="mr-1 size-3" /> Ready for Download
              </StatusBadge>
            ) : (
              <StatusBadge tone="neutral">
                <Clock className="mr-1 size-3" /> Awaiting Finalization
              </StatusBadge>
            )}
          </div>
        }
        subtitle={`Artifacts generated for ${month} — banking files, SAP accounting JV, statutory returns, and payslips.`}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {OUTPUT_ITEMS.map((item) => (
          <div
            key={item.code}
            className="flex flex-col justify-between rounded-row border border-rule bg-surface-2 p-4 transition-colors hover:border-accent/40"
          >
            <div>
              <div className="flex items-center justify-between">
                <item.icon className="size-5 text-accent" />
                <StatusBadge tone={item.readyTone}>
                  {isFinalized ? 'Ready' : 'Pending'}
                </StatusBadge>
              </div>
              <p className="mt-3 text-sm font-semibold text-ink">{item.label}</p>
              <p className="mt-1 text-xs leading-5 text-ink-muted">{item.note}</p>
            </div>

            <div className="mt-4 pt-2">
              <Button
                variant="secondary"
                size="sm"
                className="w-full text-xs"
                disabled={!isFinalized}
                onClick={() => { onDownloadOutput(item.code); }}
              >
                <Download className="mr-1.5 size-3.5" />
                Download {item.code === 'payslips' ? 'Archive' : 'File'}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
