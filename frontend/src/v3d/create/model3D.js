export class Model3D {
  strategy = undefined

  setStrategy(strategy) {
    this.strategy = strategy
  }

  create(generator) {
    return this.strategy.create(generator)
  }

  collection() {
    return this.strategy.getCollectMesh()
  }

}
