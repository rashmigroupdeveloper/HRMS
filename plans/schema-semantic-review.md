# Phase 0, Stage 0.2 — complete database semantic review

Scope: sponsor requested full review of all1,813 application fields,19 October2026. No business schema/application changes or destructive cleanup are authorized by a field's lack of references alone. Claims/travel fields are reviewed structurally despite deferred implementation; MFA remains excluded.

- [x] Read governing specifications and capture read-only logical catalog; distinguish physical partitions, application schema and migration bookkeeping.
- [x] Establish syntax-level operation evidence separately from manual meaning/ownership decisions; reference counts are never an acceptance test.
- [ ] Review every application table and column: purpose/source, canonical authority vs snapshot/cache, writers/readers, relationships, invariants, scope/masking, lifecycle, duplicate/conflicting representations and requirement disposition.
- [ ] Publish per-field decisions and table dossiers, prioritized findings with code/DDL references, exact remediation/retest instructions and reviewed coverage validation.
- [ ] Validate every live field appears exactly once, all references exist, no unresolved field is labeled accepted, and input/source changes are detected.

Completion means every field has a reviewed disposition, including justified gaps, conflicts and excluded/deferred scope. It does not mean every feature is implemented, every invariant is enforced, or deployment/UAT is accepted. Review runtime operations/constraints; do not infer passing behavior from a typed declaration or a green historic test suite. No live employee values or credential contents are needed.
