<template lang="pug">
.scene-loading-indicator(v-if="visible" role="status" aria-live="polite")
  span.scene-loading-spinner
  span Загрузка сцены…
</template>
<script setup lang="ts">
defineProps<{ visible: boolean }>();
</script>
<style scoped>
.scene-loading-indicator { position:absolute; left:50%; top:3.25rem; transform:translateX(-50%); display:inline-flex; align-items:center; gap:.4rem; padding:.28rem .6rem; border:1px solid rgba(255,255,255,.14); border-radius:999px; background:rgba(22,27,36,.88); color:rgba(255,255,255,.82); font-size:.72rem; line-height:1; pointer-events:none; z-index:12; }
.scene-loading-spinner { width:.7rem; height:.7rem; border:2px solid rgba(255,255,255,.25); border-top-color:#64b5f6; border-radius:50%; animation:spin .7s linear infinite; }
@keyframes spin { to { transform:rotate(360deg); } }
</style>
