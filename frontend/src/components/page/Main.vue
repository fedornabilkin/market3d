<template lang="pug">
.container
  el-tour(
    v-model="tourOpen"
    v-model:current="tourCurrent"
    @finish="onTourFinish"
    @close="onTourClose"
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
      :target="discussTarget"
      title="Пожелания"
      description="Telegram-чат, где можно задать вопрос, поделиться идеей или предложить улучшение."
    )
    el-tour-step(
      :target="socialTarget"
      title="Новости проекта"
      description="Telegram-канал проекта — следите за обновлениями и анонсами."
    )
    el-tour-step(
      :target="themeTarget"
      title="Переключатель темы"
      description="Выберите светлую, тёмную или системную тему оформления."
    )
    el-tour-step(
      :target="footerExamplesTarget"
      title="Галерея примеров"
      description="Откройте страницу с подборкой примеров работ."
      placement="top"
    )
    el-tour-step(
      :target="shareTarget"
      title="Поделиться"
      description="Расскажите друзьям о сервисе в социальных сетях."
    )
    el-tour-step(
      :target="languageTarget"
      title="Выбор языка"
      description="Переключите язык интерфейса."
    )
    el-tour-step(
      :target="generatorsTarget"
      title="Генераторы моделей"
      description="Выберите генератор: QR-код, ГРЗ, шрифт Брайля или 3D-конструктор. Сейчас перейдём к генератору QR для продолжения тура."
      :next-button-props="{ children: 'Перейти к генератору QR' }"
    )
  .hero-section
    h1.title.is-1 {{ $t('g.title') }}
    h2.subtitle.is-4 {{ $t('g.subtitle') }}
    .hero-buttons(ref="heroButtonsRef")
      router-link.button.is-primary.is-large(:to="{ name: 'GeneratorQR' }")
        span.icon
          i.fa.fa-qrcode
        span {{ $t('g.goToGeneratorQR') }}
      router-link.button.is-warning.is-large(:to="{ name: 'GeneratorGRZ' }")
        span.icon
          i.fa.fa-car
        span {{ $t('g.goToGeneratorGRZ') }}
      router-link.button.is-danger.is-large(:to="{ name: 'GeneratorBraille' }")
        span.icon
          i.fa.fa-braille
        span {{ $t('g.goToGeneratorBraille') }}
      router-link.button.is-link.is-large.is-outlined(:to="{ name: 'GeneratorCoaster' }")
        span.icon
          i.fa.fa-bullseye
        span Подставки
      router-link.button.is-success.is-large.is-outlined(:to="{ name: 'GeneratorNameTag' }")
        span.icon
          i.fa.fa-signature
        span Надписи-брелоки
      router-link.button.is-info.is-large(:to="{ name: 'Constructor' }")
        span.icon
          i.fa.fa-cubes
        span 3D Конструктор

  .examples-section(ref="examplesRef")
    h2.title.is-3 Примеры моделей
    el-carousel(
      ref="carouselRef"
      :interval="4000"
      :autoplay="true"
      :loop="true"
      :pause-on-hover="true"
      arrow="always"
      height="500px"
    )
      el-carousel-item(v-for="slide in slides" :key="slide.id")
        .slide-content
          .slide-image
            img(:src="slide.imageSrc" :alt="slide.imageAlt")
          .slide-description
            p {{ slide.description }}
          .slide-settings(v-if="slide.settingsJson && false")
            details
              summary Настройки модели (JSON)
              pre {{ JSON.stringify(slide.settingsJson, null, 2) }}

</template>

<script>
import { ref, onMounted, nextTick, watch } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';

const MAIN_STEPS = [
  'common.tourButton',
  'main.discuss',
  'main.social',
  'main.theme',
  'main.footerExamples',
  'main.share',
  'main.language',
  'main.generators',
];
import PaymentMethodsButton from "@/components/monetisation/PaymentMethodsButton.vue";
import SponsorList from "@/components/monetisation/SponsorList.vue";
import { useTourStore } from '@/store/tour';

