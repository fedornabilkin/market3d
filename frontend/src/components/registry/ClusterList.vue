<template lang="pug">
div
  div(v-if="loading")
    el-skeleton(:rows="5" animated)
  el-alert(v-else-if="error" :title="error" type="error")
  div(v-else-if="clusters.length === 0").empty-state
    p Кластеры не найдены
  div(v-else)
    el-row(:gutter="20")
      el-col(v-for="cluster in clusters" :key="cluster.id" :span="8" :xs="24" :sm="12" :md="8")
        ClusterCard(:cluster="cluster" :userId="userId")
</template>

<script setup lang="ts">
import ClusterCard from './ClusterCard.vue';
import type { Cluster } from '../types/cluster';

interface Props {
  clusters: Array<Cluster & {
    completedOrdersCount?: number;
    uniqueMaterials?: Array<{ id: number; name: string }>;
  }>;
  loading?: boolean;
  error?: string | null;
  userId?: number;
}

withDefaults(defineProps<Props>(), {
  loading: false,
  error: null,
});
</script>

<style scoped>
.empty-state {
  text-align: center;
  padding: 40px;
}

.empty-state p {
  margin-bottom: 20px;
  color: #666;
}
</style>
