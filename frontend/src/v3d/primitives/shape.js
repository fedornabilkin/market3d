import {Shape} from "three";

/**
 * @property x - the x coordinate of the rectangle
 * @property y - the y coordinate of the rectangle
 * @property w - the width of the rectangle
 * @property h - the height of the rectangle
 */
class ShapeFigure {
  x = 0
  y = 0
  w = 0
  h = 0

  /**
   *
   * @param config - the configuration {x, y, w, h}
   */
  constructor(config = {}) {
    Object.assign(this, config)
    this.shape = new Shape()
  }
}

export class RectangleShape extends ShapeFigure {
  constructor(config = {}) {
    super(config)
    Object.assign(this, config)
  }

  create() {
    this.shape.moveTo(this.x, this.y)
    this.shape.lineTo(this.x, this.y + this.h)
    this.shape.lineTo(this.x + this.w, this.y + this.h)
    this.shape.lineTo(this.x + this.w, this.y)
    this.shape.lineTo(this.x, this.y)

    return this.shape
  }
}

export class RectangleRoundedCornerShape extends ShapeFigure {
  r = 0
  rA = 0
  rB = 0
  rC = 0
  rD = 0
  constructor(config = {}) {
    super(config)
    Object.assign(this, config)
  }

  create() {
    this.shape.moveTo(this.x, this.y + this.rD)
    this.shape.lineTo(this.x, this.y + this.h - this.rA)
    this.shape.quadraticCurveTo(this.x, this.y + this.h, this.x + this.rA, this.y + this.h)
    this.shape.lineTo(this.x + this.w - this.rB, this.y + this.h)
    this.shape.quadraticCurveTo(this.x + this.w, this.y + this.h, this.x + this.w, this.y + this.h - this.rB)
    this.shape.lineTo(this.x + this.w, this.y + this.rC)
    this.shape.quadraticCurveTo(this.x + this.w, this.y, this.x + this.w - this.rC, this.y)
    this.shape.lineTo(this.x + this.rD, this.y)
    this.shape.quadraticCurveTo(this.x, this.y, this.x, this.y + this.rD)

    return this.shape
  }
}

export class RectangleRoundedShape extends RectangleRoundedCornerShape {
  constructor(config = {}) {
    super(config)
    config.rA = config.r
    config.rB = config.r
    config.rC = config.r
    config.rD = config.r
    Object.assign(this, config)
  }

  create() {
    return super.create()
  }
}
