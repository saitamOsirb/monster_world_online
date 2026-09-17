import type { BattleMove } from './types'

export const BATTLE_MOVE_CATALOG = {
  'basic-strike': {
    id: 'basic-strike',
    name: 'Strike',
    power: 40,
    accuracy: 0.95,
    element: 'neutral',
    damageClass: 'physical',
  },
  'quick-hit': {
    id: 'quick-hit',
    name: 'Quick Hit',
    power: 28,
    accuracy: 1,
    priority: 1,
    element: 'neutral',
    damageClass: 'physical',
    statusEffect: { condition: 'paralysis', chance: 0.2 },
  },
  'ember-burst': {
    id: 'ember-burst',
    name: 'Ember Burst',
    power: 38,
    accuracy: 0.95,
    element: 'fire',
    damageClass: 'special',
    statusEffect: { condition: 'burn', chance: 0.15 },
  },
  'spark-jolt': {
    id: 'spark-jolt',
    name: 'Spark Jolt',
    power: 36,
    accuracy: 0.95,
    element: 'electric',
    damageClass: 'special',
    statusEffect: { condition: 'paralysis', chance: 0.2 },
  },
  'gust-cut': {
    id: 'gust-cut',
    name: 'Gust Cut',
    power: 35,
    accuracy: 1,
    element: 'air',
    damageClass: 'physical',
  },
} as const satisfies Record<string, BattleMove>

export type BattleMoveId = keyof typeof BATTLE_MOVE_CATALOG

export function isBattleMoveId(value: string): value is BattleMoveId {
  return Object.prototype.hasOwnProperty.call(BATTLE_MOVE_CATALOG, value)
}

export function createBattleMove(id: BattleMoveId): BattleMove {
  const move = BATTLE_MOVE_CATALOG[id]
  return {
    ...move,
    statusEffect: 'statusEffect' in move && move.statusEffect ? { ...move.statusEffect } : undefined,
  }
}
