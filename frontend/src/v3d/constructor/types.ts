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
  | 'ring';

/** Transform params compatible with Three.js (position, scale, rotation). */
export interface NodeParams {
  position?: { x: number; y: number; z: number };
  scale?: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number; order?: string };
  [key: string]: unknown;
}

/** Params for primitive geometries (width, height, radius, segments, etc.). */
export interface PrimitiveParams {
  width?: number;
  height?: number;
  depth?: number;
  radius?: number;
  radiusTop?: number;
  radiusBottom?: number;
  segments?: number;
  widthSegments?: number;
  heightSegments?: number;
  [key: string]: unknown;
}

/** JSON structure for a serialized primitive node. */
export interface PrimitiveNodeJSON {
  kind: 'primitive';
  type: PrimitiveType;
  params: PrimitiveParams;
  nodeParams?: NodeParams;
}

/** JSON structure for a serialized group node. */
export interface GroupNodeJSON {
  kind: 'group';
  operation: CSGType;
  children: ModelTreeJSON[];
  nodeParams?: NodeParams;
}

/** Recursive tree structure for serialization. */
export type ModelTreeJSON = PrimitiveNodeJSON | GroupNodeJSON;
