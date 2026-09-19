import { describe, expect, it } from 'vitest'
import {
  DUSKMIRE_MARSH_SCENE,
  FROSTHOLLOW_CAVERN_SCENE,
  NATIVE_BIOME_SCENES,
  RESEARCH_STATION_SCENE,
  TIDEWATER_COAST_SCENE,
  decorateLegacyScene,
  getNativeSceneDefinition,
  listTownWorldGateways,
} from '../src/game/world/NativeSceneCatalog'
import { TRAILHEAD_ROUTE_SCENE } from '../src/game/world/tiled/catalog'
import type { ImportedSceneDefinition } from '../src/game/world/types'

const TOWN_SCENE = 'res://Town.tscn'

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
      expect(scene?.doors[0].nextScene).toBe(TRAILHEAD_ROUTE_SCENE)
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

  it('decorates Town with one off-screen world gateway without mutating the source scene', () => {
    const source = emptyScene()
    const decorated = decorateLegacyScene(TOWN_SCENE, source)
    const gateways = listTownWorldGateways()

    expect(source.doors).toHaveLength(0)
    expect(source.objects).toHaveLength(0)
    expect(decorated.doors).toHaveLength(1)
    expect(decorated.objects).toHaveLength(1)
    expect(decorated.doors[0]).toMatchObject({
      nextScene: TRAILHEAD_ROUTE_SCENE,
      spawnTile: { x: 20, y: 27 },
      spawnDirection: 'up',
    })
    expect(gateways).toEqual([expect.objectContaining({
      scenePath: TRAILHEAD_ROUTE_SCENE,
      tile: { x: 7, y: -24 },
      returnSpawn: { x: 7, y: -23 },
      name: 'Trailhead Route Gate',
    })])
  })

  it('returns each native biome to its dedicated Trailhead branch', () => {
    const expected = new Map([
      [TIDEWATER_COAST_SCENE, { x: 7, y: 1 }],
      [FROSTHOLLOW_CAVERN_SCENE, { x: 20, y: 1 }],
      [DUSKMIRE_MARSH_SCENE, { x: 33, y: 1 }],
    ])

    for (const [scenePath, spawnTile] of expected) {
      expect(getNativeSceneDefinition(scenePath)?.doors[0]).toMatchObject({
        nextScene: TRAILHEAD_ROUTE_SCENE,
        spawnTile,
        spawnDirection: 'down',
      })
    }
  })

  it('does not decorate non-Town legacy scenes', () => {
    const source = emptyScene()
    expect(decorateLegacyScene('res://OaksLab.tscn', source)).toBe(source)
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
