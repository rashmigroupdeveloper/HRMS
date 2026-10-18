/**
 * MNC readiness: every legal entity carries its own country, currency,
 * timezone and locale instead of the code assuming India/INR/IST. Indian
 * entities keep today's behaviour (defaults); the group's overseas entities
 * (Dubai, UK, Bahrain, Tanzania) get their real values so reports, punches
 * and payslips can be localised per entity. Statutory India payroll stays
 * gated by companies.is_india_payroll.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    ALTER TABLE core.companies
      ADD COLUMN country_code  text NOT NULL DEFAULT 'IN' CHECK (country_code ~ '^[A-Z]{2}$'),
      ADD COLUMN currency_code text NOT NULL DEFAULT 'INR' CHECK (currency_code ~ '^[A-Z]{3}$'),
      ADD COLUMN timezone      text NOT NULL DEFAULT 'Asia/Kolkata' CHECK (timezone ~ '^[A-Za-z_]+(/[A-Za-z_+-]+)*$'),
      ADD COLUMN locale        text NOT NULL DEFAULT 'en-IN' CHECK (locale ~ '^[a-z]{2}(-[A-Z]{2})?$');
    UPDATE core.companies SET country_code = 'AE', currency_code = 'AED', timezone = 'Asia/Dubai', locale = 'en-AE' WHERE code = 'RPF';
    UPDATE core.companies SET country_code = 'GB', currency_code = 'GBP', timezone = 'Europe/London', locale = 'en-GB' WHERE code = 'RMT';
    UPDATE core.companies SET country_code = 'BH', currency_code = 'BHD', timezone = 'Asia/Bahrain', locale = 'en-BH' WHERE code = 'RMB';
    UPDATE core.companies SET country_code = 'TZ', currency_code = 'TZS', timezone = 'Africa/Dar_es_Salaam', locale = 'en-TZ' WHERE code = 'RBS';
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    ALTER TABLE core.companies
      DROP COLUMN IF EXISTS country_code,
      DROP COLUMN IF EXISTS currency_code,
      DROP COLUMN IF EXISTS timezone,
      DROP COLUMN IF EXISTS locale;
  `);
}
