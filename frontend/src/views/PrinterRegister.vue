<template lang="pug">
.container
  h1 {{ isEditMode ? 'Редактирование принтера' : 'Регистрация принтера' }}
  el-card.form-card
    el-form(@submit.prevent="handleSubmit" :model="form" :rules="rules" ref="formRef")
      el-form-item(label="Производитель" prop="manufacturer")
        el-select(v-model="form.manufacturer" placeholder="Выберите производителя" style="width: 100%" :loading="dictionariesStore.loading" @change="handleManufacturerChange")
          el-option(
            v-for="item in manufacturers"
            :key="item.id"
            :label="item.name"
            :value="item.name"
          )
      el-form-item(label="Модель" prop="modelName")
        el-select(v-model="form.modelName" placeholder="Выберите модель" style="width: 100%" :loading="dictionariesStore.loading" :disabled="!form.manufacturer")
          el-option(
            v-for="item in filteredModels"
            :key="item.id"
            :label="item.name"
            :value="item.name"
          )
      el-form-item(label="Цена за час (₽)" prop="pricePerHour")
        el-input-number(v-model="form.pricePerHour" :min="1" :precision="0" style="width: 100%")
      el-form-item(label="Материалы" prop="materialIds")
        el-select(
          v-model="form.materialIds"
          placeholder="Выберите материалы"
          multiple
          filterable
          style="width: 100%"
          :loading="dictionariesStore.loading"
        )
          el-option(
            v-for="material in materials"
            :key="material.id"
            :label="material.name"
            :value="material.id"
          )
      el-form-item(label="Цвета" prop="colorIds")
        el-select(
          v-model="form.colorIds"
          placeholder="Выберите цвета"
          multiple
          filterable
          style="width: 100%"
          :loading="dictionariesStore.loading"
        )
          el-option(
            v-for="color in colors"
            :key="color.id"
            :label="color.name"
            :value="color.id"
          )
      el-form-item(label="Статус" prop="state")
        el-select(v-model="form.state" placeholder="Выберите статус" style="width: 100%")
          el-option(label="Доступен" value="available")
          el-option(label="Занят" value="busy")
          el-option(label="На обслуживании" value="maintenance")
          el-option(label="Неактивен" value="inactive")
      el-alert(v-if="printersStore.error" :title="printersStore.error" type="error")
      el-alert(v-if="successMessage" :title="successMessage" type="success")
      el-form-item
        el-button(type="primary" native-type="submit" :loading="printersStore.loading" style="width: 100%")
          | {{ printersStore.loading ? 'Сохранение...' : (isEditMode ? 'Сохранить изменения' : 'Зарегистрировать принтер') }}
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { usePrintersStore } from '../stores/printers';
import { useDictionariesStore } from '../stores/dictionaries';
import type { FormInstance, FormRules } from 'element-plus';

const router = useRouter();
const route = useRoute();
const printersStore = usePrintersStore();
const dictionariesStore = useDictionariesStore();

const isEditMode = computed(() => !!route.params.id);

const manufacturers = ref([]);
const models = ref([]);
const materials = ref([]);
const colors = ref([]);

const formRef = ref<FormInstance>();
const form = reactive({
  modelName: '',
  manufacturer: '',
  pricePerHour: 1,
  state: 'available' as 'available' | 'busy' | 'maintenance' | 'inactive',
  materialIds: [] as number[],
  colorIds: [] as number[],
  maxBuildVolumeJson: '',
  materialsJson: '',
  specificationsJson: '',
});

const successMessage = ref('');
const printer = ref<any>(null);

const filteredModels = computed(() => {
  if (!form.manufacturer) return [];
  // Фильтруем модели по выбранному производителю
  // Модели хранятся как "Производитель Модель", поэтому проверяем начало названия
  return models.value.filter((model: any) => 
    model.name.toLowerCase().startsWith(form.manufacturer.toLowerCase())
  );
});

