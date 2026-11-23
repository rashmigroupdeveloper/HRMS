// Checks that no repository reads people's records in bulk without data access (CLAUDE.md section 8, 2026-11-18).
//
//   npm run check:data-access
//
// People's records = the employees and candidates tables, and every table with an employeeId or candidateId column
// (found in the Prisma schema, so a new table is covered without changing this file). A bulk read of one of them
// (findMany / findFirst / count / groupBy / aggregate) in a *.repository.ts function is accepted only when:
//   - the function takes a DataScope (the service passed scopeOf(...) - the read is limited to the caller's data access),
//     directly or through a type of the same file that requires one (e.g. `DirectoryFilter = { scope: DataScope; ... }`);
//   - for a table that hangs on an employee / candidate: it reads the rows of a given employee / candidate
//     (employeeId / candidateId in the function - the service checked that person first); or
//   - a comment right above the function says why it is not limited: `// data access: <reason>` - e.g. a duplicate
//     check that must see every company, names of who did something, rows the service filters, a background job.
// Fails (exit code 1) listing every other read, with its file and line.
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const backend = fileURLToPath(new URL('..', import.meta.url))
const schemaDir = join(backend, 'prisma', 'schema')
const modulesDir = join(backend, 'src', 'modules')

// --- the people tables, from the schema ---
const PERSON_TABLES = new Set(['employee', 'candidate'])
const ownedTables = new Set<string>()
for (const file of readdirSync(schemaDir).filter((f) => f.endsWith('.prisma'))) {
  const schema = readFileSync(join(schemaDir, file), 'utf8')
  for (const [, name, body] of schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)) {
    if (!name || !body) continue
    const delegate = name[0]!.toLowerCase() + name.slice(1)
    if (!PERSON_TABLES.has(delegate) && /^\s+(employeeId|candidateId)\s/m.test(body)) ownedTables.add(delegate)
  }
}
const watched = new Set([...PERSON_TABLES, ...ownedTables])

// --- every repository file ---
function repositories(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return repositories(path)
    return entry.name.endsWith('.repository.ts') ? [path] : []
  })
}

const READ = /\b(?:db|tx|prisma)\.(\w+)\.(findMany|findFirst|count|groupBy|aggregate)\(/g
const FUNCTION_START = /^(?:export )?(?:async )?function (\w+)/
const problems: string[] = []
let checked = 0

for (const path of repositories(modulesDir)) {
  const source = readFileSync(path, 'utf8')
  const lines = source.split('\n')
  // the types of this file that require a DataScope - a function taking one of them is limited too
  const scopedTypes = [...source.matchAll(/^(?:export )?type (\w+) = \{([\s\S]*?)^\}/gm)]
    .filter(([, , body]) => /\bDataScope\b/.test(body ?? ''))
    .map(([, name]) => name ?? '')
  const starts = lines.flatMap((line, i) => (FUNCTION_START.test(line) ? [i] : []))
  starts.forEach((start, n) => {
    const end = starts[n + 1] ?? lines.length
    const text = lines.slice(start, end).join('\n')
    const reads = [...text.matchAll(READ)].filter(([, table]) => table && watched.has(table))
    if (!reads.length) return
    checked++
    // the comment right above the function
    const comment: string[] = []
    for (let i = start - 1; i >= 0 && lines[i]!.trim().startsWith('//'); i--) comment.push(lines[i]!)
    const reason = comment.some((line) => /data access:/i.test(line))
    const scoped = /\bDataScope\b|scopeWhere\(/.test(text) || scopedTypes.some((type) => new RegExp(`\\b${type}\\b`).test(text))
    const name = lines[start]!.match(FUNCTION_START)?.[1] ?? '?'
    for (const table of new Set(reads.map(([, t]) => t))) {
      if (scoped || reason) continue
      if (table && ownedTables.has(table) && /\b(employeeId|candidateId)\b/.test(text)) continue
      problems.push(`${relative(backend, path).replaceAll('\\', '/')}:${start + 1} ${name}() reads ${table} without data access`)
    }
  })
}

if (problems.length) {
  console.error(
    `Data access check failed - these repository functions read people's records in bulk without a DataScope:\n${problems.map((p) => `  - ${p}`).join('\n')}\n` +
      `Fix: take a \`scope: DataScope\` (the service passes scopeOf(user, area, level)) and apply \`AND: [scopeWhere(scope)]\`;\n` +
      `or, when it truly must not be limited, write why right above the function: // data access: <reason> (CLAUDE.md section 8).`,
  )
  process.exit(1)
}
console.log(`Data access OK - ${checked} repository functions read people's records, each limited or with a written reason (${watched.size} tables watched).`)
process.exit(0)
