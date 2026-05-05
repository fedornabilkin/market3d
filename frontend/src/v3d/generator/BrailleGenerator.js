import * as THREE from 'three';
import {Font} from 'three/examples/jsm/loaders/FontLoader.js';
import {TextGeometry} from 'three/examples/jsm/geometries/TextGeometry.js';
import fontInterExtraBold from '@/assets/fonts/Inter_ExtraBold.json';
import BaseGenerator, {parseHexColor} from '@/v3d/generator/base';
import {RectangleRoundedShape} from '@/v3d/primitives/shape';
import {AlphabetEn, AlphabetRu} from '@/service/braille/alphabet';

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
      dotRounded: false,   // купол сверху (тактильная форма Брайля)
      dotSpacingX: 2.5,    // расстояние между центрами точек по X (в ячейке)
      dotSpacingY: 2.5,    // расстояние между центрами точек по Y (в ячейке)
      cellSpacing: 6,      // расстояние между центрами ячеек по X
      lineSpacing: 10,     // расстояние между строками
      dotColor: '#000000',
      showPlainText: false,
      plainTextSize: 4,
      plainTextColor: '#000000',
      plainTextOffsetX: 0,
      plainTextOffsetY: 0,
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

    // Геометрия точки общая для всех ячеек: позиция отличается, форма — нет.
    // Низ в z=0, верх в z=dotH — позиционируется через mesh.position.z = baseZ.
    const dotGeo = this._createDotGeometry(dotR, dotH, this.options.dotRounded)

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

          const dot = new THREE.Mesh(dotGeo, material)
          dot.position.set(x, y, baseZ)
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
    const offX = this.options.plainTextOffsetX || 0
    const offY = this.options.plainTextOffsetY || 0

    mesh.position.set(x + offX, y + offY, baseZ)
    mesh.updateMatrix()
    group.add(mesh)

    return group
  }

  // ─── Брелок ─────────────────────────────────────────────

  createKeychain() {
    return this.buildKeychainTab({
      kc: this.options.keychain,
      depth: this.options.base.depth,
      plateHalfW: this.options.base.width / 2,
      plateHalfH: this.options.base.height / 2,
      tabShape: 'pill',
      plateColor: this.options.base?.color,
    })
  }

  // ─── Вспомогательные ────────────────────────────────────

  /**
   * Геометрия одной точки Брайля. Низ в z=0, верх в z=dotH.
   *
   * Если `rounded === true` И полусфера вмещается (dotH > dotR) — рисуем
   * как тактильную точку: цилиндр радиуса dotR высотой (dotH - dotR) +
   * полусфера радиуса dotR. Реализовано через LatheGeometry (революция
   * 2D-профиля вокруг оси Y) — замкнутый манифолдный меш одним куском, без CSG.
   *
   * Иначе — обычный плоский цилиндр. Безопасный fallback покрывает случай,
   * когда чекбокс включён, но высота слишком мала для полусферы радиуса dotR.
   */
  _createDotGeometry(dotR, dotH, rounded = false) {
    const useRounded = rounded && dotH > dotR
    let geo
    if (useRounded) {
      const profile = [
        new THREE.Vector2(0, 0),
        new THREE.Vector2(dotR, 0),
      ]
      const cylTopY = dotH - dotR
      if (cylTopY > 1e-4) {
        profile.push(new THREE.Vector2(dotR, cylTopY))
      }
      const domeSegments = 8
      for (let i = 1; i <= domeSegments; i++) {
        const angle = (i / domeSegments) * Math.PI / 2
        profile.push(new THREE.Vector2(
          dotR * Math.cos(angle),
          cylTopY + dotR * Math.sin(angle),
        ))
      }
      geo = new THREE.LatheGeometry(profile, 16)
    } else {
      // CylinderGeometry центрирован вокруг y=0 — сдвигаем низ в y=0
      // чтобы общий контракт «z=0 на плите, z=dotH сверху» работал универсально.
      geo = new THREE.CylinderGeometry(dotR, dotR, dotH, 16)
      geo.translate(0, dotH / 2, 0)
    }
    // Ось вращения LatheGeometry/CylinderGeometry — Y. Поворачиваем геометрию
    // так, чтобы ось стала +Z, а профиль y∈[0,dotH] лёг в z∈[0,dotH].
    geo.rotateX(Math.PI / 2)
    return geo
  }

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
