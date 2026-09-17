import type { OwnedMonster } from '../monsters/types'

export interface StatGrowth {
  maxHp: number
  attack: number
  defense: number
  speed: number
}

export interface ProgressionResult {
  monster: OwnedMonster
  experienceAwarded: number
  previousLevel: number
  newLevel: number
  levelsGained: number
  statGrowth: StatGrowth
  reachedLevelCap: boolean
}
