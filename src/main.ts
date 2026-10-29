import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { vPrefetch } from '@/directives/prefetch'
import { handleClientError } from '@/lib/reportClientError'
import { registerSw } from '@/lib/registerSw'
import { initTheme } from '@/composables/useTheme'
import './styles/main.css'

const app = createApp(App)
app.config.errorHandler = (err, instance, info) => {
  void instance
  handleClientError(err, info)
}
app.directive('prefetch', vPrefetch)
initTheme()
app.use(router).mount('#app')
// web-vitals reads buffered entries, so loading it after first paint loses nothing.
void import('@/lib/rum').then(({ startRum }) => startRum(router)).catch(() => {})
registerSw()
// Keep the install offer if it fires before the (lazy) account menu loads; see useInstallPrompt.
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); (window as { __bip?: Event }).__bip = e })
