/**
 * REQ-004 (documents), REQ-008 (declarations / e-sign), REQ-015 (medical).
 *
 * - core.documents gains candidate ownership, the doc.types code, a
 *   verification lifecycle (pending → verified | rejected with reason) and a
 *   SHA-256 of the stored bytes. doc.types grows to the joining checklist;
 *   mandatory_for stays data (comma-separated categories), so HR can change it.
 * - prv.declaration_texts (versioned wording) + prv.declarations: append-only
 *   record of what text (version + hash) was accepted, when, from which IP /
 *   user agent, with a typed or drawn signature.
 * - med.*: the medical questionnaire lives in its own schema with its own
 *   permission (employee.medical.*), a mandatory consent declaration, a
 *   retention class and an append-only access log. Nothing medical goes on
 *   core.employees or core.employee_family.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

const DECLARATIONS: [string, string, string][] = [
  ['joining_declaration', 'Employee declaration (RML/HR/02/01 §10)',
    'I hereby declare that the information furnished above is true and correct to the best of my knowledge and belief. I understand that any misrepresentation, suppression, or incorrect information may lead to disciplinary action, withdrawal of employment offer, or termination of employment as per company policy. I also consent to verification of the documents and information submitted by me for employment and statutory compliance purposes.'],
  ['epf_undertaking', 'EPF Form 11 undertaking',
    '1) Certified that the particulars are true to the best of my knowledge. 2) I authorise EPFO to use my Aadhaar for verification / authentication / eKYC purpose for service delivery. 3) Kindly transfer the fund and service details, if applicable, from the previous PF account as declared above to the present PF account. 4) In case of changes in above details, the same will be intimated to employer at the earliest.'],
  ['esic_declaration', 'ESIC Declaration Form-1',
    'I hereby declare that the particulars given by me are correct to the best of my knowledge and belief. I undertake to intimate the Corporation any changes in the membership of my family within 15 days of such change.'],
  ['gratuity_nomination', 'Gratuity nomination (Form F, Payment of Gratuity Rules r.6(1))',
    'I hereby nominate the person(s) mentioned to receive the gratuity payable after my death as also the gratuity standing to my credit in the event of my death before that amount has become payable, or having become payable has not been paid, and direct that the said amount of gratuity shall be paid in proportion indicated against the name(s) of the nominee(s). Nomination made herein invalidates my previous nomination.'],
  ['medical_consent', 'Consent to process health information (DPDP Act 2023)',
    'I consent to Rashmi Group processing the health information I provide in the Employee Medical Information form for occupational-health, emergency-care and workplace-safety purposes only. It will be visible only to authorised occupational-health / HR-medical staff, never to my manager, and kept for the retention period of my employment record. I may withdraw this consent at any time, after which the questionnaire answers are erased.'],
];

export function up(pgm: MigrationBuilder): void {
  const texts = DECLARATIONS.map(([kind, title, body]) =>
    `('${kind}', 1, '${title.replace(/'/g, "''")}', '${body.replace(/'/g, "''")}', encode(sha256(convert_to('${body.replace(/'/g, "''")}', 'UTF8')), 'hex'))`).join(',\n      ');
  pgm.sql(`
    SET lock_timeout = '5s';

    ALTER TABLE core.documents
      ADD COLUMN IF NOT EXISTS candidate_id BIGINT REFERENCES core.onboarding_candidates(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS doc_type TEXT REFERENCES doc.types(code),
      ADD COLUMN IF NOT EXISTS verification_status TEXT CHECK (verification_status IS NULL OR verification_status IN ('pending', 'verified', 'rejected')),
      ADD COLUMN IF NOT EXISTS verified_by BIGINT REFERENCES core.users(id),
      ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
      ADD COLUMN IF NOT EXISTS sha256 TEXT,
      ADD COLUMN IF NOT EXISTS document_number TEXT,
      ADD CONSTRAINT documents_rejection_reason CHECK (verification_status IS DISTINCT FROM 'rejected' OR length(btrim(coalesce(rejection_reason, ''))) >= 3);
    CREATE INDEX IF NOT EXISTS documents_candidate_idx ON core.documents (candidate_id) WHERE candidate_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS documents_doc_type_idx ON core.documents (owner_employee_id, doc_type) WHERE doc_type IS NOT NULL;

    ALTER TABLE doc.types
      ADD COLUMN IF NOT EXISTS joining_checklist BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS max_files SMALLINT NOT NULL DEFAULT 1 CHECK (max_files BETWEEN 1 AND 20);
    INSERT INTO doc.types (code, name, typically_expires, retention_class, mandatory_for, sort_order, joining_checklist, max_files)
    VALUES
      ('photo',           'Photograph',                               false, 'employment',   'white_collar,blue_collar,trainee,consultant,contract', 5,  true, 1),
      ('bank_proof',      'Bank proof (cancelled cheque / passbook)', false, 'statutory_id', 'white_collar,blue_collar,trainee,consultant,contract', 25, true, 1),
      ('education',       'Education certificate',                    false, 'employment',   'white_collar,trainee',                                 50, true, 10),
      ('certification',   'Additional certification',                 true,  'employment',   '',                                                     55, true, 10),
      ('experience',      'Experience / relieving letter',            false, 'employment',   '',                                                     60, true, 10),
      ('payslip',         'Last payslips (previous employer)',        false, 'employment',   '',                                                     65, true, 6),
      ('passport',        'Passport',                                 true,  'statutory_id', '',                                                     70, true, 1),
      ('driving_licence', 'Driving licence',                          true,  'statutory_id', '',                                                     75, true, 1),
      ('disability',      'Disability certificate',                   true,  'health',       '',                                                     80, true, 1),
      ('marriage',        'Marriage certificate',                     false, 'employment',   '',                                                     85, true, 1),
      ('signature',       'Signature specimen',                       false, 'employment',   '',                                                     90, false, 1),
      ('address_proof',   'Address proof',                            false, 'statutory_id', '',                                                     35, true, 2)
    ON CONFLICT (code) DO NOTHING;
    UPDATE doc.types SET joining_checklist = true, mandatory_for = 'white_collar,blue_collar,trainee,consultant,contract'
      WHERE code IN ('pan', 'aadhaar');
    UPDATE doc.types SET joining_checklist = true WHERE code = 'medical_fitness';

    CREATE TABLE prv.declaration_texts (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      kind TEXT NOT NULL,
      version INT NOT NULL CHECK (version > 0),
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      sha256 TEXT NOT NULL,
      is_current BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (kind, version)
    );
    CREATE UNIQUE INDEX declaration_texts_one_current ON prv.declaration_texts (kind) WHERE is_current;
    INSERT INTO prv.declaration_texts (kind, version, title, body, sha256) VALUES
      ${texts};

    CREATE TABLE prv.declarations (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      text_id BIGINT NOT NULL REFERENCES prv.declaration_texts(id),
      kind TEXT NOT NULL,
      text_version INT NOT NULL,
      text_sha256 TEXT NOT NULL,
      candidate_id BIGINT REFERENCES core.onboarding_candidates(id) ON DELETE SET NULL,
      employee_id BIGINT REFERENCES core.employees(id),
      actor_user_id BIGINT REFERENCES core.users(id),
      accepted BOOLEAN NOT NULL,
      signature_kind TEXT NOT NULL CHECK (signature_kind IN ('typed', 'drawn')),
      signed_name TEXT NOT NULL,
      signature_document_id BIGINT REFERENCES core.documents(id),
      ip TEXT,
      user_agent TEXT,
      accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT declarations_subject CHECK (candidate_id IS NOT NULL OR employee_id IS NOT NULL),
      CONSTRAINT declarations_drawn_has_image CHECK (signature_kind <> 'drawn' OR signature_document_id IS NOT NULL)
    );
    CREATE INDEX declarations_candidate_idx ON prv.declarations (candidate_id) WHERE candidate_id IS NOT NULL;
    CREATE INDEX declarations_employee_idx ON prv.declarations (employee_id, kind) WHERE employee_id IS NOT NULL;
    -- Append-only, except linking a candidate's declaration to the employee it became.
    CREATE OR REPLACE FUNCTION prv.declarations_guard() RETURNS trigger AS $$
    BEGIN
      IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'prv.declarations is append-only'; END IF;
      IF NEW.employee_id IS DISTINCT FROM OLD.employee_id AND OLD.employee_id IS NULL
         AND (to_jsonb(NEW) - 'employee_id') = (to_jsonb(OLD) - 'employee_id') THEN RETURN NEW; END IF;
      RAISE EXCEPTION 'prv.declarations is append-only';
    END;
    $$ LANGUAGE plpgsql;
    CREATE TRIGGER declarations_guard BEFORE UPDATE OR DELETE ON prv.declarations
      FOR EACH ROW EXECUTE FUNCTION prv.declarations_guard();

    CREATE SCHEMA IF NOT EXISTS med;
    CREATE TABLE med.questionnaires (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      employee_id BIGINT REFERENCES core.employees(id),
      candidate_id BIGINT REFERENCES core.onboarding_candidates(id) ON DELETE SET NULL,
      consent_declaration_id BIGINT NOT NULL REFERENCES prv.declarations(id),
      answers JSONB NOT NULL,
      height_cm NUMERIC(5,1) CHECK (height_cm IS NULL OR (height_cm >= 50 AND height_cm <= 250)),
      weight_kg NUMERIC(5,1) CHECK (weight_kg IS NULL OR (weight_kg >= 20 AND weight_kg <= 300)),
      bmi NUMERIC(5,1) GENERATED ALWAYS AS (CASE WHEN height_cm > 0 AND weight_kg > 0 THEN round(weight_kg / ((height_cm / 100) * (height_cm / 100)), 1) END) STORED,
      retention_class TEXT NOT NULL DEFAULT 'health',
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'withdrawn')),
      withdrawn_at TIMESTAMPTZ,
      submitted_by_user_id BIGINT REFERENCES core.users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT questionnaires_subject CHECK (candidate_id IS NOT NULL OR employee_id IS NOT NULL),
      CONSTRAINT questionnaires_withdrawn_erased CHECK (status <> 'withdrawn' OR (answers = '{}'::jsonb AND height_cm IS NULL AND weight_kg IS NULL))
    );
    CREATE UNIQUE INDEX questionnaires_one_active_emp ON med.questionnaires (employee_id) WHERE status = 'active' AND employee_id IS NOT NULL;
    CREATE TRIGGER questionnaires_updated_at BEFORE UPDATE ON med.questionnaires
      FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

    CREATE TABLE med.access_log (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      questionnaire_id BIGINT REFERENCES med.questionnaires(id),
      employee_id BIGINT REFERENCES core.employees(id),
      actor_user_id BIGINT REFERENCES core.users(id),
      action TEXT NOT NULL CHECK (action IN ('read', 'write', 'withdraw', 'denied')),
      reason TEXT,
      ip TEXT,
      occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX med_access_log_emp_idx ON med.access_log (employee_id, occurred_at DESC);
    CREATE OR REPLACE FUNCTION med.access_log_immutable() RETURNS trigger AS $$
    BEGIN RAISE EXCEPTION 'med.access_log is append-only'; END;
    $$ LANGUAGE plpgsql;
    CREATE TRIGGER access_log_immutable BEFORE UPDATE OR DELETE ON med.access_log
      FOR EACH ROW EXECUTE FUNCTION med.access_log_immutable();

    INSERT INTO prv.processing_register (data_class, purpose, lawful_basis, retention_days, recipients)
    VALUES ('health', 'Occupational health, emergency care and workplace safety (joining medical questionnaire)', 'consent', 2920, 'HR-medical / occupational health centre only')
    ON CONFLICT (data_class) DO NOTHING;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DELETE FROM prv.processing_register WHERE data_class = 'health' AND NOT EXISTS (SELECT 1 FROM prv.retention_rules r WHERE r.data_class = 'health');
    DROP TABLE IF EXISTS med.access_log;
    DROP FUNCTION IF EXISTS med.access_log_immutable();
    DROP TABLE IF EXISTS med.questionnaires;
    DROP SCHEMA IF EXISTS med;
    DROP TABLE IF EXISTS prv.declarations;
    DROP FUNCTION IF EXISTS prv.declarations_guard();
    DROP TABLE IF EXISTS prv.declaration_texts;
    DELETE FROM doc.types WHERE code IN ('photo','bank_proof','education','certification','experience','payslip','passport','driving_licence','disability','marriage','signature','address_proof')
      AND NOT EXISTS (SELECT 1 FROM core.documents d WHERE d.doc_type = doc.types.code);
    ALTER TABLE doc.types DROP COLUMN IF EXISTS joining_checklist, DROP COLUMN IF EXISTS max_files;
    ALTER TABLE core.documents DROP CONSTRAINT IF EXISTS documents_rejection_reason,
      DROP COLUMN IF EXISTS candidate_id, DROP COLUMN IF EXISTS doc_type, DROP COLUMN IF EXISTS verification_status,
      DROP COLUMN IF EXISTS verified_by, DROP COLUMN IF EXISTS verified_at, DROP COLUMN IF EXISTS rejection_reason,
      DROP COLUMN IF EXISTS sha256, DROP COLUMN IF EXISTS document_number;
  `);
}
