// Keep in sync with readDark() in src/composables/useDarkMode.ts.
// Blocking classic script: production CSS is render-blocking and the app
// module is deferred, so the class has to land before that stylesheet paints.
(function () {
  try {
    var stored = localStorage.getItem('eypi_dark_mode')
    var systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    var dark = stored === 'true' || (stored !== 'false' && systemDark)
    document.documentElement.classList.toggle('dark', dark)
  } catch (err) {
    void err
  }
})()
