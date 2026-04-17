import * as THREE from 'three';
import {Font} from 'three/examples/jsm/loaders/FontLoader';
import {TextGeometry} from 'three/examples/jsm/geometries/TextGeometry';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils';
import {Brush, Evaluator, SUBTRACTION} from 'three-bvh-csg';
import fontInterSemiBold from '@/assets/fonts/Inter_SemiBold.json';
import fontInterSemiBoldItalic from '@/assets/fonts/Inter_SemiBold_Italic.json';
import fontInterExtraBold from '@/assets/fonts/Inter_ExtraBold.json';
import fontInterExtraBoldItalic from '@/assets/fonts/Inter_ExtraBold_Italic.json';
import BaseGenerator, {parseHexColor} from '@/v3d/generator/base';
import {RectangleRoundedShape} from "@/v3d/primitives/shape";
import {SVGLoader} from "three/examples/jsm/loaders/SVGLoader";
import {Magnet} from "@/v3d/entity";

const lineSpacing = 2

/**
 * Unified generator class for creating 3D models with or without QR code
 */
export default class ModelGenerator extends BaseGenerator {
  collectMesh = {}
  finalBlock = null
  process = (percent) => {return percent}

  constructor(options, qrCodeBitMask = null) {
    super();
    const defaultOptions = {
      baseColor: 0xffffff,
      qrcodeColor: 0x000000,
    };

    this.options = { ...defaultOptions, ...options }
    this.bitMask = qrCodeBitMask
    this.hasQRCode = qrCodeBitMask !== null && qrCodeBitMask !== undefined

    // default material for the base
    this.materialBase = new THREE.MeshPhongMaterial({
      color: this.options.baseColor,
      // transparent: true,
      // opacity: 0.5,
    });
    // default material for qr code, border, etc.
    this.materialDetail = new THREE.MeshPhongMaterial({
      color: this.options.qrcodeColor,
    });

    // total available width without margin and borders for the inner part
    this.availableWidth = this.options.base.width - 2 * this.options.code.margin;
    if (this.options.border.active) {
      // subtract border width
      this.availableWidth -= 2 * this.options.border.width
    }

    this.iconMesh = null
    // reset meshes
    this.baseMesh = null;
    this.borderMesh = null;
    this.subtitleMesh = null;
    this.keychainAttachmentMesh = null;
    this.combinedMesh = null;
    this.exportedMeshes = {}
    this.collectMesh = {}
  }

  /**
   * @return {THREE.Mesh|undefined} the mesh of the base
   */
  getBaseMesh() {
    if (!this.options.base.active) {
      return undefined
    }

    const baseColor = parseHexColor(this.options.base?.color, 0xffffff)
    const materialBase = new THREE.MeshPhongMaterial({ color: baseColor })

    // Плейт со сквозными отверстиями магнитов собирается как Shape + Path holes
    // и экструдируется одним геометрическим вызовом — итоговая сетка манифолдная
    // по построению, без CSG. Для "скрытых" отверстий (не сквозных) используем
    // three-bvh-csg с последующим mergeVertices для гарантии манифолдности.
    const baseShape = new RectangleRoundedShape({
      x: -this.options.base.width / 2,
      y: -this.options.base.height / 2,
      r: this.options.base.cornerRadius,
      w: this.options.base.width,
      h: this.options.base.height,
    }).create()

    const magnetSlots = this._computeMagnetSlots()
    const throughHoles = []
    const blindHoles = []

    if (magnetSlots) {
      const baseDepth = this.options.base.depth
      const magDepth = this.options.magnet.depth
      // Сквозным считаем отверстие без offsetZ, идущее от низа до верха плиты.
      const isThrough = !this.options.magnet.hidden && magDepth >= baseDepth - 1e-4
      for (const slot of magnetSlots.slots) {
        if (isThrough) throughHoles.push(slot)
        else blindHoles.push(slot)
      }
    }

    // Добавляем сквозные отверстия как Path holes в Shape.
    for (const slot of throughHoles) {
      baseShape.holes.push(this._magnetHolePath(slot.x, slot.y))
    }

    const geo = new THREE.ExtrudeGeometry(baseShape, {
      steps: 1,
      depth: this.options.base.depth,
      bevelEnabled: false,
      curveSegments: 32,
    })
    let baseMesh = new THREE.Mesh(geo, materialBase)
    baseMesh.updateMatrix()

    // Слепые отверстия вырезаем через BVH CSG — это честный 3D-boolean,
    // который не упирается в coplanar-проблемы three-csg-ts.
    if (blindHoles.length) {
      baseMesh = this._subtractBlindHoles(baseMesh, blindHoles)
      baseMesh.material = materialBase
    }

    return baseMesh
  }

