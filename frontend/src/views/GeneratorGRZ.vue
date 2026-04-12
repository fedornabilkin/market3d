<template lang="pug">
.generator-page
  .generator-layout
    .generator-sidebar
      .container-settings(v-if="menuVisible()")
        GRZMenu(:v3dFacade="v3dFacade" @generating="generating" @exportReady="exportReady")

    .generator-main
      #gen-progress-target.gen-progress-target

      .container-3d
        .gen-viewport(id="container3d" :class="{ 'is-loading': isGenerating }")

      .gen-export-panel(v-if="expSettings.active")
        .gen-export-title
          span.icon
            i.fa.fa-file-export
          span {{$t('e.title')}}
        .gen-export-actions
          .gen-export-group
            button.button.is-primary.is-small.gen-export-btn(@click="exportSTL")
              span.icon
                i.fa.fa-cube
              span {{$t('e.buttonStl')}}
            label.gen-export-option
              input.checkbox(type='checkbox' v-model='expSettings.multiple')
              span {{ $t("e.multipleLabel") }}
            label.gen-export-option.is-hidden-mobile
              input.checkbox(type='checkbox' v-model='expSettings.ascii')
              span ASCII

          .gen-export-group
            button.button.is-info.is-small.gen-export-btn(@click="exportOBJ")
              span.icon
                i.fa.fa-cube
              span {{$t('e.buttonObj')}}

            button.button.is-small.gen-export-btn.is-warning(@click="exportPNG")
              span.icon
                i.fa.fa-image
              span PNG

  ExportModal(v-if="exportModalVisible" :isActive="exportModalVisible" @close="exportModalVisible=false")
</template>

<script>
import {markRaw} from 'vue';
import {V3DFacade} from '@/v3d/V3DFacade';
import GRZMenu from '@/components/generator/GRZMenu.vue';
import ExportModal from '@/components/generator/ExportModal.vue';

export default {
  name: 'GeneratorGRZ',
  components: {
    GRZMenu,
    ExportModal,
  },
  data() {
    return {
      expSettings: {
        active: false,
        ascii: false,
        multiple: false,
      },
      options: {},
      v3dFacade: null,
      sceneReady: false,
      exportModalVisible: false,
      isGenerating: false,
      exportTimer: 5000,
      camera: null,
      renderer: null,
      scene: null,
    }
  },
  created() {
    this.v3dFacade = markRaw(new V3DFacade({debug: false}))
  },
  mounted() {
    this.initScene()
    this.startAnimation()
  },
  methods: {
    menuVisible() {
      return this.sceneReady
    },
    initScene() {
      const container = document.getElementById('container3d')
      this.v3dFacade.initialize(container)

      this.camera = markRaw(this.v3dFacade.getCamera())
      this.renderer = markRaw(this.v3dFacade.getRenderer())
      this.scene = markRaw(this.v3dFacade.getScene())
      this.sceneReady = true
    },
    generating() {
      this.isGenerating = true
    },
    startAnimation() {
      this.v3dFacade.startAnimation((time) => {
        this.v3dFacade.getBox().animate(false, time)
      })
    },
    exportOBJ() {
      this.exportModalVisible = true
      setTimeout(async () => {
        await this.v3dFacade.exportOBJ(`${this.fileName()}.obj`)
      }, this.exportTimer)
    },
    exportSTL() {
      this.exportModalVisible = true
      setTimeout(async () => {
        await this.v3dFacade.exportSTL({
          binary: !this.expSettings.ascii,
          multiple: this.expSettings.multiple,
          filename: `${this.fileName()}.stl`,
        })
      }, this.exportTimer)
    },
    fileName() {
      const timestamp = new Date().getTime()
      const o = this.options
      let param = 'plate_'
      if (o.letter1) param += `${o.letter1}${o.digits}${o.letter2}${o.letter3}_${o.region}_`
      param += `${o.width || 65}mm_`
      return `${param}${timestamp}`
    },
    exportPNG() {
      const renderer = this.renderer
      const container = document.getElementById('container3d')
      const origWidth = container.clientWidth
      const origHeight = container.clientHeight
      const origPixelRatio = renderer.getPixelRatio()

      const scale = 3
      renderer.setPixelRatio(scale)
      renderer.setSize(origWidth, origHeight)
      renderer.render(this.scene, this.camera)

      const dataUrl = renderer.domElement.toDataURL('image/png')

      renderer.setPixelRatio(origPixelRatio)
      renderer.setSize(origWidth, origHeight)

      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `${this.fileName()}.png`
      a.click()
    },
    exportReady(options) {
      this.expSettings.active = true
      try {
        this.options = options
      } catch (error) {
        console.error(error)
      } finally {
        this.isGenerating = false
      }
    },
  },
}
</script>

