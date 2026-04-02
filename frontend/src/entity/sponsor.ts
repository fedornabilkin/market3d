import {DefaultEntity} from "./entity";

export class Sponsor extends DefaultEntity{
  name = ''
  date = ''

  constructor(config = {}) {
    super(config)
    Object.assign(this, config)
  }
}
