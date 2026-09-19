import { describe, expect, it } from 'vitest'
import tidewaterMap from '../public/monster-world/maps/tidewater-coast.json'
import { TiledWorldImporter } from '../src/game/world/tiled/TiledWorldImporter'
import {
  TIDEWATER_COAST_SCENE,
  getTiledWorldMapUrl,
  listTiledWorldScenes,
} from '../src/game/world/tiled/catalog'

const MAP_URL = '/monster-world/maps/tidewater-coast.json'
function loadTidewaterScene() {
  return new TiledWorldImporter().parseMap(tidewaterMap, MAP_URL)
}

describe('Tidewater Coast Tiled map', () => {
  it('is registered as a Tiled world scene', () => {
    expect(getTiledWorldMapUrl(TIDEWATER_COAST_SCENE)).toBe(MAP_URL)
    expect(listTiledWorldScenes()).toContain(TIDEWATER_COAST_SCENE)
  })

  it('preserves the 26x20 gameplay geometry and route transition', () => {
    const scene = loadTidewaterScene()
    const visualTiles = scene.tiles.filter((tile) => tile.texturePath)
    const blockedMarkers = scene.tiles.filter((tile) => tile.blocked)
    const encounterMarkers = scene.tiles.filter((tile) => tile.encounterZone)

    expect(scene.name).toBe('Tidewater Coast')
    expect(scene.encounterTableId).toBe('tidewater-coast')
    expect(scene.cameraBounds).toEqual({ x: 0, y: 0, width: 26 * 16, height: 20 * 16 })
    expect(scene.spawnDirection).toBe('down')
    expect(visualTiles).toHaveLength(26 * 20)
    expect(blockedMarkers).toHaveLength(136)
    expect(encounterMarkers).toHaveLength(220)
    expect(scene.doors).toEqual([{
      tile: { x: 13, y: 19 },
      nextScene: 'res://MonsterWorld/TrailheadRoute.tscn',
      spawnTile: { x: 7, y: 1 },
      spawnDirection: 'down',
      invisible: true,
    }])
  })

  it('preserves animated water and distinct Coast terrain tints', () => {
    const scene = loadTidewaterScene()
    const visualTiles = scene.tiles.filter((tile) => tile.texturePath)
    const water = visualTiles.filter((tile) => tile.tileId === 2)
    const encounterGround = visualTiles.filter((tile) => tile.tint === 0xcdbf82)
    const regularGround = visualTiles.filter((tile) => tile.tint === 0xe2d49b)

    expect(water).toHaveLength(136)
    expect(water.every((tile) =>
      tile.texturePath === '/assets/Water/water_tileset1.png'
      && tile.tint === 0xffffff
    )).toBe(true)
    expect(encounterGround).toHaveLength(220)
    expect(regularGround).toHaveLength(164)
  })

  it('keeps the canonical player spawn outside blocked and encounter markers', () => {
    const scene = loadTidewaterScene()
    const player = scene.objects.find((object) => object.instancePath === 'res://Player.tscn')
    const spawn = { x: 13, y: 17 }

    expect(player?.position).toEqual({ x: spawn.x * 16, y: spawn.y * 16 })
    expect(scene.tiles.some((tile) => tile.x === spawn.x && tile.y === spawn.y && tile.blocked)).toBe(false)
    expect(scene.tiles.some((tile) => tile.x === spawn.x && tile.y === spawn.y && tile.encounterZone)).toBe(false)
  })
})
