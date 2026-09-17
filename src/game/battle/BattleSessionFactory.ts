import type { WildEncounter } from '../encounters/types'
import type { OwnedMonster } from '../monsters/types'
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

export function createReferenceBattleSession(
  encounter: WildEncounter,
  lead?: OwnedMonster | null,
): BattleSessionDefinitions {
  const enemyLevel = Math.max(1, encounter.level)
  const player: BattleCombatantDefinition = lead
    ? {
        id: lead.instanceId,
        displayName: lead.displayName,
        level: lead.level,
        maxHp: lead.maxHp,
        currentHp: lead.currentHp,
        attack: lead.attack,
        defense: lead.defense,
        speed: lead.speed,
        moves: lead.moves.map((move) => ({ ...move })),
      }
    : {
        id: 'reference-player-creature',
        displayName: 'Partner',
        level: 5,
        maxHp: 26,
        currentHp: 26,
        attack: 13,
        defense: 11,
        speed: 12,
        moves: [BASIC_STRIKE, QUICK_HIT],
      }

  return {
    player,
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
