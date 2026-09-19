import { TILE_SIZE } from '../constants'
import { TOWN_SCENE } from './tiled/catalog'
export {
  DUSKMIRE_MARSH_SCENE,
  FROSTHOLLOW_CAVERN_SCENE,
  TIDEWATER_COAST_SCENE,
  TOWN_SCENE,
} from './tiled/catalog'
import type {
  DoorDefinition,
  ImportedSceneDefinition,
  TileDefinition,
  WorldObjectDefinition,
} from './types'

export const RESEARCH_STATION_SCENE = 'res://MonsterWorld/ResearchStation.tscn'

export const NATIVE_BIOME_SCENES = [] as const

export function getNativeSceneDefinition(scenePath: string): ImportedSceneDefinition | null {
  if (scenePath === RESEARCH_STATION_SCENE) return createResearchStationScene()
  return null
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

