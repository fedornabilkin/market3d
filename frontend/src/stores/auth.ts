import { defineStore } from 'pinia';
import api from '../services/api';

interface User {
  id: number;
  email: string;
  emailVerified?: boolean;
  createdAt?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    token: null,
    loading: false,
    error: null,
  }),

  getters: {
    isAuthenticated: (state): boolean => !!state.token,
  },

  actions: {
    async register(email: string, password: string) {
      this.loading = true;
      this.error = null;
      try {
        const response = await api.post('/auth/register', {
          email,
          password,
        });
        this.token = response.data.token;
        this.user = response.data.user;
        localStorage.setItem('token', this.token);
        localStorage.setItem('user', JSON.stringify(this.user));
        return response.data;
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Registration failed';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async login(email: string, password: string) {
      this.loading = true;
      this.error = null;
      try {
        const response = await api.post('/auth/login', {
          email,
          password,
        });
        this.token = response.data.token;
        this.user = response.data.user;
        localStorage.setItem('token', this.token);
        localStorage.setItem('user', JSON.stringify(this.user));
        return response.data;
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Login failed';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async getProfile() {
      try {
        const response = await api.get('/auth/profile');
        this.user = response.data;
        localStorage.setItem('user', JSON.stringify(this.user));
        return response.data;
      } catch (error) {
        this.logout();
        throw error;
      }
    },

    logout() {
      this.user = null;
      this.token = null;
      this.error = null;
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    },

    init() {
      const token = localStorage.getItem('token');
      const user = localStorage.getItem('user');
      if (token && user) {
        this.token = token;
        this.user = JSON.parse(user);
      }
    },

    async updateProfile(data: Partial<User>) {
      this.loading = true;
      this.error = null;
      try {
        const response = await api.put('/auth/profile', data);
        this.user = { ...this.user, ...response.data };
        localStorage.setItem('user', JSON.stringify(this.user));
        return response.data;
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to update profile';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async changePassword(oldPassword: string, newPassword: string) {
      this.loading = true;
      this.error = null;
      try {
        const response = await api.post('/auth/change-password', {
          oldPassword,
          newPassword,
        });
        return response.data;
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to change password';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async requestEmailChange(newEmail: string) {
      this.loading = true;
      this.error = null;
      try {
        const response = await api.post('/auth/request-email-change', {
          newEmail,
        });
        return response.data;
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to request email change';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async confirmEmailChange(code: string) {
      this.loading = true;
      this.error = null;
      try {
        const response = await api.post('/auth/confirm-email-change', {
          code,
        });
        await this.getProfile();
        return response.data;
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to confirm email change';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async verifyEmail(code: string) {
      this.loading = true;
      this.error = null;
      try {
        const response = await api.post('/auth/verify-email', {
          code,
        });
        await this.getProfile();
        return response.data;
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to verify email';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async requestNewVerificationCode() {
      this.loading = true;
      this.error = null;
      try {
        const response = await api.post('/auth/request-new-code');
        return response.data;
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to request new code';
        if (error.response?.data?.remainingSeconds) {
          throw { ...error, remainingSeconds: error.response.data.remainingSeconds };
        }
        throw error;
      } finally {
        this.loading = false;
      }
    },
  },
});

