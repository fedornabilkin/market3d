import * as THREE from 'three';
import {Font} from 'three/examples/jsm/loaders/FontLoader';
import {TextGeometry} from 'three/examples/jsm/geometries/TextGeometry';
import fontInterExtraBold from '@/assets/fonts/Inter_ExtraBold.json';
import BaseGenerator, {parseHexColor} from '@/v3d/generator/base';
import {RectangleRoundedShape} from '@/v3d/primitives/shape';

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
    return this.buildBorderFrame({
      width: this.plateWidth,
      height: this.plateHeight,
      cornerRadius: this.options.base.cornerRadius,
      borderWidth: border.width || 1,
      borderDepth: border.depth || 1,
      baseDepth: this.baseDepth,
      color: border.color,
    })
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
    return this.buildKeychainTab({
      kc: this.options.keychain,
      depth: this.baseDepth,
      plateHalfW: this.plateWidth / 2,
      plateHalfH: this.plateHeight / 2,
      tabShape: 'd',
      plateColor: this.options.base?.color,
    })
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
