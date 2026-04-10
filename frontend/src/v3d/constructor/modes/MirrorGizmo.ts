import * as THREE from 'three';

export type MirrorAxis = 'x' | 'y' | 'z';

export interface MirrorHandleMesh extends THREE.Mesh {
  userData: { axis: MirrorAxis; defaultColor: number };
}

const AXIS_COLORS: Record<MirrorAxis, number> = {
  x: 0xff4444,
  y: 0x44cc44,
  z: 0x4488ff,
};

/** Fraction of bounding-box dimension used for the arrow span. */
const SPAN_RATIO = 0.75;
/** Minimum arrow span so tiny objects still get visible arrows. */
const MIN_SPAN = 4;
/** Arrow-head size relative to span. */
const HEAD_RATIO = 0.18;
const MIN_HEAD = 1.5;
/** Offset from object's bounding box edge. */
const OFFSET = 8;
const GRID_Y = 0.02;

/**
 * One mirror-axis widget: ◁─────▷
 * Consists of two arrow-head meshes and a connecting line, all parented to a Group.
 * The Group itself is returned as the raycasting target (MirrorHandleMesh is the group).
 */
function buildAxisWidget(axis: MirrorAxis): THREE.Group {
  const color = AXIS_COLORS[axis];
  const group = new THREE.Group();
  (group as unknown as MirrorHandleMesh).userData = { axis, defaultColor: color };

  // Arrow-head triangle (unit: spans -0.5..0.5 along local X, tip at +X)
  const triShape = new THREE.Shape();
  triShape.moveTo(0.5, 0);
  triShape.lineTo(-0.5, 0.4);
  triShape.lineTo(-0.5, -0.4);
  triShape.closePath();
  const triGeo = new THREE.ShapeGeometry(triShape) as unknown as THREE.BufferGeometry;

  const mat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, depthTest: false });

  // Right arrow (positive direction)
  const rightHead = new THREE.Mesh(triGeo, mat);
  rightHead.name = 'rightHead';
  group.add(rightHead);

  // Left arrow (negative direction) — mirrored
  const leftHead = new THREE.Mesh(triGeo, mat.clone());
  leftHead.name = 'leftHead';
  // Flip: rotate 180° around Z so it points -X
  leftHead.rotation.z = Math.PI;
  group.add(leftHead);

  // Connecting line
  const lineGeo = new THREE.BufferGeometry();
  // Placeholder positions — updated in layoutWidget
  lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  const lineMat = new THREE.LineBasicMaterial({ color, depthTest: false });
  const line = new THREE.LineSegments(lineGeo, lineMat);
  line.name = 'line';
  group.add(line);

  group.renderOrder = 1;
  return group;
}

/**
 * Updates the widget's internal children to match a given span length.
 * Everything is laid out along local X from -halfSpan to +halfSpan.
 */
function layoutWidget(widget: THREE.Group, span: number): void {
  const headSize = Math.max(span * HEAD_RATIO, MIN_HEAD);
  const halfSpan = span / 2;

  widget.children.forEach((child) => {
    if (child.name === 'rightHead' && child instanceof THREE.Mesh) {
      child.position.set(halfSpan - headSize * 0.5, 0, 0);
      child.scale.set(headSize, headSize, 1);
      child.rotation.z = 0;
    } else if (child.name === 'leftHead' && child instanceof THREE.Mesh) {
      child.position.set(-halfSpan + headSize * 0.5, 0, 0);
      child.scale.set(headSize, headSize, 1);
      child.rotation.z = Math.PI;
    } else if (child.name === 'line' && child instanceof THREE.LineSegments) {
      const pos = (child.geometry as THREE.BufferGeometry).getAttribute('position');
      const arr = pos.array as Float32Array;
      arr[0] = -halfSpan + headSize;
      arr[1] = 0;
      arr[2] = 0;
      arr[3] = halfSpan - headSize;
      arr[4] = 0;
      arr[5] = 0;
      (pos as THREE.BufferAttribute).needsUpdate = true;
    }
  });
}

/**
 * Gizmo that shows 3 mirror-arrow handles (◁───▷) around the selected object.
 *
 * Layout:
 *  - X (red):  on the grid, in front of object (max Z + offset), spanning along X
 *  - Z (blue): on the grid, to the right of object (max X + offset), spanning along Z
 *  - Y (green): left-front corner of object, spanning along Y
 */
export class MirrorGizmo {
  private group: THREE.Group;
  private widgets: THREE.Group[] = [];
  private target: THREE.Object3D | null = null;
  private camera: THREE.Camera | null = null;
  private box = new THREE.Box3();
  private boxSize = new THREE.Vector3();

  constructor(private scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.group.renderOrder = 1;
    this.group.visible = false;
    this.buildWidgets();
  }

