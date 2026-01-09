<template lang="pug">
el-row(:gutter="20" style="margin-bottom: 20px")
  el-col(:span="8")
    el-select(
      v-model="localFilters.state"
      placeholder="Все"
      clearable
      style="width: 100%"
      @change="handleFilterChange"
    )
      el-option(label="Доступен" value="available")
      el-option(label="Занят" value="busy")
      el-option(label="На обслуживании" value="maintenance")
      el-option(label="Неактивен" value="inactive")
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';

interface Filters {
  state?: string;
}

interface Props {
  filters: Filters;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:filters': [filters: Filters];
}>();

const localFilters = reactive<Filters>({
  state: props.filters.state || '',
});

watch(() => props.filters, (newFilters) => {
  localFilters.state = newFilters.state || '';
}, { deep: true });

const handleFilterChange = () => {
  emit('update:filters', { ...localFilters });
};
</script>

<style scoped>
</style>