  /** Рассчитывает координаты центров магнитных отверстий в плоскости XY. */
  _computeMagnetSlots() {
    if (!this.options.magnet.active) return null
    const size = this.options.magnet.size
    const gap = Math.max(0, this.options.magnet.gap || 0)
    const {maxCols, maxRows, maxTotal} = Magnet.computeLayout(
      this.options.base.width,
      this.options.base.height,
      size,
      gap,
    )
    const requested = Math.max(1, Math.floor(this.options.magnet.count || 1))
    const total = Math.min(requested, maxTotal)
    if (total <= 0) return null

    const horizontal = this.options.base.width >= this.options.base.height
    const longSide = horizontal ? this.options.base.width : this.options.base.height
    const shortSide = horizontal ? this.options.base.height : this.options.base.width
    const rows = Math.min(maxRows, Math.max(1, Math.ceil(total / maxCols)))
    const cols = Math.ceil(total / rows)

    const slots = []
    let placed = 0
    for (let r = 0; r < rows && placed < total; r++) {
      const rowCount = Math.min(cols, total - placed)
      const colStart = (cols - rowCount) / 2
      const rowOffset = rows === 1 ? 0 : (-shortSide / 2 + shortSide / rows * (r + 0.5))
      for (let c = 0; c < rowCount; c++) {
        const slot = colStart + c
        const colOffset = -longSide / 2 + longSide / cols * (slot + 0.5)
        const x = horizontal ? colOffset : rowOffset
        const y = horizontal ? rowOffset : colOffset
        slots.push({x, y})
        placed++
      }
    }
    return {slots}
  }

  /** Path-отверстие под магнит в локальной системе координат Shape'а плиты. */
  _magnetHolePath(cx, cy) {
    const size = this.options.magnet.size
    const path = new THREE.Path()
    if (this.options.magnet.shape === 'round') {
      path.absellipse(cx, cy, size / 2, size / 2, 0, Math.PI * 2, true, 0)
    } else {
      const half = size / 2
      // Винтящий порядок против часовой стрелки — для ExtrudeGeometry это hole.
      path.moveTo(cx - half, cy - half)
      path.lineTo(cx - half, cy + half)
      path.lineTo(cx + half, cy + half)
      path.lineTo(cx + half, cy - half)
      path.lineTo(cx - half, cy - half)
    }
    return path
  }

