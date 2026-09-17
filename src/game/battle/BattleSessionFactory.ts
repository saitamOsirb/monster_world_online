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
  playerReserves: readonly BattleCombatantDefinition[]
  enemy: BattleCombatantDefinition
}

export function createReferenceBattleSession(
  encounter: WildEncounter,
  owned?: OwnedMonster | readonly OwnedMonster[] | null,
): BattleSessionDefinitions {
  const enemyLevel = Math.max(1, encounter.level)
  const enemySpecies = getSpeciesDefinition(encounter.speciesId)
  const enemyStats = calculateSpeciesStats(enemySpecies, enemyLevel)
  const ownedParty = Array.isArray(owned) ? [...owned] : owned ? [owned] : []
  const activeIndex = ownedParty.findIndex((monster) => monster.currentHp > 0)

  const player = activeIndex >= 0
    ? ownedToBattleDefinition(ownedParty[activeIndex])
    : ownedParty.length > 0
      ? ownedToBattleDefinition(ownedParty[0])
      : createReferencePlayer()

  const playerReserves = activeIndex >= 0
    ? ownedParty
        .filter((_monster, index) => index !== activeIndex)
        .map(ownedToBattleDefinition)
    : []

  return {
    player,
    playerReserves,
    enemy: {
      id: enemySpecies.id,
      displayName: enemySpecies.displayName,
      level: enemyLevel,
      maxHp: enemyStats.maxHp,
      attack: enemyStats.attack,
      defense: enemyStats.defense,
      specialAttack: enemyStats.specialAttack,
      specialDefense: enemyStats.specialDefense,
      speed: enemyStats.speed,
      elements: [...enemySpecies.elements],
      moves: createSpeciesMovesAtLevel(enemySpecies, enemyLevel),
    },
  }
}

function ownedToBattleDefinition(monster: OwnedMonster): BattleCombatantDefinition {
  return {
    id: monster.instanceId,
    displayName: monster.displayName,
    level: monster.level,
    maxHp: monster.maxHp,
    currentHp: monster.currentHp,
    attack: monster.attack,
    defense: monster.defense,
    specialAttack: monster.specialAttack ?? monster.attack,
    specialDefense: monster.specialDefense ?? monster.defense,
    speed: monster.speed,
    elements: [...monster.elements],
    moves: monster.moves.map(cloneMove),
    status: monster.status ? { ...monster.status } : undefined,
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
    specialAttack: stats.specialAttack,
    specialDefense: stats.specialDefense,
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
