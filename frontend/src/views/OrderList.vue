<template lang="pug">
.container
  h1 Мои заказы
  el-card(style="margin-bottom: 20px")
    el-form(:inline="true")
      el-form-item(label="Статус")
        el-select(v-model="filters.state" placeholder="Все" clearable style="width: 300px" @change="handleFilterChange")
          el-option(label="Черновик" value="draft")
          el-option(label="Ожидает" value="pending")
          el-option(label="Одобрен" value="approved")
          el-option(label="В работе" value="in_progress")
          el-option(label="Завершен" value="completed")
          el-option(label="Отменен" value="cancelled")
  div(v-if="ordersStore.loading")
    el-skeleton(:rows="5" animated)
  el-alert(v-else-if="ordersStore.error" :title="ordersStore.error" type="error")
  div(v-else-if="ordersStore.orders.length === 0").empty-state
    p Заказы не найдены
  template(v-else)
    el-row(:gutter="20")
      el-col(v-for="order in ordersStore.orders" :key="order.id" :span="8" :xs="24" :sm="12" :md="8")
        OrderCard(:order="order" :userId="authStore.user?.id")
    el-pagination(
      v-if="ordersStore.pagination.pages > 1"
      v-model:current-page="currentPage"
      :page-size="20"
      :total="ordersStore.pagination.total"
      layout="total, prev, pager, next"
      @current-change="handlePageChange"
      style="margin-top: 20px; justify-content: center"
    )
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useOrdersStore } from '../stores/orders';
import { useAuthStore } from '../stores/auth';
import OrderCard from '../components/OrderCard.vue';

const route = useRoute();
const router = useRouter();
const ordersStore = useOrdersStore();
const authStore = useAuthStore();

const currentPage = ref(1);

const filters = reactive({
  state: '',
});

// Читаем фильтры из URL при загрузке
onMounted(() => {
  if (route.query.state) {
    filters.state = route.query.state as string;
  }
  if (route.query.page) {
    currentPage.value = parseInt(route.query.page as string) || 1;
  }
  loadOrders();
});

// Отслеживаем изменения фильтров и сразу загружаем данные
watch(() => filters.state, () => {
  currentPage.value = 1;
  updateURL();
  loadOrders();
});

// Загружаем заказы с учетом фильтров и пагинации
const loadOrders = async () => {
  const params: Record<string, any> = {
    page: currentPage.value,
    limit: 20,
  };
  if (filters.state) {
    params.state = filters.state;
  }
  await ordersStore.fetchOrders(params);
};

const handleFilterChange = () => {
  currentPage.value = 1;
  updateURL();
  loadOrders();
};

const handlePageChange = async (page: number) => {
  currentPage.value = page;
  updateURL();
  await loadOrders();
};

const updateURL = () => {
  const query: Record<string, string> = {};
  if (filters.state) query.state = filters.state;
  if (currentPage.value > 1) query.page = currentPage.value.toString();
  router.push({ query });
};
</script>

<style scoped>
.empty-state {
  text-align: center;
  padding: 40px;
}
</style>
