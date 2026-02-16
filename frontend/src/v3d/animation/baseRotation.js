export class BaseRotation {
  node = undefined
  startPosition = {x: 0, y: 0, z: 0}
  startRotation = {x: 0, y: 0, z: 0}

  animate(time) {
    this.node.rotation.x = time * .01
    this.node.rotation.y = time * .05
    this.node.rotation.z = time * .1
  }

  pause() {
    this.node.rotation.x = this.startRotation.x
    this.node.rotation.y = this.startRotation.y
    this.node.rotation.z = this.startRotation.z
  }

  stop() {
    this.node.rotation.x = 0
    this.node.rotation.y = 0
    this.node.rotation.z = 0
  }

  setNode(node) {
    this.node = node
  }
}
