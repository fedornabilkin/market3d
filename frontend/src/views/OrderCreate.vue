<template lang="pug">
.container
  h1 {{ isEditMode ? 'Редактировать заказ' : 'Создать заказ' }}
  el-alert(
    v-if="!isEditMode && !clusterId"
    title="Заказ можно создать только с детальной страницы кластера"
    type="warning"
    style="margin-bottom: 20px"
  )
  el-card.form-card(v-if="isEditMode || clusterId")
    el-form(@submit.prevent="handleSubmit" :model="form" :rules="rules" ref="formRef")
      el-form-item(label="Материал" prop="material")
        el-select(v-model="form.material" placeholder="Выберите материал" style="width: 100%" :loading="dictionariesStore.loading")
          el-option(
            v-for="item in materialItems"
            :key="item.id"
            :label="item.name"
            :value="item.name"
          )
      el-form-item(label="Цвет")
        el-input(v-model="form.color" placeholder="Белый, черный и т.д.")
      el-form-item(label="Количество" prop="quantity")
        el-input-number(v-model="form.quantity" :min="1" style="width: 100%")
      el-form-item(label="Описание")
        el-input(v-model="form.description" type="textarea" :rows="4" placeholder="Описание заказа")
      el-form-item(label="Срок выполнения" prop="deadline")
        el-date-picker(
          v-model="form.deadline"
          type="datetime"
          placeholder="Выберите дату и время"
          style="width: 100%"
          format="YYYY-MM-DD HH:mm"
          value-format="YYYY-MM-DDTHH:mm:ss"
        )
      el-alert(v-if="ordersStore.error" :title="ordersStore.error" type="error")
      el-alert(v-if="successMessage" :title="successMessage" type="success")
      el-form-item
        el-button(type="primary" native-type="submit" :loading="ordersStore.loading" style="width: 100%")
          | {{ ordersStore.loading ? (isEditMode ? 'Сохранение...' : 'Создание...') : (isEditMode ? 'Сохранить изменения' : 'Создать заказ') }}
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useOrdersStore } from '../stores/orders';
import { useDictionariesStore } from '../stores/dictionaries';
import { ElMessageBox } from 'element-plus';
import type { FormInstance, FormRules } from 'element-plus';

const router = useRouter();
const route = useRoute();
const ordersStore = useOrdersStore();
const dictionariesStore = useDictionariesStore();

const isEditMode = computed(() => !!route.params.id);
const clusterId = computed(() => {
  const queryClusterId = route.query.clusterId;
  return queryClusterId ? parseInt(queryClusterId as string) : null;
});

const formRef = ref<FormInstance>();
const form = reactive({
  material: '',
  color: '',
  quantity: 1,
  description: '',
  deadline: '',
});

const successMessage = ref('');

const materialItems = ref([]);

const rules = reactive<FormRules>({
  material: [
    { required: true, message: 'Пожалуйста, выберите материал', trigger: 'change' },
  ],
  quantity: [
    { required: true, message: 'Пожалуйста, введите количество', trigger: 'blur' },
    { type: 'number', min: 1, message: 'Количество должно быть не менее 1', trigger: 'blur' },
  ],
  deadline: [
    { required: true, message: 'Пожалуйста, выберите срок выполнения', trigger: 'change' },
    {
      validator: (rule, value, callback) => {
        if (!value) {
          callback();
          return;
        }
        const deadline = new Date(value);
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);

        if (deadline < now) {
          callback(new Error('Дата не должна быть в прошлом'));
        } else if (deadline < tomorrow) {
          callback(new Error('Дата должна быть не ранее завтрашнего дня'));
        } else {
          callback();
        }
      },
      trigger: 'change',
    },
  ],
});

const handleSubmit = async () => {
  if (!formRef.value) return;
  
  await formRef.value.validate(async (valid) => {
    if (valid) {
      try {
        const orderData = {
          material: form.material,
          color: form.color,
          quantity: form.quantity,
          deadline: form.deadline,
          description: form.description,
        };

        let order;
        if (isEditMode.value) {
          order = await ordersStore.updateOrder(parseInt(route.params.id as string), orderData);
          successMessage.value = 'Заказ успешно обновлен!';
        } else {
          if (clusterId.value) {
            order = await ordersStore.createOrder({ ...orderData, clusterId: clusterId.value });
          } else {
            order = await ordersStore.createOrder(orderData);
          }
          successMessage.value = 'Заказ успешно создан!';
          
          // Предлагаем загрузить файлы
          await ElMessageBox.confirm(
            'Хотите загрузить файлы для заказа?',
            'Загрузка файлов',
            {
              confirmButtonText: 'Загрузить файлы',
              cancelButtonText: 'Позже',
              type: 'info',
            }
          ).then(() => {
            router.push(`/orders/${order.id}`);
          }).catch(() => {
            router.push('/orders');
          });
          return;
        }
        
        setTimeout(() => {
          router.push(`/orders/${order.id}`);
        }, 2000);
      } catch (error) {
        // Error handled by store
      }
    }
  });
};

onMounted(async () => {
  // Загружаем материалы из справочника
  try {
    materialItems.value = await dictionariesStore.fetchItemsByDictionaryName('materials');
  } catch (error) {
    console.error('Failed to load materials:', error);
  }

  // Если режим редактирования - загружаем данные заказа
  if (isEditMode.value) {
    try {
      const orderId = parseInt(route.params.id as string);
      await ordersStore.fetchOrderById(orderId);
      const order = ordersStore.currentOrder;
      if (order && order.userId === ordersStore.currentOrder?.userId) {
        form.material = order.material;
        form.color = order.color || '';
        form.quantity = order.quantity;
        form.description = order.description || '';
        form.deadline = order.deadline;
      } else {
        router.push('/orders');
      }
    } catch (error) {
      console.error('Failed to load order:', error);
      router.push('/orders');
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
