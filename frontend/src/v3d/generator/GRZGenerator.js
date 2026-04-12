import * as THREE from 'three';
import {Font} from 'three/examples/jsm/loaders/FontLoader';
import {TextGeometry} from 'three/examples/jsm/geometries/TextGeometry';
import fontInterExtraBold from '@/assets/fonts/Inter_ExtraBold.json';
import BaseGenerator from '@/v3d/generator/base';
import {RectangleRoundedShape, RectangleRoundedCornerShape} from '@/v3d/primitives/shape';

// Пропорции реального номерного знака РФ (ГОСТ Р 50577-2018): 520 × 112 мм
const REAL_WIDTH = 520
const REAL_HEIGHT = 112
const PLATE_RATIO = REAL_WIDTH / REAL_HEIGHT

// Кириллица → латиница для букв, допустимых на номерных знаках РФ
const CYR_TO_LAT = {
  'А': 'A', 'В': 'B', 'Е': 'E', 'К': 'K', 'М': 'M', 'Н': 'H',
  'О': 'O', 'Р': 'P', 'С': 'C', 'Т': 'T', 'У': 'Y', 'Х': 'X',
}

function cyrToLat(text) {
  return text.split('').map(ch => CYR_TO_LAT[ch] || ch).join('')
}

function parseHexColor(hexStr, defaultNum) {
  if (hexStr == null || typeof hexStr !== 'string') return defaultNum
  const hex = hexStr.replace(/^#/, '')
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return defaultNum
  return parseInt(hex, 16)
}

/**
 * Генератор 3D-модели брелока российского номерного знака.
 * Строит меши: основа, текст номера, код региона, разделитель, флаг, надпись RUS.
 */
export default class GRZGenerator extends BaseGenerator {
  constructor(options = {}) {
    super()
    this.options = {
      base: {active: true, width: 60, height: 14, depth: 2, cornerRadius: 3, color: null},
      textDepth: 1,
      letter1: 'А',
      digits: '001',
      letter2: 'А',
      letter3: 'А',
      region: '77',
      textColor: '#000000',
      flagEnabled: true,
      border: {active: true, width: 1, depth: 1, color: null},
      keychain: {active: false, placement: 'left', holeDiameter: 6, borderWidth: 3, height: 3, mirror: false, color: null, offsetX: 0, offsetY: 0},
      ...options,
    }

    this.font = new Font(fontInterExtraBold)
    this.plateWidth = this.options.base.width
    this.plateHeight = this.options.base.height
    this.baseDepth = this.options.base.depth
    // Коэффициент масштабирования относительно реального знака
    this.s = this.plateWidth / REAL_WIDTH
    // Внутренний отступ от края (учитывает рамку)
    const bw = (this.options.border && this.options.border.active) ? (this.options.border.width || 1) : 0
    this.borderWidth = bw
    // Размер шрифта — основной параметр для расчёта всех размеров
    const fs = this.options.fontSize || 8
    this.digitH = fs
    this.letterH = fs * (58 / 76)
    this.smallH = fs * (20 / 76)
    // Зазоры и отступы пропорциональны размеру шрифта
    this.gap = fs * 0.15       // зазор между группами символов
    this.pad = bw + fs * 0.2   // отступ текста от края/рамки
    this.rpad = bw + fs * 0.1  // отступ в правой секции (регион, RUS, флаг)
  }

  /**
   * Генерирует все меши и возвращает объект {name: mesh}.
   * @returns {Object<string, THREE.Object3D>}
   */
  generate() {
    const meshes = {}

    meshes.base = this.createBasePlate()

    if (this.options.border && this.options.border.active) {
      meshes.border = this.createBorder()
    }

    meshes.separator = this.createSeparator()
    meshes.regNumber = this.createRegistrationNumber()
    meshes.regionCode = this.createRegionCode()
    meshes.rusLabel = this.createRusLabel()

    if (this.options.flagEnabled) {
      meshes.flag = this.createFlag()
    }

    if (this.options.keychain && this.options.keychain.active) {
      meshes.keychain = this.createKeychain()
    }

    return meshes
  }

  // ─── Основа ──────────────────────────────────────────────

  createBasePlate() {
    if (!this.options.base.active) return undefined

    const w = this.plateWidth
    const h = this.plateHeight
    const r = this.options.base.cornerRadius

    const shape = new RectangleRoundedShape({
      x: -w / 2, y: -h / 2, r, w, h,
    })

    const geometry = new THREE.ExtrudeGeometry(shape.create(), {
      steps: 1, depth: this.baseDepth, bevelEnabled: false,
    })

    const baseColor = parseHexColor(this.options.base.color, 0xffffff)
    const material = new THREE.MeshPhongMaterial({color: baseColor})
    const mesh = new THREE.Mesh(geometry, material)
    mesh.updateMatrix()
    return mesh
  }

  // ─── Рамка ───────────────────────────────────────────────

  createBorder() {
    const border = this.options.border
    const w = this.plateWidth
    const h = this.plateHeight
    const r = this.options.base.cornerRadius
    const bw = border.width || 1

    const outerShape = new RectangleRoundedShape({x: -w / 2, y: -h / 2, r, w, h})
    const borderDepth = border.depth || 1
    const outerGeo = new THREE.ExtrudeGeometry(outerShape.create(), {
      steps: 1, depth: borderDepth, bevelEnabled: false,
    })

    const innerR = Math.max(0, r - bw * Math.sin(Math.PI / 4))
    const innerShape = new RectangleRoundedShape({
      x: -(w - bw * 2) / 2,
      y: -(h - bw * 2) / 2,
      r: innerR,
      w: w - bw * 2,
      h: h - bw * 2,
    })
    const innerGeo = new THREE.ExtrudeGeometry(innerShape.create(), {
      steps: 1, depth: borderDepth, bevelEnabled: false,
    })

    const borderColor = parseHexColor(border.color, 0x000000)
    const material = new THREE.MeshPhongMaterial({color: borderColor})
    const outer = new THREE.Mesh(outerGeo, material)
    const inner = new THREE.Mesh(innerGeo, material)

    const frame = this.subtractMesh(outer, inner)
    frame.position.z = this.baseDepth
    frame.updateMatrix()
    return frame
  }

  // ─── Разделительная линия ────────────────────────────────

  createSeparator() {
    const lineW = this.digitH * 0.04
    const lineH = this.plateHeight - this.borderWidth * 2
    const baseZ = this.baseDepth

    const geometry = new THREE.BoxGeometry(lineW, lineH, this.options.textDepth)
    const material = new THREE.MeshPhongMaterial({color: new THREE.Color(this.options.textColor)})
    const mesh = new THREE.Mesh(geometry, material)
    // Позиция разделителя вычисляется от регистрационного номера
    mesh.position.set(
      this._separatorX(),
      0,
      baseZ + this.options.textDepth / 2,
    )
    mesh.updateMatrix()
    return mesh
  }

  /**
   * Вычисляет X-позицию разделителя на основе ширины текста номера.
   */
  _separatorX() {
    const leftX = -this.plateWidth / 2 + this.pad
    const l1 = this._textMesh(cyrToLat(this.options.letter1), this.letterH)
    const l1W = this.getBoundingBoxSize(l1).x
    const dig = this._textMesh(this.options.digits, this.digitH)
    const digW = this.getBoundingBoxSize(dig).x
    const l23 = this._textMesh(cyrToLat(this.options.letter2 + this.options.letter3), this.letterH)
    const l23W = this.getBoundingBoxSize(l23).x
    const textEndX = leftX + l1W + this.gap + digW + this.gap + l23W
    return textEndX + this.gap
  }

  // ─── Регистрационный номер (X 000 XX) ───────────────────

  createRegistrationNumber() {
    const group = new THREE.Group()
    const baseZ = this.baseDepth
    const bottomY = -this.plateHeight / 2 + this.pad

    const leftX = -this.plateWidth / 2 + this.pad

    // Первая буква — прижата к низу
    const l1 = this._textMesh(cyrToLat(this.options.letter1), this.letterH)
    l1.position.set(leftX, bottomY, baseZ)
    group.add(l1)
    const l1W = this.getBoundingBoxSize(l1).x

    // 3 цифры — после первой буквы
    const dig = this._textMesh(this.options.digits, this.digitH)
    const digX = leftX + l1W + this.gap
    dig.position.set(digX, bottomY, baseZ)
    group.add(dig)
    const digW = this.getBoundingBoxSize(dig).x

    // 2 буквы — сразу после цифр
    const l23 = this._textMesh(cyrToLat(this.options.letter2 + this.options.letter3), this.letterH)
    l23.position.set(digX + digW + this.gap, bottomY, baseZ)
    group.add(l23)

    return group
  }

  // ─── Код региона (сверху правой секции) ──────────────────

  createRegionCode() {
    const baseZ = this.baseDepth

    const mesh = this._textMesh(this.options.region, this.letterH)
    const size = this.getBoundingBoxSize(mesh)

    // Центрируем по горизонтали между разделителем и правым краем, прижат к верху
    const sepX = this._separatorX()
    const rightX = this.plateWidth / 2 - this.rpad
    const regionCenterX = (sepX + rightX) / 2
    mesh.position.set(regionCenterX - size.x / 2, this.plateHeight / 2 - size.y - this.rpad, baseZ)

    return mesh
  }

  // ─── Надпись «RUS» (снизу правой секции, левее флага) ───

  createRusLabel() {
    const baseZ = this.baseDepth

    const mesh = this._textMesh('RUS', this.smallH)
    const rusSize = this.getBoundingBoxSize(mesh)

    // Центрируем RUS+флаг в нижней части секции региона
    const sepX = this._separatorX()
    const rightX = this.plateWidth / 2 - this.rpad
    const sectionW = rightX - sepX
    const flagW = this.smallH * 1.5
    const totalW = rusSize.x + this.gap + flagW
    const startX = sepX + (sectionW - totalW) / 2
    mesh.position.set(startX, -this.plateHeight / 2 + this.rpad, baseZ)

    return mesh
  }

  // ─── Флаг РФ (снизу правой секции, правее RUS) ─────────

  createFlag() {
    const group = new THREE.Group()
    const baseZ = this.baseDepth

    const flagH = this.smallH
    const flagW = flagH * 1.5
    const stripeH = flagH / 3

    // Вычисляем позицию флага: правее RUS, по центру секции
    const sepX = this._separatorX()
    const rightX = this.plateWidth / 2 - this.rpad
    const sectionW = rightX - sepX
    const rusMesh = this._textMesh('RUS', this.smallH)
    const rusW = this.getBoundingBoxSize(rusMesh).x
    const totalW = rusW + this.gap + flagW
    const startX = sepX + (sectionW - totalW) / 2
    const flagCenterX = startX + rusW + this.gap + flagW / 2
    const flagBottomY = -this.plateHeight / 2 + this.rpad + flagH / 2

    const colors = [0xffffff, 0x0039A6, 0xD52B1E] // белый, синий, красный

    for (let i = 0; i < 3; i++) {
      const geo = new THREE.BoxGeometry(flagW, stripeH, this.options.textDepth * 0.5)
      const mat = new THREE.MeshPhongMaterial({color: colors[i]})
      const stripe = new THREE.Mesh(geo, mat)
      stripe.position.set(
        flagCenterX,
        flagBottomY + flagH / 2 - stripeH * i - stripeH / 2,
        baseZ + this.options.textDepth * 0.25,
      )
      stripe.updateMatrix()
      group.add(stripe)
    }

    // Тонкая обводка флага
    const borderGeo = new THREE.BoxGeometry(flagW + flagH * 0.06, flagH + flagH * 0.06, this.options.textDepth * 0.3)
    const borderMat = new THREE.MeshPhongMaterial({color: new THREE.Color(this.options.textColor)})
    const border = new THREE.Mesh(borderGeo, borderMat)
    border.position.set(flagCenterX, flagBottomY, baseZ + this.options.textDepth * 0.1)
    border.updateMatrix()
    group.add(border)

    return group
  }

  // ─── Брелок (отверстие) ─────────────────────────────────

  createKeychain() {
    const kc = this.options.keychain
    const holeDiam = kc.holeDiameter
    const bw = kc.borderWidth
    const tabW = holeDiam + bw
    const tabH = holeDiam + bw

    const keychainColor = parseHexColor(kc.color, parseHexColor(this.options.base.color, 0xffffff))

    // Полукруглая «ушка» для брелока
    const shape = new RectangleRoundedCornerShape({
      x: -tabW / 2,
      y: -tabH / 2,
      rA: 0,
      rB: 0,
      rC: tabH / 2,
      rD: tabH / 2,
      w: tabW,
      h: tabH + kc.height,
    })

    const geo = new THREE.ExtrudeGeometry(shape.create(), {
      steps: 1, depth: this.baseDepth, bevelEnabled: false,
    })

    const material = new THREE.MeshPhongMaterial({color: keychainColor})
    let mesh = new THREE.Mesh(geo, material)
    mesh.updateMatrix()

    // Отверстие
    const holeGeo = new THREE.CylinderGeometry(holeDiam / 2, holeDiam / 2, this.baseDepth, 32)
    const holeMesh = new THREE.Mesh(holeGeo, material)
    holeMesh.rotation.x = -Math.PI / 2
    holeMesh.position.set(0, 0, this.baseDepth / 2)
    holeMesh.updateMatrix()

    mesh = this.subtractMesh(mesh, holeMesh)

    // Позиционируем
    let x, y, zR
    const placement = kc.placement || 'left'

    if (placement === 'left') {
      x = -this.plateWidth / 2 - tabW / 2 - kc.height / 2 + bw / 2
      y = 0
      zR = -Math.PI / 2
    } else if (placement === 'top') {
      x = 0
      y = this.plateHeight / 2 + tabW / 2 + kc.height / 2 - bw / 2
      zR = -Math.PI
    } else if (placement === 'topLeft') {
      x = -this.plateWidth / 2 - tabW / 2 + bw * 1.5
      y = this.plateHeight / 2 + tabW / 2 - bw * 1.5
      zR = -Math.PI / 4 + -Math.PI / 2
    } else if (placement === 'topRight') {
      x = this.plateWidth / 2 + tabW / 2 - bw * 1.5
      y = this.plateHeight / 2 + tabW / 2 - bw * 1.5
      zR = Math.PI / 4 + Math.PI / 2
    } else {
      x = -this.plateWidth / 2 - tabW / 2 - kc.height / 2 + bw / 2
      y = 0
      zR = -Math.PI / 2
    }

    mesh.position.set(x + (kc.offsetX || 0), y + (kc.offsetY || 0), 0)
    mesh.rotation.z = zR
    mesh.updateMatrix()

    // Зеркальное отражение
    if (kc.mirror) {
      const mirrorShape = new RectangleRoundedCornerShape({
        x: -tabW / 2,
        y: -tabH / 2,
        rA: 0,
        rB: 0,
        rC: tabH / 2,
        rD: tabH / 2,
        w: tabW,
        h: tabH + kc.height,
      })
      const mirrorGeo = new THREE.ExtrudeGeometry(mirrorShape.create(), {
        steps: 1, depth: this.baseDepth, bevelEnabled: false,
      })
      let mirror = new THREE.Mesh(mirrorGeo, material)
      mirror.updateMatrix()
      mirror = this.subtractMesh(mirror, holeMesh)

      let mx, my, mzR
      if (placement === 'left') {
        mx = -x - (kc.offsetX || 0)
        my = y + (kc.offsetY || 0)
        mzR = zR + Math.PI
      } else if (placement === 'top') {
        mx = x + (kc.offsetX || 0)
        my = -y - (kc.offsetY || 0)
        mzR = zR + Math.PI
      } else {
        mx = -x - (kc.offsetX || 0)
        my = -y - (kc.offsetY || 0)
        mzR = zR + Math.PI
      }

      mirror.position.set(mx, my, 0)
      mirror.rotation.z = mzR
      mirror.updateMatrix()

      mesh = this.unionMesh(mesh, mirror)
    }

    return mesh
  }

  // ─── Вспомогательные ────────────────────────────────────

  _textMesh(text, fontSize) {
    const geometry = new TextGeometry(text, {
      font: this.font,
      size: fontSize,
      depth: this.options.textDepth,
    })
    const material = new THREE.MeshPhongMaterial({
      color: new THREE.Color(this.options.textColor),
    })
    return new THREE.Mesh(geometry, material)
  }
}
