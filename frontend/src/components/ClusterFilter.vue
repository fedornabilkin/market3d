<template lang="pug">
el-row(:gutter="20" style="margin-bottom: 20px")
  el-col(:span="6")
    el-select(
      v-model="localFilters.state"
      placeholder="Выберите состояние"
      clearable
      style="width: 100%"
      @change="handleFilterChange"
    )
      el-option(label="Активные" value="active")
      el-option(label="Черновики" value="draft")
      el-option(label="Неактивные" value="inactive")
      el-option(label="Архив" value="archived")
  el-col(:span="6")
    el-select(
      v-model="localFilters.regionId"
      placeholder="Выберите регион"
      clearable
      style="width: 100%"
      :loading="loading"
      @change="handleRegionChange"
    )
      el-option(
        v-for="region in regions"
        :key="region.id"
        :label="region.name"
        :value="region.id"
      )
  el-col(:span="6")
    el-select(
      v-model="localFilters.cityId"
      placeholder="Выберите город"
      clearable
      style="width: 100%"
      :loading="loading"
      :disabled="!localFilters.regionId"
      @change="handleFilterChange"
    )
      el-option(
        v-for="city in cities"
        :key="city.id"
        :label="city.name"
        :value="city.id"
      )
  el-col(:span="6")
    el-select(
      v-model="localFilters.materialId"
      placeholder="Выберите материал"
      clearable
      style="width: 100%"
      :loading="loading"
      @change="handleFilterChange"
    )
      el-option(
        v-for="material in materials"
        :key="material.id"
        :label="material.name"
        :value="material.id"
      )
  el-col(:span="6")
    el-select(
      v-model="localFilters.colorId"
      placeholder="Выберите цвет"
      clearable
      style="width: 100%"
      :loading="loading"
      @change="handleFilterChange"
    )
      el-option(
        v-for="color in colors"
        :key="color.id"
        :label="color.name"
        :value="color.id"
      )
</template>

<script setup lang="ts">
import { ref, reactive, watch, onMounted } from 'vue';
import { useDictionariesStore } from '../stores/dictionaries';

interface Filters {
  state?: string;
  regionId?: number | null;
  cityId?: number | null;
  materialId?: number | null;
  colorId?: number | null;
}

interface Props {
  filters: Filters;
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
});

const emit = defineEmits<{
  'update:filters': [filters: Filters];
}>();

const dictionariesStore = useDictionariesStore();
const regions = ref([]);
const cities = ref([]);
const materials = ref([]);
const colors = ref([]);

const localFilters = reactive<Filters>({
  state: props.filters.state || 'active',
  regionId: props.filters.regionId || null,
  cityId: props.filters.cityId || null,
  materialId: props.filters.materialId || null,
  colorId: props.filters.colorId || null,
});

watch(() => props.filters, (newFilters) => {
  localFilters.state = newFilters.state || 'active';
  localFilters.regionId = newFilters.regionId || null;
  localFilters.cityId = newFilters.cityId || null;
  localFilters.materialId = newFilters.materialId || null;
  localFilters.colorId = newFilters.colorId || null;
}, { deep: true });

const handleFilterChange = () => {
  emit('update:filters', { ...localFilters });
};

const handleRegionChange = async () => {
  localFilters.cityId = null;
  await loadCities();
  emit('update:filters', { ...localFilters });
};

const loadRegions = async () => {
  try {
    regions.value = await dictionariesStore.fetchItemsByDictionaryName('regions');
  } catch (error) {
    console.error('Failed to load regions:', error);
  }
};

const loadCities = async () => {
  if (!localFilters.regionId) {
    cities.value = [];
    return;
  }
  try {
    cities.value = await dictionariesStore.fetchItemsByDictionaryName('cities', localFilters.regionId);
  } catch (error) {
    console.error('Failed to load cities:', error);
  }
};

const loadMaterials = async () => {
  try {
    materials.value = await dictionariesStore.fetchItemsByDictionaryName('materials');
  } catch (error) {
    console.error('Failed to load materials:', error);
  }
};

const loadColors = async () => {
  try {
    colors.value = await dictionariesStore.fetchItemsByDictionaryName('colors');
  } catch (error) {
    console.error('Failed to load colors:', error);
  }
};

onMounted(async () => {
  await loadRegions();
  await loadMaterials();
  await loadColors();
  if (localFilters.regionId) {
    await loadCities();
  }
});
</script>

<style scoped>
</style>
