/** REQ-002: canonical values match the joining master and its database CHECK. */
import { z } from 'zod';
const aliases: Readonly<Record<string, string>> = {
  m: 'Male',
  male: 'Male',
  f: 'Female',
  female: 'Female',
  t: 'Transgender',
  transgender: 'Transgender',
  other: 'Transgender',
};
export const genderSchema = z.preprocess(
  (value) => {
    if (typeof value !== 'string') return value;
    const normalized = value.trim().toLowerCase();
    return normalized === '' ? undefined : (aliases[normalized] ?? value);
  },
  z.enum(['Male', 'Female', 'Transgender']).nullish(),
);
