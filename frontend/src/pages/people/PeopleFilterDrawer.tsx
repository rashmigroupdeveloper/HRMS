/**
 * People directory filter drawer (docs/05 §4.2 — "filters: entity, plant,
 * dept, category, status, RM"). Composition of FilterPanel inside a right
 * Drawer, zero invented primitives (§0.1 firewall).
 *
 * Facets are LOADED from `/api/employees/facets`, never authored here. An
 * earlier version shipped four hardcoded entity headcounts (667/174/96/57);
 * they were wrong the moment anyone joined, and a fabricated count is
 * indistinguishable from a real one (docs/05 §4.8 — never fake data).
 *
 * Every facet offered is a filter the list API actually applies, so the drawer
 * can never promise a narrowing it cannot deliver. Selections live in the
 * PARENT so they survive close/reopen (§6 kill-list #2).
 */
import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import {
  Button,
  Checkbox,
  Drawer,
  FilterPanel,
  FilterSection,
  Skeleton,
  Switch,
} from '../../ui';

interface Facet {
  code: string;
  label: string;
  count: number;
}

interface DirectoryFacets {
  entities: Facet[];
  departments: Facet[];
  categories: Facet[];
  locations: Facet[];
  statuses: Facet[];
  total: number;
}

export interface PeopleFilters {
  /** company codes */ entities: string[];
  /** employee status codes (onboarding | active | on_notice | exited) */ statuses: string[];
  /** department ids as strings */ departments: string[];
  /** location ids as strings */ locations: string[];
  /** employment category codes */ categories: string[];
  activeOnly: boolean;
}

export const EMPTY_PEOPLE_FILTERS: PeopleFilters = {
  entities: [],
  statuses: [],
  departments: [],
  locations: [],
  categories: [],
  activeOnly: true,
};

function toggled(list: string[], item: string): string[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

export function countActiveFilters(filters: PeopleFilters): number {
  return (
    filters.entities.length +
    filters.statuses.length +
    filters.departments.length +
    filters.locations.length +
    filters.categories.length +
    (filters.activeOnly ? 0 : 1)
  );
}

interface PeopleFilterDrawerProps {
  open: boolean;
  onClose: () => void;
  filters: PeopleFilters;
  onChange: (next: PeopleFilters) => void;
  onApply: () => void;
}

export function PeopleFilterDrawer({
  open,
  onClose,
  filters,
  onChange,
  onApply,
}: PeopleFilterDrawerProps) {
  const [facets, setFacets] = useState<DirectoryFacets | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Counts describe the list the user is looking at, so they are refetched
  // whenever the active-only toggle changes, not just once on mount.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiFetch<DirectoryFacets>(`/api/employees/facets?activeOnly=${String(filters.activeOnly)}`)
      .then((result) => {
        if (!cancelled) setFacets(result);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : 'Could not load filter counts.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, filters.activeOnly]);

  const section = (
    title: string,
    selected: string[],
    options: Facet[] | undefined,
    onToggle: (code: string) => void,
    unit: string,
  ) => {
    if (loading && !facets) {
      return (
        <FilterSection title={title}>
          <div className="space-y-2" aria-busy="true">
            <Skeleton />
            <Skeleton />
            <Skeleton />
          </div>
        </FilterSection>
      );
    }
    if (!options || options.length === 0) return null;
    return (
      <FilterSection title={title} count={selected.length}>
        {options.map((option) => (
          <Checkbox
            key={option.code}
            label={option.label}
            description={`${option.count.toLocaleString('en-IN')} ${unit}`}
            checked={selected.includes(option.code)}
            onChange={() => {
              onToggle(option.code);
            }}
          />
        ))}
      </FilterSection>
    );
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Filter people"
      subtitle={
        facets
          ? `${facets.total.toLocaleString('en-IN')} employees in scope`
          : 'Choices are kept until you clear them.'
      }
      width={400}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button variant="primary" onClick={onApply}>
            Apply filters
          </Button>
        </div>
      }
    >
      <FilterPanel
        activeCount={countActiveFilters(filters)}
        onClearAll={() => {
          onChange(EMPTY_PEOPLE_FILTERS);
        }}
      >
        {error !== null && (
          <p className="mb-3 text-sm text-negative" role="alert">
            {error}
          </p>
        )}

        {section(
          'Entity',
          filters.entities,
          facets?.entities,
          (code) => {
            onChange({ ...filters, entities: toggled(filters.entities, code) });
          },
          'people',
        )}

        {section(
          'Status',
          filters.statuses,
          facets?.statuses,
          (code) => {
            onChange({ ...filters, statuses: toggled(filters.statuses, code) });
          },
          'people',
        )}

        {section(
          'Category',
          filters.categories,
          facets?.categories,
          (code) => {
            onChange({ ...filters, categories: toggled(filters.categories, code) });
          },
          'people',
        )}

        {section(
          'Department',
          filters.departments,
          facets?.departments,
          (code) => {
            onChange({ ...filters, departments: toggled(filters.departments, code) });
          },
          'people',
        )}

        {section(
          'Plant / location',
          filters.locations,
          facets?.locations,
          (code) => {
            onChange({ ...filters, locations: toggled(filters.locations, code) });
          },
          'people',
        )}

        <FilterSection title="Options">
          <Switch
            label="Active employees only"
            description="Hide exits and inactive records."
            checked={filters.activeOnly}
            onChange={(e) => {
              onChange({ ...filters, activeOnly: e.currentTarget.checked });
            }}
          />
        </FilterSection>
      </FilterPanel>
    </Drawer>
  );
}
