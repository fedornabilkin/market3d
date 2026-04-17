import { defineStore } from 'pinia';

const SEEN_STEPS_KEY = 'site-tour-seen-steps';

type PageKey = 'Main' | 'GeneratorQR' | 'GeneratorGRZ' | 'GeneratorBraille' | 'GeneratorCoaster' | 'GeneratorNameTag' | 'Constructor';

function loadSeenSteps(): Record<string, true> {
  try {
    const raw = localStorage.getItem(SEEN_STEPS_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw);
    return typeof data === 'object' && data ? data : {};
  } catch (e) {
    return {};
  }
}

export const useTourStore = defineStore('tour', {
  state: () => ({
    mainOpen: false,
    qrOpen: false,
    grzOpen: false,
    brailleOpen: false,
    coasterOpen: false,
    nameTagOpen: false,
    constructorOpen: false,
    seenSteps: loadSeenSteps() as Record<string, true>,
  }),

  actions: {
    closeAll() {
      this.mainOpen = false;
      this.qrOpen = false;
      this.grzOpen = false;
      this.brailleOpen = false;
      this.coasterOpen = false;
      this.nameTagOpen = false;
      this.constructorOpen = false;
    },
    openFor(page: PageKey) {
      this.closeAll();
      setTimeout(() => {
        if (page === 'Main') this.mainOpen = true;
        else if (page === 'GeneratorQR') this.qrOpen = true;
        else if (page === 'GeneratorGRZ') this.grzOpen = true;
        else if (page === 'GeneratorBraille') this.brailleOpen = true;
        else if (page === 'GeneratorCoaster') this.coasterOpen = true;
        else if (page === 'GeneratorNameTag') this.nameTagOpen = true;
        else if (page === 'Constructor') this.constructorOpen = true;
      }, 0);
    },
    persistSeen() {
      try { localStorage.setItem(SEEN_STEPS_KEY, JSON.stringify(this.seenSteps)); } catch (e) {}
    },
    markStepSeen(name: string) {
      if (!name || this.seenSteps[name]) return;
      this.seenSteps = { ...this.seenSteps, [name]: true };
      this.persistSeen();
    },
    markAllSeen(steps: string[]) {
      let changed = false;
      const next = { ...this.seenSteps };
      for (const s of steps) {
        if (!next[s]) { next[s] = true; changed = true; }
      }
      if (changed) {
        this.seenSteps = next;
        this.persistSeen();
      }
    },
    firstUnseenIndex(steps: string[]): number {
      for (let i = 0; i < steps.length; i++) {
        if (!this.seenSteps[steps[i]]) return i;
      }
      return -1;
    },
    hasUnseen(steps: string[]): boolean {
      return this.firstUnseenIndex(steps) !== -1;
    },
    startStepFor(steps: string[]): number {
      const idx = this.firstUnseenIndex(steps);
      return idx === -1 ? 0 : idx;
    },
  },
});

export type { PageKey };
