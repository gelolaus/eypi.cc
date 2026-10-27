import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const MARKER = /\/\*build\*\/[\s\S]*?\/\*end-build\*\//

/** Entry chunks, their css and their static imports. Lazy route chunks are cached on first use. */
export function collectPrecache(manifest) {
  const seen = new Set()
  const files = []
  const add = (file) => {
    const url = `/${file}`
    if (!seen.has(url)) {
      seen.add(url)
      files.push(url)
    }
  }
  const visited = new Set()
  const walk = (key) => {
    const chunk = manifest[key]
    if (!chunk || visited.has(key)) return
    visited.add(key)
    add(chunk.file)
    for (const css of chunk.css ?? []) add(css)
    for (const dep of chunk.imports ?? []) walk(dep)
  }
  for (const [key, chunk] of Object.entries(manifest)) if (chunk.isEntry) walk(key)
  return files
}

export function injectBuild(source, precache) {
  const hash = createHash('sha256').update(JSON.stringify(precache)).digest('hex').slice(0, 10)
  const build = `/*build*/ { hash: ${JSON.stringify(hash)}, precache: ${JSON.stringify(precache)} } /*end-build*/`
  return source.replace(MARKER, () => build)
}

/** Returns 'injected', or 'skipped' for a sw.js without the marker (the kill switch). */
export function runPrecache(clientDir) {
  const manifestPath = [path.join(clientDir, '.vite', 'manifest.json'), path.join(clientDir, 'manifest.json')].find(existsSync)
  if (!manifestPath) throw new Error('sw-precache: missing vite manifest (build.manifest must be true)')
  const swPath = path.join(clientDir, 'sw.js')
  if (!existsSync(swPath)) throw new Error('sw-precache: missing sw.js in the build output')
  const source = readFileSync(swPath, 'utf8')
  if (!MARKER.test(source)) return 'skipped'
  const precache = collectPrecache(JSON.parse(readFileSync(manifestPath, 'utf8')))
  writeFileSync(swPath, injectBuild(source, precache))
  return 'injected'
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const result = runPrecache(path.join(root, 'dist', 'client'))
  console.log(result === 'injected' ? '[sw-precache] wrote the precache list into dist/client/sw.js' : '[sw-precache] sw.js has no build marker (kill switch?), left as is')
}
