/** DOC-01/02/03: one vault surface for ESS and scoped HR, composed from the UI kit. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import { Button, Card, PageHeader, Switch, TextField } from '../../ui';
import type { DocType, VaultRow } from './documents.types';
import { DocumentUpload } from './DocumentUpload';
import { DocumentFiles } from './DocumentFiles';
const PAGE_SIZE = 100;
export function DocumentsPage({ managed = false }: { managed?: boolean }) {
  const [params] = useSearchParams();
  // Changing employee must never carry a selected identity file into another
  // person's upload form. Paging/filtering the same employee preserves drafts.
  const target = managed ? `hr:${params.get('employeeCode') ?? ''}` : 'self';
  return <DocumentVault key={target} managed={managed} />;
}
function DocumentVault({ managed }: { managed: boolean }) {
  const [params, setParams] = useSearchParams();
  const employeeCode = managed ? (params.get('employeeCode') ?? '') : '';
  const attention = managed && params.get('attention') === 'true';
  const offset = Math.max(0, Number.parseInt(params.get('offset') ?? '0', 10) || 0);
  const [codeDraft, setCodeDraft] = useState(employeeCode);
  const [rows, setRows] = useState<VaultRow[] | null>(null);
  const [catalog, setCatalog] = useState<DocType[]>([]);
  const [maxBytes, setMaxBytes] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const endpoint = managed ? '/api/documents' : '/api/documents/mine';
  const load = useCallback(async () => {
    const version = ++generation.current;
    setError(null);
    try {
      const query = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
        needsAttentionOnly: String(attention),
      });
      if (employeeCode) query.set('employeeCode', employeeCode);
      const [list, types] = await Promise.all([
        apiFetch<{ rows: VaultRow[] }>(`${endpoint}?${query.toString()}`),
        apiFetch<{ types: DocType[]; maxUploadBytes: number }>(
          managed ? '/api/documents/catalog' : '/api/documents/types',
        ),
      ]);
      if (version !== generation.current) return;
      setRows(list.rows);
      setCatalog(types.types);
      setMaxBytes(types.maxUploadBytes);
    } catch (cause) {
      if (version === generation.current)
        setError(cause instanceof Error ? cause.message : 'Could not load documents');
    }
  }, [endpoint, employeeCode, attention, offset, managed]);
  useEffect(() => {
    void load();
    return () => {
      generation.current += 1;
    };
  }, [load]);
  const updateParams = (values: Record<string, string | null>) => {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      for (const [key, value] of Object.entries(values)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      return next;
    });
  };
  return (
    <div className="space-y-6">
      <PageHeader
        title={managed ? 'Employee documents' : 'My documents'}
        description={
          managed
            ? 'Review the documents and expiry dates within your HR scope.'
            : 'Keep your work documents current and download your own records.'
        }
      />
      {managed && (
        <Card>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              updateParams({ employeeCode: codeDraft.trim(), offset: null });
            }}
          >
            <TextField
              label="Employee code"
              placeholder="All employees in your scope"
              value={codeDraft}
              onChange={(event) => {
                setCodeDraft(event.target.value);
              }}
            />
            <Button type="submit">Apply filter</Button>
            <Switch
              label="Needs attention only"
              checked={attention}
              onChange={(event) => {
                updateParams({ attention: event.target.checked ? 'true' : null, offset: null });
              }}
            />
          </form>
        </Card>
      )}
      {(!managed || employeeCode) && (
        <DocumentUpload
          key={catalog.map((type) => type.code).join(',')}
          catalog={catalog}
          maxBytes={maxBytes}
          employeeCode={employeeCode}
          managed={managed}
          onUploaded={load}
        />
      )}
      <DocumentFiles
        managed={managed}
        rows={rows}
        error={error}
        attention={attention}
        offset={offset}
        pageSize={PAGE_SIZE}
        onRetry={load}
        onPage={(next) => {
          updateParams({ offset: String(next) });
        }}
      />
    </div>
  );
}