  /**
   * Вычитает из плиты набор слепых (не сквозных) отверстий через three-bvh-csg.
   * После вычитания склеиваем совпадающие вершины, чтобы результат был манифолдным.
   */
  _subtractBlindHoles(plateMesh, slots) {
    try {
      const size = this.options.magnet.size
      const depth = this.options.magnet.depth
      const offsetZ = this.options.magnet.hidden ? (this.options.magnet.offsetZ || 0) : 0

      const plateBrush = new Brush(this.prepForBvhCsg(plateMesh.geometry))
      plateBrush.updateMatrixWorld()

      const evaluator = new Evaluator()
      let current = plateBrush
      for (const slot of slots) {
        let holeGeo
        if (this.options.magnet.shape === 'round') {
          holeGeo = new THREE.CylinderGeometry(size / 2, size / 2, depth, 32)
          holeGeo.rotateX(Math.PI / 2)
        } else {
          holeGeo = new THREE.BoxGeometry(size, size, depth)
        }
        holeGeo.translate(slot.x, slot.y, depth / 2 + offsetZ)
        const holeBrush = new Brush(this.prepForBvhCsg(holeGeo))
        holeBrush.updateMatrixWorld()
        const result = evaluator.evaluate(current, holeBrush, SUBTRACTION)
        current = result
      }

      const finalGeo = BufferGeometryUtils.mergeVertices(current.geometry, 1e-4)
      finalGeo.computeVertexNormals()
      const mesh = new THREE.Mesh(finalGeo, plateMesh.material)
      mesh.updateMatrix()
      return mesh
    } catch (e) {
      console.warn('ModelGenerator: BVH CSG blind-hole subtract failed', e)
      return plateMesh
    }
  }

  /**
   * @return {THREE.Group|undefined} the mesh of the text
   */
  getTextMesh() {
    if (!this.options.text.active) {
      return undefined
    }
    const textGroup = new THREE.Group()

    const correctText = (text) => {
      let font = new Font(fontInterSemiBold)
      if (text.startsWith('*') && text.endsWith('*')) {
        font = new Font(fontInterSemiBoldItalic)
        text = text.slice(1, -1)
      }
      if (text.startsWith('**') && text.endsWith('**')) {
        font = new Font(fontInterExtraBold)
        text = text.slice(2, -2)
      }
      if (text.startsWith('***') && text.endsWith('***')) {
        font = new Font(fontInterExtraBoldItalic)
        text = text.slice(3, -3)
      }
      return {text, font}
    }

    const textLines = this.options.text.message.trim().split('\n')
    let numLines = textLines.length
    this.options.text.height = (this.options.text.size + this.options.text.margin) * numLines + lineSpacing * (numLines - 1) - this.options.text.margin

    const textColor = parseHexColor(this.options.text?.color, 0x000000)
    const materialText = new THREE.MeshPhongMaterial({ color: textColor })

    for (let i = 0; i < numLines; i++) {
      const {text, font} = correctText(textLines[i])

      const tempTextGeometry = new TextGeometry(text, {
        font: font,
        size: this.options.text.size,
        depth: this.options.text.depth,
      })
      const subtitleMesh = new THREE.Mesh(tempTextGeometry, materialText)
      const textSize = this.getBoundingBoxSize(subtitleMesh)

      const lineSpacingCurrent = (i < numLines && numLines > 1 ) ? lineSpacing : 0
      const oneHeight = this.options.text.size + lineSpacingCurrent
      const posBase = this.options.text.height - oneHeight * i
      let posY = posBase - this.options.text.size
      const alignment = -textSize.x / 2

      subtitleMesh.position.set(alignment, posY, this.options.base.depth)
      subtitleMesh.position.y -= this.options.text.height / 2

      if (this.options.code.active) {
        subtitleMesh.position.y -= this.options.base.width - this.options.base.height / 2 + oneHeight - this.options.code.margin
      }

      subtitleMesh.position.x += this.options.text.offsetX
      subtitleMesh.position.y += this.options.text.offsetY

      textGroup.add(subtitleMesh)
    }
    return textGroup
  }

  /**
   * @return {THREE.Mesh|undefined} the mesh of the border
   */
  getBorderMesh() {
    if (!this.options.border.active) {
      return undefined
    }

    return this.buildBorderFrame({
      width: this.options.base.width,
      height: this.options.base.height,
      cornerRadius: this.options.base.cornerRadius,
      borderWidth: this.options.border.width,
      borderDepth: this.options.border.depth,
      baseDepth: this.options.base.depth,
      color: this.options.border?.color,
    })
  }

