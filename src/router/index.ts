import { createRouter, createWebHistory } from 'vue-router'

import AppLayout from '@/layouts/AppLayout.vue'
import { getSession } from '@/services/authService'

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),

    routes: [
        {
            path: '/',
            name: 'landing',
            component: () => import('@/views/LandingView.vue'),
        },
        {
            path: '/login',
            name: 'login',
            component: () => import('@/views/LoginView.vue'),
        },
        {
            path: '/register',
            name: 'register',
            component: () => import('@/views/RegisterView.vue'),
        },
        {
            path: '/payment/finish',
            name: 'payment-finish',
            component: () => import('@/views/PaymentFinishView.vue'),
        },
        {
            path: '/payment/status',
            name: 'payment-status',
            component: () => import('@/views/PaymentFinishView.vue'),
        },
        {
            path: '/payment/redirect',
            name: 'payment-redirect',
            component: () => import('@/views/PaymentFinishView.vue'),
        },
        {
            path: '/admin',
            component: AppLayout,
            meta: { requiresAuth: true, requiresAdmin: true },

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
                    path: '/master/products',
                    name: 'master-products',
                    component: () => import('@/views/master/ProductView.vue'),
                },
                {
                    path: '/master/customers',
                    name: 'master-customers',
                    component: () => import('@/views/master/CustomerView.vue'),
                },
                {
                    path: '/master/users',
                    name: 'master-users',
                    component: () => import('@/views/master/UserView.vue'),
                },
                {
                    path: '/master/delivery-schedules',
                    name: 'master-delivery-schedules',
                    component: () => import('@/views/master/DeliveryScheduleView.vue'),
                },
                {
                    path: '/orders',
                    name: 'orders',
                    component: () => import('@/views/OrderView.vue'),
                },
                {
                    path: '/deliveries',
                    name: 'deliveries',
                    component: () => import('@/views/delivery/DeliveryListView.vue'),
                },

                {
                    path: '/reports',
                    name: 'reports',
                    component: () => import('@/views/ReportView.vue'),
                },
            ],
        },
    ],
})

router.beforeEach((to, _from, next) => {
    const session = getSession()

    // Check if route or any matched route requires admin or auth
    const requiresAdmin = to.matched.some((record) => record.meta.requiresAdmin)
    const requiresAuth = to.matched.some((record) => record.meta.requiresAuth)

    if (requiresAuth || requiresAdmin) {
        if (!session || session.isGuest) {
            return next({ name: 'login' })
        }

        if (requiresAdmin) {
            const role = (session.role || '').toLowerCase()
            if (role === 'cashier') {
                // Cashier is only allowed to access /orders
                if (to.path !== '/orders') {
                    return next({ name: 'orders' })
                }
            } else if (role !== 'admin') {
                return next({ name: 'landing' })
            }
        }
    }

    // Redirect logged-in admin/cashier away from login page
    if (to.name === 'login' && session && !session.isGuest) {
        const role = (session.role || '').toLowerCase()
        if (role === 'admin') {
            return next({ name: 'dashboard' })
        } else if (role === 'cashier') {
            return next({ name: 'orders' })
        }
    }

    next()
})

export default router