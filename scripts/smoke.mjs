import { checkResponse } from './lib/smoke.mjs'

const TARGETS = [
  { url: 'https://eypi.cc/', status: 200, contentTypePrefix: 'text/html' },
  { url: 'https://api.eypi.cc/api/health', status: 200, contentTypePrefix: 'text/plain' },
]

let failed = false

for (const target of TARGETS) {
  try {
    const res = await fetch(target.url, { signal: AbortSignal.timeout(10000) })
    const problem = checkResponse(
      target.url,
      { status: res.status, contentType: res.headers.get('content-type') },
      { status: target.status, contentTypePrefix: target.contentTypePrefix },
    )
    if (problem) {
      console.error(`FAIL ${target.url}: ${problem}`)
      failed = true
    } else {
      console.log(`PASS ${target.url}`)
    }
  } catch (error) {
    console.error(`FAIL ${target.url}: ${error instanceof Error ? error.message : String(error)}`)
    failed = true
  }
}

process.exit(failed ? 1 : 0)
