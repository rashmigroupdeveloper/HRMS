# HRMS review — 13 Oct 2026

Start with REVIEW.md and verification.json. Findings R01–R38 are current source-backed defects/acceptance obligations with requirement IDs and required repair. The previous C-series audit stays historical until specifically revalidated.

This bundle contains review evidence and file fingerprints, not a runnable source checkout or proof of production acceptance. Give the next AI access to the current HRMS repository, read AGENTS.md and governing docs, compare source-inventory hashes and work one existing stage at a time. Do not apply review schema drafts blindly or recreate all proposed model names; preserve canonical ownership and resolve signed policy/contract decisions.

Native local PostgreSQL14.24 differs from target16; a disposable PostgreSQL17.11 fresh-chain run independently reproduced missing claims.budget_id. Both disposable databases were removed and the temporary17 server stopped. Existing hrms was not migrated by this review; the expressly configured local test suite performed fixture setup/cleanup. No application source was edited.

No environment files, application credentials or employee record exports are included. The physical catalog is metadata only. Exact target16/Node24, browser UAT, external integration/payment receipts and statutory sign-off remain unproven. Artifact-validation.json checks file/locator integrity, not correctness acceptance.
