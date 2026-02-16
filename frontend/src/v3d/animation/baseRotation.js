export class BaseRotation {
  node = undefined
  startPosition = {x: 0, y: 0, z: 0}
  startRotation = {x: 0, y: 0, z: 0}

  animate(time) {
    if (this.node) {
      // Используем copy для безопасного обновления rotation
      this.node.rotation.set(
        time * .01,
        time * .05,
        time * .1
      )
    }
  }

  pause() {
    if (this.node) {
      this.node.rotation.set(
        this.startRotation.x,
        this.startRotation.y,
        this.startRotation.z
      )
    }
  }

  stop() {
    if (this.node) {
      this.node.rotation.set(0, 0, 0)
    }
  }

  setNode(node) {
    this.node = node
  }
}
