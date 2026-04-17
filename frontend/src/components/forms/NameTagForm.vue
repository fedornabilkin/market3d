<script setup>
import Keychain from '@/components/forms/Keychain.vue';
import TextSection from '@/components/forms/nametag/TextSection.vue';
import FontSection from '@/components/forms/nametag/FontSection.vue';
import BackingSection from '@/components/forms/nametag/BackingSection.vue';
import BevelSection from '@/components/forms/nametag/BevelSection.vue';
import HollowSection from '@/components/forms/nametag/HollowSection.vue';
import RandomSection from '@/components/forms/nametag/RandomSection.vue';

defineProps(['options', 'unit']);
</script>

<template lang="pug">
TextSection(:options='options' :unit='unit')
FontSection(:options='options' :unit='unit')
BackingSection(:options='options' :unit='unit')
BevelSection(:options='options' :unit='unit')
HollowSection(:options='options' :unit='unit')
.nametag-section.nametag-section--keychain
  Keychain(:options='options.nametag' :unit='unit')
RandomSection(:options='options' :unit='unit')
</template>
