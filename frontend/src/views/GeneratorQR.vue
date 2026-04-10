<template lang="pug">
.generator-page
  .generator-layout
    .generator-sidebar
      .container-settings(v-if="qrMenuVisible()")
        QRCodeMenu(:v3dFacade="v3dFacade" :initData="shareData" @generating="generating" @exportReady="exportReady")

        button.button.gen-history-btn(v-if="hasGenerateList" @click="historyModalVisible=true")
          span.icon
            i.fa.fa-calendar-day(aria-hidden="true")
          span {{$t('g.historyButton')}} ({{ storeGenerate.getCollection().length }})

    .generator-main
      .gen-donate-card
        .gen-donate-inner
          .gen-donate-text
            | Скинь на кофе разработчику
            br
            PaymentMethodsButton
          .gen-donate-sponsors.is-hidden-mobile
            SponsorList

      .container-3d
        .gen-viewport(id="container3d" :class="{ 'is-loading': isGenerating }")

      .gen-tooltip(v-if="randomTooltip.content")
        .gen-tooltip-text {{ randomTooltip.content }}

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
  v-if="historyModalVisible"
  :isActive="historyModalVisible"
  :store="storeGenerate"
  :title="$t('g.historyButton')"
  @recovery="recoveryModel"
  @close="historyModalVisible=false"
)

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
import * as THREE from 'three';
import {markRaw} from 'vue';
import {V3DFacade} from "@/v3d/V3DFacade";
import {useShareHash} from "@/service/shareHash";
import {useUrlCreator} from "@/service/urlCreator.js";
import {useExportList} from "@/store/exportList";
import {useGenerateList} from "@/store/generateList";
import QRCodeMenu from '@/components/generator/QRCodeMenu.vue';
import ExportList from "@/components/generator/ExportList.vue";
import ExportModal from '@/components/generator/ExportModal.vue';
import HistoryModal from "@/components/generator/HistoryModal.vue";
import ShareModal from "@/components/generator/ShareModal.vue";
import PaymentMethodsButton from "@/components/monetisation/PaymentMethodsButton.vue";
import SbpMoney from "@/components/monetisation/SbpMoney.vue";
import {Share} from "@/entity/share";
import {TooltipBuilder} from "@/entity/builder";
import {dataURItoBlob} from '@/utils';
import YoomoneyWidget from "@/components/monetisation/YoomoneyWidget.vue";
import SponsorList from "@/components/monetisation/SponsorList.vue";

const shareHash = useShareHash()
const exportList = useExportList()
const generateList = useGenerateList()

