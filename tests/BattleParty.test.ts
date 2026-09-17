import { describe, expect, it } from 'vitest'
import { BattleEngine } from '../src/game/battle/BattleEngine'
import type {
  BattleCombatantDefinition,
  BattleItemResolver,
  BattleMove,
} from '../src/game/battle/types'
import { REVIVE_KIT_ID } from '../src/game/inventory/types'

const TAP: BattleMove = {
  id: 'tap',
  name: 'Tap',
  power: 10,
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
    maxHp: 40,
    currentHp: 40,
    attack: 10,
    defense: 10,
    specialAttack: 10,
    specialDefense: 10,
    speed: 10,
    elements: ['neutral'],
    moves: [TAP],
    ...overrides,
  }
}

describe('BattleEngine player party', () => {
  it('voluntary switch consumes the turn and allows one enemy response', () => {
    const engine = new BattleEngine(
      combatant('lead'),
      combatant('enemy', { attack: 2 }),
      () => 0,
      undefined,
      undefined,
      [combatant('reserve')],
    )

    expect(engine.state.participatingPlayerIds).toEqual(['lead'])

    const result = engine.resolvePlayerAction({ kind: 'switch', targetId: 'reserve' })

    expect(result.state.player.id).toBe('reserve')
    expect(result.state.participatingPlayerIds).toEqual(['lead', 'reserve'])
    expect(result.state.turn).toBe(2)
    expect(result.events[0]).toMatchObject({
      type: 'switch',
      forced: false,
      fromId: 'lead',
      toId: 'reserve',
    })
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'move',
      side: 'enemy',
    }))
    expect(result.state.player.currentHp).toBeLessThan(40)
  })

  it('requires a free forced switch when the active monster faints and a reserve survives', () => {
    const finisher: BattleMove = {
      id: 'finisher',
      name: 'Finisher',
      power: 500,
      accuracy: 1,
    }
    const engine = new BattleEngine(
      combatant('lead', { currentHp: 1, speed: 1 }),
      combatant('enemy', { speed: 30, attack: 100, moves: [finisher] }),
      () => 0,
      undefined,
      undefined,
      [combatant('reserve')],
    )

    const knockedOut = engine.resolvePlayerAction({ kind: 'move', moveId: TAP.id })

    expect(knockedOut.state.phase).toBe('awaiting-switch')
    expect(knockedOut.state.turn).toBe(2)
    expect(knockedOut.state.player.currentHp).toBe(0)
    expect(knockedOut.events).toContainEqual({ type: 'switch-required', side: 'player' })
    expect(() => engine.resolvePlayerAction({ kind: 'move', moveId: TAP.id })).toThrow(
      'replacement monster',
    )

    const replacement = engine.resolvePlayerAction({ kind: 'switch', targetId: 'reserve' })

    expect(replacement.state.phase).toBe('awaiting-player')
    expect(replacement.state.player.id).toBe('reserve')
    expect(replacement.state.participatingPlayerIds).toEqual(['lead', 'reserve'])
    expect(replacement.state.turn).toBe(2)
    expect(replacement.events).toEqual([
      expect.objectContaining({ type: 'switch', forced: true, toId: 'reserve' }),
    ])
  })

  it('loses only when no conscious party member remains', () => {
    const finisher: BattleMove = {
      id: 'finisher',
      name: 'Finisher',
      power: 500,
      accuracy: 1,
    }
    const engine = new BattleEngine(
      combatant('lead', { currentHp: 1, speed: 1 }),
      combatant('enemy', { speed: 30, attack: 100, moves: [finisher] }),
      () => 0,
      undefined,
      undefined,
      [combatant('reserve', { currentHp: 0 })],
    )

    const result = engine.resolvePlayerAction({ kind: 'move', moveId: TAP.id })

    expect(result.state.phase).toBe('lost')
    expect(result.events).toContainEqual({ type: 'battle-end', phase: 'lost' })
  })

  it('revives a fainted reserve by target id and can switch to it later', () => {
    const resolver: BattleItemResolver = (itemId, target) => {
      if (target.currentHp > 0) return { ok: false, reason: 'not-fainted' }
      return {
        ok: true,
        itemId,
        itemName: 'Revive Kit',
        currentHp: 20,
        status: target.status,
        healedHp: 20,
      }
    }
    const engine = new BattleEngine(
      combatant('lead'),
      combatant('enemy', { attack: 1 }),
      () => 0,
      undefined,
      resolver,
      [combatant('reserve', { currentHp: 0 })],
    )

    const revived = engine.resolvePlayerAction({
      kind: 'item',
      itemId: REVIVE_KIT_ID,
      targetId: 'reserve',
    })

    expect(revived.state.playerParty.find((monster) => monster.id === 'reserve')?.currentHp).toBe(20)
    expect(revived.state.participatingPlayerIds).toEqual(['lead'])
    expect(revived.state.turn).toBe(2)
    expect(revived.events[0]).toMatchObject({
      type: 'item-used',
      targetId: 'reserve',
      targetName: 'reserve',
    })

    const switched = engine.resolvePlayerAction({ kind: 'switch', targetId: 'reserve' })
    expect(switched.state.player.id).toBe('reserve')
    expect(switched.state.participatingPlayerIds).toEqual(['lead', 'reserve'])
  })

  it('does not duplicate participation when switching back to a prior participant', () => {
    const engine = new BattleEngine(
      combatant('lead'),
      combatant('enemy', { attack: 1 }),
      () => 0,
      undefined,
      undefined,
      [combatant('reserve')],
    )

    engine.resolvePlayerAction({ kind: 'switch', targetId: 'reserve' })
    const result = engine.resolvePlayerAction({ kind: 'switch', targetId: 'lead' })

    expect(result.state.participatingPlayerIds).toEqual(['lead', 'reserve'])
  })

  it('rejects invalid or fainted switch targets without consuming a turn', () => {
    const engine = new BattleEngine(
      combatant('lead'),
      combatant('enemy'),
      () => 0,
      undefined,
      undefined,
      [combatant('fainted', { currentHp: 0 })],
    )

    const before = engine.state
    const fainted = engine.resolvePlayerAction({ kind: 'switch', targetId: 'fainted' })
    expect(fainted.state.turn).toBe(before.turn)
    expect(fainted.events).toEqual([{
      type: 'switch-failed',
      side: 'player',
      targetId: 'fainted',
      reason: 'target-fainted',
    }])

    const missing = engine.resolvePlayerAction({ kind: 'switch', targetId: 'missing' })
    expect(missing.state.turn).toBe(before.turn)
  })
})
