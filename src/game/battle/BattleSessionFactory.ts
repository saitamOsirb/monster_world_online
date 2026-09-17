import type { WildEncounter } from '../encounters/types'
import type { OwnedMonster } from '../monsters/types'
import { createBattleMove } from './moves'
import type { BattleCombatantDefinition, BattleMove } from './types'

export interface BattleSessionDefinitions {
  player: BattleCombatantDefinition
  enemy: BattleCombatantDefinition
}

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
        elements: [...lead.elements],
        moves: lead.moves.map(cloneMove),
        status: lead.status ? { ...lead.status } : undefined,
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
        elements: ['fire'],
        moves: [
          createBattleMove('basic-strike'),
          createBattleMove('ember-burst'),
          createBattleMove('quick-hit'),
        ],
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
      elements: [...encounter.elements],
      moves: encounter.moveIds.map(createBattleMove),
    },
  }
}

function cloneMove(move: BattleMove): BattleMove {
  return {
    ...move,
    statusEffect: move.statusEffect ? { ...move.statusEffect } : undefined,
  }
}
