<script setup>
import { QrcodeStream } from 'vue-qrcode-reader';
import {ref} from "vue";

const props = defineProps(['isActive'])
const emit = defineEmits(['close', 'decode'])

const decodedData = ref('')
const timer = ref(25)

const close = () => {
  emit('close')
}

const decode = (result) => {
  console.log('Scan QR:', result)

  setInterval(() => {
    decodedData.value = result[0].rawValue
    timer.value -=1
  }, 1000)
  setTimeout(() => {
    success()
  }, timer.value * 1000)
}

const success = () => {
  emit('decode', decodedData.value)
  close()
}

</script>

<template lang="pug">
.modal(:class="{'is-active': props.isActive}")
  .modal-background
  .modal-card
    header.modal-card-head
      p.modal-card-title {{$t('g.scanModalTitle')}}
      button.delete(aria-label='close' @click='close')
    section.modal-card-body
      qrcode-stream(@detect='decode')
        .has-text-centered.py-3(v-if='decodedData' style='background: rgba(0,0,0,0.6)')
          p.is-size-4.mb-3(style='color: #fff;')
            | {{$t('g.scanData')}}
          code.mt-3.is-size-5
            | {{decodedData}}
          .mt-2
            button.button.is-success(@click='success') {{$t('g.nextButton', [timer])}}
    footer.modal-card-foot
      button.button(@click='close') {{$t('g.close')}}
</template>
