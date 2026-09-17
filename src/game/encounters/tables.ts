import type { EncounterTable } from './types'

const TOWN_GRASS_ENCOUNTERS: EncounterTable = {
  id: 'town-grass-reference',
  encounterRate: 0.18,
  cooldownSteps: 3,
  entries: [
    {
      speciesId: 'pidgey',
      displayName: 'Pidgey',
      minLevel: 2,
      maxLevel: 4,
      weight: 70,
      spritePath: '/assets/Pokemon/Pidgey.png',
      elements: ['air', 'neutral'],
      moveIds: ['basic-strike', 'gust-cut'],
    },
    {
      speciesId: 'pikachu',
      displayName: 'Pikachu',
      minLevel: 3,
      maxLevel: 5,
      weight: 30,
      spritePath: '/assets/Pokemon/Pikachu.png',
      elements: ['electric'],
      moveIds: ['basic-strike', 'spark-jolt'],
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
