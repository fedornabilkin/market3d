<template lang="pug">
.container
  Breadcrumbs
  div(v-if="printersStore.loading")
    el-skeleton(:rows="5" animated)
  el-alert(v-else-if="printersStore.error" :title="printersStore.error" type="error")
  el-card(v-else-if="printer")
    template(#header)
      .header-section
        div
          .status-header
            el-tag(:type="getStatusType(printer.state)" style="margin-bottom: 10px") {{ getStatusText(printer.state) }}
          h1 {{ printer.model_name }}
        router-link(v-if="canEdit" :to="`/printers/${printer.id}/edit`")
          el-button(type="primary") Редактировать
    el-descriptions(title="Информация о принтере" :column="2" border)
      el-descriptions-item(label="Производитель") {{ printer.manufacturer }}
      el-descriptions-item(label="Цена за час") {{ printer.price_per_hour }} ₽
      el-descriptions-item(v-if="printer.cluster" label="Кластер")
        router-link(:to="`/clusters/${printer.cluster.id}`") {{ printer.cluster.name }}
      el-descriptions-item(label="Максимальный размер X") {{ printer.maxSizeX ? `${Math.round(printer.maxSizeX)} мм` : 'Не указан' }}
      el-descriptions-item(label="Максимальный размер Y") {{ printer.maxSizeY ? `${Math.round(printer.maxSizeY)} мм` : 'Не указан' }}
      el-descriptions-item(label="Максимальный размер Z") {{ printer.maxSizeZ ? `${Math.round(printer.maxSizeZ)} мм` : 'Не указан' }}
      el-descriptions-item(label="Количество") {{ printer.quantity || 1 }}
      el-descriptions-item(v-if="canEdit && printer.description" label="Описание" :span="2") {{ printer.description }}
      el-descriptions-item(label="Материалы" :span="2")
        div(v-if="printer.materials && printer.materials.length > 0")
          el-tag(
            v-for="material in printer.materials"
            :key="material.id"
            style="margin-right: 5px; margin-top: 5px"
          )
            span {{ material.name }}
            el-button(
              v-if="canEdit"
              @click.stop="removeMaterial(material.id)"
              type="danger"
              link
              size="small"
              style="margin-left: 5px"
            ) ×
        span(v-else) Не указаны
      el-descriptions-item(label="Цвета" :span="2")
        div(v-if="printer.colors && printer.colors.length > 0")
          el-tag(
            v-for="color in printer.colors"
            :key="color.id"
            style="margin-right: 5px; margin-top: 5px"
          )
            span {{ color.name }}
            el-button(
              v-if="canEdit"
              @click.stop="removeColor(color.id)"
              type="danger"
              link
              size="small"
              style="margin-left: 5px"
            ) ×
        span(v-else) Не указаны
    div(v-if="printer.specifications && Object.keys(printer.specifications).length > 0" style="margin-top: 20px")
      h3 Характеристики
      pre {{ JSON.stringify(printer.specifications, null, 2) }}
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { usePrintersStore } from '../stores/printers';
import { useAuthStore } from '../stores/auth';
import { ElMessage, ElMessageBox } from 'element-plus';
import Breadcrumbs from '../components/Breadcrumbs.vue';

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

const removeMaterial = async (materialId: number) => {
  if (!printer.value) return;
  try {
    await ElMessageBox.confirm('Удалить материал?', 'Подтверждение', { type: 'warning' });
    await printersStore.removeMaterials(printer.value.id, [materialId]);
    ElMessage.success('Материал удален');
    await printersStore.fetchPrinterById(printer.value.id);
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error('Не удалось удалить материал');
    }
  }
};

const removeColor = async (colorId: number) => {
  if (!printer.value) return;
  try {
    await ElMessageBox.confirm('Удалить цвет?', 'Подтверждение', { type: 'warning' });
    await printersStore.removeColors(printer.value.id, [colorId]);
    ElMessage.success('Цвет удален');
    await printersStore.fetchPrinterById(printer.value.id);
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error('Не удалось удалить цвет');
    }
  }
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

