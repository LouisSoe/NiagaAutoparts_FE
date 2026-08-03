<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, RouterView } from 'vue-router'

import Button from 'primevue/button'
import Drawer from 'primevue/drawer'

const mobileSidebarVisible = ref(false)

interface MenuItem {
    label: string
    icon: string
    route: string
}

interface MenuGroup {
    label?: string
    items: MenuItem[]
}

const menuGroups: MenuGroup[] = [
    {
        items: [
            {
                label: 'Dashboard',
                icon: 'pi pi-home',
                route: '/',
            },
        ],
    },
    {
        label: 'Master',
        items: [
            {
                label: 'Category',
                icon: 'pi pi-tags',
                route: '/master/categories',
            },
            {
                label: 'Barang',
                icon: 'pi pi-box',
                route: '/master/products',
            },
            {
                label: 'Customer',
                icon: 'pi pi-users',
                route: '/master/customers',
            },
        ],
    },
    {
        label: 'Transaksi',
        items: [
            {
                label: 'Order',
                icon: 'pi pi-shopping-cart',
                route: '/orders',
            },
        ],
    },
    {
        label: 'Report',
        items: [
            {
                label: 'Laporan',
                icon: 'pi pi-chart-bar',
                route: '/reports',
            },
        ],
    },
]

function closeMobileSidebar() {
    mobileSidebarVisible.value = false
}
</script>

<template>
    <div class="app-layout">
        <!-- =========================
             DESKTOP SIDEBAR
        ========================== -->
        <aside class="desktop-sidebar">
            <div class="sidebar-header">
                <div class="brand-icon">
                    <i class="pi pi-car"></i>
                </div>

                <div class="brand-text">
                    <strong>AutoParts</strong>
                    <small>Management</small>
                </div>
            </div>

            <nav class="sidebar-navigation">
                <template
                    v-for="(group, groupIndex) in menuGroups"
                    :key="groupIndex"
                >
                    <div
                        v-if="group.label"
                        class="sidebar-section-label"
                    >
                        {{ group.label }}
                    </div>

                    <RouterLink
                        v-for="item in group.items"
                        :key="item.route"
                        :to="item.route"
                        class="sidebar-item"
                    >
                        <i :class="item.icon"></i>

                        <span>
                            {{ item.label }}
                        </span>
                    </RouterLink>
                </template>
            </nav>

            <div class="sidebar-footer">
                <div class="sidebar-user">
                    <div class="user-avatar">
                        <i class="pi pi-user"></i>
                    </div>

                    <div class="user-information">
                        <strong>Administrator</strong>
                        <small>Admin</small>
                    </div>
                </div>
            </div>
        </aside>

        <!-- =========================
             MOBILE DRAWER
        ========================== -->
        <Drawer
            v-model:visible="mobileSidebarVisible"
            position="left"
            class="mobile-drawer"
        >
            <template #header>
                <div class="drawer-brand">
                    <div class="brand-icon">
                        <i class="pi pi-car"></i>
                    </div>

                    <div class="brand-text">
                        <strong>AutoParts</strong>
                        <small>Management</small>
                    </div>
                </div>
            </template>

            <nav class="sidebar-navigation drawer-navigation">
                <template
                    v-for="(group, groupIndex) in menuGroups"
                    :key="groupIndex"
                >
                    <div
                        v-if="group.label"
                        class="sidebar-section-label"
                    >
                        {{ group.label }}
                    </div>

                    <RouterLink
                        v-for="item in group.items"
                        :key="item.route"
                        :to="item.route"
                        class="sidebar-item"
                        @click="closeMobileSidebar"
                    >
                        <i :class="item.icon"></i>

                        <span>
                            {{ item.label }}
                        </span>
                    </RouterLink>
                </template>
            </nav>
        </Drawer>

        <!-- =========================
             MAIN AREA
        ========================== -->
        <div class="main-wrapper">
            <!-- TOPBAR -->
            <header class="topbar">
                <div class="topbar-left">
                    <Button
                        class="mobile-menu-button"
                        icon="pi pi-bars"
                        severity="secondary"
                        text
                        rounded
                        aria-label="Buka menu"
                        @click="mobileSidebarVisible = true"
                    />

                    <div class="topbar-title">
                        <strong>AutoParts</strong>
                    </div>
                </div>

                <div class="topbar-right">
                    <Button
                        icon="pi pi-bell"
                        severity="secondary"
                        text
                        rounded
                        aria-label="Notification"
                    />

                    <Button
                        icon="pi pi-user"
                        severity="secondary"
                        text
                        rounded
                        aria-label="User"
                    />
                </div>
            </header>

            <!-- PAGE CONTENT -->
            <main class="main-content">
                <RouterView />
            </main>
        </div>
    </div>
