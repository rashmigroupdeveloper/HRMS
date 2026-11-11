/** PAY-15: expose the existing gratuity behavior for audited payroll-admin configuration. */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';
    INSERT INTO core.settings(key,value,value_type,description)
      VALUES ('pay.gratuity_eligibility_mode','"LIBERAL_4Y240D"'::jsonb,'string',
        'PAY-15: STRICT_5Y or LIBERAL_4Y240D; preserves the existing liberal calendar approximation until payroll admin changes it; not worked-day proof')
      ON CONFLICT(key) DO NOTHING;
  `);
}

export function down(pgm: MigrationBuilder): void {
  // Preserve administrator decisions on rollback; old application versions ignore this setting.
  pgm.sql(`SET lock_timeout = '5s';`);
}
