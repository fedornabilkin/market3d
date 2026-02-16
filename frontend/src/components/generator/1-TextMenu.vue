<template>
  <div id="qrcodeMenu">
    <nav class="panel">
      <p class="panel-heading">{{ $t("text") }}</p>
      <div class="panel-block">
        <div class="columns" style="width: 100%">
          <div class="column">
            <!-- Text Settings -->
            <Text :options="options" :unit="unit"></Text>
          </div>
        </div>
      </div>
    </nav>

    <!-- 3D Options -->
    <nav class="panel">
      <p class="panel-heading">{{ $t("modelOptions") }}</p>
      <div class="panel-block">
        <div class="columns" style="width: 100%">
          <div class="column">
            <div class="model-options-title">
              <div class="title is-size-5">{{$t('base')}}</div>
            </div>
            <Base :options="options" :unit="unit"></Base>

            <!-- Border Settings -->
            <Border :options="options" :unit="unit"></Border>

            <!-- Keychain Settings -->
            <Keychain :options="options" :unit="unit"></Keychain>

            <!-- NFC Tag Section -->
<!--            <div class="field is-horizontal">-->
<!--              <div class="field-label is-small">-->
<!--                <label class="label">{{ $t("nfcIndentation") }}</label>-->
<!--              </div>-->
<!--              <div class="field-body">-->
<!--                <div class="control">-->
<!--                  <label class="checkbox">-->
<!--                    <div class="field">-->
<!--                      <input-->
<!--                        type="checkbox"-->
<!--                        v-model="options.base.hasNfcIndentation"-->
<!--                      />-->
<!--                      <span class="is-size-7"-->
<!--                        ><i class="fa fa-wifi"></i>-->
<!--                        {{ $t("nfcIndentationHelp") }}</span-->
<!--                      >-->
<!--                    </div>-->
<!--                  </label>-->
<!--                </div>-->
<!--              </div>-->
<!--            </div>-->
            <div class="subsection" v-if="options.base.hasNfcIndentation">
              <div class="field is-horizontal">
                <div class="field-label is-small">
                  <label class="label">{{ $t("indentation") }} {{ $t("shape") }}</label>
                </div>
                <div class="field-body">
                  <div class="field">
                    <div class="control has-icons-left">
                      <div class="select is-small">
                        <select v-model="options.base.nfcIndentationShape">
                          <option value="square">{{ $t("square") }}</option>
                          <option value="round">{{ $t("round") }}</option>
                        </select>
                        <span class="icon is-small is-left">
                          <i class="fa fa-shapes"></i>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="field is-horizontal">
                <div class="field-label is-small">
                  <label class="label">{{ $t("indentation") }} {{ $t("size") }}</label>
                </div>
                <div class="field-body">
                  <div class="field has-addons">
                    <div class="control">
                      <input class="input is-small" type="number" v-model.number="options.base.nfcIndentationSize"/>
                    </div>
                    <p class="control">
                      <a class="button is-static is-small">{{ unit }}</a>
                    </p>
                  </div>
                </div>
              </div>
              <div class="field is-horizontal">
                <div class="field-label is-small">
                  <label class="label">{{ $t("indentation") }} {{ $t("depth") }}</label>
                </div>
                <div class="field-body">
                  <div class="field has-addons">
                    <div class="control">
                      <input class="input is-small" type="number" v-model.number="options.base.nfcIndentationDepth"/>
                    </div>
                    <p class="control">
                      <a class="button is-static is-small">{{ unit }}</a>
                    </p>
                  </div>
                </div>
              </div>
              <div class="field is-horizontal">
                <div class="field-label is-small">
                  <label class="label">{{ $t("hidden") }}</label>
                </div>
                <div class="field-body">
                  <div class="control">
                    <label class="checkbox">
                      <div class="field">
                        <input type="checkbox" v-model="options.base.nfcIndentationHidden"/>
                        <span class="is-size-7">
                          <i class="fa fa-layer-group"></i>
                          {{ $t("nfcIndentationHiddenHelp") }}
                        </span>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>

    <div class="notification is-danger is-light" v-if="generateError" style="margin-top: 20px">
      {{ generateError }}
    </div>

    <button class="button is-success is-large" v-bind:class="{ 'is-loading': isGenerating }" @click="render3d">
      <span class="icon">
        <i class="fa fa-cube"></i>
      </span>
      <span>{{ $t('g.generateButton') }}</span>
    </button>
