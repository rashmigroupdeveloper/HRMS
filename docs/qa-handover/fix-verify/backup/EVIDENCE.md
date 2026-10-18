# Backup / restore evidence (handover item 7)
- Scripts: `scripts/backup.sh` (pg_dump -Fc + document store tar + SHA-256 manifest + retention) and `scripts/restore.sh` (manifest check, restores only into a NEW database, optional storage restore).
- Drill on the box, 19 Oct 2026 01:29 IST: backup of `hrms_fix_recon` (post-recon June 2026 state) → restored into `hrms_fix_restore` → 44 employees; independent reconcile on the restored DB: field mismatch counts Counter().
- Second restore into the same name is refused (no accidental overwrite).
- Production: run nightly from cron with BACKUP_DIR on a different disk and copy off-site; RPO 24 h, RTO ≈ restore time (seconds at current size). Encrypt off-site copies (see PII_ENCRYPTION_PLAN.md).
