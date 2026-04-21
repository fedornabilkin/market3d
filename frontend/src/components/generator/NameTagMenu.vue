<template lang="pug">
.gen-settings-panel
  .gen-settings-header
    .gen-settings-header-title
      span.icon
        i.fa.fa-signature
      span Настройки надписи
    .gen-settings-header-actions
      button.gen-io-btn(
        type="button"
        @click="exportSettingsAsJson"
        title="Экспорт настроек"
      )
        i.fa.fa-download
      button.gen-io-btn(
        type="button"
        @click="$refs.importFileInput?.click()"
        title="Импорт настроек"
      )
        i.fa.fa-upload
      input(ref="importFileInput" type="file" accept=".json" style="display: none" @change="importSettingsFromFile")
  .gen-settings-body
    NameTagForm(:options='options' :unit='unit')

.gen-error(v-if="generateError") {{generateError}}

Teleport(to="#gen-progress-target" v-if="teleportReady")
  .gen-progress-wrapper
    .gen-progress-bar
      .gen-progress-fill(:class="{ 'is-active': isGenerating }" :style="{width: progressGenerating + '%'}")
      .gen-progress-text {{ generationSeconds.toFixed(3) }} сек
</template>

<script>
import { markRaw } from 'vue';
import NameTagForm from '@/components/forms/NameTagForm.vue';
import NameTagGenerator from '@/v3d/generator/NameTagGenerator';
import { NameTag } from '@/v3d/entity';

const defaultOptions = {
  nametag: new NameTag({ active: true }),
};

export default {
  name: 'NameTagMenu',
  props: {
    v3dFacade: Object,
  },
  components: {
    NameTagForm,
  },
  data: () => ({
    options: { ...defaultOptions },
    unit: 'mm',
    isGenerating: false,
    progressGenerating: 0,
    generationSeconds: 0,
    generateError: undefined,
    teleportReady: false,
  }),
  created() {
    this._autoGenTimer = null;
    this._suppressAutoGen = false;
    this._pendingAutoGen = false;
    this._genStart = 0;
    this._rafHandle = null;
  },
  mounted() {
    this.$nextTick(() => {
      this.teleportReady = true;
    });
    this.generate();
  },
  beforeUnmount() {
    if (this._autoGenTimer) {
      clearTimeout(this._autoGenTimer);
      this._autoGenTimer = null;
    }
    if (this._rafHandle) {
      cancelAnimationFrame(this._rafHandle);
      this._rafHandle = null;
    }
  },
  watch: {
    options: {
      handler() {
        if (this._suppressAutoGen) return;
        this.scheduleAutoGenerate();
      },
      deep: true,
    },
  },
  methods: {
    startGenTimer() {
      this._genStart = performance.now();
      this.generationSeconds = 0;
      if (this._rafHandle) cancelAnimationFrame(this._rafHandle);
      const tick = () => {
        if (!this.isGenerating) {
          this._rafHandle = null;
          return;
        }
        this.generationSeconds = (performance.now() - this._genStart) / 1000;
        this._rafHandle = requestAnimationFrame(tick);
      };
      this._rafHandle = requestAnimationFrame(tick);
    },
    stopGenTimer() {
      if (this._rafHandle) {
        cancelAnimationFrame(this._rafHandle);
        this._rafHandle = null;
      }
      if (this._genStart) {
        this.generationSeconds = (performance.now() - this._genStart) / 1000;
      }
    },
    scheduleAutoGenerate() {
      if (this._autoGenTimer) clearTimeout(this._autoGenTimer);
      this._autoGenTimer = setTimeout(() => {
        this._autoGenTimer = null;
        if (this.isGenerating) {
          this._pendingAutoGen = true;
          return;
        }
        this.generate();
      }, 250);
    },
    generate() {
      this.generateError = '';
      this.isGenerating = true;
      this.progressGenerating = 0;
      this.startGenTimer();
      this.$emit('generating');

      this._suppressAutoGen = true;
      this.$nextTick(() => {
        this._suppressAutoGen = false;
      });

      try {
        const generator = new NameTagGenerator(this.options.nametag);
        const meshes = generator.generate();

        const box = this.v3dFacade.getBox();
        box.clear();

        for (const [name, mesh] of Object.entries(meshes)) {
          if (mesh) {
            box.addNode(name, markRaw(mesh));
          }
        }

        box.placeAndFocusModel();

        this.progressGenerating = 100;
        this.$emit('exportReady', this.options);
      } catch (error) {
        this.generateError = `Ошибка генерации: ${error.message}`;
        console.error(error);
      } finally {
        this.isGenerating = false;
        this.stopGenTimer();
        if (this._pendingAutoGen) {
          this._pendingAutoGen = false;
          this.scheduleAutoGenerate();
        }
      }
    },
    exportSettingsAsJson() {
      const json = JSON.stringify(this.options, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nametag-settings-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    },
    importSettingsFromFile(event) {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result);
          Object.assign(this.options, parsed);
          this.generate();
        } catch (e) {
          this.generateError = `Ошибка импорта: ${e.message}`;
          console.error(e);
        }
        event.target.value = '';
      };
      reader.readAsText(file);
    },
  },
};
</script>

<style scoped>
.gen-settings-panel {
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: #fff;
}

.gen-settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem 0.5rem 1rem;
  font-weight: 600;
  font-size: 0.95rem;
  background: #f5f7fa;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  color: #363636;
}

.gen-settings-header-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.gen-settings-header-actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
}

.gen-settings-body {
  padding: 0.75rem;
}

.gen-error {
  margin-top: 0.75rem;
  padding: 0.65rem 1rem;
  border-radius: 8px;
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
  font-size: 0.875rem;
}

.gen-progress-wrapper {
  width: 100%;
}

.gen-progress-bar {
  position: relative;
  height: 22px;
  border-radius: 11px;
  background: rgba(229, 231, 235, 0.9);
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.gen-progress-fill {
  position: absolute;
  inset: 0 auto 0 0;
  background-color: #16a34a;
  background-image: linear-gradient(
    45deg,
    rgba(255, 255, 255, 0.22) 25%,
    transparent 25%,
    transparent 50%,
    rgba(255, 255, 255, 0.22) 50%,
    rgba(255, 255, 255, 0.22) 75%,
    transparent 75%,
    transparent
  );
  background-size: 22px 22px;
  border-radius: 11px;
  transition: width 0.15s ease;
}

.gen-progress-fill.is-active {
  animation: gen-progress-stripes 0.8s linear infinite;
}

@keyframes gen-progress-stripes {
  0%   { background-position: 0 0; }
  100% { background-position: 22px 0; }
}

.gen-progress-text {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.78rem;
  font-weight: 600;
  color: #0f172a;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
  pointer-events: none;
  text-shadow: 0 1px 2px rgba(255, 255, 255, 0.6);
}

.gen-io-btn {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border-radius: 6px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: #fff;
  color: #475569;
  font-size: 0.78rem;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}

.gen-io-btn:hover {
  background: #3273dc;
  border-color: #3273dc;
  color: #fff;
}
</style>
