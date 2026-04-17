<script setup>
import Icon from '@/components/forms/Icon.vue';
import Keychain from '@/components/forms/Keychain.vue';
import BaseSection from '@/components/forms/coaster/BaseSection.vue';
import RingsSection from '@/components/forms/coaster/RingsSection.vue';
import TextSection from '@/components/forms/coaster/TextSection.vue';

defineProps(['options', 'unit']);
</script>

<template lang="pug">
BaseSection(:options='options' :unit='unit')
RingsSection(:options='options' :unit='unit')
TextSection(:options='options' :unit='unit')

.coaster-section.coaster-section--icon
  Icon(:options='options' :unit='unit')

.coaster-section.coaster-section--keychain
  Keychain(:options='options' :unit='unit')
</template>
