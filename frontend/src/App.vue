<template lang="pug">
#app
  el-container
    el-header.navbar
      .container
        .nav-content
          router-link.logo(to="/") 3D Marketplace
          .nav-links
            router-link(to="/clusters")
              el-icon(style="margin-right: 5px")
                OfficeBuilding
              | Кластеры
            router-link(to="/printers")
              el-icon(style="margin-right: 5px")
                Printer
              | Принтеры
            router-link(to="/orders")
              el-icon(style="margin-right: 5px")
                Document
              | Заказы
            NotificationDropdown(v-if="authStore.isAuthenticated")
            .avatar-container(v-if="authStore.isAuthenticated")
              .avatar-circle(@click="showUserPopup = !showUserPopup")
                img(v-if="authStore.user?.avatarUrl" :src="authStore.user.avatarUrl" alt="Avatar")
                span(v-else) {{ getInitials(authStore.user?.name || authStore.user?.email || '') }}
              el-popover(
                v-model:visible="showUserPopup"
                placement="bottom-end"
                :width="250"
                trigger="click"
              )
                template(#reference)
                  span
                .user-popup
                  .user-popup-header
                    img(v-if="authStore.user?.avatarUrl" :src="authStore.user.avatarUrl" alt="Avatar" style="width: 80px; height: 80px; border-radius: 50%; margin-bottom: 10px")
                    div(v-else style="width: 80px; height: 80px; border-radius: 50%; background: #409EFF; display: flex; align-items: center; justify-content: center; color: white; font-size: 32px; margin: 0 auto 10px") {{ getInitials(authStore.user?.name || authStore.user?.email || '') }}
                    h3 {{ authStore.user?.name || 'Пользователь' }}
                    p {{ authStore.user?.email }}
                  router-link(to="/profile" @click="showUserPopup = false")
                    el-button(type="primary" style="width: 100%; margin-bottom: 10px") Профиль
                  el-button(type="danger" style="width: 100%" @click="handleLogout") Выход
            router-link(v-else to="/login")
              el-button(type="primary") Войти
  main
    router-view
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from './stores/auth';
import NotificationDropdown from './components/NotificationDropdown.vue';
import { OfficeBuilding, Printer, Document } from '@element-plus/icons-vue';

const router = useRouter();
const authStore = useAuthStore();
const showUserPopup = ref(false);

onMounted(() => {
  authStore.init();
});

const getInitials = (text: string): string => {
  if (!text) return '';
  const parts = text.split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return text.substring(0, 2).toUpperCase();
};

const handleLogout = () => {
  authStore.logout();
  showUserPopup.value = false;
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

.avatar-container {
  position: relative;
  margin-left: 10px;
}

.avatar-circle {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s;
  overflow: hidden;
}

.avatar-circle:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.05);
}

.avatar-circle img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-circle span {
  color: white;
  font-weight: bold;
  font-size: 14px;
}

.user-popup {
  padding: 10px;
}

.user-popup-header {
  text-align: center;
  margin-bottom: 15px;
}

.user-popup-header h3 {
  margin: 10px 0 5px;
  font-size: 18px;
}

.user-popup-header p {
  margin: 0;
  color: #666;
  font-size: 14px;
}

main {
  padding: 20px 0;
}
</style>
