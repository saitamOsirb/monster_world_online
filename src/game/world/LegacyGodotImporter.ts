import type { Direction } from '../constants'
import type {
  DoorDefinition,
  GridPoint,
  ImportedSceneDefinition,
  TileDefinition,
  WorldObjectDefinition,
} from './types'

interface ExtResource {
  id: number
  path: string
  type: string
}

interface ParsedNode {
  name: string
  type?: string
  parent?: string
  path: string
  instanceId?: number
  body: string
}

const FLIP_X = 0x80000000
const FLIP_Y = 0x40000000
const TRANSPOSE = 0x20000000
const TILE_ID_MASK = 0x1fffffff
const DEFAULT_DOOR_TEXTURE = '/assets/Buildings/Door%20Animations/house1.png'

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function readVector(body: string, property: string): GridPoint | undefined {
  const match = body.match(new RegExp(`^${escapeRegExp(property)}\\s*=\\s*Vector2\\(\\s*(-?[\\d.]+)\\s*,\\s*(-?[\\d.]+)\\s*\\)`, 'm'))
  if (!match) return undefined
  return { x: Number(match[1]), y: Number(match[2]) }
}

function readString(body: string, property: string): string | undefined {
  const match = body.match(new RegExp(`^${escapeRegExp(property)}\\s*=\\s*"([^"]*)"`, 'm'))
  return match?.[1]
}

function readNumber(body: string, property: string): number | undefined {
  const match = body.match(new RegExp(`^${escapeRegExp(property)}\\s*=\\s*(-?[\\d.]+)`, 'm'))
  return match ? Number(match[1]) : undefined
}

function readBoolean(body: string, property: string): boolean | undefined {
  const match = body.match(new RegExp(`^${escapeRegExp(property)}\\s*=\\s*(true|false)`, 'm'))
  if (!match) return undefined
  return match[1] === 'true'
}

function readNodePosition(body: string): GridPoint {
  const position = readVector(body, 'position')
  if (position) return position
  return {
    x: readNumber(body, 'margin_left') ?? 0,
    y: readNumber(body, 'margin_top') ?? 0,
  }
}

function directionFromVector(vector?: GridPoint): Direction {
  if (!vector) return 'down'
  if (vector.x < 0) return 'left'
  if (vector.x > 0) return 'right'
  if (vector.y < 0) return 'up'
  return 'down'
}

function decodeCell(encoded: number): GridPoint {
  const unsigned = encoded >>> 0
  let x = unsigned & 0xffff
  let y = (unsigned >>> 16) & 0xffff
  if (x >= 0x8000) x -= 0x10000
  if (y >= 0x8000) y -= 0x10000
  return { x, y }
}

function parseTileData(body: string): TileDefinition[] {
  const match = body.match(/tile_data\s*=\s*PoolIntArray\(\s*([\s\S]*?)\s*\)/m)
  if (!match) return []

  const values = match[1]
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map(Number)

  const tiles: TileDefinition[] = []
  for (let index = 0; index + 2 < values.length; index += 3) {
    const cell = decodeCell(values[index])
    const rawTile = values[index + 1] >>> 0
    const rawAutotile = values[index + 2] >>> 0
    tiles.push({
      x: cell.x,
      y: cell.y,
      tileId: rawTile & TILE_ID_MASK,
      autotileX: rawAutotile & 0xffff,
      autotileY: (rawAutotile >>> 16) & 0xffff,
      flipX: (rawTile & FLIP_X) !== 0,
      flipY: (rawTile & FLIP_Y) !== 0,
      transpose: (rawTile & TRANSPOSE) !== 0,
    })
  }
  return tiles
}

function parseExtResources(source: string): Map<number, ExtResource> {
  const resources = new Map<number, ExtResource>()
  const regex = /\[ext_resource path="([^"]+)" type="([^"]+)" id=(\d+)\]/g
  for (const match of source.matchAll(regex)) {
    const resource: ExtResource = {
      id: Number(match[3]),
      path: match[1],
      type: match[2],
    }
    resources.set(resource.id, resource)
  }
  return resources
}

function parseNodes(source: string): ParsedNode[] {
  const starts = [...source.matchAll(/^\[node\s+([^\]]+)\]$/gm)]
  return starts.map((match, index) => {
    const header = match[1]
    const bodyStart = (match.index ?? 0) + match[0].length + 1
    const bodyEnd = index + 1 < starts.length ? (starts[index + 1].index ?? source.length) : source.length
    const body = source.slice(bodyStart, bodyEnd)
    const name = header.match(/name="([^"]+)"/)?.[1] ?? `Node${index}`
    const type = header.match(/type="([^"]+)"/)?.[1]
    const parent = header.match(/parent="([^"]+)"/)?.[1]
    const instanceId = Number(header.match(/instance=ExtResource\(\s*(\d+)\s*\)/)?.[1]) || undefined
    const path = parent === undefined ? '.' : parent === '.' ? name : `${parent}/${name}`
    return { name, type, parent, path, instanceId, body }
  })
}

