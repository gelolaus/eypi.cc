import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { handleClientError } from '@/lib/reportClientError'
import { initDarkMode } from '@/composables/useDarkMode'
import './styles/main.css'

// Same decision as public/theme-init.js, which runs before CSS.
// This covers mounts where that script did not run.
initDarkMode()

const app = createApp(App)
app.config.errorHandler = (err, instance, info) => {
  void instance
  handleClientError(err, info)
}
app.use(router).mount('#app')
