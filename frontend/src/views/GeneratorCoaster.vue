<template lang="pug">
.generator-page
  el-tour(
    v-model="tourStore.coasterOpen"
    v-model:current="tourCurrent"
    @finish="onTourFinish"
    @close="onTourDone"
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
      :target="baseTarget"
      title="Форма подставки"
      description="Выберите форму (круглая или квадратная), задайте размеры, толщину и цвет основания."
      :placement="tp('right')"
    )
    el-tour-step(
      :target="ringsTarget"
      title="Кольца"
      description="Включите концентрические кольца-мишень и настройте их количество, ширину, расстояние и радиус."
      :placement="tp('right')"
    )
    el-tour-step(
      :target="textTarget"
      title="Текст"
      description="Добавьте надпись на подставку: прямую или по кругу, задайте размер, глубину и цвет."
      :placement="tp('right')"
    )
    el-tour-step(
      :target="iconTarget"
      title="Иконка"
      description="Выберите иконку из набора или вставьте свой SVG. Настройте размер, смещение и цвет."
      :placement="tp('right')"
    )
    el-tour-step(
      :target="keychainTarget"
      title="Брелок"
      description="Добавьте ушко-брелок с отверстием для крепления. Выберите положение и размеры."
      :placement="tp('right')"
    )
    el-tour-step(
      :target="sceneTarget"
      title="3D-сцена"
      description="Здесь отображается сгенерированная модель. Вращайте и масштабируйте её мышью или жестами."
      :next-button-props="{ children: 'Готово' }"
    )
  header.generator-header
    h1.title.is-3 {{ $t('seo.generatorCoaster.h1') }}
    p.subtitle.is-6 {{ $t('seo.generatorCoaster.subtitle') }}
  .generator-layout
    .generator-sidebar
      .container-settings(v-if="menuVisible()")
        CoasterMenu(:v3dFacade="v3dFacade" @generating="generating" @exportReady="exportReady")

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
          span.is-hidden-mobile {{ $t('e.downloadHistory') }}
          span ({{ storeExport.getCollection().length }})

        button.button.is-small.gen-export-btn(v-if="storeExport.getDownloadAll() > 0")
          span.icon
            i.fa.fa-arrow-circle-down(aria-hidden="true")
          span.is-hidden-mobile {{ $t('e.downloadAll') }}
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
import DonateCard from '@/components/monetisation/DonateCard.vue';
import CoasterMenu from '@/components/generator/CoasterMenu.vue';
import ExportModal from '@/components/generator/ExportModal.vue';
import ExportPanel from '@/components/generator/ExportPanel.vue';
import HistoryModal from '@/components/generator/HistoryModal.vue';
import { useTourStore } from '@/store/tour';
import { useTourPlacement } from '@/service/useTourPlacement';
import { useGenerator } from '@/service/useGenerator';
import { useSeoHeadI18n } from '@/composables/useSeoHead';

const COASTER_STEPS = [
  'common.tourButton',
  'coaster.base',
  'coaster.rings',
  'coaster.text',
  'coaster.icon',
  'coaster.keychain',
  'coaster.scene',
];

function buildFileName(options) {
  const timestamp = Date.now();
  const shape = options?.base?.shape || 'circle';
  return `coaster_${shape}_${timestamp}`;
}

export default {
  name: 'GeneratorCoaster',
  setup() {
    useSeoHeadI18n('seo.generatorCoaster');
    const { tp } = useTourPlacement();
    const gen = useGenerator({ fileName: buildFileName });
    return { tp, ...gen };
  },
  components: {
    DonateCard,
    CoasterMenu,
    ExportModal,
    ExportPanel,
    HistoryModal,
  },
  data() {
    return {
      tourStore: null,
      tourCurrent: 0,
    };
  },
  watch: {
    'tourStore.coasterOpen'(v) {
      if (v && this.tourStore) {
        this.tourCurrent = this.tourStore.startStepFor(COASTER_STEPS);
        this.tourStore.markStepSeen(COASTER_STEPS[this.tourCurrent]);
      }
    },
  },
  created() {
    this.fillExportList();
    this.tourStore = useTourStore();
  },
  mounted() {
    this.initScene();
    this.startAnimation();
    this.maybeStartTour();
  },
  computed: {
    tourButtonTarget() {
      return () => {
        const el = document.querySelector('.gen-tour-btn');
        return el && el.offsetWidth > 0 ? el : null;
      };
    },
    baseTarget() {
      return () => {
        const el = document.querySelector('.coaster-section--base');
        return el && el.offsetWidth > 0 ? el : null;
      };
    },
    ringsTarget() {
      return () => {
        const el = document.querySelector('.coaster-section--rings');
        return el && el.offsetWidth > 0 ? el : null;
      };
    },
    textTarget() {
      return () => {
        const el = document.querySelector('.coaster-section--text');
        return el && el.offsetWidth > 0 ? el : null;
      };
    },
    iconTarget() {
      return () => {
        const el = document.querySelector('.coaster-section--icon');
        return el && el.offsetWidth > 0 ? el : null;
      };
    },
    keychainTarget() {
      return () => {
        const el = document.querySelector('.coaster-section--keychain');
        return el && el.offsetWidth > 0 ? el : null;
      };
    },
    sceneTarget() {
      return () => {
        const el = document.getElementById('container3d');
        return el && el.offsetWidth > 0 ? el : null;
      };
    },
  },
  methods: {
    async maybeStartTour() {
      if (!this.tourStore?.hasUnseen(COASTER_STEPS)) return;
      const waitFor = (sel, tries = 40) =>
        new Promise((resolve) => {
          const tick = () => {
            if (document.querySelector(sel) || tries-- <= 0) return resolve();
            setTimeout(tick, 150);
          };
          tick();
        });
      await waitFor('.gen-settings-body');
      this.tourStore.openFor('GeneratorCoaster');
    },
    onTourDone() {
      if (this.tourStore) {
        this.tourStore.coasterOpen = false;
      }
    },
    onTourFinish() {
      this.tourStore?.markAllSeen(COASTER_STEPS);
      this.onTourDone();
    },
    onTourChange(idx) {
      this.tourStore?.markStepSeen(COASTER_STEPS[idx]);
    },
  },
};
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
