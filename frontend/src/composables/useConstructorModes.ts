import { ref, watch } from 'vue';
import type { ConstructorSceneService } from '@/v3d/constructor/ConstructorSceneService';

export type GeneratorType = 'thread' | 'knurl';
export type ThreadFormSettings = {
  outerDiameter: number; innerDiameter: number; pitch: number; turns: number;
  segmentsPerTurn: number; leftHand: boolean;
};
export type KnurlFormSettings = {
  outerDiameter: number; innerDiameter: number; height: number; notchCount: number;
  pattern: 'straight' | 'diagonal' | 'diamond' | 'cross45' | 'flatDiamond';
  angle: number; segmentsPerNotch: number; heightSegments: number;
};

export function useConstructorModes(getService: () => ConstructorSceneService | null) {
  const mirror = ref(false);
  const cruise = ref(false);
  const alignment = ref(false);
  const chamfer = ref(false);
  const chamferRadius = ref(2);
  const generator = ref(false);
  const generatorType = ref<GeneratorType>('thread');
  const threadSettings = ref<ThreadFormSettings>({
    outerDiameter: 10, innerDiameter: 8, pitch: 2, turns: 5,
    segmentsPerTurn: 64, leftHand: false,
  });
  const knurlSettings = ref<KnurlFormSettings>({
    outerDiameter: 10, innerDiameter: 9, height: 10, notchCount: 16,
    pattern: 'straight', angle: 30, segmentsPerNotch: 4, heightSegments: 12,
  });

  function toggleMirror(): void {
    const service = getService();
    if (!service) return;
    mirror.value = !mirror.value;
    service.setMirrorMode(mirror.value);
  }
  function disableMirror(): void {
    if (!mirror.value) return;
    mirror.value = false;
    getService()?.setMirrorMode(false);
  }
  function toggleCruise(): void {
    const service = getService();
    if (!service) return;
    cruise.value = !cruise.value;
    service.setCruiseMode(cruise.value);
  }
  function toggleAlignment(): void {
    const service = getService();
    if (!service) return;
    alignment.value = !alignment.value;
    service.setAlignmentMode(alignment.value);
  }
  function setGeneratorType(type: GeneratorType): void {
    generatorType.value = type;
    if (generator.value) syncGeneratorPreview();
  }
  function toggleGenerator(): void {
    const service = getService();
    if (!service) return;
    generator.value = !generator.value;
    service.setGeneratorMode(generator.value);
    if (!generator.value) return;
    syncGeneratorPreview();
    if (chamfer.value) {
      chamfer.value = false;
      service.setChamferMode(false);
    }
  }
  function deactivateGenerator(): void {
    generator.value = false;
    getService()?.setGeneratorMode(false);
  }
  function confirmGenerator(): void { getService()?.getGeneratorMode().confirm(); }
  function toggleChamfer(): void {
    const service = getService();
    if (!service) return;
    chamfer.value = !chamfer.value;
    service.setChamferMode(chamfer.value);
    if (chamfer.value) syncChamferPreview();
  }
  function syncGeneratorPreview(): void {
    const service = getService();
    if (!service || !generator.value) return;
    const mode = service.getGeneratorMode();
    mode.settings.type = generatorType.value;
    mode.settings.thread = { ...threadSettings.value, profile: 'trapezoid' };
    mode.settings.knurl = { ...knurlSettings.value };
    mode.updatePreview();
  }
  function syncChamferPreview(): void {
    const service = getService();
    if (!service || !chamfer.value) return;
    const mode = service.getChamferMode();
    mode.settings.radius = chamferRadius.value;
    mode.settings.profile = 'concave';
    mode.refreshPreview();
  }

  watch(chamferRadius, syncChamferPreview);
  watch(threadSettings, () => generatorType.value === 'thread' && syncGeneratorPreview(), { deep: true });
  watch(knurlSettings, () => generatorType.value === 'knurl' && syncGeneratorPreview(), { deep: true });
  watch(() => knurlSettings.value.outerDiameter, (value, previous) => {
    if (!(value > 0)) return;
    if (previous > 0 && previous !== value) {
      knurlSettings.value.notchCount = Math.max(3, Math.round(knurlSettings.value.notchCount * value / previous));
    }
    if (value < knurlSettings.value.innerDiameter) knurlSettings.value.innerDiameter = value;
  });
  watch(() => knurlSettings.value.innerDiameter, (value) => {
    if (value > 0 && value > knurlSettings.value.outerDiameter) knurlSettings.value.outerDiameter = value;
  });

  return {
    mirror, cruise, alignment, chamfer, chamferRadius, generator, generatorType,
    threadSettings, knurlSettings, toggleMirror, disableMirror, toggleCruise,
    toggleAlignment, setGeneratorType, toggleGenerator, deactivateGenerator,
    confirmGenerator, toggleChamfer,
  };
}
