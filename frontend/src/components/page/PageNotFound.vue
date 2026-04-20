<script setup>
import {useRouter} from "vue-router";
import { useSeoHeadI18n } from '@/composables/useSeoHead';

useSeoHeadI18n('seo.notFound', { noIndex: true });

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
