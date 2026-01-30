<template lang="pug">
.container
  Breadcrumbs
  div(v-if="clustersStore.loading")
    el-skeleton(:rows="10" animated)
  el-alert(v-else-if="clustersStore.error" :title="clustersStore.error" type="error")
  div(v-else-if="cluster").cluster-detail
    el-card.cluster-info
      template(#header)
        .header-section
          div
            .status-header
              el-tag(:type="getStatusType(cluster.state)" style="margin-bottom: 10px") {{ getStatusText(cluster.state) }}
            h1 {{ cluster.name }}
            p(v-if="cluster.description" style="margin-top: 10px; color: #666") {{ cluster.description }}
          div
            router-link(v-if="canEdit" :to="`/clusters/${cluster.id}/edit`")
              el-button(type="primary") Редактировать
            el-button(
              v-if="canEdit && cluster.state === 'draft'"
              @click="handleActivate"
              type="success"
              style="margin-left: 10px"
            ) Активировать
            el-button(
              v-if="canEdit && cluster.state !== 'archived'"
              @click="handleArchive"
              type="warning"
              style="margin-left: 10px"
            ) Архивировать
            router-link(
              v-if="!canEdit && cluster.state === 'active' && authStore.isAuthenticated"
              :to="`/orders/create?clusterId=${cluster.id}`"
            )
              el-button(type="success" style="margin-left: 10px") Создать заказ
            router-link(
              v-if="!canEdit && cluster.state === 'active' && !authStore.isAuthenticated"
              to="/login"
            )
              el-button(type="primary" style="margin-left: 10px") Войти
    el-card.cluster-info(style="margin-top: 20px")
      el-descriptions(:column="2" border)
        el-descriptions-item(label="Регион") {{ cluster.regionName }}
        el-descriptions-item(label="Город") {{ cluster.cityName }}
        el-descriptions-item(v-if="cluster.metroName" label="Метро") {{ cluster.metroName }}
        el-descriptions-item(label="Автор") 
          span {{ cluster.userEmail }}
          span(v-if="cluster.ownerLastActivityAt" style="margin-left: 10px; color: #999; font-size: 12px")
            | (активен: {{ formatLastActivity(cluster.ownerLastActivityAt) }})
        el-descriptions-item(label="Принтеров") {{ totalPrintersCount }}
        el-descriptions-item(label="Доступно") {{ cluster.availablePrintersCount || 0 }}
        el-descriptions-item(label="Завершенных заказов") {{ cluster.completedOrdersCount || 0 }}
        el-descriptions-item(v-if="cluster.parentClusterName" label="Родительский кластер")
          router-link(:to="`/clusters/${cluster.parentClusterId}`") {{ cluster.parentClusterName }}
        el-descriptions-item(v-if="cluster.uniqueMaterials && cluster.uniqueMaterials.length > 0" label="Материалы" :span="2")
          el-tag(
            v-for="material in cluster.uniqueMaterials"
            :key="material.id"
            style="margin-right: 5px; margin-top: 5px"
          ) {{ material.name }}
        el-descriptions-item(v-if="cluster.uniqueColors && cluster.uniqueColors.length > 0" label="Цвета" :span="2")
          el-tag(
            v-for="color in cluster.uniqueColors"
            :key="color.id"
            style="margin-right: 5px; margin-top: 5px"
          ) {{ color.name }}
        el-descriptions-item(v-if="cluster.deliveryMethods && cluster.deliveryMethods.length > 0" label="Способы доставки" :span="2")
          el-tag(
            v-for="method in cluster.deliveryMethods"
            :key="method.id"
            style="margin-right: 5px; margin-top: 5px"
          ) {{ method.name }}
    
    el-card.printers-section(style="margin-top: 20px")
      template(#header)
        h2 Привязанные принтеры
      div(v-if="clusterPrintersStore.loading")
        el-skeleton(:rows="3" animated)
      el-alert(v-else-if="clusterPrintersStore.error" :title="clusterPrintersStore.error" type="error")
      div(v-else-if="printers.length === 0").empty-state
        p Принтеры не привязаны
      el-table(v-else :data="printers" row-key="printerId" class="draggable-table")
        el-table-column(label="Принтер")
          template(#default="{ row }")
            router-link(:to="`/printers/${row.printerId}`")
              | {{ row.printer.manufacturer }} {{ row.printer.modelName }}
        el-table-column(label="Количество")
          template(#default="{ row }")
            | {{ row.printer.quantity || 1 }}
        el-table-column(prop="printer.pricePerHour" label="Цена за час")
        el-table-column(prop="printer.state" label="Статус")
          template(#default="{ row }")
            el-tag(:type="getPrinterStatusType(row.printer.state)") {{ getPrinterStatusText(row.printer.state) }}
        el-table-column(label="Материалы")
          template(#default="{ row }")
            el-tag(
              v-for="material in row.printer.materials || []"
              :key="material.id"
              size="small"
              style="margin-right: 5px; margin-top: 5px"
            ) {{ material.name }}
        el-table-column(label="Цвета")
          template(#default="{ row }")
            el-tag(
              v-for="color in row.printer.colors || []"
              :key="color.id"
              size="small"
              style="margin-right: 5px; margin-top: 5px"
            ) {{ color.name }}
    
    el-card.available-printers-section(v-if="canEdit" style="margin-top: 20px")
      template(#header)
        h2 Мои доступные принтеры
      div(v-if="printersStore.loading")
        el-skeleton(:rows="3" animated)
      el-alert(v-else-if="printersStore.error" :title="printersStore.error" type="error")
      div(v-else-if="availablePrinters.length === 0").empty-state
        p Нет доступных принтеров для привязки
      el-table(v-else :data="availablePrinters" row-key="id" class="draggable-table")
        el-table-column(label="Принтер")
          template(#default="{ row }")
            router-link(:to="`/printers/${row.id}`")
              | {{ row.manufacturer }} {{ row.model_name }}
        el-table-column(label="Количество")
          template(#default="{ row }")
            | {{ row.quantity || 1 }}
        el-table-column(prop="price_per_hour" label="Цена за час")
        el-table-column(prop="state" label="Статус")
          template(#default="{ row }")
            el-tag(:type="getPrinterStatusType(row.state)") {{ getPrinterStatusText(row.state) }}
        el-table-column(label="Материалы")
          template(#default="{ row }")
            el-tag(
              v-for="material in row.materials || []"
              :key="material.id"
              size="small"
              style="margin-right: 5px; margin-top: 5px"
            ) {{ material.name }}
        el-table-column(label="Цвета")
          template(#default="{ row }")
            el-tag(
              v-for="color in row.colors || []"
              :key="color.id"
              size="small"
              style="margin-right: 5px; margin-top: 5px"
            ) {{ color.name }}
        el-table-column(label="Действия")
          template(#default="{ row }")
            el-button(
              @click="handleAttach(row.id)"
              size="small"
              type="primary"
            ) Привязать
    
    el-card.other-printers-section(v-if="otherPrinters.length > 0" style="margin-top: 20px")
      template(#header)
        h2 Другие активные принтеры
      div(v-if="otherPrintersLoading")
        el-skeleton(:rows="3" animated)
      el-table(v-else :data="otherPrinters")
        el-table-column(label="Принтер")
          template(#default="{ row }")
            router-link(:to="`/printers/${row.id}`")
              | {{ row.manufacturer }} {{ row.model_name }}
        el-table-column(prop="price_per_hour" label="Цена за час")
        el-table-column(prop="state" label="Статус")
          template(#default="{ row }")
            el-tag(:type="getPrinterStatusType(row.state)") {{ getPrinterStatusText(row.state) }}
        el-table-column(label="Материалы")
          template(#default="{ row }")
            el-tag(
              v-for="material in row.materials || []"
              :key="material.id"
              size="small"
              style="margin-right: 5px; margin-top: 5px"
            ) {{ material.name }}
        el-table-column(label="Цвета")
          template(#default="{ row }")
            el-tag(
              v-for="color in row.colors || []"
              :key="color.id"
              size="small"
              style="margin-right: 5px; margin-top: 5px"
            ) {{ color.name }}
    
    el-card.requests-section(v-if="canEdit && activeRequests.length > 0" style="margin-top: 20px")
      template(#header)
        h2 Запросы на привязку
      div(v-if="requestsStore.loading")
        el-skeleton(:rows="3" animated)
      el-alert(v-else-if="requestsStore.error" :title="requestsStore.error" type="error")
      el-table(v-else :data="activeRequests")
        el-table-column(prop="printerModelName" label="Принтер")
        el-table-column(prop="printerOwnerEmail" label="Владелец")
        el-table-column(prop="status" label="Статус")
          template(#default="{ row }")
            el-tag(:type="getRequestStatusType(row.status)") {{ getRequestStatusText(row.status) }}
        el-table-column(prop="message" label="Сообщение")
        el-table-column(label="Действия")
          template(#default="{ row }")
            el-button(
              v-if="row.status === 'pending'"
              @click="handleCancelRequest(row.id)"
              size="small"
              type="warning"
            ) Отменить
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useClustersStore } from '../stores/clusters';
import { useClusterPrintersStore } from '../stores/clusterPrinters';
import { useClusterPrinterRequestsStore } from '../stores/clusterPrinterRequests';
import { usePrintersStore } from '../stores/printers';
import { useAuthStore } from '../stores/auth';
import { ElMessage, ElMessageBox } from 'element-plus';
import Breadcrumbs from '../components/Breadcrumbs.vue';

const route = useRoute();
const router = useRouter();
const clustersStore = useClustersStore();
const clusterPrintersStore = useClusterPrintersStore();
const requestsStore = useClusterPrinterRequestsStore();
const printersStore = usePrintersStore();
const authStore = useAuthStore();

const cluster = computed(() => clustersStore.currentCluster);
const printers = ref([]);
const requests = ref([]);
const availablePrinters = ref([]);
const otherPrinters = ref([]);
const otherPrintersLoading = ref(false);

const totalPrintersCount = computed(() => {
  if (!printers.value || printers.value.length === 0) return 0;
  return printers.value.reduce((sum: number, p: any) => {
    return sum + (p.printer?.quantity || 1);
  }, 0);
});

const canEdit = computed(() => {
  return authStore.isAuthenticated && cluster.value && cluster.value.userId === authStore.user?.id;
});

const getStatusText = (status: string): string => {
  const statusMap: Record<string, string> = {
    draft: 'Черновик',
    active: 'Активен',
    inactive: 'Неактивен',
    archived: 'Архив',
  };
  return statusMap[status] || status;
};

const getStatusType = (status: string): 'success' | 'warning' | 'danger' | 'info' => {
  const typeMap: Record<string, 'success' | 'warning' | 'danger' | 'info'> = {
    draft: 'info',
    active: 'success',
    inactive: 'warning',
    archived: 'danger',
  };
  return typeMap[status] || 'info';
};

const getPrinterStatusText = (status: string): string => {
  const statusMap: Record<string, string> = {
    available: 'Доступен',
    busy: 'Занят',
    maintenance: 'На обслуживании',
    inactive: 'Неактивен',
  };
  return statusMap[status] || status;
};

const getPrinterStatusType = (status: string): 'success' | 'warning' | 'danger' | 'info' => {
  const typeMap: Record<string, 'success' | 'warning' | 'danger' | 'info'> = {
    available: 'success',
    busy: 'warning',
    maintenance: 'warning',
    inactive: 'danger',
  };
  return typeMap[status] || 'info';
};

const getRequestStatusText = (status: string): string => {
  const statusMap: Record<string, string> = {
    pending: 'Ожидает',
    approved: 'Одобрен',
    rejected: 'Отклонен',
    cancelled: 'Отменен',
  };
  return statusMap[status] || status;
};

const getRequestStatusType = (status: string): 'success' | 'warning' | 'danger' | 'info' => {
  const typeMap: Record<string, 'success' | 'warning' | 'danger' | 'info'> = {
    pending: 'warning',
    approved: 'success',
    rejected: 'danger',
    cancelled: 'info',
  };
  return typeMap[status] || 'info';
};

const formatLastActivity = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'только что';
  if (diffMins < 60) return `${diffMins} мин. назад`;
  if (diffHours < 24) return `${diffHours} ч. назад`;
  if (diffDays < 7) return `${diffDays} дн. назад`;
  return date.toLocaleDateString('ru-RU');
};

const handleActivate = async () => {
  try {
    await ElMessageBox.confirm(
      'Активировать кластер? Кластер должен иметь хотя бы один принтер.',
      'Активация кластера',
      { type: 'warning' }
    );
    await clustersStore.activateCluster(cluster.value!.id);
    ElMessage.success('Кластер активирован');
    await loadCluster();
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.response?.data?.error || 'Не удалось активировать кластер');
    }
  }
};

const handleArchive = async () => {
  try {
    await ElMessageBox.confirm('Архивировать кластер?', 'Архивирование', { type: 'warning' });
    await clustersStore.archiveCluster(cluster.value!.id);
    ElMessage.success('Кластер архивирован');
    router.push('/clusters');
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.response?.data?.error || 'Не удалось архивировать кластер');
    }
  }
};

const handleDetach = async (printerId: number) => {
  try {
    await ElMessageBox.confirm('Отвязать принтер от кластера?', 'Отвязка принтера', { type: 'warning' });
    await clusterPrintersStore.detachPrinter(cluster.value!.id, printerId);
    ElMessage.success('Принтер отвязан');
    await loadPrinters();
    await loadCluster();
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.response?.data?.error || 'Не удалось отвязать принтер');
    }
  }
};

const handleAttach = async (printerId: number) => {
  try {
    await clusterPrintersStore.attachPrinter(cluster.value!.id, printerId);
    ElMessage.success('Принтер привязан');
    availablePrinters.value = availablePrinters.value.filter((p: any) => p.id !== printerId);
    await loadPrinters();
    await loadCluster();
    await loadOtherPrinters();
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || 'Не удалось привязать принтер');
  }
};

const handleCancelRequest = async (requestId: number) => {
  try {
    await requestsStore.cancelRequest(requestId);
    ElMessage.success('Запрос отменен');
    await loadRequests();
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || 'Не удалось отменить запрос');
  }
};

const loadCluster = async () => {
  const id = parseInt(route.params.id as string);
  await clustersStore.fetchClusterById(id);
};

const loadPrinters = async () => {
  try {
    const id = parseInt(route.params.id as string);
    printers.value = await clusterPrintersStore.fetchClusterPrinters(id);
  } catch (error) {
    console.error('Failed to load printers:', error);
  }
};

const loadRequests = async () => {
  if (!canEdit.value) return;
  try {
    const id = parseInt(route.params.id as string);
    requests.value = await requestsStore.fetchClusterRequests(id);
  } catch (error) {
    console.error('Failed to load requests:', error);
  }
};

const activeRequests = computed(() => {
  return requests.value.filter((r: any) => r.status === 'pending');
});

const loadAvailablePrinters = async () => {
  try {
    const result = await printersStore.fetchPrinters({ userId: authStore.user?.id, clusterId: 0, state: 'available' });
    availablePrinters.value = result.data || [];
  } catch (error) {
    console.error('Failed to load available printers:', error);
  }
};

const loadOtherPrinters = async () => {
  if (!cluster.value) return;
  otherPrintersLoading.value = true;
  try {
    // Получаем список всех активных принтеров, не привязанных к кластеру
    const allPrintersResult = await printersStore.fetchPrinters({ state: 'available', clusterId: 0 });
    const allPrinters = allPrintersResult.data || [];
    
    // Получаем список ID привязанных принтеров
    const attachedPrinterIds = printers.value.map((p: any) => p.printerId);
    
    // Фильтруем: только чужие принтеры (не мои), не привязанные к кластеру
    otherPrinters.value = allPrinters.filter((p: any) => 
      p.userId !== authStore.user?.id && !attachedPrinterIds.includes(p.id)
    );
  } catch (error) {
    console.error('Failed to load other printers:', error);
  } finally {
    otherPrintersLoading.value = false;
  }
};

onMounted(async () => {
  await loadCluster();
  await loadPrinters();
  await loadRequests();
  if (canEdit.value) {
    await loadAvailablePrinters();
  }
  if (authStore.isAuthenticated) {
    await loadOtherPrinters();
  }
});
</script>

<style scoped>
.header-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.empty-state {
  text-align: center;
  padding: 40px;
}

.empty-state p {
  color: #666;
}
</style>


