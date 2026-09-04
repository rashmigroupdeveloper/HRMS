import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { Select, type SelectOption } from '../../ui';

interface CompanyRow {
  id: number;
  code: string;
  name: string;
}

interface CompanySelectProps {
  value: string;
  onChange: (value: string) => void;
  optional?: boolean;
  error?: string | undefined;
  hint?: string | undefined;
}

/** Company choice backed by the canonical entity master, never a guessed numeric ID. */
export function CompanySelect({
  value,
  onChange,
  optional = false,
  error,
  hint,
}: CompanySelectProps) {
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void apiFetch<{ rows: CompanyRow[] }>('/api/org/companies')
      .then((body) => {
        if (!active) return;
        setCompanies(body.rows);
        setLoadError(null);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setLoadError(cause instanceof Error ? cause.message : 'Legal entities could not be loaded.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const options = useMemo<SelectOption[]>(() => {
    const rows = companies.map((company) => ({
      value: String(company.id),
      label: company.code,
      description: company.name,
    }));
    return optional
      ? [{ value: '', label: 'All permitted entities' }, ...rows]
      : rows;
  }, [companies, optional]);

  useEffect(() => {
    if (loading) return;
    if (value !== '' && !companies.some((company) => String(company.id) === value)) {
      onChange('');
      return;
    }
    if (!optional && value === '' && companies.length === 1) {
      const onlyCompany = companies[0];
      if (onlyCompany) onChange(String(onlyCompany.id));
    }
  }, [companies, loading, onChange, optional, value]);

  return (
    <Select
      label="Legal entity"
      options={options}
      value={value}
      onChange={onChange}
      placeholder={loading ? 'Loading legal entities…' : 'Select legal entity'}
      error={loadError ?? error}
      hint={hint}
      disabled={loading || loadError !== null}
      required={!optional}
    />
  );
}
