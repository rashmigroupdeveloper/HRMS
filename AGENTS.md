# HRMS - rules for AI agents (Codex and others)

## 1. The project rules are in CLAUDE.md - read it first, follow all of it

**Before any change, read [`CLAUDE.md`](CLAUDE.md) in full.** Despite its name it is not only for Claude: it is the
one rulebook for this repository, for every person and every AI agent. Everything in it applies to you exactly as
written - folder structure (section 1), how we work (2), database (3), backend (4), frontend (5), the checks before
finishing (6), the API tracker (7) and the data-access checklist (8).

- Do not copy its rules into this file. There is one rulebook, so it cannot drift. When a rule changes, it changes in
  `CLAUDE.md` only.
- If this file and `CLAUDE.md` ever disagree, `CLAUDE.md` wins.
- When `CLAUDE.md` says "the user", it means the person you are working with.
- When you add a file to the project root (as this one was), list it in the "Project root" tree of `CLAUDE.md`.

## 2. What Claude Code does automatically, and you must do by hand

Claude Code runs hooks from `.claude/settings.json`. Codex does not, so do their work yourself:

- **Data-access check.** After you edit any `backend/src/modules/**/*.repository.ts` or `backend/prisma/schema/*.prisma`,
  and again before you finish a turn that changed any of them, run `npm run check:data-access`. If it fails, fix
  the cause before going on. Every bulk read of people's records needs a `DataScope`, or a
  `// data access: <reason>` comment right above the repository function (CLAUDE.md section 8).
- **UI review.** `.claude/agents/ui-critic.md` is the brief of a reviewer that only looks at screenshots and reports
  problems. Before and after UI work, take desktop (1440 px) and phone (390 px) screenshots, then review them against
  that file's checklist ("Warm Editorial" style, compact first). The critic only reports: do not change code while
  reviewing.

The full "before finishing" list is still CLAUDE.md section 6. Every command in it must pass.

## 3. Keep the docs true - in the same change

The rule is in CLAUDE.md section 6 ("The docs stay true"). No check catches a doc that is wrong, so do this by hand
before you finish:

- **Search the docs for what you changed** - the rule, the function, the behaviour, the old wording - e.g.
  `grep -n -i "several roles" CLAUDE.md README.md BACKLOG.md API_TRACKER.md` - and fix every hit that describes the old
  way. Where to look:
  - `CLAUDE.md` - a rule or how something works (access, data access, approvals, layers, files, UI rules).
  - `README.md` - setup, commands (`package.json` scripts), the structure tree, the short "Access" / layer notes.
  - `BACKLOG.md` - an item your change finishes (delete it), changes (rewrite it, dated) or leaves half-done (add what is
    left: why it waits and what it needs).
  - `API_TRACKER.md` - every API change (`npm run check:api-tracker` checks only that entries exist).
  - The comment at the top of a touched `prisma/schema/*.prisma` file, and comments in the touched code.
- Test-run notes in `docs/test-runs/` are a record of what you did, not the rules - they never replace these updates.
- **List the docs you updated in your final report**, or say "no docs affected" and why.

Example of what went wrong once: on 2026-11-23 access changed from "all of a person's roles combined" to "one active role
at a time". `API_TRACKER.md` was updated, but `CLAUDE.md` section 4, `README.md` and `BACKLOG.md` item 3a still described
combined roles until they were fixed by hand afterwards.

## 4. How to work with the team

These are the working preferences Claude follows on this project. Follow them too.

- **One stage at a time, announced first.** Before starting build work, say what you are doing, e.g. "Working on:
  Leave - balance ledger". Do one stage or one coherent slice per turn, finish it, report what was done and checked,
  and wait for "continue". Do not roll into the next stage on your own.
- **Fix the root cause, not the symptom.** The system is still in development, so structural fixes are cheap now.
  Name the underlying cause and fix it, with the rule that stops it coming back. Do not add workarounds,
  compatibility shims, duplicate stores, or "just in case" code that only keeps old behaviour alive. Keep the system
  simple and easy to understand.
- **Be decisive when the direction is concrete.** When the user points at a reference (a screenshot, an existing page,
  a route, an HR form) and says "do it", build it end to end with the sensible, conventional choice. Mention the
  alternatives in your summary instead of stopping to ask about scope. Do ask when the choice is a real business
  decision, a matter of taste, or something CLAUDE.md says needs approval: a new schema model or field, a new library,
  or a change to the folder structure.
- **Report honestly.** Say which checks you ran and their results. If something failed or was skipped, say so.
