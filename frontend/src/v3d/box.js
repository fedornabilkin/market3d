import {
  AmbientLight,
  Color,
  DirectionalLight,
  PerspectiveCamera,
  Scene,
  WebGLRenderer
} from "three";
import * as THREE from "three";
import {OrbitControls} from "three/examples/jsm/controls/OrbitControls";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils";

export class Box {

  scene = undefined
  camera = undefined
  renderer = undefined
  controls = undefined
  grid = undefined

  sceneGraphRoot = undefined
  collectionNodes = {}
  animation = undefined

  debug = false
  gridSizeMm = 200

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
   * Смещает sceneGraphRoot так, чтобы минимальный угол AABB модели
   * оказался в мировом (0, 0) — у нулевой отметки сетки, — и наводит
   * камеру так, чтобы модель целиком помещалась в кадр.
   */
  placeAndFocusModel({ margin = 1.4 } = {}) {
    if (!this.sceneGraphRoot) return
    this.sceneGraphRoot.position.set(0, 0, 0)
    this.sceneGraphRoot.rotation.set(0, 0, 0)
    this.sceneGraphRoot.updateMatrixWorld(true)

    let bbox = new THREE.Box3().setFromObject(this.sceneGraphRoot)
    if (!isFinite(bbox.min.x) || bbox.isEmpty()) return

    this.sceneGraphRoot.position.set(-bbox.min.x, -bbox.min.y, 0)
    this.sceneGraphRoot.updateMatrixWorld(true)
    bbox = new THREE.Box3().setFromObject(this.sceneGraphRoot)

    if (!this.camera) return

    const size = new THREE.Vector3()
    bbox.getSize(size)
    const center = new THREE.Vector3()
    bbox.getCenter(center)

    const fovV = (this.camera.fov || 50) * Math.PI / 180
    const aspect = this.camera.aspect || 1
    const fovH = 2 * Math.atan(Math.tan(fovV / 2) * aspect)

    const distV = (size.y * margin) / (2 * Math.tan(fovV / 2))
    const distH = (size.x * margin) / (2 * Math.tan(fovH / 2))
    const distance = Math.max(distV, distH, 60)

    this.camera.position.set(center.x, center.y, bbox.max.z + distance)
    this.camera.updateProjectionMatrix()
    if (this.controls) {
      this.controls.target.set(center.x, center.y, center.z)
      this.controls.update()
    }
  }

  /** @deprecated оставлено как alias — использует placeAndFocusModel. */
  alignModelToGridOrigin() {
    this.placeAndFocusModel()
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
        const geometry = child.geometry
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
      const geometry = mesh.geometry
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
        merged = BufferGeometryUtils.mergeGeometries(validGeometries)
      } else {
        for (let i = 0; i < validGeometries.length; i += BATCH_SIZE) {
          const batch = validGeometries.slice(i, i + BATCH_SIZE)
          const batchMerged = BufferGeometryUtils.mergeGeometries(batch)
          
          if (batchMerged) {
            merged = merged 
              ? BufferGeometryUtils.mergeGeometries([merged, batchMerged])
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
    const half = this.gridSizeMm / 2
    this.camera.position.set(half, half, 300)
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
      alpha: true,
      powerPreference: 'high-performance'
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
    const half = this.gridSizeMm / 2
    controls.target.set(half, half, 0)
    controls.update()
    this.controls = controls
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
   * Создает сетку для сцены: 200×200 мм, тонкие линии через 1 мм,
   * толстые через 10 мм, числовые метки по десяткам.
   * Плоскость сетки — X-Y (Z к камере).
   * @returns {THREE.Group} Созданная сетка
   */
  createGrid() {
    const sizeMm = this.gridSizeMm
    const half = sizeMm / 2

    const thinPositions = []
    const boldPositions = []

    // Вертикальные линии (меняется X), строятся вокруг локального (0,0).
    for (let i = -half; i <= half; i++) {
      const target = i % 10 === 0 ? boldPositions : thinPositions
      target.push(i, -half, 0, i, half, 0)
    }
    // Горизонтальные линии (меняется Y).
    for (let i = -half; i <= half; i++) {
      const target = i % 10 === 0 ? boldPositions : thinPositions
      target.push(-half, i, 0, half, i, 0)
    }

    const thinGeo = new THREE.BufferGeometry()
    thinGeo.setAttribute('position', new THREE.Float32BufferAttribute(thinPositions, 3))
    const thinMat = new THREE.LineBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.08,
      depthWrite: false,
    })
    const thinLines = new THREE.LineSegments(thinGeo, thinMat)

    const boldGeo = new THREE.BufferGeometry()
    boldGeo.setAttribute('position', new THREE.Float32BufferAttribute(boldPositions, 3))
    const boldMat = new THREE.LineBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    })
    const boldLines = new THREE.LineSegments(boldGeo, boldMat)

    const group = new THREE.Group()
    group.add(thinLines)
    group.add(boldLines)

    // Насечки с внешней стороны: 1 мм — 1, 5 мм — 2, 10 мм (цифра) — 3.5.
    const tickShort = []
    const tickMid = []
    const tickLong = []
    const LEN_SHORT = 1
    const LEN_MID = 2
    const LEN_LONG = 3.5

    for (let i = -half; i <= half; i++) {
      let arr, len
      if (i % 10 === 0) { arr = tickLong; len = LEN_LONG }
      else if (i % 5 === 0) { arr = tickMid; len = LEN_MID }
      else { arr = tickShort; len = LEN_SHORT }
      // Нижний край: насечка вниз от y = -half.
      arr.push(i, -half, 0, i, -half - len, 0)
      // Левый край: насечка влево от x = -half.
      arr.push(-half, i, 0, -half - len, i, 0)
    }

    const tickMat = new THREE.LineBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    })
    const tickMatStrong = new THREE.LineBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    })
    const makeTicks = (positions, material) => {
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
      return new THREE.LineSegments(geo, material)
    }
    group.add(makeTicks(tickShort, tickMat))
    group.add(makeTicks(tickMid, tickMat))
    group.add(makeTicks(tickLong, tickMatStrong))

    // Метки по краям каждые 10 мм. Значения соответствуют финальным
    // мировым координатам после смещения группы.
    for (let i = -half; i <= half; i += 10) {
      const label = String(i + half)
      group.add(this._makeGridLabel(label, i, -half - LEN_LONG - 4))
      group.add(this._makeGridLabel(label, -half - LEN_LONG - 6, i))
    }

    // Смещаем так, чтобы левый нижний угол оказался в мировом (0,0).
    group.position.set(half, half, 0)
    group.renderOrder = -1
    this.grid = group
    return this.grid
  }

  /**
   * Создаёт спрайт-надпись для меток сетки.
   * @private
   */
  _makeGridLabel(text, x, y) {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 128
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.font = 'bold 96px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#222222'
    ctx.fillText(text, canvas.width / 2, canvas.height / 2)

    const texture = new THREE.CanvasTexture(canvas)
    texture.minFilter = THREE.LinearFilter
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    })
    const sprite = new THREE.Sprite(material)
    sprite.position.set(x, y, 0.01)
    sprite.scale.set(16, 8, 1)
    sprite.renderOrder = -1
    return sprite
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
