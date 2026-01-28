import { defineStore } from 'pinia';
import api from '../services/api';

interface OrderFile {
  id: number;
  orderId: number;
  fileUrl: string;
  fileName: string;
  fileSize?: number;
  fileType?: string;
}

interface Order {
  id: number;
  userId: number;
  userEmail?: string;
  material: string;
  color?: string;
  colorId?: number;
  colorName?: string;
  quantity: number;
  dimensions: Record<string, any>;
  deadline: string;
  state: 'draft' | 'pending' | 'approved' | 'in_progress' | 'completed' | 'cancelled';
  totalPrice: number;
  description?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  files?: OrderFile[];
}

interface Message {
  id: number;
  orderId: number;
  senderId: number;
  senderEmail?: string;
  senderRole?: string;
  message: string;
  createdAt: string;
}

interface OrdersState {
  orders: Order[];
  currentOrder: Order | null;
  messages: Message[];
  loading: boolean;
  error: string | null;
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

export const useOrdersStore = defineStore('orders', {
  state: (): OrdersState => ({
    orders: [],
    currentOrder: null,
    messages: [],
    loading: false,
    error: null,
    pagination: {
      total: 0,
      page: 1,
      limit: 20,
      pages: 0,
    },
  }),

  actions: {
    async fetchOrders(filters: Record<string, any> = {}) {
      this.loading = true;
      this.error = null;
      try {
        const response = await api.get('/orders', { params: filters });
        if (response.data.data) {
          // Пагинированный ответ
          this.orders = response.data.data;
          this.pagination = {
            total: response.data.total,
            page: response.data.page,
            limit: response.data.limit,
            pages: response.data.pages,
          };
        } else {
          // Обычный массив (для обратной совместимости)
          this.orders = response.data;
        }
        return response.data;
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to fetch orders';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async fetchRecentOrders(limit: number = 5) {
      this.loading = true;
      this.error = null;
      try {
        const response = await api.get('/orders/recent', { params: { limit } });
        return response.data;
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to fetch recent orders';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async fetchOrderById(id: number) {
      this.loading = true;
      this.error = null;
      try {
        const response = await api.get(`/orders/${id}`);
        this.currentOrder = response.data;
        return response.data;
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to fetch order';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async createOrder(orderData: Partial<Order & { clusterId?: number }>) {
      this.loading = true;
      this.error = null;
      try {
        const response = await api.post('/orders', {
          material: orderData.material || '',
          color: orderData.color || 'default',
          quantity: orderData.quantity || 1,
          deadline: orderData.deadline || '',
          description: orderData.description || '',
          clusterId: orderData.clusterId,
        });
        this.orders.push(response.data);
        return response.data;
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to create order';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async updateOrder(id: number, orderData: Partial<Order>) {
      this.loading = true;
      this.error = null;
      try {
        const response = await api.put(`/orders/${id}`, orderData);
        const index = this.orders.findIndex(o => o.id === id);
        if (index !== -1) {
          this.orders[index] = response.data;
        }
        if (this.currentOrder?.id === id) {
          this.currentOrder = response.data;
        }
        return response.data;
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to update order';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async submitOrder(id: number) {
      this.loading = true;
      this.error = null;
      try {
        const response = await api.post(`/orders/${id}/submit`);
        const index = this.orders.findIndex(o => o.id === id);
        if (index !== -1) {
          this.orders[index] = response.data;
        }
        if (this.currentOrder?.id === id) {
          this.currentOrder = response.data;
        }
        return response.data;
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to submit order';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async updateOrderState(id: number, state: Order['state']) {
      this.loading = true;
      this.error = null;
      try {
        const response = await api.put(`/orders/${id}/state`, { state });
        const index = this.orders.findIndex(o => o.id === id);
        if (index !== -1) {
          this.orders[index] = response.data;
        }
        if (this.currentOrder?.id === id) {
          this.currentOrder = response.data;
        }
        return response.data;
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to update order state';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async fetchMessages(orderId: number) {
      this.loading = true;
      this.error = null;
      try {
        const response = await api.get(`/messages/${orderId}/order`);
        this.messages = response.data;
        return response.data;
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to fetch messages';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async sendMessage(orderId: number, message: string) {
      this.loading = true;
      this.error = null;
      try {
        const response = await api.post(`/messages/${orderId}/order`, { message });
        this.messages.push(response.data);
        // Перезагружаем сообщения
        await this.fetchMessages(orderId);
        return response.data;
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to send message';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async uploadFiles(orderId: number, files: File[]) {
      this.loading = true;
      this.error = null;
      try {
        const formData = new FormData();
        files.forEach(file => {
          formData.append('files', file);
        });
        const response = await api.post(`/orders/${orderId}/files`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        return response.data;
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to upload files';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async fetchFiles(orderId: number) {
      this.loading = true;
      this.error = null;
      try {
        const response = await api.get(`/orders/${orderId}/files`);
        return response.data;
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to fetch files';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async deleteFile(orderId: number, fileId: number) {
      this.loading = true;
      this.error = null;
      try {
        await api.delete(`/orders/${orderId}/files/${fileId}`);
        if (this.currentOrder?.files) {
          this.currentOrder.files = this.currentOrder.files.filter(f => f.id !== fileId);
        }
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to delete file';
        throw error;
      } finally {
        this.loading = false;
      }
    },
  },
});

