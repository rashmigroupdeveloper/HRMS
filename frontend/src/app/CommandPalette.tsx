/**
 * ⌘K command palette (docs/05 §6 kill-list #8: "⌘K everywhere"). Quick-nav over
 * the user's permitted destinations AND people they can look up — hunters jump,
 * tourists browse. Composed from tokens/kit primitives; portal + scrim like the Drawer.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { CornerDownLeft, Search } from 'lucide-react';
import { apiFetch } from '../lib/api';
import type { SessionUser } from '../lib/session';
import { hasAnyPermission, hasPermission } from '../lib/session';
import { navForUser } from './nav-config';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  user: SessionUser;
}

interface Command {
  label: string;
  to: string;
  group: string;
  hint?: string;
}

interface DirectoryItem {
  ecode: string;
  name: string;
  designation: string | null;
  department: string | null;
  entity: string;
}

interface DirectoryResponse {
  items: DirectoryItem[];
}

const PEOPLE_DEBOUNCE_MS = 250;
const PEOPLE_PAGE_SIZE = 8;

/** Extra deep destinations beyond the top-level nav — one permission per route. */
export function filterExtras(user: SessionUser): Command[] {
  const extras: Command[] = [];
  if (hasPermission(user, 'attendance.muster.export')) {
    extras.push({ label: 'Muster summary', to: '/attendance/muster', group: 'Attendance' });
  }
  if (hasAnyPermission(user, ['reports.hr', 'attendance.team.read'])) {
    extras.push({ label: 'Absence cases', to: '/attendance/absence-cases', group: 'Attendance' });
  }
  if (hasPermission(user, 'admin.devices')) {
    extras.push({ label: 'Device health', to: '/attendance/devices', group: 'Attendance' });
  }
  if (hasPermission(user, 'attendance.month_lock')) {
    extras.push({ label: 'Month lock', to: '/attendance/month-lock', group: 'Attendance' });
  }
  if (hasPermission(user, 'reports.hr')) {
    extras.push({ label: 'Boarding & exits (R24)', to: '/reports/boarding-exit', group: 'Reports' });
  }
  if (hasPermission(user, 'attendance.own')) {
    extras.push({ label: 'My attendance', to: '/my/attendance', group: 'Me' });
    extras.push({ label: 'My leave', to: '/my/leave', group: 'Me' });
    extras.push({ label: 'My letters', to: '/my/letters', group: 'Me' });
  }
  extras.push({ label: 'Policies', to: '/policies', group: 'Me' });
  return extras;
}

function buildCommands(user: SessionUser): Command[] {
  const nav = navForUser(user).map((item): Command => ({ label: item.label, to: item.to, group: 'Navigate' }));
  const seen = new Set(nav.map((c) => c.to));
  return [...nav, ...filterExtras(user).filter((c) => !seen.has(c.to))];
}

function personToCommand(item: DirectoryItem): Command {
  const meta = [item.ecode, item.designation, item.department].filter(
    (part): part is string => typeof part === 'string' && part.length > 0,
  );
  return {
    label: item.name,
    to: `/people/${item.ecode}`,
    group: 'People',
    ...(meta.length > 0 ? { hint: meta.join(' · ') } : {}),
  };
}

function isAbortError(cause: unknown): boolean {
  return cause instanceof Error && cause.name === 'AbortError';
}

/** Directory lookup for hunters. Never invents people; API failures fall back to pages. */
function usePeopleSearch(open: boolean, query: string, enabled: boolean): Command[] {
  const [people, setPeople] = useState<Command[]>([]);

  useEffect(() => {
    const q = query.trim();
    if (!open || !enabled || q.length < 2) {
      setPeople([]);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void apiFetch<DirectoryResponse>(
        `/api/employees?q=${encodeURIComponent(q)}&pageSize=${String(PEOPLE_PAGE_SIZE)}&activeOnly=true`,
        { signal: controller.signal },
      )
        .then((res) => {
          if (cancelled) return;
          const items = Array.isArray(res.items) ? res.items : [];
          setPeople(items.map(personToCommand));
        })
        .catch((cause: unknown) => {
          // Abort = superseded query. ApiError / network: keep destinations only.
          if (cancelled || isAbortError(cause)) return;
          setPeople([]);
        });
    }, PEOPLE_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, query, enabled]);

  return people;
}

export function CommandPalette({ open, onClose, user }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const commands = useMemo(() => buildCommands(user), [user]);
  const canSearchPeople = hasPermission(user, 'employee.read');
  const people = usePeopleSearch(open, query, canSearchPeople);

  const destinations = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(q) || c.group.toLowerCase().includes(q));
  }, [commands, query]);

  const results = useMemo(() => [...people, ...destinations], [people, destinations]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query, people]);

  if (!open) return null;

  const go = (to: string): void => {
    onClose();
    void navigate(to);
  };

  const lastIndex = Math.max(results.length - 1, 0);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-[color-mix(in_srgb,var(--ink)_45%,transparent)] backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div className="u-shadow-float relative w-full max-w-xl overflow-hidden rounded-card bg-surface">
        <div className="flex items-center gap-3 border-b border-line/70 px-4">
          <Search className="size-4 shrink-0 text-ink-faint" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.currentTarget.value);
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActive((index) => Math.min(index + 1, lastIndex));
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActive((index) => Math.max(index - 1, 0));
              } else if (event.key === 'Enter') {
                event.preventDefault();
                const target = results[active];
                if (target) go(target.to);
              } else if (event.key === 'Escape') {
                onClose();
              }
            }}
            placeholder="Jump to a page or a person…"
            className="h-14 w-full bg-transparent text-[0.95rem] text-ink outline-none placeholder:text-ink-faint"
            aria-label="Jump to a page or a person"
          />
          <kbd className="hidden rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-ink-muted sm:block">
            ESC
          </kbd>
        </div>

        <ul className="max-h-[52vh] overflow-y-auto p-2">
          {results.length === 0 && (
            <li className="px-3 py-8 text-center text-sm text-ink-muted">No pages or people match</li>
          )}
          {results.map((command, index) => (
            <li key={`${command.group}:${command.to}`}>
              <button
                type="button"
                onClick={() => {
                  go(command.to);
                }}
                onMouseMove={() => {
                  setActive(index);
                }}
                className={
                  'flex w-full items-center justify-between gap-3 rounded-row px-3 py-2.5 text-left text-sm transition-colors ' +
                  (index === active ? 'bg-accent text-accent-ink' : 'text-ink hover:bg-surface-2')
                }
              >
                <span className="min-w-0">
                  <span className="font-medium">{command.label}</span>
                  {command.hint !== undefined && (
                    <span
                      className={
                        index === active
                          ? 'ml-2 text-[11px] text-accent-ink/70'
                          : 'ml-2 text-[11px] text-ink-faint'
                      }
                    >
                      {command.hint}
                    </span>
                  )}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className={index === active ? 'text-[11px] text-accent-ink/70' : 'text-[11px] text-ink-faint'}>
                    {command.group}
                  </span>
                  {index === active && <CornerDownLeft className="size-3.5" aria-hidden />}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body,
  );
}