  private buildWidgets(): void {
    const axes: MirrorAxis[] = ['x', 'y', 'z'];
    axes.forEach((axis) => {
      const w = buildAxisWidget(axis);
      this.group.add(w);
      this.widgets.push(w);
    });
  }

  addToScene(): void {
    if (this.group.parent !== this.scene) {
      this.scene.add(this.group);
    }
  }

  setCamera(camera: THREE.Camera): void {
    this.camera = camera;
  }

  setContainerHeight(_h: number): void {
    // Kept for API compatibility; sizing is now world-space based on bounding box.
  }

  show(object3D: THREE.Object3D): void {
    this.target = object3D;
    this.group.visible = true;
    this.updatePositions();
  }

  hide(): void {
    this.target = null;
    this.group.visible = false;
    this.setHovered(null);
  }

  isVisible(): boolean {
    return this.group.visible;
  }

  /**
   * Returns all meshes (arrow heads) that can be raycasted for click/hover.
   * We return the child meshes of each widget so raycasting works on the triangles.
   */
  getHandles(): THREE.Mesh[] {
    const meshes: THREE.Mesh[] = [];
    this.widgets.forEach((w) => {
      w.children.forEach((c) => {
        if (c instanceof THREE.Mesh) {
          // Propagate axis userData so the hit can be identified
          c.userData = { ...(w as unknown as MirrorHandleMesh).userData };
          meshes.push(c);
        }
      });
    });
    return meshes;
  }

  setHovered(handle: MirrorHandleMesh | null): void {
    const hoveredAxis = handle?.userData?.axis ?? null;
    this.widgets.forEach((w) => {
      const axis = ((w as unknown as MirrorHandleMesh).userData as { axis: MirrorAxis }).axis;
      const defaultColor = ((w as unknown as MirrorHandleMesh).userData as { defaultColor: number }).defaultColor;
      const isHovered = axis === hoveredAxis;
      w.children.forEach((c) => {
        if (c instanceof THREE.Mesh) {
          const mat = c.material as THREE.MeshBasicMaterial;
          mat.color.setHex(isHovered ? 0xffffff : defaultColor);
        } else if (c instanceof THREE.LineSegments) {
          const mat = c.material as THREE.LineBasicMaterial;
          mat.color.setHex(isHovered ? 0xffffff : defaultColor);
        }
      });
    });
  }

  updatePositions(): void {
    if (!this.target || !this.camera) return;
    this.box.setFromObject(this.target);
    this.box.getSize(this.boxSize);

    const { min, max } = this.box;
    const midX = (min.x + max.x) / 2;
    const midY = (min.y + max.y) / 2;
    const midZ = (min.z + max.z) / 2;

    const spanX = Math.max(this.boxSize.x * SPAN_RATIO, MIN_SPAN);
    const spanY = Math.max(this.boxSize.y * SPAN_RATIO, MIN_SPAN);
    const spanZ = Math.max(this.boxSize.z * SPAN_RATIO, MIN_SPAN);

    // X (red): on the grid, in front of object, arrows along world X
    const xWidget = this.widgets.find((w) =>
      ((w as unknown as MirrorHandleMesh).userData as { axis: string }).axis === 'x'
    )!;
    layoutWidget(xWidget, spanX);
    xWidget.position.set(midX, GRID_Y, max.z + OFFSET);
    xWidget.rotation.set(-Math.PI / 2, 0, 0); // lay flat on grid, local X = world X

    // Z (blue): on the grid, to the right of object, arrows along world Z
    const zWidget = this.widgets.find((w) =>
      ((w as unknown as MirrorHandleMesh).userData as { axis: string }).axis === 'z'
    )!;
    layoutWidget(zWidget, spanZ);
    zWidget.position.set(max.x + OFFSET, GRID_Y, midZ);
    zWidget.rotation.set(-Math.PI / 2, 0, Math.PI / 2); // lay flat, local X = world Z

    // Y (green): left-front corner, arrows along world Y (vertical)
    const yWidget = this.widgets.find((w) =>
      ((w as unknown as MirrorHandleMesh).userData as { axis: string }).axis === 'y'
    )!;
    layoutWidget(yWidget, spanY);
    yWidget.position.set(min.x - OFFSET, midY, max.z + OFFSET);
    yWidget.rotation.set(0, 0, Math.PI / 2); // local X = world Y
  }

  updateMatrixWorld(): void {
    this.group.updateMatrixWorld(true);
  }

  dispose(): void {
    this.widgets.forEach((w) => {
      w.children.forEach((c) => {
        if (c instanceof THREE.Mesh) {
          c.geometry.dispose();
          (c.material as THREE.Material).dispose();
        } else if (c instanceof THREE.LineSegments) {
          c.geometry.dispose();
          (c.material as THREE.Material).dispose();
        }
      });
    });
    this.scene.remove(this.group);
  }
}
