<template>
  <nav class="panel">
    <p class="panel-heading">{{$t('modelOptions')}}</p>
    <div class="panel-block">
      <div class="columns" style="width: 100%">
        <div class="column is-8">
          <!-- Base Settings -->
          <div class="model-options-title">
            <div class="title is-size-5">{{$t('base')}}</div>
          </div>
          <Base :options="options" :unit="unit"></Base>

          <!-- QR Settings -->
          <div class="model-options-title">
            <div class="title is-size-5">QR Code</div>
          </div>
          <Qr :options="options" :unit="unit"></Qr>

          <!-- Text Settings -->
          <div class="model-options-title">
            <div class="field is-horizontal">
              <div class="field-label">
                <label class="label">{{$t('text')}}</label>
              </div>
              <div class="field-body">
                <div class="field">
                  <div class="control">
                    <label class="checkbox">
                      <input type="checkbox" v-model="options.text.active" />
                      <span class="is-size-7"><i class="fa fa-font"></i> {{$t('textOnEdge')}}</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="subsection" v-if="options.text.active">
            <Text :options="options" :unit="unit"></Text>
          </div>

          <!-- Border Settings -->
          <Border :options="options" :unit="unit"></Border>

          <!-- Keychain Settings -->
          <Keychain :options="options" :unit="unit"></Keychain>

          <!-- Icon Settings -->
          <Icon :options="options"></Icon>

          <div class="field is-horizontal">
            <div class="field-label is-small">
              <label class="label">{{$t('text')}}</label>
            </div>
            <div class="field-body">
              <div class="field">
                <div class="control">
                  <label class="checkbox">
                    <input type="checkbox" v-model="options.base.hasText" />
                    <span class="is-size-7"><i class="fa fa-font"></i> {{$t('textOnEdge')}}</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
          <div class="subsection" v-if="options.base.hasText">
            <div class="field is-horizontal">
              <div class="field-label is-small">
                <label class="label">{{$t('text')}} {{$t('placement')}}</label>
              </div>
              <div class="field-body">
                <div class="field">
                  <div class="control has-icons-left">
                    <div class="select is-small">
                      <select v-model="options.base.textPlacement">
                        <option value="top">{{$t('top')}}</option>
                        <option value="bottom">{{$t('bottom')}}</option>
                        <option value="left">{{$t('left')}}</option>
                        <option value="right">{{$t('right')}}</option>
                      </select>
                      <span class="icon is-small is-left">
                        <i class="fa fa-arrows-alt-v"></i>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="field is-horizontal">
              <div class="field-label is-small">
                <label class="label">{{$t('text')}} {{$t('content')}}</label>
              </div>
              <div class="field-body">
                <div class="field">
                  <div class="control">
                    <div v-if="options.base.textPlacement === 'top' || options.base.textPlacement === 'bottom'" class="buttons are-small mb-0 is-pulled-right">
                      <button :class="{'button': true, 'is-primary': options.base.textAlign == 'left'}" @click="options.base.textAlign = 'left'">
                        <span class="icon is-small">
                          <i class="fas fa-align-left"></i>
                        </span>
                      </button>
                      <button :class="{'button': true, 'is-primary': options.base.textAlign == 'center'}" @click="options.base.textAlign = 'center'">
                        <span class="icon is-small">
                          <i class="fas fa-align-center"></i>
                        </span>
                      </button>
                      <button :class="{'button': true, 'is-primary': options.base.textAlign == 'right'}" @click="options.base.textAlign = 'right'">
                        <span class="icon is-small">
                          <i class="fas fa-align-right"></i>
                        </span>
                      </button>
                    </div>
                    <div v-if="options.base.textPlacement === 'left' || options.base.textPlacement === 'right'" class="buttons are-small mb-0 is-pulled-right">
                      <button :class="{'button': true, 'is-primary': options.base.textAlign == 'left'}" @click="options.base.textAlign = 'left'">
                        <span class="icon is-small">
                          <i class="fas fa-arrow-up"></i>
                        </span>
                      </button>
                      <button :class="{'button': true, 'is-primary': options.base.textAlign == 'center'}" @click="options.base.textAlign = 'center'">
                        <span class="icon is-small">
                          <i class="fas fa-equals"></i>
                        </span>
                      </button>
                      <button :class="{'button': true, 'is-primary': options.base.textAlign == 'right'}" @click="options.base.textAlign = 'right'">
                        <span class="icon is-small">
                          <i class="fas fa-arrow-down"></i>
                        </span>
                      </button>
                    </div>
                    <textarea class="textarea is-small" rows=3 v-model="options.base.textMessage" :placeholder="$t('theText')"/>
                    <p class="help content">
                      {{$t('fontInfoText')}}<br/>
                      <i class="fas fa-italic"></i> {{$t('italicInfoText')}}<br/>
                      <i class="fas fa-bold"></i> {{$t('boldInfoText')}}<br/>
                    </p>
                  </div>
                </div>
              </div>
            </div>

          </div>

          <!-- NFC Tag Section -->
