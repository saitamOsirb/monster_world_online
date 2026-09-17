import type { BattleElement } from '../battle/elements'
import type { BattleMoveId } from '../battle/moves'

export interface EncounterEntry {
  speciesId: string
  displayName: string
  minLevel: number
  maxLevel: number
  weight: number
  spritePath: string
  elements: readonly BattleElement[]
  moveIds: readonly BattleMoveId[]
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
  elements: readonly BattleElement[]
  moveIds: readonly BattleMoveId[]
}
