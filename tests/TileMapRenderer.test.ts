import { describe, expect, it } from 'vitest'
import { tileMapRendererInternals } from '../src/game/world/TileMapRenderer'
import type { TileDefinition } from '../src/game/world/types'

const WATER_TEXTURE_PATH = WATER_TEXTURE_PATH

const baseWaterTile = (): TileDefinition => ({
  x: 0,
  y: 0,
  tileId: 2,
  autotileX: 0,
  autotileY: 0,
  flipX: false,
  flipY: false,
  transpose: false,
})

describe('TileMapRenderer animated water cache', () => {
  it('distinguishes Tiled water frames that use different resolved source offsets', () => {
    const tile = baseWaterTile()

    const first = tileMapRendererInternals.waterFrameCacheKey(
      { path: WATER_TEXTURE_PATH, originX: 0, originY: 0 },
      tile,
    )
    const second = tileMapRendererInternals.waterFrameCacheKey(
      { path: WATER_TEXTURE_PATH, originX: 16, originY: 0 },
      tile,
    )

    expect(first).not.toBe(second)
  })

  it('still distinguishes legacy water autotile coordinates', () => {
    const source = { path: WATER_TEXTURE_PATH, originX: 0, originY: 0 }
    const left = baseWaterTile()
    const right = { ...baseWaterTile(), autotileX: 1 }

    expect(tileMapRendererInternals.waterFrameCacheKey(source, left))
      .not.toBe(tileMapRendererInternals.waterFrameCacheKey(source, right))
  })
})