<!--    {{isGenerating}}-->
<!--    v-bind:class="{ 'is-loading': isGenerating }"-->

  </div>
</template>

<script>
import * as THREE from 'three';

import { diff } from 'deep-object-diff';
import merge from 'deepmerge';
import JSZip from 'jszip';

import { save, saveAsString, saveAsArrayBuffer } from '@/utils';
import BaseTag3D from "@/base";
import {Model3D} from "@/v3d/create/model3D.js";
import {TextModel} from "@/v3d/create/base";
import Border from "@/components/forms/Border.vue";
import Keychain from "@/components/forms/Keychain.vue";
import Base from "@/components/forms/Base.vue";
import Text from "@/components/forms/Text.vue";

const defaultOptions = {
  border: {
    active: true,
    width: 2,
    depth: 1,
  },
  text: {
    active: true,
    message: '',
    placement: 'center',
    align: 'center',
    margin: 2,
    size: 10,
    depth: 1,
    height: 10,
  },
  keychain: {
    active: true,
    placement: 'left',
    holeDiameter: 6,
    mirror: false,
  },
  magnet: {
    active: false,
    diameter: 5,
    depth: 2,
    count: 4,
  },
  base: {
    shape: 'roundedRectangle',
    width: 100,
    height: 50,
    depth: 3,
    cornerRadius: 5,

    hasNfcIndentation: false,
    nfcIndentationShape: 'square',
    nfcIndentationSize: 30,
    nfcIndentationDepth: 1,
    nfcIndentationHidden: false,
  },
};

export default {
  name: 'TextMenu',
  props: {
    initData: Object,
    scene: Object,
    exporter: Object,
  },
  components: {Text, Base, Keychain, Border},
  data() {
    return {
      options: JSON.parse(JSON.stringify(defaultOptions)),
      unit: 'mm',
      mesh: null,
      baseMesh: null,
      borderMesh: null,
      subtitleMesh: null,
      keychainAttachmentMesh: null,
      stlType: 'binary',
      dualExtrusion: false,
      isGenerating: false,
      generateError: null,
      changelogModalVisible: false,
      addedMeshes: [],
      generator: undefined,
      model3d: undefined
    };
  },
  async mounted() {
    if (this.initData && this.initData.mode === 'Text') {
      delete this.initData.mode
      this.options = merge(this.options, this.initData)
      await this.render3d()
    }
  },

  methods: {
    async render3d() {
      this.$emit('generating')
      this.isGenerating = true
      for(const item of this.addedMeshes) {
        this.scene.remove(item)
      }

      this.generator = new BaseTag3D(this.options)

      const strategy = new TextModel()
      this.model3d = new Model3D()
      this.model3d.setStrategy(strategy)
      const parts = await this.model3d.create(this.generator)

      for(const key in parts) {
        this.addedMeshes.push(parts[key])
        this.scene.add(parts[key])
      }

      this.$emit('exportReady', diff(defaultOptions, this.options), this.addedMeshes)
      this.isGenerating = false
    },
    async exportSTL(stlType, multipleParts) {
      const timestamp = new Date().getTime()
      const exportAsBinary = stlType === 'binary'
      const expConfig = {binary: exportAsBinary}

      if (multipleParts) {
        const parts = await this.model3d.create(this.generator)
        const zip = new JSZip()

        for(const key in parts) {
          const data = this.exporter.parse(parts[key], expConfig)
          zip.file(`${key}-${timestamp}.stl`, data.buffer)
        }

        zip.generateAsync({ type: 'blob' }).then((content) => {
          save(new Blob([content]), `vsqr-3d-${timestamp}.zip`)
        })
      } else {
        const mesh = this.model3d.export(this.generator)
        const filename = `vsqr-3d-${timestamp}.stl`
        const result = this.exporter.parse(mesh, expConfig)

        if (exportAsBinary) {
          saveAsArrayBuffer(result, filename)
        } else {
          saveAsString(result, filename)
        }
      }
    },
  },
};
</script>

<style scoped>
#main {
  margin-top: 20px;
}

.export-button {
  margin: 0 10px;
}

#notifications {
  margin-top: 10px;
}

.field-label {
  text-align: left;
}

#mode-buttons > button {
  margin-right: 20px;
}
</style>
