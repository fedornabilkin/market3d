<script setup>
import Header from "@/components/template/Header.vue";
import Footer from "@/components/template/Footer.vue";
</script>

<template lang="pug">
  .hero.is-fullheight
    .hero-head
      Header
    .hero-body.custom
      router-view
    .hero-foot
      Footer
</template>

<style scoped>
.hero .hero-body.custom {
  padding-top: 0;
}
</style>
