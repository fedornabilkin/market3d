import {DefaultEntity} from "@/entity/entity";


export class Entity extends DefaultEntity{
  active = false
  offsetX = 0
  offsetY = 0
  offsetZ = 0
  /** Optional entity color (hex string #rrggbb). If null/undefined, generator uses default. */
  color = null
  depth = undefined
  width = undefined
  height = undefined

  constructor(config = {}) {
    super(config)
    Object.assign(this, config)
  }

  change() {
    console.log(this)
  }
}

export class Base extends Entity {
  shape = 'roundedRectangle'
  width = 55
  height = 70
  depth = 3
  cornerRadius = 5

  constructor(config = {}) {
    super(config)
    Object.assign(this, config)
  }
}

export class Border extends Entity {
  width = 1
  depth = 1

  constructor(config = {}) {
    super(config)
    Object.assign(this, config)
  }
}

export class Code extends Entity {
  depth = 1
  margin = 2
  cityMode = false
  depthMax = 2
  errorCorrectionLevel = 'M'
  emptyCenter = true
  invert = false
  block = {
    ratio: 100,
    cityMode: false,
    depth: 2,
    shape: 'classic',
  }
  preview = {
    src: undefined,
    htmlId: 'qr-image-preview'
  }

  constructor(config = {}) {
    super(config)
    Object.assign(this, config)
  }

  clearPreview() {
    this.preview.src = undefined
  }

  eventActive() {
    if (!this.active) {
      this.clearPreview()
    }
  }

  toJSON() {
    const json = JSON.parse(JSON.stringify(Object.assign({}, this), null, 0))
    json.preview.src = ''
    return json
  }
}

export class Text extends Entity {
  message = 'VSQR.RU'
  placement = 'center'
  align = 'center'
  margin = 1
  size = 8
  height = 10
  depth = 1

  constructor(config = {}) {
    super(config)
    Object.assign(this, config)
  }
}

export class Icon extends Entity {
  name = 'none'
  ratio = 20
  inverted = false
  data = undefined
  src = undefined
  srcCustom = undefined
  htmlId = 'icon-preview'
  temp = {
    src: undefined,
    srcCustom: undefined
  }

  constructor(config = {}) {
    super(config)
    Object.assign(this, config)
  }

  isNoneName() {
    return this.name === 'none'
  }

  setSrc(src) {
    this.src = src
  }

  setSrcCustom(src) {
    this.srcCustom = src
  }

  clearSrc() {
    this.temp.src = this.src ? this.src : this.temp.src
    this.src = undefined
  }

  clearSrcCustom() {
    this.temp.srcCustom = this.srcCustom ? this.srcCustom : this.temp.srcCustom
    this.srcCustom = undefined
  }

  restoreSource() {
    this.setSrc(this.temp.src)
    this.setSrcCustom(this.temp.srcCustom)
  }

  clearSource() {
    this.name = 'none'
    this.clearSrc()
    this.clearSrcCustom()
  }

  eventActive() {
    if (!this.active) {
      this.clearSource()
    }
    if (this.active) {
      this.restoreSource()
    }
  }

  toJSON() {
    let json = this
    if (this.isNoneName()) {
      json.src = ''
    } else {
      json.srcCustom = ''
    }
    json.temp = {}
    return json
  }
}

export class Keychain extends Entity {
  placement = 'left'
  holeDiameter = 6
  borderWidth = 3
  height = 3
  mirror = false

  constructor(config = {}) {
    super(config)
    Object.assign(this, config)
  }
}

export class CoasterRings extends Entity {
  count = 3
  ringWidth = 1
  spacing = 3
  startRadius = 15
  depth = 1

  constructor(config = {}) {
    super(config)
    Object.assign(this, config)
  }
}

export class Magnet extends Entity {
  shape =  'round'
  size =  10
  depth =  1
  count = 1
  gap = 1
  hidden =  false

  constructor(config = {}) {
    super(config)
    Object.assign(this, config)
    this.offsetZ = 0.6
  }

  /**
   * Вычисляет раскладку отверстий на базе заданного размера.
   * Отверстия распределяются по сетке до 3 рядов вдоль короткой стороны.
   * Параметр gap задаёт минимальное расстояние между краями соседних отверстий.
   * @param {number} baseWidth
   * @param {number} baseHeight
   * @param {number} holeSize
   * @param {number} [gap=0]
   * @returns {{maxCols: number, maxRows: number, maxTotal: number}}
   */
  static computeLayout(baseWidth, baseHeight, holeSize, gap = 0) {
    if (!holeSize || holeSize <= 0) return {maxCols: 0, maxRows: 0, maxTotal: 0}
    const g = Math.max(0, gap || 0)
    const longSide = Math.max(baseWidth, baseHeight)
    const shortSide = Math.min(baseWidth, baseHeight)
    // Равномерная раскладка сегментами: distance(centers) = side/N ≥ size + gap → N ≤ side/(size+gap).
    // Для единственного отверстия gap не применяется — достаточно, чтобы сторона ≥ size.
    const maxCols = longSide >= holeSize ? Math.max(1, Math.floor(longSide / (holeSize + g))) : 0
    const maxRowsRaw = shortSide >= holeSize ? Math.max(1, Math.floor(shortSide / (holeSize + g))) : 0
    const maxRows = Math.min(3, maxRowsRaw)
    return {maxCols, maxRows, maxTotal: maxCols * maxRows}
  }
}