export default {
  name: 'Main',
  components: {
    SponsorList,
    PaymentMethodsButton,
  },
  setup() {
    const carouselRef = ref(null);
    const heroButtonsRef = ref(null);
    const examplesRef = ref(null);
    const router = useRouter();
    const tourStore = useTourStore();
    const { mainOpen: tourOpen } = storeToRefs(tourStore);
    const tourCurrent = ref(0);

    watch(tourOpen, (v) => {
      if (v) {
        tourCurrent.value = tourStore.startStepFor(MAIN_STEPS);
        tourStore.markStepSeen(MAIN_STEPS[tourCurrent.value]);
      }
    });

    const visibleEl = (el) => el && el.offsetWidth > 0 ? el : null;
    const tourButtonTarget = () => visibleEl(document.querySelector('.gen-tour-btn'));
    const findNavbarItem = (selector) => document.querySelector(selector)?.closest('.navbar-item') || document.querySelector(selector);
    const discussTarget = () => visibleEl(findNavbarItem('.gen-discuss-btn'));
    const socialTarget = () => visibleEl(findNavbarItem('.gen-tg-header-btn'));
    const themeTarget = () => visibleEl(findNavbarItem('.navbar-end .el-dropdown'));
    const generatorsTarget = () => heroButtonsRef.value;
    const footerExamplesTarget = () => {
      const btn = document.querySelector('.footer a.button.is-info');
      return visibleEl(btn?.closest('.column') || btn);
    };
    const shareTarget = () => visibleEl(document.querySelector('.footer .share-buttons') || document.querySelector('.footer .columns .column:nth-last-child(2)'));
    const languageTarget = () => visibleEl(document.querySelector('.footer .columns .column:last-child'));

    const targetByStep = [
      tourButtonTarget,
      discussTarget,
      socialTarget,
      themeTarget,
      footerExamplesTarget,
      shareTarget,
      languageTarget,
      generatorsTarget,
    ];

    const onTourChange = (idx) => {
      tourStore.markStepSeen(MAIN_STEPS[idx]);
      const el = targetByStep[idx]?.();
      if (el?.scrollIntoView) {
        el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'auto' });
      }
    };

    const onTourFinish = () => {
      tourStore.markAllSeen(MAIN_STEPS);
      tourStore.mainOpen = false;
      router.push({ name: 'GeneratorQR' });
    };

    const onTourClose = () => {};

    onMounted(async () => {
      if (tourStore.hasUnseen(MAIN_STEPS)) {
        await nextTick();
        tourStore.openFor('Main');
      }
    });

    const slides = [
      {
        id: 'qr1',
        imageSrc: '/example/base-qr-text-frame.png',
        imageAlt: '3d модель qr-кода с подписью',
        description: 'QR-код в котором закодирован адрес сайта. Подпись добавлена на случай, если нет возможности отсканировать qr-код.',
        settingsJson: {
          base: { width: 22, height: 22, cornerRadius: 8 },
          code: { active: true, errorCorrectionLevel: 'H' },
          text: { active: true, message: 'vsqr.ru', height: 8 },
          border: { active: true }
        }
      },
      {
        id: 'key1',
        imageSrc: '/example/base-text-key-frame.png',
        imageAlt: 'Брелок 3д для ключей с надписью',
        description: 'Брелок для ключей с надписью. Можно добавить свое имя, крутую надпись или номер телефона. Отверстие слева.',
        settingsJson: {
          base: { width: 22, height: 22, cornerRadius: 8 },
          text: { active: true, message: 'Ваш текст', height: 8 },
          keychain: { active: true, placement: 'topLeft' },
          border: { active: true }
        }
      },
      {
        id: 'key2',
        imageSrc: '/example/base-icon-key-frame.png',
        imageAlt: 'Брелок 3д для ключей с иконкой',
        description: 'Брелок для ключей с иконкой. Размер иконки обычно 85-90% от базового размера. Отверстие сверху слева и рамка толщиной в 1 мм.',
        settingsJson: {
          base: { width: 22, height: 22, cornerRadius: 8 },
          icon: { active: true, name: 'globe', ratio: 85 },
          keychain: { active: true, placement: 'topLeft' },
          border: { active: true }
        }
      },
      {
        id: 'key3',
        imageSrc: '/example/base-icon-text-key-frame.png',
        imageAlt: 'Брелок с иконкой и текстом 3д',
        description: 'Брелок с иконкой и текстом. Размер иконки обычно 18-20% от базового размера. Ваш текст или слоган. Отверстие слева и рамка.',
        settingsJson: {
          base: { width: 22, height: 22, cornerRadius: 8 },
          icon: { active: true, name: 'globe', ratio: 18 },
          text: { active: true, message: 'Ваш текст', height: 8 },
          keychain: { active: true, placement: 'topLeft' },
          border: { active: true }
        }
      },
      {
        id: 'key4',
        imageSrc: '/example/base-text-key.jpg',
        imageAlt: '3д бирка для гардероба с петелькой и текстом',
        description: 'Бирка в гардероб с надписью. Увеличить диаметр и толщину петельки, разместить сверху. Добавить длину петельке или высоту базовой фигуре',
        settingsJson: {}
      },
      {
        id: 'box1',
        imageSrc: '/example/base-border-box.jpg',
        imageAlt: 'Ящик для мелочей 3д',
        description: 'Небольшой простой ящик для мелочей. База и рамка высотой в 30 мм. Толщина базы не менее 2 мм для прочности',
        settingsJson: {}
      }
    ];

    return {
      slides,
      carouselRef,
      heroButtonsRef,
      examplesRef,
      tourOpen,
      tourCurrent,
      onTourChange,
      tourButtonTarget,
      discussTarget,
      socialTarget,
      themeTarget,
      generatorsTarget,
      footerExamplesTarget,
      shareTarget,
      languageTarget,
      onTourFinish,
      onTourClose,
    };
  },
}
</script>

<style scoped>
.hero-section {
  text-align: center;
  padding: 3rem 0;
  margin-bottom: 3rem;
}

.hero-section .title {
  margin-bottom: 1rem;
}

.hero-section .subtitle {
  margin-bottom: 2rem;
}

.hero-buttons {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

.examples-section {
  margin-bottom: 3rem;
}

.examples-section .title {
  text-align: center;
  margin-bottom: 2rem;
}

.slide-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem;
  height: 100%;
}

.slide-image {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1rem;
}

.slide-image img {
  max-width: 100%;
  max-height: 400px;
  object-fit: contain;
}

.slide-description {
  text-align: center;
  margin-bottom: 1rem;
  max-width: 600px;
}

.slide-description p {
  font-size: 1.1rem;
  line-height: 1.6;
}

.slide-settings {
  width: 100%;
  max-width: 600px;
}

.slide-settings details {
  cursor: pointer;
  margin-top: 1rem;
}

.slide-settings summary {
  padding: 0.5rem;
  background-color: #f5f5f5;
  border-radius: 4px;
}

.slide-settings pre {
  background-color: #f9f9f9;
  padding: 1rem;
  border-radius: 4px;
  overflow-x: auto;
  font-size: 0.9rem;
  margin-top: 0.5rem;
}

@media screen and (max-width: 768px) {
  .hero-section {
    padding: 2rem 0;
  }

  .slide-content {
    padding: 1rem;
  }

  .slide-image img {
    max-height: 250px;
  }
}
</style>
