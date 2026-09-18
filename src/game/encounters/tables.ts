import {
  DUSKMIRE_MARSH_SCENE,
  FROSTHOLLOW_CAVERN_SCENE,
  TIDEWATER_COAST_SCENE,
} from '../world/NativeSceneCatalog'
import type { EncounterTable } from './types'

const TOWN_GRASS_ENCOUNTERS: EncounterTable = {
  id: 'town-grass',
  encounterRate: 0.18,
  cooldownSteps: 3,
  entries: [
    { speciesId: 'skyrill', minLevel: 2, maxLevel: 4, weight: 38 },
    { speciesId: 'mossprig', minLevel: 2, maxLevel: 4, weight: 26 },
    { speciesId: 'terrun', minLevel: 3, maxLevel: 5, weight: 16 },
    { speciesId: 'miretoad', minLevel: 3, maxLevel: 5, weight: 10 },
    { speciesId: 'voltail', minLevel: 3, maxLevel: 5, weight: 7 },
    { speciesId: 'wispurr', minLevel: 4, maxLevel: 6, weight: 3 },
  ],
}

const TIDEWATER_COAST_ENCOUNTERS: EncounterTable = {
  id: 'tidewater-coast',
  encounterRate: 0.22,
  cooldownSteps: 3,
  entries: [
    { speciesId: 'rillfin', minLevel: 4, maxLevel: 7, weight: 50 },
    { speciesId: 'skyrill', minLevel: 4, maxLevel: 6, weight: 20 },
    { speciesId: 'mossprig', minLevel: 4, maxLevel: 6, weight: 12 },
    { speciesId: 'duskfin', minLevel: 6, maxLevel: 8, weight: 10 },
    { speciesId: 'voltail', minLevel: 5, maxLevel: 7, weight: 8 },
  ],
}

const FROSTHOLLOW_CAVERN_ENCOUNTERS: EncounterTable = {
  id: 'frosthollow-cavern',
  encounterRate: 0.2,
  cooldownSteps: 3,
  entries: [
    { speciesId: 'glacub', minLevel: 5, maxLevel: 8, weight: 55 },
    { speciesId: 'terrun', minLevel: 5, maxLevel: 7, weight: 25 },
    { speciesId: 'wispurr', minLevel: 6, maxLevel: 8, weight: 15 },
    { speciesId: 'skyrill', minLevel: 6, maxLevel: 8, weight: 5 },
  ],
}

const DUSKMIRE_MARSH_ENCOUNTERS: EncounterTable = {
  id: 'duskmire-marsh',
  encounterRate: 0.24,
  cooldownSteps: 3,
  entries: [
    { speciesId: 'miretoad', minLevel: 5, maxLevel: 8, weight: 35 },
    { speciesId: 'duskfin', minLevel: 6, maxLevel: 9, weight: 30 },
    { speciesId: 'rillfin', minLevel: 5, maxLevel: 7, weight: 15 },
    { speciesId: 'wispurr', minLevel: 6, maxLevel: 8, weight: 15 },
    { speciesId: 'mossprig', minLevel: 5, maxLevel: 7, weight: 5 },
  ],
}

const TABLES_BY_SCENE = new Map<string, EncounterTable>([
  ['res://Town.tscn', TOWN_GRASS_ENCOUNTERS],
  [TIDEWATER_COAST_SCENE, TIDEWATER_COAST_ENCOUNTERS],
  [FROSTHOLLOW_CAVERN_SCENE, FROSTHOLLOW_CAVERN_ENCOUNTERS],
  [DUSKMIRE_MARSH_SCENE, DUSKMIRE_MARSH_ENCOUNTERS],
])

export function getEncounterTableForScene(scenePath: string | null): EncounterTable | null {
  if (!scenePath) return null
  return TABLES_BY_SCENE.get(scenePath) ?? null
}

export function listEncounterTables(): readonly EncounterTable[] {
  return [...TABLES_BY_SCENE.values()].map((table) => ({
    ...table,
    entries: table.entries.map((entry) => ({ ...entry })),
  }))
}
