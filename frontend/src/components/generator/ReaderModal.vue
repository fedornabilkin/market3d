<script setup>
import { QrcodeDropZone, QrcodeCapture } from 'vue-qrcode-reader';
import {ref} from "vue";

// source https://gruhn.github.io/vue-qrcode-reader/demos/DragDrop.html

const props = defineProps(['isActive'])
const emit = defineEmits(['close', 'decode'])

const decodedData = ref('')
const timer = ref(25)
let dragover = false

const close = () => {
  emit('close')
}

const decode = (result) => {
  console.log('Read QR:', result)

  setInterval(() => {
    decodedData.value = result[0].rawValue
    timer.value -=1
  }, 1000)
  setTimeout(() => {
    success()
  }, timer.value * 1000)
}

const onDragOver = (flag) => {
  dragover = flag
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
      p.modal-card-title {{$t('g.readModalTitle')}}
      button.delete(aria-label='close' @click='close')
    section.modal-card-body
      qrcode-drop-zone(@detect='decode' @dragover="onDragOver")
        .drop-area(:class="{ dragover: dragover }")
          qrcode-capture(@detect='decode')
          .has-text-centered.py-3(v-if='decodedData' style='background: rgba(0,0,0,0.6)')
            p.is-size-4.mb-3(style='color: #fff;')
              | {{$t('g.readData')}}
            code.mt-3.is-size-5
              | {{decodedData}}
            .mt-2
              button.button.is-success(@click='success') {{$t('g.nextButton', [timer])}}
    footer.modal-card-foot
      button.button(@click='close') {{$t('g.close')}}
</template>
<style>
.drop-area {
  height: 300px;
  color: #fff;
  text-align: center;
  font-weight: bold;
  padding: 10px;
  border: .2rem dashed #ababae;
}

.dragover {
  background-color: #10b981;
}

.drop-error {
  color: red;
  font-weight: bold;
}
</style>
