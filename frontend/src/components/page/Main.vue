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
    h1.title.is-1 {{ $t('seo.main.h1') }}
    h2.subtitle.is-4 {{ $t('seo.main.subtitle') }}
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

  .animation-section.box(ref="examplesRef")
    .columns.is-vcentered
      .column.is-half
        h2.title.is-3 Как это работает
        p.subtitle.is-5 Настраиваете параметры в форме — конструктор собирает 3D-модель на ваших глазах.
        p Сцена справа последовательно собирает и разбирает пять типов моделей, которые можно получить в генераторах, и финальный бейдж — из конструктора.
      .column.is-half
        AnimationScene

  .features-section
    h2.title.is-3.has-text-centered Что можно собрать
    .columns.is-multiline
      .column.is-one-third
        .card.feature-card
          .card-header.has-background-primary
            p.card-header-title.has-text-white
              span.icon.mr-2
                i.fa.fa-qrcode
              | Генератор QR-кода
          .card-content
            p Трёхмерный QR-код со ссылкой, контактом, Wi-Fi или любой другой информацией. Добавьте подпись, иконку, рамку и петельку — получите карточку, брелок или сувенир.
            router-link.button.is-primary.is-small.mt-3(:to="{ name: 'GeneratorQR' }") Открыть генератор
      .column.is-one-third
        .card.feature-card
          .card-header.has-background-warning
            p.card-header-title
              span.icon.mr-2
                i.fa.fa-car
              | Генератор ГРЗ
          .card-content
            p Миниатюрный номерной знак российского образца. Настраиваете буквы, цифры, код региона, рамку и крепление — подходит на ключи, багаж или витрину.
            router-link.button.is-warning.is-small.mt-3(:to="{ name: 'GeneratorGRZ' }") Открыть генератор
      .column.is-one-third
        .card.feature-card
          .card-header.has-background-danger
            p.card-header-title.has-text-white
              span.icon.mr-2
                i.fa.fa-braille
              | Генератор шрифта Брайля
          .card-content
            p Табличка с надписью шрифтом Брайля: русский и английский алфавиты, 6- и 8-точечный режим, дублирующий обычный текст, скругления и петелька.
            router-link.button.is-danger.is-small.mt-3(:to="{ name: 'GeneratorBraille' }") Открыть генератор
      .column.is-one-third
        .card.feature-card
          .card-header.has-background-link
            p.card-header-title.has-text-white
              span.icon.mr-2
                i.fa.fa-bullseye
              | Генератор подставок
          .card-content
            p Подставка под кружку с концентрическими кольцами, иконкой по центру и прямым или круговым текстом вдоль края. Круг или прямоугольник — на выбор.
            router-link.button.is-link.is-small.mt-3(:to="{ name: 'GeneratorCoaster' }") Открыть генератор
      .column.is-one-third
        .card.feature-card
          .card-header.has-background-success
            p.card-header-title.has-text-white
              span.icon.mr-2
                i.fa.fa-signature
              | Генератор надписей-брелоков
          .card-content
            p Объёмные буквы с подложкой, фаской, случайной высотой и петелькой в любом углу. Четыре встроенных шрифта или загрузка собственного.
            router-link.button.is-success.is-small.mt-3(:to="{ name: 'GeneratorNameTag' }") Открыть генератор
      .column.is-one-third
        .card.feature-card
          .card-header.has-background-info
            p.card-header-title.has-text-white
              span.icon.mr-2
                i.fa.fa-cubes
              | 3D-конструктор
          .card-content
            p Визуальный редактор с нуля: примитивы, импорт STL, фаска, зеркало, булевы операции на экспорт, сетка с привязкой, история действий и несколько сцен.
            router-link.button.is-info.is-small.mt-3(:to="{ name: 'Constructor' }") Открыть конструктор

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
import AnimationScene from "@/components/example/AnimationScene.vue";
import { useTourStore } from '@/store/tour';
import { useSeoHeadI18n } from '@/composables/useSeoHead';

export default {
  name: 'Main',
  components: {
    SponsorList,
    PaymentMethodsButton,
    AnimationScene,
  },
  setup() {
    useSeoHeadI18n('seo.main');
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

    return {
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

.animation-section {
  margin-bottom: 3rem;
}

.features-section {
  margin-bottom: 3rem;
}

.features-section > .title {
  margin-bottom: 2rem;
}

.feature-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.feature-card .card-content {
  flex: 1;
}

.feature-card .card-header-title {
  font-weight: 600;
}

@media screen and (max-width: 768px) {
  .hero-section {
    padding: 2rem 0;
  }
}
</style>
