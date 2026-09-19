import {
  DUSKMIRE_MARSH_SCENE,
  FROSTHOLLOW_CAVERN_SCENE,
  TIDEWATER_COAST_SCENE,
  TRAILHEAD_ROUTE_SCENE,
} from '../world/tiled/catalog'
import type { EncounterTable } from './types'

const SKYRILL_ID = 'skyrill'
const MOSSPRIG_ID = 'mossprig'
const TERRUN_ID = 'terrun'
const MIRETOAD_ID = 'miretoad'
const VOLTAIL_ID = 'voltail'
const WISPURR_ID = 'wispurr'
const RILLFIN_ID = 'rillfin'

const TOWN_GRASS_ENCOUNTERS: EncounterTable = {
  id: 'town-grass',
  encounterRate: 0.18,
  cooldownSteps: 3,
  entries: [
    { speciesId: SKYRILL_ID, minLevel: 2, maxLevel: 4, weight: 38 },
    { speciesId: MOSSPRIG_ID, minLevel: 2, maxLevel: 4, weight: 26 },
    { speciesId: TERRUN_ID, minLevel: 3, maxLevel: 5, weight: 16 },
    { speciesId: MIRETOAD_ID, minLevel: 3, maxLevel: 5, weight: 10 },
    { speciesId: VOLTAIL_ID, minLevel: 3, maxLevel: 5, weight: 7 },
    { speciesId: WISPURR_ID, minLevel: 4, maxLevel: 6, weight: 3 },
  ],
}

const TRAILHEAD_ROUTE_ENCOUNTERS: EncounterTable = {
  id: 'trailhead-route',
  encounterRate: 0.2,
  cooldownSteps: 3,
  entries: [
    { speciesId: SKYRILL_ID, minLevel: 3, maxLevel: 5, weight: 30 },
    { speciesId: MOSSPRIG_ID, minLevel: 3, maxLevel: 5, weight: 25 },
    { speciesId: TERRUN_ID, minLevel: 3, maxLevel: 6, weight: 20 },
    { speciesId: VOLTAIL_ID, minLevel: 4, maxLevel: 6, weight: 10 },
    { speciesId: RILLFIN_ID, minLevel: 4, maxLevel: 6, weight: 8 },
    { speciesId: MIRETOAD_ID, minLevel: 4, maxLevel: 6, weight: 7 },
  ],
}

const TIDEWATER_COAST_ENCOUNTERS: EncounterTable = {
  id: 'tidewater-coast',
  encounterRate: 0.22,
  cooldownSteps: 3,
  entries: [
    { speciesId: RILLFIN_ID, minLevel: 4, maxLevel: 7, weight: 50 },
    { speciesId: SKYRILL_ID, minLevel: 4, maxLevel: 6, weight: 20 },
    { speciesId: MOSSPRIG_ID, minLevel: 4, maxLevel: 6, weight: 12 },
    { speciesId: 'duskfin', minLevel: 6, maxLevel: 8, weight: 10 },
    { speciesId: VOLTAIL_ID, minLevel: 5, maxLevel: 7, weight: 8 },
  ],
}

const FROSTHOLLOW_CAVERN_ENCOUNTERS: EncounterTable = {
  id: 'frosthollow-cavern',
  encounterRate: 0.2,
  cooldownSteps: 3,
  entries: [
    { speciesId: 'glacub', minLevel: 5, maxLevel: 8, weight: 55 },
    { speciesId: TERRUN_ID, minLevel: 5, maxLevel: 7, weight: 25 },
    { speciesId: WISPURR_ID, minLevel: 6, maxLevel: 8, weight: 15 },
    { speciesId: SKYRILL_ID, minLevel: 6, maxLevel: 8, weight: 5 },
  ],
}

const DUSKMIRE_MARSH_ENCOUNTERS: EncounterTable = {
  id: 'duskmire-marsh',
  encounterRate: 0.24,
  cooldownSteps: 3,
  entries: [
    { speciesId: MIRETOAD_ID, minLevel: 5, maxLevel: 8, weight: 35 },
    { speciesId: 'duskfin', minLevel: 6, maxLevel: 9, weight: 30 },
    { speciesId: RILLFIN_ID, minLevel: 5, maxLevel: 7, weight: 15 },
    { speciesId: WISPURR_ID, minLevel: 6, maxLevel: 8, weight: 15 },
    { speciesId: MOSSPRIG_ID, minLevel: 5, maxLevel: 7, weight: 5 },
  ],
}

const ALL_TABLES = [
  TOWN_GRASS_ENCOUNTERS,
  TRAILHEAD_ROUTE_ENCOUNTERS,
  TIDEWATER_COAST_ENCOUNTERS,
  FROSTHOLLOW_CAVERN_ENCOUNTERS,
  DUSKMIRE_MARSH_ENCOUNTERS,
]

const TABLES_BY_ID = new Map<string, EncounterTable>(
  ALL_TABLES.map((table) => [table.id, table]),
)

const TABLES_BY_SCENE = new Map<string, EncounterTable>([
  ['res://Town.tscn', TOWN_GRASS_ENCOUNTERS],
  [TRAILHEAD_ROUTE_SCENE, TRAILHEAD_ROUTE_ENCOUNTERS],
  [TIDEWATER_COAST_SCENE, TIDEWATER_COAST_ENCOUNTERS],
  [FROSTHOLLOW_CAVERN_SCENE, FROSTHOLLOW_CAVERN_ENCOUNTERS],
  [DUSKMIRE_MARSH_SCENE, DUSKMIRE_MARSH_ENCOUNTERS],
])

export function getEncounterTableForScene(
  scenePath: string | null,
  encounterTableId?: string | null,
): EncounterTable | null {
  if (encounterTableId) {
    const table = TABLES_BY_ID.get(encounterTableId)
    if (!table) throw new Error(`Unknown encounter table: ${encounterTableId}`)
    return table
  }
  if (!scenePath) return null
  return TABLES_BY_SCENE.get(scenePath) ?? null
}

export function listEncounterTables(): readonly EncounterTable[] {
  return ALL_TABLES.map((table) => ({
    ...table,
    entries: table.entries.map((entry) => ({ ...entry })),
  }))
}