  /**
   * @return {THREE.Mesh|THREE.Group|undefined} the mesh of the keychain attachment hole
   */
  getKeychainMesh() {
    return this.buildKeychainTab({
      kc: this.options.keychain,
      depth: this.options.base.depth,
      plateHalfW: this.options.base.width / 2,
      plateHalfH: this.options.base.height / 2,
      tabShape: 'd',
      plateColor: this.options.base?.color,
    })
  }

  /**
   * @return {THREE.Mesh|undefined} the 3D mesh of the icon
   */
  getIconMesh() {
    if (!this.options.icon.active) {
      return undefined
    }

    const data = (!this.options.icon.isNoneName()) ? this.options.icon.src : this.options.icon.srcCustom
    const svgGroup = new THREE.Group()
    const svgLoader = new SVGLoader()
    const svgData = svgLoader.parse(data)

    const iconColor = parseHexColor(this.options.icon?.color, 0x000000)
    const materialIcon = new THREE.MeshPhongMaterial({ color: iconColor })

    svgData.paths.forEach((path) => {
      const shapes = path.toShapes(!this.options.icon.inverted)
      shapes.forEach((shape) => {
        const geometry = new THREE.ExtrudeGeometry(shape, {
          depth: this.options.code.depth,
          bevelEnabled: false
        })

        const mesh = new THREE.Mesh(geometry, materialIcon)

        svgGroup.add(mesh)
      })
    })

    // измеряем размер группы
    const box = new THREE.Box3().setFromObject(svgGroup)
    const size = new THREE.Vector3()
    box.getSize(size)

    // scale
    const iconSizeRatio = this.options.icon.ratio / 100
    const scaleRatioY = size.y / (this.availableWidth * iconSizeRatio)
    const scaleRatioX = size.x / (this.availableWidth * iconSizeRatio)
    const scaleRatio = scaleRatioX > scaleRatioY ? scaleRatioX : scaleRatioY


    svgGroup.children.forEach(item => {
      // Инвертировать по оси y, т.к. по умолчанию svg читаются вверх ногами в three.js
      // https://muffinman.io/blog/three-js-extrude-svg-path/#svg-paths-are-inverted-on-y-axis
      item.scale.y *= -1
      // mesh.rotation.x = Math.PI
      item.position.x = size.x / scaleRatio / -2 + this.options.icon.offsetX
      item.position.y = size.y / scaleRatio / 2 + this.options.icon.offsetY
      item.position.z = this.options.base.depth

      item.scale.x /= scaleRatio
      item.scale.y /= scaleRatio

      if (this.options.code.active && this.options.base.width < this.options.base.height) {
        item.position.y += (this.options.base.height - this.options.base.width) / 2
      }
    })

    this.iconMesh = svgGroup
    return svgGroup
  }

