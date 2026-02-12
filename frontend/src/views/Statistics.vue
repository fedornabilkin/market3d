<template lang="pug">
.container
  Breadcrumbs
  .dashboard-content
    // Статистика
    el-row(:gutter="20" style="margin-bottom: 30px")
      el-col(:span="6")
        el-card.stat-card
          el-statistic(title="Принтеров" :value="stats.printers")
            template(#suffix)
              span(v-if="authStore.isAuthenticated && stats.myPrinters !== undefined") ({{ stats.myPrinters }})
          el-alert(v-if="statsError" :title="statsError" type="error" style="margin-top: 10px")
      el-col(:span="6")
        el-card.stat-card
          el-statistic(title="Заказов" :value="stats.orders")
            template(#suffix)
              span(v-if="authStore.isAuthenticated && stats.myOrders !== undefined") ({{ stats.myOrders }})
      el-col(:span="6")
        el-card.stat-card
          el-statistic(title="Пользователей" :value="stats.users")
      el-col(:span="6")
        el-card.stat-card
          el-statistic(title="Кластеров" :value="stats.clusters")
            template(#suffix)
              span(v-if="authStore.isAuthenticated && stats.myClusters !== undefined") ({{ stats.myClusters }})
    
    // Активные кластеры
    el-card.dashboard-section
      template(#header)
        h2 Активные кластеры
      el-card(style="margin-bottom: 20px")
        ClusterFilter(
          :filters="clusterFilters"
          :loading="dictionariesStore.loading"
          @update:filters="handleClusterFilterUpdate"
        )
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
        h2 Завершенные заказы
      div(v-if="ordersStore.loading")
        el-skeleton(:rows="3" animated)
      el-alert(v-else-if="ordersError" :title="ordersError" type="error")
      div(v-else-if="recentOrders.length === 0").empty-state
        p Заказы не найдены
      div(v-else)
        el-row(:gutter="20")
          el-col(v-for="order in recentOrders" :key="order.id" :span="8" :xs="24" :sm="12" :md="8")
            OrderCard(:order="order" :userId="authStore.user?.id")
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useAuthStore } from '../stores/auth';
import { usePrintersStore } from '../stores/printers';
import { useOrdersStore } from '../stores/orders';
import { useClustersStore } from '../stores/clusters';
import { useDictionariesStore } from '../stores/dictionaries';
import ClusterCard from '../components/ClusterCard.vue';
import PrinterCard from '../components/PrinterCard.vue';
import OrderCard from '../components/OrderCard.vue';
import ClusterFilter from '../components/ClusterFilter.vue';
import Breadcrumbs from '../components/Breadcrumbs.vue';
import api from '../services/api';

const authStore = useAuthStore();
const printersStore = usePrintersStore();
const ordersStore = useOrdersStore();
const clustersStore = useClustersStore();
const dictionariesStore = useDictionariesStore();

const stats = ref({
  printers: 0,
  orders: 0,
  users: 0,
  clusters: 0,
  myPrinters: undefined as number | undefined,
  myOrders: undefined as number | undefined,
  myClusters: undefined as number | undefined,
});

const statsError = ref('');
const printersError = ref('');
const ordersError = ref('');
const clustersError = ref('');

const recentPrinters = ref([]);
const recentOrders = ref([]);
const recentClusters = ref([]);

const clusterFilters = reactive({
  state: 'active' as string | undefined,
  regionId: null as number | null,
  cityId: null as number | null,
  materialId: null as number | null,
  colorId: null as number | null,
});

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

  // Загружаем только завершенные заказы
  try {
    // const result = await ordersStore.fetchOrders({ state: 'completed', limit: 6 });
    // recentOrders.value = result.data || result;
    // recentOrders.value = await ordersStore.fetchRecentOrders(6);
    ordersError.value = '';
  } catch (error: any) {
    ordersError.value = error.response?.data?.error || 'Не удалось загрузить заказы';
    console.error('Failed to load recent orders:', error);
  }

  // Загружаем активные кластеры с фильтрами
  await loadClusters();
});

const handleClusterFilterUpdate = async (newFilters: typeof clusterFilters) => {
  Object.assign(clusterFilters, newFilters);
  await loadClusters();
};

const loadClusters = async () => {
  try {
    const params: any = {
      limit: 6,
    };
    if (clusterFilters.state) params.state = clusterFilters.state;
    if (clusterFilters.regionId) params.regionId = clusterFilters.regionId;
    if (clusterFilters.cityId) params.cityId = clusterFilters.cityId;
    if (clusterFilters.materialId) params.materialId = clusterFilters.materialId;
    if (clusterFilters.colorId) params.colorId = clusterFilters.colorId;

    const result = await clustersStore.fetchClusters(params);
    recentClusters.value = (result.data || result).slice(0, 6);
    clustersError.value = '';
  } catch (error: any) {
    clustersError.value = error.response?.data?.error || 'Не удалось загрузить кластеры';
    console.error('Failed to load recent clusters:', error);
  }
};
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
