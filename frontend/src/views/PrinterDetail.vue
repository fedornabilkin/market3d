<template lang="pug">
.container
  div(v-if="printersStore.loading")
    el-skeleton(:rows="5" animated)
  el-alert(v-else-if="printersStore.error" :title="printersStore.error" type="error")
  el-card(v-else-if="printer")
    template(#header)
      .header-section
        h1 {{ printer.model_name }}
        router-link(v-if="canEdit" :to="`/printers/${printer.id}/edit`")
          el-button(type="primary") Редактировать
    el-descriptions(title="Информация о принтере" :column="2" border)
      el-descriptions-item(label="Производитель") {{ printer.manufacturer }}
      el-descriptions-item(label="Цена за час") {{ printer.price_per_hour }} ₽
      el-descriptions-item(label="Статус")
        el-tag(:type="getStatusType(printer.state)") {{ getStatusText(printer.state) }}
      el-descriptions-item(v-if="printer.cluster" label="Кластер")
        router-link(:to="`/clusters/${printer.cluster.id}`") {{ printer.cluster.name }}
      el-descriptions-item(label="Материалы")
        span(v-if="printer.materials && printer.materials.length > 0") {{ printer.materials.join(', ') }}
        span(v-else) Не указаны
    div(v-if="printer.specifications && Object.keys(printer.specifications).length > 0" style="margin-top: 20px")
      h3 Характеристики
      pre {{ JSON.stringify(printer.specifications, null, 2) }}
    div(v-if="printer.maxBuildVolume && Object.keys(printer.maxBuildVolume).length > 0" style="margin-top: 20px")
      h3 Максимальный объем печати
      pre {{ JSON.stringify(printer.maxBuildVolume, null, 2) }}
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { usePrintersStore } from '../stores/printers';
import { useAuthStore } from '../stores/auth';

const route = useRoute();
const printersStore = usePrintersStore();
const authStore = useAuthStore();

const printer = computed(() => printersStore.currentPrinter);

const canEdit = computed(() => {
  return printer.value && printer.value.userId === authStore.user?.id;
});

const getStatusText = (status: string): string => {
  const statusMap: Record<string, string> = {
    available: 'Доступен',
    busy: 'Занят',
    maintenance: 'На обслуживании',
    inactive: 'Неактивен',
  };
  return statusMap[status] || status;
};

const getStatusType = (status: string): 'success' | 'warning' | 'danger' | 'info' => {
  const typeMap: Record<string, 'success' | 'warning' | 'danger' | 'info'> = {
    available: 'success',
    busy: 'warning',
    maintenance: 'warning',
    inactive: 'danger',
  };
  return typeMap[status] || 'info';
};

onMounted(async () => {
  const id = parseInt(route.params.id as string);
  await printersStore.fetchPrinterById(id);
});
</script>

<style scoped>
.header-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>

