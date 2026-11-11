/** CLM-04: reimbursement payment artifacts and authorization are independent of salary. */
import type { MigrationBuilder } from 'node-pg-migrate';
export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';
 INSERT INTO core.permissions(code) VALUES ('claims.payout.view'),('claims.payout.manage'),('claims.payout.confirm') ON CONFLICT(code) DO NOTHING;
 INSERT INTO core.role_permissions(role_id,permission_id,scope)
 SELECT r.id,p.id,'all' FROM core.roles r CROSS JOIN core.permissions p
 WHERE r.code='super_admin' AND p.code IN ('claims.payout.view','claims.payout.manage','claims.payout.confirm') ON CONFLICT(role_id,permission_id) DO NOTHING;
 CREATE TABLE pay.reimbursement_batches (
 id BIGSERIAL PRIMARY KEY, company_id BIGINT NOT NULL REFERENCES core.companies(id),
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','prepared','paid','cancelled')),
 total_amount NUMERIC(14,2) NOT NULL CHECK(total_amount>0),
 created_by BIGINT NOT NULL REFERENCES core.users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 bank_document_id BIGINT REFERENCES core.documents(id),
 paid_by BIGINT REFERENCES core.users(id), paid_at TIMESTAMPTZ, payment_reference TEXT,
 CHECK(status NOT IN ('prepared','paid') OR bank_document_id IS NOT NULL),
 CHECK(status<>'paid' OR (paid_by IS NOT NULL AND paid_at IS NOT NULL AND payment_reference IS NOT NULL AND length(trim(payment_reference))>=3))
 );
 ALTER TABLE pay.claims ADD COLUMN reimbursement_batch_id BIGINT REFERENCES pay.reimbursement_batches(id);
 ALTER TABLE pay.claims ADD CONSTRAINT claims_independent_payment_target CHECK(num_nonnulls(paid_in_run_id,paid_in_batch_id,reimbursement_batch_id)<=1);
 CREATE TABLE pay.reimbursement_batch_items (
 id BIGSERIAL PRIMARY KEY,batch_id BIGINT NOT NULL REFERENCES pay.reimbursement_batches(id),
 claim_id BIGINT NOT NULL REFERENCES pay.claims(id),employee_id BIGINT NOT NULL REFERENCES core.employees(id),
 amount NUMERIC(14,2) NOT NULL CHECK(amount>0),UNIQUE(batch_id,claim_id)
 );
 CREATE INDEX reimbursement_batch_claim ON pay.reimbursement_batch_items(claim_id);
 CREATE FUNCTION pay.guard_reimbursement_items() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN
 PERFORM id FROM pay.reimbursement_batches WHERE id IN (NEW.batch_id,OLD.batch_id) ORDER BY id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM pay.reimbursement_batches WHERE id IN (NEW.batch_id,OLD.batch_id) AND status<>'draft') THEN RAISE EXCEPTION 'Prepared reimbursement items are immutable'; END IF;
 RETURN COALESCE(NEW,OLD); END $$;
 CREATE TRIGGER reimbursement_items_guard BEFORE INSERT OR UPDATE OR DELETE ON pay.reimbursement_batch_items FOR EACH ROW EXECUTE FUNCTION pay.guard_reimbursement_items();
 CREATE FUNCTION pay.guard_reimbursement_batch() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Reimbursement batches cannot be deleted'; END IF;
 IF OLD.status IN ('paid','cancelled') THEN RAISE EXCEPTION 'Closed reimbursement batch is immutable'; END IF;
 IF NEW.company_id<>OLD.company_id OR NEW.total_amount<>OLD.total_amount OR NEW.created_by<>OLD.created_by OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN RAISE EXCEPTION 'Reimbursement batch snapshots cannot change'; END IF;
 IF OLD.status='prepared' AND NEW.bank_document_id IS DISTINCT FROM OLD.bank_document_id THEN RAISE EXCEPTION 'Prepared reimbursement artifact is immutable'; END IF;
 IF NEW.status='paid' AND (NEW.payment_reference IS NULL OR length(trim(NEW.payment_reference))<3) THEN RAISE EXCEPTION 'Reimbursement transfer reference is required'; END IF;
 IF NOT ((OLD.status='draft' AND NEW.status IN ('prepared','cancelled')) OR (OLD.status='prepared' AND NEW.status='paid')) THEN RAISE EXCEPTION 'Invalid reimbursement batch transition'; END IF;
 RETURN NEW; END $$;
 CREATE TRIGGER reimbursement_batch_guard BEFORE UPDATE OR DELETE ON pay.reimbursement_batches FOR EACH ROW EXECUTE FUNCTION pay.guard_reimbursement_batch();`);
}
export function down(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);
}