function resolveWorldPosition(
  node: ParsedNode,
  nodesByPath: Map<string, ParsedNode>,
  stack = new Set<string>(),
): GridPoint {
  const local = readNodePosition(node.body)
  if (node.parent === undefined || node.parent === '.') return local
  if (stack.has(node.path)) throw new Error(`Cyclic TSCN node parent path: ${node.path}`)
  stack.add(node.path)
  const parent = nodesByPath.get(node.parent)
  if (!parent) return local
  const parentPosition = resolveWorldPosition(parent, nodesByPath, stack)
  return {
    x: parentPosition.x + local.x,
    y: parentPosition.y + local.y,
  }
}

function toPublicAsset(resourcePath: string): string | undefined {
  if (!resourcePath.startsWith('res://Assets/')) return undefined
  return `/assets/${resourcePath.slice('res://Assets/'.length).split('/').map(encodeURIComponent).join('/')}`
}

export class LegacyGodotImporter {
  async loadScene(scenePath: string): Promise<ImportedSceneDefinition> {
    const normalized = scenePath.replace(/^res:\/\//, '')
    const response = await fetch(`/legacy/${normalized}`)
    if (!response.ok) {
      throw new Error(`Unable to load legacy scene ${scenePath}: ${response.status}`)
    }
    return this.parseScene(await response.text())
  }

  parseScene(source: string): ImportedSceneDefinition {
    const resources = parseExtResources(source)
    const nodes = parseNodes(source)
    const nodesByPath = new Map(nodes.map((node) => [node.path, node]))
    const root = nodes[0]
    const objects: WorldObjectDefinition[] = []
    const doors: DoorDefinition[] = []
    const objectByNodePath = new Map<string, WorldObjectDefinition>()
    const doorByNodePath = new Map<string, DoorDefinition>()
    const ledgeTiles: TileDefinition[] = []
    let tiles: TileDefinition[] = []

    for (const node of nodes) {
      const nodeTiles = parseTileData(node.body)
      if (node.name === 'OverworldTileMap' && nodeTiles.length > 0) {
        tiles = nodeTiles
      } else if (node.name.toLowerCase().includes('ledge') && nodeTiles.length > 0) {
        ledgeTiles.push(...nodeTiles)
      }

      if (!node.instanceId) continue
      const instanceResource = resources.get(node.instanceId)
      if (!instanceResource) continue
      const position = resolveWorldPosition(node, nodesByPath)

      if (instanceResource.path.endsWith('Door.tscn')) {
        const spawn = readVector(node.body, 'spawn_location') ?? { x: 0, y: 0 }
        const door: DoorDefinition = {
          tile: { x: Math.round(position.x / 16), y: Math.round(position.y / 16) },
          nextScene: readString(node.body, 'next_scene_path') ?? '',
          spawnTile: { x: Math.round(spawn.x / 16), y: Math.round(spawn.y / 16) },
          spawnDirection: directionFromVector(readVector(node.body, 'spawn_direction')),
          invisible: readBoolean(node.body, 'is_invisible') ?? false,
          animationTexturePath: DEFAULT_DOOR_TEXTURE,
        }
        doors.push(door)
        doorByNodePath.set(node.path, door)
        continue
      }

      const object: WorldObjectDefinition = {
        name: node.name,
        instancePath: instanceResource.path,
        position,
        zIndex: readNumber(node.body, 'z_index'),
      }
      objects.push(object)
      objectByNodePath.set(node.path, object)
    }

    for (const node of nodes) {
      if (node.instanceId) continue
      const textureId = Number(node.body.match(/^texture\s*=\s*ExtResource\(\s*(\d+)\s*\)/m)?.[1]) || undefined
      if (!textureId) continue
      const textureResource = resources.get(textureId)
      const texturePath = textureResource ? toPublicAsset(textureResource.path) : undefined
      if (!texturePath) continue

      if (node.name === 'Sprite' && node.parent) {
        const door = doorByNodePath.get(node.parent)
        if (door) {
          door.animationTexturePath = texturePath
          continue
        }
        const object = objectByNodePath.get(node.parent)
        if (object) {
          object.texturePath = texturePath
          continue
        }
      }

      objects.push({
        name: node.name,
        texturePath,
        position: resolveWorldPosition(node, nodesByPath),
        zIndex: readNumber(node.body, 'z_index'),
      })
    }

    return {
      name: root?.name ?? 'LegacyScene',
      tiles,
      ledgeTiles,
      objects,
      doors,
    }
  }
}

export const legacyGodotInternals = {
  decodeCell,
  parseTileData,
}
