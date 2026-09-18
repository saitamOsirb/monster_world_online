import { TILE_SIZE } from '../constants'
import type {
  DoorDefinition,
  ImportedSceneDefinition,
  TileDefinition,
  WorldObjectDefinition,
} from './types'

export const TIDEWATER_COAST_SCENE = 'res://MonsterWorld/TidewaterCoast.tscn'
export const FROSTHOLLOW_CAVERN_SCENE = 'res://MonsterWorld/FrosthollowCavern.tscn'
export const DUSKMIRE_MARSH_SCENE = 'res://MonsterWorld/DuskmireMarsh.tscn'

export const NATIVE_BIOME_SCENES = [
  TIDEWATER_COAST_SCENE,
  FROSTHOLLOW_CAVERN_SCENE,
  DUSKMIRE_MARSH_SCENE,
] as const

const TOWN_SCENE = 'res://Town.tscn'
const BIOME_SPAWN = { x: 13, y: 17 }
const RETURN_DOOR_TILE = { x: 13, y: 19 }
const GATE_MARKER_TEXTURE = '/assets/Buildings/pallet%20town/mat.png'

interface BiomeStyle {
  name: string
  groundTileId: number
  groundTint: number
  boundaryTileId: number
  boundaryTint: number
  encounterTint: number
  waterPools?: readonly { x: number; y: number; width: number; height: number }[]
}

interface TownGateway {
  scenePath: string
  tile: { x: number; y: number }
  returnSpawn: { x: number; y: number }
  name: string
}

const TOWN_GATEWAYS: readonly TownGateway[] = [
  {
    scenePath: TIDEWATER_COAST_SCENE,
    tile: { x: -12, y: -24 },
    returnSpawn: { x: -12, y: -23 },
    name: 'Tidewater Coast Gate',
  },
  {
    scenePath: FROSTHOLLOW_CAVERN_SCENE,
    tile: { x: 7, y: -24 },
    returnSpawn: { x: 7, y: -23 },
    name: 'Frosthollow Cavern Gate',
  },
  {
    scenePath: DUSKMIRE_MARSH_SCENE,
    tile: { x: 26, y: -24 },
    returnSpawn: { x: 26, y: -23 },
    name: 'Duskmire Marsh Gate',
  },
]

const STYLES = new Map<string, BiomeStyle>([
  [TIDEWATER_COAST_SCENE, {
    name: 'Tidewater Coast',
    groundTileId: 3,
    groundTint: 0xe2d49b,
    boundaryTileId: 2,
    boundaryTint: 0xffffff,
    encounterTint: 0xcdbf82,
    waterPools: [
      { x: 2, y: 3, width: 4, height: 6 },
      { x: 20, y: 8, width: 4, height: 6 },
    ],
  }],
  [FROSTHOLLOW_CAVERN_SCENE, {
    name: 'Frosthollow Cavern',
    groundTileId: 3,
    groundTint: 0xc7e2f4,
    boundaryTileId: 3,
    boundaryTint: 0x7696ac,
    encounterTint: 0xa9d0eb,
    waterPools: [
      { x: 3, y: 4, width: 3, height: 3 },
      { x: 20, y: 4, width: 3, height: 3 },
    ],
  }],
  [DUSKMIRE_MARSH_SCENE, {
    name: 'Duskmire Marsh',
    groundTileId: 0,
    groundTint: 0x7d8c69,
    boundaryTileId: 3,
    boundaryTint: 0x4f5d49,
    encounterTint: 0x68775b,
    waterPools: [
      { x: 4, y: 5, width: 5, height: 4 },
      { x: 17, y: 10, width: 5, height: 4 },
    ],
  }],
])

export function getNativeSceneDefinition(scenePath: string): ImportedSceneDefinition | null {
  const style = STYLES.get(scenePath)
  if (!style) return null

  const gateway = TOWN_GATEWAYS.find((entry) => entry.scenePath === scenePath)
  if (!gateway) throw new Error(`Missing Town gateway for native biome: ${scenePath}`)

  return createBiomeScene(style, gateway.returnSpawn)
}

