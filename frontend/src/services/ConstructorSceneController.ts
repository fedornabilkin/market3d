import {
  ConstructorSceneService,
  type ConstructorSceneServiceOptions,
} from '@/v3d/constructor/ConstructorSceneService';
import { FeatureDocument } from '@/v3d/constructor/features/FeatureDocument';
import type { ChamferMode } from '@/v3d/constructor/modes/ChamferMode';
import type { GeneratorMode } from '@/v3d/constructor/generators/GeneratorMode';

export type SceneViewSettings = {
  snapStep: number;
  showGrid: boolean;
  background: string;
  zoomSpeed: number;
  gridWidth: number;
  gridLength: number;
};

export type SceneModeHandlers = {
  onChamferEdge: NonNullable<ChamferMode['onEdgeClick']>;
  onGenerate: NonNullable<GeneratorMode['onGenerate']>;
};

/** Owns ConstructorSceneService lifecycle and initial view configuration. */
export class ConstructorSceneController {
  private current: ConstructorSceneService | null = null;

  mount(
    container: HTMLElement,
    options: ConstructorSceneServiceOptions,
    settings: SceneViewSettings,
  ): ConstructorSceneService {
    this.unmount();
    const document = new FeatureDocument();
    document.loadFromJSON({
      version: 2,
      features: [{ id: 'root', type: 'group', params: {}, inputs: [], name: 'Scene' }],
      rootIds: ['root'],
    });
    const service = new ConstructorSceneService(document, options);
    service.mount(container);
    service.setSnapStep(settings.snapStep);
    service.setGridVisible(settings.showGrid);
    service.setBackgroundColor(settings.background);
    service.setZoomSpeed(settings.zoomSpeed);
    service.setGridSize(settings.gridWidth, settings.gridLength);
    this.current = service;
    return service;
  }

  get service(): ConstructorSceneService | null { return this.current; }

  wireModes(handlers: SceneModeHandlers): void {
    if (!this.current) return;
    this.current.getChamferMode().onEdgeClick = handlers.onChamferEdge;
    this.current.getGeneratorMode().onGenerate = handlers.onGenerate;
  }

  getCameraDebug(): { x: string; y: string; z: string; tx: string; ty: string; tz: string } | null {
    if (!this.current) return null;
    const camera = (this.current as unknown as { camera?: { position: { x: number; y: number; z: number } } }).camera;
    const controls = (this.current as unknown as { controls?: { target?: { x: number; y: number; z: number } } }).controls;
    if (!camera) return null;
    const target = controls?.target;
    return {
      x: camera.position.x.toFixed(1), y: camera.position.y.toFixed(1), z: camera.position.z.toFixed(1),
      tx: target?.x.toFixed(1) ?? '0', ty: target?.y.toFixed(1) ?? '0', tz: target?.z.toFixed(1) ?? '0',
    };
  }

  unmount(): void {
    this.current?.unmount();
    this.current = null;
  }
}
