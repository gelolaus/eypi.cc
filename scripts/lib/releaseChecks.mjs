export function isCiEnvironment(env) {
  return env.WORKERS_CI === '1' || (env.CI !== undefined && env.CI !== '' && env.CI !== 'false')
}

export function checkGitState({ branch, porcelain, allowDirty, allowBranch, isCi = false }) {
  const problems = []
  // A CI checkout is a detached HEAD at a fixed commit, so the branch and
  // working-tree checks only make sense on a developer machine.
  if (isCi) return problems
  if (branch !== 'main' && !allowBranch) {
    problems.push(`branch is '${branch}', expected main (pass --allow-branch to override)`)
  }
  if (porcelain.trim() !== '' && !allowDirty) {
    problems.push('working tree is dirty (pass --allow-dirty to override)')
  }
  return problems
}

export function checkFrontendBundle(files) {
  const problems = []
  let hasProdApi = false
  for (const file of files) {
    if (file.text.includes('localhost:8787')) {
      problems.push(`${file.name} contains localhost:8787`)
    }
    if (file.text.includes('127.0.0.1:8787')) {
      problems.push(`${file.name} contains 127.0.0.1:8787`)
    }
    if (file.text.includes('https://api.eypi.cc')) {
      hasProdApi = true
    }
  }
  if (!hasProdApi) {
    problems.push('https://api.eypi.cc appears in no frontend bundle file')
  }
  return problems
}

/** The built sw.js must carry a real build hash, not the dev placeholder, or old shells never expire. */
export function checkServiceWorker(text) {
  if (text === null || text === undefined) return ['dist/client/sw.js is missing']
  if (/hash:\s*['"]dev['"]/.test(text)) {
    return ['dist/client/sw.js still has the dev build hash (the precache step did not run)']
  }
  return []
}

const KB = 1000
const ENTRY_JS_BUDGET = 70 * KB
const ENTRY_CSS_BUDGET = 22 * KB
const ROUTE_CHUNK_BUDGET = 40 * KB
const PUBLIC_ROUTE_BUDGET = 110 * KB
const HEAVY_CHUNK_EXEMPT = /useDocxGenerator|exceljs|AttendeeSelection|jszip|papaparse|qr-scanner/
// Public routes a visitor lands on cold. guest-ticket joins once its view exists.
const PUBLIC_ROUTES = [/views\/dp\/DpPublicView/, /views\/tix\/TicketLookupView/, /guest-?ticket/i]

const fmt = (bytes) => `${(bytes / KB).toFixed(1)} kB`

function staticClosure(manifest, startKeys) {
  const seen = new Set()
  const stack = [...startKeys]
  while (stack.length > 0) {
    const key = stack.pop()
    if (seen.has(key) || !manifest[key]) continue
    seen.add(key)
    stack.push(...(manifest[key].imports ?? []))
  }
  return seen
}

export function checkBundleBudgets(manifest, gzSize) {
  const problems = []
  const entries = Object.entries(manifest).filter(([, chunk]) => chunk.isEntry)
  const entryKeys = entries.map(([key]) => key)
  for (const [, entry] of entries) {
    const js = gzSize(entry.file)
    if (js > ENTRY_JS_BUDGET) {
      problems.push(`${entry.file} is ${fmt(js)} gzip, entry JS budget is ${fmt(ENTRY_JS_BUDGET)}`)
    }
    for (const css of entry.css ?? []) {
      const size = gzSize(css)
      if (size > ENTRY_CSS_BUDGET) {
        problems.push(`${css} is ${fmt(size)} gzip, entry CSS budget is ${fmt(ENTRY_CSS_BUDGET)}`)
      }
    }
  }

  const routes = Object.entries(manifest).filter(([, chunk]) => chunk.isDynamicEntry)
  for (const [, chunk] of routes) {
    if (HEAVY_CHUNK_EXEMPT.test(chunk.file) || HEAVY_CHUNK_EXEMPT.test(chunk.src ?? '')) continue
    const size = gzSize(chunk.file)
    if (size > ROUTE_CHUNK_BUDGET) {
      problems.push(`${chunk.file} is ${fmt(size)} gzip, route chunk budget is ${fmt(ROUTE_CHUNK_BUDGET)}`)
    }
  }

  for (const [key, chunk] of routes) {
    if (!PUBLIC_ROUTES.some((re) => re.test(chunk.src ?? key))) continue
    const keys = staticClosure(manifest, [...entryKeys, key])
    let total = 0
    for (const k of keys) total += gzSize(manifest[k].file)
    if (total > PUBLIC_ROUTE_BUDGET) {
      problems.push(`${chunk.file} public route loads ${fmt(total)} gzip with entry and static imports, budget is ${fmt(PUBLIC_ROUTE_BUDGET)}`)
    }
  }
  return problems
}
