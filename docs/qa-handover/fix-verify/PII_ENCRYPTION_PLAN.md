# PII encryption plan (handover item 8, MNC hardening)

Status: **plan, not yet implemented** — a key-management decision is needed from the client (see CD-PII below).

## Data in scope
| Table.column | Class | Today | Target |
|---|---|---|---|
| core.employee_statutory.aadhaar | Sensitive (Aadhaar Act s.29, UIDAI vault rules) | plaintext | AES-256-GCM envelope-encrypted + HMAC blind index; UI shows `XXXX-XXXX-1234` only |
| core.employee_family.aadhaar | Sensitive | plaintext | as above |
| core.employee_statutory.pan | Personal/financial | plaintext | encrypted + blind index (duplicate check, TDS lookups) |
| core.employee_statutory.bank_account | Financial | plaintext | encrypted + blind index; masked except in bank-file generation |
| core.employee_statutory.uan / esic_ip_number | Personal | plaintext | blind index for duplicate checks; encryption optional (shared with EPFO/ESIC filings) |
| dob (employees, family, candidates) | Personal | plaintext | stays plaintext (needed for age/minor/probation SQL); access via RBAC + audit |
| core.companies.pan / tan / esic_code / pf_code | Business IDs | plaintext | stays plaintext (not personal data) |

## Design
1. **Envelope encryption in app code** (`backend/src/core/crypto`, new): per-record random DEK, AES-256-GCM via `node:crypto`; DEK wrapped by a KEK held outside the DB (env `PII_KEK` now; KMS/HSM/Vault later behind a `KeyProvider` interface). Ciphertext stored as `bytea` columns `<col>_enc` with `key_version`.
2. **Blind index**: `<col>_bidx = HMAC-SHA256(PII_INDEX_KEY, normalized value)` with a UNIQUE partial index — keeps duplicate UAN/ESIC/PAN/Aadhaar validation and lookups working without decrypting.
3. **Masking by default**: API output schemas return masked values; a separate `employee.pii.read` permission (hr_ops own company, hr_head/payroll_admin) returns cleartext, and every cleartext read is written to the audit chain.
4. **Migration** (expand → backfill → contract): add `_enc/_bidx` columns; a batch script encrypts existing rows in 500-row transactions; dual-read for one release; then drop plaintext columns and `VACUUM FULL` the table; backups older than the cut-over are rotated out per retention.
5. **Exports**: bank file, Form 24Q/16, ECR and ESIC returns decrypt in-process only for the generating job; files go to object storage with server-side encryption and short-lived download links.
6. **Key rotation**: `key_version` per row; a rotation job re-wraps DEKs (no data re-encryption); KEK rotation yearly or on incident.
7. **Logging**: pino redaction paths for `pan`, `aadhaar`, `bankAccount`, `uan` (already no PII in error bodies; request ids correlate).
8. **Tests**: round-trip, tamper (GCM auth failure → 500 without leaking), blind-index uniqueness, masked output per role.

## CD-PII (client decision)
Where does the KEK live in production (WHM server env file vs. a cloud KMS vs. HashiCorp Vault), and who holds the recovery copy? Until decided, implementation would use an env-held KEK which is weaker than KMS.
