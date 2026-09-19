import { describe, expect, it } from 'vitest'
import { TiledWorldImporter } from '../src/game/world/tiled/TiledWorldImporter'
import type { TiledMapDocument, TiledProperty } from '../src/game/world/tiled/types'

const prop = (name: string, type: string, value: unknown): TiledProperty => ({
  name,
  type,
  value,
})

function baseMap(): TiledMapDocument {
  return {
    type: 'map',
    orientation: 'orthogonal',
    width: 2,
    height: 2,
    tilewidth: 16,
    tileheight: 16,
    layers: [
      {
        name: 'Ground',
        type: 'tilelayer',
        width: 2,
        height: 2,
        data: [1, 2, 0, 0],
      },
      {
        name: 'Decoration',
        type: 'tilelayer',
        width: 2,
        height: 2,
        data: [0, 0, 3, 0],
        properties: [prop('zIndex', 'int', 12)],
      },
      {
        name: 'AbovePlayer',
        type: 'tilelayer',
        width: 2,
        height: 2,
        data: [0, 0, 0, 4],
      },
      {
        name: 'Collision',
        type: 'tilelayer',
        width: 2,
        height: 2,
        data: [1, 0, 0, 0],
        visible: false,
      },
      {
        name: 'Encounter',
        type: 'tilelayer',
        width: 2,
        height: 2,
        data: [0, 1, 0, 0],
        visible: false,
      },
      {
        name: 'PlayerSpawn',
        type: 'objectgroup',
        objects: [{
          id: 1,
          x: 16,
          y: 16,
          point: true,
          properties: [prop('spawnDirection', 'string', 'right')],
        }],
      },
      {
        name: 'Transitions',
        type: 'objectgroup',
        objects: [{
          id: 2,
          name: 'Exit',
          x: 0,
          y: 16,
          width: 16,
          height: 16,
          properties: [
            prop('destinationScene', 'string', 'res://Destination.tscn'),
            prop('spawnX', 'int', 3),
            prop('spawnY', 'int', 4),
            prop('spawnDirection', 'string', 'left'),
            prop('invisible', 'bool', true),
          ],
        }],
      },
      {
        name: 'CameraBounds',
        type: 'objectgroup',
        objects: [{
          id: 3,
          x: 0,
          y: 0,
          width: 32,
          height: 32,
        }],
      },
    ],
    tilesets: [{
      firstgid: 1,
      name: 'fixture',
      tilewidth: 16,
      tileheight: 16,
      columns: 2,
      tilecount: 4,
      image: '../../assets/Tilesets/fixture.png',
    }],
    properties: [
      prop('sceneName', 'string', 'Fixture Route'),
      prop('encounterTable', 'string', 'fixture-route'),
    ],
  }
}

