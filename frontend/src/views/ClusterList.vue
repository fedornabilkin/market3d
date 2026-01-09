<template lang="pug">
.container
  el-card
    template(#header)
      .header-section
        h2 Активные кластеры
        router-link(v-if="authStore.isAuthenticated" to="/clusters/create")
          el-button(type="primary") Создать
    ClusterFilter(
      :filters="filters"
      :loading="dictionariesStore.loading"
      @update:filters="handleFilterUpdate"
    )
    div(v-if="clustersStore.loading")
      el-skeleton(:rows="5" animated)
    el-alert(v-else-if="clustersStore.error" :title="clustersStore.error" type="error")
    ClusterList(
      v-else
      :clusters="clusters"
      :loading="clustersStore.loading"
      :error="clustersStore.error"
      :userId="authStore.user?.id"
    )
    Pagination(
      v-if="pagination.total > pagination.limit"
      :current-page="pagination.page"
      :total="pagination.total"
      :page-size="pagination.limit"
      @page-change="handlePageChange"
    )
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useClustersStore } from '../stores/clusters';
import { useDictionariesStore } from '../stores/dictionaries';
import { useAuthStore } from '../stores/auth';
import { ElMessage } from 'element-plus';
import ClusterFilter from '../components/ClusterFilter.vue';
import ClusterList from '../components/ClusterList.vue';
import Pagination from '../components/Pagination.vue';

const route = useRoute();
const clustersStore = useClustersStore();
const dictionariesStore = useDictionariesStore();
const authStore = useAuthStore();

const clusters = ref([]);

const filters = reactive({
  state: 'active' as string | undefined,
  regionId: null as number | null,
  cityId: null as number | null,
});

const pagination = reactive({
  page: 1,
  limit: 20,
  total: 0,
});

const handleFilterUpdate = async (newFilters: typeof filters) => {
  Object.assign(filters, newFilters);
  pagination.page = 1;
  await loadClusters();
};

const handlePageChange = async (page: number) => {
  pagination.page = page;
  await loadClusters();
};

const loadClusters = async () => {
  try {
    const params: any = {
      page: pagination.page,
      limit: pagination.limit,
    };
    if (filters.state) params.state = filters.state;
    if (filters.regionId) params.regionId = filters.regionId;
    if (filters.cityId) params.cityId = filters.cityId;

    const result = await clustersStore.fetchClusters(params);
    clusters.value = result.data || result;
    if (result.total !== undefined) {
      pagination.total = result.total;
    }
  } catch (error) {
    ElMessage.error('Не удалось загрузить кластеры');
  }
};

onMounted(async () => {
  if (route.query.regionId) {
    filters.regionId = parseInt(route.query.regionId as string);
  }
  if (route.query.cityId) {
    filters.cityId = parseInt(route.query.cityId as string);
  }
  if (route.query.state) {
    filters.state = route.query.state as string;
  }
  await loadClusters();
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


