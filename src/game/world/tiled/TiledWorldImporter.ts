import { TILE_SIZE, type Direction } from '../../constants'
import type {
  DoorDefinition,
  GridPoint,
  ImportedSceneDefinition,
  TileDefinition,
  WorldBounds,
  WorldObjectDefinition,
} from '../types'
import type {
  TiledMapDocument,
  TiledObject,
  TiledObjectLayer,
  TiledProperty,
  TiledTileLayer,
  TiledTileset,
} from './types'

const FLIP_HORIZONTAL = 0x80000000
const FLIP_VERTICAL = 0x40000000
const FLIP_DIAGONAL = 0x20000000
const ROTATE_HEX_120 = 0x10000000
const GID_MASK = 0x0fffffff

const VISUAL_LAYER_Z: Readonly<Record<string, number>> = {
  ground: 0,
  decoration: 10,
}

const SUPPORTED_TILE_LAYERS = new Set([
  'ground',
  'decoration',
  'aboveplayer',
  'collision',
  'encounter',
])

const DIRECTIONS = new Set<Direction>(['left', 'right', 'up', 'down'])

interface ResolvedTile {
  tileset: TiledTileset
  localId: number
  flipX: boolean
  flipY: boolean
  transpose: boolean
}

export class TiledWorldImporter {
  async loadScene(mapUrl: string): Promise<ImportedSceneDefinition> {
    const response = await fetch(mapUrl)
    if (!response.ok) {
      throw new Error(`Unable to load Tiled map ${mapUrl}: ${response.status}`)
    }
    return this.parseMap(await response.json(), mapUrl)
  }

  parseMap(source: unknown, mapUrl = '/monster-world/maps/inline.json'): ImportedSceneDefinition {
    const map = this.assertMapDocument(source)
    this.assertSupportedMap(map)

    const tiles: TileDefinition[] = []
    const foregroundTiles: TileDefinition[] = []
    const objects: WorldObjectDefinition[] = []
    const doors: DoorDefinition[] = []

    let playerSpawn: { tile: GridPoint; direction: Direction } | undefined
    let cameraBounds: WorldBounds | undefined

    for (const layer of map.layers) {
      if (layer.type === 'tilelayer') {
        this.parseTileLayer(map, layer, mapUrl, tiles, foregroundTiles)
        continue
      }

      const role = normalizeLayerName(layer.name)
      if (role === 'playerspawn') {
        playerSpawn = this.parsePlayerSpawn(layer)
      } else if (role === 'transitions') {
        doors.push(...this.parseTransitions(layer))
      } else if (role === 'camerabounds') {
        cameraBounds = this.parseCameraBounds(layer)
      }
    }

    if (!playerSpawn) {
      throw new Error('Tiled map requires exactly one PlayerSpawn object')
    }

    objects.push({
      name: 'Player',
      instancePath: 'res://Player.tscn',
      position: {
        x: playerSpawn.tile.x * TILE_SIZE,
        y: playerSpawn.tile.y * TILE_SIZE,
      },
    })

    return {
      name: stringProperty(map.properties, 'sceneName') ?? 'TiledScene',
      tiles,
      foregroundTiles,
      ledgeTiles: [],
      objects,
      doors,
      encounterTableId: stringProperty(map.properties, 'encounterTable'),
      cameraBounds: cameraBounds ?? {
        x: 0,
        y: 0,
        width: map.width * TILE_SIZE,
        height: map.height * TILE_SIZE,
      },
      spawnDirection: playerSpawn.direction,
    }
  }

