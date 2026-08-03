import { createRouter, createWebHistory } from 'vue-router'

import AppLayout from '@/layouts/AppLayout.vue'

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),

    routes: [
        {
            path: '/',
            component: AppLayout,

            children: [
                {
                    path: '',
                    name: 'dashboard',
                    component: () => import('@/views/DashboardView.vue'),
                },

                {
                    path: '/master/categories',
                    name: 'master-categories',
                    component: () => import('@/views/master/CategoryView.vue'),
                },

                {
                    path: 'products',
                    name: 'products',
                    component: () => import('@/views/ProductView.vue'),
                },

                {
                    path: 'customers',
                    name: 'customers',
                    component: () => import('@/views/CustomerView.vue'),
                },

                {
                    path: 'orders',
                    name: 'orders',
                    component: () => import('@/views/OrderView.vue'),
                },

                {
                    path: 'reports',
                    name: 'reports',
                    component: () => import('@/views/ReportView.vue'),
                },
            ],
        },
    ],
})

export default router