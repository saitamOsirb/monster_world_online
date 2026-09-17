import type { BattleElement } from '../battle/elements'
import type { BattleMoveId } from '../battle/moves'

export interface SpeciesStats {
  maxHp: number
  attack: number
  defense: number
  specialAttack: number
  specialDefense: number
  speed: number
}

export interface SpeciesLearnsetEntry {
  level: number
  moveId: BattleMoveId
}

export type SpeciesGrowthCurve = 'standard'

export interface MonsterSpeciesDefinition {
  id: string
  displayName: string
  spritePath: string
  elements: readonly BattleElement[]
  baseStats: SpeciesStats
  statGrowth: SpeciesStats
  catchRate: number
  growthCurve: SpeciesGrowthCurve
  learnset: readonly SpeciesLearnsetEntry[]
}
