import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import { Button, Card, Drawer, Select } from '../../ui';
interface Report {
  id: number;
  name: string;
  ecode: string | null;
  roles: string[];
  pagePath: string;
  pageTitle: string;
  body: string;
  status: 'new' | 'resolved';
  createdAt: string;
  hasScreenshot: boolean;
}
interface Inbox {
  rows: Report[];
  total: number;
}
export function BetaFeedbackPage() {
  const [search, setSearch] = useSearchParams();
  const [status, setStatus] = useState('');
  const [offset, setOffset] = useState(0);
  const [version, setVersion] = useState(0);
  const [data, setData] = useState<Inbox | null>(null);
  const [error, setError] = useState('');
  const [image, setImage] = useState<{ id: number; data: string } | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [detail, setDetail] = useState<Report | null>(null);
  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError('');
    void apiFetch<Inbox>(
      `/api/beta-feedback?offset=${String(offset)}&limit=30${status ? `&status=${status}` : ''}`,
    )
      .then((value) => {
        if (!cancelled) setData(value);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load feedback.');
      });
    return () => {
      cancelled = true;
    };
  }, [offset, status, version]);
  const selectedId = Number(search.get('report'));
  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    void apiFetch<Report>(`/api/beta-feedback/${String(selectedId)}`)
      .then((report) => {
        if (!cancelled) {
          setDetail(report);
          setSearch({}, { replace: true });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('Could not open that report.');
          setSearch({}, { replace: true });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, setSearch]);
  const screenshot = async (report: Report) => {
    setBusy(report.id);
    setError('');
    try {
      const file = await apiFetch<{ mime: string; base64: string }>(
        `/api/beta-feedback/${String(report.id)}/screenshot`,
      );
      setDetail(null);
      setImage({ id: report.id, data: `data:${file.mime};base64,${file.base64}` });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load screenshot.');
    } finally {
      setBusy(null);
    }
  };
  const review = async (report: Report) => {
    setBusy(report.id);
    setError('');
    try {
      await apiFetch(`/api/beta-feedback/${String(report.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: report.status === 'new' ? 'resolved' : 'new' }),
      });
      setVersion((v) => v + 1);
      setDetail(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update report.');
    } finally {
      setBusy(null);
    }
  };
  const content = (report: Report) => (
    <div className="space-y-3">
      <div className="flex flex-wrap justify-between gap-2">
        <p className="font-semibold">
          #{String(report.id)} · {report.name}{' '}
          <span className="font-normal text-ink-muted">{report.ecode}</span>
        </p>
        <span className="text-xs text-ink-muted">
          {new Date(report.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST ·{' '}
          {report.status}
        </span>
      </div>
      <p className="text-xs text-ink-muted">{report.roles.join(', ').replaceAll('_', ' ')}</p>
      <Link to={report.pagePath} className="break-all text-sm underline underline-offset-4">
        {report.pageTitle || report.pagePath} · {report.pagePath}
      </Link>
      <p className="whitespace-pre-wrap break-words text-sm">{report.body}</p>
      <div className="flex flex-wrap gap-2">
        {report.hasScreenshot && (
          <Button size="sm" loading={busy === report.id} onClick={() => void screenshot(report)}>
            View screenshot
          </Button>
        )}
        <Button size="sm" disabled={busy !== null} onClick={() => void review(report)}>
          {report.status === 'new' ? 'Mark resolved' : 'Reopen'}
        </Button>
      </div>
    </div>
  );
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-medium text-ink">Beta feedback</h1>
          <p className="mt-2 text-sm text-ink-muted">Reports from people testing Rashmi One.</p>
        </div>
        <Button
          onClick={() => {
            setVersion((v) => v + 1);
          }}
        >
          Refresh
        </Button>
      </div>
      <div className="max-w-xs">
        <Select
          label="Status"
          value={status}
          onChange={(value) => {
            setStatus(value);
            setOffset(0);
          }}
          options={[
            { value: '', label: 'All reports' },
            { value: 'new', label: 'New' },
            { value: 'resolved', label: 'Resolved' },
          ]}
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-negative-ink">
          {error}
        </p>
      )}
      {!data && !error && <p role="status">Loading feedback…</p>}
      {data?.rows.length === 0 && (
        <Card>
          <p className="p-5 text-sm text-ink-muted">No reports in this view yet.</p>
        </Card>
      )}
      <div className="space-y-4">
        {data?.rows.map((report) => (
          <Card key={report.id}>
            <article className="p-5">{content(report)}</article>
          </Card>
        ))}
      </div>
      {data && (
        <div className="flex items-center justify-between">
          <Button
            disabled={offset === 0}
            onClick={() => {
              setOffset((v) => Math.max(0, v - 30));
            }}
          >
            Previous
          </Button>
          <p className="text-sm text-ink-muted">{String(data.total)} {data.total === 1 ? 'report' : 'reports'}</p>
          <Button
            disabled={offset + 30 >= data.total}
            onClick={() => {
              setOffset((v) => v + 30);
            }}
          >
            Next
          </Button>
        </div>
      )}
      <Drawer
        open={detail !== null}
        onClose={() => {
          setDetail(null);
        }}
        title="Feedback report"
        width={580}
      >
        {detail && content(detail)}
      </Drawer>
      <Drawer
        open={image !== null}
        onClose={() => {
          setImage(null);
        }}
        title={`Screenshot · #${String(image?.id ?? '')}`}
        width={900}
      >
        {image && (
          <img
            src={image.data}
            alt={`Screenshot for feedback ${String(image.id)}`}
            className="h-auto w-full"
          />
        )}
      </Drawer>
    </div>
  );
}
