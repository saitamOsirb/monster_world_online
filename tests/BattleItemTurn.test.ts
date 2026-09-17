import { describe, expect, it } from 'vitest'
import { BattleEngine } from '../src/game/battle/BattleEngine'
import type {
  BattleCombatantDefinition,
  BattleItemResolver,
  BattleMove,
} from '../src/game/battle/types'
import { HEALING_TONIC_ID } from '../src/game/inventory/types'

const STRIKE: BattleMove = {
  id: 'strike',
  name: 'Strike',
  power: 20,
  accuracy: 1,
  damageClass: 'physical',
}

function combatant(
  id: string,
  overrides: Partial<BattleCombatantDefinition> = {},
): BattleCombatantDefinition {
  return {
    id,
    displayName: id,
    level: 5,
    maxHp: 60,
    attack: 10,
    defense: 30,
    specialAttack: 10,
    specialDefense: 30,
    speed: 10,
    elements: ['neutral'],
    moves: [STRIKE],
    ...overrides,
  }
}

describe('BattleEngine item turns', () => {
  it('applies a successful item, lets the enemy respond and advances the turn once', () => {
    const resolver: BattleItemResolver = (itemId, target) => ({
      ok: true,
      itemId,
      itemName: 'Healing Tonic',
      currentHp: Math.min(target.maxHp, target.currentHp + 20),
      status: target.status,
      healedHp: 20,
    })
    const engine = new BattleEngine(
      combatant('player', { currentHp: 20 }),
      combatant('enemy'),
      () => 0,
      undefined,
      resolver,
    )

    const result = engine.resolvePlayerAction({ kind: 'item', itemId: HEALING_TONIC_ID })

    expect(result.events[0]).toMatchObject({
      type: 'item-used',
      itemId: HEALING_TONIC_ID,
      healedHp: 20,
    })
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'move',
      side: 'enemy',
    }))
    expect(result.state.turn).toBe(2)
    expect(result.state.player.currentHp).toBeLessThan(40)
    expect(result.state.player.currentHp).toBeGreaterThan(20)
  })

  it('does not let the enemy act or advance the turn after an invalid item use', () => {
    const resolver: BattleItemResolver = () => ({ ok: false, reason: 'already-full' })
    const engine = new BattleEngine(
      combatant('player'),
      combatant('enemy'),
      () => 0,
      undefined,
      resolver,
    )
    const before = engine.state

    const result = engine.resolvePlayerAction({ kind: 'item', itemId: HEALING_TONIC_ID })

    expect(result.events).toEqual([{
      type: 'item-failed',
      side: 'player',
      itemId: HEALING_TONIC_ID,
      reason: 'already-full',
    }])
    expect(result.state.turn).toBe(before.turn)
    expect(result.state.player.currentHp).toBe(before.player.currentHp)
    expect(result.state.enemy.currentHp).toBe(before.enemy.currentHp)
  })

  it('processes end-of-turn status after a successful item action', () => {
    const resolver: BattleItemResolver = (itemId, target) => ({
      ok: true,
      itemId,
      itemName: 'Healing Tonic',
      currentHp: Math.min(target.maxHp, target.currentHp + 20),
      status: target.status,
      healedHp: 20,
    })
    const engine = new BattleEngine(
      combatant('player', {
        currentHp: 20,
        maxHp: 80,
        status: { condition: 'poison' },
      }),
      combatant('enemy', { attack: 1 }),
      () => 0,
      undefined,
      resolver,
    )

    const result = engine.resolvePlayerAction({ kind: 'item', itemId: HEALING_TONIC_ID })

    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'status-damage',
      side: 'player',
      condition: 'poison',
      amount: 10,
    }))
    expect(result.state.turn).toBe(2)
  })
})
