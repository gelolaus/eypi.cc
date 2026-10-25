import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { parseEnvFile, checkDevVars, REQUIRED_KEYS, OPTIONAL_KEYS } from './lib/envFile.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const backendDir = path.join(root, 'backend')
const devVarsPath = path.join(backendDir, '.dev.vars')
const examplePath = path.join(backendDir, '.dev.vars.example')

let failed = false

function fail(message) {
  console.error(message)
  failed = true
}

const nodeMajor = Number(process.versions.node.split('.')[0])
console.log(`Node ${process.versions.node}`)
if (nodeMajor < 20) {
  fail('Node 20+ is required')
}

for (const dir of [root, backendDir]) {
  const modules = path.join(dir, 'node_modules')
  if (existsSync(modules)) {
    console.log(`node_modules: present (${path.relative(root, dir) || '.'})`)
  } else {
    fail(`node_modules missing in ${path.relative(root, dir) || '.'} — run npm run setup`)
  }
}

if (!existsSync(devVarsPath)) {
  fail('backend/.dev.vars missing — run npm run setup')
} else {
  const values = parseEnvFile(readFileSync(devVarsPath, 'utf8'))
  const example = existsSync(examplePath) ? parseEnvFile(readFileSync(examplePath, 'utf8')) : {}
  const { requiredUnset, optionalUnset } = checkDevVars(values, example)
  const unsetRequired = new Set(requiredUnset)
  const unsetOptional = new Set(optionalUnset.map((item) => item.key))

  for (const key of REQUIRED_KEYS) {
    if (unsetRequired.has(key)) {
      fail(`${key}: UNSET`)
    } else {
      console.log(`${key}: set`)
    }
  }

  for (const { key, feature } of OPTIONAL_KEYS) {
    if (unsetOptional.has(key)) {
      console.log(`${feature}: disabled (missing ${key})`)
    }
  }
}

process.exit(failed ? 1 : 0)
