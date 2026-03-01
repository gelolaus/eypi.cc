import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './styles/main.css'

// Apply saved dark mode preference before first paint
const stored = localStorage.getItem('eypi_dark_mode')
if (stored === 'true') {
  document.documentElement.classList.add('dark')
}

createApp(App).use(router).mount('#app')
