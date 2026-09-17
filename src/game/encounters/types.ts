export interface EncounterEntry {
  speciesId: string
  minLevel: number
  maxLevel: number
  weight: number
}

export interface EncounterTable {
  id: string
  encounterRate: number
  cooldownSteps: number
  entries: readonly EncounterEntry[]
}

export interface WildEncounter {
  tableId: string
  speciesId: string
  displayName: string
  level: number
  spritePath: string
}
