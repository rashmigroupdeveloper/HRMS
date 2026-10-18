/** Indian financial-year helpers shared by the tax screens. */
export function currentFy(today = new Date(Date.now() + 5.5 * 3600_000)): string {
  const y = today.getUTCFullYear();
  const start = today.getUTCMonth() >= 3 ? y : y - 1;
  return `${String(start)}-${String((start + 1) % 100).padStart(2, '0')}`;
}
export function fyOptions(count = 3, today?: Date): { value: string; label: string }[] {
  const start = Number(currentFy(today).slice(0, 4));
  return Array.from({ length: count }, (_, i) => {
    const s = start - i;
    const fy = `${String(s)}-${String((s + 1) % 100).padStart(2, '0')}`;
    return { value: fy, label: `FY ${fy}` };
  });
}
export const inr = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
