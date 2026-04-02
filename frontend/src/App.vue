<script setup>
import { watch } from 'vue';
import DefaultTemplate from "@/components/template/DefaultTemplate.vue";
import HeroTemplate from "@/components/template/HeroTemplate.vue";
import { useThemeStore } from '@/store/theme';

const themeStore = useThemeStore();

watch(
  () => themeStore.effectiveTheme,
  (effective) => {
    document.documentElement.classList.toggle('dark', effective === 'dark');
    document.documentElement.classList.toggle('theme-light', effective === 'light');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', effective === 'dark' ? '#1d1e1f' : '#ffffff');
  },
  { immediate: true }
);
</script>

<template lang="pug">
  HeroTemplate
</template>

<style>

</style>
