import {DefaultEntity} from "@/entity/entity";
import {Tooltip} from "@/entity/tooltip";
import {Sponsor} from "@/entity/sponsor.js";

export class DefaultBuilder {
  data = {}
  entity = undefined
  collection = []

  constructor(config = {}) {
    Object.assign(this, config)
    this.reset()
  }

  createEntity() {
    return new DefaultEntity()
  }

  reset() {
    this.entity = this.createEntity()
  }

  getEntity() {
    const result = this.entity
    this.reset()
    return result
  }

  build(data) {

  }

  baseBuild(builder, data) {
    builder.build(data)
    return builder.getEntity()
  }

  createCollection(data) {
    this.collection = []
    for (let item in data) {
      this.build(data[item])
      this.collection.push(this.getEntity())
    }
  }

  getCollection() {
    const collection = this.collection
    this.collection = []
    return collection
  }

  createDate(data, field, format = 'DD.MM.YYYY HH:mm:ss') {
    this.entity[field] = data

    const date = new Date(data)

    const options = {
      era: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
      timezone: 'UTC',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric'
    }

    this.entity[field + "_format"] = date.toLocaleString("ru", options)
    // const de = date.toLocaleString("en-US", options)
  }
}

export class TooltipBuilder extends DefaultBuilder {
  constructor(config = {}) {
    super(config)
    Object.assign(this, config)
  }

  createEntity() {
    return new Tooltip()
  }

  build(data) {
    super.build(data)
    this.entity.content = data.content
  }
}

export class SponsorBuilder extends DefaultBuilder {
  constructor(config = {}) {
    super(config)
    Object.assign(this, config)
  }

  createEntity() {
    return new Sponsor()
  }

  build(data) {
    super.build(data)
    this.entity.name = data.name
    this.entity.date = data.date
  }
}
