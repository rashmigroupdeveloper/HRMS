// Checks that API_TRACKER.md matches the real API.
//
//   npm run check:api-tracker
//
// Fails (exit code 1) when a procedure exists in code but has no "### `path`" entry in the tracker,
// when the tracker documents a procedure that no longer exists, when an entry has no "- **Scope:**" line (whose
// records it covers - data access, 2026-11-18), or when "Total APIs: N" is wrong.
import { readFileSync } from 'node:fs'
import { isProcedure } from '@orpc/server'
import { router } from '../src/router.js'

function procedurePaths(node: unknown, prefix: string[] = []): string[] {
  if (isProcedure(node)) return [prefix.join('.')]
  if (typeof node !== 'object' || node === null) return []
  return Object.entries(node).flatMap(([key, child]) => procedurePaths(child, [...prefix, key]))
}

const inCode = procedurePaths(router).sort()
const tracker = readFileSync(new URL('../../API_TRACKER.md', import.meta.url), 'utf8')
const documented = [...tracker.matchAll(/^### `([^`]+)`/gm)].map((m) => m[1] ?? '').sort()
const total = Number(tracker.match(/\*\*Total APIs: (\d+)\*\*/)?.[1])

const missing = inCode.filter((p) => !documented.includes(p))
const stale = documented.filter((p) => !inCode.includes(p))
const duplicated = documented.filter((p, i) => documented.indexOf(p) !== i)
// every entry says how data access limits it (core/auth/scope.ts), so no API is left without a rule
const entries = tracker.split(/^(?=### `)/m).slice(1)
const unscoped = entries.filter((entry) => !/^- \*\*Scope:\*\*/m.test(entry)).map((entry) => entry.match(/^### `([^`]+)`/)?.[1] ?? '?')
const problems = [
  ...missing.map((p) => `not documented in API_TRACKER.md: ${p}`),
  ...stale.map((p) => `documented but does not exist in code: ${p}`),
  ...duplicated.map((p) => `documented more than once: ${p}`),
  ...unscoped.map((p) => `no "- **Scope:**" line (how data access limits it): ${p}`),
  ...(total === inCode.length ? [] : [`"Total APIs" says ${total}, code has ${inCode.length}`]),
]

if (problems.length) {
  console.error(`API tracker is out of date:\n${problems.map((p) => `  - ${p}`).join('\n')}`)
  process.exit(1)
}
console.log(`API tracker OK - ${inCode.length} APIs, all documented, each with its Scope.`)
process.exit(0)
