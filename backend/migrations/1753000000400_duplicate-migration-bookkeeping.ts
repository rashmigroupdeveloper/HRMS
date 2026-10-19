/** CORE-08/NFR-04: remove only the proven duplicate targeted-run tracking artifact. */
import type { MigrationBuilder } from 'node-pg-migrate';
export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';
    DO $$
    DECLARE columns text[];
    BEGIN
      IF to_regclass('public.undefined') IS NULL THEN RETURN; END IF;
      LOCK TABLE public.undefined IN ACCESS EXCLUSIVE MODE;
      SELECT array_agg(attname::text ORDER BY attnum) INTO columns FROM pg_attribute
        WHERE attrelid='public.undefined'::regclass AND attnum>0 AND NOT attisdropped;
      IF columns IS DISTINCT FROM ARRAY['id','name','run_on']::text[] THEN
        RAISE EXCEPTION 'Unexpected public.undefined columns; manual review required';
      END IF;
      IF EXISTS (SELECT 1 FROM public.undefined u
        WHERE u.name IS NULL OR u.name NOT IN
          ('1753000000000_holiday-scope-identity','1753000000100_document-vault-permissions')
          OR NOT EXISTS (SELECT 1 FROM public.pgmigrations p WHERE p.name=u.name)) THEN
        RAISE EXCEPTION 'Migration records are not canonical duplicates; manual review required';
      END IF;
      -- Never CASCADE: any external dependency must stop this cleanup.
      DROP TABLE public.undefined;
    END $$;
  `);
}
export function down(pgm: MigrationBuilder): void {
  // Canonical migration history is unchanged; do not recreate accidental bookkeeping.
  pgm.sql(`SET lock_timeout = '5s';`);
}
