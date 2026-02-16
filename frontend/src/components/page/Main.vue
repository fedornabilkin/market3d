<template lang="pug">
.px-1.py-0.button.is-warning.is-small.share-button-shake(v-if='expSettings.active' @click="shareModalVisible=true")
  i.fa.fa-arrow-up.shake-vertical
  span.mx-2 {{$t('g.shareUrlNotice')}}
  i.fa.fa-arrow-up.shake-vertical
.container
  .columns.is-multiline

    .column
      //h1.title {{ $t('g.title') }}
      //h2.subtitle {{ $t('g.subtitle') }}
      .container-settings(v-if="!isRecovery")
        QRCodeMenu(:box="box" :initData="shareData" @generating="generating" @exportReady="exportReady")

        button.button(v-if="hasGenerateList" @click="historyModalVisible=true")
          span.icon
            i.fa.fa-calendar-day(aria-hidden="true")
          span {{$t('g.historyButton')}} ({{ storeGenerate.getCollection().length }})

    .column
      //.columns
        .column
          p.title {{$t('g.preview')}}
          p.subtitle {{ $t('g.controlsHint') }}
        .column
          .field.has-addons
            .control
              span.button
                input.checkbox(type='checkbox' v-model='autoRotation')
            .control
              span.button.is-static.is-small {{$t('g.autoRotation')}}
      //.tags.has-addons.are-medium
        .tag {{$t('t.setting')}}
        .tag {{$t('t.create')}}
        .tag {{$t('t.check')}}
        .tag {{$t('t.download')}}
      sbp-money
      .container-3d
        .mb-0(id="container3d" :class="{ 'is-loading': isGenerating }")

        .message(v-if="randomTooltip.content")
          .message-body {{ randomTooltip.content }}
        div(v-if="expSettings.active") {{$t('e.title')}}
          .field.has-addons
            .control
              button.button.is-primary.is-small(@click="exportSTL")
                span.icon
                  i.fa.fa-cube
                span {{$t('e.buttonStl')}}
            .control
              span.button
                input.checkbox(type='checkbox' v-model='expSettings.multiple')
            .control
              span.button.is-static.is-small {{ $t("e.multipleLabel") }}
            .control
              span.button
                input.checkbox(type='checkbox' v-model='expSettings.ascii')
            .control
              span.button.is-static.is-small ASCII

          .field.has-addons
            .control
              button.button.is-info.is-small(@click="exportOBJ")
                span.icon
                  i.fa.fa-cube
                span {{$t('e.buttonObj')}}
            //.control
              button.button.export-button.is-primary.is-small(@click="renderPNG")
                span.icon
                  i.fa.fa-image
                span {{$t('e.buttonPng')}}


            button.button.is-small(@click="historyDownloadModalVisible=true")
              span.icon
                i.fa.fa-calendar-day(aria-hidden="true")
              span {{$t('e.downloadHistory')}} ({{ storeExport.getCollection().length }})

            button.button.is-small(v-if="storeExport.getDownloadAll() > 0")
              span.icon
                i.fa.fa-arrow-circle-down(aria-hidden="true")
              span {{$t('e.downloadAll')}} ({{ storeExport.getDownloadAll() }})

      YoomoneyWidget


ExportModal(v-if="exportModalVisible" :isActive="exportModalVisible" @close="exportModalVisible=false")
ShareModal(v-if="shareModalVisible" :isActive="shareModalVisible" @close="shareModalVisible=false")

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
import {Box} from "@/v3d/box";
import {BaseRotation} from "@/v3d/animation/baseRotation";
import {useShareHash} from "@/service/shareHash";
import {useUrlCreator} from "@/service/urlCreator.js";
import {useExportList} from "@/store/exportList";
import {useGenerateList} from "@/store/generateList";
import QRCodeMenu from '@/components/generator/QRCodeMenu.vue';
import ExportList from "@/components/generator/ExportList.vue";
import ExportModal from '@/components/generator/ExportModal.vue';
import HistoryModal from "@/components/generator/HistoryModal.vue";
import ShareModal from "@/components/generator/ShareModal.vue";
import SbpMoney from "@/components/monetisation/SbpMoney.vue";
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter';
import {OBJExporter} from "three/examples/jsm/exporters/OBJExporter";
import {Share} from "@/entity/share";
import {TooltipBuilder} from "@/entity/builder";
import JSZip from "jszip";
import {dataURItoBlob, save, saveAsArrayBuffer, saveAsString, trimCanvas} from '@/utils';
import YoomoneyWidget from "@/components/monetisation/YoomoneyWidget.vue";

const shareHash = useShareHash()
const exportList = useExportList()
const generateList = useGenerateList()
const box = new Box({debug: false, animation: new BaseRotation()})
box.createScene()

