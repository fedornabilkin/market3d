<template lang="pug">
.container
  Breadcrumbs
  div(v-if="ordersStore.loading")
    el-skeleton(:rows="10" animated)
  el-alert(v-else-if="ordersStore.error" :title="ordersStore.error" type="error")
  div(v-else-if="ordersStore.currentOrder").order-detail
    el-card.order-info(v-if="ordersStore.currentOrder")
      template(#header)
        .order-header
          div
            h1 Заказ {{ `#${ordersStore.currentOrder.id}` }}
            el-tag(:type="getStatusType(ordersStore.currentOrder.state)") {{ getStatusText(ordersStore.currentOrder.state) }}
          router-link(v-if="canEdit" :to="`/orders/${ordersStore.currentOrder.id}/edit`")
            el-button(type="primary") Редактировать
      el-descriptions(v-if="ordersStore.currentOrder" :column="2" border)
        el-descriptions-item(label="Заказчик")
          span {{ ordersStore.currentOrder.userId }}
          el-icon(v-if="isMyOrder" style="margin-left: 5px; color: #409EFF")
            User
        el-descriptions-item(v-if="ordersStore.currentOrder.clusterName" label="Кластер")
          router-link(:to="`/clusters/${ordersStore.currentOrder.clusterId}`") {{ ordersStore.currentOrder.clusterName }}
        el-descriptions-item(v-if="ordersStore.currentOrder.material" label="Материал")
          el-tag {{ ordersStore.currentOrder.material }}
        el-descriptions-item(v-if="ordersStore.currentOrder.colorName || ordersStore.currentOrder.color" label="Цвет")
          el-tag {{ ordersStore.currentOrder.colorName || ordersStore.currentOrder.color }}
        el-descriptions-item(label="Количество") {{ ordersStore.currentOrder.quantity }}
        el-descriptions-item(label="Стоимость")
          span(v-if="!canSetPrice") {{ ordersStore.currentOrder.totalPrice }} ₽
          el-input-number(
            v-else
            v-model="priceInput"
            :min="0"
            :precision="2"
            style="width: 200px"
            @change="updatePrice"
          )
        el-descriptions-item(v-if="ordersStore.currentOrder.deliveryMethodName" label="Способ доставки") {{ ordersStore.currentOrder.deliveryMethodName }}
        el-descriptions-item(label="Срок выполнения") {{ formatDate(ordersStore.currentOrder.deadline) }}
        el-descriptions-item(label="Создан") {{ formatDate(ordersStore.currentOrder.createdAt) }}
        el-descriptions-item(v-if="ordersStore.currentOrder.description" label="Описание" :span="2") {{ ordersStore.currentOrder.description }}
      div(v-if="ordersStore.currentOrder" style="margin-top: 20px")
        FileUpload(
          :order-id="ordersStore.currentOrder.id"
          :files="orderFiles"
          :can-upload="ordersStore.currentOrder.state === 'draft' && ordersStore.currentOrder.userId === authStore.user?.id"
          :can-download-file="canDownloadFile"
          @file-uploaded="loadFiles"
          @file-removed="loadFiles"
        )
      div(v-if="ordersStore.currentOrder && canUpdateState" style="margin-top: 20px")
        el-button(
          @click="updateState(getNextState(ordersStore.currentOrder.state))"
          type="default"
        ) {{ getNextStateText(ordersStore.currentOrder.state) }}
      div(v-if="ordersStore.currentOrder && ordersStore.currentOrder.state === 'draft' && ordersStore.currentOrder.userId === authStore.user?.id" style="margin-top: 20px")
        el-button(@click="submitOrder" type="success") Отправить в работу
    el-card.messages-section(v-if="canViewMessages" style="margin-top: 20px")
      template(#header)
        h2 Сообщения
      div.messages-list
        el-card(
          v-for="message in ordersStore.messages"
          :key="message.id"
          style="margin-bottom: 10px"
          shadow="hover"
        )
          .message-header
            strong {{ message.senderEmail }}
            span.message-time {{ formatDate(message.createdAt) }}
          .message-body {{ message.message }}
      el-form(v-if="canSendMessage" @submit.prevent="sendMessage" style="margin-top: 20px")
        el-form-item
          el-input(
            v-model="newMessage"
            type="textarea"
            :rows="3"
            placeholder="Введите сообщение..."
          )
        el-form-item
          el-button(type="primary" native-type="submit" :loading="ordersStore.loading") Отправить
      el-alert(v-else-if="ordersStore.currentOrder?.state === 'draft'" type="info" style="margin-top: 20px")
        | Обсуждение недоступно для заказов в статусе "Черновик"
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useOrdersStore } from '../stores/orders';
import { useAuthStore } from '../stores/auth';
import FileUpload from '../components/FileUpload.vue';
import { User } from '@element-plus/icons-vue';
import type { Order, OrderFile } from '../stores/orders';
import Breadcrumbs from '../components/Breadcrumbs.vue';

const route = useRoute();
const ordersStore = useOrdersStore();
const authStore = useAuthStore();

const newMessage = ref('');
const orderFiles = ref<OrderFile[]>([]);
const messagesError = ref('');
const filesError = ref('');
const priceInput = ref<number>(0);

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

const isMyOrder = computed(() => {
  return ordersStore.currentOrder && ordersStore.currentOrder.userId === authStore.user?.id;
});

const canEdit = computed(() => {
  return ordersStore.currentOrder && ordersStore.currentOrder.userId === authStore.user?.id && ordersStore.currentOrder.state === 'draft';
});

const canSetPrice = computed(() => {
  if (!ordersStore.currentOrder || !authStore.user) return false;
  // Исполнитель (владелец кластера) может установить цену на этапе pending
  const isExecutor = (ordersStore.currentOrder as any).clusterOwnerId === authStore.user.id;
  return isExecutor && ordersStore.currentOrder.state === 'pending';
});

const canUpdateState = computed(() => {
  if (!ordersStore.currentOrder) return false;
  return ordersStore.currentOrder.userId === authStore.user?.id && ['pending', 'approved', 'in_progress'].includes(ordersStore.currentOrder.state);
});

const canViewMessages = computed(() => {
  if (!ordersStore.currentOrder) return false;
  // Можно просматривать сообщения, если заказ не в статусе draft
  if (ordersStore.currentOrder.state === 'draft') return false;
  // Автор заказа или автор кластера могут видеть сообщения
  const isOrderAuthor = ordersStore.currentOrder.userId === authStore.user?.id;
  const isClusterOwner = (ordersStore.currentOrder as any).clusterOwnerId === authStore.user?.id;
  return isOrderAuthor || isClusterOwner;
});

const canSendMessage = computed(() => {
  if (!ordersStore.currentOrder) return false;
  // Нельзя отправлять сообщения для заказов в статусе draft
  if (ordersStore.currentOrder.state === 'draft') return false;
  // Автор заказа или автор кластера могут отправлять сообщения
  const isOrderAuthor = ordersStore.currentOrder.userId === authStore.user?.id;
  const isClusterOwner = (ordersStore.currentOrder as any).clusterOwnerId === authStore.user?.id;
  return isOrderAuthor || isClusterOwner;
});

const canDownloadFile = (file: OrderFile): boolean => {
  if (!ordersStore.currentOrder) return false;
  // Автор заказа всегда может скачивать
  const isOrderAuthor = ordersStore.currentOrder.userId === authStore.user?.id;
  if (isOrderAuthor) return true;
  // Автор кластера может скачивать, если заказ в статусе in_progress
  const isClusterOwner = (ordersStore.currentOrder as any).clusterOwnerId === authStore.user?.id;
  return isClusterOwner && ordersStore.currentOrder.state === 'in_progress';
};

const updateState = async (newState: Order['state']) => {
  if (!ordersStore.currentOrder) return;
  try {
    await ordersStore.updateOrderState(ordersStore.currentOrder.id, newState);
  } catch (error) {
    // Error handled by store
  }
};

const submitOrder = async () => {
  if (!ordersStore.currentOrder) return;
  try {
    await ordersStore.submitOrder(ordersStore.currentOrder.id);
  } catch (error) {
    // Error handled by store
  }
};

const sendMessage = async () => {
  if (!newMessage.value.trim() || !ordersStore.currentOrder) return;
  try {
    await ordersStore.sendMessage(ordersStore.currentOrder.id, newMessage.value);
    newMessage.value = '';
  } catch (error) {
    // Error handled by store
  }
};

const loadFiles = async () => {
  if (!ordersStore.currentOrder) return;
  try {
    orderFiles.value = await ordersStore.fetchFiles(ordersStore.currentOrder.id);
    filesError.value = '';
  } catch (error: any) {
    filesError.value = error.response?.data?.error || 'Не удалось загрузить файлы';
    console.error('Failed to load files:', error);
  }
};

const updatePrice = async () => {
  if (!ordersStore.currentOrder || !priceInput.value) return;
  try {
    await ordersStore.updateOrder(ordersStore.currentOrder.id, {
      totalPrice: priceInput.value,
    });
  } catch (error) {
    console.error('Failed to update price:', error);
  }
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

onMounted(async () => {
  const orderId = parseInt(route.params.id as string);
  await ordersStore.fetchOrderById(orderId);
  if (ordersStore.currentOrder) {
    priceInput.value = ordersStore.currentOrder.totalPrice || 0;
  }
  await loadFiles();
  // Загружаем сообщения только если можно их просматривать
  if (canViewMessages.value) {
    try {
      await ordersStore.fetchMessages(orderId);
    } catch (error) {
      messagesError.value = 'Не удалось загрузить сообщения';
    }
  }
});
</script>

<style scoped>
.order-detail {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.order-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.messages-list {
  max-height: 400px;
  overflow-y: auto;
  margin-bottom: 20px;
}

.message-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 5px;
}

.message-time {
  color: #666;
  font-size: 12px;
}

.message-body {
  color: #333;
}
</style>
