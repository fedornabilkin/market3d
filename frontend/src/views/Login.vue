<template lang="pug">
.login-container
  el-card.login-card(shadow="always")
    template(#header)
      h1 Вход
    el-form(@submit.prevent="handleLogin" :model="form" :rules="rules" ref="formRef")
      el-form-item(label="Email" prop="email")
        el-input(v-model="form.email" type="email" placeholder="Введите email")
      el-form-item(label="Пароль" prop="password")
        el-input(v-model="form.password" type="password" placeholder="Введите пароль" show-password)
      el-alert(v-if="authStore.error" :title="authStore.error" type="error" :closable="false")
      el-form-item
        el-button(type="primary" native-type="submit" :loading="authStore.loading" style="width: 100%")
          | {{ authStore.loading ? 'Вход...' : 'Войти' }}
    p
      | Нет аккаунта? 
      router-link(to="/register") Зарегистрироваться
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import type { FormInstance, FormRules } from 'element-plus';

const router = useRouter();
const authStore = useAuthStore();

const formRef = ref<FormInstance>();
const form = reactive({
  email: '',
  password: '',
});

const rules = reactive<FormRules>({
  email: [
    { required: true, message: 'Пожалуйста, введите email', trigger: 'blur' },
    { type: 'email', message: 'Пожалуйста, введите корректный email', trigger: 'blur' },
  ],
  password: [
    { required: true, message: 'Пожалуйста, введите пароль', trigger: 'blur' },
  ],
});

const handleLogin = async () => {
  if (!formRef.value) return;
  
  await formRef.value.validate(async (valid) => {
    if (valid) {
      try {
        await authStore.login(form.email, form.password);
        router.push('/');
      } catch (error) {
        // Error handled by store
      }
    }
  });
};
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 80vh;
}

.login-card {
  width: 100%;
  max-width: 400px;
}

.login-card p {
  text-align: center;
  margin-top: 20px;
}

.login-card a {
  color: #007bff;
  text-decoration: none;
}
</style>
