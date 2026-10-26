// The app is dark only (wantap design port). This script and useDarkMode.ts
// are removed in Task 6; until then it pins the dark class so the tokens apply.
(function () {
  try {
    var root = document.documentElement
    root.classList.add('dark')
    root.style.colorScheme = 'dark'
  } catch (err) {
    void err
  }
})()
