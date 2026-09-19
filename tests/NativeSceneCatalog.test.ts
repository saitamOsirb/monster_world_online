import { describe, expect, it } from 'vitest'
import {
  DUSKMIRE_MARSH_SCENE,
  FROSTHOLLOW_CAVERN_SCENE,
  NATIVE_BIOME_SCENES,
  RESEARCH_STATION_SCENE,
  TIDEWATER_COAST_SCENE,
  TOWN_SCENE,
  getNativeSceneDefinition,
} from '../src/game/world/NativeSceneCatalog'

describe('native biome scenes', () => {
  it('has no generated native biomes after Tiled migration', () => {
    expect(NATIVE_BIOME_SCENES).toEqual([])
  })

  it('no longer generates any primary biome from NativeSceneCatalog', () => {
    expect(getNativeSceneDefinition(TIDEWATER_COAST_SCENE)).toBeNull()
    expect(getNativeSceneDefinition(FROSTHOLLOW_CAVERN_SCENE)).toBeNull()
    expect(getNativeSceneDefinition(DUSKMIRE_MARSH_SCENE)).toBeNull()
  })

  it('does not generate Town from NativeSceneCatalog after the Tiled migration', () => {
    expect(getNativeSceneDefinition(TOWN_SCENE)).toBeNull()
  })

  it('defines a deterministic Research Station without encounter terrain', () => {
    const scene = getNativeSceneDefinition(RESEARCH_STATION_SCENE)

    expect(scene?.name).toBe('Research Station')
    expect(scene?.tiles).toHaveLength(16 * 11)
    expect(scene?.tiles.some((tile) => tile.encounterZone)).toBe(false)
    expect(scene?.objects.some((object) => object.instancePath === 'res://Player.tscn')).toBe(true)
    expect(scene?.doors).toHaveLength(1)
    expect(scene?.doors[0]).toMatchObject({
      tile: { x: 8, y: 10 },
      nextScene: TOWN_SCENE,
      spawnTile: { x: 6, y: 2 },
      spawnDirection: 'up',
      invisible: true,
    })
  })

  it('keeps the Research Station central aisle traversable', () => {
    const scene = getNativeSceneDefinition(RESEARCH_STATION_SCENE)
    const aisle = scene?.tiles.filter((tile) => tile.x >= 7 && tile.x <= 8 && tile.y > 0 && tile.y < 10) ?? []

    expect(aisle).toHaveLength(2 * 9)
    expect(aisle.every((tile) => !tile.blocked)).toBe(true)
  })

})
