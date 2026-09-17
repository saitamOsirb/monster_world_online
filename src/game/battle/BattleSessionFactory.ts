import type { WildEncounter } from '../encounters/types'
import type { BattleCombatantDefinition } from './types'

export interface BattleSessionDefinitions {
  player: BattleCombatantDefinition
  enemy: BattleCombatantDefinition
}

const BASIC_STRIKE = {
  id: 'basic-strike',
  name: 'Strike',
  power: 40,
  accuracy: 0.95,
} as const

const QUICK_HIT = {
  id: 'quick-hit',
  name: 'Quick Hit',
  power: 28,
  accuracy: 1,
  priority: 1,
} as const

export function createReferenceBattleSession(encounter: WildEncounter): BattleSessionDefinitions {
  const enemyLevel = Math.max(1, encounter.level)
  return {
    player: {
      id: 'reference-player-creature',
      displayName: 'Partner',
      level: 5,
      maxHp: 26,
      attack: 13,
      defense: 11,
      speed: 12,
      moves: [BASIC_STRIKE, QUICK_HIT],
    },
    enemy: {
      id: encounter.speciesId,
      displayName: encounter.displayName,
      level: enemyLevel,
      maxHp: 12 + enemyLevel * 3,
      attack: 7 + enemyLevel * 2,
      defense: 7 + enemyLevel * 2,
      speed: 6 + enemyLevel * 2,
      moves: [BASIC_STRIKE],
    },
  }
}
