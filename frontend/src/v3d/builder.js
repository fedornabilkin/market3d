import {Base, Border, Code, Entity, Icon, Keychain, Magnet, Text} from "@/v3d/entity";
import {DefaultBuilder} from "@/entity/builder";

class MainBuilder extends DefaultBuilder{

  constructor(config = {}) {
    super(config)
    Object.assign(this, config)
  }

  createEntity() {
    return new Entity()
  }

  build(data) {
    super.build(data)
    if (data && data.active !== undefined) {
      this.entity.active = data.active
    }
  }

}

export class BaseBuilder extends MainBuilder {

  createEntity() {
    return new Base(this.data)
  }

  build(data) {
    super.build(data)
    this.entity.shape = data.shape
    this.entity.width = data.width
    this.entity.height = data.height
    this.entity.depth = data.depth
    this.entity.cornerRadius = data.cornerRadius
  }
}

export class BorderBuilder extends MainBuilder {

  createEntity() {
    return new Border(this.data)
  }

  build(data) {
    super.build(data)
    this.entity.width = data.width
    this.entity.depth = data.depth
  }
}

export class CodeBuilder extends MainBuilder {

  createEntity() {
    return new Code(this.data)
  }

  build(data) {
    super.build(data)
    this.entity.depth = data.depth
    this.entity.margin = data.margin
    this.entity.cityMode = data.cityMode
    this.entity.depthMax = data.depthMax
    this.entity.errorCorrectionLevel = data.errorCorrectionLevel
    this.entity.invert = data.invert
    this.entity.block = data.block
    this.entity.preview = data.preview
  }
}

export class TextBuilder extends MainBuilder {

  createEntity() {
    return new Text(this.data)
  }

  build(data) {
    super.build(data)
    this.entity.message = data.message
    this.entity.placement = data.placement
    this.entity.align = data.align
    this.entity.margin = data.margin
    this.entity.size = data.size
    this.entity.height = data.height
    this.entity.depth = data.depth
  }
}

export class IconBuilder extends MainBuilder {

  createEntity() {
    return new Icon(this.data)
  }

  build(data) {
    super.build(data)
    this.entity.name = data.name
    this.entity.ratio = data.ratio
    this.entity.inverted = data.inverted
    this.entity.offsetX = data.offsetX
    this.entity.offsetY = data.offsetY
    this.entity.data = data.data
    this.entity.src = data.src
    this.entity.srcCustom = data.srcCustom
    this.entity.htmlId = data.htmlId
  }
}

export class KeychainBuilder extends MainBuilder {

  createEntity() {
    return new Keychain(this.data)
  }

  build(data) {
    super.build(data)
    this.entity.placement = data.placement
    this.entity.holeDiameter = data.holeDiameter
    this.entity.mirror = data.mirror
  }
}

export class MagnetBuilder extends MainBuilder {

  createEntity() {
    return new Magnet(this.data)
  }

  build(data) {
    super.build(data)
    this.entity.shape = data.shape
    this.entity.size = data.size
    this.entity.depth = data.depth
    this.entity.hidden = data.hidden
  }
}
