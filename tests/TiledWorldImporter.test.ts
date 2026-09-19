import { describe, expect, it } from 'vitest'
import { TiledWorldImporter } from '../src/game/world/tiled/TiledWorldImporter'
import type { TiledMapDocument, TiledProperty } from '../src/game/world/tiled/types'

const TILE_LAYER = 'tilelayer'
const OBJECT_LAYER = 'objectgroup'
const STRING_PROPERTY_TYPE = 'string'
const INT_PROPERTY_TYPE = 'int'
const DESTINATION_SCENE = 'res://Destination.tscn'
const DECORATION_LAYER_NAME = 'Decoration'

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
        type: TILE_LAYER,
        width: 2,
        height: 2,
        data: [1, 2, 0, 0],
      },
      {
        name: DECORATION_LAYER_NAME,
        type: TILE_LAYER,
        width: 2,
        height: 2,
        data: [0, 0, 3, 0],
        properties: [
          prop('zIndex', INT_PROPERTY_TYPE, 12),
          prop('tint', INT_PROPERTY_TYPE, 0x123456),
          prop('nativeTileId', INT_PROPERTY_TYPE, 2),
        ],
      },
      {
        name: 'AbovePlayer',
        type: TILE_LAYER,
        width: 2,
        height: 2,
        data: [0, 0, 0, 4],
      },
      {
        name: 'Collision',
        type: TILE_LAYER,
        width: 2,
        height: 2,
        data: [1, 0, 0, 0],
        visible: false,
      },
      {
        name: 'Encounter',
        type: TILE_LAYER,
        width: 2,
        height: 2,
        data: [0, 1, 0, 0],
        visible: false,
      },
      {
        name: 'WorldObjects',
        type: OBJECT_LAYER,
        objects: [
          {
            id: 4,
            name: 'Tree',
            x: -32,
            y: 48,
            point: true,
            properties: [prop('instancePath', STRING_PROPERTY_TYPE, 'res://Tree.tscn')],
          },
          {
            id: 5,
            name: 'Custom Lab',
            x: 64,
            y: -16,
            point: true,
            properties: [
              prop('instancePath', STRING_PROPERTY_TYPE, 'res://House.tscn'),
              prop('texturePath', STRING_PROPERTY_TYPE, '/assets/Buildings/lab.png'),
              prop('zIndex', INT_PROPERTY_TYPE, 96),
            ],
          },
        ],
      },
      {
        name: 'PlayerSpawn',
        type: OBJECT_LAYER,
        objects: [{
          id: 1,
          x: 16,
          y: 16,
          point: true,
          properties: [prop('spawnDirection', STRING_PROPERTY_TYPE, 'right')],
        }],
      },
      {
        name: 'Transitions',
        type: OBJECT_LAYER,
        objects: [{
          id: 2,
          name: 'Exit',
          x: 0,
          y: 16,
          width: 16,
          height: 16,
          properties: [
            prop('destinationScene', STRING_PROPERTY_TYPE, DESTINATION_SCENE),
            prop('spawnX', INT_PROPERTY_TYPE, 3),
            prop('spawnY', INT_PROPERTY_TYPE, 4),
            prop('spawnDirection', STRING_PROPERTY_TYPE, 'left'),
            prop('invisible', 'bool', true),
          ],
        }],
      },
      {
        name: 'CameraBounds',
        type: OBJECT_LAYER,
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
      prop('sceneName', STRING_PROPERTY_TYPE, 'Fixture Route'),
      prop('encounterTable', STRING_PROPERTY_TYPE, 'fixture-route'),
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
        tileId: 2,
        tint: 0x123456,
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

  it('projects declarative world objects with exact pixel positions', () => {
    const scene = new TiledWorldImporter().parseMap(baseMap())

    expect(scene.objects).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: 'Tree',
        instancePath: 'res://Tree.tscn',
        position: { x: -32, y: 48 },
      }),
      expect.objectContaining({
        name: 'Custom Lab',
        instancePath: 'res://House.tscn',
        texturePath: '/assets/Buildings/lab.png',
        position: { x: 64, y: -16 },
        zIndex: 96,
      }),
    ]))
  })

  it('projects optional transition animation textures', () => {
    const map = baseMap()
    const transitions = map.layers.find((layer) => layer.name === 'Transitions')
    if (!transitions || transitions.type !== OBJECT_LAYER) throw new Error('Fixture Transitions missing')
    transitions.objects[0].properties = [
      ...(transitions.objects[0].properties ?? []),
      prop('animationTexturePath', STRING_PROPERTY_TYPE, '/assets/Buildings/Door%20Animations/lab.png'),
    ]

    const scene = new TiledWorldImporter().parseMap(map)

    expect(scene.doors[0].animationTexturePath)
      .toBe('/assets/Buildings/Door%20Animations/lab.png')
  })

  it('projects player spawn, transitions and explicit camera bounds', () => {
    const scene = new TiledWorldImporter().parseMap(baseMap())
    const player = scene.objects.find((object) => object.instancePath === 'res://Player.tscn')

    expect(player?.position).toEqual({ x: 16, y: 16 })
    expect(scene.spawnDirection).toBe('right')
    expect(scene.doors).toEqual([{
      tile: { x: 0, y: 1 },
      nextScene: DESTINATION_SCENE,
      spawnTile: { x: 3, y: 4 },
      spawnDirection: 'left',
      invisible: true,
    }])
    expect(scene.cameraBounds).toEqual({ x: 0, y: 0, width: 32, height: 32 })
  })

  it('preserves Tiled horizontal, vertical and diagonal transform flags', () => {
    const map = baseMap()
    const ground = map.layers[0]
    if (ground.type !== TILE_LAYER) throw new Error('Fixture Ground layer missing')
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
        type: TILE_LAYER,
        width: 2,
        height: 2,
        data: [0, 0, 0, 0],
      },
    ]
    expect(() => importer.parseMap(unknownLayer)).toThrow('Unsupported Tiled tile layer')
  })

  it('rejects invalid Tiled visual layer tint and native tile metadata', () => {
    const invalidTint = baseMap()
    const decoration = invalidTint.layers.find((layer) => layer.name === DECORATION_LAYER_NAME)
    if (!decoration || decoration.type !== TILE_LAYER) throw new Error('Fixture Decoration layer missing')
    decoration.properties = [prop('tint', INT_PROPERTY_TYPE, 0x1000000)]

    expect(() => new TiledWorldImporter().parseMap(invalidTint))
      .toThrow('must be a 24-bit RGB color')

    const invalidNativeTile = baseMap()
    const nativeDecoration = invalidNativeTile.layers.find((layer) => layer.name === DECORATION_LAYER_NAME)
    if (!nativeDecoration || nativeDecoration.type !== TILE_LAYER) {
      throw new Error('Fixture Decoration layer missing')
    }
    nativeDecoration.properties = [prop('nativeTileId', 'float', 1.5)]

    expect(() => new TiledWorldImporter().parseMap(invalidNativeTile))
      .toThrow('must be an integer')
  })

  it('rejects malformed transitions instead of silently creating broken doors', () => {
    const map = baseMap()
    const transitions = map.layers.find((layer) => layer.name === 'Transitions')
    if (!transitions || transitions.type !== OBJECT_LAYER) throw new Error('Fixture Transitions missing')
    transitions.objects[0].properties = [
      prop('destinationScene', STRING_PROPERTY_TYPE, DESTINATION_SCENE),
    ]

    expect(() => new TiledWorldImporter().parseMap(map))
      .toThrow('requires destinationScene, spawnX and spawnY')
  })

  it('rejects malformed declarative world objects', () => {
    const map = baseMap()
    const worldObjects = map.layers.find((layer) => layer.name === 'WorldObjects')
    if (!worldObjects || worldObjects.type !== OBJECT_LAYER) throw new Error('Fixture WorldObjects missing')
    worldObjects.objects[0].properties = []

    expect(() => new TiledWorldImporter().parseMap(map))
      .toThrow('requires instancePath or texturePath')
  })

  it('rejects maps without one canonical player spawn', () => {
    const map = baseMap()
    map.layers = map.layers.filter((layer) => layer.name !== 'PlayerSpawn')

    expect(() => new TiledWorldImporter().parseMap(map))
      .toThrow('requires exactly one PlayerSpawn object')
  })
})
