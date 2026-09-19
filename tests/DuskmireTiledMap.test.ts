import duskmireMap from '../public/monster-world/maps/duskmire-marsh.json'
import { DUSKMIRE_MARSH_SCENE } from '../src/game/world/NativeSceneCatalog'
import { TiledWorldImporter } from '../src/game/world/tiled/TiledWorldImporter'
import {
  getTiledWorldMapUrl,
  listTiledWorldScenes,
} from '../src/game/world/tiled/catalog'
import { describe, expect, it } from 'vitest'

const MAP_URL = '/monster-world/maps/duskmire-marsh.json'
const TRAILHEAD_SCENE = 'res://MonsterWorld/TrailheadRoute.tscn'
const PLAYER_SCENE = 'res://Player.tscn'

function loadDuskmireScene() {
  return new TiledWorldImporter().parseMap(duskmireMap, MAP_URL)
}

describe('Duskmire Marsh Tiled map', () => {
  it('is registered as a Tiled world scene', () => {
    expect(getTiledWorldMapUrl(DUSKMIRE_MARSH_SCENE)).toBe(MAP_URL)
    expect(listTiledWorldScenes()).toContain(DUSKMIRE_MARSH_SCENE)
  })

  it('preserves the 26x20 gameplay geometry and Trailhead transition', () => {
    const scene = loadDuskmireScene()
    const visualTiles = scene.tiles.filter((tile) => tile.texturePath)
    const blockedMarkers = scene.tiles.filter((tile) => tile.blocked)
    const encounterMarkers = scene.tiles.filter((tile) => tile.encounterZone)

    expect(scene.name).toBe('Duskmire Marsh')
    expect(scene.encounterTableId).toBe('duskmire-marsh')
    expect(scene.cameraBounds).toEqual({ x: 0, y: 0, width: 26 * 16, height: 20 * 16 })
    expect(scene.spawnDirection).toBe('down')
    expect(visualTiles).toHaveLength(26 * 20)
    expect(blockedMarkers).toHaveLength(128)
    expect(encounterMarkers).toHaveLength(216)
    expect(scene.doors).toEqual([{
      tile: { x: 13, y: 19 },
      nextScene: TRAILHEAD_SCENE,
      spawnTile: { x: 33, y: 1 },
      spawnDirection: 'down',
      invisible: true,
    }])
  })

  it('preserves Duskmire terrain partitions and animated water', () => {
    const scene = loadDuskmireScene()
    const visualTiles = scene.tiles.filter((tile) => tile.texturePath)
    const ground = visualTiles.filter((tile) => tile.tint === 0x7d8c69)
    const boundary = visualTiles.filter((tile) => tile.tint === 0x4f5d49)
    const encounterGround = visualTiles.filter((tile) => tile.tint === 0x68775b)
    const water = visualTiles.filter((tile) => tile.tileId === 2)

    expect(ground).toHaveLength(176)
    expect(boundary).toHaveLength(88)
    expect(encounterGround).toHaveLength(216)
    expect(water).toHaveLength(40)
    expect(water.every((tile) =>
      tile.texturePath === '/assets/Water/water_tileset1.png'
      && tile.tint === 0xffffff
    )).toBe(true)
  })

  it('keeps the canonical spawn traversable and outside encounter terrain', () => {
    const scene = loadDuskmireScene()
    const player = scene.objects.find((object) => object.instancePath === PLAYER_SCENE)
    const spawn = { x: 13, y: 17 }

    expect(player?.position).toEqual({ x: spawn.x * 16, y: spawn.y * 16 })
    expect(scene.tiles.some((tile) => tile.x === spawn.x && tile.y === spawn.y && tile.blocked)).toBe(false)
    expect(scene.tiles.some((tile) => tile.x === spawn.x && tile.y === spawn.y && tile.encounterZone)).toBe(false)
  })
})
