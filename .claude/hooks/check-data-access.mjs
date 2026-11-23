// Claude Code hook (wired in .claude/settings.json): keeps the data-access rule (CLAUDE.md section 8) from being missed.
//
//   node .claude/hooks/check-data-access.mjs post-edit   - after Claude edits / writes a file: runs the check when the
//                                                          file is a backend repository (*.repository.ts) or a Prisma
//                                                          schema file (it decides which tables hold people's records)
//   node .claude/hooks/check-data-access.mjs stop        - when Claude finishes a turn: runs the check when a repository
//                                                          or schema file has changes (also edits made through a shell
//                                                          command)
//
// The check is `npm run check:data-access` (backend/scripts/check-data-access.ts). When it fails, its report goes back
// to Claude (exit code 2) to fix; a turn that was already sent back once only warns, so it can never loop.
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

const mode = process.argv[2]
let raw = ''
for await (const chunk of process.stdin) raw += chunk
const input = raw.trim() ? JSON.parse(raw) : {}
const root = process.env.CLAUDE_PROJECT_DIR || process.cwd()
const REPOSITORY = /[\\/]backend[\\/]src[\\/]modules[\\/].+\.repository\.ts$/
// the schema decides which tables hold people's records (scripts/check-data-access.ts)
const SCHEMA = /[\\/]backend[\\/]prisma[\\/]schema[\\/][^\\/]+\.prisma$/

if (mode === 'post-edit') {
  const file = input.tool_input?.file_path ?? input.tool_response?.filePath ?? ''
  if (!REPOSITORY.test(file) && !SCHEMA.test(file)) process.exit(0)
} else if (mode === 'stop') {
  // (every untracked file listed - a new folder would otherwise show only as the folder)
  const status = spawnSync('git', ['status', '--porcelain', '--untracked-files=all', '--', 'backend/src/modules', 'backend/prisma/schema'], {
    cwd: root,
    encoding: 'utf8',
  })
  const changed = (status.stdout ?? '').split('\n').some((line) => /\.(repository\.ts|prisma)$/.test(line.trim()))
  if (!changed) process.exit(0)
} else {
  console.error(`check-data-access hook: unknown mode "${mode}" (post-edit | stop)`)
  process.exit(1)
}

const check = spawnSync(process.execPath, ['--conditions=development', '--import', 'tsx', 'scripts/check-data-access.ts'], {
  cwd: join(root, 'backend'),
  encoding: 'utf8',
})
if (check.status === 0) process.exit(0)

const report = `${check.stdout ?? ''}${check.stderr ?? ''}`.trim()
if (mode === 'stop' && input.stop_hook_active) {
  // already sent back once this turn - tell the person instead of looping
  console.log(JSON.stringify({ systemMessage: `Data access check still fails (CLAUDE.md section 8):\n${report}` }))
  process.exit(0)
}
console.error(`${report}\n\nFix this before going on - every bulk read of people's records needs a DataScope or a written "// data access:" reason (CLAUDE.md section 8).`)
process.exit(2)
