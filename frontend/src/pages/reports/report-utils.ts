import { apiFetch } from '../../lib/api';
import { toast, todayISOIST } from '../../ui';
import { currentMonthIST } from '../home/dashboard-format';

export function defaultCompanyId(): string {
  return localStorage.getItem('hrms.reportCompanyId') ?? '';
}

export function rememberCompanyId(value: string): void {
  if (/^\d+$/.test(value)) localStorage.setItem('hrms.reportCompanyId', value);
}

export function defaultMonth(): string {
  return currentMonthIST();
}

export function defaultReportDate(): string {
  const today = todayISOIST();
  const yesterday = new Date(`${today}T12:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  return yesterday.toISOString().slice(0, 10);
}

export function qs(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue;
    search.set(key, String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}

export async function downloadExcel(
  path: string,
  emptyMessage = 'No rows to export for these filters.',
): Promise<void> {
  try {
    const file = await apiFetch<{ filename: string; base64: string }>(path);
    const bytes = Uint8Array.from(atob(file.base64), (c) => c.charCodeAt(0));
    const url = URL.createObjectURL(
      new Blob([bytes], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = file.filename;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success('Excel ready', { description: file.filename });
  } catch (cause) {
    toast.error('Export failed', {
      description: cause instanceof Error ? cause.message : emptyMessage,
    });
  }
}
