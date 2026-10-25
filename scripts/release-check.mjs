import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkFrontendBundle, checkGitState } from './lib/releaseChecks.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const backendDir = path.join(root, 'backend')
const args = new Set(process.argv.slice(2))
const allowDirty = args.has('--allow-dirty')
const allowBranch = args.has('--allow-branch')

function run(command, commandArgs, cwd = root) {
  return spawnSync(command, commandArgs, {
    cwd,
    shell: true,
    encoding: 'utf8',
  })
}

function fail(step, label, detail) {
  console.error(`[release:check] ${step}/7 ${label} ... FAIL`)
  if (detail) console.error(detail)
  process.exit(1)
}

function ok(step, label) {
  console.log(`[release:check] ${step}/7 ${label} ... ok`)
}

const gitBranch = run('git', ['rev-parse', '--abbrev-ref', 'HEAD'])
const gitPorcelain = run('git', ['status', '--porcelain'])
if (gitBranch.status !== 0) {
  fail(1, 'git state', gitBranch.stderr || gitBranch.stdout)
}
const gitProblems = checkGitState({
  branch: (gitBranch.stdout || '').trim(),
  porcelain: gitPorcelain.stdout || '',
  allowDirty,
  allowBranch,
})
if (gitProblems.length > 0) {
  fail(1, 'git state', gitProblems.join('\n'))
}
ok(1, 'git state')

const testResult = run('npm', ['test'])
if (testResult.status !== 0) {
  fail(2, 'npm test', `${testResult.stdout}${testResult.stderr}`)
}
ok(2, 'npm test')

const typecheckResult = run('npm', ['run', 'typecheck'])
if (typecheckResult.status !== 0) {
  fail(3, 'typecheck', `${typecheckResult.stdout}${typecheckResult.stderr}`)
}
ok(3, 'typecheck')

const buildResult = run('npm', ['run', 'build'])
if (buildResult.status !== 0) {
  fail(4, 'build', `${buildResult.stdout}${buildResult.stderr}`)
}
ok(4, 'build')

const assetsDir = path.join(root, 'dist', 'client', 'assets')
if (!existsSync(assetsDir)) {
  fail(5, 'frontend bundle', `missing ${assetsDir}`)
}
const files = readdirSync(assetsDir)
  .filter((name) => name.endsWith('.js'))
  .map((name) => ({
    name,
    text: readFileSync(path.join(assetsDir, name), 'utf8'),
  }))
const bundleProblems = checkFrontendBundle(files)
if (bundleProblems.length > 0) {
  fail(5, 'frontend bundle', bundleProblems.join('\n'))
}
ok(5, 'frontend bundle')

const frontendOutdir = path.join(tmpdir(), `eypi-release-frontend-${process.pid}`)
const frontendDryRun = run('npx', [
  'wrangler',
  'deploy',
  '--dry-run',
  '--config',
  'dist/eypicc_frontend/wrangler.json',
  '--outdir',
  frontendOutdir,
])
if (frontendDryRun.status !== 0) {
  fail(6, 'frontend wrangler dry-run', `${frontendDryRun.stdout}${frontendDryRun.stderr}`)
}
ok(6, 'frontend wrangler dry-run')

const backendOutdir = path.join(tmpdir(), `eypi-release-backend-${process.pid}`)
const backendDryRun = run('npx', [
  'wrangler',
  'deploy',
  '--dry-run',
  '--config',
  'wrangler.jsonc',
  '--outdir',
  backendOutdir,
], backendDir)
if (backendDryRun.status !== 0) {
  fail(7, 'backend wrangler dry-run', `${backendDryRun.stdout}${backendDryRun.stderr}`)
}
ok(7, 'backend wrangler dry-run')
