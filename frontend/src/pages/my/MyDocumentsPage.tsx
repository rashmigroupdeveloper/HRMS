/**
 * `/my/documents` — ESS document vault (DOC-01/02/03).
 *
 * Discovery is meant to be the home card when something is expiring; this page
 * is the place you land once you know you need to act. Upload is base64 via
 * the same storage adapter letters and policies already use.
 */
import { useCallback, useEffect, useState } from 'react';
import { FileUp } from 'lucide-react';
import { ApiError, apiFetch } from '../../lib/api';
import {
  Button,
  Card,
  CardHeader,
  DataTable,
  EmptyState,
  PageHeader,
  Select,
  Skeleton,
  StatusBadge,
  TextField,
  toast,
} from '../../ui';
import type { Column, StatusTone } from '../../ui';

type ExpiryState = 'perpetual' | 'valid' | 'expiring' | 'expired';

interface Expiry {
  state: ExpiryState;
  daysRemaining: number | null;
  stage: number | null;
}

interface DocType {
  code: string;
  name: string;
  typicallyExpires: boolean;
}

interface VaultRow {
  id: number;
  documentType: string;
  typeName: string;
  originalName: string;
  expiresOn: string | null;
  status: string;
  uploadedAt: string;
  expiry: Expiry;
}

const EXPIRY_TONE: Record<ExpiryState, StatusTone> = {
  expired: 'negative',
  expiring: 'warning',
  valid: 'positive',
  perpetual: 'neutral',
};

function expiryLabel(expiry: Expiry): string {
  if (expiry.state === 'perpetual') return 'No expiry';
  if (expiry.state === 'expired') return `Expired ${String(Math.abs(expiry.daysRemaining ?? 0))} d ago`;
  if (expiry.state === 'expiring') return `${String(expiry.daysRemaining ?? 0)} d left`;
  return 'Valid';
}

function formatUploaded(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function MyDocumentsPage() {
  const [rows, setRows] = useState<VaultRow[] | null>(null);
  const [types, setTypes] = useState<DocType[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [documentType, setDocumentType] = useState('pan');
  const [expiresOn, setExpiresOn] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [mine, catalog] = await Promise.all([
        apiFetch<{ rows: VaultRow[] }>('/api/documents/mine'),
        apiFetch<{ types: DocType[] }>('/api/documents/types'),
      ]);
      setRows(mine.rows);
      setTypes(catalog.types);
      setDocumentType((prev) =>
        catalog.types.some((t) => t.code === prev) ? prev : (catalog.types[0]?.code ?? prev),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load your documents');
      setRows([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedType = types.find((t) => t.code === documentType);
  const needsExpiry = selectedType?.typicallyExpires === true;

  async function onUpload(): Promise<void> {
    if (!file) {
      toast.error('Choose a file first');
      return;
    }
    if (needsExpiry && !expiresOn) {
      toast.error('This document type needs an expiry date');
      return;
    }
    setBusy(true);
    try {
      const content = await fileToBase64(file);
      await apiFetch<{ id: number }>('/api/documents/mine', {
        method: 'POST',
        body: JSON.stringify({
          documentType,
          fileName: file.name,
          mime: file.type || 'application/octet-stream',
          content,
          expiresOn: needsExpiry ? expiresOn : null,
        }),
      });
      toast.success('Document uploaded');
      setFile(null);
      setExpiresOn('');
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<VaultRow>[] = [
    { key: 'type', header: 'Type', render: (row) => row.typeName },
    { key: 'file', header: 'File', render: (row) => row.originalName },
    { key: 'uploaded', header: 'Uploaded', render: (row) => formatUploaded(row.uploadedAt) },
    {
      key: 'expiry',
      header: 'Validity',
      render: (row) => (
        <StatusBadge tone={EXPIRY_TONE[row.expiry.state]}>{expiryLabel(row.expiry)}</StatusBadge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="My documents"
        description="PAN, Aadhaar, appointment letter and medical fitness — the papers that prove who you are at work."
      />

      <Card>
        <CardHeader
          title="Upload"
          subtitle="Files land in the shared vault; HR can see the same record."
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            label="Type"
            value={documentType}
            onChange={(value) => {
              setDocumentType(value);
            }}
            options={types.map((t) => ({ value: t.code, label: t.name }))}
          />
          {needsExpiry ? (
            <TextField
              label="Expires on"
              type="date"
              value={expiresOn}
              onChange={(e) => {
                setExpiresOn(e.target.value);
              }}
            />
          ) : null}
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-ink">File</span>
            <input
              type="file"
              className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink file:mr-3 file:rounded-full file:border-0 file:bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] file:px-3 file:py-1 file:text-sm file:font-semibold file:text-ink"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
              }}
            />
          </label>
          <div className="flex items-end">
            <Button onClick={() => void onUpload()} disabled={busy} leadingIcon={<FileUp className="size-4" />}>
              {busy ? 'Uploading…' : 'Upload'}
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="On file"
          subtitle="Active documents only — superseded copies stay in the registry."
        />
        {rows === null ? (
          <Skeleton className="h-32" />
        ) : error !== null ? (
          <EmptyState title="Could not load" description={error} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="Nothing on file yet"
            description="Upload your PAN or Aadhaar so HR does not have to chase you at joining."
          />
        ) : (
          <DataTable columns={columns} rows={rows} rowKey={(row) => String(row.id)} />
        )}
      </Card>
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Could not read file'));
        return;
      }
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error('Could not read file'));
    };
    reader.readAsDataURL(file);
  });
}
