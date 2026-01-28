import { defineStore } from 'pinia';
import api from '../services/api';

interface Material {
  id: number;
  name: string;
  dictionaryId?: number;
}

interface Printer {
  id: number;
  userId?: number;
  model_name: string;
  manufacturer: string;
  price_per_hour: number;
  state: 'available' | 'busy' | 'maintenance' | 'inactive';
  materials?: Material[];
  colors?: Material[];
  specifications?: Record<string, any>;
  maxBuildVolume?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}

interface PaginatedResponse {
  data: Printer[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

interface PrintersState {
  printers: Printer[];
  currentPrinter: Printer | null;
  loading: boolean;
  error: string | null;
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

export const usePrintersStore = defineStore('printers', {
  state: (): PrintersState => ({
    printers: [],
    currentPrinter: null,
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
    async fetchPrinters(filters: Record<string, any> = {}) {
      this.loading = true;
      this.error = null;
      try {
        const response = await api.get('/printers', { params: filters });
        if (response.data.data) {
          // Пагинированный ответ
          this.printers = response.data.data;
          this.pagination = {
            total: response.data.total,
            page: response.data.page,
            limit: response.data.limit,
            pages: response.data.pages,
          };
        } else {
          // Обычный массив (для обратной совместимости)
          this.printers = response.data;
        }
        return response.data;
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to fetch printers';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async fetchRecentPrinters(limit: number = 5) {
      this.loading = true;
      this.error = null;
      try {
        const response = await api.get('/printers/recent', { params: { limit } });
        return response.data;
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to fetch recent printers';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async fetchPrinterById(id: number) {
      this.loading = true;
      this.error = null;
      try {
        const response = await api.get(`/printers/${id}`);
        this.currentPrinter = response.data;
        // Информация о кластере уже включена в ответ от сервера
        return response.data;
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to fetch printer';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async createPrinter(printerData: Partial<Printer>) {
      this.loading = true;
      this.error = null;
      try {
        const response = await api.post('/printers', printerData);
        this.printers.push(response.data);
        return response.data;
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to create printer';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async updatePrinter(id: number, printerData: Partial<Printer>) {
      this.loading = true;
      this.error = null;
      try {
        const response = await api.put(`/printers/${id}`, printerData);
        const index = this.printers.findIndex(p => p.id === id);
        if (index !== -1) {
          this.printers[index] = response.data;
        }
        return response.data;
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to update printer';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async archivePrinter(id: number) {
      this.loading = true;
      this.error = null;
      try {
        await api.post(`/printers/${id}/archive`);
        this.printers = this.printers.filter(p => p.id !== id);
        if (this.currentPrinter?.id === id) {
          this.currentPrinter = null;
        }
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to archive printer';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async addMaterials(printerId: number, materialIds: number[]) {
      this.loading = true;
      this.error = null;
      try {
        const response = await api.post(`/printers/${printerId}/materials`, { materialIds });
        return response.data;
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to add materials';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async removeMaterials(printerId: number, materialIds: number[]) {
      this.loading = true;
      this.error = null;
      try {
        const response = await api.delete(`/printers/${printerId}/materials`, { data: { materialIds } });
        return response.data;
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to remove materials';
        throw error;
      } finally {
        this.loading = false;
      }
    },
  },
});

