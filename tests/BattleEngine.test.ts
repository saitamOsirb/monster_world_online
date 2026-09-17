import { describe, expect, it } from 'vitest'
import { BattleEngine } from '../src/game/battle/BattleEngine'
import type { BattleCombatantDefinition, BattleMove } from '../src/game/battle/types'

const STRIKE: BattleMove = { id: 'strike', name: 'Strike', power: 40, accuracy: 1 }

function combatant(
  id: string,
  overrides: Partial<BattleCombatantDefinition> = {},
): BattleCombatantDefinition {
  return {
    id,
    displayName: id,
    level: 5,
    maxHp: 30,
    attack: 12,
    defense: 10,
    speed: 10,
    moves: [STRIKE],
    ...overrides,
  }
}

describe('BattleEngine', () => {
  it('lets the faster combatant act first and stops the turn after a knockout', () => {
    const finisher: BattleMove = { id: 'finisher', name: 'Finisher', power: 500, accuracy: 1 }
    const engine = new BattleEngine(
      combatant('player', { speed: 20, attack: 100, moves: [finisher] }),
      combatant('enemy', { speed: 5, maxHp: 10 }),
      () => 0,
    )

    const result = engine.resolvePlayerAction({ kind: 'move', moveId: 'finisher' })

    expect(result.state.phase).toBe('won')
    expect(result.state.enemy.currentHp).toBe(0)
    expect(result.events.map((event) => event.type)).toEqual([
      'move',
      'damage',
      'faint',
      'battle-end',
    ])
  })

  it('honors move priority before speed', () => {
    const priorityMove: BattleMove = {
      id: 'priority',
      name: 'Priority',
      power: 500,
      accuracy: 1,
      priority: 1,
    }
    const engine = new BattleEngine(
      combatant('player', { speed: 1, attack: 100, moves: [priorityMove] }),
      combatant('enemy', { speed: 100, maxHp: 10 }),
      () => 0,
    )

    const result = engine.resolvePlayerAction({ kind: 'move', moveId: 'priority' })

    expect(result.events[0]).toMatchObject({ type: 'move', side: 'player' })
    expect(result.state.phase).toBe('won')
  })

  it('emits a miss without applying player damage when accuracy fails', () => {
    const unreliable: BattleMove = { id: 'risky', name: 'Risky', power: 100, accuracy: 0.5 }
    const randomValues = [0.9, 0]
    const engine = new BattleEngine(
      combatant('player', { speed: 20, moves: [unreliable] }),
      combatant('enemy', { speed: 5 }),
      () => randomValues.shift() ?? 0,
    )

    const result = engine.resolvePlayerAction({ kind: 'move', moveId: 'risky' })

    expect(result.events).toContainEqual({ type: 'miss', side: 'player', moveId: 'risky' })
    expect(result.state.enemy.currentHp).toBe(result.state.enemy.maxHp)
    expect(result.state.player.currentHp).toBeLessThan(result.state.player.maxHp)
    expect(result.state.turn).toBe(2)
  })

  it('ends immediately when the player runs', () => {
    const engine = new BattleEngine(combatant('player'), combatant('enemy'))

    const result = engine.resolvePlayerAction({ kind: 'run' })

    expect(result.state.phase).toBe('ran')
    expect(result.events).toEqual([
      { type: 'run', side: 'player' },
      { type: 'battle-end', phase: 'ran' },
    ])
  })

  it('returns snapshots that cannot mutate engine state by reference', () => {
    const engine = new BattleEngine(combatant('player'), combatant('enemy'))
    const snapshot = engine.state
    snapshot.player.currentHp = 1
    ;(snapshot.player.moves[0] as BattleMove).power = 999

    expect(engine.state.player.currentHp).toBe(30)
    expect(engine.state.player.moves[0].power).toBe(40)
  })

  it('rejects moves the combatant does not know', () => {
    const engine = new BattleEngine(combatant('player'), combatant('enemy'))

    expect(() => engine.resolvePlayerAction({ kind: 'move', moveId: 'missing' })).toThrow(
      'does not know move',
    )
  })
})
