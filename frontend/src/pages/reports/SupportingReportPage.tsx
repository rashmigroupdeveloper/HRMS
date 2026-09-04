/**
 * Shared filter + table + Excel shell for Stage 1.7 supporting reports (R2–R27).
 */
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Download, FileSpreadsheet, RefreshCw } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import {
  Button,
  Card,
  CardHeader,
  DataTable,
  EmptyState,
  TextField,
  type Column,
} from '../../ui';
import {
  defaultCompanyId,
  defaultMonth,
  defaultReportDate,
  downloadExcel,
  qs,
  rememberCompanyId,
} from './report-utils';
import { CompanySelect } from '../_shared/CompanySelect';

type ReportCode = 'R2' | 'R3' | 'R4' | 'R5' | 'R6' | 'R24' | 'R27';

interface BaseFilters {
  companyId: string;
  month: string;
  reportDate: string;
  fromDate: string;
  toDate: string;
  asOf: string;
  fromMonth: string;
  toMonth: string;
  ecode: string;
  kind: string;
  status: string;
  stage: string;
  openOnly: boolean;
}

interface SupportingReportPageProps<T extends object> {
  code: ReportCode;
  title: string;
  subtitle: string;
  listPath: string;
  exportPath: string;
  columns: Column<T>[];
  rowKey: (row: T) => string;
  /** Extra query params beyond company/month defaults */
  buildQuery: (f: BaseFilters) => Record<string, string | number | boolean | undefined>;
  /** How to unpack the list response */
  parseRows: (body: unknown) => T[];
  filterFields?: (args: {
    filters: BaseFilters;
    set: (patch: Partial<BaseFilters>) => void;
  }) => ReactNode;
  requireCompany?: boolean;
  mode: 'month' | 'date' | 'range' | 'company' | 'companyOptional';
  onRowClick?: ((row: T) => void) | undefined;
  selectedKey?: string | undefined;
  /** Report-specific actions rendered beside Run / Export (e.g. R24 send-now). */
  extraActions?: ReactNode;
}

export function SupportingReportPage<T extends object>({
  code,
  title,
  subtitle,
  listPath,
  exportPath,
  columns,
  rowKey,
  buildQuery,
  parseRows,
  filterFields,
  requireCompany = true,
  mode,
  onRowClick,
  selectedKey,
  extraActions,
}: SupportingReportPageProps<T>) {
  const [filters, setFilters] = useState<BaseFilters>({
    companyId: defaultCompanyId(),
    month: defaultMonth(),
    reportDate: defaultReportDate(),
    fromDate: defaultReportDate(),
    toDate: defaultReportDate(),
    asOf: defaultReportDate(),
    fromMonth: '',
    toMonth: '',
    ecode: '',
    kind: '',
    status: '',
    stage: '',
    openOnly: false,
  });
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const didAutoLoad = useRef(false);

  const set = (patch: Partial<BaseFilters>) => {
    setFilters((prev) => {
      const next = { ...prev, ...patch };
      if (patch.companyId !== undefined) rememberCompanyId(patch.companyId);
      return next;
    });
  };

  const companyOk = !requireCompany || /^\d+$/.test(filters.companyId);

  const load = useCallback(async () => {
    if (requireCompany && !/^\d+$/.test(filters.companyId)) {
      setError('Select a legal entity.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const body = await apiFetch<unknown>(`${listPath}${qs(buildQuery(filters))}`);
      setRows(parseRows(body));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load report.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [buildQuery, filters, listPath, parseRows, requireCompany]);

  useEffect(() => {
    // Auto-load headcount (no required filters beyond optional company)
    if (mode === 'companyOptional' && !didAutoLoad.current) {
      didAutoLoad.current = true;
      void load();
    }
  }, [mode, load]);

  const onExport = async () => {
    if (requireCompany && !/^\d+$/.test(filters.companyId)) {
      setError('Select a legal entity.');
      return;
    }
    setLoading(true);
    await downloadExcel(`${exportPath}${qs(buildQuery(filters))}`);
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-ink-muted">{code} · Stage 1 report</p>
        <h1 className="mt-1 text-4xl font-light tracking-tight text-ink">{title}</h1>
        <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>
      </header>

      <Card>
        <div className="grid gap-4 md:grid-cols-[repeat(auto-fit,minmax(140px,1fr))_auto_auto] md:items-end">
          <CompanySelect
            value={filters.companyId}
            onChange={(value) => {
              set({ companyId: value });
            }}
            optional={!requireCompany}
            error={error && !companyOk ? error : undefined}
          />
          {mode === 'month' && (
            <TextField
              label="Month"
              type="month"
              value={filters.month}
              onChange={(e) => {
                set({ month: e.currentTarget.value });
              }}
            />
          )}
          {mode === 'date' && (
            <TextField
              label="Report date"
              type="date"
              value={filters.reportDate}
              onChange={(e) => {
                set({ reportDate: e.currentTarget.value });
              }}
            />
          )}
          {mode === 'range' && (
            <>
              <TextField
                label="From date"
                type="date"
                value={filters.fromDate}
                onChange={(e) => { set({ fromDate: e.currentTarget.value }); }}
              />
              <TextField
                label="To date"
                type="date"
                value={filters.toDate}
                onChange={(e) => { set({ toDate: e.currentTarget.value }); }}
              />
            </>
          )}
          {filterFields?.({ filters, set })}
          <Button
            loading={loading}
            leadingIcon={<RefreshCw className="size-4" />}
            onClick={() => void load()}
          >
            Run
          </Button>
          <Button
            variant="primary"
            loading={loading}
            leadingIcon={<Download className="size-4" />}
            onClick={() => void onExport()}
          >
            Export Excel
          </Button>
          {extraActions}
        </div>
        {error && companyOk ? (
          <p className="mt-3 text-sm text-negative" role="alert">
            {error}
          </p>
        ) : null}
      </Card>

      <Card>
        <CardHeader
          title={`${rows.length.toLocaleString('en-IN')} rows`}
          subtitle="On-screen table and Excel use the same query and filters (RPT-06)."
        />
      </Card>

      <DataTable
        rows={rows}
        columns={columns}
        rowKey={rowKey}
        {...(onRowClick ? { onRowClick } : {})}
        {...(selectedKey ? { selectedKey } : {})}
        maxHeight={620}
        empty={
          <EmptyState
            icon={<FileSpreadsheet />}
            title="No rows"
            description="Adjust filters and run the report."
          />
        }
      />
    </div>
  );
}
