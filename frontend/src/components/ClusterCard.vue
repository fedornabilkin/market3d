<template lang="pug">
el-card.cluster-card(:class="{ 'my-cluster': isMine }" style="margin-bottom: 20px" @click="goToCluster")
  template(#header)
    .card-header
      router-link(:to="`/clusters/${cluster.id}`")
        h3 {{ cluster.name }}
      el-icon.my-icon(v-if="isMine" style="color: #409EFF; margin-left: 8px")
        User
  .card-content
    p
      strong Регион: 
      | {{ cluster.regionName }}
    p
      strong Город: 
      | {{ cluster.cityName }}
    p(v-if="cluster.metroName")
      strong Метро: 
      | {{ cluster.metroName }}
    p
      strong Принтеров: 
      | {{ cluster.printersCount || 0 }}
    p
      strong Завершенных заказов: 
      | {{ cluster.completedOrdersCount || 0 }}
    p
      el-tag(:type="getStatusType(cluster.state)") {{ getStatusText(cluster.state) }}
    
    div(v-if="cluster.uniqueMaterials && cluster.uniqueMaterials.length > 0" style="margin-top: 10px")
      el-tag(
        v-for="material in cluster.uniqueMaterials"
        :key="material.id"
        style="margin: 5px"
        size="small"
      ) {{ material.name }}
    hr
    div(v-if="cluster.uniqueColors && cluster.uniqueColors.length > 0" style="margin-top: 10px")
      el-tag(
        v-for="color in cluster.uniqueColors"
        :key="color.id"
        style="margin-left: 5px; margin-top: 5px"
        size="small"
      ) {{ color.name }}
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { User } from '@element-plus/icons-vue';
import type { Cluster } from '../types/cluster';

interface Props {
  cluster: Cluster & {
    completedOrdersCount?: number;
    uniqueMaterials?: Array<{ id: number; name: string }>;
  };
  userId?: number;
}

const props = defineProps<Props>();
const router = useRouter();

const isMine = computed(() => {
  return props.userId !== undefined && props.cluster.userId === props.userId;
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

const goToCluster = () => {
  router.push(`/clusters/${props.cluster.id}`);
};
</script>

<style scoped>
.cluster-card {
  cursor: pointer;
  transition: all 0.3s;
}

.cluster-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.cluster-card.my-cluster {
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
