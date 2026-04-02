<script setup>
import Header from "@/components/template/Header.vue";
import Footer from "@/components/template/Footer.vue";
import { useRoute } from 'vue-router';

const route = useRoute();

const isConstructor = () => route.name === 'Constructor';
</script>

<template lang="pug">
  .app-layout(:class="{ 'is-constructor': isConstructor() }")
    .app-header
      Header
    .app-body
      router-view
    .app-footer(v-if="!isConstructor()")
      Footer
</template>

<style scoped>
.app-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}
.app-header {
  flex-shrink: 0;
}
.app-body {
  flex: 1;
  padding: 1rem 0;
}
.app-footer {
  flex-shrink: 0;
}

/* Constructor: body fills all remaining space, no padding */
.app-layout.is-constructor .app-body {
  padding: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
</style>
