<template lang="pug">
.gen-toolbar
  .gen-toolbar-left
    button.button.is-small.gen-toolbar-btn(@click="scannerModalVisible=true")
      span.icon
        i.fa.fa-camera
      span.is-hidden-mobile {{$t('form.scanQRButton')}}
    button.button.is-small.gen-toolbar-btn(@click="readModalVisible=true")
      span.icon
        i.fa.fa-file
      span.is-hidden-mobile {{$t('form.readQRButton')}}

.gen-settings-panel
  .gen-settings-header
    .gen-settings-header-title
      span.icon
        i.fa.fa-sliders-h
      span {{$t('form.optionsTitle')}}
    .gen-settings-header-actions
      button.gen-io-btn(
        type="button"
        @click="exportSettingsAsJson"
        :title="$t('form.exportSettings')"
        :aria-label="$t('form.exportSettings')"
      )
        i.fa.fa-download
      button.gen-io-btn(
        type="button"
        @click="$refs.importFileInput?.click()"
        :title="$t('form.importSettings')"
        :aria-label="$t('form.importSettings')"
      )
        i.fa.fa-upload
      input(ref="importFileInput" type="file" accept=".json" style="display: none" @change="importSettingsFromFile")
  .gen-settings-body
    Base(:options='options' :unit='unit')
    Qr(:options='options' :unit='unit')
    Text(:options='options' :unit='unit')
    Border(:options='options' :unit='unit')
    Keychain(:options='options' :unit='unit')
    Icon(:options='options' :unit='unit')
    Magnet(:options='options' :unit='unit')

.gen-error(v-if="generateError") {{generateError}}

Teleport(to="#gen-progress-target" v-if="teleportReady")
  .gen-progress-wrapper
    .gen-progress-bar
      .gen-progress-fill(:class="{ 'is-active': isGenerating }" :style="{width: progressGenerating + '%'}")
      .gen-progress-text {{ generationSeconds.toFixed(3) }} {{ $t('g.seconds') }}

ScannerModal(v-if="scannerModalVisible" :isActive="scannerModalVisible" @decode="onDecode" @close="scannerModalVisible=false")
ReaderModal(v-if="readModalVisible" :isActive="readModalVisible" @decode="onDecode" @close="readModalVisible=false")
</template>

<script>
import qrcode from 'qrcode';
import vcardjs from 'vcards-js';
import { diff } from 'deep-object-diff';
import merge from 'deepmerge';
import ScannerModal from './ScannerModal.vue';
import Base from "@/components/forms/Base.vue";
import Qr from "@/components/forms/Qr.vue";
import Text from "@/components/forms/Text.vue";
import Border from "@/components/forms/Border.vue";
import Keychain from "@/components/forms/Keychain.vue";
import Icon from "@/components/forms/Icon.vue";
import Magnet from "@/components/forms/Magnet.vue";
import {
  Base as BaseEntity,
  Border as BorderEntity,
  Code as CodeEntity,
  Text as TextEntity,
  Keychain as KeychainEntity,
  Icon as IconEntity,
  Magnet as MagnetEntity,
} from "@/v3d/entity";
import {Director} from "@/v3d/director";
import ReaderModal from "@/components/generator/ReaderModal.vue";

const director = new Director()

const base = new BaseEntity({active: true})
const border = new BorderEntity({active: true})
const code = new CodeEntity({active: true})
const text = new TextEntity({active: true})
const icon = new IconEntity()
const keychain = new KeychainEntity()
const magnet = new MagnetEntity()

const defaultOptions = {
  activeTabIndex: 0,
  base: base,
  border: border,
  code: code,
  text: text,
  icon: icon,
  keychain: keychain,
  magnet: magnet,
  content: 'vsqr.ru',
  wifi: {
    ssid: '',
    password: '',
    security: 'WPA',
    hidden: false,
  },
  email: {
    recipient: '',
    subject: '',
    body: '',
  },
  contact: {
    firstName: '',
    lastName: '',
    organization: '',
    role: '',
    cell: '',
    phone: '',
    fax: '',
    email: '',
    street: '',
    postcode: '',
    city: '',
    state: '',
    country: '',
    website: '',
  },
  sms: {
    recipient: '',
    message: '',
  },
}

