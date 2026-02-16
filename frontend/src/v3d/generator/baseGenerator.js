import * as THREE from 'three';
import fontInterSemiBold from '@/assets/fonts/Inter_SemiBold.json';
import fontInterSemiBoldItalic from '@/assets/fonts/Inter_SemiBold_Italic.json';
import fontInterExtraBold from '@/assets/fonts/Inter_ExtraBold.json';
import fontInterExtraBoldItalic from '@/assets/fonts/Inter_ExtraBold_Italic.json';
import {subtractMesh, unionMesh, getBoundingBoxSize} from '@/utils';
import {RectangleRoundedCornerShape, RectangleRoundedShape} from "@/v3d/primitives/shape";
import {SVGLoader} from "three/examples/jsm/loaders/SVGLoader";

const lineSpacing = 2

export default class BaseGenerator {

  collectMesh = {}

  constructor(options) {
    const defaultOptions = {
      baseColor: 0xffffff,
      qrcodeColor: 0x000000,
    };

    this.options = { ...defaultOptions, ...options }

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

  createMaterial(color) {
    return new THREE.MeshBasicMaterial({
      color: color,
    })
  }

  /**
   * @return {THREE.Mesh|undefined} the mesh of the base
   */
  getBaseMesh() {
    if (!this.options.base.active) {
      return undefined
    }

    const shape = new RectangleRoundedShape({
      x: -this.options.base.width / 2,
      y: -this.options.base.height / 2,
      r: this.options.base.cornerRadius,
      w: this.options.base.width,
      h: this.options.base.height,
    })

    const model = new THREE.ExtrudeGeometry(shape.create(), {
      steps: 1,
      depth: this.options.base.depth,
      bevelEnabled: false,
    })

    let baseMesh = new THREE.Mesh(model, this.materialBase)
    baseMesh.updateMatrix()

    if (this.options.magnet.active) {
      const width = this.options.magnet.size
      const height = this.options.magnet.size
      const depth = this.options.magnet.depth
      const material = this.createMaterial('0x000000')

      let holeMesh;
      if (this.options.magnet.shape === 'round') {
        const geometryMagnet = new THREE.CylinderGeometry(width / 2, height / 2, depth, 32)
        holeMesh = new THREE.Mesh(geometryMagnet, material)
        holeMesh.rotation.x = -Math.PI / 2
      } else {
        // shape = square
        const geometryMagnet = new THREE.BoxGeometry(width, height, depth)
        holeMesh = new THREE.Mesh(geometryMagnet, material)
      }
      holeMesh.position.z = depth / 2
      if (this.options.magnet.hidden) {
        holeMesh.position.z += this.options.magnet.offsetZ
      }

      holeMesh.position.x = baseMesh.position.x
      holeMesh.updateMatrix()

      baseMesh = subtractMesh(baseMesh, holeMesh)
      baseMesh.updateMatrix()
    }

    return baseMesh
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
      let font = new THREE.Font(fontInterSemiBold)
      if (text.startsWith('*') && text.endsWith('*')) {
        font = new THREE.Font(fontInterSemiBoldItalic)
        text = text.slice(1, -1)
      }
      if (text.startsWith('**') && text.endsWith('**')) {
        font = new THREE.Font(fontInterExtraBold)
        text = text.slice(2, -2)
      }
      if (text.startsWith('***') && text.endsWith('***')) {
        font = new THREE.Font(fontInterExtraBoldItalic)
        text = text.slice(3, -3)
      }
      return {text, font}
    }

    const textLines = this.options.text.message.trim().split('\n')
    let numLines = textLines.length
    this.options.text.height = (this.options.text.size + this.options.text.margin) * numLines + lineSpacing * (numLines - 1) - this.options.text.margin

    for (let i = 0; i < numLines; i++) {
      const {text, font} = correctText(textLines[i])

      const tempTextGeometry = new THREE.TextGeometry(text, {
        font: font,
        size: this.options.text.size,
        height: this.options.text.depth,
      })
      const subtitleMesh = new THREE.Mesh(tempTextGeometry, this.materialDetail)
      const textSize = getBoundingBoxSize(subtitleMesh)

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
    let shape = new RectangleRoundedShape({
      x: -this.options.base.width / 2,
      y: -this.options.base.height / 2,
      r: this.options.base.cornerRadius,
      w: this.options.base.width,
      h: this.options.base.height,
    })

    const model = new THREE.ExtrudeGeometry(shape.create(), {
      steps: 1,
      depth: this.options.border.depth,
      bevelEnabled: false,
    })

    const mesh = new THREE.Mesh(model, this.materialDetail)

    const shapeHole = new RectangleRoundedShape({
      x: -(this.options.base.width - this.options.border.width * 2) / 2,
      y: -(this.options.base.height - this.options.border.width * 2) / 2,
      r: this.options.base.cornerRadius,
      w: (this.options.base.width - this.options.border.width * 2),
      h: (this.options.base.height - this.options.border.width * 2),
    })

    const modelHole = new THREE.ExtrudeGeometry(shapeHole.create(), {
      steps: 1,
      depth: this.options.border.depth,
      bevelEnabled: false,
    })

    const meshHole = new THREE.Mesh(modelHole, this.materialDetail)

    const meshFrame = subtractMesh(mesh, meshHole)
    meshFrame.position.z = this.options.base.depth
    meshFrame.updateMatrix()

    return meshFrame
  }

  /**
   * @return {THREE.Mesh|undefined} the mesh of the keychain attachment hole
   */
  getKeychainMesh() {
    if (!this.options.keychain.active) {
      return undefined
    }
    const holeRadius = this.options.keychain.holeDiameter / 2
    const keyChainBorder = 3
    const height = this.options.keychain.holeDiameter + keyChainBorder
    const width = this.options.keychain.holeDiameter + keyChainBorder

    const shape = new RectangleRoundedCornerShape({
      x: -width / 2,
      y: -height / 2,
      rA: 0,
      rB: 0,
      rC: height / 2,
      rD: height / 2,
      w: width,
      h: height,
    })

    const model = new THREE.ExtrudeGeometry(shape.create(), {
      steps: 1,
      depth: this.options.base.depth,
      bevelEnabled: false,
    })

    const mesh = new THREE.Mesh(model, this.materialBase)
    mesh.position.z = 0
    mesh.updateMatrix()

    const modelHole = new THREE.CylinderGeometry(holeRadius, holeRadius, this.options.base.depth, 32)
    const meshHole = new THREE.Mesh(modelHole, this.materialBase)

    meshHole.rotation.x = -Math.PI / 2
    meshHole.position.z = this.options.base.depth / 2
    meshHole.position.x = 0
    meshHole.position.y = 0
    meshHole.updateMatrix()

    let finalMesh = subtractMesh(mesh, meshHole)
    let x = -this.options.base.width / 2 - width / 2 + keyChainBorder / 2
    let y = finalMesh.position.y
    let zR = -Math.PI / 2

    if (this.options.keychain.placement === 'top') {
      x = finalMesh.position.x
      y = this.options.base.height / 2 + height / 2 - keyChainBorder / 2
      zR = -Math.PI
    }
    if (this.options.keychain.placement === 'topLeft') {
      y = this.options.base.height / 2 + height / 2 - keyChainBorder * 1.5
      x = -this.options.base.width / 2 - width / 2 + keyChainBorder * 1.5
      zR = -Math.PI / 4 + -Math.PI / 2
    }

    finalMesh.position.y = y
    finalMesh.position.x = x
    finalMesh.rotation.z = zR
    finalMesh.updateMatrix()

    if (this.options.keychain.mirror) {
      const mirror = subtractMesh(mesh, meshHole)
      if (this.options.keychain.placement === 'left') {
        x = -x
        zR = zR + Math.PI
      } else if (this.options.keychain.placement === 'top') {
        y = -y
        zR = zR + Math.PI
      } else if (this.options.keychain.placement === 'topLeft') {
        x = -x
        y = -y
        zR = zR + Math.PI
      }

      mirror.position.y = y
      mirror.position.x = x
      mirror.rotation.z = zR
      mirror.updateMatrix()

      finalMesh = unionMesh(finalMesh, mirror)
    }

    return finalMesh
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

    svgData.paths.forEach((path) => {
      const shapes = path.toShapes(!this.options.icon.inverted)
      shapes.forEach((shape) => {
        const geometry = new THREE.ExtrudeGeometry(shape, {
          depth: this.options.code.depth,
          bevelEnabled: false
        })

        const mesh = new THREE.Mesh(geometry, this.materialDetail)

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

}
