import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { handleClientError } from '@/lib/reportClientError'
import './styles/main.css'

// Dark only: public/theme-init.js pins this before CSS; this covers mounts where it did not run.
// useDarkMode and the theme toggle are removed in Task 6.
document.documentElement.classList.add('dark')

const app = createApp(App)
app.config.errorHandler = (err, instance, info) => {
  void instance
  handleClientError(err, info)
}
app.use(router).mount('#app')
