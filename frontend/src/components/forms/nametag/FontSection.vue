<script setup>
import { getBundledFontList } from '@/v3d/generator/NameTagGenerator';

const props = defineProps(['options', 'unit']);
const fonts = getBundledFontList();

const onCustomFontFile = async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  try {
    JSON.parse(text);
  } catch (e) {
    alert('Файл не является корректным typeface.json');
    event.target.value = '';
    return;
  }
  props.options.nametag.customFontData = text;
  props.options.nametag.customFontName = file.name.replace(/\.json$/i, '');
  event.target.value = '';
};

const clearCustomFont = () => {
  props.options.nametag.customFontData = null;
  props.options.nametag.customFontName = null;
};
</script>

<template lang="pug">
.nametag-section.nametag-section--font
  .field
    label.label {{ $t('form.nametag.font.title') }}
  .box
    .field.is-horizontal
      .field-label.is-small
        label.label {{ $t('form.nametag.font.bundled') }}
      .field-body
        .field
          .control
            .select.is-small.is-fullwidth
              select(v-model='options.nametag.fontName' :disabled='!!options.nametag.customFontData')
                option(v-for='f in fonts' :key='f.value' :value='f.value') {{ f.label }}

    .field.is-horizontal
      .field-label.is-small
        label.label {{ $t('form.nametag.font.custom') }}
      .field-body
        .field
          .control(v-if='!options.nametag.customFontData')
            label.button.is-small.is-light
              span.icon
                i.fa.fa-upload
              span {{ $t('form.nametag.font.upload') }}
              input(type='file' accept='.json,application/json' style='display:none' @change='onCustomFontFile')
          .control(v-else)
            .tags.has-addons
              span.tag.is-info {{ options.nametag.customFontName || $t('form.nametag.font.custom') }}
              button.tag.is-delete(@click='clearCustomFont' :title="$t('form.nametag.font.removeCustom')")

    p.help.is-size-7
      | {{ $t('form.nametag.font.formatHelp') }}&nbsp;
      a(href='https://gero3.github.io/facetype.js/' target='_blank' rel='noopener') facetype.js
</template>