  /**
   * Синхронно строит QR-меш как один THREE.Mesh с объединённой BufferGeometry.
   * Используем одну шаблонную геометрию, с которой в главный цикл пишем вершины/нормали/индексы
   * в предварительно выделенные типизированные массивы. За счёт единственного draw-call
   * и отсутствия создания тысяч Mesh/Geometry генерация становится реалтайм-пригодной.
   * Результат — обычный THREE.Mesh, совместимый со STL/OBJ-экспортерами.
   * @return {THREE.Mesh|undefined}
   */
  getQRCodeMesh() {
    if (!this.hasQRCode || !this.options.code.active) {
      return undefined
    }

    this.maskWidth = Math.sqrt(this.bitMask.length)
    this.xCountPosition = this.maskWidth
    this.yCountPosition = this.maskWidth
    this.blockWidth = (this.availableWidth / this.maskWidth) * (this.options.code.block.ratio / 100)

    const codeColor = parseHexColor(this.options.code?.color, 0x000000)
    const material = new THREE.MeshPhongMaterial({ color: codeColor })
    this._codeBlockMaterial = material

    // Зона, которую нужно оставить пустой под иконку в центре.
    this.safetyMargin = Math.min(this.blockWidth * 1.5, 4)
    this.iconSize = {x: 20, y: 20}
    if (this.options.icon.active && this.iconMesh) {
      this.iconSize = this.getBoundingBoxSize(this.iconMesh)
    }

    const rotationBlock = this.options.code.block.shape === 'rotation'
    const roundBlock = this.options.code.block.shape === 'round'
    const cityMode = this.options.code.block.cityMode === true
    const baseBlockDepth = this.options.code.depth
    const cityMinDepth = Math.min(baseBlockDepth, this.options.code.block.depth)
    const cityDepthRange = Math.abs(this.options.code.block.depth - baseBlockDepth)

    // Шаблонная геометрия блока: высота нормирована к 1, низ — в z=0.
    // Преобразования rotation/round запекаются в шаблон — они одинаковы для всех блоков.
    // Далее per-block нам достаточно сдвига по XY и умножения Z на blockDepth.
    let template
    if (roundBlock) {
      template = new THREE.CylinderGeometry(this.blockWidth / 2, this.blockWidth / 2, 1, 32)
      template.rotateX(Math.PI / 2)
    } else {
      template = new THREE.BoxGeometry(this.blockWidth, this.blockWidth, 1)
      if (rotationBlock) {
        template.rotateZ(Math.PI / 4)
      }
    }
    template.translate(0, 0, 0.5)

    // Верхняя граница количества блоков — число чёрных модулей.
    let maxBlocks = 0
    for (let i = 0; i < this.bitMask.length; i++) {
      if (this.bitMask[i]) maxBlocks++
    }
    if (maxBlocks === 0) {
      template.dispose()
      this.finalBlock = new THREE.Object3D()
      this.process(100)
      return this.finalBlock
    }

    const tplPos = template.attributes.position.array
    const tplNorm = template.attributes.normal.array
    const tplIndex = template.index ? template.index.array : null
    const vertCount = template.attributes.position.count
    const idxCount = tplIndex ? tplIndex.length : 0

    // Пред-аллокация. Используем Uint32 для индексов, т.к. общее число вершин
    // может легко превышать 65535 (например, 800 цилиндров × 68 вершин ≈ 54k — ещё ок,
    // но с запасом безопаснее сразу брать Uint32).
    const totalVerts = maxBlocks * vertCount
    const totalIdx = maxBlocks * idxCount
    const positions = new Float32Array(totalVerts * 3)
    const normals = new Float32Array(totalVerts * 3)
    const indices = tplIndex ? new Uint32Array(totalIdx) : null

    const portraitOffsetY = this.options.base.width < this.options.base.height
      ? (this.options.base.height - this.options.base.width) / 2
      : 0

    const checkEmptyCenter = this.options.code.emptyCenter === true && !!this.iconMesh
    const iconHalfX = this.iconSize.x / 2 + this.safetyMargin
    const iconHalfY = this.iconSize.y / 2 + this.safetyMargin
    const baseZ = this.options.base.depth

    let blockIdx = 0
    for (let x = 0; x < this.maskWidth; x++) {
      for (let y = 0; y < this.maskWidth; y++) {
        if (!this.bitMask[y * this.maskWidth + x]) continue

        const posX = this.correctPositionX(this.availableWidth, this.xCountPosition, this.blockWidth, x)
        let posY = this.correctPositionY(this.availableWidth, this.yCountPosition, this.blockWidth, y)

        if (checkEmptyCenter
          && posX > -iconHalfX && posX < iconHalfX
          && posY > -iconHalfY && posY < iconHalfY) {
          continue
        }

        posY += portraitOffsetY

        const blockDepth = cityMode
          ? cityMinDepth + Math.random() * cityDepthRange
          : baseBlockDepth

        // Копируем вершины шаблона со сдвигом и Z-масштабом.
        // Нормали при translation+Z-scale остаются корректными (XY-компоненты не меняются,
        // Z-компоненты либо 0, либо ±1 — последние сохраняются после норм. ремасштаба).
        const baseV = blockIdx * vertCount
        const posOffset = baseV * 3
        for (let v = 0; v < vertCount; v++) {
          const src = v * 3
          const dst = posOffset + src
          positions[dst]     = tplPos[src]     + posX
          positions[dst + 1] = tplPos[src + 1] + posY
          positions[dst + 2] = tplPos[src + 2] * blockDepth + baseZ
          normals[dst]     = tplNorm[src]
          normals[dst + 1] = tplNorm[src + 1]
          normals[dst + 2] = tplNorm[src + 2]
        }

        if (indices) {
          const idxOffset = blockIdx * idxCount
          for (let k = 0; k < idxCount; k++) {
            indices[idxOffset + k] = tplIndex[k] + baseV
          }
        }

        blockIdx++
      }
    }

    template.dispose()

    // Если часть блоков была отброшена (emptyCenter), обрезаем типизированные массивы.
    const usedVerts = blockIdx * vertCount
    const usedIdx = blockIdx * idxCount
    const finalPositions = usedVerts === totalVerts ? positions : positions.subarray(0, usedVerts * 3)
    const finalNormals = usedVerts === totalVerts ? normals : normals.subarray(0, usedVerts * 3)
    const finalIndices = indices && (usedIdx === totalIdx ? indices : indices.subarray(0, usedIdx))

    const mergedGeometry = new THREE.BufferGeometry()
    mergedGeometry.setAttribute('position', new THREE.BufferAttribute(finalPositions, 3))
    mergedGeometry.setAttribute('normal', new THREE.BufferAttribute(finalNormals, 3))
    if (finalIndices) {
      mergedGeometry.setIndex(new THREE.BufferAttribute(finalIndices, 1))
    }
    mergedGeometry.computeBoundingBox()
    mergedGeometry.computeBoundingSphere()

    const mesh = new THREE.Mesh(mergedGeometry, material)
    this.finalBlock = mesh
    this.process(100)
    return mesh
  }

