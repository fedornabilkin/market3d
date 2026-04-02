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
      p.modal-card-title {{ $t('e.generateHistory') }}
      button.delete(aria-label="close" @click="close")
    section.modal-card-body
      .message.is-info
        .message-body
          p {{ $t('e.helpHistory', [props.store.getLimit()]) }}
      ExportList(:store="props.store" :title="$t('g.historyButton')" @recovery="recovery")

    footer.modal-card-foot
      button.button.mr-1(@click="close") {{ $t('g.close') }}
</template>
