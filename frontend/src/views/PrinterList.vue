<template lang="pug">
.container
  el-card
    template(#header)
      .header-section
        h2 Принтеры
        router-link(to="/printers/register")
          el-button(type="primary") Создать
    PrinterFilter(:filters="filters" @update:filters="handleFilterUpdate")
    div(v-if="printersStore.loading")
      el-skeleton(:rows="5" animated)
    el-alert(v-else-if="printersStore.error" :title="printersStore.error" type="error")
    div(v-else-if="printersStore.printers.length === 0").empty-state
      p Принтеры не найдены
    div(v-else)
      el-row(:gutter="20")
        el-col(v-for="printer in printersStore.printers" :key="printer.id" :span="8" :xs="24" :sm="12" :md="8")
          PrinterCard(:printer="printer" :userId="authStore.user?.id")
    Pagination(
      v-if="printersStore.pagination.pages > 1"
      :current-page="currentPage"
      :total="printersStore.pagination.total"
      :page-size="20"
      layout="total, prev, pager, next"
      @page-change="handlePageChange"
    )
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { usePrintersStore } from '../stores/printers';
import { useAuthStore } from '../stores/auth';
import PrinterFilter from '../components/PrinterFilter.vue';
import PrinterCard from '../components/PrinterCard.vue';
import Pagination from '../components/Pagination.vue';

const route = useRoute();
const router = useRouter();
const printersStore = usePrintersStore();
const authStore = useAuthStore();

const currentPage = ref(1);

const filters = reactive({
  state: '',
});

const handleFilterUpdate = async (newFilters: typeof filters) => {
  Object.assign(filters, newFilters);
  currentPage.value = 1;
  updateURL();
  await loadPrinters();
};

// Читаем фильтры из URL при загрузке
onMounted(() => {
  if (route.query.state) {
    filters.state = route.query.state as string;
  }
  if (route.query.page) {
    currentPage.value = parseInt(route.query.page as string) || 1;
  }
  loadPrinters();
});

// Загружаем принтеры с учетом фильтров и пагинации
const loadPrinters = async () => {
  const params: Record<string, any> = {
    page: currentPage.value,
    limit: 20,
  };
  if (filters.state) {
    params.state = filters.state;
  }
  await printersStore.fetchPrinters(params);
};

const handlePageChange = async (page: number) => {
  currentPage.value = page;
  updateURL();
  await loadPrinters();
};

const updateURL = () => {
  const query: Record<string, string> = {};
  if (filters.state) query.state = filters.state;
  if (currentPage.value > 1) query.page = currentPage.value.toString();
  router.push({ query });
};
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
</style>
