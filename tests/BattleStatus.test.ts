import { describe, expect, it } from 'vitest'
import { BattleEngine } from '../src/game/battle/BattleEngine'
import type { BattleCombatantDefinition, BattleEvent, BattleMove } from '../src/game/battle/types'

const STRIKE: BattleMove = { id: 'strike', name: 'Strike', power: 40, accuracy: 1 }
const TAP: BattleMove = { id: 'tap', name: 'Tap', power: 1, accuracy: 1 }

function combatant(
  id: string,
  overrides: Partial<BattleCombatantDefinition> = {},
): BattleCombatantDefinition {
  return {
    id,
    displayName: id,
    level: 5,
    maxHp: 40,
    attack: 12,
    defense: 10,
    speed: 10,
    moves: [STRIKE],
    ...overrides,
  }
}

function damageAgainst(events: readonly BattleEvent[], target: 'player' | 'enemy'): number {
  const event = events.find((candidate) => candidate.type === 'damage' && candidate.target === target)
  return event?.type === 'damage' ? event.amount : 0
}

describe('BattleEngine status conditions', () => {
  it('applies poison from move metadata and deals end-of-turn residual damage', () => {
    const poisonMove: BattleMove = {
      id: 'venom-hit',
      name: 'Venom Hit',
      power: 10,
      accuracy: 1,
      statusEffect: { condition: 'poison', chance: 1 },
    }
    const engine = new BattleEngine(
      combatant('player', { speed: 20, moves: [poisonMove] }),
      combatant('enemy', { maxHp: 40 }),
      () => 0,
    )

    const result = engine.resolvePlayerAction({ kind: 'move', moveId: poisonMove.id })

    expect(result.state.enemy.status).toEqual({ condition: 'poison' })
    expect(result.events).toContainEqual({
      type: 'status-applied',
      target: 'enemy',
      condition: 'poison',
      remainingTurns: undefined,
    })
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'status-damage',
      side: 'enemy',
      condition: 'poison',
      amount: 5,
    }))
  })

  it('burn reduces outgoing attack damage and deals lighter residual damage', () => {
    const healthy = new BattleEngine(
      combatant('player', { speed: 20 }),
      combatant('enemy', { maxHp: 100 }),
      () => 0,
    )
    const burned = new BattleEngine(
      combatant('player', { speed: 20, maxHp: 80, status: { condition: 'burn' } }),
      combatant('enemy', { maxHp: 100 }),
      () => 0,
    )

    const healthyTurn = healthy.resolvePlayerAction({ kind: 'move', moveId: STRIKE.id })
    const burnedTurn = burned.resolvePlayerAction({ kind: 'move', moveId: STRIKE.id })

    expect(damageAgainst(burnedTurn.events, 'enemy')).toBeLessThan(damageAgainst(healthyTurn.events, 'enemy'))
    expect(burnedTurn.events).toContainEqual(expect.objectContaining({
      type: 'status-damage',
      side: 'player',
      condition: 'burn',
      amount: 5,
    }))
  })

  it('paralysis can block an action and halves effective speed ordering', () => {
    const randomValues = [0, 0]
    const engine = new BattleEngine(
      combatant('player', { speed: 18, status: { condition: 'paralysis' } }),
      combatant('enemy', { speed: 10 }),
      () => randomValues.shift() ?? 0,
    )

    const result = engine.resolvePlayerAction({ kind: 'move', moveId: STRIKE.id })

    expect(result.events[0]).toMatchObject({ type: 'move', side: 'enemy' })
    expect(result.events).toContainEqual({ type: 'status-blocked', side: 'player', condition: 'paralysis' })
    expect(result.state.enemy.currentHp).toBe(result.state.enemy.maxHp)
  })

  it('sleep blocks its configured number of actions and then clears', () => {
    const engine = new BattleEngine(
      combatant('player', { maxHp: 100, speed: 20, status: { condition: 'sleep', remainingTurns: 2 } }),
      combatant('enemy', { attack: 2, moves: [TAP] }),
      () => 0,
    )

    const first = engine.resolvePlayerAction({ kind: 'move', moveId: STRIKE.id })
    expect(first.state.player.status).toEqual({ condition: 'sleep', remainingTurns: 1 })
    expect(first.events).toContainEqual({ type: 'status-blocked', side: 'player', condition: 'sleep' })

    const second = engine.resolvePlayerAction({ kind: 'move', moveId: STRIKE.id })
    expect(second.state.player.status).toBeUndefined()
    expect(second.events).toContainEqual({ type: 'status-cleared', side: 'player', condition: 'sleep' })

    const third = engine.resolvePlayerAction({ kind: 'move', moveId: STRIKE.id })
    expect(third.events).toContainEqual(expect.objectContaining({ type: 'move', side: 'player' }))
  })

  it('does not overwrite an existing status condition', () => {
    const poisonMove: BattleMove = {
      id: 'venom-hit',
      name: 'Venom Hit',
      power: 10,
      accuracy: 1,
      statusEffect: { condition: 'poison', chance: 1 },
    }
    const engine = new BattleEngine(
      combatant('player', { speed: 20, moves: [poisonMove] }),
      combatant('enemy', { status: { condition: 'burn' }, maxHp: 100 }),
      () => 0,
    )

    const result = engine.resolvePlayerAction({ kind: 'move', moveId: poisonMove.id })

    expect(result.state.enemy.status).toEqual({ condition: 'burn' })
    expect(result.events.some((event) => event.type === 'status-applied')).toBe(false)
  })

  it('can end the battle from poison residual damage', () => {
    const engine = new BattleEngine(
      combatant('player', { speed: 20, moves: [TAP] }),
      combatant('enemy', {
        maxHp: 100,
        currentHp: 10,
        status: { condition: 'poison' },
        attack: 2,
        moves: [TAP],
      }),
      () => 0,
    )

    const result = engine.resolvePlayerAction({ kind: 'move', moveId: TAP.id })

    expect(result.state.enemy.currentHp).toBe(0)
    expect(result.state.phase).toBe('won')
    expect(result.events).toContainEqual({ type: 'battle-end', phase: 'won' })
  })
})
