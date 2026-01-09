<template lang="pug">
.container
  .header-section
    h1 Мои заказы
    router-link(to="/orders/create")
      el-button(type="primary") Создать
  el-card
    el-form(:inline="true" @submit.prevent="applyFilters")
      el-form-item(label="Статус")
        el-select(v-model="filters.state" placeholder="Все" clearable style="width: 300px")
          el-option(label="Черновик" value="draft")
          el-option(label="Ожидает" value="pending")
          el-option(label="Одобрен" value="approved")
          el-option(label="В работе" value="in_progress")
          el-option(label="Завершен" value="completed")
          el-option(label="Отменен" value="cancelled")
      el-form-item
        el-button(type="primary" @click="applyFilters") Применить
  div(v-if="ordersStore.loading")
    el-skeleton(:rows="5" animated)
  el-alert(v-else-if="ordersStore.error" :title="ordersStore.error" type="error")
  div(v-else-if="ordersStore.orders.length === 0").empty-state
    p Заказы не найдены
  template(v-else)
    div.orders-list
      el-card(v-for="order in ordersStore.orders" :key="order.id" style="margin-bottom: 20px")
        template(#header)
          .order-header
            router-link(:to="`/orders/${order.id}`")
              h3 Заказ {{ `#${order.id}` }}
            el-tag(:type="getStatusType(order.state)") {{ getStatusText(order.state) }}
        p
          strong Материал: 
          | {{ order.material }}
        p
          strong Количество: 
          | {{ order.quantity }}
        p
          strong Срок: 
          | {{ formatDate(order.deadline) }}
        p
          strong Создан: 
          | {{ formatDate(order.createdAt) }}
        .order-actions
          router-link(:to="`/orders/${order.id}`")
            el-button(type="primary") Подробнее
          el-button(
            v-if="canUpdateState(order)"
            @click="updateState(order.id, getNextState(order.state))"
            type="default"
          ) {{ getNextStateText(order.state) }}
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
import { ref, reactive, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useOrdersStore } from '../stores/orders';
import { useAuthStore } from '../stores/auth';
import type { Order } from '../stores/orders';

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

const getStatusText = (status: string): string => {
  const statusMap: Record<string, string> = {
    draft: 'Черновик',
    pending: 'Ожидает',
    approved: 'Одобрен',
    in_progress: 'В работе',
    completed: 'Завершен',
    cancelled: 'Отменен',
  };
  return statusMap[status] || status;
};

const getStatusType = (status: string): 'success' | 'warning' | 'danger' | 'info' => {
  const typeMap: Record<string, 'success' | 'warning' | 'danger' | 'info'> = {
    draft: 'info',
    pending: 'warning',
    approved: 'info',
    in_progress: 'warning',
    completed: 'success',
    cancelled: 'danger',
  };
  return typeMap[status] || 'info';
};

const getNextState = (currentState: string): Order['state'] => {
  const stateFlow: Record<string, Order['state']> = {
    draft: 'pending',
    pending: 'approved',
    approved: 'in_progress',
    in_progress: 'completed',
  };
  return stateFlow[currentState] || currentState as Order['state'];
};

const getNextStateText = (currentState: string): string => {
  const nextState = getNextState(currentState);
  return getStatusText(nextState);
};

const canUpdateState = (order: Order): boolean => {
  // Только владелец заказа может изменять состояние
  return order.userId === authStore.user?.id && ['pending', 'approved', 'in_progress'].includes(order.state);
};

const updateState = async (orderId: number, newState: Order['state']) => {
  try {
    await ordersStore.updateOrderState(orderId, newState);
    await loadOrders();
  } catch (error) {
    // Error handled by store
  }
};

const applyFilters = async () => {
  currentPage.value = 1;
  updateURL();
  await loadOrders();
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

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};
</script>

<style scoped>
.header-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.orders-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.order-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.order-header a {
  text-decoration: none;
  color: inherit;
}

.order-actions {
  display: flex;
  gap: 10px;
  margin-top: 15px;
}

.empty-state {
  text-align: center;
  padding: 40px;
}
</style>
