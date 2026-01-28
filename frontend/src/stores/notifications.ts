import { defineStore } from 'pinia';
import api from '../services/api';

interface Notification {
  id: number;
  userId: number;
  message: string;
  isRead: boolean;
  createdAt: string;
}

interface NotificationsState {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  page: number;
  hasMore: boolean;
  showUnreadOnly: boolean;
}

export const useNotificationsStore = defineStore('notifications', {
  state: (): NotificationsState => ({
    notifications: [],
    unreadCount: 0,
    loading: false,
    page: 0,
    hasMore: true,
    showUnreadOnly: false,
  }),

  actions: {
    async fetchNotifications(limit: number = 10, reset: boolean = false) {
      this.loading = true;
      try {
        const offset = reset ? 0 : this.page * limit;
        const params: Record<string, any> = {
          limit,
          offset,
        };

        if (this.showUnreadOnly) {
          params.isRead = 'false';
        }

        const response = await api.get('/notifications', { params });
        const newNotifications = response.data;

        if (reset) {
          this.notifications = newNotifications;
          this.page = 1;
        } else {
          this.notifications = [...this.notifications, ...newNotifications];
          this.page += 1;
        }

        this.hasMore = newNotifications.length === limit;
        return newNotifications;
      } catch (error: any) {
        console.error('Failed to fetch notifications:', error);
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async loadMore() {
      if (!this.hasMore || this.loading) return;
      await this.fetchNotifications(10, false);
    },

    async markAsRead(id: number) {
      try {
        await api.put(`/notifications/${id}/read`);
        const notification = this.notifications.find(n => n.id === id);
        if (notification) {
          notification.isRead = true;
          if (this.unreadCount > 0) {
            this.unreadCount -= 1;
          }
        }
      } catch (error: any) {
        console.error('Failed to mark notification as read:', error);
        throw error;
      }
    },

    async markAllAsRead() {
      try {
        await api.put('/notifications/read-all');
        this.notifications.forEach(n => {
          n.isRead = true;
        });
        this.unreadCount = 0;
      } catch (error: any) {
        console.error('Failed to mark all notifications as read:', error);
        throw error;
      }
    },

    async fetchUnreadCount() {
      try {
        const response = await api.get('/notifications/unread-count');
        this.unreadCount = response.data.count;
        return this.unreadCount;
      } catch (error: any) {
        console.error('Failed to fetch unread count:', error);
        throw error;
      }
    },

    toggleUnreadFilter() {
      this.showUnreadOnly = !this.showUnreadOnly;
      this.fetchNotifications(10, true);
    },

    async refresh() {
      await Promise.all([
        this.fetchNotifications(10, true),
        this.fetchUnreadCount(),
      ]);
    },
  },
});
