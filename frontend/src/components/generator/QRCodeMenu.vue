<template lang="pug">
button.mr-1.button.is-info(@click="scannerModalVisible=true")
  span.icon
    i.fa.fa-camera
  span.is-hidden-mobile {{$t('form.scanQRButton')}}
button.button.is-info(@click="readModalVisible=true")
  span.icon
    i.fa.fa-file
  span.is-hidden-mobile {{$t('form.readQRButton')}}

.panel.mt-1
  p.panel-heading {{$t('form.optionsTitle')}}
  .panel-block.form-options(:class="{'need-generate-color': needGenerating}")
    .columns
      .column
        // Base Settings
        Base(:options='options' :unit='unit')
        // QR Settings
        Qr(:options='options' :unit='unit')
        // Text Settings
        Text(:options='options' :unit='unit')
        // Border Settings
        Border(:options='options' :unit='unit')
        // Keychain Settings
        Keychain(:options='options' :unit='unit')
        // Icon Settings
        Icon(:options='options' :unit='unit')
        // NFC Tag Section
        Magnet(:options='options' :unit='unit')

.notification.is-danger.is-light(v-if="generateError" style="margin-top: 20px 0;") {{generateError}}

.columns
  .column
    button.button.is-success.is-large(:class="{'is-loading': isGenerating}" @click="prepareData")
      span.icon
        i.fa.fa-cube
      span {{$t('g.generateButton')}}
  .column
    progress.progress.is-success(v-if="isGenerating" :value="progressGenerating" max='100')
      | {{ progressGenerating }}

ScannerModal(v-if="scannerModalVisible" :isActive="scannerModalVisible" @decode="onDecode" @close="scannerModalVisible=false")
ReaderModal(v-if="readModalVisible" :isActive="readModalVisible" @decode="onDecode" @close="readModalVisible=false")
</template>

<script>
import qrcode from 'qrcode';
import vcardjs from 'vcards-js';
import { diff } from 'deep-object-diff';
import merge from 'deepmerge';
import ScannerModal from './ScannerModal.vue';
import {useShareHash} from "@/service/shareHash";
import {Share} from "@/entity/share";
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
import {useGenerateList} from "@/store/generateList";
import {Director} from "@/v3d/director";
import ReaderModal from "@/components/generator/ReaderModal.vue";

const shareHash = useShareHash()
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
    needGenerating: false,
    progressGenerating: 0,
    generateError: undefined,
    scannerModalVisible: false,
    readModalVisible: false,
  }),
  mounted() {
    if (this.initData) {
      director.buildGroupBuilder(this.initData)
      this.options = Object.assign(this.options, director.getEntities())
      // this.options = merge(this.options, this.initData)
    }
    this.prepareData()

    let elements = document.querySelectorAll('.form-options input')
    const genFlag = () => this.needGenerating = true

    for (let elem of elements) {
      elem.addEventListener('change', genFlag)
    }
  },

  methods: {
    async render3d() {
      if (!this.v3dFacade) {
        this.generateError = 'V3D Facade not initialized'
        this.isGenerating = false
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
        setTimeout(() => {
          this.addLastGenerate()
        }, 500)
      } catch (error) {
        this.generateError = `Error during generation: ${error.message}`
        console.error(error)
      } finally {
        this.needGenerating = false
        this.isGenerating = false
        if (!this.generateError) {
          this.progressGenerating = 0
        }
      }
    },
    prepareData() {
      this.generateError = ''
      this.isGenerating = true
      this.$emit('generating')

      const txt = this.getQRText()
      if (this.options.code.active && txt === '') {
        this.isGenerating = false
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
          return
        }
      }

      this.render3d()
    },
    addLastGenerate() {
      const generateList = useGenerateList()
      const imageUrl = this.v3dFacade ? this.v3dFacade.getImageDataUrl() : ''
      generateList.add(this.createShare(shareHash.create(this.options), imageUrl))
    },
    createShare(hash, src) {
      const opt = JSON.stringify(this.options)
      return new Share({hash: hash, img: {src: src}, options: opt, date: new Date().getTime()})
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
  },
};
</script>

<style scoped>
#mode-buttons>button {
  margin-right: 20px;
}

.need-generate-color {
  border: 0.1rem solid rgb(255 183 15 / 80%);
  border-top: 0;
  animation: linearGradientMove 1.5s infinite alternate;
}

@keyframes linearGradientMove {
  100% {border-color: rgb(255 183 15 / 10%);}
}
</style>
