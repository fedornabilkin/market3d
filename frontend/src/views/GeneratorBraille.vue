<template lang="pug">
.generator-page
  .generator-layout
    .generator-sidebar
      .container-settings(v-if="menuVisible()")
        BrailleMenu(:v3dFacade="v3dFacade" @generating="generating" @exportReady="exportReady")

    .generator-main
      DonateCard

      #gen-progress-target.gen-progress-target

      .container-3d
        .gen-viewport(id="container3d" :class="{ 'is-loading': isGenerating }")

      ExportPanel(
        v-if="expSettings.active"
        v-model:multiple="expSettings.multiple"
        v-model:ascii="expSettings.ascii"
        @exportSTL="exportSTL"
        @exportOBJ="exportOBJ"
        @exportPNG="exportPNG"
      )
        button.button.is-small.gen-export-btn(@click="historyDownloadModalVisible=true")
          span.icon
            i.fa.fa-calendar-day(aria-hidden="true")
          span.is-hidden-mobile {{$t('e.downloadHistory')}}
          span ({{ storeExport.getCollection().length }})

        button.button.is-small.gen-export-btn(v-if="storeExport.getDownloadAll() > 0")
          span.icon
            i.fa.fa-arrow-circle-down(aria-hidden="true")
          span.is-hidden-mobile {{$t('e.downloadAll')}}
          span ({{ storeExport.getDownloadAll() }})

  ExportModal(v-if="exportModalVisible" :isActive="exportModalVisible" @close="exportModalVisible=false")

  HistoryModal(
    v-if="historyDownloadModalVisible"
    :isActive="historyDownloadModalVisible"
    :store="storeExport"
    :title="$t('e.downloadHistory')"
    @recovery="recoveryModel"
    @close="historyDownloadModalVisible=false"
  )
</template>

<script>
import {markRaw} from 'vue';
import {V3DFacade} from '@/v3d/V3DFacade';
import {useExportList} from "@/store/exportList";
import {Share} from "@/entity/share";
import DonateCard from "@/components/monetisation/DonateCard.vue";
import BrailleMenu from '@/components/generator/BrailleMenu.vue';
import ExportModal from '@/components/generator/ExportModal.vue';
import ExportPanel from '@/components/generator/ExportPanel.vue';
import HistoryModal from "@/components/generator/HistoryModal.vue";

const exportList = useExportList()

export default {
  name: 'GeneratorBraille',
  components: {
    DonateCard,
    BrailleMenu,
    ExportModal,
    ExportPanel,
    HistoryModal,
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
      historyDownloadModalVisible: false,
      storeExport: null,
      isGenerating: false,
      exportTimer: 5000,
      camera: null,
      renderer: null,
      scene: null,
    }
  },
  created() {
    this.fillExportList()
    this.v3dFacade = markRaw(new V3DFacade({debug: false}))
    this.storeExport = exportList
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

        const image = this.v3dFacade.getImageDataUrl()
        exportList.add(this.createShare(image))
        exportList.downloadAllUpdate()
        window.localStorage.setItem(exportList.keyStoreAll, exportList.getDownloadAll())
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

        const image = this.v3dFacade.getImageDataUrl()
        exportList.add(this.createShare(image))
        exportList.downloadAllUpdate()
        window.localStorage.setItem(exportList.keyStoreAll, exportList.getDownloadAll())
      }, this.exportTimer)
    },
    fileName() {
      const timestamp = new Date().getTime()
      const text = (this.options.text || 'braille').substring(0, 20).replace(/\s+/g, '_')
      return `braille_${this.options.dotMode || 6}dot_${text}_${timestamp}`
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
    createShare(src) {
      return new Share({img: {src: src}, options: this.options, date: new Date().getTime()})
    },
    fillExportList() {
      const list = JSON.parse(window.localStorage.getItem(exportList.keyStore)) || []
      const collection = list.map((item) => new Share(item))
      exportList.fillCollection(collection)
      exportList.setCallback((collection) => {
        window.localStorage.setItem(exportList.keyStore, JSON.stringify(collection))
      })

      let downloadAll = window.localStorage.getItem(exportList.keyStoreAll)
      if (collection.length > 0 && collection.length > downloadAll) {
        downloadAll = collection.length
      }
      exportList.setDownloadAll(downloadAll)
    },
    recoveryModel(item) {
      this.options = JSON.parse(item.options)
    },
  },
}
</script>

<style>
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
