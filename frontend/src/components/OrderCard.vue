<template lang="pug">
el-card.order-card(:class="{ 'my-order': isMine }" style="margin-bottom: 20px" @click="goToOrder")
  template(#header)
    .card-header
      router-link(:to="`/orders/${order.id}`")
        h3 Заказ {{ `#${order.id}` }}
      el-icon.my-icon(v-if="isMine" style="color: #409EFF; margin-left: 8px")
        User
  .card-content
    p
      strong Материал: 
      | {{ order.material }}
    p(v-if="order.colorName || order.color")
      strong Цвет: 
      | {{ order.colorName || order.color }}
    p
      strong Количество: 
      | {{ order.quantity }}
    p
      strong Статус: 
      el-tag(:type="getStatusType(order.state)") {{ getStatusText(order.state) }}
    p
      strong Создан: 
      | {{ formatDate(order.createdAt) }}
    p(v-if="order.completedAt")
      strong Завершен: 
      | {{ formatDate(order.completedAt) }}
    p(v-if="order.deadline")
      strong Срок: 
      | {{ formatDate(order.deadline) }}
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { User } from '@element-plus/icons-vue';

interface Order {
  id: number;
  userId: number;
  material: string;
  color?: string;
  colorName?: string;
  quantity: number;
  state: 'draft' | 'pending' | 'approved' | 'in_progress' | 'completed' | 'cancelled';
  createdAt: string;
  completedAt?: string;
  deadline?: string;
}

interface Props {
  order: Order;
  userId?: number;
}

const props = defineProps<Props>();
const router = useRouter();

const isMine = computed(() => {
  return props.userId !== undefined && props.order.userId === props.userId;
});

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

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const goToOrder = () => {
  router.push(`/orders/${props.order.id}`);
};
</script>

<style scoped>
.order-card {
  cursor: pointer;
  transition: all 0.3s;
}

.order-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.order-card.my-order {
  /*border: 2px solid #409EFF;*/
}

.card-header {
  display: flex;
  align-items: center;
}

.card-content {
  margin-top: 10px;
}

.card-content p {
  margin: 8px 0;
}
</style>
