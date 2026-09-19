import townMap from '../public/monster-world/maps/town.json'
import { TiledWorldImporter } from '../src/game/world/tiled/TiledWorldImporter'
import {
  TOWN_SCENE,
  TRAILHEAD_ROUTE_SCENE,
  getTiledWorldMapUrl,
  listTiledWorldScenes,
} from '../src/game/world/tiled/catalog'
import { describe, expect, it } from 'vitest'

const MAP_URL = '/monster-world/maps/town.json'
const PLAYER_SCENE = 'res://Player.tscn'
const TREE_SCENE = 'res://Tree.tscn'
const FLOWER_SCENE = 'res://Flower.tscn'
const TALL_GRASS_SCENE = 'res://TallGrass.tscn'
const HOUSE_SCENE = 'res://House.tscn'

function loadTownScene() {
  return new TiledWorldImporter().parseMap(townMap, MAP_URL)
}

describe('Town Tiled map', () => {
  it('is registered as a first-class Tiled world scene', () => {
    expect(getTiledWorldMapUrl(TOWN_SCENE)).toBe(MAP_URL)
    expect(listTiledWorldScenes()).toContain(TOWN_SCENE)
  })

  it('preserves the legacy Town geometry, collision and encounter topology', () => {
    const scene = loadTownScene()
    const visualTiles = scene.tiles.filter((tile) => tile.texturePath)
    const blockedMarkers = scene.tiles.filter((tile) => tile.blocked)
    const encounterMarkers = scene.tiles.filter((tile) => tile.encounterZone)

    expect(scene.name).toBe('Town')
    expect(scene.encounterTableId).toBe('town-grass')
    expect(scene.spawnDirection).toBe('down')
    expect(scene.cameraBounds).toEqual({
      x: -25 * 16,
      y: -26 * 16,
      width: 66 * 16,
      height: 58 * 16,
    })
    expect(visualTiles).toHaveLength(3762)
    expect(blockedMarkers).toHaveLength(1697)
    expect(encounterMarkers).toHaveLength(45)
  })

  it('preserves legacy terrain sources and synchronized animated water', () => {
    const scene = loadTownScene()
    const visualTiles = scene.tiles.filter((tile) => tile.texturePath)
    const grass1 = visualTiles.filter((tile) =>
      tile.texturePath === '/assets/Tilesets/grass1_tileset.png'
    )
    const grass2 = visualTiles.filter((tile) =>
      tile.texturePath === '/assets/Tilesets/grass2_tileset.png'
    )
    const water = visualTiles.filter((tile) => tile.tileId === 2)

    expect(grass1).toHaveLength(3075)
    expect(grass2).toHaveLength(319)
    expect(water).toHaveLength(368)
    expect(water.every((tile) =>
      tile.texturePath === '/assets/Water/water_tileset1.png'
    )).toBe(true)
  })

  it('preserves all world objects and the canonical player spawn', () => {
    const scene = loadTownScene()
    const byInstance = (instancePath: string) =>
      scene.objects.filter((object) => object.instancePath === instancePath)
    const player = byInstance(PLAYER_SCENE)[0]

    expect(scene.objects).toHaveLength(382)
    expect(byInstance(TREE_SCENE)).toHaveLength(316)
    expect(byInstance(FLOWER_SCENE)).toHaveLength(16)
    expect(byInstance(TALL_GRASS_SCENE)).toHaveLength(45)
    expect(byInstance(HOUSE_SCENE)).toHaveLength(3)
    expect(player?.position).toEqual({ x: 224, y: 208 })

    const oaksLab = byInstance(HOUSE_SCENE).find((object) => object.name === 'OaksLab')
    expect(oaksLab?.texturePath).toBe('/assets/Buildings/oaks_lab.png')
    expect(scene.objects).toContainEqual(expect.objectContaining({
      name: 'Trailhead Route Gate',
      texturePath: '/assets/Buildings/pallet%20town/mat.png',
      position: { x: 112, y: -384 },
    }))
  })

  it('preserves all Town transitions including the Trailhead gateway', () => {
    const scene = loadTownScene()

    expect(scene.doors).toEqual([
      {
        tile: { x: -4, y: 4 },
        nextScene: 'res://PlayerHomeFloor1.tscn',
        spawnTile: { x: 4, y: 8 },
        spawnDirection: 'up',
        invisible: false,
        animationTexturePath: '/assets/Buildings/Door%20Animations/house1.png',
      },
      {
        tile: { x: 12, y: 4 },
        nextScene: 'res://RivalHomeFloor.tscn',
        spawnTile: { x: 4, y: 8 },
        spawnDirection: 'up',
        invisible: false,
        animationTexturePath: '/assets/Buildings/Door%20Animations/house1.png',
      },
      {
        tile: { x: 14, y: 12 },
        nextScene: 'res://OaksLab.tscn',
        spawnTile: { x: 4, y: 12 },
        spawnDirection: 'up',
        invisible: false,
        animationTexturePath: '/assets/Buildings/Door%20Animations/oaks_lab.png',
      },
      {
        tile: { x: 7, y: -24 },
        nextScene: TRAILHEAD_ROUTE_SCENE,
        spawnTile: { x: 20, y: 27 },
        spawnDirection: 'up',
        invisible: true,
      },
    ])
  })

  it('keeps the player spawn and every transition tile traversable', () => {
    const scene = loadTownScene()
    const blocked = new Set(
      scene.tiles
        .filter((tile) => tile.blocked)
        .map((tile) => `${tile.x},${tile.y}`),
    )

    expect(blocked.has('14,13')).toBe(false)
    expect(scene.tiles.some((tile) =>
      tile.x === 14 && tile.y === 13 && tile.encounterZone
    )).toBe(false)

    for (const door of scene.doors) {
      expect(blocked.has(`${door.tile.x},${door.tile.y}`)).toBe(false)
    }
  })
})
