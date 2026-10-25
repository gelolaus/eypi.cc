import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { handleClientError } from '@/lib/reportClientError'
import './styles/main.css'

// Apply saved dark mode preference before first paint
const stored = localStorage.getItem('eypi_dark_mode')
if (stored === 'true') {
  document.documentElement.classList.add('dark')
}

const app = createApp(App)
app.config.errorHandler = (err, instance, info) => {
  void instance
  handleClientError(err, info)
}
app.use(router).mount('#app')
