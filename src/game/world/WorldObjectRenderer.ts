import { AnimatedSprite, Assets, Container, Rectangle, Sprite, Texture } from 'pixi.js'
import { TILE_SIZE } from '../constants'
import type { WorldObjectDefinition } from './types'

interface InstanceVisual {
  path: string
  offsetX?: number
  offsetY?: number
  hframes?: number
}

const INSTANCE_VISUALS: Record<string, InstanceVisual> = {
  'res://Tree.tscn': { path: '/assets/Trees/tree1.png', offsetY: -16 },
  'res://Flower.tscn': { path: '/assets/Flowers/red_flower.png' },
  'res://TallGrass.tscn': { path: '/assets/Grass/tall_grass.png', hframes: 2 },
  'res://House.tscn': { path: '/assets/Buildings/house1.png' },
}

export class WorldObjectRenderer {
  constructor(private readonly layer: Container) {}

  async render(objects: WorldObjectDefinition[]): Promise<void> {
    for (const object of objects) {
      if (object.instancePath?.endsWith('Player.tscn')) continue
      if (object.instancePath?.endsWith('Door.tscn')) continue
      if (object.instancePath?.endsWith('OverworldTileMap.tscn')) continue
      if (object.instancePath?.endsWith('LedgeTileMap.tscn')) continue

      const visual = object.instancePath ? INSTANCE_VISUALS[object.instancePath] : undefined
      const texturePath = object.texturePath ?? visual?.path
      if (!texturePath) continue

      const texture = await Assets.load<Texture>(texturePath)
      texture.source.scaleMode = 'nearest'
      const displayObject = object.instancePath?.endsWith('Flower.tscn')
        ? this.createFlower(texture)
        : new Sprite(visual?.hframes ? this.sliceHorizontal(texture, visual.hframes)[0] : texture)

      displayObject.position.set(
        object.position.x + (visual?.offsetX ?? 0),
        object.position.y + (visual?.offsetY ?? 0),
      )
      displayObject.zIndex = object.zIndex ?? object.position.y + TILE_SIZE
      displayObject.roundPixels = true
      this.layer.addChild(displayObject)
    }
  }

  private createFlower(texture: Texture): AnimatedSprite {
    const flower = new AnimatedSprite(this.sliceHorizontal(texture, 5))
    flower.animationSpeed = 5 / 60
    flower.loop = true
    flower.play()
    return flower
  }

  private sliceHorizontal(texture: Texture, count: number): Texture[] {
    const frameWidth = texture.source.width / count
    return Array.from({ length: count }, (_, index) => new Texture({
      source: texture.source,
      frame: new Rectangle(index * frameWidth, 0, frameWidth, texture.source.height),
    }))
  }
}