</template>

<style scoped>
.app-layout {
    min-height: 100vh;
    background: var(--p-surface-50);
}

/* =========================================================
   DESKTOP SIDEBAR
========================================================= */

.desktop-sidebar {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 100;

    display: flex;
    flex-direction: column;

    width: 260px;
    height: 100vh;

    background: var(--p-surface-0);
    border-right: 1px solid var(--p-surface-200);
}

.sidebar-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;

    height: 72px;
    padding: 0 1.25rem;

    border-bottom: 1px solid var(--p-surface-200);
}

.drawer-brand {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.brand-icon {
    display: flex;
    align-items: center;
    justify-content: center;

    width: 40px;
    height: 40px;

    flex-shrink: 0;

    border-radius: 10px;

    color: var(--p-primary-contrast-color);
    background: var(--p-primary-color);
}

.brand-icon i {
    font-size: 1.1rem;
}

.brand-text {
    display: flex;
    flex-direction: column;

    min-width: 0;
}

.brand-text strong {
    font-size: 1rem;
    color: var(--p-surface-900);
}

.brand-text small {
    margin-top: 0.1rem;

    font-size: 0.75rem;
    color: var(--p-surface-500);
}

/* =========================================================
   SIDEBAR NAVIGATION
========================================================= */

.sidebar-navigation {
    flex: 1;

    padding: 1rem 0.75rem;

    overflow-y: auto;
}

.sidebar-section-label {
    padding: 1.25rem 0.75rem 0.5rem;

    font-size: 0.7rem;
    font-weight: 600;

    text-transform: uppercase;
    letter-spacing: 0.08em;

    color: var(--p-surface-400);
}

.sidebar-section-label:first-child {
    padding-top: 0.5rem;
}

.sidebar-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;

    min-height: 44px;

    margin-bottom: 0.25rem;
    padding: 0.65rem 0.75rem;

    border-radius: 8px;

    color: var(--p-surface-600);

    text-decoration: none;

    transition:
        background-color 0.15s ease,
        color 0.15s ease;
}

.sidebar-item i {
    width: 20px;

    font-size: 1rem;
    text-align: center;
}

.sidebar-item span {
    font-size: 0.875rem;
    font-weight: 500;
}

.sidebar-item:hover {
    color: var(--p-surface-900);
    background: var(--p-surface-100);
}

.sidebar-item.router-link-exact-active {
    color: var(--p-primary-color);
    background: var(--p-primary-50);
}

/* =========================================================
   SIDEBAR FOOTER
========================================================= */

.sidebar-footer {
    padding: 1rem;

    border-top: 1px solid var(--p-surface-200);
}

.sidebar-user {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.user-avatar {
    display: flex;
    align-items: center;
    justify-content: center;

    width: 38px;
    height: 38px;

    flex-shrink: 0;

    border-radius: 50%;

    color: var(--p-primary-color);
    background: var(--p-primary-50);
}

.user-information {
    display: flex;
    flex-direction: column;

    min-width: 0;
}

.user-information strong {
    font-size: 0.8rem;

    color: var(--p-surface-800);
}

.user-information small {
    margin-top: 0.1rem;

    font-size: 0.7rem;

    color: var(--p-surface-500);
}

/* =========================================================
   MAIN WRAPPER
========================================================= */

.main-wrapper {
    min-height: 100vh;

    margin-left: 260px;
}

/* =========================================================
   TOPBAR
========================================================= */

.topbar {
    position: sticky;
    top: 0;
    z-index: 90;

    display: flex;
    align-items: center;
    justify-content: space-between;

    height: 72px;

    padding: 0 1.5rem;

    background: var(--p-surface-0);
    border-bottom: 1px solid var(--p-surface-200);
}

.topbar-left,
.topbar-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.topbar-title strong {
    font-size: 1rem;

    color: var(--p-surface-900);
}

.mobile-menu-button {
    display: none;
}

/* =========================================================
   CONTENT
========================================================= */

.main-content {
    padding: 1.5rem;
}

/* =========================================================
   TABLET & MOBILE
========================================================= */

@media (max-width: 991px) {
    .desktop-sidebar {
        display: none;
    }

    .main-wrapper {
        margin-left: 0;
    }

    .mobile-menu-button {
        display: inline-flex;
    }

    .main-content {
        padding: 1rem;
    }

    .topbar {
        height: 64px;

        padding: 0 1rem;
    }
}

@media (max-width: 576px) {
    .topbar-title {
        display: none;
    }

    .main-content {
        padding: 0.75rem;
    }
}
</style>

<style>
.mobile-drawer {
    width: 280px !important;
}

.drawer-navigation {
    padding: 0;
}
</style>