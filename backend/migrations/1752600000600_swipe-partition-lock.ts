/**
 * E2E-024: two overlapping punch uploads (or the Kent webhook racing the pull) that both need a
 * new month partition raced on CREATE TABLE and one failed with a generic 409. Serialise
 * partition creation with a transaction-scoped advisory lock and re-check after taking it.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    CREATE OR REPLACE FUNCTION att.ensure_swipe_partition(p_any_day DATE) RETURNS void AS $$
    DECLARE
      v_start DATE := date_trunc('month', p_any_day)::date;
      v_end   DATE := (v_start + interval '1 month')::date;
      v_name  TEXT := 'swipe_events_' || to_char(v_start, 'YYYYMM');
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'att' AND c.relname = v_name) THEN
        RETURN;
      END IF;
      PERFORM pg_advisory_xact_lock(hashtext('att.ensure_swipe_partition'));
      IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'att' AND c.relname = v_name) THEN
        EXECUTE format('CREATE TABLE att.%I PARTITION OF att.swipe_events FOR VALUES FROM (%L) TO (%L)', v_name, v_start, v_end);
      END IF;
    END $$ LANGUAGE plpgsql;
  `);
}

export function down(): void {
  // The locked version is a strict improvement; nothing to restore.
}
