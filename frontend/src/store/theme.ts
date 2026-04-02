import { defineStore } from 'pinia';

const STORAGE_KEY = 'app-theme';

export type ThemePreference = 'light' | 'dark' | 'system';

function readStoredTheme(): ThemePreference {
  if (typeof window === 'undefined') return 'system';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  return 'system';
}

function getSystemPrefersDark(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export const useThemeStore = defineStore('theme', {
  state: () => ({
    theme: readStoredTheme() as ThemePreference,
    systemPrefersDark: getSystemPrefersDark(),
  }),

  getters: {
    effectiveTheme(state): 'light' | 'dark' {
      if (state.theme !== 'system') return state.theme;
      return state.systemPrefersDark ? 'dark' : 'light';
    },
  },

  actions: {
    setTheme(value: ThemePreference) {
      this.theme = value;
      localStorage.setItem(STORAGE_KEY, value);
    },

    initSystemListener() {
      if (typeof window === 'undefined') return;
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => {
        this.systemPrefersDark = mq.matches;
      };
      mq.addEventListener('change', handler);
      this.systemPrefersDark = mq.matches;
    },
  },
});