  /**
   * @param width {number}
   * @param countPosition {number}
   * @param widthBlock {float}
   * @param current {number}
   * @returns {number}
   */
  correctPositionX(width, countPosition, widthBlock, current) {
    // Допустимую ширину делим на количество позиций в маске и умножаем на текущую позицию
    let position = width / countPosition * current
    // Смещаем влево на половину допустимой ширины и еще на половину ширины блока
    position -= width / 2 - widthBlock / 2
    return position
  }

  /**
   * @param height {number}
   * @param countPosition {number}
   * @param widthBlock {float}
   * @param current {number}
   * @returns {number}
   */
  correctPositionY(height, countPosition, widthBlock, current) {
    // От допустимой высоты отнимаем допустимую высоту, деленную на количество позиций в маске и умноженную на текущую позицию
    let position = height - height / countPosition * current
    // Смещаем вниз на половину допустимой высоты и поднимаем вверх на половину ширины блока
    position -= height / 2 + widthBlock / 2
    return position
  }

  /**
   * @param depth {number}
   * @param addon {number}
   * @returns {number}
   */
  correctPositionZ(depth, addon = 0) {
    return depth + addon / 2
  }

  /**
   * Get all meshes based on the current mode (with or without QR code)
   * @return {Object} Object with all generated meshes
   */
  getAllMeshes() {
    const meshes = {}

    // Base meshes (always available)
    meshes.base = this.getBaseMesh()
    meshes.border = this.getBorderMesh()
    meshes.keychain = this.getKeychainMesh()
    meshes.icon = this.getIconMesh()
    meshes.text = this.getTextMesh()

    // QR code mesh (only if QR code is active)
    if (this.hasQRCode && this.options.code.active) {
      this.getQRCodeMesh()
      meshes.qr = this.finalBlock
    }

    return meshes
  }

}
