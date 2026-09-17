import { createBattleMove } from '../battle/moves'
import type { BattleCombatantState, BattleMove } from '../battle/types'
import type { WildEncounter } from '../encounters/types'
import type { OwnedMonster } from './types'

export function createStarterMonster(now: Date = new Date()): OwnedMonster {
  return {
    instanceId: createInstanceId(),
    speciesId: 'charmander-reference',
    displayName: 'Partner',
    level: 5,
    experience: 0,
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
    spritePath: '/assets/Pokemon/Charmander.png',
    capturedAt: now.toISOString(),
  }
}

export function createCapturedMonster(
  encounter: WildEncounter,
  enemy: BattleCombatantState,
  now: Date = new Date(),
): OwnedMonster {
  return {
    instanceId: createInstanceId(),
    speciesId: encounter.speciesId,
    displayName: encounter.displayName,
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
    spritePath: encounter.spritePath,
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
