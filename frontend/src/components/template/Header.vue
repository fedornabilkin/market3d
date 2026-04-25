<script setup>
import { useThemeStore } from '@/store/theme';
import { useRouter } from 'vue-router';
import { Sunny, Moon, Monitor, QuestionFilled } from '@element-plus/icons-vue';
import { useTourStore } from '@/store/tour';

const themeStore = useThemeStore();
const router = useRouter();
const tourStore = useTourStore();

const TOUR_PAGES = ['Main', 'GeneratorQR', 'GeneratorGRZ', 'GeneratorBraille', 'GeneratorCoaster', 'GeneratorNameTag', 'Constructor'];

const startTour = async () => {
  const current = router.currentRoute.value.name;
  if (TOUR_PAGES.includes(current)) {
    tourStore.openFor(current);
  } else {
    await router.push({ name: 'Main' });
    tourStore.openFor('Main');
  }
};
</script>

<template lang="pug">
nav.navbar(role='navigation' aria-label='main navigation')
  .navbar-brand
    a.navbar-item(href='/')
      img(src='../../assets/logo.png' alt='vsqr.ru 3d генератор stl')
  .navbar-menu
    .navbar-start
      .navbar-item
        router-link.button.is-small.gen-nav-btn(:to="{ name: 'GeneratorQR' }" :title="$t('g.goToGeneratorQR')")
          span.icon
            i.fa.fa-qrcode
          span.is-hidden-mobile {{ $t('g.goToGeneratorQR') }}
      .navbar-item
        router-link.button.is-small.gen-nav-btn(:to="{ name: 'GeneratorGRZ' }" :title="$t('g.goToGeneratorGRZ')")
          span.icon
            i.fa.fa-car
          span.is-hidden-mobile {{ $t('g.goToGeneratorGRZ') }}
      .navbar-item
        router-link.button.is-small.gen-nav-btn(:to="{ name: 'GeneratorBraille' }" :title="$t('g.goToGeneratorBraille')")
          span.icon
            i.fa.fa-braille
          span.is-hidden-mobile {{ $t('g.goToGeneratorBraille') }}
      .navbar-item
        router-link.button.is-small.gen-nav-btn(:to="{ name: 'GeneratorCoaster' }" :title="$t('g.goToGeneratorCoaster')")
          span.icon
            i.fa.fa-bullseye
          span.is-hidden-mobile {{ $t('g.goToGeneratorCoaster') }}
      .navbar-item
        router-link.button.is-small.gen-nav-btn(:to="{ name: 'GeneratorNameTag' }" :title="$t('g.goToGeneratorNameTag')")
          span.icon
            i.fa.fa-signature
          span.is-hidden-mobile {{ $t('g.goToGeneratorNameTag') }}
      .navbar-item
        router-link.button.is-small.gen-nav-btn(:to="{ name: 'Constructor' }" :title="$t('g.goToConstructor')")
          span.icon
            i.fa.fa-cubes
          span.is-hidden-mobile {{ $t('g.goToConstructor') }}
    .navbar-end
      .navbar-item
        a.button.is-small.gen-discuss-btn(href="https://t.me/+dSgck2GM29syZTQ6" target="_blank")
          span.icon
            i.fa.fa-comments
          span.is-hidden-mobile {{$t('t.discussionButton')}}
      .navbar-item
        a.button.is-small.gen-tg-header-btn(href="https://t.me/+W4Rsqz4svmBkZmMy" target="_blank")
          span.icon
            i.fab.fa-telegram
          span.is-hidden-mobile {{$t('t.tgChannelButton')}}
      .navbar-item
        el-button.gen-tour-btn(
          circle
          :icon="QuestionFilled"
          aria-label="Пройти тур"
          title="Пройти тур заново"
          @click="startTour"
        )
      .navbar-item
        el-dropdown(trigger="click" placement="bottom-end" @command="themeStore.setTheme")
          el-button(
            circle
            :icon="themeStore.effectiveTheme === 'dark' ? Moon : Sunny"
            aria-label="Тема оформления"
          )
          template(#dropdown)
            el-dropdown-menu
              el-dropdown-item(
                :command="'light'"
                :class="{ 'is-active': themeStore.theme === 'light' }"
              )
                el-icon
                  Sunny
                span Светлая
              el-dropdown-item(
                :command="'dark'"
                :class="{ 'is-active': themeStore.theme === 'dark' }"
              )
                el-icon
                  Moon
                span Тёмная
              el-dropdown-item(
                :command="'system'"
                :class="{ 'is-active': themeStore.theme === 'system' }"
              )
                el-icon
                  Monitor
                span Системная
</template>

<style scoped>
.navbar-item :deep(.el-dropdown) {
  display: inline-flex;
}
.el-icon {
  margin-right: 0.35rem;
  vertical-align: middle;
}
.gen-tg-header-btn {
  border-radius: 8px;
  font-weight: 500;
  background: #0088cc;
  border-color: #0088cc;
  color: #fff;
  transition: all 0.15s ease;
}
.gen-tg-header-btn:hover {
  background: #006daa;
  border-color: #006daa;
  color: #fff;
}
.gen-discuss-btn {
  border-radius: 8px !important;
  font-weight: 500 !important;
  background: transparent !important;
  border: 1px solid #0088cc !important;
  color: #0088cc !important;
  transition: all 0.15s ease;
}
.gen-discuss-btn:hover {
  background: #e6f4fb !important;
  border-color: #006daa !important;
  color: #006daa !important;
}
.gen-nav-btn {
  border-radius: 8px;
  font-weight: 500;
  transition: all 0.15s ease;
}
.gen-nav-btn.router-link-active {
  background: #00a5a4;
  border-color: #00a5a4;
  color: #fff;
}
.gen-nav-btn.router-link-active:hover {
  background: #008a89;
  border-color: #008a89;
  color: #fff;
}

/* Bulma по умолчанию прячет .navbar-menu ниже desktop-breakpoint (<1024px).
 * Принудительно показываем меню на мобильном с переносом строк, чтобы все
 * кнопки навигации оставались видимыми (без burger-toggle). */
@media (max-width: 1023px) {
  :deep(.navbar) {
    flex-wrap: wrap;
    max-width: 100%;
    overflow-x: hidden;
  }
  :deep(.navbar-menu) {
    display: flex !important;
    flex-wrap: wrap;
    align-items: center;
    width: 100%;
    box-sizing: border-box;
    box-shadow: none;
    padding: 0.25rem 0.5rem;
    background: transparent;
  }
  :deep(.navbar-start),
  :deep(.navbar-end) {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    margin: 0;
  }
  :deep(.navbar-item) {
    padding: 0.2rem 0.25rem;
  }
}
</style>
