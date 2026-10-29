/*
 * Applies the saved theme before first paint, so a dark visitor never sees a light flash.
 * Classic script, no modules: index.html loads it synchronously in <head>.
 *
 * The parse and resolve rules below duplicate parsePreference and resolveTheme in
 * src/theme/theme.ts (same storage key, same background colours). src/theme/themeInit.test.ts runs
 * this file against those functions, so the two cannot drift apart unnoticed.
 *
 * It never throws: any failure (no localStorage, no matchMedia, corrupt value) leaves the page light.
 */
;(function () {
  try {
    var mode = 'system'
    var black = false
    try {
      var value = JSON.parse(localStorage.getItem('eypi.theme') || 'null')
      if (
        value && typeof value === 'object' && !Array.isArray(value) &&
        (value.mode === 'system' || value.mode === 'light' || value.mode === 'dark') &&
        typeof value.black === 'boolean'
      ) {
        mode = value.mode
        black = value.black
      }
    } catch (e) {
      // keep the default preference
    }
    var systemDark = false
    try {
      systemDark = !!matchMedia('(prefers-color-scheme: dark)').matches
    } catch (e) {
      // keep light
    }
    var dark = mode === 'dark' || (mode === 'system' && systemDark)
    var pure = dark && black
    var root = document.documentElement
    root.classList.toggle('dark', dark)
    root.classList.toggle('black', pure)
    var meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', pure ? '#000000' : dark ? '#0a0a0a' : '#f5f5f5')
  } catch (e) {
    // leave the page light
  }
})()
