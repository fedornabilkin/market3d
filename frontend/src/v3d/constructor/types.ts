/**
 * Types and interfaces for the visual 3D constructor.
 * Used by nodes, serialization, and CSG operations.
 */

export type CSGType = 'union' | 'subtract' | 'intersect';

export type PrimitiveType =
  | 'box'
  | 'sphere'
  | 'cylinder'
  | 'cone'
  | 'torus'
  | 'plane'
  | 'ring'
  | 'thread'
  | 'knurl';

/** Transform params compatible with Three.js (position, scale, rotation). */
export interface NodeParams {
  position?: { x: number; y: number; z: number };
  scale?: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number; order?: string };
  /** Primitive renders semi-transparent and is treated as a hole in CSG context. */
  isHole?: boolean;
  /** Hex color string, e.g. '#ff6600'. Defaults to gray if omitted. */
  color?: string;
  [key: string]: unknown;
}

/** Params for primitive geometries. All fields are optional and have geometry-level defaults. */
export interface PrimitiveParams {
  // Box
  width?: number;
  height?: number;
  depth?: number;
  // Sphere / generic radius
  radius?: number;
  // Cylinder
  radiusTop?: number;
  radiusBottom?: number;
  // Segments
  segments?: number;
  widthSegments?: number;
  heightSegments?: number;
  // Torus
  tube?: number;
  // Ring
  innerRadius?: number;
  outerRadius?: number;
  // Bevel (edge rounding)
  bevelRadius?: number;
  bevelSegments?: number;
  // Thread
  outerDiameter?: number;
  innerDiameter?: number;
  pitch?: number;
  turns?: number;
  threadProfile?: string;
  leftHand?: boolean;
  // Knurl
  notchCount?: number;
  knurlPattern?: string;
  knurlAngle?: number;
  segmentsPerNotch?: number;
  [key: string]: unknown;
}

/** JSON structure for a serialized primitive node. */
export interface PrimitiveNodeJSON {
  kind: 'primitive';
  type: PrimitiveType;
  params: PrimitiveParams;
  nodeParams?: NodeParams;
  name?: string;
}

/** JSON structure for a serialized group node. */
export interface GroupNodeJSON {
  kind: 'group';
  operation: CSGType;
  children: ModelTreeJSON[];
  nodeParams?: NodeParams;
  name?: string;
}

/** JSON structure for a serialized imported mesh node.
 *
 *  Один из вариантов хранения бинарника:
 *   - `binaryRef` — ключ в IndexedDB (BinaryStorage). Предпочтительный путь
 *     для свежих импортов: localStorage хранит только лёгкий ref, не блокируется.
 *   - `stlBase64` — legacy-вариант (старые сохранёнки до перехода на IndexedDB).
 *
 *  При загрузке: если задан binaryRef, бинарник лениво подтягивается из IDB.
 *  Если только base64 — парсится напрямую и при следующем сохранении мигрирует
 *  в IndexedDB (запишется binaryRef, base64 удалится).
 */
export interface ImportedMeshNodeJSON {
  kind: 'imported';
  /** Base64 STL — legacy. В новых сохранёнках пусто, заменено на binaryRef. */
  stlBase64: string;
  /** Ключ в BinaryStorage (IndexedDB). Опционально — для новых сохранёнок. */
  binaryRef?: string;
  filename: string;
  nodeParams?: NodeParams;
  name?: string;
}

/** Recursive tree structure for serialization. */
export type ModelTreeJSON = PrimitiveNodeJSON | GroupNodeJSON | ImportedMeshNodeJSON;
