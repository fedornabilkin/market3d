import * as THREE from 'three';
import { CSG } from 'three-csg-ts';

/**
 * Base class for 3D model generators.
 * Provides common methods for geometries, materials, meshes, and CSG operations.
 */
export default class BaseGenerator {
  /**
   * Creates a basic material with the given color.
   */
  protected createMaterial(color: number | string): THREE.MeshBasicMaterial {
    return new THREE.MeshBasicMaterial({ color: color as number });
  }

  /**
   * Returns the size of the given object's bounding box.
   */
  protected getBoundingBoxSize(mesh: THREE.Object3D): THREE.Vector3 {
    const boundingBox = new THREE.Box3().setFromObject(mesh);
    const target = new THREE.Vector3();
    boundingBox.getSize(target);
    return target;
  }

  /**
   * Subtracts toolMesh from targetMesh and returns the resulting mesh.
   */
  protected subtractMesh(
    targetMesh: THREE.Mesh,
    toolMesh: THREE.Mesh
  ): THREE.Mesh {
    const bspTarget = CSG.fromMesh(targetMesh);
    const bspTool = CSG.fromMesh(toolMesh);
    const bspResult = bspTarget.subtract(bspTool);
    const resultMesh = CSG.toMesh(bspResult, targetMesh.matrix);
    resultMesh.material = targetMesh.material;
    return resultMesh;
  }

  /**
   * Combines targetMesh and toolMesh and returns the resulting mesh.
   */
  protected unionMesh(
    targetMesh: THREE.Mesh,
    toolMesh: THREE.Mesh
  ): THREE.Mesh {
    const bspTarget = CSG.fromMesh(targetMesh);
    const bspTool = CSG.fromMesh(toolMesh);
    const bspResult = bspTarget.union(bspTool);
    const resultMesh = CSG.toMesh(bspResult, targetMesh.matrix);
    resultMesh.material = targetMesh.material;
    return resultMesh;
  }

  /**
   * Returns a rounded rectangle shape with the given parameters.
   * Taken from: https://threejs.org/examples/webgl_geometry_shapes.html
   */
  protected getCustomRoundedRectShape(
    x: number,
    y: number,
    width: number,
    height: number,
    radiusA: number,
    radiusB: number,
    radiusC: number,
    radiusD: number,
    path: boolean = false
  ): THREE.Shape | THREE.Path {
    const ctx = path ? new THREE.Path() : new THREE.Shape();
    ctx.moveTo(x, y + radiusD);
    ctx.lineTo(x, y + height - radiusA);
    ctx.quadraticCurveTo(x, y + height, x + radiusA, y + height);
    ctx.lineTo(x + width - radiusB, y + height);
    ctx.quadraticCurveTo(x + width, y + height, x + width, y + height - radiusB);
    ctx.lineTo(x + width, y + radiusC);
    ctx.quadraticCurveTo(x + width, y, x + width - radiusC, y);
    ctx.lineTo(x + radiusD, y);
    ctx.quadraticCurveTo(x, y, x, y + radiusD);
    return ctx;
  }

  /**
   * Returns a rounded rectangle shape with equal corner radius for each corner.
   */
  protected getRoundedRectShape(
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    path: boolean = false
  ): THREE.Shape | THREE.Path {
    return this.getCustomRoundedRectShape(
      x,
      y,
      width,
      height,
      radius,
      radius,
      radius,
      radius,
      path
    );
  }
}
