import { Assets, Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js'
import { TILE_SIZE, type Direction } from '../constants'
import { getNpcsForScene, type UnlockPredicate } from '../interaction/npcs'
import type { InteractableNpcDefinition } from '../interaction/types'
import { WorldScene } from './WorldScene'

export class NpcWorldLayer {
  private readonly actors: Container[] = []

  constructor(
    private readonly world: WorldScene,
    private readonly enabled = true,
    private readonly isUnlocked: UnlockPredicate = () => false,
  ) {}

  clear(): void {
    for (const actor of this.actors) {
      this.world.removeActor(actor)
      actor.destroy({ children: true })
    }
    this.actors.length = 0
  }

  async loadScene(scenePath: string | null): Promise<void> {
    this.clear()
    if (!this.enabled || !scenePath) return

    for (const npc of getNpcsForScene(scenePath, this.isUnlocked)) {
      this.world.collision.setBlocked(npc.tile)
      const actor = await this.createActor(npc)
      this.actors.push(actor)
      this.world.addActor(actor)
    }
  }

  private async createActor(npc: InteractableNpcDefinition): Promise<Container> {
    const sheet = await Assets.load<Texture>(npc.texturePath)
    sheet.source.scaleMode = 'nearest'

    const actor = new Container()
    actor.position.set(npc.tile.x * TILE_SIZE, npc.tile.y * TILE_SIZE)
    actor.zIndex = actor.y + TILE_SIZE

    const sprite = new Sprite(this.standingFrame(sheet, npc.facing))
    sprite.y = -4
    sprite.roundPixels = true
    if (npc.facing === 'right') {
      sprite.scale.x = -1
      sprite.anchor.x = 1
    }

    const merchantMarker = new Graphics()
      .circle(TILE_SIZE / 2, -8, 3)
      .fill(0xffd166)
      .circle(TILE_SIZE / 2, -8, 1)
      .fill(0x6c5420)

    actor.addChild(sprite, merchantMarker)
    return actor
  }

  private standingFrame(sheet: Texture, direction: Direction): Texture {
    const frameWidth = sheet.source.width / 3
    const frameHeight = sheet.source.height / 3
    const row = direction === 'down' ? 0 : direction === 'up' ? 1 : 2
    return new Texture({
      source: sheet.source,
      frame: new Rectangle(frameWidth, row * frameHeight, frameWidth, frameHeight),
    })
  }
}
