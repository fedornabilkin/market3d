<template lang="pug">
.generator-page
  el-tour(
    v-model="tourStore.qrOpen"
    v-model:current="tourCurrent"
    @finish="onTourFinish"
    @close="onGenTourDone"
    @change="onTourChange"
    :next-button-props="{ children: 'Далее' }"
    :prev-button-props="{ children: 'Назад' }"
  )
    el-tour-step(
      :target="tourButtonTarget"
      title="Кнопка запуска тура"
      description="Нажмите эту кнопку в любой момент, чтобы пройти тур по текущей странице заново."
    )
    el-tour-step(
      :target="scanTarget"
      title="Сканирование QR камерой"
      description="Нажмите, чтобы отсканировать QR-код с помощью камеры устройства."
      placement="bottom"
    )
    el-tour-step(
      :target="readTarget"
      title="Распознавание из файла"
      description="Загрузите изображение с QR-кодом — приложение распознает его автоматически."
      placement="bottom"
    )
    el-tour-step(
      :target="exportSettingsTarget"
      title="Экспорт настроек"
      description="Сохраните текущие параметры генератора в JSON-файл, чтобы позже восстановить их."
      :placement="tp('left')"
    )
    el-tour-step(
      :target="importSettingsTarget"
      title="Импорт настроек"
      description="Загрузите ранее сохранённый JSON-файл с параметрами, чтобы быстро восстановить сцену."
      :placement="tp('left')"
    )
    el-tour-step(
      :target="panelsTarget"
      title="Чекбокс активации панели"
      description="У каждой секции настроек есть чекбокс активации. Включите его, чтобы панель участвовала в генерации модели. По такому же принципу работают и остальные секции."
      :placement="tp('right')"
    )
    el-tour-step(
      :target="sceneTarget"
      title="3D-сцена"
      description="Здесь отображается сгенерированная модель. Вращайте и масштабируйте её мышью или жестами."
    )
    el-tour-step(
      :target="tooltipTarget"
      title="Панель подсказок"
      description="Здесь появляются советы и подсказки по работе с генератором."
      placement="top"
    )
    el-tour-step(
      :target="exportPanelTarget"
      title="Экспорт 3D-файла"
      description="Скачайте готовую модель в STL, OBJ или PNG. История скачиваний сохраняется в браузере."
      placement="top"
    )
    el-tour-step(
      :target="donateTarget"
      title="Поддержите проект"
      description="Сервис бесплатный и развивается в свободное время. Если он оказался полезен — скиньте на кофе разработчику, это очень мотивирует!"
      :placement="tp('left')"
      :next-button-props="{ children: 'Готово' }"
    )
  .generator-layout
    .generator-sidebar
      .container-settings(v-if="qrMenuVisible()")
        QRCodeMenu(:v3dFacade="v3dFacade" :initData="shareData" @generating="generating" @exportReady="exportReady")

    .generator-main
      DonateCard

      #gen-progress-target.gen-progress-target

      .container-3d
        .gen-viewport(id="container3d" :class="{ 'is-loading': isGenerating }")

      .gen-tooltip(v-if="randomTooltip.content")
        .gen-tooltip-text {{ randomTooltip.content }}

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
import { useShareHash } from "@/service/shareHash";
import { useUrlCreator } from "@/service/urlCreator.js";
import QRCodeMenu from '@/components/generator/QRCodeMenu.vue';
import ExportList from "@/components/generator/ExportList.vue";
import ExportModal from '@/components/generator/ExportModal.vue';
import ExportPanel from '@/components/generator/ExportPanel.vue';
import HistoryModal from "@/components/generator/HistoryModal.vue";
import ShareModal from "@/components/generator/ShareModal.vue";
import DonateCard from "@/components/monetisation/DonateCard.vue";
import SbpMoney from "@/components/monetisation/SbpMoney.vue";
import YoomoneyWidget from "@/components/monetisation/YoomoneyWidget.vue";
import { Share } from "@/entity/share";
import { TooltipBuilder } from "@/entity/builder";
import { dataURItoBlob } from '@/utils.js';
import { useTourStore } from "@/store/tour";
import { useTourPlacement } from "@/service/useTourPlacement";
import { useGenerator } from "@/service/useGenerator";

