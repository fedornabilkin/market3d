<template lang="pug">
.register-container
  Breadcrumbs
  el-card.register-card(shadow="always")
    template(#header)
      h1 Регистрация
    el-form(@submit.prevent="handleRegister" :model="form" :rules="rules" ref="formRef")
      el-form-item(label="Email" prop="email")
        el-input(v-model="form.email" type="email" placeholder="Введите email")
      el-form-item(label="Пароль" prop="password")
        el-input(v-model="form.password" type="password" placeholder="Введите пароль" show-password)
      el-alert(v-if="authStore.error" :title="authStore.error" type="error" :closable="false")
      el-form-item
        el-button(type="primary" native-type="submit" :loading="authStore.loading" style="width: 100%")
          | {{ authStore.loading ? 'Регистрация...' : 'Зарегистрироваться' }}
    p
      | Уже есть аккаунт? 
      router-link(to="/login") Войти
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import type { FormInstance, FormRules } from 'element-plus';
import Breadcrumbs from '../components/Breadcrumbs.vue';

const router = useRouter();
const authStore = useAuthStore();

const formRef = ref<FormInstance>();
const form = reactive({
  email: '',
  password: '',
  role: 'customer' as 'owner' | 'customer',
});

const rules = reactive<FormRules>({
  email: [
    { required: true, message: 'Пожалуйста, введите email', trigger: 'blur' },
    { type: 'email', message: 'Пожалуйста, введите корректный email', trigger: 'blur' },
  ],
  password: [
    { required: true, message: 'Пожалуйста, введите пароль', trigger: 'blur' },
    { min: 6, message: 'Пароль должен быть не менее 6 символов', trigger: 'blur' },
  ],
});

const handleRegister = async () => {
  if (!formRef.value) return;
  
  await formRef.value.validate(async (valid) => {
    if (valid) {
      try {
        await authStore.register(form.email, form.password);
        router.push('/');
      } catch (error) {
        // Error handled by store
      }
    }
  });
};
</script>

<style scoped>
.register-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 80vh;
}

.register-card {
  width: 100%;
  max-width: 400px;
}

.register-card p {
  text-align: center;
  margin-top: 20px;
}

.register-card a {
  color: #007bff;
  text-decoration: none;
}
</style>
