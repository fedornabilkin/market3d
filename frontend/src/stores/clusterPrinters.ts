import { defineStore } from 'pinia';
import api from '../services/api';
import type { ClusterPrinter } from '../types/cluster';

interface ClusterPrintersState {
  printers: ClusterPrinter[];
  loading: boolean;
  error: string | null;
}

export const useClusterPrintersStore = defineStore('clusterPrinters', {
  state: (): ClusterPrintersState => ({
    printers: [],
    loading: false,
    error: null,
  }),

  actions: {
    async fetchClusterPrinters(clusterId: number) {
      this.loading = true;
      this.error = null;
      try {
        const response = await api.get(`/clusters/${clusterId}/printers`);
        this.printers = response.data;
        return response.data;
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to fetch cluster printers';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async attachPrinter(clusterId: number, printerId: number) {
      this.loading = true;
      this.error = null;
      try {
        const response = await api.post(`/clusters/${clusterId}/printers/${printerId}`);
        return response.data;
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to attach printer';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async detachPrinter(clusterId: number, printerId: number) {
      this.loading = true;
      this.error = null;
      try {
        await api.delete(`/clusters/${clusterId}/printers/${printerId}`);
        this.printers = this.printers.filter(p => !(p.clusterId === clusterId && p.printerId === printerId));
        return true;
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to detach printer';
        throw error;
      } finally {
        this.loading = false;
      }
    },
  },
});


