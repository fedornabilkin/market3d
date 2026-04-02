import {DefaultEntity} from "@/entity/entity";

export class Tooltip extends DefaultEntity{
  content = ''

  constructor(config = {}) {
    super(config)
    Object.assign(this, config)
  }
}
