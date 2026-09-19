import { Assets, Container, Rectangle, Sprite, Texture } from 'pixi.js'
import { TILE_SIZE } from '../constants'
import type { TileDefinition } from './types'

interface TileSource {
  path: string
  originX: number
  originY: number
}

interface AnimatedWaterTile {
  sprite: Sprite
  frames: Texture[]
}

const TILE_SOURCES: Record<number, TileSource> = {
  0: { path: '/assets/Tilesets/grass1_tileset.png', originX: 48, originY: 0 },
  1: { path: '/assets/Tilesets/grass1_tileset.png', originX: 0, originY: 0 },
  2: { path: '/assets/Water/water_tileset1.png', originX: 0, originY: 0 },
  3: { path: '/assets/Tilesets/grass2_tileset.png', originX: 0, originY: 0 },
}

const WATER_PATHS = Array.from({ length: 8 }, (_, index) => `/assets/Water/water_tileset${index + 1}.png`)
const WATER_FRAME_DURATION_MS = 250

export class TileMapRenderer {
  readonly view = new Container()

  private readonly animatedWater: AnimatedWaterTile[] = []
  private waterElapsedMs = 0
  private waterFrame = 0

  constructor() {
    this.view.sortableChildren = true
  }

  async render(tiles: TileDefinition[]): Promise<void> {
    this.view.removeChildren().forEach((child) => child.destroy())
    this.animatedWater.length = 0
    this.waterElapsedMs = 0
    this.waterFrame = 0

    const paths = new Set(
      tiles
        .map((tile) => tile.texturePath ?? TILE_SOURCES[tile.tileId]?.path)
        .filter((path): path is string => Boolean(path)),
    )
    if (tiles.some((tile) => tile.tileId === 2)) {
      WATER_PATHS.forEach((path) => paths.add(path))
    }

    const textures = new Map<string, Texture>()
    await Promise.all([...paths].map(async (path) => {
      const texture = await Assets.load<Texture>(path)
      texture.source.scaleMode = 'nearest'
      textures.set(path, texture)
    }))

    const waterFrameCache = new Map<string, Texture[]>()

    for (const tile of tiles) {
      const source = this.resolveTileSource(tile)
      if (!source) continue
      const base = textures.get(source.path)
      if (!base) continue

      let frame: Texture
      let waterFrames: Texture[] | undefined
      if (tile.tileId === 2) {
        const cacheKey = `${tile.autotileX},${tile.autotileY}`
        waterFrames = waterFrameCache.get(cacheKey)
        if (!waterFrames) {
          waterFrames = WATER_PATHS.map((path) => {
            const waterBase = textures.get(path)
            if (!waterBase) throw new Error(`Missing synchronized water texture: ${path}`)
            return this.createFrame(waterBase, source, tile)
          })
          waterFrameCache.set(cacheKey, waterFrames)
        }
        frame = waterFrames[0]
      } else {
        frame = this.createFrame(base, source, tile)
      }

      const sprite = new Sprite(frame)
      sprite.position.set(tile.x * TILE_SIZE, tile.y * TILE_SIZE)
      if (tile.tint !== undefined) sprite.tint = tile.tint
      sprite.roundPixels = true
      sprite.zIndex = tile.zIndex ?? 0

      if (tile.transpose) sprite.rotation = Math.PI / 2
      if (tile.flipX) {
        sprite.scale.x *= -1
        sprite.x += TILE_SIZE
      }
      if (tile.flipY) {
        sprite.scale.y *= -1
        sprite.y += TILE_SIZE
      }

      if (waterFrames) this.animatedWater.push({ sprite, frames: waterFrames })
      this.view.addChild(sprite)
    }
  }

  update(deltaMs: number): void {
    if (this.animatedWater.length === 0) return
    this.waterElapsedMs += deltaMs
    if (this.waterElapsedMs < WATER_FRAME_DURATION_MS) return

    const advance = Math.floor(this.waterElapsedMs / WATER_FRAME_DURATION_MS)
    this.waterElapsedMs %= WATER_FRAME_DURATION_MS
    this.waterFrame = (this.waterFrame + advance) % WATER_PATHS.length
    for (const water of this.animatedWater) {
      water.sprite.texture = water.frames[this.waterFrame]
    }
  }

  private resolveTileSource(tile: TileDefinition): TileSource | undefined {
    if (!tile.texturePath) return TILE_SOURCES[tile.tileId]
    return {
      path: tile.texturePath,
      originX: tile.sourceX ?? 0,
      originY: tile.sourceY ?? 0,
    }
  }

  private createFrame(base: Texture, source: TileSource, tile: TileDefinition): Texture {
    return new Texture({
      source: base.source,
      frame: new Rectangle(
        source.originX + tile.autotileX * TILE_SIZE,
        source.originY + tile.autotileY * TILE_SIZE,
        TILE_SIZE,
        TILE_SIZE,
      ),
    })
  }
}
