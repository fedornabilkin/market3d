import * as THREE from 'three';
import { MOUSE } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import type { ModelApp } from './ModelApp';
import type { ModelNode } from './nodes/ModelNode';
import { GroupNode } from './nodes/GroupNode';
import { Primitive } from './nodes/Primitive';
import { ModificationGizmo, type HandleMesh } from './ModificationGizmo';

const DRAG_THRESHOLD = 4;
const HANDLE_DRAG_SENSITIVITY = 0.008;

export interface SceneDebugChildInfo {
  index: number;
  type: string;
  name: string;
  uuid: string;
  visible: boolean;
  childrenCount: number;
}

export interface SceneDebugInfo {
  sceneChildren: SceneDebugChildInfo[];
  gizmo: ReturnType<ModificationGizmo['getDebugInfo']> | null;
}

export interface ConstructorSceneServiceOptions {
  onSelectNodeFromScene?: (node: ModelNode, opts: { shift: boolean }) => void;
  onDebugInfoUpdate?: (info: SceneDebugInfo) => void;
  onNodeParamsChanged?: (node: ModelNode) => void;
}

export class ConstructorSceneService {
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private controls: OrbitControls | null = null;
  private modificationGizmo: ModificationGizmo | null = null;
  private modelRootGroup: THREE.Group | null = null;
  private raycaster: THREE.Raycaster | null = null;
  private mouse: THREE.Vector2 | null = null;
  private dragPlane: THREE.Plane | null = null;
  private dragTarget: THREE.Object3D | null = null;
  private isPlaneDragging = false;
  private pointerDownHit: { object: THREE.Object3D; point: THREE.Vector3 } | null = null;
  private pointerDownClient = { x: 0, y: 0 };
  private pointerDownShift = false;
  private pointerDownHandle: HandleMesh | null = null;
  private isHandleDragging = false;
  private handleDragState:
    | {
        handleType: string;
        node: ModelNode | null;
        startClientX: number;
        startClientY: number;
      }
    | null = null;
  private animationId: number | null = null;
  private resizeHandler: (() => void) | null = null;
  private containerEl: HTMLElement | null = null;

  private selectedNodes: ModelNode[] = [];
  private selectedNode: ModelNode | null = null;
  private selectedObject3D: THREE.Object3D | null = null;

  private debugFrameCount = 0;

  constructor(
    private readonly modelApp: ModelApp,
    private readonly options: ConstructorSceneServiceOptions = {}
  ) {}

  mount(containerEl: HTMLElement): void {
    if (this.scene) return;
    this.containerEl = containerEl;
    const width = containerEl.clientWidth || window.innerWidth;
    const height = containerEl.clientHeight || window.innerHeight;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf0f0f0);

    const grid = new THREE.GridHelper(20, 20, 0xcccccc, 0xdddddd);
    grid.position.y = 0;
    this.scene.add(grid);

    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    this.camera.position.set(5, 5, 5);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerEl.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(5, 10, 5);
    this.scene.add(dir);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.mouseButtons.LEFT = null;
    this.controls.mouseButtons.RIGHT = MOUSE.ROTATE;

    this.modificationGizmo = new ModificationGizmo(this.scene);
    this.modificationGizmo.setCamera(this.camera);

    this.modelRootGroup = new THREE.Group();
    this.scene.add(this.modelRootGroup);
    this.modificationGizmo.addToScene();

