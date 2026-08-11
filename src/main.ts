import { createApp } from 'vue'

import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'

import ConfirmationService from 'primevue/confirmationservice'
import ToastService from 'primevue/toastservice'

import App from './App.vue'
import router from './router'

import 'primeicons/primeicons.css'
import 'primeflex/primeflex.css'
import '@/assets/main.css'

const app = createApp(App)

app.use(router)

app.use(PrimeVue, {
  theme: {
    preset: Aura,
    options: {
      darkModeSelector: false
    }
  }
})

app.use(ConfirmationService)
app.use(ToastService)

app.mount('#app')