<style>
/* === Generator Page Layout === */
.generator-page {
  max-width: 1400px;
  margin: 0 auto;
  padding: 1rem;
}

.generator-layout {
  display: flex;
  gap: 1.5rem;
  align-items: flex-start;
}

.generator-sidebar {
  flex: 1 1 55%;
  min-width: 0;
}

.generator-main {
  flex: 1 1 45%;
  min-width: 0;
  position: sticky;
  top: 4.5rem;
}

.container-settings {
  max-height: calc(100vh - 4rem);
  overflow: hidden;
  overflow-y: auto;
  padding-right: 4px;
  scrollbar-width: thin;
  scrollbar-color: rgba(128, 128, 128, 0.3) transparent;
}

.container-settings::-webkit-scrollbar {
  width: 5px;
}
.container-settings::-webkit-scrollbar-track {
  background: transparent;
}
.container-settings::-webkit-scrollbar-thumb {
  background: rgba(128, 128, 128, 0.3);
  border-radius: 4px;
}
.container-settings::-webkit-scrollbar-thumb:hover {
  background: rgba(128, 128, 128, 0.5);
}

/* === 3D Viewport === */
.container-3d {
  position: relative;
  z-index: 100;
}

.gen-progress-target {
  position: sticky;
  top: 0.5rem;
  z-index: 200;
  margin-bottom: 0.6rem;
}

.gen-progress-target:empty {
  display: none;
}

#container3d {
  width: 100%;
  height: 480px;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
  border: 1px solid rgba(0, 0, 0, 0.06);
  opacity: 1;
  transition: box-shadow 0.3s ease, opacity 0.3s ease;
}

#container3d:hover {
  box-shadow: 0 6px 32px rgba(0, 0, 0, 0.18);
}

#container3d.is-loading {
  animation: breathing 2s ease-in-out infinite;
}

@keyframes breathing {
  0% { opacity: 0.3; }
  50% { opacity: 1; }
  100% { opacity: 0.3; }
}

/* === Export Panel === */
.gen-export-panel {
  margin-top: 1rem;
  padding: 1rem 1.25rem;
  border-radius: 10px;
  background: #f8f9fb;
  border: 1px solid rgba(0, 0, 0, 0.06);
}

.gen-export-title {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-weight: 600;
  font-size: 0.9rem;
  margin-bottom: 0.75rem;
  color: #363636;
}

.gen-export-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.gen-export-group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
}

.gen-export-btn {
  border-radius: 6px !important;
}

.gen-export-option {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem 0.6rem;
  border-radius: 6px;
  background: #fff;
  border: 1px solid #dbdbdb;
  font-size: 0.8rem;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.gen-export-option:hover {
  background: #f0f0f0;
  border-color: #b5b5b5;
}

/* === Responsive === */
@media screen and (max-width: 1023px) {
  .generator-layout {
    flex-direction: column;
  }
  .generator-sidebar {
    flex: none;
    width: 100%;
  }
  .generator-main {
    position: static;
    width: 100%;
  }
  .container-settings {
    max-height: none;
    overflow: visible;
  }
  #container3d {
    height: 320px;
  }
}
</style>
