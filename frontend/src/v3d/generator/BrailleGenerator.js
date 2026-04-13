import * as THREE from 'three';
import {Font} from 'three/examples/jsm/loaders/FontLoader';
import {TextGeometry} from 'three/examples/jsm/geometries/TextGeometry';
import fontInterExtraBold from '@/assets/fonts/Inter_ExtraBold.json';
import BaseGenerator from '@/v3d/generator/base';
import {RectangleRoundedShape} from '@/v3d/primitives/shape';
import {AlphabetEn, AlphabetRu} from '@/service/braille/alphabet';

function parseHexColor(hexStr, defaultNum) {
  if (hexStr == null || typeof hexStr !== 'string') return defaultNum
  const hex = hexStr.replace(/^#/, '')
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return defaultNum
  return parseInt(hex, 16)
}

/**
 * Генератор 3D-модели текста шрифтом Брайля.
 * Поддержка 6- и 8-точечного режима, опциональный обычный текст.
 */
export default class BrailleGenerator extends BaseGenerator {
  constructor(options = {}) {
    super()
    this.options = {
      base: {active: true, width: 60, height: 12, depth: 3, cornerRadius: 3, color: null},
      text: 'генератор',
      dotMode: 6,          // 6 или 8 точек
      dotDiameter: 1.5,
      dotHeight: 1,
      dotSpacingX: 2.5,    // расстояние между центрами точек по X (в ячейке)
      dotSpacingY: 2.5,    // расстояние между центрами точек по Y (в ячейке)
      cellSpacing: 6,      // расстояние между центрами ячеек по X
      lineSpacing: 10,     // расстояние между строками
      dotColor: '#000000',
      showPlainText: false,
      plainTextSize: 4,
      plainTextColor: '#000000',
      padding: 4,
      keychain: {active: false, placement: 'left', holeDiameter: 6, borderWidth: 3, height: 3, mirror: false, color: null, offsetX: 0, offsetY: 0},
      ...options,
    }

    this.font = new Font(fontInterExtraBold)
    this.alphabetEn = new AlphabetEn()
    this.alphabetRu = new AlphabetRu()
  }

  generate() {
    const meshes = {}

    meshes.base = this.createBasePlate()
    meshes.braille = this.createBrailleText()

    if (this.options.showPlainText) {
      meshes.plainText = this.createPlainText()
    }

    if (this.options.keychain && this.options.keychain.active) {
      meshes.keychain = this.createKeychain()
    }

    return meshes
  }

  // ─── Основа ──────────────────────────────────────────────

  createBasePlate() {
    if (!this.options.base.active) return undefined

    const w = this.options.base.width
    const h = this.options.base.height
    const r = this.options.base.cornerRadius

    const shape = new RectangleRoundedShape({
      x: -w / 2, y: -h / 2, r, w, h,
    })

    const geometry = new THREE.ExtrudeGeometry(shape.create(), {
      steps: 1, depth: this.options.base.depth, bevelEnabled: false,
    })

    const baseColor = parseHexColor(this.options.base.color, 0xffffff)
    const material = new THREE.MeshPhongMaterial({color: baseColor})
    const mesh = new THREE.Mesh(geometry, material)
    mesh.updateMatrix()
    return mesh
  }

  // ─── Точки Брайля ────────────────────────────────────────

  createBrailleText() {
    const group = new THREE.Group()
    const baseZ = this.options.base.depth
    const dotR = this.options.dotDiameter / 2
    const dotH = this.options.dotHeight
    const sX = this.options.dotSpacingX
    const sY = this.options.dotSpacingY
    const cellSpacing = this.options.cellSpacing
    const dotMode = this.options.dotMode
    const rows = dotMode === 8 ? 4 : 3
    const lineSpacing = this.options.lineSpacing || (sY * rows + 2)

    const dotColor = parseHexColor(this.options.dotColor, 0x000000)
    const material = new THREE.MeshPhongMaterial({color: dotColor})

    const cellW = sX
    const cellH = sY * (rows - 1)

    const lines = this.options.text.split('\n')

    // Вычисляем ширину каждой строки
    const lineWidths = lines.map(line => {
      const upper = line.toUpperCase()
      let chars = 0
      let spaces = 0
      for (const ch of upper) {
        if (ch === ' ') spaces++
        else if (this._getDotsForChar(ch)) chars++
      }
      return chars > 0
        ? (chars - 1) * cellSpacing + cellW + spaces * cellSpacing * 0.6
        : 0
    })

    // Общая высота всех строк
    const totalHeight = lines.length * cellH + (lines.length - 1) * (lineSpacing - cellH)

    // Учёт обычного текста снизу
    const plainTextOffset = this.options.showPlainText ? (this.options.plainTextSize + 2) : 0

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx].toUpperCase()
      const lineW = lineWidths[lineIdx]

      // Центрирование строки по X
      let cursorX = -lineW / 2
      // Центрирование блока строк по Y, первая строка сверху
      const lineY = totalHeight / 2 - lineIdx * lineSpacing - cellH / 2 + plainTextOffset / 2

      for (const ch of line) {
        if (ch === ' ') {
          cursorX += cellSpacing * 0.6
          continue
        }

        const dots = this._getDotsForChar(ch)
        if (!dots) continue

        for (let d = 0; d < dots.length && d < dotMode; d++) {
          if (!dots[d]) continue

          const col = Math.floor(d / rows)
          const row = d % rows

          const x = cursorX + col * sX
          const y = lineY + (rows - 1 - row) * sY - cellH / 2

          const geo = new THREE.CylinderGeometry(dotR, dotR, dotH, 16)
          const dot = new THREE.Mesh(geo, material)
          dot.rotation.x = -Math.PI / 2
          dot.position.set(x, y, baseZ + dotH / 2)
          dot.updateMatrix()
          group.add(dot)
        }

        cursorX += cellSpacing
      }
    }

    return group
  }

  // ─── Обычный текст ───────────────────────────────────────

  createPlainText() {
    const group = new THREE.Group()
    const baseZ = this.options.base.depth
    const fontSize = this.options.plainTextSize
    const dotMode = this.options.dotMode
    const rows = dotMode === 8 ? 4 : 3
    const cellH = this.options.dotSpacingY * (rows - 1)
    const lineSpacing = this.options.lineSpacing || (this.options.dotSpacingY * rows + 2)
    const lines = this.options.text.split('\n')

    // Общая высота блока точек
    const totalBrailleHeight = lines.length * cellH + (lines.length - 1) * (lineSpacing - cellH)

    const textColor = parseHexColor(this.options.plainTextColor, 0x000000)
    const material = new THREE.MeshPhongMaterial({color: textColor})

    // Объединяем все строки в одну для обычного текста
    const plainText = lines.join(' ').toUpperCase()

    const geometry = new TextGeometry(plainText, {
      font: this.font,
      size: fontSize,
      depth: this.options.dotHeight * 0.5,
    })

    const mesh = new THREE.Mesh(geometry, material)
    const size = this.getBoundingBoxSize(mesh)
    const x = -size.x / 2
    const y = -totalBrailleHeight / 2 - fontSize - 1

    mesh.position.set(x, y, baseZ)
    mesh.updateMatrix()
    group.add(mesh)

    return group
  }

  // ─── Брелок ─────────────────────────────────────────────

  createKeychain() {
    // Повторяем логику из GRZGenerator
    const kc = this.options.keychain
    const holeDiam = kc.holeDiameter
    const bw = kc.borderWidth
    const tabW = holeDiam + bw
    const tabH = holeDiam + bw

    const keychainColor = parseHexColor(kc.color, parseHexColor(this.options.base.color, 0xffffff))

    const shape = this.getRoundedRectShape(-tabW / 2, -tabH / 2, tabW, tabH + kc.height, tabH / 2)

    const geo = new THREE.ExtrudeGeometry(shape, {
      steps: 1, depth: this.options.base.depth, bevelEnabled: false,
    })

    const material = new THREE.MeshPhongMaterial({color: keychainColor})
    let mesh = new THREE.Mesh(geo, material)
    mesh.updateMatrix()

    // Отверстие
    const holeGeo = new THREE.CylinderGeometry(holeDiam / 2, holeDiam / 2, this.options.base.depth, 32)
    const holeMesh = new THREE.Mesh(holeGeo, material)
    holeMesh.rotation.x = -Math.PI / 2
    holeMesh.position.set(0, 0, this.options.base.depth / 2)
    holeMesh.updateMatrix()

    mesh = this.subtractMesh(mesh, holeMesh)

    const placement = kc.placement || 'left'
    let x, y, zR

    if (placement === 'left') {
      x = -this.options.base.width / 2 - tabW / 2 - kc.height / 2 + bw / 2
      y = 0
      zR = -Math.PI / 2
    } else if (placement === 'top') {
      x = 0
      y = this.options.base.height / 2 + tabW / 2 + kc.height / 2 - bw / 2
      zR = -Math.PI
    } else {
      x = -this.options.base.width / 2 - tabW / 2 - kc.height / 2 + bw / 2
      y = 0
      zR = -Math.PI / 2
    }

    mesh.position.set(x + (kc.offsetX || 0), y + (kc.offsetY || 0), 0)
    mesh.rotation.z = zR
    mesh.updateMatrix()

    return mesh
  }

  // ─── Вспомогательные ────────────────────────────────────

  _getDotsForChar(char) {
    const upperChar = char.toUpperCase()

    // Поиск в английском алфавите
    const enSymbol = this.alphabetEn.getSymbols().find(s => s.symbol === upperChar)
    if (enSymbol && enSymbol.dots.length > 0) {
      return this._extendDots(enSymbol.dots)
    }

    // Поиск в русском алфавите
    const ruSymbol = this.alphabetRu.getSymbols().find(s => s.symbol === upperChar)
    if (ruSymbol && ruSymbol.dots.length > 0) {
      return this._extendDots(ruSymbol.dots)
    }

    return null
  }

  /**
   * Расширяет 6-точечный массив до 8 (добавляя 0 для точек 7, 8).
   */
  _extendDots(dots) {
    if (dots.length >= 8) return dots
    const result = [...dots]
    while (result.length < 8) {
      result.push(0)
    }
    return result
  }
}