    const rootVal = this.modelApp.getModelManager().getTree();
    if (rootVal) {
      this.modelRootGroup.add(this.buildNodeObject3D(rootVal));
    }

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.dragPlane = null;
    this.dragTarget = null;
    this.isPlaneDragging = false;

    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown);
    this.renderer.domElement.addEventListener('pointermove', this.onPointerMove);
    this.renderer.domElement.addEventListener('pointerup', this.onPointerUp);

    this.resizeHandler = () => {
      if (!this.containerEl || !this.camera || !this.renderer) return;
      const w = this.containerEl.clientWidth || window.innerWidth;
      const h = this.containerEl.clientHeight || window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    };
    window.addEventListener('resize', this.resizeHandler);

    this.animate();
  }

  unmount(): void {
    if (!this.scene || !this.renderer) return;

    if (this.modificationGizmo) {
      this.modificationGizmo.dispose();
    }
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
      this.resizeHandler = null;
    }
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown);
    this.renderer.domElement.removeEventListener('pointermove', this.onPointerMove);
    this.renderer.domElement.removeEventListener('pointerup', this.onPointerUp);

    if (this.animationId != null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    if (this.containerEl && this.renderer.domElement.parentNode === this.containerEl) {
      this.containerEl.removeChild(this.renderer.domElement);
    }

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.modificationGizmo = null;
    this.modelRootGroup = null;
    this.raycaster = null;
    this.mouse = null;
    this.dragPlane = null;
    this.dragTarget = null;
  }

  setSelection(nodes: ModelNode[], node: ModelNode | null): void {
    this.selectedNodes = nodes.length ? [...nodes] : [];
    this.selectedNode = node;
    this.updateGizmoTarget();
  }

  rebuildSceneFromTree(): void {
    if (!this.modelRootGroup) return;
    while (this.modelRootGroup.children.length) {
      this.modelRootGroup.remove(this.modelRootGroup.children[0]);
    }
    const rootVal = this.modelApp.getModelManager().getTree();
    if (rootVal) {
      this.modelRootGroup.add(this.buildNodeObject3D(rootVal));
      console.log(this.modelRootGroup)
    }
    this.updateGizmoTarget();
  }

  /** Возвращает родительский GroupNode для заданного узла в дереве модели (для delete/merge). */
  getParentOf(target: ModelNode): GroupNode | null {
    const root = this.modelApp.getModelManager().getTree();
    return this.findParentOf(root, target);
  }

  private findParentOf(rootNode: ModelNode | null, target: ModelNode): GroupNode | null {
    if (!rootNode || !target) return null;
    const targetUuid = (target as any).uuidMesh;
    if (targetUuid && (rootNode as any).uuidMesh === targetUuid) return null;
    if (rootNode instanceof GroupNode) {
      const idx = targetUuid
        ? rootNode.children.findIndex((c) => (c as any).uuidMesh === targetUuid)
        : rootNode.children.indexOf(target);
      if (idx !== -1) return rootNode;
      for (const child of rootNode.children) {
        const found = this.findParentOf(child, target);
        if (found) return found;
      }
    }
    return null;
  }

  private animate = (): void => {
    if (!this.renderer || !this.scene || !this.camera || !this.controls) return;
    this.animationId = requestAnimationFrame(this.animate);
    this.controls.update();
    if (this.modificationGizmo && this.modificationGizmo.getTarget()) {
      this.modificationGizmo.updatePositions();
    }
    this.debugFrameCount++;
    if (this.debugFrameCount % 30 === 0 && this.scene && this.modificationGizmo && this.options.onDebugInfoUpdate) {
      const children: SceneDebugChildInfo[] = [];
      this.scene.children.forEach((c, i) => {
        children.push({
          index: i,
          type: c.type,
          name: c.name || '(без имени)',
          uuid: c.uuid ? c.uuid.slice(0, 8) : '-',
          visible: c.visible,
          childrenCount: c.children ? c.children.length : 0,
        });
      });
      this.options.onDebugInfoUpdate({
        sceneChildren: children,
        gizmo: this.modificationGizmo.getDebugInfo ? this.modificationGizmo.getDebugInfo() : null,
      });
    }
    this.renderer.render(this.scene, this.camera);
  };

  /** Половина высоты примитива (от центра до низа) для семантики position.y = низ на сетке. */
  private getPrimitiveHalfHeight(prim: Primitive): number {
    const g = (prim as any).geometryParams || {};
    const h = g.height ?? 1;
    const r = g.radius ?? 0.5;
    const tube = (g as { tube?: number }).tube ?? 0.2;
    switch (prim.type) {
      case 'box':
      case 'cylinder':
      case 'cone':
      case 'plane':
        return h / 2;
      case 'sphere':
        return r;
      case 'torus':
        return tube;
      case 'ring':
        return (g as { outerRadius?: number }).outerRadius ?? r;
      default:
        return h / 2;
    }
  }

  private buildNodeObject3D(node: ModelNode): THREE.Object3D {
    if (node instanceof Primitive) {
      const mesh = node.getMesh();
      node.setUuid(mesh.uuid);
      (mesh as THREE.Mesh).userData.node = node;
      const { position, scale, rotation } = node.params || {};
      const halfH = this.getPrimitiveHalfHeight(node);
      if (position) {
        mesh.position.set(position.x, (position.y ?? 0) + halfH, position.z);
      }
      if (scale) mesh.scale.set(scale.x, scale.y, scale.z);
      if (rotation) mesh.rotation.set(rotation.x, rotation.y, rotation.z, (rotation.order as THREE.Euler['order']) ?? 'XYZ');
      return mesh;
    }
    if (node instanceof GroupNode) {
      const group = new THREE.Group();
      node.setUuid(group.uuid);
      (group as THREE.Object3D).userData.node = node;
      const { position, scale, rotation } = (node as GroupNode).params || {};
      if (position) group.position.set(position.x, position.y, position.z);
      if (scale) group.scale.set(scale.x, scale.y, scale.z);
      if (rotation) group.rotation.set(rotation.x, rotation.y, rotation.z);
      (node as GroupNode).children.forEach((child) => {
        group.add(this.buildNodeObject3D(child));
      });
      return group;
    }
    return new THREE.Group();
  }

  private findObjectByNode(group: THREE.Object3D | null, node: ModelNode | null): THREE.Object3D | null {
    if (!group || !node) return null;
    const nodeUuid = (node as any).uuidMesh;
    const stored = (group as any).userData?.node;
    if (nodeUuid && stored?.uuidMesh === nodeUuid) return group;
    if (!nodeUuid && stored === node) return group;
    for (let i = 0; i < group.children.length; i++) {
      const found = this.findObjectByNode(group.children[i], node);
      if (found) return found;
    }
    return null;
  }

  private getSelectableMeshes(): THREE.Mesh[] {
    const meshes: THREE.Mesh[] = [];
    if (!this.modelRootGroup) return meshes;
    this.modelRootGroup.traverse((o) => {
      if (o instanceof THREE.Mesh && (o as any).userData.node) meshes.push(o);
    });
    return meshes;
  }

  private updateMouseFromEvent(event: PointerEvent): void {
    if (!this.containerEl || !this.mouse) return;
    const rect = this.containerEl.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private applyHandleDragDelta(node: ModelNode | null, handleType: string, deltaX: number, deltaY: number): void {
    if (!node) return;
    const isPrim = node instanceof Primitive;
    (node as any).params = (node as any).params || {};
    const params = (node as any).params;
    params.position = params.position || { x: 0, y: 0, z: 0 };
    params.scale = params.scale || { x: 1, y: 1, z: 1 };
    if (isPrim) {
      (node as any).geometryParams = (node as any).geometryParams || {};
    }
    const p = params.position;
    const g = (node as any).geometryParams || {};
    const s = params.scale;

    switch (handleType) {
      case 'edgeWidthLeft': {
        const dw = deltaX;
        if (isPrim && 'width' in g) {
          g.width = Math.max(0.01, (g.width ?? 1) + dw);
          p.x -= dw / 2;
        } else {
          s.x = Math.max(0.01, (s.x ?? 1) + dw);
          p.x -= dw / 2;
        }
        break;
      }
      case 'edgeWidthRight': {
        const dw = deltaX;
        if (isPrim && 'width' in g) {
          g.width = Math.max(0.01, (g.width ?? 1) + dw);
          p.x += dw / 2;
        } else {
          s.x = Math.max(0.01, (s.x ?? 1) + dw);
          p.x += dw / 2;
        }
        break;
      }
      case 'edgeLengthFront': {
        const dd = deltaX;
        if (isPrim && 'depth' in g) {
          g.depth = Math.max(0.01, (g.depth ?? 1) + dd);
          p.z += dd / 2;
        } else {
          s.z = Math.max(0.01, (s.z ?? 1) + dd);
          p.z += dd / 2;
        }
        break;
      }
      case 'edgeLengthBack': {
        const dd = deltaX;
        if (isPrim && 'depth' in g) {
          g.depth = Math.max(0.01, (g.depth ?? 1) + dd);
          p.z -= dd / 2;
        } else {
          s.z = Math.max(0.01, (s.z ?? 1) + dd);
          p.z -= dd / 2;
        }
        break;
      }
      case 'cornerBL': {
        const d = (deltaX + deltaY) * 0.5;
        if (isPrim && 'width' in g && 'depth' in g) {
          g.width = Math.max(0.01, (g.width ?? 1) + d);
          g.depth = Math.max(0.01, (g.depth ?? 1) + d);
          p.x -= d / 2;
          p.z -= d / 2;
        } else {
          const scaleDelta = Math.max(0.01, (s.x ?? 1) + d);
          s.x = scaleDelta;
          s.z = scaleDelta;
          p.x -= d / 2;
          p.z -= d / 2;
        }
        break;
      }
      case 'cornerBR': {
        const d = (deltaX + deltaY) * 0.5;
        if (isPrim && 'width' in g && 'depth' in g) {
          g.width = Math.max(0.01, (g.width ?? 1) + d);
          g.depth = Math.max(0.01, (g.depth ?? 1) + d);
          p.x += d / 2;
          p.z -= d / 2;
        } else {
          const scaleDelta = Math.max(0.01, (s.x ?? 1) + d);
          s.x = scaleDelta;
          s.z = scaleDelta;
          p.x += d / 2;
          p.z -= d / 2;
        }
        break;
      }
      case 'cornerTL': {
        const d = (deltaX + deltaY) * 0.5;
        if (isPrim && 'width' in g && 'depth' in g) {
          g.width = Math.max(0.01, (g.width ?? 1) + d);
          g.depth = Math.max(0.01, (g.depth ?? 1) + d);
          p.x -= d / 2;
          p.z += d / 2;
        } else {
          const scaleDelta = Math.max(0.01, (s.x ?? 1) + d);
          s.x = scaleDelta;
          s.z = scaleDelta;
          p.x -= d / 2;
          p.z += d / 2;
        }
        break;
      }
      case 'cornerTR': {
        const d = (deltaX + deltaY) * 0.5;
        if (isPrim && 'width' in g && 'depth' in g) {
          g.width = Math.max(0.01, (g.width ?? 1) + d);
          g.depth = Math.max(0.01, (g.depth ?? 1) + d);
          p.x += d / 2;
          p.z += d / 2;
        } else {
          const scaleDelta = Math.max(0.01, (s.x ?? 1) + d);
          s.x = scaleDelta;
          s.z = scaleDelta;
          p.x += d / 2;
          p.z += d / 2;
        }
        break;
      }
      case 'height': {
        const dh = -deltaY;
        if (isPrim && 'height' in g) {
          const oldH = g.height ?? 1;
          g.height = Math.max(0.01, oldH + dh);
          p.y += dh / 2;
        } else {
          s.y = Math.max(0.01, (s.y ?? 1) + dh);
          p.y += dh / 2;
        }
        break;
      }
      case 'offsetY':
        p.y = (p.y ?? 0) - deltaY;
        break;
      default:
        break;
    }

    const obj = this.selectedObject3D;
    if (
      obj &&
      isPrim &&
      (handleType.startsWith('edge') || handleType.startsWith('corner') || handleType === 'height')
    ) {
      this.rebuildSceneFromTree();
      const first = this.selectedNodes[0];
      const newObj = this.findObjectByNode(this.modelRootGroup, first);
      this.selectedObject3D = newObj;
      if (this.modificationGizmo && newObj) {
        this.modificationGizmo.setTarget(newObj, node as any);
      }
    } else if (obj) {
      const halfH = isPrim ? this.getPrimitiveHalfHeight(node as Primitive) : 0;
      if (params.position) {
        obj.position.set(
          params.position.x,
          (params.position.y ?? 0) + halfH,
          params.position.z
        );
      }
      if (params.scale) obj.scale.set(params.scale.x, params.scale.y, params.scale.z);
      if (params.rotation) obj.rotation.set(params.rotation.x, params.rotation.y, params.rotation.z);
    }

    if (this.options.onNodeParamsChanged) {
      this.options.onNodeParamsChanged(node);
    }
  }

  private updateGizmoTarget(): void {
    if (!this.modificationGizmo || !this.modelRootGroup) return;
    if (this.selectedNodes.length === 0) {
      this.selectedObject3D = null;
      this.modificationGizmo.clearTarget();
      return;
    }
    const first = this.selectedNodes[0];
    const obj = this.findObjectByNode(this.modelRootGroup, first);
    this.selectedObject3D = obj || null;
    if (obj && this.selectedNode) {
      this.modificationGizmo.setTarget(obj, this.selectedNode as any);
    } else {
      this.modificationGizmo.clearTarget();
    }
  }

  private onPointerDown = (event: PointerEvent): void => {
    if (!this.modelRootGroup || !this.raycaster || !this.mouse) return;
    if (event.button !== 0) return;
    this.updateMouseFromEvent(event);
    this.raycaster.setFromCamera(this.mouse, this.camera!);

    if (this.modificationGizmo && this.modificationGizmo.getTarget()) {
      const handleHits = this.raycaster.intersectObjects(this.modificationGizmo.getHandles());
      if (handleHits.length > 0) {
        const handle = handleHits[0].object as HandleMesh;
        if ((handle as any).userData && (handle as any).userData.type) {
          this.pointerDownHandle = handle;
          this.pointerDownClient = { x: event.clientX, y: event.clientY };
          this.pointerDownShift = !!event.shiftKey;
          return;
        }
      }
    }

    const meshes = this.getSelectableMeshes();
    const hits = this.raycaster.intersectObjects(meshes);
    this.pointerDownClient = { x: event.clientX, y: event.clientY };
    this.pointerDownShift = !!event.shiftKey;
    this.pointerDownHandle = null;
    if (hits.length > 0) {
      this.pointerDownHit = { object: hits[0].object, point: hits[0].point };
    } else {
      this.pointerDownHit = null;
    }
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (!this.modelRootGroup || !this.raycaster || !this.mouse) return;
    this.updateMouseFromEvent(event);
    this.raycaster.setFromCamera(this.mouse, this.camera!);

    if (this.isHandleDragging && this.handleDragState) {
      const deltaX = (event.clientX - this.handleDragState.startClientX) * HANDLE_DRAG_SENSITIVITY;
      const deltaY = (event.clientY - this.handleDragState.startClientY) * -HANDLE_DRAG_SENSITIVITY;
      this.applyHandleDragDelta(this.handleDragState.node, this.handleDragState.handleType, deltaX, deltaY);
      this.handleDragState.startClientX = event.clientX;
      this.handleDragState.startClientY = event.clientY;
      return;
    }

    if (this.isPlaneDragging && this.dragTarget && this.dragPlane) {
      const ray = this.raycaster.ray;
      const targetPoint = new THREE.Vector3();
      if (ray.intersectPlane(this.dragPlane, targetPoint)) {
        if (this.dragTarget.parent) this.dragTarget.parent.worldToLocal(targetPoint);
        this.dragTarget.position.x = targetPoint.x;
        this.dragTarget.position.z = targetPoint.z;
        const node = (this.dragTarget as any).userData?.node as ModelNode | undefined;
        if (node && (node as any).params) {
          (node as any).params.position = (node as any).params.position || {};
          const pos = (node as any).params.position;
          pos.x = this.dragTarget.position.x;
          pos.z = this.dragTarget.position.z;
          const halfH =
            node instanceof Primitive
              ? this.getPrimitiveHalfHeight(node)
              : (() => {
                  this.dragTarget!.updateMatrixWorld(true);
                  const b = new THREE.Box3().setFromObject(this.dragTarget!);
                  const size = new THREE.Vector3();
                  b.getSize(size);
                  return size.y / 2;
                })();
          pos.y = this.dragTarget.position.y - halfH;
          if (this.options.onNodeParamsChanged) {
            this.options.onNodeParamsChanged(node);
          }
        }
      }
      return;
    }

    if (this.pointerDownHandle && (event.buttons & 1) === 1 && !this.isHandleDragging) {
      const dx = event.clientX - this.pointerDownClient.x;
      const dy = event.clientY - this.pointerDownClient.y;
      if (Math.sqrt(dx * dx + dy * dy) >= DRAG_THRESHOLD) {
        this.isHandleDragging = true;
        if (this.controls) this.controls.enabled = false;
        const node = this.modificationGizmo?.getNode() as ModelNode | null;
        this.handleDragState = {
          handleType: (this.pointerDownHandle as any).userData.type,
          node,
          startClientX: event.clientX,
          startClientY: event.clientY,
        };
      }
    }

    if (this.pointerDownHit && !this.isPlaneDragging && !this.isHandleDragging && (event.buttons & 1) === 1) {
      const dx = event.clientX - this.pointerDownClient.x;
      const dy = event.clientY - this.pointerDownClient.y;
      if (Math.sqrt(dx * dx + dy * dy) >= DRAG_THRESHOLD) {
        this.isPlaneDragging = true;
        if (this.controls) this.controls.enabled = false;
        this.dragTarget = this.pointerDownHit.object;
        const worldPos = new THREE.Vector3();
        this.dragTarget.getWorldPosition(worldPos);
        this.dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        this.dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), worldPos);
      }
    }

    if (!this.isHandleDragging && !this.isPlaneDragging && this.modificationGizmo && this.modificationGizmo.getTarget()) {
      const handleHits = this.raycaster.intersectObjects(this.modificationGizmo.getHandles());
      const hovered = handleHits.length > 0 ? (handleHits[0].object as HandleMesh) : null;
      this.modificationGizmo.setHovered(hovered as any);
    }
  };

  private onPointerUp = (event: PointerEvent): void => {
    if (!this.renderer) return;
    if (event.button !== 0) return;

    if (this.isHandleDragging) {
      this.isHandleDragging = false;
      this.handleDragState = null;
      this.pointerDownHandle = null;
      if (this.controls) this.controls.enabled = true;
      return;
    }

    if (this.isPlaneDragging) {
      this.isPlaneDragging = false;
      if (this.controls) this.controls.enabled = true;
      this.dragTarget = null;
      this.pointerDownHit = null;
      this.updateGizmoTarget();
      return;
    }

    const isCanvasRelease = this.renderer.domElement && event.target === this.renderer.domElement;
    if (isCanvasRelease) {
      if (this.pointerDownHandle) {
        this.pointerDownHandle = null;
      } else if (this.pointerDownHit) {
        const dx = event.clientX - this.pointerDownClient.x;
        const dy = event.clientY - this.pointerDownClient.y;
        if (Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD) {
          const node = (this.pointerDownHit.object as any).userData?.node as ModelNode | undefined;
          if (node && this.options.onSelectNodeFromScene) {
            this.options.onSelectNodeFromScene(node, { shift: this.pointerDownShift });
          }
        }
      }
      event.stopPropagation();
    }
    this.pointerDownHit = null;
    this.pointerDownHandle = null;
  };
}

