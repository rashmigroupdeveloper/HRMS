/**
 * Company switcher (docs/08 §3 group roles) — a quiet masthead pill:
 * "All companies" (consolidated) or one entity. Listbox popover that scales
 * from its trigger (docs/05 §2.3), keyboard-complete, Esc closes.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { Building2, Check, ChevronDown } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { cn } from '../ui';
import { setCompanyScope, useCompanyScope } from './company-scope';

interface Company {
  id: number;
  name: string;
  code: string;
}

export function CompanySwitcher({ compact = false }: { compact?: boolean }) {
  const scope = useCompanyScope();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    let alive = true;
    apiFetch<{ companies: Company[] }>('/api/core/companies')
      .then((res) => {
        if (alive) setCompanies([...res.companies].sort((a, b) => a.name.localeCompare(b.name)));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (companies.length < 2) return null;
  const current = companies.find((company) => company.id === scope) ?? null;
  const label = current ? current.code : 'All companies';

  const choose = (id: number | null): void => {
    setCompanyScope(id);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`Company scope: ${current ? current.name : 'all companies (consolidated)'}`}
        onClick={() => {
          setOpen((value) => !value);
        }}
        className={cn(
          'u-press u-tap inline-flex h-10 items-center gap-2 rounded-full bg-surface px-3.5 text-sm font-medium text-ink u-shadow-card',
          'transition-colors duration-(--motion-micro) hover:bg-surface-2',
        )}
      >
        <Building2 className="size-4 text-ink-muted" aria-hidden />
        {compact ? null : <span className="max-w-[9rem] truncate">{label}</span>}
        <ChevronDown className="size-3.5 text-ink-muted" aria-hidden />
      </button>
      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Choose company"
          className="u-pop-in u-shadow-float absolute left-0 top-full z-(--z-popover) mt-2 max-h-[min(70vh,28rem)] w-80 overflow-auto rounded-tile bg-surface p-1.5"
          style={{ transformOrigin: 'top left' }}
        >
          <Option selected={scope === null} onSelect={() => { choose(null); }} title="All companies" meta="Consolidated group view" />
          <li role="separator" className="mx-3 my-1 border-t border-dotted border-line-strong" />
          {companies.map((company) => (
            <Option
              key={company.id}
              selected={company.id === scope}
              onSelect={() => {
                choose(company.id);
              }}
              title={company.name}
              meta={company.code}
            />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Option({ selected, onSelect, title, meta }: { selected: boolean; onSelect: () => void; title: string; meta: string }) {
  return (
    <li
      role="option"
      aria-selected={selected}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        'flex cursor-pointer items-center justify-between gap-3 rounded-row px-3 py-2.5 text-sm',
        selected ? 'bg-accent text-accent-ink' : 'text-ink hover:bg-accent-soft',
      )}
    >
      <span className="min-w-0">
        <span className="block truncate font-medium">{title}</span>
        <span className={cn('block text-xs', selected ? 'text-accent-ink/70' : 'text-ink-muted')}>{meta}</span>
      </span>
      {selected ? <Check className="size-4 shrink-0" aria-hidden /> : null}
    </li>
  );
}
