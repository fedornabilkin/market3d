<template lang="pug">
.container
  h1 Профиль пользователя
  el-card.form-card
    // Информация о пользователе
    el-descriptions(title="Информация" :column="1" border)
      el-descriptions-item(label="ID") {{ authStore.user?.id }}
      el-descriptions-item(label="Email") {{ authStore.user?.email }}
      el-descriptions-item(label="Email подтвержден")
        el-tag(v-if="authStore.user?.emailVerified" type="success") Да
        el-tag(v-else type="warning") Нет
      el-descriptions-item(label="Дата регистрации") {{ formatDate(authStore.user?.createdAt) }}
    
    // Верификация email (скрываем если email подтвержден)
    el-card(v-if="!authStore.user?.emailVerified" style="margin-top: 20px")
      template(#header)
        h3 Верификация email
      el-form(@submit.prevent="handleVerifyEmail")
        el-form-item(label="Код подтверждения")
          el-input(v-model="verifyCode" placeholder="Введите 4-значный код" maxlength="4" style="width: 200px")
        el-form-item
          el-button(type="primary" @click="handleVerifyEmail" :loading="authStore.loading") Подтвердить
          el-button(@click="requestNewCode" :loading="codeRequestLoading" :disabled="codeRequestDisabled" style="margin-left: 10px")
            | {{ codeRequestDisabled ? `Запросить новый код (${codeRequestTimer}с)` : 'Запросить новый код' }}
    
    // Смена email
    el-card(style="margin-top: 20px")
      template(#header)
        h3 Смена email
      el-form(@submit.prevent="handleEmailChange" :model="emailForm" :rules="emailRules" ref="emailFormRef")
        el-form-item(label="Новый email" prop="newEmail")
          el-input(v-model="emailForm.newEmail" placeholder="Введите новый email" style="width: 300px")
        el-form-item(v-if="emailChangeCodeRequested" label="Код подтверждения" prop="code")
          el-input(v-model="emailForm.code" placeholder="Введите 4-значный код" maxlength="4" style="width: 200px")
        el-form-item
          el-button(v-if="!emailChangeCodeRequested" type="primary" @click="requestEmailChange" :loading="authStore.loading") Запросить код
          el-button(v-else type="primary" @click="confirmEmailChange" :loading="authStore.loading") Подтвердить смену email
        el-alert(v-if="authStore.error && emailChangeCodeRequested" :title="authStore.error" type="error" style="margin-top: 10px")
    
    // Смена пароля
    el-card(style="margin-top: 20px")
      template(#header)
        h3 Смена пароля
      el-form(@submit.prevent="handlePasswordChange" :model="passwordForm" :rules="passwordRules" ref="passwordFormRef")
        el-form-item(label="Текущий пароль" prop="oldPassword")
          el-input(v-model="passwordForm.oldPassword" type="password" placeholder="Введите текущий пароль" style="width: 300px")
        el-form-item(label="Новый пароль" prop="newPassword")
          el-input(v-model="passwordForm.newPassword" type="password" placeholder="Введите новый пароль" style="width: 300px")
        el-form-item(label="Подтверждение пароля" prop="confirmPassword")
          el-input(v-model="passwordForm.confirmPassword" type="password" placeholder="Подтвердите новый пароль" style="width: 300px")
        el-form-item
          el-button(type="primary" @click="handlePasswordChange" :loading="authStore.loading") Изменить пароль
        el-alert(v-if="authStore.error" :title="authStore.error" type="error" style="margin-top: 10px")
    
    el-alert(v-if="successMessage" :title="successMessage" type="success" style="margin-top: 20px")
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useAuthStore } from '../stores/auth';
import type { FormInstance, FormRules } from 'element-plus';

const authStore = useAuthStore();

const verifyCode = ref('');
const emailChangeCodeRequested = ref(false);
const successMessage = ref('');
const codeRequestLoading = ref(false);
const codeRequestDisabled = ref(false);
const codeRequestTimer = ref(60);

const emailFormRef = ref<FormInstance>();
const emailForm = reactive({
  newEmail: '',
  code: '',
});

const passwordFormRef = ref<FormInstance>();
const passwordForm = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
});

const emailRules = reactive<FormRules>({
  newEmail: [
    { required: true, message: 'Введите новый email', trigger: 'blur' },
    { type: 'email', message: 'Введите корректный email', trigger: 'blur' },
  ],
  code: [
    { required: true, message: 'Введите код подтверждения', trigger: 'blur' },
    { min: 4, max: 4, message: 'Код должен состоять из 4 цифр', trigger: 'blur' },
  ],
});

