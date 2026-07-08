/**
 * People directory filter drawer (docs/05 §4.2) — composition of FilterPanel
 * inside a right Drawer, zero invented primitives (§0.1 firewall).
 *
 * Selections live in the PARENT so they survive close/reopen and (Phase 1)
 * persist per user (kill-list #2 — "recruiters hate re-applying filters").
 * Facet data below is PLACEHOLDER shaped to the live EMS master (docs/11 §0);
 * Phase 1 loads counts async — the `loading` prop on a section shows
 * layout-matching skeletons while they arrive.
 */
import {
  Button,
  Checkbox,
  Drawer,
  FilterPanel,
  FilterSection,
  Switch,
} from '../../ui';

const ENTITY_FACETS = [
  { code: 'RML', label: 'Rashmi Metaliks', count: 667 },
  { code: 'RGH', label: 'Rashmi Green Hydrogen', count: 174 },
  { code: 'RDL', label: 'Reach Dredging', count: 96 },
  { code: 'RPL', label: 'Rashmi Paradigm', count: 57 },
];

const STATUS_FACETS = ['Confirmed', 'Probation', 'On leave', 'Notice period'];

export interface PeopleFilters {
  entities: string[];
  statuses: string[];
  activeOnly: boolean;
}

export const EMPTY_PEOPLE_FILTERS: PeopleFilters = {
  entities: [],
  statuses: [],
  activeOnly: true,
};

function toggled(list: string[], item: string): string[] {
  return list.includes(item)
    ? list.filter((x) => x !== item)
    : [...list, item];
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
  const activeCount =
    filters.entities.length +
    filters.statuses.length +
    (filters.activeOnly ? 0 : 1);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Filter people"
      subtitle="Choices are kept until you clear them."
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
        activeCount={activeCount}
        onClearAll={() => {
          onChange(EMPTY_PEOPLE_FILTERS);
        }}
      >
        <FilterSection title="Entity" count={filters.entities.length}>
          {ENTITY_FACETS.map((e) => (
            <Checkbox
              key={e.code}
              label={e.label}
              description={`${e.code} · ${String(e.count)} people`}
              checked={filters.entities.includes(e.code)}
              onChange={() => {
                onChange({
                  ...filters,
                  entities: toggled(filters.entities, e.code),
                });
              }}
            />
          ))}
        </FilterSection>

        <FilterSection title="Status" count={filters.statuses.length}>
          {STATUS_FACETS.map((s) => (
            <Checkbox
              key={s}
              label={s}
              checked={filters.statuses.includes(s)}
              onChange={() => {
                onChange({ ...filters, statuses: toggled(filters.statuses, s) });
              }}
            />
          ))}
        </FilterSection>

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
