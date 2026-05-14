<template lang="pug">
.gen-settings-panel
  .gen-settings-header
    .gen-settings-header-title
      span.icon
        i.fa.fa-sliders-h
      span {{$t('form.optionsTitle')}}
    .gen-settings-header-actions
      button.gen-io-btn(
        type="button"
        @click="exportSettingsAsJson"
        :title="$t('form.exportSettings')"
        :aria-label="$t('form.exportSettings')"
      )
        i.fa.fa-download
      button.gen-io-btn(
        type="button"
        @click="$refs.importFileInput?.click()"
        :title="$t('form.importSettings')"
        :aria-label="$t('form.importSettings')"
      )
        i.fa.fa-upload
      input(ref="importFileInput" type="file" accept=".json" style="display: none" @change="importSettingsFromFile")
  .gen-settings-body
    Base(:options="options" :unit="unit")
    Barcode(:options="options" :unit="unit")
    Text(:options="options" :unit="unit")
    Border(:options="options" :unit="unit")
    Keychain(:options="options" :unit="unit")
    Magnet(:options="options" :unit="unit")

.gen-error(v-if="generateError") {{generateError}}

Teleport(to="#gen-progress-target" v-if="teleportReady")
  .gen-progress-wrapper
    .gen-progress-bar
      .gen-progress-fill(:class="{ 'is-active': isGenerating }" :style="{width: progressGenerating + '%'}")
      .gen-progress-text {{ generationSeconds.toFixed(3) }} {{ $t('g.seconds') }}
</template>

<script>
import { Director } from "@/v3d/director";
import {
  Barcode as BarcodeEntity,
  Base as BaseEntity,
  Border as BorderEntity,
  Code as CodeEntity,
  Keychain as KeychainEntity,
  Magnet as MagnetEntity,
  Text as TextEntity,
} from "@/v3d/entity";
import Base from "@/components/forms/Base.vue";
import Barcode from "@/components/forms/Barcode.vue";
import Text from "@/components/forms/Text.vue";
import Border from "@/components/forms/Border.vue";
import Keychain from "@/components/forms/Keychain.vue";
import Magnet from "@/components/forms/Magnet.vue";
import { createCode128Pattern, createCode128SvgDataUrl } from "@/service/barcode/code128";
import { buildGeneratorSettingsFileName, buildGeneratorSettingsPayload } from "@/service/generatorSettingsFileName";

const director = new Director()

const defaultOptions = {
  base: new BaseEntity({ active: true, width: 70, height: 45, depth: 3, cornerRadius: 4 }),
  border: new BorderEntity({ active: true }),
  code: new CodeEntity(),
  barcode: new BarcodeEntity({ active: true }),
  text: new TextEntity({ active: false, message: 'VSQR-12345', size: 5, offsetY: -17 }),
  keychain: new KeychainEntity(),
  magnet: new MagnetEntity(),
}