describe('TiledWorldImporter', () => {
  it('projects Tiled visual layers into world and foreground tiles', () => {
    const scene = new TiledWorldImporter().parseMap(
      baseMap(),
      '/monster-world/maps/fixture.json',
    )

    expect(scene.name).toBe('Fixture Route')
    expect(scene.encounterTableId).toBe('fixture-route')
    expect(scene.tiles.filter((tile) => tile.texturePath)).toHaveLength(3)
    expect(scene.foregroundTiles).toHaveLength(1)

    expect(scene.tiles.find((tile) => tile.x === 1 && tile.y === 0 && tile.texturePath))
      .toMatchObject({
        texturePath: '/assets/Tilesets/fixture.png',
        sourceX: 16,
        sourceY: 0,
        zIndex: 0,
      })
    expect(scene.tiles.find((tile) => tile.x === 0 && tile.y === 1 && tile.texturePath))
      .toMatchObject({
        sourceX: 0,
        sourceY: 16,
        zIndex: 12,
      })
    expect(scene.foregroundTiles?.[0]).toMatchObject({
      x: 1,
      y: 1,
      sourceX: 16,
      sourceY: 16,
    })
  })

  it('projects collision and encounter marker layers without rendering them', () => {
    const scene = new TiledWorldImporter().parseMap(baseMap())

    expect(scene.tiles).toContainEqual(expect.objectContaining({
      x: 0,
      y: 0,
      tileId: -1,
      blocked: true,
    }))
    expect(scene.tiles).toContainEqual(expect.objectContaining({
      x: 1,
      y: 0,
      tileId: -1,
      encounterZone: true,
    }))
    expect(scene.tiles.filter((tile) => tile.tileId === -1 && !tile.texturePath)).toHaveLength(2)
  })

  it('projects player spawn, transitions and explicit camera bounds', () => {
    const scene = new TiledWorldImporter().parseMap(baseMap())
    const player = scene.objects.find((object) => object.instancePath === 'res://Player.tscn')

    expect(player?.position).toEqual({ x: 16, y: 16 })
    expect(scene.doors).toEqual([{
      tile: { x: 0, y: 1 },
      nextScene: 'res://Destination.tscn',
      spawnTile: { x: 3, y: 4 },
      spawnDirection: 'left',
      invisible: true,
    }])
    expect(scene.cameraBounds).toEqual({ x: 0, y: 0, width: 32, height: 32 })
  })

  it('preserves Tiled horizontal, vertical and diagonal transform flags', () => {
    const map = baseMap()
    const ground = map.layers[0]
    if (ground.type !== 'tilelayer') throw new Error('Fixture Ground layer missing')
    ground.data = [
      0x80000000 + 1,
      0x40000000 + 2,
      0x20000000 + 3,
      0,
    ]

    const scene = new TiledWorldImporter().parseMap(map)

    const visual = scene.tiles.filter((tile) => tile.texturePath)
    expect(visual[0]).toMatchObject({ flipX: true, flipY: false, transpose: false })
    expect(visual[1]).toMatchObject({ flipX: false, flipY: true, transpose: false })
    expect(visual[2]).toMatchObject({ flipX: false, flipY: false, transpose: true })
  })

  it('defaults camera bounds to the full finite map when no override is present', () => {
    const map = baseMap()
    map.layers = map.layers.filter((layer) => layer.name !== 'CameraBounds')

    const scene = new TiledWorldImporter().parseMap(map)

    expect(scene.cameraBounds).toEqual({ x: 0, y: 0, width: 32, height: 32 })
  })

  it('rejects unsupported map geometry and semantic tile layers', () => {
    const importer = new TiledWorldImporter()

    expect(() => importer.parseMap({ ...baseMap(), orientation: 'isometric' }))
      .toThrow('orthogonal')
    expect(() => importer.parseMap({ ...baseMap(), tilewidth: 32 }))
      .toThrow('16x16')

    const unknownLayer = baseMap()
    unknownLayer.layers = [
      ...unknownLayer.layers,
      {
        name: 'TypoGround',
        type: 'tilelayer',
        width: 2,
        height: 2,
        data: [0, 0, 0, 0],
      },
    ]
    expect(() => importer.parseMap(unknownLayer)).toThrow('Unsupported Tiled tile layer')
  })

  it('rejects malformed transitions instead of silently creating broken doors', () => {
    const map = baseMap()
    const transitions = map.layers.find((layer) => layer.name === 'Transitions')
    if (!transitions || transitions.type !== 'objectgroup') throw new Error('Fixture Transitions missing')
    transitions.objects[0].properties = [
      prop('destinationScene', 'string', 'res://Destination.tscn'),
    ]

    expect(() => new TiledWorldImporter().parseMap(map))
      .toThrow('requires destinationScene, spawnX and spawnY')
  })

  it('rejects maps without one canonical player spawn', () => {
    const map = baseMap()
    map.layers = map.layers.filter((layer) => layer.name !== 'PlayerSpawn')

    expect(() => new TiledWorldImporter().parseMap(map))
      .toThrow('requires exactly one PlayerSpawn object')
  })
})
