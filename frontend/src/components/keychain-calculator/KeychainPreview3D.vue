<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import qrcode from 'qrcode';
import { V3DFacade } from '@/v3d/V3DFacade';

const props = defineProps<{
  config: Record<string, unknown>;
  label: string;
}>();

const container = ref<HTMLElement | null>(null);
const loading = ref(true);
const failed = ref(false);
const facade = new V3DFacade({ debug: false });
let resizeObserver: ResizeObserver | undefined;

type PreviewConfig = Record<string, unknown> & {
  content?: unknown;
  code?: { active?: unknown; errorCorrectionLevel?: unknown };
};

function render(): void {
  facade.render();
}

onMounted(async () => {
  try {
    await nextTick();
    if (!container.value) return;
    facade.initialize(container.value);
    const box = facade.getBox();
    box.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    box.controls.enablePan = false;
    box.controls.enableDamping = true;
    box.controls.addEventListener('change', render);

    const modelConfig = structuredClone(props.config) as PreviewConfig;
    if (modelConfig.code?.active === true) {
      const content = typeof modelConfig.content === 'string' ? modelConfig.content : '';
      const errorCorrectionLevel = typeof modelConfig.code.errorCorrectionLevel === 'string'
        ? modelConfig.code.errorCorrectionLevel
        : 'M';
      facade.setQRCodeBitMask(qrcode.create(content, { errorCorrectionLevel }).modules.data);
    }
    await facade.generateModel(modelConfig);
    box.sceneGraphRoot.rotation.set(0, 0, 0);
    box.sceneGraphRoot.updateMatrixWorld(true);
    render();

    resizeObserver = new ResizeObserver(() => {
      if (!container.value) return;
      facade.setSize(container.value.clientWidth, container.value.clientHeight);
      render();
    });
    resizeObserver.observe(container.value);
  } catch (error) {
    failed.value = true;
    console.error('Keychain preview init failed:', error);
  } finally {
    loading.value = false;
  }
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  facade.dispose();
});
</script>

<template lang="pug">
.keychain-preview-3d(ref="container" :aria-label="label")
  i.fa.fa-cube.keychain-preview-3d__status(v-if="loading || failed" aria-hidden="true")
</template>

<style scoped>
.keychain-preview-3d {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  cursor: grab;
  touch-action: none;
}

.keychain-preview-3d:active {
  cursor: grabbing;
}

.keychain-preview-3d__status {
  position: absolute;
  inset: 50% auto auto 50%;
  color: #008a89;
  font-size: 1.4rem;
  opacity: 0.55;
  transform: translate(-50%, -50%);
}

.keychain-preview-3d :deep(canvas) {
  display: block;
  width: 100% !important;
  height: 100% !important;
}
</style>
