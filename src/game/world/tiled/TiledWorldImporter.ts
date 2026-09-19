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

const GROUND_LAYER = 'ground'
const DECORATION_LAYER = 'decoration'
const ABOVE_PLAYER_LAYER = 'aboveplayer'
const COLLISION_LAYER = 'collision'
const ENCOUNTER_LAYER = 'encounter'
const PLAYER_SPAWN_LAYER = 'playerspawn'
const TRANSITIONS_LAYER = 'transitions'
const CAMERA_BOUNDS_LAYER = 'camerabounds'
const SPAWN_DIRECTION_PROPERTY = 'spawnDirection'

const VISUAL_LAYER_Z: Readonly<Record<string, number>> = {
  [GROUND_LAYER]: 0,
  [DECORATION_LAYER]: 10,
}

const SUPPORTED_TILE_LAYERS = new Set([
  GROUND_LAYER,
  DECORATION_LAYER,
  ABOVE_PLAYER_LAYER,
  COLLISION_LAYER,
  ENCOUNTER_LAYER,
])

const DIRECTIONS: ReadonlySet<string> = new Set(['left', 'right', 'up', 'down'])

interface ResolvedTile {
  tileset: TiledTileset
  localId: number
  flipX: boolean
  flipY: boolean
  transpose: boolean
}

interface LayerAccumulator {
  tiles: TileDefinition[]
  foregroundTiles: TileDefinition[]
  objects: WorldObjectDefinition[]
  doors: DoorDefinition[]
  playerSpawn?: { tile: GridPoint; direction: Direction }
  cameraBounds?: WorldBounds
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

    const state = this.parseLayers(map, mapUrl)
    const playerSpawn = state.playerSpawn
    if (!playerSpawn) {
      throw new Error('Tiled map requires exactly one PlayerSpawn object')
    }

    state.objects.push(playerObject(playerSpawn.tile))

