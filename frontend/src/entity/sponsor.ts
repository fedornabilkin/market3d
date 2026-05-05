import {DefaultEntity} from "./entity.js";

export class Sponsor extends DefaultEntity{
  name = ''
  date = ''

  constructor(config = {}) {
    super(config)
    Object.assign(this, config)
  }
}
