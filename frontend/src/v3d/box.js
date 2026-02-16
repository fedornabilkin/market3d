import {
  AmbientLight,
  Color,
  DirectionalLight,
  GridHelper,
  PerspectiveCamera,
  Scene,
  WebGLRenderer
} from "three";
import * as THREE from "three";
import {OrbitControls} from "three/examples/jsm/controls/OrbitControls";

export class Box {

  scene = undefined
  camera = undefined
  renderer = undefined
  grid = undefined

  sceneGraphRoot = undefined
  collectionNodes = {}
  animation = undefined

  debug = false

  constructor(config = {}) {
    Object.assign(this, config)
  }

  addNode(name, node) {
    this.collectionNodes[name] = node
    this.sceneGraphRoot.add(node)
  }

  getNodes() {
    return this.collectionNodes
  }

  removeNode(key) {
    const node = this.collectionNodes[key]
    this.sceneGraphRoot.remove(node)
    delete this.collectionNodes[key]
  }

  clear() {
    this.scene.remove(this.sceneGraphRoot)
    this.sceneGraphRoot = new THREE.Object3D()
    this.scene.add(this.sceneGraphRoot)
    this.collectionNodes = {}
  }

  combinedNodes() {
    const combined = new THREE.Geometry()
    for (const key in this.collectionNodes) {
      if (key === 'qr' || key === 'icon' || key === 'text') {
        for (const mesh of this.collectionNodes[key].children) {
          combined.merge(mesh.geometry, mesh.matrix)
        }
      }
      else {
        combined.merge(this.collectionNodes[key].geometry, this.collectionNodes[key].matrix)
      }
    }
    return new THREE.Mesh(combined, new THREE.MeshPhongMaterial({color: 0xffffff}))
  }

  setAnimation(animation) {
    this.animation = animation
  }

  animate(flag, time) {
    this.animation.setNode(this.sceneGraphRoot)
    if (flag) {
      this.scene.remove(this.grid)
      this.animation.animate(time)
    } else {
      this.animation.stop()
      this.scene.add(this.grid)
    }
  }

  createScene() {
    this.scene = new Scene()
    this.scene.background = new Color(0xa0a0a0)
    // this.scene.rotation.z = -Math.PI / 2
    this.sceneGraphRoot = new THREE.Object3D()

    this.scene.add(this.sceneGraphRoot)
    this.scene.add(this.createGrid())

    const {
      ambientLight,
      directionalLight,
      directionalLightBack
    } = this.createLight()
    // this.scene.add(ambientLight)
    this.scene.add(directionalLight)
    this.scene.add(directionalLightBack)

    this.testPrimitives()

    return this.scene
  }

  getScene() {
    return this.scene
  }

  createCamera(width, height) {
    this.camera = new PerspectiveCamera(50, width / height, 1, 10000)
    this.camera.position.set(0, 0, 150)

    return this.camera
  }

  createRenderer(width, height, pixelRatio) {
    this.renderer = new WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
      alpha: true
    })
    this.renderer.setPixelRatio(pixelRatio)
    this.renderer.setSize(width, height)
    return this.renderer
  }

  render() {
    this.renderer.render(this.scene, this.camera)
  }

  imgDataUrl() {
    return this.renderer.domElement.toDataURL()
  }

  createControl() {
    const controls = new OrbitControls(this.camera, this.renderer.domElement)
    controls.target.set(0, 0, 0)
    controls.update()
  }

  createLight() {
    const ambientLight = new AmbientLight(0x333333)

    const directionalLight = new DirectionalLight(0xFFFFFF, 3)
    directionalLight.position.x = -1
    directionalLight.position.y = 2
    directionalLight.position.z = 4

    const directionalLightBack = new DirectionalLight(0xaaaaaa, 1)
    directionalLightBack.position.x = -1
    directionalLightBack.position.y = -2
    directionalLightBack.position.z = -4

    return {ambientLight, directionalLight, directionalLightBack}
  }

  createGrid() {
    this.grid = new GridHelper(1000, 100, 0x000000, 0x000000)
    this.grid.material.opacity = 0.2
    this.grid.material.transparent = true
    this.grid.rotation.x = Math.PI / 2

    return this.grid
  }

  testPrimitives() {
    if (!this.debug) return

    const box = new THREE.BoxGeometry(1, 1, 10)
    const boxMaterial = new THREE.MeshLambertMaterial({ color: 0x00ff00 })
    const boxMesh = new THREE.Mesh(box, boxMaterial)

    const boxMesh2 = new THREE.Mesh(box, boxMaterial)
    boxMesh2.position.x = 10
    const boxMesh3 = new THREE.Mesh(box, boxMaterial)
    boxMesh3.position.y = 10

    this.scene.add(boxMesh)
    this.scene.add(boxMesh2)
    this.scene.add(boxMesh3)
  }

}