const QR_STEPS = [
  'common.tourButton',
  'qr.scan',
  'qr.read',
  'qr.exportSettings',
  'qr.importSettings',
  'qr.panelsCheckbox',
  'qr.scene',
  'qr.tooltip',
  'qr.exportPanel',
  'qr.donate',
];

const shareHash = useShareHash();

function buildFileName(options) {
  const timestamp = new Date().getTime();
  const o = options || {};
  let param = '';
  if (o.keychain?.active) param += 'key_';
  if (o.code?.active) param += 'qr_';
  if (o.base?.active) param += `${o.base.width}x${o.base.height}x${o.base.depth}-radius${o.base.cornerRadius}_`;
  if (o.text?.active) param += `text${o.text.size}_`;
  if (o.magnet?.active) param += `magnet${o.magnet.size}x${o.magnet.depth}_`;
  return `${param}${timestamp}`;
}

export default {
  name: 'GeneratorQR',
  setup() {
    const { tp } = useTourPlacement();
    const gen = useGenerator({ fileName: buildFileName });
    const {
      startAnimation: _genStartAnimation,
      exportSTL: _genExportSTL,
      exportOBJ: _genExportOBJ,
      recoveryModel: _genRecoveryModel,
      menuVisible: _genMenuVisible,
      ...rest
    } = gen;
    return { tp, ...rest };
  },
  components: {
    DonateCard,
    YoomoneyWidget,
    SbpMoney,
    ShareModal,
    HistoryModal,
    ExportList,
    QRCodeMenu,
    ExportModal,
    ExportPanel,
  },
  data() {
    return {
      autoRotation: false,
      randomTooltip: {},
      shareModalVisible: false,
      shareData: null,
      exportTimer: 5000,
      isRecovery: false,
      tourStore: null,
      tourCurrent: 0,
    };
  },
  created() {
    this.fillExportList();
    this.tourStore = useTourStore();
  },
  watch: {
    'tourStore.qrOpen'(v) {
      if (v && this.tourStore) {
        this.tourCurrent = this.tourStore.startStepFor(QR_STEPS);
        this.tourStore.markStepSeen(QR_STEPS[this.tourCurrent]);
      }
    },
  },
  mounted() {
    this.initScene();
    this.startAnimation();
    this.getTooltip();
    this.maybeStartGenTour();
  },
  computed: {
    tourButtonTarget() {
      return () => {
        const el = document.querySelector('.gen-tour-btn');
        return el && el.offsetWidth > 0 ? el : null;
      };
    },
    scanTarget() {
      return () => {
        const el = document.querySelectorAll('.gen-toolbar-left .gen-toolbar-btn')[0];
        return el && el.offsetWidth > 0 ? el : null;
      };
    },
    readTarget() {
      return () => {
        const el = document.querySelectorAll('.gen-toolbar-left .gen-toolbar-btn')[1];
        return el && el.offsetWidth > 0 ? el : null;
      };
    },
    exportSettingsTarget() {
      return () => {
        const el = document.querySelectorAll('.gen-settings-header-actions .gen-io-btn')[0];
        return el && el.offsetWidth > 0 ? el : null;
      };
    },
    importSettingsTarget() {
      return () => {
        const el = document.querySelectorAll('.gen-settings-header-actions .gen-io-btn')[1];
        return el && el.offsetWidth > 0 ? el : null;
      };
    },
    panelsTarget() {
      return () => {
        const row = document.querySelector('.gen-settings-body .form-bg--qr');
        const el = row?.querySelector('label.checkbox')?.parentElement || row;
        return el && el.offsetWidth > 0 ? el : null;
      };
    },
    sceneTarget() {
      return () => {
        const el = document.getElementById('container3d');
        return el && el.offsetWidth > 0 ? el : null;
      };
    },
    tooltipTarget() {
      return () => {
        const el = document.querySelector('.gen-tooltip');
        return el && el.offsetWidth > 0 ? el : null;
      };
    },
    exportPanelTarget() {
      return () => {
        const el = document.querySelector('.gen-export-panel .gen-export-actions') || document.querySelector('.gen-export-panel');
        return el && el.offsetWidth > 0 ? el : null;
      };
    },
    donateTarget() {
      return () => {
        const el = document.querySelector('.gen-donate-card');
        return el && el.offsetWidth > 0 ? el : null;
      };
    },
  },
  methods: {
    async maybeStartGenTour() {
      const waitFor = (sel, tries = 40) => new Promise((resolve) => {
        const tick = () => {
          if (document.querySelector(sel) || tries-- <= 0) return resolve();
          setTimeout(tick, 150);
        };
        tick();
      });
      if (this.tourStore?.hasUnseen(QR_STEPS)) {
        await waitFor('.gen-settings-body');
        await waitFor('.gen-tooltip');
        await waitFor('.gen-export-panel');
        this.tourStore.openFor('GeneratorQR');
      }
    },
    onGenTourDone() {
      if (this.tourStore) {
        this.tourStore.qrOpen = false;
      }
    },
    onTourFinish() {
      this.tourStore?.markAllSeen(QR_STEPS);
      this.onGenTourDone();
    },
    onTourChange(idx) {
      this.tourStore?.markStepSeen(QR_STEPS[idx]);
    },
    qrMenuVisible() {
      return !this.isRecovery && this.v3dFacade.initialized;
    },
    startAnimation() {
      this.v3dFacade.startAnimation((time) => {
        this.v3dFacade.getBox().animate(this.autoRotation, time);
      });
    },
    getTooltip() {
      let endpointApi = `/api/tooltip`;

      const host = window.location.host;
      if (host.includes('localhost')) {
        const noderedHost = import.meta.env.VITE_NODERED_HOST;
        endpointApi = `${noderedHost || 'localhost'}${endpointApi}`;
      }

      fetch(endpointApi)
        .then(res => res.json())
        .then((res) => {
          const tltBuilder = new TooltipBuilder();
          tltBuilder.build(res.data);
          this.randomTooltip = tltBuilder.getEntity();
        })
        .catch((err) => { console.log(err); });
    },
    _recordQrExport(image) {
      const hash = shareHash.create(this.options);
      this.storeExport.add(this.createShare(hash, image));
      this.storeExport.downloadAllUpdate();
      window.localStorage.setItem(this.storeExport.keyStoreAll, this.storeExport.getDownloadAll());
    },
    exportOBJ() {
      this.exportModalVisible = true;
      this.autoRotation = false;

      setTimeout(async () => {
        await this.v3dFacade.exportOBJ(`${buildFileName(this.options)}.obj`);
        const image = this.v3dFacade.getImageDataUrl();
        this._recordQrExport(image);
        this.sendImage(image);
      }, this.exportTimer);
    },
    exportSTL() {
      this.exportModalVisible = true;
      this.autoRotation = false;

      setTimeout(async () => {
        await this.v3dFacade.exportSTL({
          binary: !this.expSettings.ascii,
          multiple: this.expSettings.multiple,
          filename: `${buildFileName(this.options)}.stl`,
        });
        const image = this.v3dFacade.getImageDataUrl();
        this._recordQrExport(image);
        this.sendImage(image);
      }, this.exportTimer);
    },
    sendImage(image) {
      const host = window.location.host;
      const hash = window.location.hash;
      const url = `https://vsqr.ru/${hash}`;

      const { endpoint: endpointApi } = useUrlCreator('/api/image', { url: url, host: host });

      if (host.includes('localhost')) {
        return;
      }

      fetch(endpointApi.value, {
        method: 'POST',
        headers: {
          'Content-Type': 'image/png',
        },
        body: dataURItoBlob(image),
      })
        .then(res => res.text())
        .then(() => {})
        .catch((err) => { console.log(err); })
        .finally(() => {});
    },
    createShare(hash, src) {
      return new Share({ hash: hash, img: { src: src }, options: this.options, date: new Date().getTime() });
    },
    parseUrlShareHash() {
      if (shareHash.shareIsValid(window.location.hash)) {
        try {
          this.shareData = shareHash.parse(window.location.hash);
        } catch (error) {
          this.shareData = null;
          console.error('Invalid Sharing URL');
          window.location.hash = '';
        }
      }
    },
    recoveryModel(item) {
      this.isRecovery = true;
      this.shareData = JSON.parse(item.options);
      setTimeout(() => { this.isRecovery = false; }, 500);
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

.gen-tooltip {
  margin-top: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  background: #f0f4ff;
  border-left: 3px solid #3273dc;
  font-size: 0.875rem;
  line-height: 1.5;
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
