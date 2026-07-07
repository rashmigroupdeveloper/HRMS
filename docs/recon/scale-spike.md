# Scale spike results (P0-T41) — 7 Jul 2026

**Setup:** local dev machine (Windows, native PostgreSQL 16), the REAL ingestion pipeline (`ingestOnce`: watermark − 30 min overlap → fetch → ensure monthly partition → chunked idempotent upsert → device last_seen → watermark advance, all in one transaction). Synthetic swipes from `MockKentConnector` (deterministic, realistic: IN/OUT ± jitter, lunch pairs, cross-plant punches, received-at lag).

Command: `npx tsx scripts/scale-spike.ts 3000 14`

## Results

| Metric | Result | Target (docs/13 §0.2) |
|---|---|---|
| Ingest 3,000 employees × 14 days (96,642 swipes) | **2.2 s → 43,529 rows/s** | 3k day (~7k swipes) ≈ **0.16 s** vs 5-min cycle budget — ~1,900× headroom |
| 10k-ceiling extrapolation (~120k swipes/day) | ~3 s/day | well inside the 5-min lag target, no redesign needed |
| Full-duplicate replay of a day (watermark reset) | **0 rows inserted**, 0.11 s | idempotency holds at volume — reconnect floods are safe |
| Muster-shaped FILO aggregate (96,642 swipes → 42,000 employee-days) | **0.15 s** | raw aggregate is far under the 10 s muster budget; precomputed MV still planned for month×status matrix |

## Conclusions (freeze per plan Stage 0.6)

1. **Monthly partitioning confirmed** as the day-one strategy — write path unaffected (43k rows/s through the ORM path with the unique key active), partition creation automated (`att.ensure_swipe_partition`).
2. **Single local Postgres comfortably absorbs 3k AND the 10k ceiling** for ingestion + FILO workloads — consistent with D6 ("single strong box now, replica-ready").
3. **Idempotency key `(employee_no, swipe_ts, door_code)`** dedupes full replays in ~0.1 s — device reconnect floods (doc 14 §8.3) are structurally handled.
4. Numbers are from a dev laptop; re-run on the production box before G0 sign-off (same script).
