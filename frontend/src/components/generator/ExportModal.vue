<template lang="pug">
div(:class="{'modal': true, 'is-active': isActive}")
  div.modal-background
  div.modal-card
    header.modal-card-head
      p.modal-card-title {{ $t('e.modalTitle') }}
      button.delete(aria-label="close" @click="close")
    section.modal-card-body
      p.is-size-4.mb-2
        span(v-if="seconds > 0") {{ $t('e.downloadStart', [seconds]) }}
        span(v-if="seconds === 0") {{ $t('e.downloadStarted') }}
        progress.progress.is-small.is-primary(max="100" :value="progress")

      .mb-2
        sbp-money
      .cross
      .isd
        | Сканируй, поддержи проект
        br
        img(src="/monetisation/qr/yookassa-qr.png")
        //Yoomoney
        //YoomoneyWidget
      //.is-light
        a.button(href="/examples") {{ $t('e.exampleButton') }}
    footer.modal-card-foot
      button.button.mr-1(@click="close") {{ $t('g.close') }}
      span {{ $t('e.thankYouSupport') }}
</template>

<script>

import Yoomoney from "@/components/monetisation/Yoomoney.vue";
import SbpMoney from "@/components/monetisation/SbpMoney.vue";
import YoomoneyWidget from "@/components/monetisation/YoomoneyWidget.vue";

export default {
  name: 'ExportModal',
  components: {YoomoneyWidget, SbpMoney, Yoomoney},
  props: {
    isActive: {
      type: Boolean,
      required: true,
    },
  },
  data: () => ({
    seconds: 5,
    progress: 0,
    progressPart: 20,
    intervalId: null,
  }),
  mounted() {
    this.timerReset()
    this.intervalId = setInterval(() => {
      if (this.seconds > 0) {
        this.seconds -= 1
        this.progress += this.progressPart
      }
    }, 1000)
  },
  methods: {
    close() {
      this.timerReset()
      clearInterval(this.intervalId)
      this.$emit('close')
    },
    timerReset() {
      const min = 3
      const max = 7
      this.seconds = Math.floor(Math.random() * (max - min + 1)) + min
      this.progress = 0
      this.progressPart = 100 / this.seconds
    }
  },
}
</script>
