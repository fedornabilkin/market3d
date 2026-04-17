import { ref, reactive, markRaw } from 'vue';
import { V3DFacade } from '@/v3d/V3DFacade';
import { useExportList } from '@/store/exportList';
import { Share } from '@/entity/share';

/**
 * Shared scene + export plumbing for every /generator/* view.
 *
 * Each view differs only by its settings menu, tour, and filename convention;
 * everything else (V3DFacade lifecycle, STL/OBJ/PNG export, history store,
 * localStorage persistence) is identical. This composable owns that common
 * state and exposes it as plain properties so Options-API views can spread it
 * out of setup() directly.
 *
 * @param {Object} opts
 * @param {string} [opts.containerId='container3d'] — id of the DOM node hosting the renderer
 * @param {(options:Object) => string} opts.fileName — builds base filename (no extension)
 * @param {number} [opts.exportTimer=5000] — delay before export runs, matches the progress modal
 */
export function useGenerator({ containerId = 'container3d', fileName, exportTimer = 5000 } = {}) {
  const storeExport = useExportList();
  const v3dFacade = markRaw(new V3DFacade({ debug: false }));

  const expSettings = reactive({ active: false, ascii: false, multiple: false });
  const options = ref({});
  const sceneReady = ref(false);
  const isGenerating = ref(false);
  const exportModalVisible = ref(false);
  const historyDownloadModalVisible = ref(false);

  let camera = null;
  let renderer = null;
  let scene = null;

  function initScene() {
    const container = document.getElementById(containerId);
    v3dFacade.initialize(container);
    camera = markRaw(v3dFacade.getCamera());
    renderer = markRaw(v3dFacade.getRenderer());
    scene = markRaw(v3dFacade.getScene());
    sceneReady.value = true;
  }

  function startAnimation() {
    v3dFacade.startAnimation((time) => {
      v3dFacade.getBox().animate(false, time);
    });
  }

  function generating() {
    isGenerating.value = true;
  }

  function exportReady(newOptions) {
    expSettings.active = true;
    try {
      options.value = newOptions;
    } catch (error) {
      console.error(error);
    } finally {
      isGenerating.value = false;
    }
  }

  function menuVisible() {
    return sceneReady.value;
  }

  function _recordExport() {
    const image = v3dFacade.getImageDataUrl();
    storeExport.add(new Share({ img: { src: image }, options: options.value, date: Date.now() }));
    storeExport.downloadAllUpdate();
    window.localStorage.setItem(storeExport.keyStoreAll, storeExport.getDownloadAll());
  }

  function _name() {
    return typeof fileName === 'function' ? fileName(options.value) : `model_${Date.now()}`;
  }

  function exportSTL() {
    exportModalVisible.value = true;
    setTimeout(async () => {
      await v3dFacade.exportSTL({
        binary: !expSettings.ascii,
        multiple: expSettings.multiple,
        filename: `${_name()}.stl`,
      });
      _recordExport();
    }, exportTimer);
  }

  function exportOBJ() {
    exportModalVisible.value = true;
    setTimeout(async () => {
      await v3dFacade.exportOBJ(`${_name()}.obj`);
      _recordExport();
    }, exportTimer);
  }

  function exportPNG() {
    if (!renderer || !scene || !camera) return;
    const container = document.getElementById(containerId);
    const origWidth = container.clientWidth;
    const origHeight = container.clientHeight;
    const origPixelRatio = renderer.getPixelRatio();

    const scale = 3;
    renderer.setPixelRatio(scale);
    renderer.setSize(origWidth, origHeight);
    renderer.render(scene, camera);

    const dataUrl = renderer.domElement.toDataURL('image/png');

    renderer.setPixelRatio(origPixelRatio);
    renderer.setSize(origWidth, origHeight);

    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${_name()}.png`;
    a.click();
  }

  function fillExportList() {
    const list = JSON.parse(window.localStorage.getItem(storeExport.keyStore)) || [];
    const collection = list.map((item) => new Share(item));
    storeExport.fillCollection(collection);
    storeExport.setCallback((coll) => {
      window.localStorage.setItem(storeExport.keyStore, JSON.stringify(coll));
    });
    let downloadAll = window.localStorage.getItem(storeExport.keyStoreAll);
    if (collection.length > 0 && collection.length > downloadAll) {
      downloadAll = collection.length;
    }
    storeExport.setDownloadAll(downloadAll);
  }

  function recoveryModel(item) {
    options.value = JSON.parse(item.options);
  }

  return {
    v3dFacade,
    storeExport,
    expSettings,
    options,
    sceneReady,
    isGenerating,
    exportModalVisible,
    historyDownloadModalVisible,
    initScene,
    startAnimation,
    generating,
    exportReady,
    menuVisible,
    exportSTL,
    exportOBJ,
    exportPNG,
    fillExportList,
    recoveryModel,
  };
}
