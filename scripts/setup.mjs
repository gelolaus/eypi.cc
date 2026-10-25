import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { seedDevVars } from './lib/envFile.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const backendDir = path.join(root, 'backend')
const examplePath = path.join(backendDir, '.dev.vars.example')
const devVarsPath = path.join(backendDir, '.dev.vars')

const nodeMajor = Number(process.versions.node.split('.')[0])
if (nodeMajor < 20) {
  console.error(`Node 20+ is required (found ${process.versions.node})`)
  process.exit(1)
}

function runNpmCi(cwd) {
  const result = spawnSync('npm', ['ci'], {
    cwd,
    shell: true,
    stdio: 'inherit',
  })
  if (result.status !== 0) {
    console.error(`npm ci failed in ${cwd}`)
    process.exit(result.status ?? 1)
  }
}

runNpmCi(root)
runNpmCi(backendDir)

if (!existsSync(devVarsPath)) {
  if (!existsSync(examplePath)) {
    console.error('backend/.dev.vars.example is missing')
    process.exit(1)
  }
  const seeded = seedDevVars(
    readFileSync(examplePath, 'utf8'),
    null,
    randomBytes(32).toString('base64url'),
    randomBytes(32).toString('base64url'),
  )
  writeFileSync(devVarsPath, seeded.text, 'utf8')
  console.log('Created backend/.dev.vars from the example (JWT_SECRET and PASS_TOKEN_SECRET filled). Fill the remaining keys.')
} else {
  console.log('backend/.dev.vars already exists — left unchanged.')
}

const doctor = spawnSync(process.execPath, [path.join(root, 'scripts', 'doctor.mjs')], {
  cwd: root,
  stdio: 'inherit',
})
process.exit(doctor.status ?? 1)
