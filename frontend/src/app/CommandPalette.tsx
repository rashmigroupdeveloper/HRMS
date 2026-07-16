/**
 * ⌘K command palette (docs/05 §6 kill-list #8: "⌘K everywhere"). Quick-nav over
 * the user's permitted destinations — the power-user surface HR ops lives in.
 * Composed from tokens/kit primitives; portal + scrim like the Drawer.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { CornerDownLeft, Search } from 'lucide-react';
import type { SessionUser } from '../lib/session';
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
}

/** Extra deep destinations beyond the top-level nav (permission-gated by route). */
function buildCommands(user: SessionUser): Command[] {
  const nav = navForUser(user).map((item): Command => ({ label: item.label, to: item.to, group: 'Navigate' }));
  const extras: Command[] = [
    { label: 'Muster summary', to: '/attendance/muster', group: 'Attendance' },
    { label: 'Absence cases', to: '/attendance/absence-cases', group: 'Attendance' },
    { label: 'Device health', to: '/attendance/devices', group: 'Attendance' },
    { label: 'Month lock', to: '/attendance/month-lock', group: 'Attendance' },
    { label: 'Boarding & exits (R24)', to: '/reports/boarding-exit', group: 'Reports' },
    { label: 'My attendance', to: '/my/attendance', group: 'Me' },
    { label: 'My leave', to: '/my/leave', group: 'Me' },
    { label: 'My letters', to: '/my/letters', group: 'Me' },
    { label: 'Policies', to: '/policies', group: 'Me' },
  ];
  // De-dupe by destination, preferring the nav label.
  const seen = new Set(nav.map((c) => c.to));
  return [...nav, ...extras.filter((c) => !seen.has(c.to))];
}

export function CommandPalette({ open, onClose, user }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const commands = useMemo(() => buildCommands(user), [user]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(q) || c.group.toLowerCase().includes(q));
  }, [commands, query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      // Focus after mount so the caret lands in the field.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  if (!open) return null;

  const go = (to: string): void => {
    onClose();
    void navigate(to);
  };

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
                setActive((index) => Math.min(index + 1, results.length - 1));
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
            placeholder="Jump to…"
            className="h-14 w-full bg-transparent text-[0.95rem] text-ink outline-none placeholder:text-ink-faint"
            aria-label="Search destinations"
          />
          <kbd className="hidden rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-ink-muted sm:block">
            ESC
          </kbd>
        </div>

        <ul className="max-h-[52vh] overflow-y-auto p-2">
          {results.length === 0 && (
            <li className="px-3 py-8 text-center text-sm text-ink-muted">No destinations match “{query}”.</li>
          )}
          {results.map((command, index) => (
            <li key={command.to}>
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
                <span className="font-medium">{command.label}</span>
                <span className="flex items-center gap-2">
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
