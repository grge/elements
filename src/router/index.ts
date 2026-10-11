import { createRouter, createWebHistory } from 'vue-router'
import PageView from '../views/PageView.vue'

export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'page', component: PageView },
  ],
})