const passwordRules = reactive<FormRules>({
  oldPassword: [
    { required: true, message: 'Введите текущий пароль', trigger: 'blur' },
  ],
  newPassword: [
    { required: true, message: 'Введите новый пароль', trigger: 'blur' },
    { min: 6, message: 'Пароль должен быть не менее 6 символов', trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: 'Подтвердите пароль', trigger: 'blur' },
    {
      validator: (rule, value, callback) => {
        if (value !== passwordForm.newPassword) {
          callback(new Error('Пароли не совпадают'));
        } else {
          callback();
        }
      },
      trigger: 'blur',
    },
  ],
});

const formatDate = (dateString?: string): string => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('ru-RU');
};

const handleVerifyEmail = async () => {
  if (!verifyCode.value || verifyCode.value.length !== 4) {
    return;
  }
  try {
    await authStore.verifyEmail(verifyCode.value);
    successMessage.value = 'Email успешно подтвержден!';
    verifyCode.value = '';
    setTimeout(() => {
      successMessage.value = '';
    }, 3000);
  } catch (error) {
    // Error handled by store
  }
};

const requestNewCode = async () => {
  if (codeRequestDisabled.value) return;
  
  codeRequestLoading.value = true;
  try {
    await authStore.requestNewVerificationCode();
    successMessage.value = 'Новый код отправлен в console.log (режим разработки)';
    setTimeout(() => {
      successMessage.value = '';
    }, 3000);
    
    // Запускаем таймер на 1 минуту
    codeRequestDisabled.value = true;
    codeRequestTimer.value = 60;
    const interval = setInterval(() => {
      codeRequestTimer.value--;
      if (codeRequestTimer.value <= 0) {
        clearInterval(interval);
        codeRequestDisabled.value = false;
      }
    }, 1000);
  } catch (error: any) {
    if (error.remainingSeconds) {
      // Backend вернул оставшееся время
      codeRequestDisabled.value = true;
      codeRequestTimer.value = error.remainingSeconds;
      const interval = setInterval(() => {
        codeRequestTimer.value--;
        if (codeRequestTimer.value <= 0) {
          clearInterval(interval);
          codeRequestDisabled.value = false;
        }
      }, 1000);
    }
    // Error handled by store
  } finally {
    codeRequestLoading.value = false;
  }
};

const requestEmailChange = async () => {
  if (!emailFormRef.value) return;
  await emailFormRef.value.validate(async (valid) => {
    if (valid) {
      try {
        await authStore.requestEmailChange(emailForm.newEmail);
        emailChangeCodeRequested.value = true;
        successMessage.value = 'Код отправлен в console.log (режим разработки)';
        setTimeout(() => {
          successMessage.value = '';
        }, 3000);
      } catch (error) {
        // Error handled by store
      }
    }
  });
};

const confirmEmailChange = async () => {
  if (!emailFormRef.value) return;
  await emailFormRef.value.validate(async (valid) => {
    if (valid) {
      try {
        await authStore.confirmEmailChange(emailForm.code);
        successMessage.value = 'Email успешно изменен!';
        emailChangeCodeRequested.value = false;
        emailForm.newEmail = '';
        emailForm.code = '';
        setTimeout(() => {
          successMessage.value = '';
        }, 3000);
      } catch (error) {
        // Error handled by store
      }
    }
  });
};

const handleEmailChange = () => {
  if (emailChangeCodeRequested.value) {
    confirmEmailChange();
  } else {
    requestEmailChange();
  }
};

const handlePasswordChange = async () => {
  if (!passwordFormRef.value) return;
  await passwordFormRef.value.validate(async (valid) => {
    if (valid) {
      try {
        await authStore.changePassword(passwordForm.oldPassword, passwordForm.newPassword);
        successMessage.value = 'Пароль успешно изменен!';
        passwordForm.oldPassword = '';
        passwordForm.newPassword = '';
        passwordForm.confirmPassword = '';
        setTimeout(() => {
          successMessage.value = '';
        }, 3000);
      } catch (error) {
        // Error handled by store
      }
    }
  });
};

onMounted(async () => {
  await authStore.getProfile();
});
</script>

<style scoped>
.form-card {
  max-width: 800px;
  margin: 0 auto;
}
</style>

