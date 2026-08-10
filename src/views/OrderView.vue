<script setup lang="ts">
import Card from 'primevue/card'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import Toast from 'primevue/toast'
import ConfirmDialog from 'primevue/confirmdialog'

import OrderListTabs from '@/views/tabs/OrderListTabs.vue'
import PaymentTabs from '@/views/tabs/PaymentTabs.vue'
</script>

<template>
  <div class="p-3 md:p-4 surface-ground min-h-screen">
    <Toast />
    <ConfirmDialog />

    <!-- HEADER -->
    <div class="mb-4">
      <h1 class="text-2xl font-bold text-900 m-0">Order</h1>
      <p class="text-sm text-500 mt-2 mb-0">Kelola data produk, harga, kategori, dan stok.</p>
    </div>

    <!-- CONTENT -->
    <Card>
      <template #content>
        <Tabs value="tab1">
          <TabList>
            <Tab value="tab1">Order List</Tab>
            <Tab value="tab2">POS</Tab>
          </TabList>
          <TabPanels>
            <TabPanel value="tab1">
              <OrderListTabs />
            </TabPanel>
            <TabPanel value="tab2">
              <PaymentTabs />
            </TabPanel>
          </TabPanels>
        </Tabs>
      </template>
    </Card>
  </div>
</template>