export default {
  name: 'Main',
  components: {
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
      box: undefined,
      autoRotation: false,
      changelogModalVisible: false, // remove
      changelog: '', // remove
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
      //exporter: null, // remove
      //addedMeshes: [], // remove
    };
  },
  created() {
    // this.parseUrlShareHash()
    this.fillExportList()
    this.fillGenerateList()
    this.box = box
    this.storeExport = exportList
    this.storeGenerate = generateList
  },
  mounted() {
    this.initScene()
    this.startAnimation()
    this.getTooltip()
  },
  methods: {
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

      this.camera = box.createCamera(container.clientWidth, container.clientHeight)
      this.renderer = box.createRenderer(container.clientWidth, container.clientHeight, window.devicePixelRatio)

      box.createControl()
      container.appendChild(this.renderer.domElement)

    },
    generating() {
      this.isGenerating = true
    },
    startAnimation() {
      const animate = (time) => {
        time *= 0.001
        box.animate(this.autoRotation, time)
        box.render()
        requestAnimationFrame(animate)
      };
      requestAnimationFrame(animate)
    },
    exportOBJ() {
      this.exportModalVisible = true
      this.autoRotation = false

      setTimeout(() => {
        const exporter = new OBJExporter()
        const result = exporter.parse(box.getScene())
        const filename = `${this.fileName()}.obj`
        saveAsArrayBuffer(result, filename)

        const image = this.box.imgDataUrl()
        exportList.add(this.createShare(shareHash.create(this.options), image))
        exportList.downloadAllUpdate()
        window.localStorage.setItem(exportList.keyStoreAll, exportList.getDownloadAll())
        this.sendImage(image)
      }, this.exportTimer)
    },
    exportSTL() {
      this.exportModalVisible = true
      this.autoRotation = false

      setTimeout(() => {
        const exporter = new STLExporter()

        const exportAsBinary = !this.expSettings.ascii
        const expConfig = {binary: exportAsBinary}

        if (this.expSettings.multiple) {
          const parts = this.box.getNodes()
          const zip = new JSZip()

          for(const key in parts) {
            const data = exporter.parse(parts[key], expConfig)
            zip.file(`${this.fileName(key)}.stl`, data.buffer)
          }

          zip.generateAsync({ type: 'blob' }).then((content) => {
            save(new Blob([content]), `${this.fileName()}.zip`)
          })
        } else {
          const filename = `${this.fileName()}.stl`
          const result = exporter.parse(this.box.combinedNodes(), expConfig)

          if (exportAsBinary) {
            saveAsArrayBuffer(result, filename)
          } else {
            saveAsString(result, filename)
          }
        }

        const image = this.box.imgDataUrl()

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
    renderPNG() {
      this.exportModalVisible = true;
      setTimeout(() => {
        const container = document.getElementById('container3d');
        // remove grid from scene
        this.scene.remove(this.grid);
        // remove background color
        this.scene.background = null;
        // make background transparent
        this.renderer.setClearColor(0x000000, 0);
        // set camera to be orthographic for 2D rendering, set position to center and zoom in
        this.camera = new THREE.OrthographicCamera(
          container.clientWidth / -2,
          container.clientWidth / 2,
          container.clientHeight / 2,
          container.clientHeight / -2,
          1,
          10000,
        );
        this.camera.position.set(0, 0, 100);
        this.camera.zoom = 2;
        this.camera.updateProjectionMatrix();
        // scale to 3x resolution
        this.renderer.setPixelRatio(window.devicePixelRatio * 3);
        this.renderer.setSize(container.clientWidth, container.clientHeight);

        // render scene
        this.renderer.render(this.scene, this.camera);

        // renders three.js scene to PNG and triggers download
        const canvas = this.renderer.domElement;
        // copy canvas to new temporary canvas
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(canvas, 0, 0);
        trimCanvas(tempCanvas).toBlob((blob) => {
          const filename = `image-${new Date().getTime()}.png`;
          // write to temp
          setTimeout(() => {
            saveAsArrayBuffer(blob, filename);
            setTimeout(() => {
              window.location.reload();
            }, 2000);
          }, 4000);
        });
      }, 1000);
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
        //window.location.hash = shareHash.create(options)
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
.container-3d {
  z-index: 100;
}

.container-settings {
  max-height: calc(100vh - 4rem);
  overflow: hidden;
  overflow-y: scroll;
}

@media screen and (min-width: 768px) {
  .container-3d {
    /*position: fixed;*/
  }
}



#container3d {
  width: 100%;
  height: 350px;
  border-radius: 5px;
  overflow: hidden;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.2);
  opacity: 1;
}

#container3d.is-loading {
  animation: breathing 2s linear infinite;
}

@keyframes breathing {
  0% {
    opacity: 0.3;
  }

  50% {
    opacity: 1;
  }

  100% {
    opacity: 0.3;
  }
}

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
  position:fixed;
  left:15%;
  top:0;
  z-index:100;
}

.share-button-shake .shake-vertical {
  animation: shake-vertical 2s linear infinite;
}

@keyframes shake-vertical {
  0%, 40%{transform: translateY(0)}
  10%{transform: translateY(2px)}
  30%{transform: translateY(-5px)}
}
</style>
