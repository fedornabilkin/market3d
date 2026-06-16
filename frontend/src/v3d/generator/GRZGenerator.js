import * as THREE from 'three';
import {Font} from 'three/examples/jsm/loaders/FontLoader.js';
import {TextGeometry} from 'three/examples/jsm/geometries/TextGeometry.js';
import fontInterExtraBold from '@/assets/fonts/Inter_ExtraBold.json';
import BaseGenerator, {parseHexColor} from '@/v3d/generator/base';
import {RectangleRoundedShape} from '@/v3d/primitives/shape';

// Пропорции реальных номерных знаков РФ (ГОСТ Р 50577-2018):
//  - standard (Тип 1):   520 × 112 мм
//  - square   (Тип 1А):  290 × 170 мм — для ТС, конструкция которых не
//    предусматривает места под стандартный знак (грузовики, прицепы, импорт)
const PLATE_FORMATS = {
  standard: {width: 520, height: 112},
  square: {width: 290, height: 170},
}

// Шрифт Inter содержит кириллицу, поэтому допустимые буквы знака
// (А, В, Е, К, М, Н, О, Р, С, Т, У, Х) рендерятся как есть. Транслитерация в
// латиницу НЕ применяется: она искажала У → Y (латинская Y — другой глиф,
// чем кириллическая У; остальные 11 букв визуально совпадают, поэтому баг
// был заметен только на У).

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
    this.format = this.options.format === 'square' ? 'square' : 'standard'
    this.plateWidth = this.options.base.width
    this.plateHeight = this.options.base.height
    this.baseDepth = this.options.base.depth
    // Коэффициент масштабирования относительно реального знака выбранного формата
    this.s = this.plateWidth / PLATE_FORMATS[this.format].width
    // Внутренний отступ от края (учитывает рамку)
    const bw = (this.options.border && this.options.border.active) ? (this.options.border.width || 1) : 0
    this.borderWidth = bw
    // Размер шрифта — основной параметр для расчёта всех размеров
    const fs = this.options.fontSize || 8
    this.fs = fs
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

    if (this.format === 'square') {
      meshes.regNumber = this.createRegistrationNumberSquare()
      meshes.regionBox = this.createRegionBoxSquare()
    } else {
      meshes.separator = this.createSeparator()
      meshes.regNumber = this.createRegistrationNumber()
      meshes.regionCode = this.createRegionCode()
      meshes.rusLabel = this.createRusLabel()
      if (this.options.flagEnabled) {
        meshes.flag = this.createFlag()
      }
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
    const l1 = this._textMesh(this.options.letter1, this.letterH)
    const l1W = this.getBoundingBoxSize(l1).x
    const dig = this._textMesh(this.options.digits, this.digitH)
    const digW = this.getBoundingBoxSize(dig).x
    const l23 = this._textMesh(this.options.letter2 + this.options.letter3, this.letterH)
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
    const l1 = this._textMesh(this.options.letter1, this.letterH)
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
    const l23 = this._textMesh(this.options.letter2 + this.options.letter3, this.letterH)
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
    const flagH = this.smallH
    const flagW = flagH * 1.5

    // Вычисляем позицию флага: правее RUS, по центру секции
    const sepX = this._separatorX()
    const rightX = this.plateWidth / 2 - this.rpad
    const sectionW = rightX - sepX
    const rusMesh = this._textMesh('RUS', this.smallH)
    const rusW = this.getBoundingBoxSize(rusMesh).x
    const totalW = rusW + this.gap + flagW
    const startX = sepX + (sectionW - totalW) / 2
    const flagCenterX = startX + rusW + this.gap + flagW / 2
    const flagCenterY = -this.plateHeight / 2 + this.rpad + flagH / 2

    return this._buildFlag(flagCenterX, flagCenterY, flagH)
  }

  /**
   * Строит группу флага РФ (3 полосы + обводка) с центром в (centerX, centerY).
   */
  _buildFlag(centerX, centerY, flagH) {
    const group = new THREE.Group()
    const baseZ = this.baseDepth
    const flagW = flagH * 1.5
    const stripeH = flagH / 3

    const colors = [0xffffff, 0x0039A6, 0xD52B1E] // белый, синий, красный

    for (let i = 0; i < 3; i++) {
      const geo = new THREE.BoxGeometry(flagW, stripeH, this.options.textDepth * 0.5)
      const mat = new THREE.MeshPhongMaterial({color: colors[i]})
      const stripe = new THREE.Mesh(geo, mat)
      stripe.position.set(
        centerX,
        centerY + flagH / 2 - stripeH * i - stripeH / 2,
        baseZ + this.options.textDepth * 0.25,
      )
      stripe.updateMatrix()
      group.add(stripe)
    }

    // Тонкая обводка флага
    const borderGeo = new THREE.BoxGeometry(flagW + flagH * 0.06, flagH + flagH * 0.06, this.options.textDepth * 0.3)
    const borderMat = new THREE.MeshPhongMaterial({color: new THREE.Color(this.options.textColor)})
    const border = new THREE.Mesh(borderGeo, borderMat)
    border.position.set(centerX, centerY, baseZ + this.options.textDepth * 0.1)
    border.updateMatrix()
    group.add(border)

    return group
  }

  // ─── Квадратный формат (Тип 1А, 290×170): две строки ─────
  //
  // Раскладка (по ГОСТ Р 50577-2018, Тип 1А):
  //   ┌──────────────────────────┐
  //   │  Х 001                    │  ← 1-я буква + 3 цифры, слева сверху
  //   │  Е Р        ┌──── 35 ────┐│  ← 2 последние буквы слева; справа —
  //   │             └─ RUS ▭ ────┘│    бокс: регион сверху, RUS+флаг снизу
  //   └──────────────────────────┘

  /**
   * Метрики region-бокса (правый нижний угол). Выделено отдельно, чтобы и
   * верхняя строка номера (выровнять цифры по центру бокса), и сам бокс
   * считали одни и те же координаты. Создаёт меши region/RUS для измерения и
   * переиспользования.
   */
  _regionBoxRect() {
    const fs = this.fs
    const pbox = fs * 0.18
    const ft = Math.max(0.5, fs * 0.09)
    const midGap = fs * 0.2
    const botPad = fs * 0.08 // маленький нижний отступ → RUS+флаг ниже

    const regionH = fs * 0.6
    const region = this._textMesh(this.options.region, regionH)
    const regionSize = this.getBoundingBoxSize(region)

    const rus = this._textMesh('RUS', fs * 0.26)
    const rusSize = this.getBoundingBoxSize(rus)

    const withFlag = !!this.options.flagEnabled
    const flagH = fs * 0.28
    const flagW = flagH * 1.5
    const rusRowW = withFlag ? rusSize.x + this.gap + flagW : rusSize.x
    const rusRowH = withFlag ? Math.max(rusSize.y, flagH) : rusSize.y

    const contentW = Math.max(regionSize.x, rusRowW)
    const Wb = contentW + 2 * pbox
    const Hb = pbox + regionH + midGap + rusRowH + botPad

    // Прижат к внутренней кромке окантовки в правом-нижнем углу
    const hasBorder = !!(this.options.border && this.options.border.active)
    const edge = hasBorder ? this.borderWidth : ft
    const boxRight = this.plateWidth / 2 - edge
    const boxBottom = -this.plateHeight / 2 + edge
    const boxLeft = boxRight - Wb
    const boxTop = boxBottom + Hb
    const bcx = boxRight - Wb / 2
    const bcy = boxBottom + Hb / 2

    return {
      pbox, ft, regionH, botPad, region, regionSize, rus, rusSize,
      withFlag, flagH, flagW, rusRowW, rusRowH, Wb, Hb,
      hasBorder, boxLeft, boxRight, boxTop, boxBottom, bcx, bcy,
    }
  }

  /**
   * Верхняя строка (1-я буква + 3 цифры) и нижняя строка слева (2 буквы).
   * Буквы X и Е выровнены по левому краю; буквы и цифры одной высоты.
   */
  createRegistrationNumberSquare() {
    const group = new THREE.Group()
    const baseZ = this.baseDepth
    const charH = this.digitH // буквы и цифры одинаковой высоты
    const box = this._regionBoxRect()

    // Левый отступ первой буквы + увеличенный пробел до цифр
    const leftStartX = -this.plateWidth / 2 + this.pad + this.fs * 0.45
    const letterGap = this.fs * 0.4
    // Верхняя строка чуть ниже верхнего края
    const topBottomY = this.plateHeight / 2 - this.pad - charH - this.fs * 0.3

    const l1 = this._textMesh(this.options.letter1, charH)
    const l1W = this.getBoundingBoxSize(l1).x
    const dig = this._textMesh(this.options.digits, charH)
    const digW = this.getBoundingBoxSize(dig).x
    // Цифры заканчиваются по центру region-бокса (bcx); не наезжают на букву
    const digX = Math.max(box.bcx - digW, leftStartX + l1W + letterGap)

    l1.position.set(leftStartX, topBottomY, baseZ)
    group.add(l1)
    dig.position.set(digX, topBottomY, baseZ)
    group.add(dig)

    // Низ слева: две последние буквы — ещё левее верхней строки;
    // по вертикали — по центру region-бокса
    const botLeftX = -this.plateWidth / 2 + this.pad + this.fs * 0.15
    const l23 = this._textMesh(this.options.letter2 + this.options.letter3, charH)
    l23.position.set(botLeftX, box.bcy - charH / 2, baseZ)
    group.add(l23)

    return group
  }

  /**
   * Бокс региона (справа снизу): рамка + код региона сверху, RUS + флаг снизу.
   * Рисуются только верхняя и левая стороны (правая и нижняя = окантовка знака);
   * без окантовки — все четыре. Флаг включается опцией flagEnabled.
   */
  createRegionBoxSquare() {
    const group = new THREE.Group()
    const baseZ = this.baseDepth
    const {
      ft, pbox, regionH, botPad, region, regionSize, rus, rusSize,
      withFlag, flagH, flagW, rusRowW, rusRowH, Wb, Hb,
      hasBorder, boxLeft, boxRight, boxTop, boxBottom, bcx, bcy,
    } = this._regionBoxRect()

    // Верхнюю и левую стороны удлиняем на ft, чтобы левый-верхний угол смыкался.
    group.add(this._lineBox(Wb + ft, ft, bcx, boxTop))   // верхняя
    group.add(this._lineBox(ft, Hb + ft, boxLeft, bcy))  // левая
    if (!hasBorder) {
      group.add(this._lineBox(Wb + ft, ft, bcx, boxBottom)) // нижняя
      group.add(this._lineBox(ft, Hb + ft, boxRight, bcy))  // правая
    }

    // Регион (верх бокса)
    const regionCenterY = boxTop - pbox - regionH / 2
    region.position.set(bcx - regionSize.x / 2, regionCenterY - regionSize.y / 2, baseZ)
    group.add(region)

    // RUS + флаг (низ бокса, ближе к нижней границе)
    const rusCenterY = boxBottom + botPad + rusRowH / 2
    const rowStartX = bcx - rusRowW / 2
    rus.position.set(rowStartX, rusCenterY - rusSize.y / 2, baseZ)
    group.add(rus)
    if (withFlag) {
      const flagCenterX = rowStartX + rusSize.x + this.gap + flagW / 2
      group.add(this._buildFlag(flagCenterX, rusCenterY, flagH))
    }

    return group
  }

  /** Приподнятый прямоугольный брусок (линия рамки/разделителя) цветом текста. */
  _lineBox(w, h, cx, cy) {
    const geo = new THREE.BoxGeometry(w, h, this.options.textDepth)
    const mat = new THREE.MeshPhongMaterial({color: new THREE.Color(this.options.textColor)})
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(cx, cy, this.baseDepth + this.options.textDepth / 2)
    mesh.updateMatrix()
    return mesh
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
