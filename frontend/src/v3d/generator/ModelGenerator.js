import * as THREE from 'three';
import fontInterSemiBold from '@/assets/fonts/Inter_SemiBold.json';
import fontInterSemiBoldItalic from '@/assets/fonts/Inter_SemiBold_Italic.json';
import fontInterExtraBold from '@/assets/fonts/Inter_ExtraBold.json';
import fontInterExtraBoldItalic from '@/assets/fonts/Inter_ExtraBold_Italic.json';
import BaseGenerator from '@/v3d/generator/base';
import {RectangleRoundedCornerShape, RectangleRoundedShape} from "@/v3d/primitives/shape";
import {SVGLoader} from "three/examples/jsm/loaders/SVGLoader";

const lineSpacing = 2

/**
 * Parse hex color string (#rrggbb) to Three.js color number (0xrrggbb).
 * @param {string|undefined|null} hexStr - Hex string or undefined/null
 * @param {number} defaultNum - Default color number if hexStr invalid
 * @returns {number}
 */
function parseHexColor(hexStr, defaultNum) {
  if (hexStr == null || typeof hexStr !== 'string') return defaultNum
  const hex = hexStr.replace(/^#/, '')
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return defaultNum
  return parseInt(hex, 16)
}

/**
 * Unified generator class for creating 3D models with or without QR code
 */
export default class ModelGenerator extends BaseGenerator {
  collectMesh = {}
  finalBlock = null
  blockGeometry = null
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

    const baseColor = parseHexColor(this.options.base?.color, 0xffffff)
    const materialBase = new THREE.MeshPhongMaterial({ color: baseColor })
    let baseMesh = new THREE.Mesh(model, materialBase)
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

      baseMesh = this.subtractMesh(baseMesh, holeMesh)
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

    const textColor = parseHexColor(this.options.text?.color, 0x000000)
    const materialText = new THREE.MeshPhongMaterial({ color: textColor })

    for (let i = 0; i < numLines; i++) {
      const {text, font} = correctText(textLines[i])

      const tempTextGeometry = new THREE.TextGeometry(text, {
        font: font,
        size: this.options.text.size,
        height: this.options.text.depth,
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

    const borderColor = parseHexColor(this.options.border?.color, 0x000000)
    const materialBorder = new THREE.MeshPhongMaterial({ color: borderColor })
    const mesh = new THREE.Mesh(model, materialBorder)

    const shapeHole = new RectangleRoundedShape({
      x: -(this.options.base.width - this.options.border.width * 2) / 2,
      y: -(this.options.base.height - this.options.border.width * 2) / 2,
      // sin 90 градусов
      r: this.options.base.cornerRadius - this.options.border.width * Math.sin(Math.PI / 4),
      w: (this.options.base.width - this.options.border.width * 2),
      h: (this.options.base.height - this.options.border.width * 2),
    })

    const modelHole = new THREE.ExtrudeGeometry(shapeHole.create(), {
      steps: 1,
      depth: this.options.border.depth,
      bevelEnabled: false,
    })

    const meshHole = new THREE.Mesh(modelHole, materialBorder)

    const meshFrame = this.subtractMesh(mesh, meshHole)
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
    const keyChainBorder = this.options.keychain.borderWidth
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
      h: height + this.options.keychain.height,
    })

    const model = new THREE.ExtrudeGeometry(shape.create(), {
      steps: 1,
      depth: this.options.base.depth,
      bevelEnabled: false,
    })

    const keychainColor = parseHexColor(this.options.keychain?.color, 0xffffff)
    const materialKeychain = new THREE.MeshPhongMaterial({ color: keychainColor })
    const mesh = new THREE.Mesh(model, materialKeychain)
    mesh.position.z = 0
    mesh.updateMatrix()

    const modelHole = new THREE.CylinderGeometry(holeRadius, holeRadius, this.options.base.depth, 32)
    const meshHole = new THREE.Mesh(modelHole, materialKeychain)

    meshHole.rotation.x = -Math.PI / 2
    meshHole.position.z = this.options.base.depth / 2
    meshHole.position.x = 0
    meshHole.position.y = 0
    meshHole.updateMatrix()

    let finalMesh = this.subtractMesh(mesh, meshHole)
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
    if (this.options.keychain.placement === 'topRight') {
      y = this.options.base.height / 2 + height / 2 - keyChainBorder * 1.5
      x = this.options.base.width / 2 - width / 2 + keyChainBorder * 1.5
      zR = Math.PI / 4 + Math.PI / 2
    }

    finalMesh.position.y = y + this.options.keychain.offsetY
    finalMesh.position.x = x + this.options.keychain.offsetX
    finalMesh.rotation.z = zR
    finalMesh.updateMatrix()

    if (this.options.keychain.mirror) {
      const mirror = this.subtractMesh(mesh, meshHole)
      if (this.options.keychain.placement === 'left') {
        x = -x - this.options.keychain.offsetX
        y = y + this.options.keychain.offsetY
        zR = zR + Math.PI
      } else if (this.options.keychain.placement === 'top') {
        x = x + this.options.keychain.offsetX
        y = -y - this.options.keychain.offsetY
        zR = zR + Math.PI
      } else if (this.options.keychain.placement === 'topLeft') {
        x = -x - this.options.keychain.offsetX
        y = -y - this.options.keychain.offsetY
        zR = zR + Math.PI
      } else if (this.options.keychain.placement === 'topRight') {
        x = -x - this.options.keychain.offsetX
        y = -y - this.options.keychain.offsetY
        zR = zR - Math.PI
      }

      mirror.position.y = y
      mirror.position.x = x
      mirror.rotation.z = zR
      mirror.updateMatrix()

      finalMesh = this.unionMesh(finalMesh, mirror)
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
   * @return {THREE.Mesh|undefined} the mesh of the actual QR-Code segment
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
    this._codeBlockMaterial = new THREE.MeshPhongMaterial({ color: codeColor })

    const qrSystem = new THREE.Object3D()

    // if icon
    this.safetyMargin = Math.min(this.blockWidth * 1.5, 4)
    this.iconSize = {x: 20, y: 20}
    if (this.options.icon.active && this.iconMesh) {
      this.iconSize = this.getBoundingBoxSize(this.iconMesh)
    }

    const rotationBlock = this.options.code.block.shape === 'rotation'
    const roundBlock = this.options.code.block.shape === 'round'
    let etoQr = this
    let x = 0

    function iterateBitMask() {
      do {
        for (let y = 0; y < etoQr.maskWidth; y++) {

          const isBlack = !!etoQr.bitMask[y * etoQr.maskWidth + x]
          if (isBlack) {
            // if pixel is black create a block
            let blockDepth = etoQr.options.code.depth;
            if (etoQr.options.code.block.cityMode) {
              blockDepth = Math.min(etoQr.options.code.depth, etoQr.options.code.block.depth) + Math.random() * Math.abs(etoQr.options.code.block.depth - etoQr.options.code.depth)
            }

            const meshBlock = etoQr.createMeshBlock(etoQr.blockWidth, etoQr.blockWidth, blockDepth, roundBlock)

            const posX = etoQr.correctPositionX(etoQr.availableWidth, etoQr.xCountPosition, etoQr.blockWidth, x)
            let posY = etoQr.correctPositionY(etoQr.availableWidth, etoQr.yCountPosition, etoQr.blockWidth, y)
            const posZ = etoQr.correctPositionZ(etoQr.options.base.depth, blockDepth)

            if (etoQr.options.code.emptyCenter === true && etoQr.iconMesh) {
              if ((posX > -etoQr.iconSize.x / 2 - etoQr.safetyMargin
                  && posX < etoQr.iconSize.x / 2 + etoQr.safetyMargin)
                && (posY > -etoQr.iconSize.y / 2 - etoQr.safetyMargin
                  && posY < +etoQr.iconSize.y / 2 + etoQr.safetyMargin)
              ) {
                continue
              }
            }

            // add qr code blocks to qrcode and combined model
            meshBlock.position.set(posX, posY, posZ)
            if(rotationBlock) {
              meshBlock.rotation.z = Math.PI / 4
            }else if(roundBlock) {
              meshBlock.rotation.x = Math.PI / 2
            }
            if (etoQr.options.base.width < etoQr.options.base.height) {
              meshBlock.position.y += (etoQr.options.base.height - etoQr.options.base.width) / 2
            }
            meshBlock.updateMatrix()
            qrSystem.add(meshBlock)

          } // if block
        } // for two

        x++
        etoQr.process(x * 100 / (etoQr.maskWidth))
      } while (x % 2 !== 0 && x < etoQr.maskWidth) // for one

      if (x < etoQr.maskWidth) {
        setTimeout(iterateBitMask)
      }

    } // func

    iterateBitMask()

    this.finalBlock = qrSystem

    // return finalBlockMesh
  }

  /**
   * @param w
   * @param h
   * @param d
   * @param isRound bool
   * @returns {THREE.Mesh}
   */
  createMeshBlock(w, h, d, isRound = false) {
    if (!this.blockGeometry) {
      this.blockGeometry = !isRound ? new THREE.BoxGeometry(w, h, d) : new THREE.CylinderGeometry(w/2, h/2, d, 64)
    }
    const material = this._codeBlockMaterial || this.materialDetail
    return new THREE.Mesh(this.blockGeometry, material)
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
