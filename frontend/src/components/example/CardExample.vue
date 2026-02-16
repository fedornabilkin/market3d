<script setup>
const props = defineProps(['item'])
const item = props.item
</script>

<template lang="pug">
  .box
    article.media
      .media-left
        figure.image.is-128x128
          img(:src="item.img.src" :alt="item.img.alt")
        a.tag.is-link(:href="item.url") Создать
      .media-content
        .content
          p {{ item.text }}
          .tags
            span.tag(v-for="tag in item.tags")
              | {{ tag }}

</template>

<style scoped>

</style>
