import type { BattleAbilityId } from '../battle/abilities'
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
export type SpeciesArtStatus = 'original' | 'temporary-reference'

export interface MonsterSpeciesDefinition {
  id: string
  legacyIds?: readonly string[]
  displayName: string
  spritePath: string
  artStatus: SpeciesArtStatus
  abilityId: BattleAbilityId
  elements: readonly BattleElement[]
  baseStats: SpeciesStats
  statGrowth: SpeciesStats
  catchRate: number
  growthCurve: SpeciesGrowthCurve
  learnset: readonly SpeciesLearnsetEntry[]
}
