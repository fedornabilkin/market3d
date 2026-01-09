import { defineStore } from 'pinia';
import api from '../services/api';
import type { ClusterPrinterRequest } from '../types/cluster';

interface ClusterPrinterRequestsState {
  requests: ClusterPrinterRequest[];
  loading: boolean;
  error: string | null;
}

export const useClusterPrinterRequestsStore = defineStore('clusterPrinterRequests', {
  state: (): ClusterPrinterRequestsState => ({
    requests: [],
    loading: false,
    error: null,
  }),

  actions: {
    async fetchClusterRequests(clusterId: number) {
      this.loading = true;
      this.error = null;
      try {
        const response = await api.get(`/clusters/${clusterId}/requests`);
        this.requests = response.data;
        return response.data;
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to fetch cluster requests';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async fetchPrinterRequests(printerId: number) {
      this.loading = true;
      this.error = null;
      try {
        const response = await api.get(`/clusters/printers/${printerId}/requests`);
        this.requests = response.data;
        return response.data;
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to fetch printer requests';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async fetchMyRequests() {
      this.loading = true;
      this.error = null;
      try {
        const response = await api.get('/clusters/requests/my');
        this.requests = response.data;
        return response.data;
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to fetch my requests';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async createRequest(clusterId: number, printerId: number, message?: string) {
      this.loading = true;
      this.error = null;
      try {
        const response = await api.post(`/clusters/${clusterId}/printers/${printerId}/request`, { message });
        this.requests.push(response.data);
        return response.data;
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to create request';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async approveRequest(requestId: number) {
      this.loading = true;
      this.error = null;
      try {
        const response = await api.post(`/clusters/requests/${requestId}/approve`);
        const index = this.requests.findIndex(r => r.id === requestId);
        if (index !== -1) {
          this.requests[index] = response.data.request;
        }
        return response.data;
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to approve request';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async rejectRequest(requestId: number) {
      this.loading = true;
      this.error = null;
      try {
        const response = await api.post(`/clusters/requests/${requestId}/reject`);
        const index = this.requests.findIndex(r => r.id === requestId);
        if (index !== -1) {
          this.requests[index] = response.data.request;
        }
        return response.data;
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to reject request';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async cancelRequest(requestId: number) {
      this.loading = true;
      this.error = null;
      try {
        const response = await api.post(`/clusters/requests/${requestId}/cancel`);
        const index = this.requests.findIndex(r => r.id === requestId);
        if (index !== -1) {
          this.requests[index] = response.data.request;
        }
        return response.data;
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to cancel request';
        throw error;
      } finally {
        this.loading = false;
      }
    },
  },
});


