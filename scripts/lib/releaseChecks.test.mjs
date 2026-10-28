import { describe, it, expect } from 'vitest'
import { checkGitState, checkFrontendBundle, checkBundleBudgets, checkServiceWorker, isCiEnvironment } from './releaseChecks.mjs'

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

describe('checkBundleBudgets', () => {
  const KB = 1000
  const sizes = {}
  const gz = (file) => sizes[file] ?? 0
  const manifest = () => ({
    'index.html': { file: 'assets/index-a.js', isEntry: true, css: ['assets/index-a.css'], imports: ['_vendor.js'] },
    '_vendor.js': { file: 'assets/vendor-a.js' },
    'src/views/dp/DpPublicView.vue': { file: 'assets/DpPublicView-a.js', isDynamicEntry: true, src: 'src/views/dp/DpPublicView.vue', imports: ['_vendor.js'] },
    'src/views/tix/EventPageView.vue': { file: 'assets/EventPageView-a.js', isDynamicEntry: true, src: 'src/views/tix/EventPageView.vue', imports: ['_vendor.js'] },
    'src/views/tix/GuestTicketView.vue': { file: 'assets/GuestTicketView-a.js', isDynamicEntry: true, src: 'src/views/tix/GuestTicketView.vue', imports: ['_vendor.js'] },
    'src/views/tix/AttendeeSelectionView.vue': { file: 'assets/AttendeeSelectionView-a.js', isDynamicEntry: true, src: 'src/views/tix/AttendeeSelectionView.vue' },
  })
  const set = (o) => {
    for (const k of Object.keys(sizes)) delete sizes[k]
    Object.assign(sizes, {
      'assets/index-a.js': 40 * KB,
      'assets/index-a.css': 10 * KB,
      'assets/vendor-a.js': 20 * KB,
      'assets/DpPublicView-a.js': 10 * KB,
      'assets/EventPageView-a.js': 10 * KB,
      'assets/GuestTicketView-a.js': 10 * KB,
      'assets/AttendeeSelectionView-a.js': 10 * KB,
      ...o,
    })
  }

  it('passes a bundle within every budget', () => {
    set({})
    expect(checkBundleBudgets(manifest(), gz)).toEqual([])
  })
  it('names an over-budget entry and its size', () => {
    set({ 'assets/index-a.js': 71 * KB })
    const problems = checkBundleBudgets(manifest(), gz)
    expect(problems.some((p) => p.includes('assets/index-a.js') && p.includes('71.0 kB'))).toBe(true)
    expect(problems).toHaveLength(1)
  })
  it('flags an over-budget entry stylesheet', () => {
    set({ 'assets/index-a.css': 23 * KB })
    expect(checkBundleBudgets(manifest(), gz).join('\n')).toMatch(/index-a\.css/)
  })
  it('flags an over-budget route chunk but ignores exempt names', () => {
    set({ 'assets/DpPublicView-a.js': 41 * KB, 'assets/AttendeeSelectionView-a.js': 300 * KB })
    const problems = checkBundleBudgets(manifest(), gz).join('\n')
    expect(problems).toMatch(/DpPublicView-a\.js/)
    expect(problems).not.toMatch(/AttendeeSelection/)
  })
  it('flags a public route whose entry, imports and chunk exceed 110 KB', () => {
    set({ 'assets/index-a.js': 60 * KB, 'assets/vendor-a.js': 30 * KB, 'assets/EventPageView-a.js': 25 * KB })
    expect(checkBundleBudgets(manifest(), gz).join('\n')).toMatch(/EventPageView/)
  })
  it('fails when a public route pattern matches no chunk (rename guard)', () => {
    set({})
    const m = manifest()
    delete m['src/views/tix/EventPageView.vue']
    expect(checkBundleBudgets(m, gz).join('\n')).toMatch(/EventPageView.*matches no chunk/)
  })
  it('budgets the guest ticket page like the other public routes', () => {
    set({ 'assets/index-a.js': 60 * KB, 'assets/vendor-a.js': 30 * KB, 'assets/GuestTicketView-a.js': 25 * KB })
    expect(checkBundleBudgets(manifest(), gz).join('\n')).toMatch(/GuestTicketView/)
  })
  it('fails when the guest ticket chunk disappears from the manifest', () => {
    set({})
    const m = manifest()
    delete m['src/views/tix/GuestTicketView.vue']
    expect(checkBundleBudgets(m, gz).join('\n')).toMatch(/GuestTicketView.*matches no chunk/)
  })
})

describe('checkServiceWorker', () => {
  it('flags the dev hash marker', () => {
    expect(checkServiceWorker("const BUILD = /*build*/ { hash: 'dev', precache: [] } /*end-build*/")).toHaveLength(1)
  })
  it('flags a missing file', () => {
    expect(checkServiceWorker(null)).toHaveLength(1)
  })
  it('passes an injected build', () => {
    expect(checkServiceWorker('const BUILD = /*build*/ { hash: "a1b2c3d4e5", precache: ["/assets/a.js"] } /*end-build*/')).toEqual([])
  })
})