  private parseTileLayer(
    map: TiledMapDocument,
    layer: TiledTileLayer,
    mapUrl: string,
    tiles: TileDefinition[],
    foregroundTiles: TileDefinition[],
  ): void {
    const role = normalizeLayerName(layer.name)
    if (!SUPPORTED_TILE_LAYERS.has(role)) {
      throw new Error(`Unsupported Tiled tile layer: ${layer.name}`)
    }
    if (layer.width !== map.width || layer.height !== map.height) {
      throw new Error(`Tiled layer ${layer.name} must match map dimensions`)
    }
    if (!Array.isArray(layer.data) || layer.data.length !== map.width * map.height) {
      throw new Error(`Tiled layer ${layer.name} has invalid tile data length`)
    }

    const layerOffsetX = integerOrZero(layer.x)
    const layerOffsetY = integerOrZero(layer.y)

    for (let index = 0; index < layer.data.length; index += 1) {
      const encoded = layer.data[index]
      if (!Number.isInteger(encoded) || encoded < 0) {
        throw new Error(`Tiled layer ${layer.name} contains an invalid gid`)
      }
      const gid = (encoded >>> 0) & GID_MASK
      if (gid === 0) continue

      const point = {
        x: (index % map.width) + layerOffsetX,
        y: Math.floor(index / map.width) + layerOffsetY,
      }

      if (role === 'collision') {
        tiles.push(markerTile(point, { blocked: true }))
        continue
      }
      if (role === 'encounter') {
        tiles.push(markerTile(point, { encounterZone: true }))
        continue
      }
      if (layer.visible === false) continue

      const resolved = this.resolveTile(map.tilesets, encoded)
      const columns = resolved.tileset.columns
      if (!Number.isInteger(columns) || columns <= 0) {
        throw new Error(`Tiled tileset ${resolved.tileset.name ?? resolved.tileset.image} requires positive columns`)
      }

      const margin = resolved.tileset.margin ?? 0
      const spacing = resolved.tileset.spacing ?? 0
      const sourceColumn = resolved.localId % columns
      const sourceRow = Math.floor(resolved.localId / columns)
      const visual: TileDefinition = {
        ...point,
        tileId: -1,
        autotileX: 0,
        autotileY: 0,
        flipX: resolved.flipX,
        flipY: resolved.flipY,
        transpose: resolved.transpose,
        texturePath: resolveImagePath(mapUrl, resolved.tileset.image),
        sourceX: margin + sourceColumn * (TILE_SIZE + spacing),
        sourceY: margin + sourceRow * (TILE_SIZE + spacing),
        zIndex: numberProperty(layer.properties, 'zIndex') ?? VISUAL_LAYER_Z[role] ?? 0,
      }

      if (role === 'aboveplayer') foregroundTiles.push(visual)
      else tiles.push(visual)
    }
  }

  private resolveTile(tilesets: readonly TiledTileset[], encodedGid: number): ResolvedTile {
    const unsigned = encodedGid >>> 0
    if ((unsigned & ROTATE_HEX_120) !== 0) {
      throw new Error('Hexagonal Tiled rotation flags are not supported')
    }

    const gid = unsigned & GID_MASK
    const tileset = [...tilesets]
      .sort((left, right) => right.firstgid - left.firstgid)
      .find((candidate) => gid >= candidate.firstgid)

    if (!tileset) throw new Error(`No Tiled tileset owns gid ${gid}`)
    if (tileset.tilewidth !== TILE_SIZE || tileset.tileheight !== TILE_SIZE) {
      throw new Error(`Tiled tileset ${tileset.name ?? tileset.image} must use ${TILE_SIZE}x${TILE_SIZE} tiles`)
    }

    const localId = gid - tileset.firstgid
    if (tileset.tilecount !== undefined && localId >= tileset.tilecount) {
      throw new Error(`Tiled gid ${gid} exceeds tileset ${tileset.name ?? tileset.image}`)
    }

    return {
      tileset,
      localId,
      flipX: (unsigned & FLIP_HORIZONTAL) !== 0,
      flipY: (unsigned & FLIP_VERTICAL) !== 0,
      transpose: (unsigned & FLIP_DIAGONAL) !== 0,
    }
  }

  private parsePlayerSpawn(layer: TiledObjectLayer): { tile: GridPoint; direction: Direction } {
    if (layer.objects.length !== 1) {
      throw new Error('PlayerSpawn layer must contain exactly one object')
    }

    const object = layer.objects[0]
    return {
      tile: objectTile(object),
      direction: directionProperty(object.properties, 'spawnDirection', 'down'),
    }
  }

  private parseTransitions(layer: TiledObjectLayer): DoorDefinition[] {
    return layer.objects.map((object) => {
      const destinationScene = stringProperty(object.properties, 'destinationScene')
      const spawnX = numberProperty(object.properties, 'spawnX')
      const spawnY = numberProperty(object.properties, 'spawnY')
      if (!destinationScene || spawnX === undefined || spawnY === undefined) {
        throw new Error(`Transition ${object.name ?? object.id} requires destinationScene, spawnX and spawnY`)
      }
      if (!Number.isInteger(spawnX) || !Number.isInteger(spawnY)) {
        throw new Error(`Transition ${object.name ?? object.id} spawn coordinates must be integers`)
      }

      return {
        tile: objectTile(object),
        nextScene: destinationScene,
        spawnTile: { x: spawnX, y: spawnY },
        spawnDirection: directionProperty(object.properties, 'spawnDirection', 'down'),
        invisible: booleanProperty(object.properties, 'invisible') ?? true,
      }
    })
  }

