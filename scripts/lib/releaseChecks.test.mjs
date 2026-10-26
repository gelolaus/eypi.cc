import { describe, it, expect } from 'vitest'
import { checkGitState, checkFrontendBundle, isCiEnvironment } from './releaseChecks.mjs'

describe('checkFrontendBundle', () => {
  it('flags a bundle built against localhost', () => {
    const problems = checkFrontendBundle([{ name: 'index.js', text: 'fetch("http://localhost:8787/api/links")' }])
    expect(problems.join('\n')).toMatch(/localhost:8787/)
  })
  it('passes a bundle built against the production API', () => {
    expect(checkFrontendBundle([{ name: 'index.js', text: 'fetch("https://api.eypi.cc/api/links")' }])).toEqual([])
  })
})

describe('checkGitState', () => {
  it('refuses a dirty tree unless allowDirty', () => {
    expect(checkGitState({ branch: 'main', porcelain: ' M src/App.vue\n', allowDirty: false, allowBranch: false })).toHaveLength(1)
    expect(checkGitState({ branch: 'main', porcelain: ' M src/App.vue\n', allowDirty: true, allowBranch: false })).toEqual([])
  })
  it('refuses a non-main branch unless allowBranch', () => {
    expect(checkGitState({ branch: 'redesign', porcelain: '', allowDirty: false, allowBranch: false })).toHaveLength(1)
    expect(checkGitState({ branch: 'redesign', porcelain: '', allowDirty: false, allowBranch: true })).toEqual([])
  })
  it('skips branch and dirty checks on a CI checkout', () => {
    expect(checkGitState({ branch: 'HEAD', porcelain: '?? .wrangler/\n', allowDirty: false, allowBranch: false, isCi: true })).toEqual([])
  })
  it('still checks the git state outside CI', () => {
    expect(checkGitState({ branch: 'HEAD', porcelain: '', allowDirty: false, allowBranch: false, isCi: false })).toHaveLength(1)
  })
  it('passes a clean main', () => {
    expect(checkGitState({ branch: 'main', porcelain: '', allowDirty: false, allowBranch: false })).toEqual([])
  })
})

describe('isCiEnvironment', () => {
  it('detects Cloudflare Workers Builds and generic CI', () => {
    expect(isCiEnvironment({ WORKERS_CI: '1' })).toBe(true)
    expect(isCiEnvironment({ CI: 'true' })).toBe(true)
    expect(isCiEnvironment({})).toBe(false)
    expect(isCiEnvironment({ CI: 'false' })).toBe(false)
  })
})
