import type { WildEncounter } from '../encounters/types'
import type { OwnedMonster } from '../monsters/types'
import {
  STARTER_SPECIES_ID,
  calculateSpeciesStats,
  createSpeciesMovesAtLevel,
  getSpeciesDefinition,
} from '../species/catalog'
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
  const enemySpecies = getSpeciesDefinition(encounter.speciesId)
  const enemyStats = calculateSpeciesStats(enemySpecies, enemyLevel)

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
    : createReferencePlayer()

  return {
    player,
    enemy: {
      id: enemySpecies.id,
      displayName: enemySpecies.displayName,
      level: enemyLevel,
      maxHp: enemyStats.maxHp,
      attack: enemyStats.attack,
      defense: enemyStats.defense,
      speed: enemyStats.speed,
      elements: [...enemySpecies.elements],
      moves: createSpeciesMovesAtLevel(enemySpecies, enemyLevel),
    },
  }
}

function createReferencePlayer(): BattleCombatantDefinition {
  const species = getSpeciesDefinition(STARTER_SPECIES_ID)
  const level = 5
  const stats = calculateSpeciesStats(species, level)
  return {
    id: species.id,
    displayName: species.displayName,
    level,
    maxHp: stats.maxHp,
    currentHp: stats.maxHp,
    attack: stats.attack,
    defense: stats.defense,
    speed: stats.speed,
    elements: [...species.elements],
    moves: createSpeciesMovesAtLevel(species, level),
  }
}

function cloneMove(move: BattleMove): BattleMove {
  return {
    ...move,
    statusEffect: move.statusEffect ? { ...move.statusEffect } : undefined,
  }
}
