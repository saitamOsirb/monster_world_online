import { describe, expect, it } from 'vitest'
import { BattleEngine } from '../src/game/battle/BattleEngine'
import type { BattleCombatantDefinition } from '../src/game/battle/types'

const player: BattleCombatantDefinition = {
  id: 'player',
  displayName: 'Player',
  level: 5,
  maxHp: 30,
  attack: 10,
  defense: 10,
  speed: 10,
  moves: [{ id: 'hit', name: 'Hit', power: 20, accuracy: 1 }],
}

const enemy: BattleCombatantDefinition = {
  id: 'enemy',
  displayName: 'Enemy',
  level: 3,
  maxHp: 20,
  attack: 8,
  defense: 8,
  speed: 8,
  moves: [{ id: 'hit', name: 'Hit', power: 20, accuracy: 1 }],
}

describe('BattleEngine capture action', () => {
  it('finishes immediately when capture succeeds', () => {
    const engine = new BattleEngine(player, enemy, () => 0, () => ({ success: true, chance: 0.75 }))
    const result = engine.resolvePlayerAction({ kind: 'capture' })

    expect(result.state.phase).toBe('captured')
    expect(result.events).toContainEqual({ type: 'capture-attempt', success: true, chance: 0.75 })
    expect(result.events).toContainEqual({ type: 'battle-end', phase: 'captured' })
  })

  it('lets the enemy act when capture fails', () => {
    const engine = new BattleEngine(player, enemy, () => 0, () => ({ success: false, chance: 0.25 }))
    const result = engine.resolvePlayerAction({ kind: 'capture' })

    expect(result.state.phase).toBe('awaiting-player')
    expect(result.state.turn).toBe(2)
    expect(result.state.player.currentHp).toBeLessThan(result.state.player.maxHp)
    expect(result.events[0]).toEqual({ type: 'capture-attempt', success: false, chance: 0.25 })
    expect(result.events.some((event) => event.type === 'move' && event.side === 'enemy')).toBe(true)
  })

  it('rejects capture when no resolver is configured', () => {
    const engine = new BattleEngine(player, enemy, () => 0)
    expect(() => engine.resolvePlayerAction({ kind: 'capture' })).toThrow('Capture is not available')
  })
})
