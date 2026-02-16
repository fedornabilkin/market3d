<script setup>
import ShareButtons from './ShareButtons.vue';
import Yoomoney from "@/components/monetisation/Yoomoney.vue";
import LanguageSelector from "@/components/template/LanguageSelector.vue";
</script>

<template lang="pug">
footer.footer
  .container
    .columns
      .column
        Yoomoney
      .column
        a.button.is-info(href="/examples") {{ $t('t.exampleButton') }}

      .column
        ShareButtons
      .column
        LanguageSelector

    .box
      .is-pulled-right
        a(href="/") vsqr.ru
        | &nbsp;&copy; 2025
      .button.is-light
        a(href="https://t.me/+dSgck2GM29syZTQ6" target="_blank")
          i.fab.fa-telegram
          | &nbsp;{{ $t('t.discussionButton') }}
</template>

<style scoped>
footer.footer {padding-bottom: .5rem}
</style>
