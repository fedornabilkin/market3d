import * as THREE from 'three';

export interface ConstraintPlaneInfo {
  plane: THREE.Plane;
  worldAxis: THREE.Vector3;
  isVertical: boolean;
  isCorner: boolean;
  localAxisX?: THREE.Vector3;
  localAxisZ?: THREE.Vector3;
}

export interface ConstraintPlaneHost {
  selectedObject3D: THREE.Object3D | null;
  camera: THREE.PerspectiveCamera | null;
}

/**
 * Считает constraint-плоскость и мировую ось для drag'а конкретного
 * handle'а.
 *
 * - Для горизонтальных handle'ов (edges, corners) constraint-плоскость
 *   проходит через нижнюю грань объекта (Z=botZ) — курсор всегда трекает
 *   реальные клетки сетки.
 * - Для вертикальных (height, offsetY) — плоскость лицом к камере, чтобы
 *   вертикальное движение мыши мапилось на Z-перемещение независимо от
 *   ракурса камеры.
 *
 * Извлечено из `ConstructorSceneService.computeHandleConstraintPlane`.
 */
export function computeHandleConstraintPlane(
  handleType: string,
  host: ConstraintPlaneHost,
): ConstraintPlaneInfo {
  const objectPos = new THREE.Vector3();
  if (host.selectedObject3D) {
    host.selectedObject3D.getWorldPosition(objectPos);
  }

  // Z-up: точка на уровне нижней грани объекта (Z=min.z).
  let botZ = 0;
  if (host.selectedObject3D) {
    const box = new THREE.Box3().setFromObject(host.selectedObject3D);
    botZ = box.min.z;
  }
  const projOrigin = new THREE.Vector3(objectPos.x, objectPos.y, botZ);

  let worldAxis: THREE.Vector3;
  let isVertical = false;
  let isCorner = false;
  let localAxisX: THREE.Vector3 | undefined;
  let localAxisZ: THREE.Vector3 | undefined;

  switch (handleType) {
    case 'edgeWidthLeft':
    case 'edgeWidthRight':
      worldAxis = new THREE.Vector3(1, 0, 0);
      break;
    case 'edgeLengthFront':
    case 'edgeLengthBack':
      worldAxis = new THREE.Vector3(0, 1, 0);
      break;
    case 'height':
    case 'offsetY':
      // Тип имени 'offsetY' исторический — семантика «вертикаль» (Z в Z-up).
      worldAxis = new THREE.Vector3(0, 0, 1);
      isVertical = true;
      break;
    case 'cornerBL':
    case 'cornerBR':
    case 'cornerTL':
    case 'cornerTR':
      // Угловая ручка тянет в XY-плоскости. localAxisX — ось X, поле
      // localAxisZ переиспользуется под вторую горизонтальную ось (Y).
      worldAxis = new THREE.Vector3(1, 1, 0).normalize();
      isCorner = true;
      localAxisX = new THREE.Vector3(1, 0, 0);
      localAxisZ = new THREE.Vector3(0, 1, 0);
      break;
    default:
      worldAxis = new THREE.Vector3(1, 0, 0);
      break;
  }

  let plane: THREE.Plane;
  if (isVertical) {
    // Вертикальные: плоскость лицом к камере (drag отслеживает Z).
    const camDir = new THREE.Vector3();
    host.camera!.getWorldDirection(camDir);
    const normal = camDir.clone().negate().normalize();
    if (normal.lengthSq() < 0.001) normal.set(0, 1, 0);
    plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, objectPos);
  } else {
    // Рёбра и углы: горизонтальная плоскость Z=botZ.
    plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      new THREE.Vector3(0, 0, 1),
      projOrigin,
    );
  }

  return { plane, worldAxis, isVertical, isCorner, localAxisX, localAxisZ };
}
