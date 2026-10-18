export type DayPortion = 'full_day' | 'first_half' | 'second_half';
export function readDayPortion(value: unknown): DayPortion {
  return value === 'first_half' || value === 'second_half' ? value : 'full_day';
}
export function dayPortionLabel(value: unknown): string {
  return value === 'first_half' ? 'First half' : value === 'second_half' ? 'Second half' : 'Whole day';
}
export const DAY_PORTION_OPTIONS = [
  { value: 'full_day', label: 'Whole day' },
  { value: 'first_half', label: 'First half' },
  { value: 'second_half', label: 'Second half' },
];