export function decorateLegacyScene(
  scenePath: string,
  scene: ImportedSceneDefinition,
): ImportedSceneDefinition {
  if (scenePath !== TOWN_SCENE) return scene

  const gatewayDoors: DoorDefinition[] = TOWN_GATEWAYS.map((gateway) => ({
    tile: { ...gateway.tile },
    nextScene: gateway.scenePath,
    spawnTile: { ...BIOME_SPAWN },
    spawnDirection: 'up',
    invisible: true,
  }))

  const gatewayMarkers: WorldObjectDefinition[] = TOWN_GATEWAYS.map((gateway) => ({
    name: gateway.name,
    texturePath: GATE_MARKER_TEXTURE,
    position: {
      x: gateway.tile.x * TILE_SIZE,
      y: gateway.tile.y * TILE_SIZE,
    },
    zIndex: gateway.tile.y * TILE_SIZE + TILE_SIZE,
  }))

  return {
    ...scene,
    tiles: scene.tiles.map((tile) => ({ ...tile })),
    ledgeTiles: scene.ledgeTiles.map((tile) => ({ ...tile })),
    objects: [
      ...scene.objects.map((object) => ({ ...object, position: { ...object.position } })),
      ...gatewayMarkers,
    ],
    doors: [
      ...scene.doors.map(cloneDoor),
      ...gatewayDoors,
    ],
  }
}

export function listTownBiomeGateways(): readonly {
  scenePath: string
  tile: { x: number; y: number }
  returnSpawn: { x: number; y: number }
  name: string
}[] {
  return TOWN_GATEWAYS.map((gateway) => ({
    ...gateway,
    tile: { ...gateway.tile },
    returnSpawn: { ...gateway.returnSpawn },
  }))
}

function createBiomeScene(
  style: BiomeStyle,
  townReturnSpawn: { x: number; y: number },
): ImportedSceneDefinition {
  const width = 26
  const height = 20
  const tiles: TileDefinition[] = []

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const boundary = x === 0 || y === 0 || x === width - 1 || y === height - 1
      const inPool = style.waterPools?.some((pool) =>
        x >= pool.x
        && x < pool.x + pool.width
        && y >= pool.y
        && y < pool.y + pool.height
      ) ?? false
      const centralPath = x >= 12 && x <= 13 && y >= 14
      const encounterZone = !boundary
        && !inPool
        && !centralPath
        && x >= 3
        && x <= width - 4
        && y >= 3
        && y <= height - 5

      tiles.push({
        x,
        y,
        tileId: inPool ? 2 : boundary ? style.boundaryTileId : style.groundTileId,
        autotileX: 0,
        autotileY: 0,
        flipX: false,
        flipY: false,
        transpose: false,
        tint: encounterZone ? style.encounterTint : boundary ? style.boundaryTint : style.groundTint,
        blocked: boundary || inPool,
        encounterZone,
      })
    }
  }

  const objects: WorldObjectDefinition[] = [
    {
      name: 'Player',
      instancePath: 'res://Player.tscn',
      position: { x: BIOME_SPAWN.x * TILE_SIZE, y: BIOME_SPAWN.y * TILE_SIZE },
    },
  ]

  const doors: DoorDefinition[] = [{
    tile: { ...RETURN_DOOR_TILE },
    nextScene: TOWN_SCENE,
    spawnTile: { ...townReturnSpawn },
    spawnDirection: 'down',
    invisible: true,
  }]

  return {
    name: style.name,
    tiles,
    ledgeTiles: [],
    objects,
    doors,
  }
}

function cloneDoor(door: DoorDefinition): DoorDefinition {
  return {
    ...door,
    tile: { ...door.tile },
    spawnTile: { ...door.spawnTile },
  }
}
