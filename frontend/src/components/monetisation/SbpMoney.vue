<script setup>
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
  .message.is-warning
    .message-body
      .sponsor.is-pulled-right(v-if="sponsors.length")
        | Спонсоры:
        .tags
          .tag(v-for="item in sponsors")
            | {{ item.name}}
      .dm
        | СБП по номеру +79264686392 на ВТБ
        .is-small Самая малая благодарность вдохновляет
</template>

<style scoped>

</style>
