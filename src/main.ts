import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { vPrefetch } from '@/directives/prefetch'
import { handleClientError } from '@/lib/reportClientError'
import { registerSw } from '@/lib/registerSw'
import './styles/main.css'

const app = createApp(App)
app.config.errorHandler = (err, instance, info) => {
  void instance
  handleClientError(err, info)
}
app.directive('prefetch', vPrefetch)
app.use(router).mount('#app')
// web-vitals reads buffered entries, so loading it after first paint loses nothing.
void import('@/lib/rum').then(({ startRum }) => startRum(router))
registerSw()
