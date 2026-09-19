import { TILE_SIZE } from '../constants'
import { TRAILHEAD_ROUTE_SCENE } from './tiled/catalog'
export {
  DUSKMIRE_MARSH_SCENE,
  FROSTHOLLOW_CAVERN_SCENE,
  TIDEWATER_COAST_SCENE,
} from './tiled/catalog'
import type {
  DoorDefinition,
  ImportedSceneDefinition,
  TileDefinition,
  WorldObjectDefinition,
} from './types'

export const RESEARCH_STATION_SCENE = 'res://MonsterWorld/ResearchStation.tscn'

export const NATIVE_BIOME_SCENES = [] as const

const TOWN_SCENE = 'res://Town.tscn'
const TRAILHEAD_ROUTE_SPAWN = { x: 20, y: 27 }
const RESEARCH_STATION_SPAWN = { x: 8, y: 8 }
const RESEARCH_STATION_EXIT = { x: 8, y: 10 }
const RESEARCH_STATION_TOWN_RETURN = { x: 6, y: 2 }
const GATE_MARKER_TEXTURE = '/assets/Buildings/pallet%20town/mat.png'

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

export function getNativeSceneDefinition(scenePath: string): ImportedSceneDefinition | null {
  if (scenePath === RESEARCH_STATION_SCENE) return createResearchStationScene()
  return null
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

function cloneDoor(door: DoorDefinition): DoorDefinition {
  return {
    ...door,
    tile: { ...door.tile },
    spawnTile: { ...door.spawnTile },
  }
}
