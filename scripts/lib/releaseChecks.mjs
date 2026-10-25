export function checkGitState({ branch, porcelain, allowDirty, allowBranch }) {
  const problems = []
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
