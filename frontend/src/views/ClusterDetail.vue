<template lang="pug">
.container
  div(v-if="clustersStore.loading")
    el-skeleton(:rows="10" animated)
  el-alert(v-else-if="clustersStore.error" :title="clustersStore.error" type="error")
  div(v-else-if="cluster").cluster-detail
    el-card.cluster-info
      template(#header)
        .header-section
          div
            h1 {{ cluster.name }}
            el-tag(:type="getStatusType(cluster.state)") {{ getStatusText(cluster.state) }}
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
              v-if="!canEdit && cluster.state === 'active'"
              :to="`/orders/create?clusterId=${cluster.id}`"
            )
              el-button(type="success" style="margin-left: 10px") Создать заказ
      el-descriptions(:column="2" border)
        el-descriptions-item(label="Автор") {{ cluster.userEmail }}
        el-descriptions-item(label="Регион") {{ cluster.regionName }}
        el-descriptions-item(label="Город") {{ cluster.cityName }}
        el-descriptions-item(v-if="cluster.metroName" label="Метро") {{ cluster.metroName }}
        el-descriptions-item(label="Принтеров") {{ cluster.printersCount || 0 }}
        el-descriptions-item(label="Доступно") {{ cluster.availablePrintersCount || 0 }}
        el-descriptions-item(label="Завершенных заказов") {{ cluster.completedOrdersCount || 0 }}
        el-descriptions-item(v-if="cluster.parentClusterName" label="Родительский кластер")
          router-link(:to="`/clusters/${cluster.parentClusterId}`") {{ cluster.parentClusterName }}
        el-descriptions-item(v-if="cluster.description" label="Описание" :span="2") {{ cluster.description }}
        el-descriptions-item(v-if="cluster.uniqueMaterials && cluster.uniqueMaterials.length > 0" label="Материалы" :span="2")
          el-tag(
            v-for="material in cluster.uniqueMaterials"
            :key="material.id"
            style="margin-right: 5px; margin-top: 5px"
          ) {{ material.name }}
    
    el-card.printers-section(style="margin-top: 20px")
      template(#header)
        .header-section
          h2 Принтеры
          el-button(
            v-if="canEdit"
            :disabled="availablePrinters.length === 0"
            @click="showAttachDialog = true"
            type="primary"
          ) Привязать принтер
      div(v-if="clusterPrintersStore.loading")
        el-skeleton(:rows="3" animated)
      el-alert(v-else-if="clusterPrintersStore.error" :title="clusterPrintersStore.error" type="error")
      div(v-else-if="printers.length === 0").empty-state
        p Принтеры не привязаны
      el-table(v-else :data="printers")
        el-table-column(prop="printer.modelName" label="Модель")
        el-table-column(prop="printer.manufacturer" label="Производитель")
        el-table-column(prop="printer.pricePerHour" label="Цена за час")
        el-table-column(prop="printer.state" label="Статус")
          template(#default="{ row }")
            el-tag(:type="getPrinterStatusType(row.printer.state)") {{ getPrinterStatusText(row.printer.state) }}
        el-table-column(label="Действия")
          template(#default="{ row }")
            router-link(:to="`/printers/${row.printerId}`")
              el-button(size="small") Просмотр
            el-button(
              v-if="canEdit || row.printer.userId === authStore.user?.id"
              @click="handleDetach(row.printerId)"
              size="small"
              type="danger"
              style="margin-left: 10px"
            ) Отвязать
    
    el-card.requests-section(v-if="canEdit" style="margin-top: 20px")
      template(#header)
        h2 Запросы на привязку
      div(v-if="requestsStore.loading")
        el-skeleton(:rows="3" animated)
      el-alert(v-else-if="requestsStore.error" :title="requestsStore.error" type="error")
      div(v-else-if="requests.length === 0").empty-state
        p Запросов нет
      el-table(v-else :data="requests")
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

    el-dialog(v-model="showAttachDialog" title="Привязать принтер" width="500px")
      el-form(@submit.prevent="handleAttach")
        el-form-item(label="Выберите принтер")
          el-select(v-model="selectedPrinterId" placeholder="Выберите принтер" style="width: 100%")
            el-option(
              v-for="printer in availablePrinters"
              :key="printer.id"
              :label="`${printer.manufacturer} | ${printer.model_name}`"
              :value="printer.id"
            )
        el-form-item
          el-button(type="primary" native-type="submit" :loading="clusterPrintersStore.loading") Привязать
          el-button(@click="showAttachDialog = false") Отмена
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
const showAttachDialog = ref(false);
const selectedPrinterId = ref(null);

const canEdit = computed(() => {
  return cluster.value && cluster.value.userId === authStore.user?.id;
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

const handleAttach = async () => {
  if (!selectedPrinterId.value) {
    ElMessage.warning('Выберите принтер');
    return;
  }
  try {
    await clusterPrintersStore.attachPrinter(cluster.value!.id, selectedPrinterId.value);
    ElMessage.success('Принтер привязан');
    availablePrinters.value = availablePrinters.value.filter((p: any) => p.id !== selectedPrinterId.value);
    showAttachDialog.value = false;
    selectedPrinterId.value = null;
    await loadPrinters();
    await loadCluster();
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

const loadAvailablePrinters = async () => {
  try {
    const result = await printersStore.fetchPrinters({ userId: authStore.user?.id, clusterId: 0 });
    availablePrinters.value = result.data || [];
  } catch (error) {
    console.error('Failed to load available printers:', error);
  }
};

onMounted(async () => {
  await loadCluster();
  await loadPrinters();
  await loadRequests();
  if (canEdit.value) {
    await loadAvailablePrinters();
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


