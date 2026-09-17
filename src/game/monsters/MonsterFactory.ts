import type { BattleCombatantState, BattleMove } from '../battle/types'
import type { WildEncounter } from '../encounters/types'
import {
  STARTER_SPECIES_ID,
  calculateSpeciesStats,
  createSpeciesMovesAtLevel,
  getSpeciesDefinition,
} from '../species/catalog'
import type { OwnedMonster } from './types'

export function createStarterMonster(now: Date = new Date()): OwnedMonster {
  const species = getSpeciesDefinition(STARTER_SPECIES_ID)
  const level = 5
  const stats = calculateSpeciesStats(species, level)
  return {
    instanceId: createInstanceId(),
    speciesId: species.id,
    displayName: species.displayName,
    level,
    experience: 0,
    maxHp: stats.maxHp,
    currentHp: stats.maxHp,
    attack: stats.attack,
    defense: stats.defense,
    speed: stats.speed,
    elements: [...species.elements],
    moves: createSpeciesMovesAtLevel(species, level),
    spritePath: species.spritePath,
    capturedAt: now.toISOString(),
  }
}

export function createCapturedMonster(
  encounter: WildEncounter,
  enemy: BattleCombatantState,
  now: Date = new Date(),
): OwnedMonster {
  const species = getSpeciesDefinition(encounter.speciesId)
  return {
    instanceId: createInstanceId(),
    speciesId: species.id,
    displayName: species.displayName,
    level: enemy.level,
    experience: 0,
    maxHp: enemy.maxHp,
    currentHp: Math.max(1, enemy.currentHp),
    attack: enemy.attack,
    defense: enemy.defense,
    speed: enemy.speed,
    elements: [...enemy.elements],
    moves: enemy.moves.map(cloneMove),
    status: enemy.status ? { ...enemy.status } : undefined,
    spritePath: species.spritePath,
    capturedAt: now.toISOString(),
  }
}

function cloneMove(move: BattleMove): BattleMove {
  return {
    ...move,
    statusEffect: move.statusEffect ? { ...move.statusEffect } : undefined,
  }
}

function createInstanceId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `monster-${Date.now()}-${Math.trunc(performance.now() * 1000)}`
}
