<script setup>
const emit = defineEmits(['recovery'])
const props = defineProps(['store', 'title'])

let items = []
if (props.store) {
  items = props.store.getCollection()
}

const dateTimeFormat = (dt, format= {
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric'
}) => {
  // https://learn.javascript.ru/datetime
  const date = new Date(dt)
  return date.toLocaleString("ru", format)
}

const recovery = (item) => {
  emit('recovery', item)
}

const removeItem = (item) => {
  props.store.removeItem(item)
}
</script>

<template lang="pug">
table.table.is-striped.is-fullwidth(v-if="items.length")
  thead
    tr
      th(colspan="4") {{ props.title }}
  tbody
    tr(v-for="item in items", :key="item.date")
      td
        img(v-if="item.img.src" :src="item.img.src" width="100")
      td
        button(@click="recovery(item)") {{ $t('e.loadItem') }}
      td
        span.is-size-6.has-text-grey {{ dateTimeFormat(item.date) }}
      td
        span.delete.pulled-right(aria-label="close" @click="removeItem(item)" :title="$t('g.remove')")
</template>

<style scoped>

</style>