    return {
      name: stringProperty(map.properties, 'sceneName') ?? 'TiledScene',
      tiles: state.tiles,
      foregroundTiles: state.foregroundTiles,
      ledgeTiles: [],
      objects: state.objects,
      doors: state.doors,
      encounterTableId: stringProperty(map.properties, 'encounterTable'),
      cameraBounds: state.cameraBounds ?? fullMapBounds(map),
      spawnDirection: playerSpawn.direction,
    }
  }

  private parseLayers(map: TiledMapDocument, mapUrl: string): LayerAccumulator {
    const state: LayerAccumulator = {
      tiles: [],
      foregroundTiles: [],
      objects: [],
      doors: [],
    }
    const orderedTilesets = [...map.tilesets].sort((left, right) => right.firstgid - left.firstgid)

    for (const layer of map.layers) {
      if (layer.type === 'tilelayer') {
        this.parseTileLayer(map, layer, mapUrl, orderedTilesets, state)
      } else {
        this.parseObjectLayer(layer, state)
      }
    }

    return state
  }

  private parseObjectLayer(layer: TiledObjectLayer, state: LayerAccumulator): void {
    const role = normalizeLayerName(layer.name)

    switch (role) {
      case PLAYER_SPAWN_LAYER:
        state.playerSpawn = this.parsePlayerSpawn(layer)
        break
      case TRANSITIONS_LAYER:
        state.doors.push(...this.parseTransitions(layer))
        break
      case CAMERA_BOUNDS_LAYER:
        state.cameraBounds = this.parseCameraBounds(layer)
        break
      default:
        break
    }
  }

  private parseTileLayer(
    map: TiledMapDocument,
    layer: TiledTileLayer,
    mapUrl: string,
    orderedTilesets: readonly TiledTileset[],
    state: LayerAccumulator,
  ): void {
    const role = normalizeLayerName(layer.name)
    this.validateTileLayer(map, layer, role)

    if (role === COLLISION_LAYER) {
      this.appendMarkerTiles(map, layer, state.tiles, { blocked: true })
      return
    }
    if (role === ENCOUNTER_LAYER) {
      this.appendMarkerTiles(map, layer, state.tiles, { encounterZone: true })
      return
    }
    if (layer.visible === false) return

    const target = visualTargetForRole(role, state)
    this.appendVisualTiles(map, layer, role, mapUrl, orderedTilesets, target)
  }

  private validateTileLayer(
    map: TiledMapDocument,
    layer: TiledTileLayer,
    role: string,
  ): void {
    if (!SUPPORTED_TILE_LAYERS.has(role)) {
      throw new Error(`Unsupported Tiled tile layer: ${layer.name}`)
    }
    if (layer.width !== map.width || layer.height !== map.height) {
      throw new Error(`Tiled layer ${layer.name} must match map dimensions`)
    }
    if (!Array.isArray(layer.data) || layer.data.length !== map.width * map.height) {
      throw new Error(`Tiled layer ${layer.name} has invalid tile data length`)
    }
  }

  private appendMarkerTiles(
    map: TiledMapDocument,
    layer: TiledTileLayer,
    target: TileDefinition[],
    flags: Pick<TileDefinition, 'blocked' | 'encounterZone'>,
  ): void {
    const offset = layerOffset(layer)

    for (let index = 0; index < layer.data.length; index += 1) {
      const encoded = validEncodedGid(layer, layer.data[index])
      if (baseGid(encoded) === 0) continue
      target.push(markerTile(layerPoint(map.width, index, offset), flags))
    }
  }

  private appendVisualTiles(
    map: TiledMapDocument,
    layer: TiledTileLayer,
    role: string,
    mapUrl: string,
    orderedTilesets: readonly TiledTileset[],
    target: TileDefinition[],
  ): void {
    const offset = layerOffset(layer)
    const zIndex = numberProperty(layer.properties, 'zIndex') ?? VISUAL_LAYER_Z[role] ?? 0
    const tint = optionalColorProperty(layer.properties, 'tint')
    const nativeTileId = optionalIntegerProperty(layer.properties, 'nativeTileId') ?? -1

    for (let index = 0; index < layer.data.length; index += 1) {
      const encoded = validEncodedGid(layer, layer.data[index])
      if (baseGid(encoded) === 0) continue

      const resolved = this.resolveTile(orderedTilesets, encoded)
      target.push(createVisualTile(
        layerPoint(map.width, index, offset),
        resolved,
        mapUrl,
        zIndex,
        tint,
        nativeTileId,
      ))
    }
  }

  private resolveTile(orderedTilesets: readonly TiledTileset[], encodedGid: number): ResolvedTile {
    const unsigned = encodedGid >>> 0
    if ((unsigned & ROTATE_HEX_120) !== 0) {
      throw new Error('Hexagonal Tiled rotation flags are not supported')
    }

    const gid = baseGid(unsigned)
    const tileset = orderedTilesets.find((candidate) => gid >= candidate.firstgid)
    if (!tileset) throw new Error(`No Tiled tileset owns gid ${gid}`)

    this.assertTilesetTileSize(tileset)

    const localId = gid - tileset.firstgid
    if (tileset.tilecount !== undefined && localId >= tileset.tilecount) {
      throw new Error(`Tiled gid ${gid} exceeds tileset ${tilesetLabel(tileset)}`)
    }

    return {
      tileset,
      localId,
      flipX: (unsigned & FLIP_HORIZONTAL) !== 0,
      flipY: (unsigned & FLIP_VERTICAL) !== 0,
      transpose: (unsigned & FLIP_DIAGONAL) !== 0,
    }
  }

  private assertTilesetTileSize(tileset: TiledTileset): void {
    if (tileset.tilewidth !== TILE_SIZE || tileset.tileheight !== TILE_SIZE) {
      throw new Error(`Tiled tileset ${tilesetLabel(tileset)} must use ${TILE_SIZE}x${TILE_SIZE} tiles`)
    }
    if (!Number.isInteger(tileset.columns) || tileset.columns <= 0) {
      throw new Error(`Tiled tileset ${tilesetLabel(tileset)} requires positive columns`)
    }
  }

  private parsePlayerSpawn(layer: TiledObjectLayer): { tile: GridPoint; direction: Direction } {
    if (layer.objects.length !== 1) {
      throw new Error('PlayerSpawn layer must contain exactly one object')
    }

    const object = layer.objects[0]
    return {
      tile: objectTile(object),
      direction: directionProperty(object.properties, SPAWN_DIRECTION_PROPERTY, 'down'),
    }
  }

  private parseTransitions(layer: TiledObjectLayer): DoorDefinition[] {
    return layer.objects.map((object) => this.parseTransition(object))
  }

  private parseTransition(object: TiledObject): DoorDefinition {
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
      spawnDirection: directionProperty(object.properties, SPAWN_DIRECTION_PROPERTY, 'down'),
      invisible: booleanProperty(object.properties, 'invisible') ?? true,
    }
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
    if (!isRecord(source)) {
      throw new Error('Invalid Tiled map document')
    }
    if (source.type !== 'map') {
      throw new Error('Tiled document type must be map')
    }
    if (!isPositiveInteger(source.width) || !isPositiveInteger(source.height)) {
      throw new Error('Tiled map requires positive integer dimensions')
    }
    if (!Array.isArray(source.layers) || !Array.isArray(source.tilesets)) {
      throw new Error('Tiled map requires layers and tilesets arrays')
    }
    if (!isInteger(source.tilewidth) || !isInteger(source.tileheight)) {
      throw new Error('Tiled map requires integer tile dimensions')
    }

    return {
      type: 'map',
      orientation: stringValue(source.orientation, 'orientation'),
      width: source.width,
      height: source.height,
      tilewidth: source.tilewidth,
      tileheight: source.tileheight,
      infinite: optionalBoolean(source.infinite),
      layers: source.layers.map(parseLayerRecord),
      tilesets: source.tilesets.map(parseTilesetRecord),
      properties: parseOptionalProperties(source.properties),
    }
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
      if (!isPositiveInteger(tileset.firstgid) || !tileset.image) {
        throw new Error('Tiled tilesets require firstgid and image')
      }
    }
  }
}

