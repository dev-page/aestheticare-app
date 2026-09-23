import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import './assets/customer-portal.css'
import App from './App.vue'
import router from './router'
import Vue3Toastify from 'vue3-toastify'
import 'vue3-toastify/dist/index.css'
import VueSweetalert2 from 'vue-sweetalert2'
import 'sweetalert2/dist/sweetalert2.min.css'

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js', { updateViaCache: 'none' })
      .catch((error) => console.warn('Service worker registration failed:', error))
  })
}

createApp(App)
.use(createPinia())
.use(router)
.use(Vue3Toastify, {
  autoClose: 3000,
  icon: false,
})
.use(VueSweetalert2, {
  buttonsStyling: false
})
.mount('#app')
