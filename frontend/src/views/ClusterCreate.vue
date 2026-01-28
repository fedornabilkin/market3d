<template lang="pug">
.container
  h1 {{ isEditMode ? 'Редактирование кластера' : 'Создание кластера' }}
  el-card.form-card
    el-form(@submit.prevent="handleSubmit" :model="form" :rules="rules" ref="formRef")
      el-form-item(label="Название" prop="name")
        el-input(v-model="form.name" placeholder="Введите название кластера")
      el-form-item(label="Описание")
        el-input(v-model="form.description" type="textarea" :rows="4" placeholder="Описание кластера")
      el-form-item(label="Регион" prop="regionId")
        el-select(
          v-model="form.regionId"
          placeholder="Выберите регион"
          style="width: 100%"
          :loading="dictionariesStore.loading"
          @change="handleRegionChange"
        )
          el-option(
            v-for="region in regions"
            :key="region.id"
            :label="region.name"
            :value="region.id"
          )
      el-form-item(label="Город" prop="cityId")
        el-select(
          v-model="form.cityId"
          placeholder="Выберите город"
          style="width: 100%"
          :loading="dictionariesStore.loading"
          :disabled="!form.regionId"
          @change="handleCityChange"
        )
          el-option(
            v-for="city in cities"
            :key="city.id"
            :label="city.name"
            :value="city.id"
          )
      el-form-item(label="Метро")
        el-select(
          v-model="form.metroId"
          placeholder="Выберите станцию метро (опционально)"
          style="width: 100%"
          :loading="dictionariesStore.loading"
          :disabled="!form.cityId"
          clearable
        )
          el-option(
            v-for="metro in metroStations"
            :key="metro.id"
            :label="metro.name"
            :value="metro.id"
          )
      el-form-item(label="Родительский кластер")
        el-select(
          v-model="form.parentClusterId"
          placeholder="Выберите родительский кластер (опционально)"
          style="width: 100%"
          :loading="clustersStore.loading"
          clearable
          filterable
        )
          el-option(
            v-for="cluster in availableClusters"
            :key="cluster.id"
            :label="cluster.name"
            :value="cluster.id"
          )
      el-form-item(label="Способы доставки")
        el-select(
          v-model="form.deliveryMethodIds"
          placeholder="Выберите способы доставки"
          multiple
          filterable
          style="width: 100%"
          :loading="dictionariesStore.loading"
        )
          el-option(
            v-for="method in deliveryMethods"
            :key="method.id"
            :label="method.name"
            :value="method.id"
          )
      el-alert(v-if="clustersStore.error" :title="clustersStore.error" type="error")
      el-alert(v-if="successMessage" :title="successMessage" type="success")
      el-form-item
        el-button(type="primary" native-type="submit" :loading="clustersStore.loading" style="width: 100%")
          | {{ clustersStore.loading ? 'Сохранение...' : (isEditMode ? 'Сохранить изменения' : 'Создать кластер') }}
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useClustersStore } from '../stores/clusters';
import { useDictionariesStore } from '../stores/dictionaries';
import { useAuthStore } from '../stores/auth';
import { ElMessage } from 'element-plus';
import type { FormInstance, FormRules } from 'element-plus';

const router = useRouter();
const route = useRoute();
const clustersStore = useClustersStore();
const dictionariesStore = useDictionariesStore();
const authStore = useAuthStore();

const isEditMode = computed(() => !!route.params.id);

const formRef = ref<FormInstance>();
const form = reactive({
  name: '',
  description: '',
  regionId: null as number | null,
  cityId: null as number | null,
  metroId: null as number | null,
  parentClusterId: null as number | null,
  deliveryMethodIds: [] as number[],
});

const successMessage = ref('');
const cluster = ref<any>(null);

const regions = ref([]);
const cities = ref([]);
const metroStations = ref([]);
const availableClusters = ref([]);
const deliveryMethods = ref([]);

const rules = reactive<FormRules>({
  name: [
    { required: true, message: 'Введите название кластера', trigger: 'blur' },
    { min: 1, max: 255, message: 'Название должно быть от 1 до 255 символов', trigger: 'blur' },
  ],
  regionId: [
    { required: true, message: 'Выберите регион', trigger: 'change' },
  ],
  cityId: [
    { required: true, message: 'Выберите город', trigger: 'change' },
  ],
});

const handleRegionChange = async () => {
  form.cityId = null;
  form.metroId = null;
  await loadCities();
};

const handleCityChange = async () => {
  form.metroId = null;
  await loadMetroStations();
};