export default {
  name: 'BarcodeMenu',
  props: {
    initData: Object,
    v3dFacade: Object,
  },
  components: {
    Magnet,
    Keychain,
    Border,
    Text,
    Barcode,
    Base,
  },
  data: () => ({
    options: defaultOptions,
    barcodePattern: null,
    unit: 'mm',
    isGenerating: false,
    progressGenerating: 0,
    generationSeconds: 0,
    generateError: undefined,
    teleportReady: false,
  }),
  created() {
    this._autoGenTimer = null
    this._suppressAutoGen = false
    this._pendingAutoGen = false
    this._genStart = 0
    this._rafHandle = null
  },
  mounted() {
    if (this.initData) {
      director.buildGroupBuilder(this.initData)
      this.options = Object.assign(this.options, director.getEntities())
    }
    this.$nextTick(() => {
      this.teleportReady = true
    })
    this.prepareData()
  },
  beforeUnmount() {
    if (this._autoGenTimer) clearTimeout(this._autoGenTimer)
    if (this._rafHandle) cancelAnimationFrame(this._rafHandle)
  },
  watch: {
    options: {
      handler() {
        if (this._suppressAutoGen) return
        this.scheduleAutoGenerate()
      },
      deep: true,
    },
  },
  methods: {
    startGenTimer() {
      this._genStart = performance.now()
      this.generationSeconds = 0
      if (this._rafHandle) cancelAnimationFrame(this._rafHandle)
      const tick = () => {
        if (!this.isGenerating) {
          this._rafHandle = null
          return
        }
        this.generationSeconds = (performance.now() - this._genStart) / 1000
        this._rafHandle = requestAnimationFrame(tick)
      }
      this._rafHandle = requestAnimationFrame(tick)
    },
    stopGenTimer() {
      if (this._rafHandle) {
        cancelAnimationFrame(this._rafHandle)
        this._rafHandle = null
      }
      if (this._genStart) {
        this.generationSeconds = (performance.now() - this._genStart) / 1000
      }
    },
    scheduleAutoGenerate() {
      if (this._autoGenTimer) clearTimeout(this._autoGenTimer)
      this._autoGenTimer = setTimeout(() => {
        this._autoGenTimer = null
        if (this.isGenerating) {
          this._pendingAutoGen = true
          return
        }
        this.prepareData()
      }, 150)
    },
    async render3d() {
      if (!this.v3dFacade) {
        this.generateError = 'V3D Facade not initialized'
        this.isGenerating = false
        this.stopGenTimer()
        return
      }

      try {
        if (this.barcodePattern) {
          this.v3dFacade.setBarcodePattern(this.barcodePattern)
        }
        await this.v3dFacade.generateModel(this.options, (percent) => {
          this.progressGenerating = percent
        })
        this.$emit('exportReady', this.options)
      } catch (error) {
        this.generateError = `Error during generation: ${error.message}`
        console.error(error)
      } finally {
        this.isGenerating = false
        this.stopGenTimer()
        if (!this.generateError) this.progressGenerating = 100
        if (this._pendingAutoGen) {
          this._pendingAutoGen = false
          this.scheduleAutoGenerate()
        }
      }
    },
    prepareData() {
      this.generateError = ''
      this.isGenerating = true
      this.progressGenerating = 0
      this.startGenTimer()
      this.$emit('generating')

      this._suppressAutoGen = true
      this.$nextTick(() => {
        this._suppressAutoGen = false
      })

      if (this.options.barcode.active) {
        try {
          this.barcodePattern = createCode128Pattern(this.options.barcode.content)
          this.options.barcode.preview.src = createCode128SvgDataUrl(this.barcodePattern, {
            foreground: this.options.barcode.color || '#000000',
          })
        } catch (e) {
          this.generateError = `Error during generation: ${e.message}`
          this.isGenerating = false
          this.stopGenTimer()
          return
        }
      }

      this.render3d()
    },
    getEntityPayload(entity) {
      if (entity && typeof entity.toJSON === 'function') return entity.toJSON()
      return { ...entity }
    },
    exportOptions() {
      return {
        base: this.getEntityPayload(this.options.base),
        border: this.getEntityPayload(this.options.border),
        code: this.getEntityPayload(this.options.code),
        barcode: this.getEntityPayload(this.options.barcode),
        text: this.getEntityPayload(this.options.text),
        keychain: this.getEntityPayload(this.options.keychain),
        magnet: this.getEntityPayload(this.options.magnet),
      }
    },
    exportSettingsAsJson() {
      const json = JSON.stringify(buildGeneratorSettingsPayload(this.exportOptions()), null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = buildGeneratorSettingsFileName('barcode', this.options)
      a.click()
      URL.revokeObjectURL(url)
    },
    importSettingsFromFile(event) {
      const file = event.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result)
          director.buildGroupBuilder(parsed)
          const entities = director.getEntities()
          this.options.base = entities.base
          this.options.border = entities.border
          this.options.code = entities.code
          this.options.barcode = entities.barcode
          this.options.text = entities.text
          this.options.keychain = entities.keychain
          this.options.magnet = entities.magnet
          this.prepareData()
        } catch (e) {
          this.generateError = `Import failed: ${e.message}`
          console.error(e)
        }
        event.target.value = ''
      }
      reader.readAsText(file)
    },
  },
}
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

.gen-settings-header-title,
.gen-settings-header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.gen-settings-body {
  padding: 0.75rem;
  border: 2px solid transparent;
  border-top: 0;
  border-radius: 0 0 10px 10px;
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
  background-image: linear-gradient(45deg, rgba(255, 255, 255, 0.22) 25%, transparent 25%, transparent 50%, rgba(255, 255, 255, 0.22) 50%, rgba(255, 255, 255, 0.22) 75%, transparent 75%, transparent);
  background-size: 22px 22px;
  border-radius: 11px;
  transition: width 0.15s ease;
}

.gen-progress-fill.is-active {
  animation: gen-progress-stripes 0.8s linear infinite;
}

@keyframes gen-progress-stripes {
  0% { background-position: 0 0; }
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
  pointer-events: none;
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
}

.gen-io-btn:hover {
  background: #3273dc;
  border-color: #3273dc;
  color: #fff;
}
</style>
