<script>
import { markRaw } from 'vue'
import * as THREE from 'three'
import { V3DFacade } from '@/v3d/V3DFacade'
import GRZGenerator from '@/v3d/generator/GRZGenerator'
import BrailleGenerator from '@/v3d/generator/BrailleGenerator'
import CoasterGenerator from '@/v3d/generator/CoasterGenerator'
import NameTagGenerator from '@/v3d/generator/NameTagGenerator'
import qrcode from 'qrcode'

const QR_CONFIG = {
  base: {
    active: true, offsetX: 0, offsetY: 0, offsetZ: 0,
    color: null, depth: 3, width: 55, height: 70,
    shape: 'roundedRectangle', cornerRadius: 5,
  },
  border: { active: true, offsetX: 0, offsetY: 0, offsetZ: 0, color: null, depth: 1, width: 1 },
  code: {
    active: true, offsetX: 0, offsetY: 0, offsetZ: 0, color: null,
    depth: 1, margin: 2, cityMode: false, depthMax: 2,
    errorCorrectionLevel: 'H', emptyCenter: true, invert: false,
    block: { ratio: 100, cityMode: false, depth: 2, shape: 'classic' },
    preview: { src: '', htmlId: 'qr-image-preview-example' },
  },
  text: {
    active: true, offsetX: 0, offsetY: 0, offsetZ: 0, color: null,
    depth: 1, height: 10, message: 'VSQR.RU',
    placement: 'center', align: 'center', margin: 1, size: 8,
  },
  icon: {
    name: 'check', active: true, offsetX: 0, offsetY: 0, offsetZ: 0,
    color: null, ratio: 20, inverted: false,
    src: '<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" data-prefix="fas" data-icon="check" class="svg-inline--fa fa-check fa-w-16" role="img" viewBox="0 0 512 512"><path fill="currentColor" d="M173.898 439.404l-166.4-166.4c-9.997-9.997-9.997-26.206 0-36.204l36.203-36.204c9.997-9.998 26.207-9.998 36.204 0L192 312.69 432.095 72.596c9.997-9.997 26.207-9.997 36.204 0l36.203 36.204c9.997 9.997 9.997 26.206 0 36.204l-294.4 294.401c-9.998 9.997-26.207 9.997-36.204-.001z"/></svg>',
    srcCustom: '', htmlId: 'icon-preview-example', temp: {},
  },
  keychain: {
    active: true, offsetX: 0, offsetY: 0, offsetZ: 0,
    color: null, height: 3, placement: 'top', holeDiameter: 10, borderWidth: 6, mirror: false,
  },
  magnet: { active: false, offsetX: 0, offsetY: 0, offsetZ: 0.6, color: null, depth: 1, shape: 'round', size: 10, count: 1, gap: 1, hidden: false },
  content: 'vsqr.ru',
  wifi: { ssid: '', password: '', security: 'WPA', hidden: false },
  email: { recipient: '', subject: '', body: '' },
  contact: { firstName: '', lastName: '', organization: '', role: '', cell: '', phone: '', fax: '', email: '', street: '', postcode: '', city: '', state: '', country: '', website: '' },
  sms: { recipient: '', message: '' },
  activeTabIndex: 0,
}