<!--          <div class="field is-horizontal">-->
<!--            <div class="field-label is-small">-->
<!--              <label class="label">{{$t('nfcIndentation')}}</label>-->
<!--            </div>-->
<!--            <div class="field-body">-->
<!--              <div class="control">-->
<!--                <label class="checkbox">-->
<!--                  <div class="field">-->
<!--                    <input type="checkbox" v-model="options.base.hasNfcIndentation" />-->
<!--                    <span class="is-size-7"><i class="fa fa-wifi"></i> {{$t('nfcIndentationHelp')}}</span>-->
<!--                  </div>-->
<!--                </label>-->
<!--              </div>-->
<!--            </div>-->
<!--          </div>-->
          <div class="subsection" v-if="options.base.hasNfcIndentation">
            <div class="field is-horizontal">
              <div class="field-label is-small">
                <label class="label">{{$t('indentation')}} {{$t('shape')}}</label>
              </div>
              <div class="field-body">
                <div class="field">
                  <div class="control has-icons-left">
                    <div class="select is-small">
                      <select v-model="options.base.nfcIndentationShape">
                        <option value="square">{{$t('square')}}</option>
                        <option value="round">{{$t('round')}}</option>
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
                <label class="label">{{$t('indentation')}} {{$t('size')}}</label>
              </div>
              <div class="field-body">
                <div class="field has-addons">
                  <div class="control">
                    <input
                      class="input is-small"
                      type="number"
                      v-model.number="options.base.nfcIndentationSize"
                    />
                  </div>
                  <p class="control">
                    <a class="button is-static is-small">{{unit}}</a>
                  </p>
                </div>
              </div>
            </div>
            <div class="field is-horizontal">
              <div class="field-label is-small">
                <label class="label">{{$t('indentation')}} {{$t('depth')}}</label>
              </div>
              <div class="field-body">
                <div class="field has-addons">
                  <div class="control">
                    <input
                      class="input is-small"
                      type="number"
                      v-model.number="options.base.nfcIndentationDepth"
                    />
                  </div>
                  <p class="control">
                    <a class="button is-static is-small">{{unit}}</a>
                  </p>
                </div>
              </div>
            </div>
            <div class="field is-horizontal">
              <div class="field-label is-small">
                <label class="label">{{$t('hidden')}}</label>
              </div>
              <div class="field-body">
                <div class="control">
                  <label class="checkbox">
                    <div class="field">
                      <input type="checkbox" v-model="options.base.nfcIndentationHidden" />
                      <span class="is-size-7"><i class="fa fa-layer-group"></i> {{$t('nfcIndentationHiddenHelp')}}</span>
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
</template>

<script>
import Border from "@/components/forms/Border.vue";
import Keychain from "@/components/forms/Keychain.vue";
import Icon from "@/components/forms/Icon.vue";
import Qr from "@/components/forms/Qr.vue";
import Text from "@/components/forms/Text.vue";
import Base from "@/components/forms/Base.vue";

export default {
  name: 'QRCodeModelOptionsPanel',
  components: {Base, Text, Qr, Icon, Keychain, Border},
  props: {
    options: Object,
    unit: String,
  },
  data() {
    return {

    };
  },
  methods: {
  },
}
</script>

<style>
.help-icon {
  margin-top: 3px;
  margin-left: 5px;
}

.model-options-title {
  margin: 0 0 10px 5px;
  padding-bottom: 7px;
  border-bottom: 2px solid whitesmoke;
}

#icon-preview {
  margin-left: 15px;
}

.icon-item {
  border-radius: 10px;
}

.icon-item>img {
  width: 18px;
  height: 18px;
}

.icon-item:hover {
  background: whitesmoke;
  cursor: pointer;
}

.icon-item.no-icon {
  padding: 5px;
}

#dropdown-content2 {
  width: 240px;
  padding: 20px;
}
</style>
