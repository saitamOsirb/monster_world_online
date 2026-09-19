import { TILE_SIZE } from '../constants'
import { TRAILHEAD_ROUTE_SCENE } from './tiled/catalog'
import type {
  DoorDefinition,
  ImportedSceneDefinition,
  TileDefinition,
  WorldObjectDefinition,
} from './types'

export const TIDEWATER_COAST_SCENE = 'res://MonsterWorld/TidewaterCoast.tscn'
export const FROSTHOLLOW_CAVERN_SCENE = 'res://MonsterWorld/FrosthollowCavern.tscn'
export const DUSKMIRE_MARSH_SCENE = 'res://MonsterWorld/DuskmireMarsh.tscn'
export const RESEARCH_STATION_SCENE = 'res://MonsterWorld/ResearchStation.tscn'

export const NATIVE_BIOME_SCENES = [
  TIDEWATER_COAST_SCENE,
  FROSTHOLLOW_CAVERN_SCENE,
  DUSKMIRE_MARSH_SCENE,
] as const

const TOWN_SCENE = 'res://Town.tscn'
const BIOME_SPAWN = { x: 13, y: 17 }
const RETURN_DOOR_TILE = { x: 13, y: 19 }
const TRAILHEAD_ROUTE_SPAWN = { x: 20, y: 27 }
const RESEARCH_STATION_SPAWN = { x: 8, y: 8 }
const RESEARCH_STATION_EXIT = { x: 8, y: 10 }
const RESEARCH_STATION_TOWN_RETURN = { x: 6, y: 2 }
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

const TOWN_WORLD_GATEWAYS: readonly TownGateway[] = [
  {
    scenePath: TRAILHEAD_ROUTE_SCENE,
    tile: { x: 7, y: -24 },
    returnSpawn: { x: 7, y: -23 },
    name: 'Trailhead Route Gate',
  },
]

const BIOME_ROUTE_RETURNS = new Map<string, { x: number; y: number }>([
  [TIDEWATER_COAST_SCENE, { x: 7, y: 1 }],
  [FROSTHOLLOW_CAVERN_SCENE, { x: 20, y: 1 }],
  [DUSKMIRE_MARSH_SCENE, { x: 33, y: 1 }],
])

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
  if (scenePath === RESEARCH_STATION_SCENE) return createResearchStationScene()

  const style = STYLES.get(scenePath)
  if (!style) return null

  const routeReturnSpawn = BIOME_ROUTE_RETURNS.get(scenePath)
  if (!routeReturnSpawn) throw new Error(`Missing Trailhead return for native biome: ${scenePath}`)

  return createBiomeScene(style, routeReturnSpawn)
}

export function decorateLegacyScene(
  scenePath: string,
  scene: ImportedSceneDefinition,
): ImportedSceneDefinition {
  if (scenePath !== TOWN_SCENE) return scene

  const gatewayDoors: DoorDefinition[] = TOWN_WORLD_GATEWAYS.map((gateway) => ({
    tile: { ...gateway.tile },
    nextScene: gateway.scenePath,
    spawnTile: { ...TRAILHEAD_ROUTE_SPAWN },
    spawnDirection: 'up',
    invisible: true,
  }))

  const gatewayMarkers: WorldObjectDefinition[] = TOWN_WORLD_GATEWAYS.map((gateway) => ({
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

export function listTownWorldGateways(): readonly {
  scenePath: string
  tile: { x: number; y: number }
  returnSpawn: { x: number; y: number }
  name: string
}[] {
  return TOWN_WORLD_GATEWAYS.map((gateway) => ({
    ...gateway,
    tile: { ...gateway.tile },
    returnSpawn: { ...gateway.returnSpawn },
  }))
}

function createResearchStationScene(): ImportedSceneDefinition {
  const width = 16
  const height = 11
  const tiles: TileDefinition[] = []

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const boundary = x === 0 || y === 0 || x === width - 1 || y === height - 1
      const centralAisle = x >= 7 && x <= 8
      const workstationBand = y >= 3 && y <= 5 && !centralAisle

      tiles.push({
        x,
        y,
        tileId: 3,
        autotileX: 0,
        autotileY: 0,
        flipX: false,
        flipY: false,
        transpose: false,
        tint: researchStationTileTint(boundary, workstationBand),
        blocked: boundary || workstationBand,
      })
    }
  }

  const objects: WorldObjectDefinition[] = [
    {
      name: 'Player',
      instancePath: 'res://Player.tscn',
      position: {
        x: RESEARCH_STATION_SPAWN.x * TILE_SIZE,
        y: RESEARCH_STATION_SPAWN.y * TILE_SIZE,
      },
    },
  ]

  const doors: DoorDefinition[] = [{
    tile: { ...RESEARCH_STATION_EXIT },
    nextScene: TOWN_SCENE,
    spawnTile: { ...RESEARCH_STATION_TOWN_RETURN },
    spawnDirection: 'up',
    invisible: true,
  }]

  return {
    name: 'Research Station',
    tiles,
    ledgeTiles: [],
    objects,
    doors,
  }
}

function researchStationTileTint(
  boundary: boolean,
  workstationBand: boolean,
): number {
  if (boundary) return 0x56677a
  if (workstationBand) return 0x9fb1c4
  return 0xc8d5e2
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
    nextScene: TRAILHEAD_ROUTE_SCENE,
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