export default {
  name: 'QRCodeMenu',
  props: {
    initData: Object,
    v3dFacade: Object,
  },
  components: {
    ReaderModal,
    Magnet,
    Icon,
    Keychain,
    Border,
    Text,
    Qr,
    Base,
    ScannerModal,
  },
  data: () => ({
    // options: JSON.parse(JSON.stringify(defaultOptions)),
    options: defaultOptions,
    diffOptions: {},
    qrCodeBitMask: null,
    unit: 'mm',
    isGenerating: false,
    progressGenerating: 0,
    generationSeconds: 0,
    generateError: undefined,
    scannerModalVisible: false,
    readModalVisible: false,
    teleportReady: false,
  }),
  created() {
    // Не-реактивные флаги для управления авто-генерацией.
    // Держим их вне data(), чтобы Vue не делал их прокси и не триггерил watch.
    this._autoGenTimer = null
    this._suppressAutoGen = false
    this._pendingAutoGen = false
    // Таймер измерения длительности генерации
    this._genStart = 0
    this._rafHandle = null
  },
  mounted() {
    if (this.initData) {
      director.buildGroupBuilder(this.initData)
      this.options = Object.assign(this.options, director.getEntities())
      // this.options = merge(this.options, this.initData)
    }
    // Цель Teleport находится в шаблоне родителя (GeneratorQR), который заканчивает
    // монтирование после детей — ждём nextTick, чтобы DOM-узел уже существовал.
    this.$nextTick(() => {
      this.teleportReady = true
    })
    this.prepareData()
  },
  beforeUnmount() {
    if (this._autoGenTimer) {
      clearTimeout(this._autoGenTimer)
      this._autoGenTimer = null
    }
    if (this._rafHandle) {
      cancelAnimationFrame(this._rafHandle)
      this._rafHandle = null
    }
  },
  watch: {
    options: {
      handler() {
        // Мутации, выполненные самим prepareData (preview.src, errorCorrectionLevel и т.д.),
        // не должны вызывать повторную генерацию — отсекаем их через флаг.
        if (this._suppressAutoGen) return
        this.scheduleAutoGenerate()
      },
      deep: true,
    },
  },

  methods: {
    startGenTimer() {
      // Сбрасываем длительность и запускаем тик по rAF —
      // плавно обновляем показания секунд во время генерации.
      this._genStart = performance.now()
      this.generationSeconds = 0
      if (this._rafHandle) cancelAnimationFrame(this._rafHandle)
      const tick = () => {
        if (!this.isGenerating) {
          this._rafHandle = null
          return
        }
        this.generationSeconds = (performance.now() - this._genStart) / 1000
        this._rafHandle = requestAnimationFrame(tick)
      }
      this._rafHandle = requestAnimationFrame(tick)
    },
    stopGenTimer() {
      if (this._rafHandle) {
        cancelAnimationFrame(this._rafHandle)
        this._rafHandle = null
      }
      // Фиксируем итоговую длительность последней генерации.
      if (this._genStart) {
        this.generationSeconds = (performance.now() - this._genStart) / 1000
      }
    },
    scheduleAutoGenerate() {
      // Дебаунсим частые изменения (слайдеры, ввод текста) в один запуск генерации.
      if (this._autoGenTimer) clearTimeout(this._autoGenTimer)
      this._autoGenTimer = setTimeout(() => {
        this._autoGenTimer = null
        // Если прямо сейчас идёт генерация — помечаем, что нужен повторный запуск.
        if (this.isGenerating) {
          this._pendingAutoGen = true
          return
        }
        this.prepareData()
      }, 150)
    },
    async render3d() {
      if (!this.v3dFacade) {
        this.generateError = 'V3D Facade not initialized'
        this.isGenerating = false
        this.stopGenTimer()
        return
      }

      try {
        // Устанавливаем битмаск QR кода если он есть
        if (this.qrCodeBitMask) {
          this.v3dFacade.setQRCodeBitMask(this.qrCodeBitMask)
        }

        // Генерируем модель через фасад
        await this.v3dFacade.generateModel(this.options, (percent) => {
          this.progressGenerating = percent
        })

        this.$emit('exportReady', this.options)
      } catch (error) {
        this.generateError = `Error during generation: ${error.message}`
        console.error(error)
      } finally {
        this.isGenerating = false
        this.stopGenTimer()
        if (!this.generateError) {
          // Оставляем прогресс-бар заполненным как индикатор «готово».
          this.progressGenerating = 100
        }
        // Если за время генерации пользователь менял настройки — пере-генерируем.
        if (this._pendingAutoGen) {
          this._pendingAutoGen = false
          this.scheduleAutoGenerate()
        }
      }
    },
    prepareData() {
      this.generateError = ''
      this.isGenerating = true
      this.progressGenerating = 0
      this.startGenTimer()
      this.$emit('generating')

      // Флаг глушит watch на всё время, пока prepareData вносит свои мутации
      // в options (preview.src, errorCorrectionLevel, wifi.security).
      // Снимаем его в nextTick — после flush-а вочера для этих мутаций.
      this._suppressAutoGen = true
      this.$nextTick(() => {
        this._suppressAutoGen = false
      })

      const txt = this.getQRText()
      if (this.options.code.active && txt === '') {
        this.isGenerating = false
        this.stopGenTimer()
        this.generateError = 'You have not entered any text.'
        return
      }

      if (this.options.icon.active) {
        this.options.code.errorCorrectionLevel = 'H'
      }

      if (this.options.code.active) {
        try {
          const qrConfig = {errorCorrectionLevel: this.options.code.errorCorrectionLevel}
          const qrCodeObject = qrcode.create(txt, qrConfig)
          this.qrCodeBitMask = qrCodeObject.modules.data

          qrConfig.margin = 1
          qrcode.toDataURL(txt, qrConfig, (err, src) => {
            if (err) {throw err}
            this.options.code.preview.src = src
          })
        } catch (e) {
          this.generateError = `Error during generation: ${e.message}`
          this.isGenerating = false
          this.stopGenTimer()
          return
        }
      }

      this.render3d()
    },
    onDecode(rawValue) {
      this.options.content = rawValue
      this.options.activeTabIndex = 0
      this.options.code.active = true
    },
    wifiQREscape(str) {
      const regex = /([:|\\|;|,|"])/gm
      const subst = '\\$1'
      return str.replace(regex, subst)
    },
    getQRText() {

      let ret = '';
      switch (this.options.activeTabIndex) {
        case 0: // Text
          ret = this.options.content
          break;
        case 1: // Wifi
          if (this.options.wifi.password === '') {
            this.options.wifi.security = 'nopass';
          }
          if (this.options.wifi.security === 'nopass') {
            this.options.wifi.password = '';
          }
          ret = `WIFI:S:${this.wifiQREscape(
            this.options.wifi.ssid,
          )};T:${this.wifiQREscape(this.options.wifi.security)};P:${this.wifiQREscape(
            this.options.wifi.password,
          )};H:${this.options.wifi.hidden ? 'true' : 'false'};`;
          break;
        case 2: // E-Mail
          ret = `mailto:${this.options.email.recipient
            .split(',')
            .map((x) => x.trim())
            .join(',')}?subject=${encodeURI(
            this.options.email.subject,
          )}&body=${encodeURI(this.options.email.body)}`;
          break;
        case 3: // Contact
          const vCard = vcardjs()
          vCard.firstName = this.options.contact.firstName;
          vCard.lastName = this.options.contact.lastName;
          vCard.organization = this.options.contact.organization;
          vCard.url = this.options.contact.website;
          vCard.role = this.options.contact.role;

          vCard.homePhone = this.options.contact.phone;
          vCard.cellPhone = this.options.contact.cell;
          vCard.homeFax = this.options.contact.fax;

          vCard.email = this.options.contact.email;

          vCard.homeAddress.street = this.options.contact.street;
          vCard.homeAddress.city = this.options.contact.city;
          vCard.homeAddress.stateProvince = this.options.contact.state;
          vCard.homeAddress.postalCode = this.options.contact.postcode;
          vCard.homeAddress.countryRegion = this.options.contact.country;

          // vCard.socialUrls.facebook = 'https://...';
          // vCard.socialUrls.linkedIn = 'https://...';
          // vCard.socialUrls.twitter = 'https://...';
          // vCard.socialUrls.flickr = 'https://...';
          // vCard.socialUrls.custom = 'https://...';

          vCard.version = '3.0'; // can also support 2.1 and 4.0, certain versions only support certain fields

          ret = vCard.getFormattedString();
          break;
        case 4: // SMS
          ret = `SMSTO:${this.options.sms.recipient}:${this.options.sms.message}`;
          break;
        default:
          break;
      }

      return ret
    },
    getEntityPayload(entity) {
      if (entity && typeof entity.toJSON === 'function') return entity.toJSON()
      return { ...entity }
    },
    exportOptions() {
      return {
        base: this.getEntityPayload(this.options.base),
        border: this.getEntityPayload(this.options.border),
        code: this.getEntityPayload(this.options.code),
        text: this.getEntityPayload(this.options.text),
        icon: this.getEntityPayload(this.options.icon),
        keychain: this.getEntityPayload(this.options.keychain),
        magnet: this.getEntityPayload(this.options.magnet),
        content: this.options.content,
        wifi: this.options.wifi,
        email: this.options.email,
        contact: this.options.contact,
        sms: this.options.sms,
        activeTabIndex: this.options.activeTabIndex,
      }
    },
    exportSettingsAsJson() {
      const payload = this.exportOptions()
      const json = JSON.stringify(payload, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `model-settings-${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)
    },
    importSettingsFromFile(event) {
      const file = event.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result)
          director.buildGroupBuilder(parsed)
          const entities = director.getEntities()
          this.options.base = entities.base
          this.options.border = entities.border
          this.options.code = entities.code
          this.options.text = entities.text
          this.options.icon = entities.icon
          this.options.keychain = entities.keychain
          this.options.magnet = entities.magnet
          if (entities.content !== undefined) this.options.content = entities.content
          if (parsed.wifi !== undefined) this.options.wifi = { ...this.options.wifi, ...parsed.wifi }
          if (parsed.email !== undefined) this.options.email = { ...this.options.email, ...parsed.email }
          if (parsed.contact !== undefined) this.options.contact = { ...this.options.contact, ...parsed.contact }
          if (parsed.sms !== undefined) this.options.sms = { ...this.options.sms, ...parsed.sms }
          if (parsed.activeTabIndex !== undefined) this.options.activeTabIndex = parsed.activeTabIndex
          this.prepareData()
        } catch (e) {
          this.generateError = `Import failed: ${e.message}`
          console.error(e)
        }
        event.target.value = ''
      }
      reader.readAsText(file)
    },
  },
};
</script>

<style scoped>
/* === Toolbar === */
.gen-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.gen-toolbar-left {
  display: flex;
  gap: 0.4rem;
}

.gen-toolbar-btn {
  border-radius: 8px !important;
  font-weight: 500;
  border-color: #3273dc !important;
  color: #3273dc !important;
  background: transparent !important;
  transition: all 0.15s ease;
}
.gen-toolbar-btn:hover {
  background: #3273dc !important;
  color: #fff !important;
}

/* === Settings Panel === */
.gen-settings-panel {
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: #fff;
}

.gen-settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem 0.5rem 1rem;
  font-weight: 600;
  font-size: 0.95rem;
  background: #f5f7fa;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  color: #363636;
}

.gen-settings-header-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.gen-settings-header-actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
}

.gen-settings-body {
  padding: 0.75rem;
  transition: border-color 0.3s ease;
  border: 2px solid transparent;
  border-top: 0;
  border-radius: 0 0 10px 10px;
}

/* === Error === */
.gen-error {
  margin-top: 0.75rem;
  padding: 0.65rem 1rem;
  border-radius: 8px;
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
  font-size: 0.875rem;
}

/* === Progress Bar === */
.gen-progress-wrapper {
  width: 100%;
}

.gen-progress-bar {
  position: relative;
  height: 22px;
  border-radius: 11px;
  background: rgba(229, 231, 235, 0.9);
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  backdrop-filter: blur(4px);
}

.gen-progress-fill {
  position: absolute;
  inset: 0 auto 0 0;
  background-color: #16a34a;
  background-image: linear-gradient(
    45deg,
    rgba(255, 255, 255, 0.22) 25%,
    transparent 25%,
    transparent 50%,
    rgba(255, 255, 255, 0.22) 50%,
    rgba(255, 255, 255, 0.22) 75%,
    transparent 75%,
    transparent
  );
  background-size: 22px 22px;
  border-radius: 11px;
  transition: width 0.15s ease;
}

.gen-progress-fill.is-active {
  animation: gen-progress-stripes 0.8s linear infinite;
}

@keyframes gen-progress-stripes {
  0%   { background-position: 0 0; }
  100% { background-position: 22px 0; }
}

.gen-progress-text {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.78rem;
  font-weight: 600;
  color: #0f172a;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
  pointer-events: none;
  text-shadow: 0 1px 2px rgba(255, 255, 255, 0.6);
}

/* === Import/Export === */
.gen-io-btn {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border-radius: 6px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: #fff;
  color: #475569;
  font-size: 0.78rem;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}

.gen-io-btn:hover {
  background: #3273dc;
  border-color: #3273dc;
  color: #fff;
}

.gen-io-btn:focus {
  outline: none;
  box-shadow: 0 0 0 2px rgba(50, 115, 220, 0.25);
}
</style>
