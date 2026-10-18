/**
 * Domain ownership of policy settings (docs/08 role notes made enforceable):
 * payroll_admin holds admin.settings for "payroll policy values only",
 * it_admin for "technical settings only", hr_head for "HR policy values only".
 * super_admin may change anything. Unknown namespaces are super_admin-only.
 */
const TECHNICAL = [/^auth\./, /^att\.device_/, /^att\.quarantine_/];
const PAYROLL = [/^pay\./, /^loans\./];
const HR = [/^att\./, /^lv\./, /^lifecycle\./, /^probation\./, /^wf\./, /^reporting\./, /^loans\./];

export function settingOwners(key: string): readonly string[] {
  if (TECHNICAL.some((r) => r.test(key))) return ['it_admin'];
  const owners: string[] = [];
  if (PAYROLL.some((r) => r.test(key))) owners.push('payroll_admin');
  if (HR.some((r) => r.test(key))) owners.push('hr_head');
  return owners;
}

export function canEditSetting(roleCodes: ReadonlySet<string>, key: string): boolean {
  if (roleCodes.has('super_admin')) return true;
  return settingOwners(key).some((role) => roleCodes.has(role));
}