export default {
  name: 'GeneratorQR',
  components: {
    SponsorList,
    PaymentMethodsButton,
    YoomoneyWidget,
    SbpMoney,
    ShareModal,
    HistoryModal,
    ExportList,
    QRCodeMenu,
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
      autoRotation: false,
      historyModalVisible: false,
      historyDownloadModalVisible: false,
      exportModalVisible: false,
      randomTooltip: {},
      shareModalVisible: false,
      shareData: null,
      storeExport: null,
      storeGenerate: null,
      hasGenerateList: false,
      isGenerating: false,
      exportTimer: 5000,
      camera: null,
      renderer: null,
      scene: null,
      grid: null,
      isRecovery: false,
    };
  },
  created() {
    this.fillExportList()
    this.fillGenerateList()
    // Используем markRaw для предотвращения реактивности Vue 3
    this.v3dFacade = markRaw(new V3DFacade({ debug: false }))
    this.storeExport = exportList
    this.storeGenerate = generateList
  },
  mounted() {
    this.initScene()
    this.startAnimation()
    this.getTooltip()
  },
  methods: {
    qrMenuVisible() {
      return !this.isRecovery && this.v3dFacade.initialized
    },
    getTooltip() {
      let endpointApi = `/api/tooltip`

      const host = window.location.host
      if (host.includes('localhost')) {
        const noderedHost = import.meta.env.VITE_NODERED_HOST
        endpointApi = `${noderedHost || 'localhost'}${endpointApi}`
      }

      fetch(endpointApi)
        .then(res => res.json())
        .then((res) => {
          const tltBuilder = new TooltipBuilder()
          tltBuilder.build(res.data)
          this.randomTooltip = tltBuilder.getEntity()
        })
        .catch((err) => {console.log(err)})

    },
    initScene() {
      const container = document.getElementById('container3d')
      this.v3dFacade.initialize(container)

      // Используем markRaw для предотвращения реактивности Vue 3
      this.camera = markRaw(this.v3dFacade.getCamera())
      this.renderer = markRaw(this.v3dFacade.getRenderer())
      this.scene = markRaw(this.v3dFacade.getScene())
      this.grid = markRaw(this.v3dFacade.getBox().grid)
    },
    generating() {
      this.isGenerating = true
    },
    startAnimation() {
      this.v3dFacade.startAnimation((time) => {
        this.v3dFacade.getBox().animate(this.autoRotation, time)
      })
    },
    exportOBJ() {
      this.exportModalVisible = true
      this.autoRotation = false

      setTimeout(async () => {
        await this.v3dFacade.exportOBJ(`${this.fileName()}.obj`)

        const image = this.v3dFacade.getImageDataUrl()
        exportList.add(this.createShare(shareHash.create(this.options), image))
        exportList.downloadAllUpdate()
        window.localStorage.setItem(exportList.keyStoreAll, exportList.getDownloadAll())
        this.sendImage(image)
      }, this.exportTimer)
    },
    exportSTL() {
      this.exportModalVisible = true
      this.autoRotation = false

      setTimeout(async () => {
        await this.v3dFacade.exportSTL({
          binary: !this.expSettings.ascii,
          multiple: this.expSettings.multiple,
          filename: `${this.fileName()}.stl`
        })

        const image = this.v3dFacade.getImageDataUrl()
        exportList.add(this.createShare(shareHash.create(this.options), image))
        exportList.downloadAllUpdate()
        window.localStorage.setItem(exportList.keyStoreAll, exportList.getDownloadAll())

        this.sendImage(image)
      }, this.exportTimer)
    },
    fileName(key = '') {
      const timestamp = new Date().getTime()
      let prefix = `vsqr-3d-`
      if (key !== '') {
        prefix = key
      }

      let param = ''
      if (key === '') {
        prefix = ''
        if (this.options.keychain.active) param += 'key_'
        if (this.options.code.active) param += 'qr_'
        if (this.options.base.active) param += `${this.options.base.width}x${this.options.base.height}x${this.options.base.depth}-radius${this.options.base.cornerRadius}_`
        if (this.options.text.active) param += `text${this.options.text.size}_`
        if (this.options.magnet.active) param += `magnet${this.options.magnet.size}x${this.options.magnet.depth}_`
      }
      return `${prefix}${param}${timestamp}`
    },
    exportPNG() {
      const dataUrl = this.v3dFacade.getImageDataUrl()
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `${this.fileName()}.png`
      a.click()
    },
    sendImage(image) {
      const host = window.location.host
      const hash = window.location.hash
      const url = `https://vsqr.ru/${hash}`

      const {endpoint: endpointApi} = useUrlCreator('/api/image', { url: url, host: host })

      if (host.includes('localhost')) {
        return
      }

      fetch(endpointApi.value, {
        method: 'POST',
        headers: {
          'Content-Type': 'image/png'
        },
        body: dataURItoBlob(image)
      })
        .then(res => res.text())
        .then(() => {})
        .catch((err) => {console.log(err)})
        .finally(() => {})
    },
    createShare(hash, src) {
      return new Share({hash: hash, img: {src: src}, options: this.options, date: new Date().getTime()})
    },
    parseUrlShareHash() {
      if (shareHash.shareIsValid(window.location.hash)) {
        try {
          this.shareData = shareHash.parse(window.location.hash)
        } catch (error) {
          this.shareData = null
          console.error('Invalid Sharing URL')
          window.location.hash = ''
        }
      }
    },
    fillExportList() {
      const list = JSON.parse(window.localStorage.getItem(exportList.keyStore)) || []
      const collection = list.map((item) => {
        return new Share(item)
      })
      exportList.fillCollection(collection)
      exportList.setCallback((collection) => {
        window.localStorage.setItem(exportList.keyStore, JSON.stringify(collection))
      })

      let downloadAll = window.localStorage.getItem(exportList.keyStoreAll)
      // 60 days
      if (collection.length > 0 && collection.length > downloadAll) {
        downloadAll = collection.length
      }
      exportList.setDownloadAll(downloadAll)
    },
    fillGenerateList() {
      const list = JSON.parse(window.sessionStorage.getItem(generateList.keyStore)) || []
      const collection = list.map((item) => {
        return new Share(item)
      })
      this.hasGenerateList = collection.length > 0
      generateList.fillCollection(collection)
      generateList.setCallback((collection) => {
        window.sessionStorage.setItem(generateList.keyStore, JSON.stringify(collection))
      })
    },
    recoveryModel(item) {
      this.isRecovery = true
      this.shareData = JSON.parse(item.options)
      setTimeout(() => {this.isRecovery = false}, 500)
    },
    exportReady(options) {
      this.expSettings.active = true
      this.hasGenerateList = true
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
  z-index: 100;
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

/* === Tooltip === */
.gen-tooltip {
  margin-top: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  background: #f0f4ff;
  border-left: 3px solid #3273dc;
  font-size: 0.875rem;
  line-height: 1.5;
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

/* === Donate Card === */
.gen-donate-card {
  margin-bottom: 1rem;
  border-radius: 10px;
  background: linear-gradient(135deg, #fff8e1 0%, #fff3cd 100%);
  border: 1px solid #f0d98c;
  overflow: hidden;
}

.gen-donate-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.85rem 1.25rem;
  gap: 1rem;
}

.gen-donate-text {
  font-size: 0.9rem;
  line-height: 1.6;
}

/* === History Button === */
.gen-history-btn {
  width: 100%;
  margin-top: 0.5rem;
  border-radius: 8px !important;
  justify-content: center;
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

/* === Legacy compat === */
#mode-buttons>button {
  margin-right: 20px;
}

.highlight {
  position: relative;
  display: inline-block;
  overflow: visible;
}

.highlight>.highlight-text {
  position: absolute;
  top: -10px;
  right: -10px;
  padding: 0 5px;
  background-color: hsl(348, 100%, 61%);
  color: #fff;
  font-weight: bold;
  border-radius: 3px;
  z-index: 30;
}

div.share-button-shake {
  position: fixed;
  left: 15%;
  top: 0;
  z-index: 100;
}

.share-button-shake .shake-vertical {
  animation: shake-vertical 2s linear infinite;
}

@keyframes shake-vertical {
  0%, 40% { transform: translateY(0) }
  10% { transform: translateY(2px) }
  30% { transform: translateY(-5px) }
}
</style>
