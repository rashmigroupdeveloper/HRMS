/**
 * Letters console (CORE-09, PP-14) — HR issues from templates with declared
 * merge fields; every letter drafts into the hr_ops → hr_head signature chain
 * and only APPROVAL issues it. Per-employee archive lookup included.
 */
import { useCallback, useEffect, useState } from 'react';
import { FileSignature, FileText, Search } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { Button, Card, CardHeader, DataTable, Drawer, EmptyState, Select, StatusBadge, TextField, toast } from '../../ui';
import type { Column } from '../../ui';

interface Template {
  code: string;
  name: string;
  mergeFields: string[];
  isActive: boolean;
}

interface LetterRow {
  id: number;
  templateCode: string;
  documentId: number;
  issuedAt: string | null;
  workflowRequestId: number | null;
}

/** Fields the backend resolves from the employee record — everything else the
 *  issuer must type in (validated server-side at render time). */
const AUTO_FIELDS = new Set(['employee_name', 'ecode', 'company', 'designation', 'department', 'doj', 'dol', 'confirmation_date']);

export function LettersPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [letters, setLetters] = useState<LetterRow[]>([]);
  const [looked, setLooked] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [template, setTemplate] = useState<Template | null>(null);
  const [extras, setExtras] = useState<Record<string, string>>({});
  const [viewer, setViewer] = useState<{ fileName: string; content: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const validEmployee = /^\d+$/.test(employeeId);

  useEffect(() => {
    apiFetch<Template[]>('/api/letters/templates')
      .then(setTemplates)
      .catch(() => {
        toast.error('Template catalog failed to load');
      });
  }, []);

  const lookup = useCallback(async () => {
    if (!validEmployee) return;
    try {
      setLetters(await apiFetch<LetterRow[]>(`/api/letters/employee/${employeeId}`));
      setLooked(true);
    } catch (cause) {
      toast.error('Lookup failed', { description: cause instanceof Error ? cause.message : 'Try again.' });
    }
  }, [employeeId, validEmployee]);

  const issue = async () => {
    if (!template || !validEmployee) {
      toast.error('Pick a template and a valid employee ID');
      return;
    }
    setBusy(true);
    try {
      const result = await apiFetch<{ letterId: number; workflowRequestId: number | null }>('/api/letters/issue', {
        method: 'POST',
        body: JSON.stringify({ employeeId: Number(employeeId), templateCode: template.code, extraFields: extras }),
      });
      toast.success('Letter drafted into the signature chain', {
        description: `Letter #${String(result.letterId)} — issues on hr_head approval (PP-14).`,
      });
      setIssueOpen(false);
      setExtras({});
      await lookup();
    } catch (cause) {
      toast.error('Issue failed', { description: cause instanceof Error ? cause.message : 'Merge fields incomplete?' });
    } finally {
      setBusy(false);
    }
  };

  const open = async (row: LetterRow) => {
    try {
      setViewer(await apiFetch<{ mime: string; fileName: string; content: string }>(`/api/letters/${String(row.id)}/content`));
    } catch (cause) {
      toast.error('Could not open the letter', { description: cause instanceof Error ? cause.message : 'Try again.' });
    }
  };

  const columns: Column<LetterRow>[] = [
    { key: 'id', header: '#', width: '70px', render: (row) => String(row.id) },
    { key: 'template', header: 'Template', width: 'minmax(160px,1fr)', render: (row) => row.templateCode },
    {
      key: 'state',
      header: 'State',
      width: '180px',
      render: (row) =>
        row.issuedAt ? (
          <StatusBadge tone="positive">issued</StatusBadge>
        ) : (
          <StatusBadge tone="warning">awaiting signature</StatusBadge>
        ),
    },
    { key: 'issuedAt', header: 'Issued at', width: '190px', render: (row) => row.issuedAt ?? '—' },
  ];

  const manualFields = template ? template.mergeFields.filter((field) => !AUTO_FIELDS.has(field)) : [];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink-muted">CORE-09 · issuance = signature-chain approval</p>
          <h1 className="mt-1 font-serif text-4xl font-light tracking-tight text-ink">Letters</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Rendered from runtime-editable templates; a missing merge field is a hard error, never a blank letter.
          </p>
        </div>
        <Button variant="primary" leadingIcon={<FileSignature className="size-4" />} onClick={() => { setIssueOpen(true); }}>
          Issue letter
        </Button>
      </header>

      <Card>
        <div className="flex flex-wrap items-end gap-4">
          <TextField
            className="w-56"
            label="Employee ID"
            value={employeeId}
            error={employeeId && !validEmployee ? 'Numbers only' : undefined}
            onChange={(event) => {
              setEmployeeId(event.currentTarget.value);
            }}
          />
          <Button leadingIcon={<Search className="size-4" />} onClick={() => void lookup()} disabled={!validEmployee}>
            Show letters
          </Button>
        </div>
      </Card>

      <DataTable
        rows={letters}
        columns={columns}
        rowKey={(row) => String(row.id)}
        onRowClick={(row) => void open(row)}
        maxHeight={480}
        empty={
          <EmptyState
            icon={<FileText />}
            title={looked ? 'No letters on record' : 'Look up an employee'}
            description={looked ? 'Issued and in-chain letters appear here.' : 'Drafts awaiting signature are listed too.'}
          />
        }
      />

      <Card padded={false}>
        <div className="p-5 pb-1">
          <CardHeader title="Template catalog" subtitle="Bodies and merge fields are runtime data (letters.issue can edit)" />
        </div>
        <div className="grid gap-px bg-line/40 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <div key={t.code} className="bg-surface p-5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-ink">{t.name}</p>
                {!t.isActive && <StatusBadge tone="neutral">inactive</StatusBadge>}
              </div>
              <p className="mt-1 text-xs text-ink-muted">{t.code}</p>
              <p className="mt-2 text-xs text-ink-faint">{t.mergeFields.join(' · ')}</p>
            </div>
          ))}
        </div>
      </Card>

      <Drawer
        open={issueOpen}
        onClose={() => {
          setIssueOpen(false);
        }}
        title="Issue a letter"
        subtitle="Drafts now; the employee sees it only after the signature chain approves"
        footer={
          <Button variant="primary" loading={busy} onClick={() => void issue()}>
            Draft into signature chain
          </Button>
        }
        width={520}
      >
        <div className="space-y-4">
          <TextField
            label="Employee ID"
            value={employeeId}
            error={employeeId && !validEmployee ? 'Numbers only' : undefined}
            onChange={(event) => {
              setEmployeeId(event.currentTarget.value);
            }}
          />
          <Select
            label="Template"
            value={template?.code ?? null}
            placeholder="Choose a template"
            options={templates.filter((t) => t.isActive).map((t) => ({ value: t.code, label: t.name, description: t.code }))}
            onChange={(code) => {
              setTemplate(templates.find((t) => t.code === code) ?? null);
              setExtras({});
            }}
          />
          {manualFields.map((field) => (
            <TextField
              key={field}
              label={field.replaceAll('_', ' ')}
              value={extras[field] ?? ''}
              hint="Required merge field"
              onChange={(event) => {
                const value = event.currentTarget.value;
                setExtras((previous) => ({ ...previous, [field]: value }));
              }}
            />
          ))}
          {template && manualFields.length === 0 && (
            <p className="text-xs text-ink-muted">All merge fields resolve from the employee record.</p>
          )}
        </div>
      </Drawer>

      <Drawer
        open={viewer !== null}
        onClose={() => {
          setViewer(null);
        }}
        title={viewer?.fileName ?? ''}
        width={560}
      >
        <article className="whitespace-pre-wrap text-sm leading-7 text-ink" dangerouslySetInnerHTML={{ __html: viewer?.content ?? '' }} />
      </Drawer>
    </div>
  );
}
