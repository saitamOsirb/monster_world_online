import { Assets, Container, Rectangle, Sprite, Texture } from 'pixi.js'
import { TILE_SIZE } from '../constants'
import type { DoorDefinition } from './types'

interface DoorView {
  sprite: Sprite
  frames: Texture[]
  sequence: number
}

const FRAME_MS = 100

function key(door: DoorDefinition): string {
  return `${door.tile.x},${door.tile.y}`
}

export class DoorAnimator {
  private readonly views = new Map<string, DoorView>()

  constructor(private readonly layer: Container) {}

  clear(): void {
    this.views.clear()
  }

  async render(doors: DoorDefinition[]): Promise<void> {
    await Promise.all(doors.map(async (door) => {
      if (door.invisible || !door.animationTexturePath) return
      const texture = await Assets.load<Texture>(door.animationTexturePath)
      texture.source.scaleMode = 'nearest'
      const frames = this.sliceVertical(texture, 3)
      const sprite = new Sprite(frames[0])
      sprite.position.set(door.tile.x * TILE_SIZE, door.tile.y * TILE_SIZE)
      sprite.zIndex = door.tile.y * TILE_SIZE + TILE_SIZE + 1
      sprite.visible = false
      sprite.roundPixels = true
      this.layer.addChild(sprite)
      this.views.set(key(door), { sprite, frames, sequence: 0 })
    }))
  }

  async open(door: DoorDefinition): Promise<void> {
    if (door.invisible) return
    await this.play(door, [0, 1, 2], true)
  }

  async close(door: DoorDefinition): Promise<void> {
    if (door.invisible) return
    await this.play(door, [2, 1, 0], false)
  }

  private async play(door: DoorDefinition, order: number[], keepVisible: boolean): Promise<void> {
    const view = this.views.get(key(door))
    if (!view) return
    const sequence = ++view.sequence
    view.sprite.visible = true

    for (const frameIndex of order) {
      if (view.sequence !== sequence || view.sprite.destroyed) return
      view.sprite.texture = view.frames[frameIndex]
      await new Promise<void>((resolve) => window.setTimeout(resolve, FRAME_MS))
    }

    if (view.sequence === sequence && !view.sprite.destroyed) {
      view.sprite.visible = keepVisible
    }
  }

  private sliceVertical(texture: Texture, count: number): Texture[] {
    const frameHeight = texture.source.height / count
    return Array.from({ length: count }, (_, index) => new Texture({
      source: texture.source,
      frame: new Rectangle(0, index * frameHeight, texture.source.width, frameHeight),
    }))
  }
}
