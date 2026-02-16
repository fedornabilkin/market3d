<template lang="pug">
el-pagination(
  v-if="total > pageSize"
  v-model:current-page="currentPage"
  :page-size="pageSize"
  :total="total"
  :layout="layout"
  @current-change="handlePageChange"
)
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

interface Props {
  currentPage: number;
  total: number;
  pageSize: number;
  layout?: string;
}

const props = withDefaults(defineProps<Props>(), {
  layout: 'prev, pager, next',
});

const emit = defineEmits<{
  'page-change': [page: number];
}>();

const currentPage = ref(props.currentPage);

watch(() => props.currentPage, (newVal) => {
  currentPage.value = newVal;
});

const handlePageChange = (page: number) => {
  currentPage.value = page;
  emit('page-change', page);
};
</script>

<style scoped>
</style>
