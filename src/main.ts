import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { handleClientError } from '@/lib/reportClientError'
import './styles/main.css'

// Dark only: index.html carries class="dark"; this covers mounts that bypass it.
document.documentElement.classList.add('dark')

const app = createApp(App)
app.config.errorHandler = (err, instance, info) => {
  void instance
  handleClientError(err, info)
}
app.use(router).mount('#app')
