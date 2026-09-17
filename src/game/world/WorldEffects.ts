import { AnimatedSprite, Assets, Container, Rectangle, Sprite, Texture } from 'pixi.js'
import { TILE_SIZE } from '../constants'
import type { GridPoint } from './types'

export class WorldEffects {
  constructor(private readonly layer: Container) {}

  async grassStep(tile: GridPoint): Promise<void> {
    const [overlayTexture, effectTexture] = await Promise.all([
      Assets.load<Texture>('/assets/Grass/stepped_tall_grass.png'),
      Assets.load<Texture>('/assets/Grass/grass_step_animation.png'),
    ])
    overlayTexture.source.scaleMode = 'nearest'
    effectTexture.source.scaleMode = 'nearest'

    const overlay = new Sprite(overlayTexture)
    overlay.position.set(tile.x * TILE_SIZE, tile.y * TILE_SIZE)
    overlay.zIndex = tile.y * TILE_SIZE + TILE_SIZE + 1
    overlay.roundPixels = true
    this.layer.addChild(overlay)

    const effect = new AnimatedSprite(this.sliceHorizontal(effectTexture, 4))
    effect.position.copyFrom(overlay.position)
    effect.zIndex = overlay.zIndex + 1
    effect.roundPixels = true
    effect.animationSpeed = 10 / 60
    effect.loop = false
    effect.onComplete = () => {
      if (!effect.destroyed) effect.destroy()
      if (!overlay.destroyed) overlay.destroy()
    }
    this.layer.addChild(effect)
    effect.play()
  }

  async landingDust(tile: GridPoint): Promise<void> {
    const texture = await Assets.load<Texture>('/assets/Player/jump_landing_dust.png')
    texture.source.scaleMode = 'nearest'
    const dust = new AnimatedSprite(this.sliceHorizontal(texture, 3))
    dust.position.set(tile.x * TILE_SIZE, tile.y * TILE_SIZE)
    dust.zIndex = tile.y * TILE_SIZE + TILE_SIZE + 2
    dust.roundPixels = true
    dust.animationSpeed = 5 / 60
    dust.loop = false
    dust.onComplete = () => {
      if (!dust.destroyed) dust.destroy()
    }
    this.layer.addChild(dust)
    dust.play()
  }

  private sliceHorizontal(texture: Texture, count: number): Texture[] {
    const frameWidth = texture.source.width / count
    return Array.from({ length: count }, (_, index) => new Texture({
      source: texture.source,
      frame: new Rectangle(index * frameWidth, 0, frameWidth, texture.source.height),
    }))
  }
}
