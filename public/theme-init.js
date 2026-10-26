// Keep in sync with readDark() and applyColorScheme() in src/composables/useDarkMode.ts.
// Blocking classic script: production CSS is render-blocking and the app
// module is deferred, so the class has to land before that stylesheet paints.
(function () {
  try {
    var stored = localStorage.getItem('eypi_dark_mode')
    var systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    var dark = stored === 'true' || (stored !== 'false' && systemDark)
    var root = document.documentElement
    root.classList.toggle('dark', dark)
    root.style.colorScheme = dark ? 'dark' : 'light'
    var meta = document.querySelector('meta[name="theme-color"]')
    if (!meta) {
      meta = document.createElement('meta')
      meta.setAttribute('name', 'theme-color')
      document.head.appendChild(meta)
    }
    meta.setAttribute('content', dark ? '#000000' : '#F5F5F5')
  } catch (err) {
    void err
  }
})()
