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
</style>