function createVisualTile(
  point: GridPoint,
  resolved: ResolvedTile,
  mapUrl: string,
  zIndex: number,
  tint: number | undefined,
  nativeTileId: number,
): TileDefinition {
  const { tileset, localId } = resolved
  const margin = tileset.margin ?? 0
  const spacing = tileset.spacing ?? 0
  const sourceColumn = localId % tileset.columns
  const sourceRow = Math.floor(localId / tileset.columns)

  return {
    ...point,
    tileId: nativeTileId,
    autotileX: 0,
    autotileY: 0,
    flipX: resolved.flipX,
    flipY: resolved.flipY,
    transpose: resolved.transpose,
    texturePath: resolveImagePath(mapUrl, tileset.image),
    sourceX: margin + sourceColumn * (TILE_SIZE + spacing),
    sourceY: margin + sourceRow * (TILE_SIZE + spacing),
    tint,
    zIndex,
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

function playerObject(tile: GridPoint): WorldObjectDefinition {
  return {
    name: 'Player',
    instancePath: 'res://Player.tscn',
    position: {
      x: tile.x * TILE_SIZE,
      y: tile.y * TILE_SIZE,
    },
  }
}

function fullMapBounds(map: TiledMapDocument): WorldBounds {
  return {
    x: 0,
    y: 0,
    width: map.width * TILE_SIZE,
    height: map.height * TILE_SIZE,
  }
}

function layerPoint(width: number, index: number, offset: GridPoint): GridPoint {
  return {
    x: (index % width) + offset.x,
    y: Math.floor(index / width) + offset.y,
  }
}

function layerOffset(layer: TiledTileLayer): GridPoint {
  return {
    x: integerOrZero(layer.x),
    y: integerOrZero(layer.y),
  }
}

function validEncodedGid(layer: TiledTileLayer, encoded: number): number {
  if (!Number.isInteger(encoded) || encoded < 0) {
    throw new Error(`Tiled layer ${layer.name} contains an invalid gid`)
  }
  return encoded
}

function baseGid(encoded: number): number {
  return (encoded >>> 0) & GID_MASK
}

function tilesetLabel(tileset: TiledTileset): string {
  return tileset.name ?? tileset.image
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
  if (typeof value !== 'string' || value.length === 0) return undefined
  return value
}

function numberProperty(
  properties: readonly TiledProperty[] | undefined,
  name: string,
): number | undefined {
  const value = property(properties, name)
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  return value
}

function booleanProperty(
  properties: readonly TiledProperty[] | undefined,
  name: string,
): boolean | undefined {
  const value = property(properties, name)
  if (typeof value !== 'boolean') return undefined
  return value
}

function directionProperty(
  properties: readonly TiledProperty[] | undefined,
  name: string,
  fallback: Direction,
): Direction {
  const value = stringProperty(properties, name)
  if (!value) return fallback
  if (!isDirection(value)) {
    throw new Error(`Invalid direction property ${name}: ${value}`)
  }
  return value
}

function integerOrZero(value: number | undefined): number {
  if (value === undefined) return 0
  if (!Number.isInteger(value)) {
    throw new Error('Tiled layer offsets must be integers')
  }
  return value
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

function visualTargetForRole(
  role: string,
  state: LayerAccumulator,
): TileDefinition[] {
  if (role === ABOVE_PLAYER_LAYER) return state.foregroundTiles
  return state.tiles
}

function isDirection(value: string): value is Direction {
  return DIRECTIONS.has(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value)
}

function stringValue(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new Error(`Tiled field ${field} must be a string`)
  return value
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function optionalBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

function optionalIntegerProperty(
  properties: readonly TiledProperty[] | undefined,
  name: string,
): number | undefined {
  const value = numberProperty(properties, name)
  if (value === undefined) return undefined
  if (!Number.isInteger(value)) {
    throw new Error(`Tiled property ${name} must be an integer`)
  }
  return value
}

function optionalColorProperty(
  properties: readonly TiledProperty[] | undefined,
  name: string,
): number | undefined {
  const value = optionalIntegerProperty(properties, name)
  if (value === undefined) return undefined
  if (value < 0 || value > 0xffffff) {
    throw new Error(`Tiled property ${name} must be a 24-bit RGB color`)
  }
  return value
}


function parseOptionalProperties(value: unknown): TiledProperty[] | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value)) throw new Error('Tiled properties must be an array')
  return value.map(parsePropertyRecord)
}

function parsePropertyRecord(value: unknown): TiledProperty {
  if (!isRecord(value)) throw new Error('Tiled property must be an object')
  if (typeof value.name !== 'string') throw new Error('Tiled property requires a name')
  return {
    name: value.name,
    type: optionalString(value.type),
    value: value.value,
  }
}

function parseLayerRecord(value: unknown): TiledMapDocument['layers'][number] {
  if (!isRecord(value)) throw new Error('Tiled layer must be an object')
  if (value.type === 'tilelayer') return parseTileLayerRecord(value)
  if (value.type === 'objectgroup') return parseObjectLayerRecord(value)
  throw new Error(`Unsupported Tiled layer type: ${String(value.type)}`)
}

function parseTileLayerRecord(value: Record<string, unknown>): TiledTileLayer {
  if (!isPositiveInteger(value.width) || !isPositiveInteger(value.height)) {
    throw new Error('Tiled tile layer requires positive dimensions')
  }
  if (!Array.isArray(value.data) || !value.data.every(isInteger)) {
    throw new Error('Tiled tile layer requires integer data')
  }
  return {
    id: optionalNumber(value.id),
    name: stringValue(value.name, 'layer.name'),
    type: 'tilelayer',
    width: value.width,
    height: value.height,
    data: value.data,
    x: optionalNumber(value.x),
    y: optionalNumber(value.y),
    visible: optionalBoolean(value.visible),
    properties: parseOptionalProperties(value.properties),
  }
}

function parseObjectLayerRecord(value: Record<string, unknown>): TiledObjectLayer {
  if (!Array.isArray(value.objects)) throw new Error('Tiled object layer requires objects')
  return {
    id: optionalNumber(value.id),
    name: stringValue(value.name, 'layer.name'),
    type: 'objectgroup',
    objects: value.objects.map(parseObjectRecord),
    visible: optionalBoolean(value.visible),
    properties: parseOptionalProperties(value.properties),
  }
}

function parseObjectRecord(value: unknown): TiledObject {
  if (!isRecord(value)) throw new Error('Tiled object must be an object')
  if (!isInteger(value.id)) throw new Error('Tiled object requires an integer id')
  if (typeof value.x !== 'number' || typeof value.y !== 'number') {
    throw new Error('Tiled object requires numeric coordinates')
  }
  return {
    id: value.id,
    name: optionalString(value.name),
    type: optionalString(value.type),
    x: value.x,
    y: value.y,
    width: optionalNumber(value.width),
    height: optionalNumber(value.height),
    point: optionalBoolean(value.point),
    properties: parseOptionalProperties(value.properties),
  }
}

function parseTilesetRecord(value: unknown): TiledTileset {
  if (!isRecord(value)) throw new Error('Tiled tileset must be an object')
  if (!isPositiveInteger(value.firstgid)) throw new Error('Tiled tileset requires firstgid')
  if (!isPositiveInteger(value.tilewidth) || !isPositiveInteger(value.tileheight)) {
    throw new Error('Tiled tileset requires positive tile dimensions')
  }
  if (!isPositiveInteger(value.columns)) throw new Error('Tiled tileset requires positive columns')
  return {
    firstgid: value.firstgid,
    name: optionalString(value.name),
    tilewidth: value.tilewidth,
    tileheight: value.tileheight,
    columns: value.columns,
    tilecount: optionalNumber(value.tilecount),
    image: stringValue(value.image, 'tileset.image'),
    margin: optionalNumber(value.margin),
    spacing: optionalNumber(value.spacing),
  }
}

function resolveImagePath(mapUrl: string, image: string): string {
  if (image.startsWith('/')) return image
  let normalizedMapUrl = mapUrl
  if (!normalizedMapUrl.startsWith('/')) normalizedMapUrl = `/${normalizedMapUrl}`
  return new URL(image, `https://monster-world.local${normalizedMapUrl}`).pathname
}
