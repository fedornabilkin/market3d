<script setup lang="ts">
import {ref} from "vue";
import {SponsorBuilder} from "@/entity/builder.js";

const sponsors = ref([])

const getSponsor = () => {
  let endpointApi = `/api/sponsor`

  const host = window.location.host
  if (host.includes('localhost')) {
    const noderedHost = import.meta.env.VITE_NODERED_HOST
    endpointApi = `${noderedHost || 'localhost'}${endpointApi}`
  }

  fetch(endpointApi)
    .then(res => res.json())
    .then((res) => {
      const builder = new SponsorBuilder()
      builder.createCollection(res.data)
      sponsors.value = builder.getCollection()
    })
    .catch((err) => {console.log(err)})
}

getSponsor()
</script>

<template lang="pug">
  .sponsor(v-if="sponsors.length")
    | {{ $t('m.sponsorList') }}
    .tags
      .tag(v-for="item in sponsors")
        | {{ item.name}}
</template>

<style scoped>

</style>
