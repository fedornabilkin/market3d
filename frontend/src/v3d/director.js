import {
  BaseBuilder,
  BorderBuilder,
  CodeBuilder,
  IconBuilder,
  KeychainBuilder,
  MagnetBuilder,
  TextBuilder
} from "@/v3d/builder";

export class Director {
  builders = {
    base: BaseBuilder,
    border: BorderBuilder,
    code: CodeBuilder,
    text: TextBuilder,
    icon: IconBuilder,
    keychain: KeychainBuilder,
    magnet: MagnetBuilder,
  }

  entities = {}

  buildGroupBuilder(data) {
    for (const key in this.builders) {
      let cls = this.builders[key]
      let builder = new cls({data: data[key]})
      this.entities[key] = builder.getEntity()
    }

    this.customFields(data)
  }

  customFields(data) {
    if (data.content !== undefined) {
      this.entities.content = data.content
    }
  }

  getEntities() {
    return this.entities
  }
}
