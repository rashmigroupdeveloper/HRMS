/**
 * Generic report runner (R2–R6, R27): declarative filters → same-query table +
 * CSV download built from the rendered rows (export = view, docs/06 rule).
 */
import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, Download, FileSpreadsheet, RefreshCw } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { downloadCsv } from '../../lib/downloads';
import { Button, Card, DataTable, EmptyState, PageHeader, StatusBadge, TextField } from '../../ui';
import type { Column } from '../../ui';
import { REPORT_DEFS } from './report-defs';
import type { ReportDef, ReportRow } from './report-defs';

function cellText(value: ReportRow[string] | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

function Runner({ def }: { def: ReportDef }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [ran, setRan] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): URLSearchParams | null => {
    const problems: Record<string, string> = {};
    const query = new URLSearchParams();
    for (const filter of def.filters) {
      const raw = (values[filter.key] ?? '').trim();
      if (!raw) {
        if (filter.required) problems[filter.key] = 'Required';
        continue;
      }
      if (filter.kind === 'number' && !/^\d+$/.test(raw)) problems[filter.key] = 'Numbers only';
      query.set(filter.key, raw);
    }
    setErrors(problems);
    return Object.keys(problems).length > 0 ? null : query;
  };

  const load = async () => {
    const query = validate();
    if (!query) return;
    setLoading(true);
    try {
      setRows(await apiFetch<ReportRow[]>(`${def.endpoint}?${query.toString()}`));
      setRan(true);
    } catch (cause) {
      setErrors({ [def.filters[0]?.key ?? 'companyId']: cause instanceof Error ? cause.message : 'Failed to load' });
    } finally {
      setLoading(false);
    }
  };

  const columns: Column<ReportRow>[] = def.columns.map((c) => ({
    key: c.key,
    header: c.header,
    numeric: c.numeric ?? false,
    width: c.width ?? (c.numeric ? '110px' : 'minmax(120px,1fr)'),
    render: (row) =>
      c.badgeWhen?.(row) ? (
        <StatusBadge tone="negative">{cellText(row[c.key])}</StatusBadge>
      ) : (
        cellText(row[c.key])
      ),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <span>
            <Link to="/reports" className="inline-flex items-center gap-1 hover:text-ink">
              <ArrowLeft className="size-3.5" /> Reports
            </Link>{' '}
            · {def.code}
          </span>
        }
        title={def.title}
        description={def.subtitle}
        actions={
          <Button
            variant="primary"
            disabled={rows.length === 0}
            leadingIcon={<Download className="size-4" />}
            onClick={() => {
              downloadCsv(
                `${def.code.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`,
                def.columns.map((c) => ({ header: c.header, value: (row: ReportRow) => cellText(row[c.key]) })),
                rows,
              );
            }}
          >
            Download CSV
          </Button>
        }
      />

      <Card>
        <div className="flex flex-wrap items-end gap-4">
          {def.filters.map((filter) => (
            <TextField
              key={filter.key}
              className="w-56"
              label={filter.label}
              type={filter.kind === 'number' ? 'text' : filter.kind}
              value={values[filter.key] ?? ''}
              hint={filter.hint}
              error={errors[filter.key]}
              onChange={(event) => {
                const next = event.currentTarget.value;
                setValues((previous) => ({ ...previous, [filter.key]: next }));
              }}
            />
          ))}
          <Button loading={loading} leadingIcon={<RefreshCw className="size-4" />} onClick={() => void load()}>
            Run report
          </Button>
        </div>
      </Card>

      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(row) => def.columns.map((c) => String(row[c.key])).join('|')}
        maxHeight={620}
        empty={
          <EmptyState
            icon={<FileSpreadsheet />}
            title={ran ? 'No rows for these filters' : 'Run the report'}
            description={
              ran
                ? 'The filters returned an empty set — that is a real answer, not an error.'
                : 'Set the filters above; the CSV downloads exactly what the table shows.'
            }
          />
        }
      />
    </div>
  );
}

export function ReportRunPage() {
  const { code } = useParams();
  const def = code ? REPORT_DEFS[code.toLowerCase()] : undefined;
  if (!def) return <Navigate to="/reports" replace />;
  return <Runner key={def.code} def={def} />;
}
