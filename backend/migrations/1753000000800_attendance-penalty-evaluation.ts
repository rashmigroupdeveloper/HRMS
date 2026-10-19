/** ATT-05/SHF-01: frozen findings separate from P/A and payable quantities. */
import type { MigrationBuilder } from 'node-pg-migrate';
export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';
    CREATE OR REPLACE FUNCTION att.valid_penalty_evaluation(value JSONB) RETURNS BOOLEAN
    LANGUAGE plpgsql IMMUTABLE AS $$
    DECLARE finding JSONB; rule JSONB; seen TEXT[] := '{}'; cause TEXT;
    BEGIN
      IF value IS NULL THEN RETURN true; END IF;
      IF jsonb_typeof(value) <> 'array' THEN RETURN false; END IF;
      IF jsonb_array_length(value)>2 THEN RETURN false; END IF;
      FOR finding IN SELECT jsonb_array_elements(value) LOOP
        IF jsonb_typeof(finding)<>'object' OR NOT finding ?& ARRAY['cause','minutes','rule']
          OR finding - ARRAY['cause','minutes','rule'] <> '{}'::jsonb THEN RETURN false; END IF;
        cause := finding->>'cause'; rule := finding->'rule';
        IF jsonb_typeof(finding->'cause')<>'string' OR cause NOT IN ('late_arrival','early_exit') OR cause=ANY(seen)
          OR jsonb_typeof(finding->'minutes')<>'number' THEN RETURN false; END IF;
        seen := array_append(seen,cause);
        IF (finding->>'minutes')::numeric<=0 OR trunc((finding->>'minutes')::numeric)<>(finding->>'minutes')::numeric THEN RETURN false; END IF;
        IF jsonb_typeof(rule)<>'object' OR NOT rule ?& ARRAY['fromMin','toMin','effect']
          OR rule - ARRAY['fromMin','toMin','effect'] <> '{}'::jsonb
          OR jsonb_typeof(rule->'fromMin')<>'number' OR jsonb_typeof(rule->'effect')<>'string' OR rule->>'effect' NOT IN ('late','half_day') THEN RETURN false; END IF;
        IF (rule->>'fromMin')::numeric<0 OR trunc((rule->>'fromMin')::numeric)<>(rule->>'fromMin')::numeric
          OR (rule->>'fromMin')::numeric>(finding->>'minutes')::numeric THEN RETURN false; END IF;
        IF rule->'toMin'<>'null'::jsonb THEN
          IF jsonb_typeof(rule->'toMin')<>'number' THEN RETURN false; END IF;
          IF trunc((rule->>'toMin')::numeric)<>(rule->>'toMin')::numeric OR (rule->>'toMin')::numeric<(finding->>'minutes')::numeric THEN RETURN false; END IF;
        END IF;
      END LOOP;
      RETURN true;
    END $$;
    ALTER TABLE att.day_records ADD COLUMN penalty_evaluation JSONB;
    COMMENT ON COLUMN att.day_records.penalty_evaluation IS
      'SHF-01: frozen late/early rule findings; [] evaluated none, NULL historical/not evaluated. Never a payable-day quantity.';
    ALTER TABLE att.day_records ADD CONSTRAINT day_penalty_evaluation_valid
      CHECK (att.valid_penalty_evaluation(penalty_evaluation));
    ALTER TABLE att.day_records ADD CONSTRAINT day_penalty_flag_matches_evaluation
      CHECK (penalty_evaluation IS NULL OR penalty_flag=(jsonb_array_length(penalty_evaluation)>0));
  `);
}
// Preserve historical evaluations on rollback; remove consumers before a forward repair.
export function down(): void { throw new Error('Penalty evaluation snapshots require a reviewed forward migration'); }
