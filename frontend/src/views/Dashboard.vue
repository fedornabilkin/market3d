<template lang="pug">
.container
  h1 Добро пожаловать, {{ authStore.user?.email }}!
  .dashboard-content
    // Статистика
    el-row(:gutter="20" style="margin-bottom: 30px")
      el-col(:span="6")
        el-card.stat-card
          el-statistic(title="Принтеров" :value="stats.printers")
          el-alert(v-if="statsError" :title="statsError" type="error" style="margin-top: 10px")
      el-col(:span="6")
        el-card.stat-card
          el-statistic(title="Заказов" :value="stats.orders")
      el-col(:span="6")
        el-card.stat-card
          el-statistic(title="Пользователей" :value="stats.users")
      el-col(:span="6")
        el-card.stat-card
          el-statistic(title="Кластеров" :value="stats.clusters")
    
    // Активные кластеры
    el-card.dashboard-section
      template(#header)
        h2 Активные кластеры
      div(v-if="clustersStore.loading")
        el-skeleton(:rows="3" animated)
      el-alert(v-else-if="clustersError" :title="clustersError" type="error")
      div(v-else-if="recentClusters.length === 0").empty-state
        p Кластеры не найдены
      div(v-else)
        el-row(:gutter="20")
          el-col(v-for="cluster in recentClusters" :key="cluster.id" :span="8" :xs="24" :sm="12" :md="8")
            ClusterCard(:cluster="cluster" :userId="authStore.user?.id")
    
    // Последние принтеры
    el-card.dashboard-section
      template(#header)
        h2 Последние принтеры
      div(v-if="printersStore.loading")
        el-skeleton(:rows="3" animated)
      el-alert(v-else-if="printersError" :title="printersError" type="error")
      div(v-else-if="recentPrinters.length === 0").empty-state
        p Принтеры не найдены
      div(v-else)
        el-row(:gutter="20")
          el-col(v-for="printer in recentPrinters" :key="printer.id" :span="8" :xs="24" :sm="12" :md="8")
            PrinterCard(:printer="printer" :userId="authStore.user?.id")
    
    // Последние заказы
    el-card.dashboard-section
      template(#header)
        h2 Последние заказы
      div(v-if="ordersStore.loading")
        el-skeleton(:rows="3" animated)
      el-alert(v-else-if="ordersError" :title="ordersError" type="error")
      div(v-else-if="recentOrders.length === 0").empty-state
        p Заказы не найдены
      div(v-else)
        el-row(:gutter="20")
          el-col(v-for="order in recentOrders" :key="order.id" :span="8" :xs="24" :sm="12" :md="8")
            el-card(style="margin-bottom: 20px")
              template(#header)
                router-link(:to="`/orders/${order.id}`")
                  h3 Заказ {{ `#${order.id}` }}
              p
                strong Материал: 
                | {{ order.material }}
              p
                strong Статус: 
                | {{ getStatusText(order.state) }}
              p
                strong Создан: 
                | {{ formatDate(order.createdAt) }}
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAuthStore } from '../stores/auth';
import { usePrintersStore } from '../stores/printers';
import { useOrdersStore } from '../stores/orders';
import { useClustersStore } from '../stores/clusters';
import ClusterCard from '../components/ClusterCard.vue';
import PrinterCard from '../components/PrinterCard.vue';
import api from '../services/api';

const authStore = useAuthStore();
const printersStore = usePrintersStore();
const ordersStore = useOrdersStore();
const clustersStore = useClustersStore();

const stats = ref({
  printers: 0,
  orders: 0,
  users: 0,
  clusters: 0,
});

const statsError = ref('');
const printersError = ref('');
const ordersError = ref('');
const clustersError = ref('');

const recentPrinters = ref([]);
const recentOrders = ref([]);
const recentClusters = ref([]);

const getStatusText = (status: string): string => {
  const statusMap: Record<string, string> = {
    available: 'Доступен',
    busy: 'Занят',
    maintenance: 'На обслуживании',
    inactive: 'Неактивен',
    draft: 'Черновик',
    pending: 'Ожидает',
    approved: 'Одобрен',
    in_progress: 'В работе',
    completed: 'Завершен',
    cancelled: 'Отменен',
  };
  return statusMap[status] || status;
};

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('ru-RU');
};

onMounted(async () => {
  // Загружаем статистику независимо
  try {
    const statsResponse = await api.get('/stats');
    stats.value = statsResponse.data;
    statsError.value = '';
  } catch (error: any) {
    statsError.value = error.response?.data?.error || 'Не удалось загрузить статистику';
    console.error('Failed to load stats:', error);
  }

  // Загружаем последние принтеры независимо
  try {
    recentPrinters.value = await printersStore.fetchRecentPrinters(6);
    printersError.value = '';
  } catch (error: any) {
    printersError.value = error.response?.data?.error || 'Не удалось загрузить принтеры';
    console.error('Failed to load recent printers:', error);
  }

  // Загружаем последние заказы независимо
  try {
    recentOrders.value = await ordersStore.fetchRecentOrders(5);
    ordersError.value = '';
  } catch (error: any) {
    ordersError.value = error.response?.data?.error || 'Не удалось загрузить заказы';
    console.error('Failed to load recent orders:', error);
  }

  // Загружаем активные кластеры независимо
  try {
    const clustersResponse = await clustersStore.fetchActiveClusters();
    recentClusters.value = clustersResponse.slice(0, 6); // Показываем первые 6
    clustersError.value = '';
  } catch (error: any) {
    clustersError.value = error.response?.data?.error || 'Не удалось загрузить кластеры';
    console.error('Failed to load recent clusters:', error);
  }
  
});
</script>

<style scoped>
.dashboard-content {
  margin-top: 30px;
}

.dashboard-section {
  margin-bottom: 40px;
}

.stat-card {
  text-align: center;
}

.empty-state {
  text-align: center;
  padding: 40px;
}

.empty-state p {
  margin-bottom: 20px;
  color: #666;
}
</style>
