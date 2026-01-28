<template lang="pug">
el-card.printer-card(:class="{ 'my-printer': isMine }" style="margin-bottom: 20px" @click="goToPrinter")
  template(#header)
    .card-header
      router-link(:to="`/printers/${printer.id}`")
        h3 {{ printer.model_name }}
      el-icon.my-icon(v-if="isMine" style="color: #409EFF; margin-left: 8px")
        User
  .card-content
    p
      strong Производитель: 
      | {{ printer.manufacturer }}
    p
      strong Цена за час: 
      | {{ printer.price_per_hour }} ₽
    p
      strong Статус: 
      el-tag(:type="getStatusType(printer.state)") {{ getStatusText(printer.state) }}
    div(v-if="printer.materials && printer.materials.length > 0" style="margin-top: 10px")
      strong Материалы: 
      el-tag(
        v-for="material in printer.materials"
        :key="material.id"
        style="margin-left: 5px; margin-top: 5px"
        size="small"
      ) {{ material.name }}
    div(v-if="printer.colors && printer.colors.length > 0" style="margin-top: 10px")
      strong Цвета: 
      el-tag(
        v-for="color in printer.colors"
        :key="color.id"
        style="margin-left: 5px; margin-top: 5px"
        size="small"
      ) {{ color.name }}
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { User } from '@element-plus/icons-vue';

interface Material {
  id: number;
  name: string;
  dictionaryId?: number;
}

interface Printer {
  id: number;
  model_name: string;
  manufacturer: string;
  price_per_hour: number;
  state: string;
  userId: number;
  materials?: Material[];
}

interface Props {
  printer: Printer;
  userId?: number;
}

const props = defineProps<Props>();
const router = useRouter();

const isMine = computed(() => {
  return props.userId !== undefined && props.printer.userId === props.userId;
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

const goToPrinter = () => {
  router.push(`/printers/${props.printer.id}`);
};
</script>

<style scoped>
.printer-card {
  cursor: pointer;
  transition: all 0.3s;
}

.printer-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.printer-card.my-printer {
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
