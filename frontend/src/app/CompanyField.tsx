/**
 * E2E-040: pick a company by name. Defaults to the signed-in employee's company
 * (or the only company returned), and remembers the last choice.
 */
import { useEffect, useRef } from 'react';
import { Select } from '../ui';
import { useDashboardResource } from '../pages/home/useDashboardResource';
import { rememberCompanyId } from '../pages/reports/report-utils';

interface CompanyList {
  companies: { id: number; name: string; code: string }[];
  homeCompanyId: number | null;
}

export function CompanyField({
  value,
  onChange,
  error,
  label = 'Company',
}: {
  value: string;
  onChange: (companyId: string) => void;
  error?: string | undefined;
  label?: string;
}) {
  const list = useDashboardResource<CompanyList>('/api/core/companies');
  const applied = useRef(false);

  useEffect(() => {
    const companies = list.data?.companies;
    if (applied.current || companies === undefined || companies.length === 0) return;
    const known = companies.some((company) => String(company.id) === value);
    if (known) {
      applied.current = true;
      return;
    }
    const home = companies.find((company) => company.id === list.data?.homeCompanyId) ?? companies[0];
    if (home === undefined) return;
    applied.current = true;
    rememberCompanyId(String(home.id));
    onChange(String(home.id));
  }, [list.data, onChange, value]);

  return (
    <Select
      label={label}
      required
      value={value}
      error={error}
      disabled={list.loading || (list.data?.companies.length ?? 0) === 0}
      hint={list.error ?? (list.loading ? 'Loading companies…' : 'The entity this action applies to.')}
      placeholder="Choose a company"
      onChange={(next) => {
        rememberCompanyId(next);
        onChange(next);
      }}
      options={(list.data?.companies ?? []).map((company) => ({
        value: String(company.id),
        label: `${company.name} (${company.code})`,
      }))}
    />
  );
}
