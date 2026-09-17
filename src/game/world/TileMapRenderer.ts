import { Assets, Container, Rectangle, Sprite, Texture } from 'pixi.js'
import { TILE_SIZE } from '../constants'
import type { TileDefinition } from './types'

interface TileSource {
  path: string
  originX: number
  originY: number
}

const TILE_SOURCES: Record<number, TileSource> = {
  0: { path: '/assets/Tilesets/grass1_tileset.png', originX: 48, originY: 0 },
  1: { path: '/assets/Tilesets/grass1_tileset.png', originX: 0, originY: 0 },
  2: { path: '/assets/Water/water_tileset1.png', originX: 0, originY: 0 },
  3: { path: '/assets/Tilesets/grass2_tileset.png', originX: 0, originY: 0 },
}

export class TileMapRenderer {
  readonly view = new Container()

  async render(tiles: TileDefinition[]): Promise<void> {
    this.view.removeChildren().forEach((child) => child.destroy())
    const uniquePaths = [...new Set(tiles.map((tile) => TILE_SOURCES[tile.tileId]?.path).filter((path): path is string => Boolean(path)))]
    const textures = new Map<string, Texture>()

    await Promise.all(uniquePaths.map(async (path) => {
      const texture = await Assets.load<Texture>(path)
      texture.source.scaleMode = 'nearest'
      textures.set(path, texture)
    }))

    for (const tile of tiles) {
      const source = TILE_SOURCES[tile.tileId]
      if (!source) continue
      const base = textures.get(source.path)
      if (!base) continue

      const frame = new Texture({
        source: base.source,
        frame: new Rectangle(
          source.originX + tile.autotileX * TILE_SIZE,
          source.originY + tile.autotileY * TILE_SIZE,
          TILE_SIZE,
          TILE_SIZE,
        ),
      })
      const sprite = new Sprite(frame)
      sprite.position.set(tile.x * TILE_SIZE, tile.y * TILE_SIZE)
      sprite.roundPixels = true

      if (tile.transpose) sprite.rotation = Math.PI / 2
      if (tile.flipX) {
        sprite.scale.x *= -1
        sprite.x += TILE_SIZE
      }
      if (tile.flipY) {
        sprite.scale.y *= -1
        sprite.y += TILE_SIZE
      }

      this.view.addChild(sprite)
    }
  }
}
