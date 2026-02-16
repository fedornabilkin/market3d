import {createApp} from 'vue';
import {createPinia} from 'pinia';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import * as ElementPlusIconsVue from '@element-plus/icons-vue';
import router from './router';
import { createI18n } from "vue-i18n";
import translations from './translations/loader';
import { initYandexMetrika } from 'yandex-metrika-vue3';

import App from './App.vue';

import '@fortawesome/fontawesome-free/css/all.css';
import 'bulma/css/bulma.css';

const i18n = createI18n({
  locale: "ru",
  fallbackLocale: "ru",
  messages: translations,
})

const ymId = import.meta.env.VITE_YM_ID
const nodeEnv = import.meta.env.VITE_NODE_ENV

const pinia = createPinia()
const app = createApp(App)
// app.use(initYandexMetrika, {
//   id: ymId,
//   index: index,
//   env: nodeEnv
//   // other options
// })

  .use(pinia)
  .use(router)
  .use(i18n)
  .use(ElementPlus)

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component);
}

app.mount('#app')
