<template lang="pug">
#app
  el-container
    el-header.navbar
      .container
        .nav-content
          router-link.logo(to="/") 3D Marketplace
          .nav-links
            router-link(to="/clusters") Кластеры
            router-link(to="/printers") Принтеры
            router-link(to="/orders") Заказы
            NotificationDropdown(v-if="authStore.isAuthenticated")
            router-link(v-if="authStore.isAuthenticated" to="/profile").user-info {{ authStore.user?.email }}
            router-link(v-else to="/login")
              el-button(type="primary") Войти
            el-button(v-if="authStore.isAuthenticated" @click="handleLogout" type="default") Выйти
  main
    router-view
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from './stores/auth';
import NotificationDropdown from './components/NotificationDropdown.vue';

const router = useRouter();
const authStore = useAuthStore();

onMounted(() => {
  authStore.init();
});

const handleLogout = () => {
  authStore.logout();
  router.push('/login');
};
</script>

<style scoped>
.navbar {
  background-color: #007bff;
  color: white;
  padding: 15px 0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

.nav-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.logo {
  font-size: 24px;
  font-weight: bold;
  color: white;
  text-decoration: none;
}

.nav-links {
  display: flex;
  gap: 20px;
  align-items: center;
}

.nav-links a {
  color: white;
  text-decoration: none;
  padding: 5px 10px;
  border-radius: 3px;
  transition: background-color 0.3s;
}

.nav-links a:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.user-info {
  color: white;
  margin-right: 10px;
  text-decoration: none;
  padding: 5px 10px;
  border-radius: 3px;
  transition: background-color 0.3s;
}

.user-info:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

main {
  padding: 20px 0;
}
</style>
