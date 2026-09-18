import { describe, expect, it } from 'vitest'
import {
  DUSKMIRE_MARSH_SCENE,
  FROSTHOLLOW_CAVERN_SCENE,
  NATIVE_BIOME_SCENES,
  TIDEWATER_COAST_SCENE,
  decorateLegacyScene,
  getNativeSceneDefinition,
  listTownBiomeGateways,
} from '../src/game/world/NativeSceneCatalog'
import type { ImportedSceneDefinition } from '../src/game/world/types'

function emptyScene(): ImportedSceneDefinition {
  return {
    name: 'Town',
    tiles: [],
    ledgeTiles: [],
    objects: [],
    doors: [],
  }
}

describe('native biome scenes', () => {
  it('defines three deterministic Monster World biome scenes', () => {
    expect(NATIVE_BIOME_SCENES).toEqual([
      TIDEWATER_COAST_SCENE,
      FROSTHOLLOW_CAVERN_SCENE,
      DUSKMIRE_MARSH_SCENE,
    ])

    for (const scenePath of NATIVE_BIOME_SCENES) {
      const scene = getNativeSceneDefinition(scenePath)
      expect(scene).not.toBeNull()
      expect(scene?.tiles).toHaveLength(26 * 20)
      expect(scene?.objects.some((object) => object.instancePath === 'res://Player.tscn')).toBe(true)
      expect(scene?.doors).toHaveLength(1)
      expect(scene?.doors[0].nextScene).toBe('res://Town.tscn')
    }
  })

  it('marks encounter terrain without pretending it is TallGrass', () => {
    for (const scenePath of NATIVE_BIOME_SCENES) {
      const scene = getNativeSceneDefinition(scenePath)
      const encounterTiles = scene?.tiles.filter((tile) => tile.encounterZone) ?? []
      expect(encounterTiles.length).toBeGreaterThan(100)
      expect(encounterTiles.every((tile) => !tile.blocked && tile.tileId !== 2)).toBe(true)
    }
  })

  it('blocks map boundaries and leaves the return door traversable by WorldScene', () => {
    for (const scenePath of NATIVE_BIOME_SCENES) {
      const scene = getNativeSceneDefinition(scenePath)
      const boundary = scene?.tiles.filter((tile) =>
        tile.x === 0 || tile.y === 0 || tile.x === 25 || tile.y === 19
      ) ?? []
      expect(boundary).toHaveLength(2 * 26 + 2 * 18)
      expect(boundary.every((tile) => tile.blocked)).toBe(true)
      expect(scene?.doors[0].tile).toEqual({ x: 13, y: 19 })
    }
  })

  it('decorates Town with three off-screen biome gateways without mutating the source scene', () => {
    const source = emptyScene()
    const decorated = decorateLegacyScene('res://Town.tscn', source)
    const gateways = listTownBiomeGateways()

    expect(source.doors).toHaveLength(0)
    expect(source.objects).toHaveLength(0)
    expect(decorated.doors).toHaveLength(3)
    expect(decorated.objects).toHaveLength(3)
    expect(decorated.doors.map((door) => door.nextScene)).toEqual(NATIVE_BIOME_SCENES)
    expect(gateways.map((gateway) => gateway.tile.y)).toEqual([-24, -24, -24])
    expect(gateways.every((gateway) => gateway.returnSpawn.y === -23)).toBe(true)
  })

  it('does not decorate non-Town legacy scenes', () => {
    const source = emptyScene()
    expect(decorateLegacyScene('res://OaksLab.tscn', source)).toBe(source)
    expect(getNativeSceneDefinition('res://Town.tscn')).toBeNull()
  })
})
