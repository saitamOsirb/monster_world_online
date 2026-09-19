import frosthollowMap from '../public/monster-world/maps/frosthollow-cavern.json'
import { TiledWorldImporter } from '../src/game/world/tiled/TiledWorldImporter'
import {
  FROSTHOLLOW_CAVERN_SCENE,
  getTiledWorldMapUrl,
  listTiledWorldScenes,
} from '../src/game/world/tiled/catalog'
import { describe, expect, it } from 'vitest'

const MAP_URL = '/monster-world/maps/frosthollow-cavern.json'
const TRAILHEAD_SCENE = 'res://MonsterWorld/TrailheadRoute.tscn'
const PLAYER_SCENE = 'res://Player.tscn'

function loadFrosthollowScene() {
  return new TiledWorldImporter().parseMap(frosthollowMap, MAP_URL)
}

describe('Frosthollow Cavern Tiled map', () => {
  it('is registered as a Tiled world scene', () => {
    expect(getTiledWorldMapUrl(FROSTHOLLOW_CAVERN_SCENE)).toBe(MAP_URL)
    expect(listTiledWorldScenes()).toContain(FROSTHOLLOW_CAVERN_SCENE)
  })

  it('preserves the 26x20 gameplay geometry and Trailhead transition', () => {
    const scene = loadFrosthollowScene()
    const visualTiles = scene.tiles.filter((tile) => tile.texturePath)
    const blockedMarkers = scene.tiles.filter((tile) => tile.blocked)
    const encounterMarkers = scene.tiles.filter((tile) => tile.encounterZone)

    expect(scene.name).toBe('Frosthollow Cavern')
    expect(scene.encounterTableId).toBe('frosthollow-cavern')
    expect(scene.cameraBounds).toEqual({ x: 0, y: 0, width: 26 * 16, height: 20 * 16 })
    expect(scene.spawnDirection).toBe('down')
    expect(visualTiles).toHaveLength(26 * 20)
    expect(blockedMarkers).toHaveLength(106)
    expect(encounterMarkers).toHaveLength(238)
    expect(scene.doors).toEqual([{
      tile: { x: 13, y: 19 },
      nextScene: TRAILHEAD_SCENE,
      spawnTile: { x: 20, y: 1 },
      spawnDirection: 'down',
      invisible: true,
    }])
  })

  it('preserves Frosthollow terrain partitions and animated water', () => {
    const scene = loadFrosthollowScene()
    const visualTiles = scene.tiles.filter((tile) => tile.texturePath)
    const ground = visualTiles.filter((tile) => tile.tint === 0xc7e2f4)
    const boundary = visualTiles.filter((tile) => tile.tint === 0x7696ac)
    const encounterGround = visualTiles.filter((tile) => tile.tint === 0xa9d0eb)
    const water = visualTiles.filter((tile) => tile.tileId === 2)

    expect(ground).toHaveLength(176)
    expect(boundary).toHaveLength(88)
    expect(encounterGround).toHaveLength(238)
    expect(water).toHaveLength(18)
    expect(water.every((tile) =>
      tile.texturePath === '/assets/Water/water_tileset1.png'
      && tile.tint === 0xffffff
    )).toBe(true)
  })

  it('keeps the canonical spawn traversable and outside encounter terrain', () => {
    const scene = loadFrosthollowScene()
    const player = scene.objects.find((object) => object.instancePath === PLAYER_SCENE)
    const spawn = { x: 13, y: 17 }

    expect(player?.position).toEqual({ x: spawn.x * 16, y: spawn.y * 16 })
    expect(scene.tiles.some((tile) => tile.x === spawn.x && tile.y === spawn.y && tile.blocked)).toBe(false)
    expect(scene.tiles.some((tile) => tile.x === spawn.x && tile.y === spawn.y && tile.encounterZone)).toBe(false)
  })
})
