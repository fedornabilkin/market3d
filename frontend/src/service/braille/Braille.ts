interface IPosition {
  x: number
  y: number
}

export class Braille {
  position: any = [{x:1, y:1},{x:1, y:2},{x:1, y:3},{x:2, y:1},{x:2, y:2},{x:2, y:3},]

  getPosition(index: number): any {
    return {x: Math.floor(index / 3) + 1, y: index % 3 + 1}
  }
}