const rules = reactive<FormRules>({
  modelName: [
    { required: true, message: 'Пожалуйста, выберите модель', trigger: 'change' },
  ],
  manufacturer: [
    { required: true, message: 'Пожалуйста, выберите производителя', trigger: 'change' },
  ],
  pricePerHour: [
    { required: true, message: 'Пожалуйста, введите цену', trigger: 'blur' },
    { type: 'number', min: 1, message: 'Цена должна быть положительным целым числом (минимум 1)', trigger: 'blur' },
  ],
  state: [
    { required: true, message: 'Пожалуйста, выберите статус', trigger: 'change' },
  ],
});

const handleManufacturerChange = async () => {
  form.modelName = '';
  // Модели уже загружены, фильтрация происходит через computed
};

const handleSubmit = async () => {
  if (!formRef.value) return;
 
  await formRef.value.validate(async (valid) => {
    if (valid) {
      try {
        const printerData: any = {
          modelName: form.modelName,
          manufacturer: form.manufacturer,
          pricePerHour: form.pricePerHour,
          state: form.state,
          materialIds: form.materialIds || [],
          colorIds: form.colorIds || [],
        };
        
        if (form.maxBuildVolumeJson) {
          try {
            printerData.maxBuildVolume = JSON.parse(form.maxBuildVolumeJson);
          } catch (e) {
            printersStore.error = 'Неверный формат JSON для максимального объема печати';
            return;
          }
        }
        
        if (form.specificationsJson) {
          try {
            printerData.specifications = JSON.parse(form.specificationsJson);
          } catch (e) {
            printersStore.error = 'Неверный формат JSON для характеристик';
            return;
          }
        }

        let result;
        if (isEditMode.value) {
          result = await printersStore.updatePrinter(printer.value.id, printerData);
          successMessage.value = 'Принтер успешно обновлен!';
        } else {
          result = await printersStore.createPrinter(printerData);
          successMessage.value = 'Принтер успешно зарегистрирован!';
        }
        
        setTimeout(() => {
          router.push(`/printers/${result.id}`);
        }, 700);
      } catch (error) {
        console.error('Error saving printer:', error);
      }
    }
  });
};

onMounted(async () => {
  // Загружаем справочники
  try {
    manufacturers.value = await dictionariesStore.fetchItemsByDictionaryName('printer_manufacturers');

    models.value = await dictionariesStore.fetchItemsByDictionaryName('printer_models');

    materials.value = await dictionariesStore.fetchItemsByDictionaryName('materials');
    
    colors.value = await dictionariesStore.fetchItemsByDictionaryName('colors');
  } catch (error) {
    console.error('Failed to load dictionaries:', error);
  }

  // Если режим редактирования - загружаем данные принтера
  if (isEditMode.value) {
    try {
      const id = parseInt(route.params.id as string);
      await printersStore.fetchPrinterById(id);
      printer.value = printersStore.currentPrinter;
      if (printer.value && printer.value.userId === printersStore.currentPrinter?.userId) {
        form.modelName = printer.value.model_name;
        form.manufacturer = printer.value.manufacturer;
        form.pricePerHour = parseInt(printer.value.price_per_hour);
        form.state = printer.value.state;
        if (printer.value.materials && Array.isArray(printer.value.materials)) {
          form.materialIds = printer.value.materials.map((m: any) => m.id || m);
        }
        if (printer.value.colors && Array.isArray(printer.value.colors)) {
          form.colorIds = printer.value.colors.map((c: any) => c.id || c);
        }
        if (printer.value.maxBuildVolume) {
          form.maxBuildVolumeJson = JSON.stringify(printer.value.maxBuildVolume, null, 2);
        }
        if (printer.value.specifications) {
          form.specificationsJson = JSON.stringify(printer.value.specifications, null, 2);
        }
      } else {
        router.push('/printers');
      }
    } catch (error) {
      console.error('Failed to load printer:', error);
      router.push('/printers');
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
