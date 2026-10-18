import type { AttendanceSchedule } from '../pages/attendance/attendance-schedule';
export function scheduleFixture(date: string): AttendanceSchedule {
  return { date, dayKind: 'working', shiftCode: 'G5', shiftName: 'Two-half general shift', windows: [
    { dayPortion: 'full_day', startsAt: `${date}T09:00:00+05:30`, endsAt: `${date}T18:00:00+05:30` },
    { dayPortion: 'first_half', startsAt: `${date}T09:00:00+05:30`, endsAt: `${date}T13:30:00+05:30` },
    { dayPortion: 'second_half', startsAt: `${date}T13:30:00+05:30`, endsAt: `${date}T18:00:00+05:30` },
  ] };
}