const KEY_CONFIG = {
  base: { active: true, offsetX: 0, offsetY: 0, offsetZ: 0, color: null, depth: 3, width: 70, height: 18, shape: 'roundedRectangle', cornerRadius: 5 },
  border: { active: true, offsetX: 0, offsetY: 0, offsetZ: 0, color: null, depth: 1, width: 1 },
  code: { active: false, offsetX: 0, offsetY: 0, offsetZ: 0, color: null, depth: 1, margin: 2, cityMode: false, depthMax: 2, errorCorrectionLevel: 'H', emptyCenter: true, invert: false, block: { ratio: 100, cityMode: false, depth: 2, shape: 'classic' }, preview: { htmlId: 'qr-image-preview-example', src: '' } },
  text: { active: true, offsetX: 6, offsetY: 0, offsetZ: 0, color: null, depth: 1, height: 10, message: 'VSQR.RU', placement: 'center', align: 'center', margin: 1, size: 8 },
  icon: {
    name: 'heart', active: true, offsetX: -26, offsetY: 0.5, offsetZ: 0,
    color: null, ratio: 16, inverted: false,
    src: '<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" data-prefix="fas" data-icon="heart" class="svg-inline--fa fa-heart fa-w-16" role="img" viewBox="0 0 512 512"><path fill="currentColor" d="M462.3 62.6C407.5 15.9 326 24.3 275.7 76.2L256 96.5l-19.7-20.3C186.1 24.3 104.5 15.9 49.7 62.6c-62.8 53.6-66.1 149.8-9.9 207.9l193.5 199.8c12.5 12.9 32.8 12.9 45.3 0l193.5-199.8c56.3-58.1 53-154.3-9.8-207.9z"/></svg>',
    srcCustom: '', htmlId: 'icon-preview-example', temp: {},
  },
  keychain: { active: true, offsetX: 0, offsetY: 0, offsetZ: 0, color: null, height: 3, placement: 'left', holeDiameter: 8, borderWidth: 5, mirror: false },
  magnet: { active: false, offsetX: 0, offsetY: 0, offsetZ: 0.6, color: null, depth: 1, shape: 'round', size: 10, count: 1, gap: 1, hidden: false },
  content: 'vsqr.ru',
  wifi: { ssid: '', password: '', security: 'WPA', hidden: false },
  email: { recipient: '', subject: '', body: '' },
  contact: { firstName: '', lastName: '', organization: '', role: '', cell: '', phone: '', fax: '', email: '', street: '', postcode: '', city: '', state: '', country: '', website: '' },
  sms: { recipient: '', message: '' },
  activeTabIndex: 0,
}

const GRZ_CONFIG = {
  base: { active: true, width: 60, height: 14, depth: 2, cornerRadius: 3, offsetX: 0, offsetY: 0, offsetZ: 0, color: null, shape: 'roundedRectangle' },
  fontSize: 8,
  textDepth: 1,
  letter1: 'А',
  digits: '001',
  letter2: 'А',
  letter3: 'А',
  region: '77',
  textColor: '#000000',
  flagEnabled: true,
  border: { active: true, offsetX: 0, offsetY: 0, offsetZ: 0, color: null, depth: 1, width: 1 },
  keychain: { active: true, offsetX: 0, offsetY: 0, offsetZ: 0, color: null, height: 3, placement: 'left', holeDiameter: 6, borderWidth: 3, mirror: false },
}

const BRAILLE_CONFIG = {
  base: { active: true, width: 31, height: 18, depth: 3, cornerRadius: 3, offsetX: 0, offsetY: 0, offsetZ: 0, color: null, shape: 'roundedRectangle' },
  text: 'vsqr',
  dotMode: 6,
  dotDiameter: 1.5,
  dotHeight: 1,
  dotSpacingX: 2.5,
  dotSpacingY: 2.5,
  cellSpacing: 6,
  lineSpacing: 10,
  dotColor: '#000000',
  showPlainText: true,
  plainTextSize: 4,
  plainTextColor: '#000000',
  padding: 4,
  keychain: { active: true, offsetX: 0, offsetY: 0, offsetZ: 0, color: null, height: 3, placement: 'topRight', holeDiameter: 6, borderWidth: 3, mirror: false },
}

