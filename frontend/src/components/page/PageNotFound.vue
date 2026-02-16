<script setup>
import {useRouter} from "vue-router";

const router = useRouter()
const goBack = () => {
  router.go(-1)
}
</script>

<template lang="pug">
.panel
  p.panel-heading {{$t('pageNotFound')}}
  .panel-block
    button.button.is-primary(@click="goBack") {{ $t('back') }}
</template>

<style scoped>

</style>
