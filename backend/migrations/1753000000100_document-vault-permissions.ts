/** DOC-01/02/03: recover vault permissions; existing employee scope still applies. */
import type { MigrationBuilder } from 'node-pg-migrate';
export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';
    INSERT INTO core.permissions(code) VALUES ('doc.vault.own'),('doc.vault.manage') ON CONFLICT(code) DO NOTHING;
    INSERT INTO core.role_permissions(role_id,permission_id,scope)
      SELECT r.id,p.id,'own' FROM core.roles r CROSS JOIN core.permissions p
      WHERE p.code='doc.vault.own' AND r.code IN ('employee','manager','senior_manager','hr_ops','hr_head','payroll_admin','plant_head','ceo_cell','it_admin','hod')
      ON CONFLICT(role_id,permission_id) DO NOTHING;
    INSERT INTO core.role_permissions(role_id,permission_id,scope)
      SELECT r.id,p.id,CASE WHEN r.code='hr_ops' THEN 'org_unit' ELSE 'all' END
      FROM core.roles r CROSS JOIN core.permissions p
      WHERE (p.code='doc.vault.manage' AND r.code IN ('hr_ops','hr_head','super_admin')) OR (p.code='doc.vault.own' AND r.code='super_admin')
      ON CONFLICT(role_id,permission_id) DO NOTHING;
  `);
}
export function down(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';
    DELETE FROM core.role_permissions WHERE permission_id IN (SELECT id FROM core.permissions WHERE code IN ('doc.vault.own','doc.vault.manage'));
    DELETE FROM core.permissions WHERE code IN ('doc.vault.own','doc.vault.manage');
  `);
}
