import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('../views/Register.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/',
    name: 'Dashboard',
    component: () => import('../views/Dashboard.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/printers',
    name: 'PrinterList',
    component: () => import('../views/PrinterList.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/printers/register',
    name: 'PrinterRegister',
    component: () => import('../views/PrinterRegister.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/orders',
    name: 'OrderList',
    component: () => import('../views/OrderList.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/orders/create',
    name: 'OrderCreate',
    component: () => import('../views/OrderCreate.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/orders/:id',
    name: 'OrderDetail',
    component: () => import('../views/OrderDetail.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/orders/:id/edit',
    name: 'OrderEdit',
    component: () => import('../views/OrderCreate.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/printers/:id',
    name: 'PrinterDetail',
    component: () => import('../views/PrinterDetail.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/printers/:id/edit',
    name: 'PrinterEdit',
    component: () => import('../views/PrinterRegister.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/profile',
    name: 'Profile',
    component: () => import('../views/Profile.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/clusters',
    name: 'ClusterList',
    component: () => import('../views/ClusterList.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/clusters/create',
    name: 'ClusterCreate',
    component: () => import('../views/ClusterCreate.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/clusters/:id',
    name: 'ClusterDetail',
    component: () => import('../views/ClusterDetail.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/clusters/:id/edit',
    name: 'ClusterEdit',
    component: () => import('../views/ClusterCreate.vue'),
    meta: { requiresAuth: true },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to, from, next) => {
  const authStore = useAuthStore();
  authStore.init();

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next('/login');
  } else if (to.meta.requiresRole && authStore.user?.role !== to.meta.requiresRole) {
    next('/');
  } else {
    next();
  }
});

export default router;

