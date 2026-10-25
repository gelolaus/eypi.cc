import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Runs `npm audit --omit=dev` and fails on high or critical advisories.
// xlsx and node-forge stay until WS5 Tasks 5.5 and 5.6. Any other high fails.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const prefix = process.argv[2]
const cwd = prefix ? path.resolve(root, prefix) : root
const allowedPackages = new Set(['xlsx', 'node-forge'])
const blockingSeverities = new Set(['high', 'critical'])

const result = spawnSync('npm', ['audit', '--omit=dev', '--json'], {
  cwd,
  encoding: 'utf8',
  shell: true,
})

let report
try {
  report = JSON.parse(result.stdout || '{}')
} catch {
  console.error(result.stdout)
  console.error(result.stderr)
  process.exit(result.status === 0 ? 1 : result.status ?? 1)
}

const vulnerabilities = report.vulnerabilities ?? {}
const allowed = []
const blockers = []

for (const [name, vuln] of Object.entries(vulnerabilities)) {
  if (!blockingSeverities.has(vuln.severity)) continue
  if (allowedPackages.has(name)) {
    allowed.push(`${name} (${vuln.severity})`)
    continue
  }
  blockers.push(`${name} (${vuln.severity})`)
}

const where = prefix ? prefix : 'root'
if (allowed.length > 0) {
  console.log(`[audit ${where}] allowed until WS5: ${allowed.join(', ')}`)
}
if (blockers.length > 0) {
  console.error(`[audit ${where}] high or critical advisories outside xlsx and node-forge:`)
  for (const blocker of blockers) console.error(`- ${blocker}`)
  process.exit(1)
}

console.log(`[audit ${where}] no other high or critical production advisories`)
process.exit(0)
