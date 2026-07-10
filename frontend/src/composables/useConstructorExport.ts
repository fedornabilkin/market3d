import { ref } from 'vue';
import type { ConstructorSceneService } from '@/v3d/constructor/ConstructorSceneService';
import { dataURItoBlob } from '@/utils.js';

export function useConstructorExport(
  getService: () => ConstructorSceneService | null,
  getBaseName: () => string,
) {
  const visible = ref(false);
  const format = ref<'stl' | 'obj'>('stl');
  const onlySelected = ref(false);
  const exporting = ref(false);
  const percent = ref(0);
  const status = ref('');

  async function start(): Promise<void> {
    const service = getService();
    if (!service || exporting.value) return;
    exporting.value = true;
    percent.value = 0;
    status.value = 'Подготовка модели...';
    const extension = format.value;
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '_').slice(0, 15);
    const filename = `${getBaseName() || 'vsqr'}_${timestamp}.${extension}`;
    const onProgress = (done: number, total: number) => {
      percent.value = total === 0 ? 100 : Math.round((done / total) * 90);
      status.value = `CSG: ${done} / ${total}`;
    };
    try {
      await delay(50);
      const exporter = service.getExporter();
      if (extension === 'stl') await exporter.exportSTLAsync(filename, onlySelected.value, onProgress);
      else await exporter.exportOBJAsync(filename, onlySelected.value, onProgress);
      percent.value = 100;
      status.value = 'Готово!';
      sendScreenshot(service);
      await delay(400);
    } catch (error) {
      console.error('[Export] failed:', error);
      status.value = 'Ошибка экспорта';
      await delay(1500);
    } finally {
      exporting.value = false;
      percent.value = 0;
      visible.value = false;
    }
  }

  return { visible, format, onlySelected, exporting, percent, status, start };
}

function sendScreenshot(service: ConstructorSceneService): void {
  const image = service.getScreenshotDataUrl();
  if (!image || window.location.host.includes('localhost')) return;
  const host = window.location.host;
  const url = `${window.location.origin}/constructor`;
  fetch(`/api/image?${new URLSearchParams({ url, host }).toString()}`, {
    method: 'POST', headers: { 'Content-Type': 'image/png' }, body: dataURItoBlob(image),
  }).catch((error) => console.warn('[Constructor] Failed to send screenshot:', error));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
