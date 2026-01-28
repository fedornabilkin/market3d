<template lang="pug">
el-dropdown(
  trigger="click"
  @visible-change="handleVisibleChange"
  placement="bottom-end"
)
  el-badge(
    :value="notificationsStore.unreadCount"
    :hidden="notificationsStore.unreadCount === 0"
    :max="99"
  )
    el-icon.notification-icon(
      :class="{ 'has-unread': notificationsStore.unreadCount > 0 }"
      :size="20"
    )
      Bell
  template(#dropdown)
    .notification-dropdown
      .notification-header
        .notification-count
          | {{ notificationsStore.unreadCount }}
        .notification-actions
          el-button(
            text
            size="small"
            @click="handleToggleUnread"
          )
            | {{ notificationsStore.showUnreadOnly ? 'Все' : 'Непрочитанные' }}
          el-button(
            text
            size="small"
            @click="handleMarkAllRead"
            :disabled="notificationsStore.unreadCount === 0"
          )
            | Отметить все прочитанными
      .notification-list
        el-empty(
          v-if="!notificationsStore.loading && notificationsStore.notifications.length === 0"
          description="Нет уведомлений"
          :image-size="80"
        )
        template(v-else)
          .notification-item(
            v-for="notification in notificationsStore.notifications"
            :key="notification.id"
            :class="{ 'unread': !notification.isRead }"
          )
            .notification-content
              .notification-message {{ notification.message }}
              .notification-date {{ formatDate(notification.createdAt) }}
            el-button(
              v-if="!notification.isRead"
              text
              circle
              size="small"
              @click="handleMarkAsRead(notification.id)"
              title="Отметить прочитанным"
            )
              el-icon
                Check
      .notification-footer(v-if="notificationsStore.hasMore")
        el-button(
          text
          :loading="notificationsStore.loading"
          @click="handleLoadMore"
          style="width: 100%"
        )
          | Загрузить еще
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useNotificationsStore } from '../stores/notifications';
import { Bell, Check } from '@element-plus/icons-vue';

const notificationsStore = useNotificationsStore();

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) {
    return 'Только что';
  } else if (minutes < 60) {
    return `${minutes} ${minutes === 1 ? 'минуту' : minutes < 5 ? 'минуты' : 'минут'} назад`;
  } else if (hours < 24) {
    return `${hours} ${hours === 1 ? 'час' : hours < 5 ? 'часа' : 'часов'} назад`;
  } else if (days < 7) {
    return `${days} ${days === 1 ? 'день' : days < 5 ? 'дня' : 'дней'} назад`;
  } else {
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  }
};

const handleVisibleChange = (visible: boolean) => {
  if (visible) {
    notificationsStore.refresh();
  }
};

const handleMarkAsRead = async (id: number) => {
  await notificationsStore.markAsRead(id);
};

const handleMarkAllRead = async () => {
  await notificationsStore.markAllAsRead();
};

const handleLoadMore = async () => {
  await notificationsStore.loadMore();
};

const handleToggleUnread = () => {
  notificationsStore.toggleUnreadFilter();
};

onMounted(() => {
  notificationsStore.fetchUnreadCount();
});
</script>

<style scoped>
.notification-icon {
  cursor: pointer;
  color: white;
  transition: color 0.3s;
}

.notification-icon.has-unread {
  color: #ff9800;
}

.notification-dropdown {
  width: 400px;
  max-height: 500px;
  display: flex;
  flex-direction: column;
}

.notification-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #ebeef5;
}

.notification-count {
  font-weight: 500;
  font-size: 14px;
}

.notification-actions {
  display: flex;
  gap: 8px;
}

.notification-list {
  flex: 1;
  overflow-y: auto;
  max-height: 400px;
}

.notification-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #f5f7fa;
  transition: background-color 0.2s;
}

.notification-item:hover {
  background-color: #f5f7fa;
}

.notification-item.unread {
  background-color: #f0f9ff;
}

.notification-content {
  flex: 1;
  min-width: 0;
}

.notification-message {
  font-size: 14px;
  color: #303133;
  margin-bottom: 4px;
  word-wrap: break-word;
}

.notification-date {
  font-size: 12px;
  color: #909399;
}

.notification-footer {
  padding: 8px;
  border-top: 1px solid #ebeef5;
}
</style>