const handleSubmit = async () => {
  if (!formRef.value) return;
  
  await formRef.value.validate(async (valid) => {
    if (valid) {
      try {
        const clusterData = {
          name: form.name,
          description: form.description || '',
          regionId: form.regionId,
          cityId: form.cityId,
          metroId: form.metroId || undefined,
          parentClusterId: form.parentClusterId || undefined,
          deliveryMethodIds: form.deliveryMethodIds || [],
        };

        let result;
        if (isEditMode.value) {
          result = await clustersStore.updateCluster(parseInt(route.params.id as string), clusterData);
          successMessage.value = 'Кластер успешно обновлен!';
        } else {
          result = await clustersStore.createCluster(clusterData);
          successMessage.value = 'Кластер успешно создан!';
        }
        
        setTimeout(() => {
          router.push(`/clusters/${result.id}`);
        }, 2000);
      } catch (error: any) {
        ElMessage.error(error.response?.data?.error || 'Не удалось сохранить кластер');
      }
    }
  });
};

const loadRegions = async () => {
  try {
    regions.value = await dictionariesStore.fetchItemsByDictionaryName('regions');
  } catch (error) {
    console.error('Failed to load regions:', error);
  }
};

const loadCities = async () => {
  if (!form.regionId) {
    cities.value = [];
    return;
  }
  try {
    const items = await dictionariesStore.fetchItemsByDictionaryName('cities', form.regionId);
    cities.value = items;
    if (form.cityId && !items.find((c: any) => c.id === form.cityId)) {
      form.cityId = null;
    }
  } catch (error) {
    console.error('Failed to load cities:', error);
  }
};

const loadMetroStations = async () => {
  if (!form.cityId) {
    metroStations.value = [];
    return;
  }
  try {
    const items = await dictionariesStore.fetchItemsByDictionaryName('metro_stations', form.cityId);
    metroStations.value = items;
    if (form.metroId && !items.find((m: any) => m.id === form.metroId)) {
      form.metroId = null;
    }
  } catch (error) {
    console.error('Failed to load metro stations:', error);
  }
};

const loadAvailableClusters = async () => {
  try {
    // Загружаем только мои кластеры
    const result = await clustersStore.fetchClusters({ includeArchived: false });
    availableClusters.value = (result.data || result).filter((c: any) => c.userId === authStore.user?.id);
    // Исключаем текущий кластер из списка родительских (если редактируем)
    if (isEditMode.value && cluster.value) {
      availableClusters.value = availableClusters.value.filter((c: any) => c.id !== cluster.value.id);
    }
  } catch (error) {
    console.error('Failed to load clusters:', error);
  }
};

const loadDeliveryMethods = async () => {
  try {
    deliveryMethods.value = await dictionariesStore.fetchItemsByDictionaryName('delivery_methods');
  } catch (error) {
    console.error('Failed to load delivery methods:', error);
  }
};

watch(() => form.regionId, () => {
  form.cityId = null;
  form.metroId = null;
  loadCities();
});

watch(() => form.cityId, () => {
  form.metroId = null;
  loadMetroStations();
});

onMounted(async () => {
  await loadRegions();
  await loadAvailableClusters();
  await loadDeliveryMethods();

  // Если режим редактирования - загружаем данные кластера
  if (isEditMode.value) {
    try {
      const id = parseInt(route.params.id as string);
      await clustersStore.fetchClusterById(id);
      cluster.value = clustersStore.currentCluster;
      
      if (cluster.value) {
        form.name = cluster.value.name;
        form.description = cluster.value.description || '';
        form.regionId = cluster.value.regionId;
        form.metroId = cluster.value.metroId || null;
        form.parentClusterId = cluster.value.parentClusterId || null;
        
        // Загружаем способы доставки
        if (cluster.value.deliveryMethods && Array.isArray(cluster.value.deliveryMethods)) {
          form.deliveryMethodIds = cluster.value.deliveryMethods.map((d: any) => d.id);
        }
        
        // Загружаем города перед установкой cityId
        if (form.regionId) {
          await loadCities();
          // Устанавливаем cityId после загрузки городов
          form.cityId = cluster.value.cityId;
          if (form.cityId) {
            await loadMetroStations();
          }
        }
      } else {
        router.push('/clusters');
      }
    } catch (error) {
      console.error('Failed to load cluster:', error);
      router.push('/clusters');
    }
  }
});
</script>

<style scoped>
.form-card {
  max-width: 600px;
  margin: 0 auto;
}
</style>


