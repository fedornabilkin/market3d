<script setup>
import { useThemeStore } from '@/store/theme';
import { Sunny, Moon, Monitor } from '@element-plus/icons-vue';

const themeStore = useThemeStore();
</script>

<template lang="pug">
nav.navbar(role='navigation' aria-label='main navigation')
  .navbar-brand
    a.navbar-item(href='/')
      img(src='../../assets/logo.png' alt='vsqr.ru 3d генератор stl')
  .navbar-menu
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
</style>
