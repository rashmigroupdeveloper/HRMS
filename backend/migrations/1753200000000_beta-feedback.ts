/** BETA-01: explicit beta reports, private review and configured email audience. */
import type { MigrationBuilder } from 'node-pg-migrate';
export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';
    CREATE TABLE hd.beta_feedback (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      request_id UUID NOT NULL UNIQUE,
      user_id BIGINT NOT NULL REFERENCES core.users(id),
      employee_code TEXT,
      user_name TEXT NOT NULL,
      role_codes JSONB NOT NULL CHECK (jsonb_typeof(role_codes) = 'array'),
      page_path TEXT NOT NULL CHECK (page_path LIKE '/%' AND page_path NOT LIKE '//%' AND position('?' in page_path)=0 AND position('#' in page_path)=0),
      page_title TEXT NOT NULL,
      body TEXT NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 5000),
      screenshot_document_id BIGINT REFERENCES core.documents(id),
      status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','resolved')),
      reviewed_by BIGINT REFERENCES core.users(id),
      reviewed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX beta_feedback_status_created_idx ON hd.beta_feedback(status,created_at DESC,id DESC);
    INSERT INTO core.permissions(code) VALUES ('beta.feedback.submit'),('beta.feedback.review') ON CONFLICT DO NOTHING;
    INSERT INTO core.role_permissions(role_id,permission_id,scope)
      SELECT r.id,p.id,'all' FROM core.roles r CROSS JOIN core.permissions p
      WHERE (p.code='beta.feedback.submit') OR (p.code='beta.feedback.review' AND r.code IN ('it_admin','super_admin'))
      ON CONFLICT(role_id,permission_id) DO NOTHING;
    INSERT INTO core.settings(key,value,value_type,description)
      VALUES ('beta.feedback.max_screenshot_bytes','3000000','number','BETA-01: maximum screenshot upload size in bytes') ON CONFLICT(key) DO NOTHING;
    INSERT INTO wf.event_subscriptions(event_code,recipient_kind,recipient_ref)
      SELECT 'beta.feedback.submitted','email','core_developers@rashmigroup.com'
      WHERE NOT EXISTS (SELECT 1 FROM wf.event_subscriptions WHERE event_code='beta.feedback.submitted' AND recipient_kind='email' AND recipient_ref='core_developers@rashmigroup.com');
  `);
}
export function down(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s'; DROP TABLE hd.beta_feedback;`);
}