const COASTER_CONFIG = {
  base: { active: true, width: 90, height: 90, depth: 3, cornerRadius: 5, shape: 'circle', segments: 64, offsetX: 0, offsetY: 0, offsetZ: 0, color: null },
  text: {
    active: true, message: 'подставка для кружки', size: 6, depth: 1, mode: 'circular',
    circularRadius: 35, color: '#000000', offsetX: 0, offsetY: 0, offsetZ: 0,
    height: 10, placement: 'center', align: 'center', margin: 1,
  },
  icon: {
    active: true, name: 'home', ratio: 20, offsetX: 0, offsetY: 0, offsetZ: 0,
    color: null, inverted: false,
    src: '<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" data-prefix="fas" data-icon="home" class="svg-inline--fa fa-home fa-w-18" role="img" viewBox="0 0 576 512"><path fill="currentColor" d="M280.37 148.26L96 300.11V464a16 16 0 0 0 16 16l112.06-.29a16 16 0 0 0 15.92-16V368a16 16 0 0 1 16-16h64a16 16 0 0 1 16 16v95.64a16 16 0 0 0 16 16.05L464 480a16 16 0 0 0 16-16V300L295.67 148.26a12.19 12.19 0 0 0-15.3 0zM571.6 251.47L488 182.56V44.05a12 12 0 0 0-12-12h-56a12 12 0 0 0-12 12v72.61L318.47 43a48 48 0 0 0-61 0L4.34 251.47a12 12 0 0 0-1.6 16.9l25.5 31A12 12 0 0 0 45.15 301l235.22-193.74a12.19 12.19 0 0 1 15.3 0L530.9 301a12 12 0 0 0 16.9-1.6l25.5-31a12 12 0 0 0-1.7-16.93z"/></svg>',
    srcCustom: '', htmlId: 'icon-preview-example', temp: {},
  },
  rings: { active: true, count: 4, ringWidth: 1.5, spacing: 3, startRadius: 15, offsetX: 0, offsetY: 0, offsetZ: 0, color: null, depth: 1 },
  code: { active: false },
  keychain: { active: false, offsetX: 0, offsetY: 0, offsetZ: 0, color: null, height: 3, placement: 'top', holeDiameter: 6, borderWidth: 3, mirror: false },
}

const NAMETAG_CONFIG = {
  active: true,
  color: null, depth: 2, message: 'VSQR',
  fontName: 'Inter_ExtraBold',
  customFontData: null, customFontName: null,
  size: 18, letterSpacing: 1.2,
  backing: { active: true, padding: 4, depth: 2, color: '#ffffff', curveSegments: 6 },
  bevel: { active: true, size: 0.3, thickness: 0.3, segments: 3 },
  hollow: { active: false, wallThickness: 0.8, floorThickness: 0.6 },
  randomHeight: { active: true, variance: 0.35, seed: 42 },
  keychain: { active: true, placement: 'topLeft', holeDiameter: 6, borderWidth: 5, height: 6, color: null, offsetX: -2, offsetY: 3 },
}

const PHASES = [
  {
    kind: 'qr', config: QR_CONFIG, qrText: 'vsqr.ru',
    dropAxis: 'y',
    dropKeys: ['qr', 'icon', 'text', 'border', 'keychain'],
    cam: { pitch: 0, yaw: 0, radius: 130 },
    flair: {},
  },
  {
    kind: 'key', config: KEY_CONFIG, qrText: null,
    dropAxis: 'z',
    dropKeys: ['icon', 'text', 'border', 'keychain'],
    cam: { pitch: 35, yaw: -15, radius: 115 },
    flair: { meshSpin: { keys: ['icon'], axis: 'z', turns: 1 } },
  },
  {
    kind: 'grz', config: GRZ_CONFIG,
    dropAxis: 'y',
    dropKeys: ['separator', 'regNumber', 'regionCode', 'rusLabel', 'flag', 'border', 'keychain'],
    cam: { pitch: 18, yaw: 22, radius: 100 },
    flair: { meshSpin: { keys: ['flag'], axis: 'y', turns: 0.5 } },
  },
  {
    kind: 'braille', config: BRAILLE_CONFIG,
    dropAxis: 'z',
    dropKeys: ['braille', 'plainText', 'keychain'],
    cam: { pitch: 50, yaw: 0, radius: 60 },
    flair: { rootSpin: { axis: 'z', turns: 0.25 } },
  },
  {
    kind: 'coaster', config: COASTER_CONFIG,
    dropAxis: 'z',
    dropKeys: ['rings', 'text', 'icon'],
    cam: { pitch: 28, yaw: -28, radius: 180 },
    flair: { rootSpin: { axis: 'z', turns: 0.5 } },
  },
  {
    kind: 'nametag', config: NAMETAG_CONFIG,
    dropAxis: 'z',
    dropKeys: ['letters', 'keychain'],
    cam: { pitch: 42, yaw: 28, radius: 140 },
    flair: { meshSpin: { keys: ['letters'], axis: 'z', turns: 1 } },
  },
]

