import { defineStore } from 'pinia';
import api from '../services/api';
import type { Cluster } from '../types/cluster';

interface ClustersState {
  clusters: Cluster[];
  currentCluster: Cluster | null;
  loading: boolean;
  error: string | null;
}

export const useClustersStore = defineStore('clusters', {
  state: (): ClustersState => ({
    clusters: [],
    currentCluster: null,
    loading: false,
    error: null,
  }),

  actions: {
    async fetchClusters(filters: Record<string, any> = {}) {
      this.loading = true;
      this.error = null;
      try {
        const response = await api.get('/clusters', { params: filters });
        this.clusters = response.data.data || response.data;
        return response.data;
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to fetch clusters';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async fetchActiveClusters() {
      this.loading = true;
      this.error = null;
      try {
        const response = await api.get('/clusters/active');
        this.clusters = response.data;
        return response.data;
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to fetch active clusters';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async fetchClusterById(id: number) {
      this.loading = true;
      this.error = null;
      try {
        const response = await api.get(`/clusters/${id}`);
        this.currentCluster = response.data;
        return response.data;
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to fetch cluster';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async createCluster(data: Partial<Cluster>) {
      this.loading = true;
      this.error = null;
      try {
        const response = await api.post('/clusters', data);
        this.clusters.push(response.data);
        return response.data;
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to create cluster';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async updateCluster(id: number, data: Partial<Cluster>) {
      this.loading = true;
      this.error = null;
      try {
        const response = await api.put(`/clusters/${id}`, data);
        const index = this.clusters.findIndex(c => c.id === id);
        if (index !== -1) {
          this.clusters[index] = response.data;
        }
        if (this.currentCluster?.id === id) {
          this.currentCluster = response.data;
        }
        return response.data;
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to update cluster';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async activateCluster(id: number) {
      this.loading = true;
      this.error = null;
      try {
        const response = await api.post(`/clusters/${id}/activate`);
        const index = this.clusters.findIndex(c => c.id === id);
        if (index !== -1) {
          this.clusters[index] = response.data;
        }
        if (this.currentCluster?.id === id) {
          this.currentCluster = response.data;
        }
        return response.data;
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to activate cluster';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async archiveCluster(id: number) {
      this.loading = true;
      this.error = null;
      try {
        await api.post(`/clusters/${id}/archive`);
        this.clusters = this.clusters.filter(c => c.id !== id);
        if (this.currentCluster?.id === id) {
          this.currentCluster = null;
        }
        return true;
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to archive cluster';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async fetchClusterOrders(clusterId: number) {
      this.loading = true;
      this.error = null;
      try {
        const response = await api.get(`/clusters/${clusterId}/orders`);
        return response.data;
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to fetch cluster orders';
        throw error;
      } finally {
        this.loading = false;
      }
    },
  },
});


