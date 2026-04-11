<script setup>
import ExportList from "@/components/generator/ExportList.vue";

const props = defineProps(['isActive', 'title', 'store'])
const emit = defineEmits(['close', 'recovery'])

const recovery = (item) => {
  emit('recovery', item)
  close()
}

const close = () => {
  emit('close')
}
</script>
<template lang="pug">
div(:class="{'modal': true, 'is-active': isActive}")
  div.modal-background
  div.modal-card
    header.modal-card-head
      p.modal-card-title {{ props.title }}
      button.delete(aria-label="close" @click="close")
    section.modal-card-body
      ExportList(:store="props.store" :title="props.title" @recovery="recovery")

    footer.modal-card-foot
      button.button.mr-1(@click="close") {{ $t('g.close') }}
</template>
