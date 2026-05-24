import { createRouter, createWebHistory } from 'vue-router'
import HomePage from '@/pages/HomePage.vue'
import AnswererPage from '@/pages/AnswererPage.vue'
import MonitorPage from '@/pages/MonitorPage.vue'
import SettingsPage from '@/pages/SettingsPage.vue'

const routes = [
  {
    path: '/',
    name: 'home',
    component: HomePage,
  },
  {
    path: '/answerer',
    name: 'answerer',
    component: AnswererPage,
  },
  {
    path: '/monitor',
    name: 'monitor',
    component: MonitorPage,
  },
  {
    path: '/settings',
    name: 'settings',
    component: SettingsPage,
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
