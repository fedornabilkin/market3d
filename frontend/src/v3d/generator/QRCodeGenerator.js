import * as THREE from 'three';
import { getBoundingBoxSize } from '@/utils.js';
import BaseGenerator from "./baseGenerator.js";

/**
 * Class used for generating the 3D model from a bitmask that contains the QR Code Data.
 * qrCodeBitmask must be a square number (QR Code of dimensions 21x21 => Bitmask of length 441 (21*21)).
 */
export default class QRCodeGenerator extends BaseGenerator {
  finalBlock
  blockGeometry
  process = (percent) => {return percent}

  constructor(qrCodeBitmask, options) {
    super(options)
    this.bitMask = qrCodeBitmask
  }

  /**
   * @return {THREE.Mesh} the mesh of the actual QR-Code segment
   */
  getQRCodeMesh() {
    if (!this.options.code.active) {
      return undefined
    }

    this.maskWidth = Math.sqrt(this.bitMask.length)
    this.xCountPosition = this.maskWidth
    this.yCountPosition = this.maskWidth
    this.blockWidth = (this.availableWidth / this.maskWidth) * (this.options.code.block.ratio / 100)

    const qrSystem = new THREE.Object3D()

    // if icon
    this.safetyMargin = Math.min(this.blockWidth * 1.5, 4)
    this.iconSize = {x: 20, y: 20}
    if (this.options.icon.active && this.iconMesh) {
      this.iconSize = getBoundingBoxSize(this.iconMesh)
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

    // if (etoQr.options.code.invert) {
    //   const cornerRadius = this.getCornerRadius();
    //   const textBaseOffset = this.getTextBaseOffset();
    //   const topOffset = this.getTextTopOffset();
    //   const leftOffset = this.getTextLeftOffset();
    //   const isOffsetTopBottom = this.options.base.textPlacement === 'top' || this.options.base.textPlacement === 'bottom' || this.options.base.textPlacement === 'center';
    //   const isOffsetLeftRight = this.options.base.textPlacement === 'left' || this.options.base.textPlacement === 'right';
    //
    //   // const innerAreaShape = getRoundedRectShape(
    //   //   -(this.options.base.width + topOffset - this.options.base.borderWidth * 2) / 2,
    //   //   -(this.options.base.width - this.options.base.borderWidth * 2) / 2,
    //   //   this.options.base.width + textBaseOffset - this.options.base.borderWidth * 2,
    //   //   this.options.base.width - this.options.base.borderWidth * 2,
    //   //   Math.max(0, cornerRadius - this.options.base.borderWidth),
    //   // );
    //   let innerAreaShape;
    //   if (isOffsetTopBottom) {
    //     innerAreaShape = getRoundedRectShape(
    //       -(this.options.base.height + topOffset - this.options.base.borderWidth * 2) / 2,
    //       -(this.options.base.width - this.options.base.borderWidth * 2) / 2,
    //       this.options.base.height + textBaseOffset - this.options.base.borderWidth * 2,
    //       this.options.base.width - this.options.base.borderWidth * 2,
    //       Math.max(0, cornerRadius - this.options.base.borderWidth),
    //     );
    //   } else if (isOffsetLeftRight) {
    //     innerAreaShape = getRoundedRectShape(
    //       -(this.options.base.height - this.options.base.borderWidth * 2) / 2,
    //       -(this.options.base.width + leftOffset - this.options.base.borderWidth * 2) / 2,
    //       this.options.base.height - this.options.base.borderWidth * 2,
    //       this.options.base.width + textBaseOffset - this.options.base.borderWidth * 2,
    //       Math.max(0, cornerRadius - this.options.base.borderWidth),
    //     );
    //   }
    //
    //   const innerAreaMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(innerAreaShape, {
    //     steps: 1,
    //     depth: this.options.code.depth,
    //     bevelEnabled: false,
    //   }), this.materialDetail);
    //   innerAreaMesh.position.z = 0;
    //   innerAreaMesh.updateMatrix();
    //
    //   finalBlockMesh.position.z = -this.options.base.depth;
    //   finalBlockMesh.updateMatrix();
    //
    //   const invertedMesh = subtractMesh(innerAreaMesh, finalBlockMesh);
    //   invertedMesh.position.z = this.options.base.depth;
    //   invertedMesh.updateMatrix();
    //   return invertedMesh;
    // }

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
    return new THREE.Mesh(this.blockGeometry, this.materialDetail)
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

}
