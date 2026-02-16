<script setup>
const props = defineProps(['activeTabIndex'])
const emit = defineEmits(['change'])
const change = (idx) => {
  emit('change', idx)
}
</script>
<template lang="pug">
  .panel-tabs.tabs(id="option-tabs")
    ul
      li(:class="{ 'is-active': activeTabIndex === 0 }" @click="change(0)")
        a
          span.icon.is-small
            i.fas.fa-font(aria-hidden="true")
          span.is-hidden-mobile Text/URL
      li(:class="{ 'is-active': activeTabIndex === 1 }" @click="change(1)")
        a
          span.icon.is-small
            i.fas.fa-wifi(aria-hidden="true")
          span.is-hidden-mobile Wifi
      li(:class="{ 'is-active': activeTabIndex === 2 }" @click="change(2)")
        a
          span.icon.is-small
            i.far.fa-envelope(aria-hidden="true")
          span.is-hidden-mobile E-Mail
      li(:class="{ 'is-active': activeTabIndex === 3 }" @click="change(3)")
        a
          span.icon.is-small
            i.far.fa-address-card(aria-hidden="true")
          //span.is-hidden-mobile {{$t('contact')}} (vCard)
      li(:class="{ 'is-active': activeTabIndex === 4 }" @click="change(4)")
        a
          span.icon.is-small
            i.far.fa-comment(aria-hidden="true")
          //span SMS
</template>

<style>
</style>
