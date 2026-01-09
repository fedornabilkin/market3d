import { defineStore } from 'pinia';
import api from '../services/api';

interface Dictionary {
  id: number;
  name: string;
  description?: string;
  state: 'active' | 'draft' | 'archived';
  createdAt?: string;
  updatedAt?: string;
}

interface DictionaryItem {
  id: number;
  dictionaryId: number;
  parentId?: number | null;
  name: string;
  createdAt?: string;
  updatedAt?: string;
}

interface DictionariesState {
  dictionaries: Dictionary[];
  items: DictionaryItem[];
  loading: boolean;
  error: string | null;
}

export const useDictionariesStore = defineStore('dictionaries', {
  state: (): DictionariesState => ({
    dictionaries: [],
    items: [],
    loading: false,
    error: null,
  }),

  actions: {
    async fetchDictionaries(filters: Record<string, any> = {}) {
      this.loading = true;
      this.error = null;
      try {
        const response = await api.get('/dictionaries', { params: filters });
        this.dictionaries = response.data;
        return response.data;
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to fetch dictionaries';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async fetchDictionaryById(id: number) {
      this.loading = true;
      this.error = null;
      try {
        const response = await api.get(`/dictionaries/${id}`);
        return response.data;
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to fetch dictionary';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async fetchItemsByDictionary(dictionaryId: number, filters: Record<string, any> = {}) {
      this.loading = true;
      this.error = null;
      try {
        const response = await api.get(`/dictionaries/${dictionaryId}/items`, { params: filters });
        this.items = response.data;
        return response.data;
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to fetch dictionary items';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async fetchItemsByDictionaryName(dictionaryName: string, parentId?: number) {
      this.loading = true;
      this.error = null;
      try {
        const params: Record<string, any> = {};
        if (parentId !== undefined) {
          params.parentId = parentId;
        }
        const response = await api.get(`/dictionaries/${dictionaryName}/items`, { params });
        this.items = response.data;
        return response.data;
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to fetch dictionary items';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async createDictionary(dictionaryData: Partial<Dictionary>) {
      this.loading = true;
      this.error = null;
      try {
        const response = await api.post('/dictionaries', dictionaryData);
        this.dictionaries.push(response.data);
        return response.data;
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to create dictionary';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async updateDictionary(id: number, dictionaryData: Partial<Dictionary>) {
      this.loading = true;
      this.error = null;
      try {
        const response = await api.put(`/dictionaries/${id}`, dictionaryData);
        const index = this.dictionaries.findIndex(d => d.id === id);
        if (index !== -1) {
          this.dictionaries[index] = response.data;
        }
        return response.data;
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to update dictionary';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async archiveDictionary(id: number) {
      this.loading = true;
      this.error = null;
      try {
        await api.delete(`/dictionaries/${id}`);
        this.dictionaries = this.dictionaries.filter(d => d.id !== id);
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to archive dictionary';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async createItem(dictionaryName: string, itemData: Partial<DictionaryItem>) {
      this.loading = true;
      this.error = null;
      try {
        const response = await api.post(`/dictionaries/${dictionaryName}/items`, itemData);
        this.items.push(response.data);
        return response.data;
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to create dictionary item';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async updateItem(itemId: number, itemData: Partial<DictionaryItem>) {
      this.loading = true;
      this.error = null;
      try {
        const response = await api.put(`/dictionaries/items/${itemId}`, itemData);
        const index = this.items.findIndex(i => i.id === itemId);
        if (index !== -1) {
          this.items[index] = response.data;
        }
        return response.data;
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to update dictionary item';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async deleteItem(itemId: number) {
      this.loading = true;
      this.error = null;
      try {
        await api.delete(`/dictionaries/items/${itemId}`);
        this.items = this.items.filter(i => i.id !== itemId);
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to delete dictionary item';
        throw error;
      } finally {
        this.loading = false;
      }
    },
  },
});

