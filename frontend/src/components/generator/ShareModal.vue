<script setup>
import {ref} from "vue";
import {useUrlCreator} from "@/service/urlCreator.js";

const props = defineProps(['isActive'])
const emit = defineEmits(['close'])

let shortLink = ''
let loading = false
let shortActive = ref(false)

const params = { url: 'https://vsqr.ru/' + window.location.hash }

const {endpoint: endpointApi} = useUrlCreator('https://clck.ru/--', params)
const {endpoint: endpoint} = useUrlCreator('https://clck.ru/', params)
const {endpoint: endpointShorter} = useUrlCreator('https://go-link.ru/', {
  utm_source: 'vsqr.ru',
  utm_medium: 'free',
  utm_campaign: 'shareModal'
})

const close = () => {
  emit('close')
}

const getShortLink = () => {
  loading = true

  fetch(endpointApi.value)
    .then((res) => {
      if (res.status !== 200) {
        throw(res.statusText)
      }
      return res
    })
    .then(res => res.text())
    .then((res) => {
      shortLink = res
      shortActive.value = true
    })
    .catch((err) => {
      shortLink = ''
      console.log(err)
    })
    .finally(() => {
      loading = false
    })
}

getShortLink()

</script>

<template lang="pug">
.modal(:class="{'is-active': props.isActive}")
  .modal-background
  .modal-card
    header.modal-card-head
      p.modal-card-title {{$t('s.modalTitle')}}
      button.delete(aria-label='close' @click='close')
    section.modal-card-body
      p
        | {{$t('s.modalBody')}}
        a.ml-1(:href="endpointShorter" target="_blank") go-link.ru

      button.button.is-warning.is-large(v-if="!shortActive" :class="{'is-loading': loading}")

      .field.mt-3(v-if="shortActive")
        label.label {{$t('s.shortLinkLabel')}}
        .control.has-icons-left.has-icons-right
          input.input.is-success(v-model='shortLink' type="url")
          span.icon.is-small.is-left
            i.fab.fa-yandex
          span.icon.is-small.is-right
            i.fas.fa-check
        p.help.is-link
          a(:href="endpoint" target="_blank") {{$t('s.shortServiceLabel')}}

    footer.modal-card-foot
      button.button(@click='close') {{$t('g.close')}}
</template>
