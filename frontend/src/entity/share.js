export class Share {
  hash = ''
  date = undefined
  options = {}
  img = {
    src: null,
  }

  constructor(config = {}) {
    Object.assign(this, config)
  }
}
