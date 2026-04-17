<template lang="pug">
.generator-page
  el-tour(
    v-model="tourStore.nameTagOpen"
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
      :target="textTarget"
      title="Текст и шрифт"
      description="Введите надпись, задайте размер, высоту букв, интервал и цвет."
      :placement="tp('right')"
    )
    el-tour-step(
      :target="fontTarget"
      title="Шрифт"
      description="Выберите встроенный шрифт или загрузите свой в формате Three.js typeface.json."
      :placement="tp('right')"
    )
    el-tour-step(
      :target="backingTarget"
      title="Подложка"
      description="Подложка повторяет контур надписи с настраиваемым отступом и толщиной."
      :placement="tp('right')"
    )
    el-tour-step(
      :target="bevelTarget"
      title="Фаска букв"
      description="Добавьте скос по краям букв — управляйте шириной и глубиной фаски."
      :placement="tp('right')"
    )
    el-tour-step(
      :target="hollowTarget"
      title="Полые буквы"
      description="Вырежьте внутреннюю часть букв, оставив стенки заданной толщины и дно."
      :placement="tp('right')"
    )
    el-tour-step(
      :target="randomTarget"
      title="Случайная высота"
      description="Придайте надписи живой вид — каждая буква получит свою высоту с заданным разбросом."
      :placement="tp('right')"
    )
    el-tour-step(
      :target="sceneTarget"
      title="3D-сцена"
      description="Здесь отображается модель. Вращайте и масштабируйте её мышью или жестами."
      :next-button-props="{ children: 'Готово' }"
    )
  .generator-layout
    .generator-sidebar
      .container-settings(v-if="menuVisible()")
        NameTagMenu(:v3dFacade="v3dFacade" @generating="generating" @exportReady="exportReady")

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
import NameTagMenu from '@/components/generator/NameTagMenu.vue';
import ExportModal from '@/components/generator/ExportModal.vue';
import ExportPanel from '@/components/generator/ExportPanel.vue';
import HistoryModal from '@/components/generator/HistoryModal.vue';
import { useTourStore } from '@/store/tour';
import { useTourPlacement } from '@/service/useTourPlacement';
import { useGenerator } from '@/service/useGenerator';

const NAMETAG_STEPS = [
  'common.tourButton',
  'nametag.text',
  'nametag.font',
  'nametag.backing',
  'nametag.bevel',
  'nametag.hollow',
  'nametag.random',
  'nametag.scene',
];

function buildFileName(options) {
  const timestamp = Date.now();
  const msg = (options?.nametag?.message || 'nametag').replace(/[^\w]+/g, '_').slice(0, 20) || 'nametag';
  return `nametag_${msg}_${timestamp}`;
}

export default {
  name: 'GeneratorNameTag',
  setup() {
    const { tp } = useTourPlacement();
    const gen = useGenerator({ fileName: buildFileName });
    return { tp, ...gen };
  },
  components: {
    DonateCard,
    NameTagMenu,
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
    'tourStore.nameTagOpen'(v) {
      if (v && this.tourStore) {
        this.tourCurrent = this.tourStore.startStepFor(NAMETAG_STEPS);
        this.tourStore.markStepSeen(NAMETAG_STEPS[this.tourCurrent]);
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
    textTarget() {
      return () => document.querySelector('.nametag-section--text');
    },
    fontTarget() {
      return () => document.querySelector('.nametag-section--font');
    },
    backingTarget() {
      return () => document.querySelector('.nametag-section--backing');
    },
    bevelTarget() {
      return () => document.querySelector('.nametag-section--bevel');
    },
    hollowTarget() {
      return () => document.querySelector('.nametag-section--hollow');
    },
    randomTarget() {
      return () => document.querySelector('.nametag-section--random');
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
      if (!this.tourStore?.hasUnseen(NAMETAG_STEPS)) return;
      const waitFor = (sel, tries = 40) =>
        new Promise((resolve) => {
          const tick = () => {
            if (document.querySelector(sel) || tries-- <= 0) return resolve();
            setTimeout(tick, 150);
          };
          tick();
        });
      await waitFor('.nametag-section--text');
      this.tourStore.openFor('GeneratorNameTag');
    },
    onTourDone() {
      if (this.tourStore) {
        this.tourStore.nameTagOpen = false;
      }
    },
    onTourFinish() {
      this.tourStore?.markAllSeen(NAMETAG_STEPS);
      this.onTourDone();
    },
    onTourChange(idx) {
      this.tourStore?.markStepSeen(NAMETAG_STEPS[idx]);
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
