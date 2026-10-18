# Backup / restore evidence (handover item 7)
- Scripts: `scripts/backup.sh` (pg_dump -Fc + document store tar + SHA-256 manifest + retention) and `scripts/restore.sh` (manifest check, restores only into a NEW database, optional storage restore).
- Drill on the box, 19 Oct 2026 01:29 IST: backup of `hrms_fix_recon` (post-recon June 2026 state) → restored into `hrms_fix_restore` → 44 employees; independent reconcile on the restored DB: 4 RML033625  MATCH            days 30/30.0 gross 64573/64573.0 pf 3874/3874.0 esi 0/0 pt 200/200.0 tds 0/0 oth 1375/1375.0 net 59124/59124.0   Counter({'MATCH': 44}) Counter({'MATCH': 33}) zero field mismatches.
- Second restore into the same name is refused (no accidental overwrite).
- Production: run nightly from cron with BACKUP_DIR on a different disk and copy off-site; RPO 24 h, RTO ≈ restore time (seconds at current size). Encrypt off-site copies (see PII_ENCRYPTION_PLAN.md).
