import { reactive, ref } from 'vue';
import type { ConstructorSceneService } from '@/v3d/constructor/ConstructorSceneService';
import type { SceneViewSettings } from './ConstructorSceneController';

type SceneServiceProvider = () => ConstructorSceneService | null;

/** Keeps viewport UI state and the mounted scene service in sync. */
export class ConstructorViewportController {
  readonly snapValues = [0.1, 0.25, 0.5, 1, 2, 5, 10] as const;
  readonly zoomSpeeds = [0.5, 1, 2] as const;
  readonly snapStep = ref(1);
  readonly settings = reactive<Omit<SceneViewSettings, 'snapStep'>>({
    showGrid: true,
    background: '#f0f0f0',
    zoomSpeed: 1,
    gridWidth: 200,
    gridLength: 200,
  });

  constructor(private readonly getService: SceneServiceProvider) {}

  readonly setSnapStep = (step: number): void => {
    this.snapStep.value = step;
    this.getService()?.setSnapStep(step);
  };

  readonly toggleSnap = (): void => {
    this.setSnapStep(this.snapStep.value > 0 ? 0 : 1);
  };

  readonly toggleGrid = (): void => {
    this.settings.showGrid = !this.settings.showGrid;
    this.getService()?.setGridVisible(this.settings.showGrid);
  };

  readonly setZoomSpeed = (speed: number): void => {
    this.settings.zoomSpeed = speed;
    this.getService()?.setZoomSpeed(speed);
  };

  readonly setGridSize = (width: number, length: number): void => {
    this.settings.gridWidth = width;
    this.settings.gridLength = length;
    this.getService()?.setGridSize(width, length);
  };

  readonly setBackground = (background: string): void => {
    this.settings.background = background;
    this.getService()?.setBackgroundColor(background);
  };

  snapshot(): SceneViewSettings {
    return { snapStep: this.snapStep.value, ...this.settings };
  }
}
