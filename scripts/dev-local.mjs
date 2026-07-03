/**
 * Run the local API (wrangler :8787) and Vite frontend (:5173) together.
 * Sets VITE_API_BASE_URL for the frontend only — production default is unchanged.
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const backendDir = path.join(root, 'backend')
const children = []

function requireBin(baseDir, pkg, binFile) {
  const binPath = path.join(baseDir, 'node_modules', pkg, 'bin', binFile)
  if (!existsSync(binPath)) {
    console.error(`[dev:local] Missing ${binPath}`)
    console.error(`[dev:local] Run npm install in ${baseDir}`)
    process.exit(1)
  }
  return binPath
}

function run(label, args, options = {}) {
  const child = spawn(process.execPath, args, {
    stdio: 'inherit',
    windowsHide: true,
    ...options,
  })
  child.on('exit', (code, signal) => {
    if (signal) return
    if (code !== 0) shutdown(code ?? 1)
  })
  children.push(child)
  console.log(`[dev:local] started ${label}`)
  return child
}

function shutdown(code = 0) {
  for (const child of children) {
    if (!child.killed) child.kill()
  }
  process.exit(code)
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

const wranglerBin = requireBin(backendDir, 'wrangler', 'wrangler.js')
const viteBin = requireBin(root, 'vite', 'vite.js')

run('api', [wranglerBin, 'dev', '--config', 'wrangler.jsonc', '--port', '8787', '--ip', '127.0.0.1'], { cwd: backendDir })
run('web', [viteBin], {
  cwd: root,
  env: { ...process.env, VITE_API_BASE_URL: 'http://localhost:8787' },
})
