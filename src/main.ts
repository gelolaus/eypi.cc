import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { handleClientError } from '@/lib/reportClientError'
import { startRum } from '@/lib/rum'
import './styles/main.css'

const app = createApp(App)
app.config.errorHandler = (err, instance, info) => {
  void instance
  handleClientError(err, info)
}
app.use(router).mount('#app')
startRum(router)
