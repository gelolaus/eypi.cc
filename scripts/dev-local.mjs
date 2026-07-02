/**
 * Run the local API (wrangler :8787) and Vite frontend (:5173) together.
 * Sets VITE_API_BASE_URL for the frontend only — production default is unchanged.
 */
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const children = []

function run(label, command, args, options = {}) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: true,
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

run('api', 'npm', ['run', 'dev'], { cwd: path.join(root, 'backend') })
run('web', 'npm', ['run', 'dev'], {
  cwd: root,
  env: { ...process.env, VITE_API_BASE_URL: 'http://localhost:8787' },
})
