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
import {BufferGeometryUtils} from "three/examples/jsm/utils/BufferGeometryUtils";

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

  /**
   * Добавляет узел в сцену
   * @param {string} name - Имя узла
   * @param {THREE.Object3D} node - Узел для добавления
   */
  addNode(name, node) {
    if (!node) {
      console.warn(`Attempted to add null node with name: ${name}`)
      return
    }
    this.collectionNodes[name] = node
    this.sceneGraphRoot.add(node)
  }

  /**
   * Возвращает коллекцию всех узлов
   * @returns {Object} Коллекция узлов
   */
  getNodes() {
    return this.collectionNodes
  }

  /**
   * Удаляет узел из сцены
   * @param {string} key - Имя узла для удаления
   */
  removeNode(key) {
    const node = this.collectionNodes[key]
    if (node) {
      this.sceneGraphRoot.remove(node)
      delete this.collectionNodes[key]
    }
  }

  /**
   * Очищает сцену от всех узлов
   */
  clear() {
    this.scene.remove(this.sceneGraphRoot)
    this.sceneGraphRoot = new THREE.Object3D()
    this.scene.add(this.sceneGraphRoot)
    this.collectionNodes = {}
  }

  /**
   * Объединяет все узлы в один меш для экспорта
   * @returns {THREE.Mesh} Объединенный меш
   */
  combinedNodes() {
    this.sceneGraphRoot.updateMatrixWorld(true)
    const geometries = this._collectGeometries()
    
    if (geometries.length === 0) {
      return new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshPhongMaterial({ color: 0xffffff }))
    }
    
    if (geometries.length === 1) {
      return new THREE.Mesh(geometries[0], new THREE.MeshPhongMaterial({ color: 0xffffff }))
    }
    
    const merged = this._mergeGeometries(geometries)
    return new THREE.Mesh(merged, new THREE.MeshPhongMaterial({ color: 0xffffff }))
  }

  /**
   * Собирает геометрии из всех узлов
   * @private
   * @returns {Array<THREE.BufferGeometry>} Массив геометрий
   */
  _collectGeometries() {
    const geometries = []
    const groupKeys = ['qr', 'icon', 'text']
    
    for (const key in this.collectionNodes) {
      const node = this.collectionNodes[key]
      if (!node) continue
      
      // Проверяем, является ли узел группой
      const isGroup = groupKeys.includes(key) || 
        (node instanceof THREE.Group) || 
        (node instanceof THREE.Object3D && node.children?.length > 0 && !node.geometry)
      
      if (isGroup) {
        geometries.push(...this._extractGeometriesFromGroup(node))
      } else if (node instanceof THREE.Mesh && node.geometry) {
        const geometry = this._extractGeometryFromMesh(node)
        if (geometry) geometries.push(geometry)
      }
    }
    
    return geometries
  }

  /**
   * Извлекает геометрии из группы (qr, icon, text)
   * @private
   * @param {THREE.Group|THREE.Object3D} group - Группа объектов
   * @returns {Array<THREE.BufferGeometry>} Массив геометрий
   */
  _extractGeometriesFromGroup(group) {
    const geometries = []
    if (!group?.children?.length) return geometries
    
    group.updateMatrixWorld(true)
    
    group.traverse((child) => {
      if (child === group || !(child instanceof THREE.Mesh) || !child.geometry) return
      
      try {
        let geometry = child.geometry
        if (geometry instanceof THREE.Geometry) {
          geometry = new THREE.BufferGeometry().fromGeometry(geometry)
        }
        
        if (!geometry?.attributes?.position) return
        
        const clonedGeometry = geometry.clone()
        clonedGeometry.applyMatrix4(this._calculateTransformMatrix(child))
        geometries.push(clonedGeometry)
      } catch (e) {
        console.warn('Error extracting geometry from group child:', e)
      }
    })
    
    return geometries
  }

  /**
   * Извлекает геометрию из меша с применением матрицы преобразования
   * @private
   * @param {THREE.Mesh} mesh - Меш
   * @returns {THREE.BufferGeometry|null} Геометрия или null
   */
  _extractGeometryFromMesh(mesh) {
    if (!mesh?.geometry) return null
    
    try {
      let geometry = mesh.geometry
      if (geometry instanceof THREE.Geometry) {
        geometry = new THREE.BufferGeometry().fromGeometry(geometry)
      }
      
      const clonedGeometry = geometry.clone()
      clonedGeometry.applyMatrix4(this._calculateTransformMatrix(mesh))
      return clonedGeometry
    } catch (e) {
      console.warn('Error extracting geometry from mesh:', e)
      return null
    }
  }

  /**
   * Вычисляет матрицу преобразования узла
   * @private
   * @param {THREE.Object3D} node - Узел
   * @returns {THREE.Matrix4} Матрица преобразования
   */
  _calculateTransformMatrix(node) {
    if (node.matrixWorld?.determinant() !== 0) {
      return node.matrixWorld.clone()
    }
    
    const tempObj = new THREE.Object3D()
    tempObj.position.copy(node.position || new THREE.Vector3())
    tempObj.rotation.copy(node.rotation || new THREE.Euler())
    tempObj.scale.copy(node.scale || new THREE.Vector3(1, 1, 1))
    tempObj.updateMatrix()
    return tempObj.matrix.clone()
  }

  /**
   * Объединяет массив геометрий в одну
   * @private
   * @param {Array<THREE.BufferGeometry>} geometries - Массив геометрий
   * @returns {THREE.BufferGeometry} Объединенная геометрия
   */
  _mergeGeometries(geometries) {
    if (!geometries?.length) return new THREE.BufferGeometry()
    
    const validGeometries = geometries.filter(geo => 
      geo instanceof THREE.BufferGeometry && 
      geo.attributes?.position?.count > 0
    )
    
    if (validGeometries.length === 0) return new THREE.BufferGeometry()
    if (validGeometries.length === 1) return validGeometries[0]
    
    const BATCH_SIZE = 1000
    let merged = null
    
    try {
      if (validGeometries.length <= BATCH_SIZE) {
        merged = BufferGeometryUtils.mergeBufferGeometries(validGeometries)
      } else {
        for (let i = 0; i < validGeometries.length; i += BATCH_SIZE) {
          const batch = validGeometries.slice(i, i + BATCH_SIZE)
          const batchMerged = BufferGeometryUtils.mergeBufferGeometries(batch)
          
          if (batchMerged) {
            merged = merged 
              ? BufferGeometryUtils.mergeBufferGeometries([merged, batchMerged])
              : batchMerged
          }
        }
      }
      
      return merged || validGeometries[0]
    } catch (e) {
      console.error('Error merging geometries:', e)
      return validGeometries[0]
    }
  }

  /**
   * Устанавливает анимацию для сцены
   * @param {Object} animation - Объект анимации
   */
  setAnimation(animation) {
    this.animation = animation
  }

  /**
   * Обновляет анимацию сцены
   * @param {boolean} flag - Включить/выключить анимацию
   * @param {number} time - Время для анимации
   */
  animate(flag, time) {
    if (!this.animation) return
    
    this.animation.setNode(this.sceneGraphRoot)
    if (flag) {
      this.scene.remove(this.grid)
      this.animation.animate(time)
    } else {
      this.animation.stop()
      this.scene.add(this.grid)
    }
  }

  /**
   * Создает сцену Three.js
   * @returns {THREE.Scene} Созданная сцена
   */
  createScene() {
    this.scene = new Scene()
    this.scene.background = new Color(0xa0a0a0)
    this.sceneGraphRoot = new THREE.Object3D()

    this.scene.add(this.sceneGraphRoot)
    this.scene.add(this.createGrid())

    const { directionalLight, directionalLightBack } = this.createLight()
    this.scene.add(directionalLight)
    this.scene.add(directionalLightBack)

    this.testPrimitives()

    return this.scene
  }

  /**
   * Возвращает сцену
   * @returns {THREE.Scene} Сцена
   */
  getScene() {
    return this.scene
  }

  /**
   * Создает камеру для сцены
   * @param {number} width - Ширина области просмотра
   * @param {number} height - Высота области просмотра
   * @returns {THREE.PerspectiveCamera} Созданная камера
   */
  createCamera(width, height) {
    this.camera = new PerspectiveCamera(50, width / height, 1, 10000)
    this.camera.position.set(0, 0, 150)
    return this.camera
  }

  /**
   * Создает рендерер для сцены
   * @param {number} width - Ширина области рендеринга
   * @param {number} height - Высота области рендеринга
   * @param {number} pixelRatio - Соотношение пикселей
   * @returns {THREE.WebGLRenderer} Созданный рендерер
   */
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

  /**
   * Отрисовывает сцену
   */
  render() {
    this.renderer.render(this.scene, this.camera)
  }

  /**
   * Возвращает изображение сцены в формате data URL
   * @returns {string} Data URL изображения
   */
  imgDataUrl() {
    return this.renderer.domElement.toDataURL()
  }

  /**
   * Создает контролы для управления камерой
   * @returns {OrbitControls} Созданные контролы
   */
  createControl() {
    const controls = new OrbitControls(this.camera, this.renderer.domElement)
    controls.target.set(0, 0, 0)
    controls.update()
    return controls
  }

  /**
   * Создает источники света для сцены
   * @returns {Object} Объект с источниками света
   */
  createLight() {
    const ambientLight = new AmbientLight(0x333333)

    const directionalLight = new DirectionalLight(0xFFFFFF, 3)
    directionalLight.position.set(-1, 2, 4)

    const directionalLightBack = new DirectionalLight(0xaaaaaa, 1)
    directionalLightBack.position.set(-1, -2, -4)

    return { ambientLight, directionalLight, directionalLightBack }
  }

  /**
   * Создает сетку для сцены
   * @returns {THREE.GridHelper} Созданная сетка
   */
  createGrid() {
    this.grid = new GridHelper(1000, 100, 0x000000, 0x000000)
    this.grid.material.opacity = 0.2
    this.grid.material.transparent = true
    this.grid.rotation.x = Math.PI / 2
    return this.grid
  }

  /**
   * Добавляет тестовые примитивы в сцену (только в режиме отладки)
   * @private
   */
  testPrimitives() {
    if (!this.debug) return

    const geometry = new THREE.BoxGeometry(1, 1, 10)
    const material = new THREE.MeshLambertMaterial({ color: 0x00ff00 })
    
    const positions = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 0, y: 10 }
    ]
    
    positions.forEach(pos => {
      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.set(pos.x, pos.y, 0)
      this.scene.add(mesh)
    })
  }

}
