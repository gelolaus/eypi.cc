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
