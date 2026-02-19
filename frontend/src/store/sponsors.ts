import { defineStore } from 'pinia';
import { Sponsor } from '../entity/sponsor';
import { SponsorBuilder } from '../entity/builder';

interface SponsorsState {
  list: Sponsor[];
  loading: boolean;
  error: string | null;
}

export const useSponsorsStore = defineStore('sponsors', {
  state: (): SponsorsState => ({
    list: [],
    loading: false,
    error: null,
  }),

  getters: {
    hasSponsors: (state): boolean => state.list.length > 0,
  },

  actions: {
    async fetchSponsors() {
      this.loading = true;
      this.error = null;
      
      try {
        let endpointApi = `/api/sponsor`;

        const host = window.location.host;
        if (host.includes('localhost')) {
          const noderedHost = import.meta.env.VITE_NODERED_HOST;
          endpointApi = `${noderedHost || 'localhost'}${endpointApi}`;
        }

        const response = await fetch(endpointApi);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const responseData = await response.json();
        const builder = new SponsorBuilder();
        // API может возвращать { data: [...] } или просто массив
        const sponsorsData = responseData.data || responseData || [];
        // createCollection ожидает объект, но работает и с массивом
        // Если это массив, преобразуем в объект с числовыми ключами
        const dataToProcess = Array.isArray(sponsorsData) 
          ? sponsorsData.reduce((acc, item, index) => {
              acc[index] = item;
              return acc;
            }, {} as Record<string, any>)
          : sponsorsData;
        builder.createCollection(dataToProcess);
        this.list = builder.getCollection();
      } catch (error: any) {
        this.error = error.message || 'Failed to fetch sponsors';
        console.error('Error fetching sponsors:', error);
        this.list = [];
      } finally {
        this.loading = false;
      }
    },
  },
});