const DROP_HEIGHT = 60
const DROP_DURATION = 520
const DROP_STAGGER = 380
const HOLD_AFTER_DROP = 2400
const HIDE_DURATION = 500
const HIDE_STAGGER = 90
const HIDE_DISTANCE = 140
const CAM_TRANSITION = 1000
const PAUSE_BETWEEN = 220

function easeOutBounce(x) {
  const n1 = 7.5625
  const d1 = 2.75
  if (x < 1 / d1) return n1 * x * x
  if (x < 2 / d1) { x -= 1.5 / d1; return n1 * x * x + 0.75 }
  if (x < 2.5 / d1) { x -= 2.25 / d1; return n1 * x * x + 0.9375 }
  x -= 2.625 / d1
  return n1 * x * x + 0.984375
}
function easeInCubic(x) { return x * x * x }
function easeInOutCubic(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2 }

export default {
  name: 'AnimationScene',
  data() {
    return {
      v3dFacade: markRaw(new V3DFacade({ debug: false })),
      rafId: null,
      ready: false,
      failed: false,
    }
  },
  async mounted() {
    try {
      await this.$nextTick()
      const container = this.$refs.container
      if (!container) return
      this.v3dFacade.initialize(container)
      const box = this.v3dFacade.getBox()
      if (box.controls) {
        box.controls.enabled = false
        box.controls.enableDamping = false
      }

      this._running = true
      this._tasks = []
      this._camState = null
      this._onResize = this.onResize.bind(this)
      window.addEventListener('resize', this._onResize)

      this.startRenderLoop()
      this.ready = true
      this.runSequence()
    } catch (e) {
      console.error('AnimationScene init failed:', e)
      this.failed = true
    }
  },
  beforeUnmount() {
    this._running = false
    if (this._onResize) window.removeEventListener('resize', this._onResize)
    if (this.rafId) cancelAnimationFrame(this.rafId)
    if (this._tasks) this._tasks.forEach(t => t.resolve && t.resolve())
    if (this._sleepTimer) clearTimeout(this._sleepTimer)
  },
  methods: {
    onResize() {
      const c = this.$refs.container
      if (!c) return
      this.v3dFacade.setSize(c.clientWidth, c.clientHeight)
    },
    startRenderLoop() {
      const tick = (t) => {
        if (!this._running) return
        this.updateTasks(t)
        this.updateCamera(t)
        this.v3dFacade.render()
        this.rafId = requestAnimationFrame(tick)
      }
      this.rafId = requestAnimationFrame(tick)
    },
    updateTasks(t) {
      if (!this._tasks.length) return
      const still = []
      for (const task of this._tasks) {
        const keep = task.step(t)
        if (keep) still.push(task)
        else task.resolve()
      }
      this._tasks = still
    },
    updateCamera(t) {
      const cs = this._camState
      if (!cs) return
      const u = Math.min(1, (t - cs.startTime) / cs.duration)
      const e = easeInOutCubic(u)
      const pitch = cs.fromPitch + (cs.toPitch - cs.fromPitch) * e
      const yaw = cs.fromYaw + (cs.toYaw - cs.fromYaw) * e
      const radius = cs.fromRadius + (cs.toRadius - cs.fromRadius) * e
      this.setCameraOrbit(pitch, yaw, radius)
    },
    setCameraOrbit(pitchDeg, yawDeg, radius) {
      const box = this.v3dFacade.getBox()
      if (!box || !box.camera) return
      const p = (pitchDeg * Math.PI) / 180
      const y = (yawDeg * Math.PI) / 180
      const tx = this._modelCenter ? this._modelCenter.x : 0
      const ty = this._modelCenter ? this._modelCenter.y : 0
      const tz = this._modelCenter ? this._modelCenter.z : 0
      box.camera.position.set(
        tx + radius * Math.cos(p) * Math.sin(y),
        ty - radius * Math.sin(p),
        tz + radius * Math.cos(p) * Math.cos(y),
      )
      box.camera.lookAt(tx, ty, tz)
      if (box.controls) {
        box.controls.target.set(tx, ty, tz)
      }
    },
    startCameraTo(target, duration) {
      const from = this._camState
        ? { p: this._camState.toPitch, y: this._camState.toYaw, r: this._camState.toRadius }
        : { p: 0, y: 0, r: 300 }
      this._camState = {
        fromPitch: from.p, fromYaw: from.y, fromRadius: from.r,
        toPitch: target.pitch, toYaw: target.yaw, toRadius: target.radius,
        startTime: performance.now(), duration,
      }
    },
    setCameraImmediate(target) {
      this._camState = {
        fromPitch: target.pitch, fromYaw: target.yaw, fromRadius: target.radius,
        toPitch: target.pitch, toYaw: target.yaw, toRadius: target.radius,
        startTime: performance.now(), duration: 1,
      }
      this.setCameraOrbit(target.pitch, target.yaw, target.radius)
    },
    finalizePlacement() {
      const box = this.v3dFacade.getBox()
      const root = box.sceneGraphRoot
      if (!root) return
      root.position.set(0, 0, 0)
      root.rotation.set(0, 0, 0)
      root.updateMatrixWorld(true)
      const bbox = new THREE.Box3().setFromObject(root)
      if (!isFinite(bbox.min.x) || bbox.isEmpty()) return
      root.position.set(-bbox.min.x, -bbox.min.y, -bbox.min.z)
      root.updateMatrixWorld(true)
      const shifted = new THREE.Box3().setFromObject(root)
      this._modelCenter = shifted.getCenter(new THREE.Vector3())
      if (this._camState) {
        const cs = this._camState
        this.setCameraOrbit(cs.toPitch, cs.toYaw, cs.toRadius)
      }
    },
    async runSequence() {
      this.setCameraImmediate(PHASES[0].cam)
      let idx = 0
      let prev = null
      while (this._running) {
        const phase = PHASES[idx]
        if (prev) {
          this.startCameraTo(phase.cam, CAM_TRANSITION)
          await this.hideMeshes(prev)
          if (!this._running) break
          await this.sleep(PAUSE_BETWEEN)
          if (!this._running) break
        }
        await this.buildPhase(phase)
        if (!this._running) break
        await this.dropPhase(phase)
        if (!this._running) break
        await this.holdPhase(phase)
        if (!this._running) break
        prev = phase
        idx = (idx + 1) % PHASES.length
      }
    },
    async buildPhase(phase) {
      const cfg = JSON.parse(JSON.stringify(phase.config))
      if (phase.kind === 'qr' || phase.kind === 'key') {
        if (phase.qrText) {
          const q = qrcode.create(phase.qrText, { errorCorrectionLevel: phase.config.code.errorCorrectionLevel })
          this.v3dFacade.setQRCodeBitMask(q.modules.data)
        } else {
          this.v3dFacade.qrCodeBitMask = null
        }
        await this.v3dFacade.generateModel(cfg)
      } else {
        const box = this.v3dFacade.getBox()
        box.clear()
        let gen
        if (phase.kind === 'grz') gen = new GRZGenerator(cfg)
        else if (phase.kind === 'braille') gen = new BrailleGenerator(cfg)
        else if (phase.kind === 'coaster') gen = new CoasterGenerator(cfg)
        else if (phase.kind === 'nametag') gen = new NameTagGenerator(cfg)
        else return
        const meshes = gen.generate()
        for (const [name, m] of Object.entries(meshes)) {
          if (m) box.addNode(name, markRaw(m))
        }
      }
      this.finalizePlacement()
    },
    dropPhase(phase) {
      return new Promise((resolve) => {
        const nodes = this.v3dFacade.getBox().getNodes()
        const order = phase.dropKeys.filter(k => !!nodes[k])
        const axis = phase.dropAxis
        const origP = {}
        const origRot = {}
        for (const k of order) {
          const n = nodes[k]
          origP[k] = n.position[axis]
          n.visible = false
          n.position[axis] = origP[k] + DROP_HEIGHT
        }
        const spin = phase.flair && phase.flair.meshSpin
        if (spin) {
          for (const k of spin.keys) {
            if (nodes[k]) origRot[k] = nodes[k].rotation[spin.axis]
          }
        }
        const startTime = performance.now()
        this._tasks.push({
          step: (t) => {
            let allDone = true
            order.forEach((k, i) => {
              const n = nodes[k]
              const s = startTime + i * DROP_STAGGER
              if (t < s) { allDone = false; return }
              n.visible = true
              const u = Math.min(1, (t - s) / DROP_DURATION)
              if (u < 1) allDone = false
              const e = easeOutBounce(u)
              n.position[axis] = origP[k] + DROP_HEIGHT * (1 - e)
              if (spin && spin.keys.includes(k)) {
                n.rotation[spin.axis] = origRot[k] + (1 - u) * spin.turns * Math.PI * 2
              }
            })
            return !allDone
          },
          resolve,
        })
      })
    },
    holdPhase(phase) {
      return new Promise((resolve) => {
        const box = this.v3dFacade.getBox()
        const root = box.sceneGraphRoot
        const rootSpin = phase.flair && phase.flair.rootSpin
        const origRootRot = rootSpin ? root.rotation[rootSpin.axis] : 0
        const startTime = performance.now()
        this._tasks.push({
          step: (t) => {
            const dt = t - startTime
            if (rootSpin) {
              const u = Math.min(1, dt / HOLD_AFTER_DROP)
              root.rotation[rootSpin.axis] = origRootRot + u * rootSpin.turns * Math.PI * 2
            }
            return dt < HOLD_AFTER_DROP
          },
          resolve,
        })
      })
    },
    hideMeshes(phase) {
      return new Promise((resolve) => {
        const nodes = this.v3dFacade.getBox().getNodes()
        const order = phase.dropKeys.filter(k => !!nodes[k])
        const axis = phase.dropAxis
        const origP = {}
        for (const k of order) origP[k] = nodes[k].position[axis]
        const startTime = performance.now()
        this._tasks.push({
          step: (t) => {
            let allDone = true
            order.forEach((k, i) => {
              const n = nodes[k]
              const s = startTime + i * HIDE_STAGGER
              if (t < s) { allDone = false; return }
              const u = Math.min(1, (t - s) / HIDE_DURATION)
              if (u < 1) allDone = false
              const e = easeInCubic(u)
              n.position[axis] = origP[k] + HIDE_DISTANCE * e
              if (u >= 1) n.visible = false
            })
            return !allDone
          },
          resolve,
        })
      })
    },
    sleep(ms) {
      return new Promise((resolve) => {
        if (!this._running) return resolve()
        this._sleepTimer = setTimeout(resolve, ms)
      })
    },
  },
}
</script>

<template lang="pug">
  .animation-scene-wrap
    .animation-scene-container(ref="container")
    .animation-scene-caption(v-if="!failed")
      p.is-size-6 Сборка и разборка моделей: QR, брелок, номерной знак, шрифт Брайля, подставка, бейдж.
    .animation-scene-error(v-else)
      p Не удалось инициализировать 3D-сцену.
</template>

<style scoped>
.animation-scene-wrap {
  position: relative;
  width: 100%;
}
.animation-scene-container {
  width: 100%;
  aspect-ratio: 4 / 3;
  max-height: 460px;
  min-height: 260px;
  background: #a0a0a0;
  border-radius: 6px;
  overflow: hidden;
}
.animation-scene-container :deep(canvas) {
  display: block;
  width: 100% !important;
  height: 100% !important;
}
.animation-scene-caption {
  margin-top: 0.75rem;
  color: #555;
}
.animation-scene-error {
  margin-top: 0.75rem;
  color: #c00;
}
@media (max-width: 768px) {
  .animation-scene-container {
    aspect-ratio: 1 / 1;
    max-height: 360px;
    min-height: 240px;
  }
  .animation-scene-caption {
    font-size: 0.9rem;
  }
}
</style>
