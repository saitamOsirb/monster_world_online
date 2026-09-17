import type { BattleCombatantState, BattleMove } from '../battle/types'
import type { WildEncounter } from '../encounters/types'
import type { OwnedMonster } from './types'

const BASIC_STRIKE: BattleMove = {
  id: 'basic-strike',
  name: 'Strike',
  power: 40,
  accuracy: 0.95,
}

const QUICK_HIT: BattleMove = {
  id: 'quick-hit',
  name: 'Quick Hit',
  power: 28,
  accuracy: 1,
  priority: 1,
}

export function createStarterMonster(now: Date = new Date()): OwnedMonster {
  return {
    instanceId: createInstanceId(),
    speciesId: 'charmander-reference',
    displayName: 'Partner',
    level: 5,
    maxHp: 26,
    currentHp: 26,
    attack: 13,
    defense: 11,
    speed: 12,
    moves: [{ ...BASIC_STRIKE }, { ...QUICK_HIT }],
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
    maxHp: enemy.maxHp,
    currentHp: Math.max(1, enemy.currentHp),
    attack: enemy.attack,
    defense: enemy.defense,
    speed: enemy.speed,
    moves: enemy.moves.map((move) => ({ ...move })),
    spritePath: encounter.spritePath,
    capturedAt: now.toISOString(),
  }
}

function createInstanceId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `monster-${Date.now()}-${Math.trunc(performance.now() * 1000)}`
}
