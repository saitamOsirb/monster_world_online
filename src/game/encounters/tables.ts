import type { EncounterTable } from './types'

const TOWN_GRASS_ENCOUNTERS: EncounterTable = {
  id: 'town-grass',
  encounterRate: 0.18,
  cooldownSteps: 3,
  entries: [
    {
      speciesId: 'skyrill',
      minLevel: 2,
      maxLevel: 4,
      weight: 38,
    },
    {
      speciesId: 'mossprig',
      minLevel: 2,
      maxLevel: 4,
      weight: 26,
    },
    {
      speciesId: 'terrun',
      minLevel: 3,
      maxLevel: 5,
      weight: 16,
    },
    {
      speciesId: 'miretoad',
      minLevel: 3,
      maxLevel: 5,
      weight: 10,
    },
    {
      speciesId: 'voltail',
      minLevel: 3,
      maxLevel: 5,
      weight: 7,
    },
    {
      speciesId: 'wispurr',
      minLevel: 4,
      maxLevel: 6,
      weight: 3,
    },
  ],
}

const TABLES_BY_SCENE = new Map<string, EncounterTable>([
  ['res://Town.tscn', TOWN_GRASS_ENCOUNTERS],
])

export function getEncounterTableForScene(scenePath: string | null): EncounterTable | null {
  if (!scenePath) return null
  return TABLES_BY_SCENE.get(scenePath) ?? null
}