  private parseCameraBounds(layer: TiledObjectLayer): WorldBounds {
    if (layer.objects.length !== 1) {
      throw new Error('CameraBounds layer must contain exactly one rectangle')
    }
    const object = layer.objects[0]
    const width = object.width ?? 0
    const height = object.height ?? 0
    if (width <= 0 || height <= 0) {
      throw new Error('CameraBounds object requires positive width and height')
    }
    return { x: object.x, y: object.y, width, height }
  }

  private assertMapDocument(source: unknown): TiledMapDocument {
    if (!source || typeof source !== 'object') throw new Error('Invalid Tiled map document')
    const map = source as Partial<TiledMapDocument>
    if (map.type !== 'map') throw new Error('Tiled document type must be map')
    if (!Number.isInteger(map.width) || !Number.isInteger(map.height) || (map.width ?? 0) <= 0 || (map.height ?? 0) <= 0) {
      throw new Error('Tiled map requires positive integer dimensions')
    }
    if (!Array.isArray(map.layers) || !Array.isArray(map.tilesets)) {
      throw new Error('Tiled map requires layers and tilesets arrays')
    }
    if (!Number.isInteger(map.tilewidth) || !Number.isInteger(map.tileheight)) {
      throw new Error('Tiled map requires integer tile dimensions')
    }
    return map as TiledMapDocument
  }

  private assertSupportedMap(map: TiledMapDocument): void {
    if (map.orientation !== 'orthogonal') {
      throw new Error('Monster World currently supports orthogonal Tiled maps only')
    }
    if (map.infinite) {
      throw new Error('Monster World currently requires finite Tiled maps')
    }
    if (map.tilewidth !== TILE_SIZE || map.tileheight !== TILE_SIZE) {
      throw new Error(`Monster World Tiled maps must use ${TILE_SIZE}x${TILE_SIZE} tiles`)
    }

    for (const tileset of map.tilesets) {
      if (!Number.isInteger(tileset.firstgid) || tileset.firstgid <= 0 || !tileset.image) {
        throw new Error('Tiled tilesets require firstgid and image')
      }
    }
  }
}

function markerTile(
  point: GridPoint,
  flags: Pick<TileDefinition, 'blocked' | 'encounterZone'>,
): TileDefinition {
  return {
    ...point,
    tileId: -1,
    autotileX: 0,
    autotileY: 0,
    flipX: false,
    flipY: false,
    transpose: false,
    ...flags,
  }
}

function objectTile(object: TiledObject): GridPoint {
  if (!Number.isFinite(object.x) || !Number.isFinite(object.y)) {
    throw new Error(`Tiled object ${object.name ?? object.id} requires finite coordinates`)
  }
  return {
    x: Math.floor(object.x / TILE_SIZE),
    y: Math.floor(object.y / TILE_SIZE),
  }
}

function normalizeLayerName(value: string): string {
  return value.toLowerCase().replace(/[\s_-]+/g, '')
}

function property(
  properties: readonly TiledProperty[] | undefined,
  name: string,
): unknown {
  return properties?.find((entry) => entry.name === name)?.value
}

function stringProperty(
  properties: readonly TiledProperty[] | undefined,
  name: string,
): string | undefined {
  const value = property(properties, name)
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function numberProperty(
  properties: readonly TiledProperty[] | undefined,
  name: string,
): number | undefined {
  const value = property(properties, name)
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function booleanProperty(
  properties: readonly TiledProperty[] | undefined,
  name: string,
): boolean | undefined {
  const value = property(properties, name)
  return typeof value === 'boolean' ? value : undefined
}

function directionProperty(
  properties: readonly TiledProperty[] | undefined,
  name: string,
  fallback: Direction,
): Direction {
  const value = stringProperty(properties, name)
  if (!value) return fallback
  if (!DIRECTIONS.has(value as Direction)) {
    throw new Error(`Invalid direction property ${name}: ${value}`)
  }
  return value as Direction
}

function integerOrZero(value: number | undefined): number {
  if (value === undefined) return 0
  if (!Number.isInteger(value)) throw new Error('Tiled layer offsets must be integers')
  return value
}

function resolveImagePath(mapUrl: string, image: string): string {
  if (image.startsWith('/')) return image
  const normalizedMapUrl = mapUrl.startsWith('/') ? mapUrl : `/${mapUrl}`
  return new URL(image, `https://monster-world.local${normalizedMapUrl}`).pathname
}
