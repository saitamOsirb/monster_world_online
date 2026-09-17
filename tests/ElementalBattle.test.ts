import { describe, expect, it } from 'vitest'
import { BattleEngine } from '../src/game/battle/BattleEngine'
import { createReferenceBattleSession } from '../src/game/battle/BattleSessionFactory'
import { elementalEffectiveness } from '../src/game/battle/elements'
import { createBattleMove } from '../src/game/battle/moves'
import type { BattleCombatantDefinition, BattleEvent, BattleMove } from '../src/game/battle/types'
import type { WildEncounter } from '../src/game/encounters/types'

function combatant(
  id: string,
  overrides: Partial<BattleCombatantDefinition> = {},
): BattleCombatantDefinition {
  return {
    id,
    displayName: id,
    level: 10,
    maxHp: 200,
    attack: 40,
    defense: 30,
    speed: 10,
    elements: ['neutral'],
    moves: [{ id: 'legacy-hit', name: 'Legacy Hit', power: 40, accuracy: 1 }],
    ...overrides,
  }
}

function damageTo(events: readonly BattleEvent[], target: 'player' | 'enemy'): number {
  const event = events.find((candidate) => candidate.type === 'damage' && candidate.target === target)
  return event?.type === 'damage' ? event.amount : 0
}

describe('elemental battle model', () => {
  it('resolves strengths, resistances, immunity and capped dual-type stacking', () => {
    expect(elementalEffectiveness('fire', ['grass'])).toBe(2)
    expect(elementalEffectiveness('fire', ['water'])).toBe(0.5)
    expect(elementalEffectiveness('electric', ['earth'])).toBe(0)
    expect(elementalEffectiveness('fire', ['grass', 'ice'])).toBe(4)
    expect(elementalEffectiveness('fire', ['water', 'earth'])).toBe(0.5)
  })

  it('applies the 1.25x same-element bonus only to explicitly typed moves', () => {
    const fireMove: BattleMove = {
      id: 'fire-test',
      name: 'Fire Test',
      power: 40,
      accuracy: 1,
      element: 'fire',
      damageClass: 'special',
    }
    const withStab = new BattleEngine(
      combatant('player', { elements: ['fire'], speed: 20, moves: [fireMove] }),
      combatant('enemy'),
      () => 0,
    )
    const withoutStab = new BattleEngine(
      combatant('player', { elements: ['water'], speed: 20, moves: [fireMove] }),
      combatant('enemy'),
      () => 0,
    )

    const stabTurn = withStab.resolvePlayerAction({ kind: 'move', moveId: fireMove.id })
    const plainTurn = withoutStab.resolvePlayerAction({ kind: 'move', moveId: fireMove.id })

    expect(damageTo(stabTurn.events, 'enemy')).toBeGreaterThan(damageTo(plainTurn.events, 'enemy'))
  })

  it('emits super-effective feedback and multiplies elemental damage', () => {
    const fireMove: BattleMove = {
      id: 'fire-test',
      name: 'Fire Test',
      power: 40,
      accuracy: 1,
      element: 'fire',
      damageClass: 'special',
    }
    const engine = new BattleEngine(
      combatant('player', { elements: ['fire'], speed: 20, moves: [fireMove] }),
      combatant('enemy', { elements: ['grass'] }),
      () => 0,
    )

    const result = engine.resolvePlayerAction({ kind: 'move', moveId: fireMove.id })

    expect(result.events).toContainEqual({
      type: 'effectiveness',
      target: 'enemy',
      moveElement: 'fire',
      multiplier: 2,
      sameElementBonus: true,
    })
    expect(damageTo(result.events, 'enemy')).toBeGreaterThan(0)
  })

  it('turns elemental immunity into zero damage and blocks secondary status', () => {
    const spark = createBattleMove('spark-jolt')
    const engine = new BattleEngine(
      combatant('player', { elements: ['electric'], speed: 20, moves: [spark] }),
      combatant('enemy', { elements: ['earth'] }),
      () => 0,
    )

    const result = engine.resolvePlayerAction({ kind: 'move', moveId: spark.id })

    expect(result.events).toContainEqual({
      type: 'effectiveness',
      target: 'enemy',
      moveElement: 'electric',
      multiplier: 0,
      sameElementBonus: true,
    })
    expect(damageTo(result.events, 'enemy')).toBe(0)
    expect(result.state.enemy.status).toBeUndefined()
  })

  it('builds enemy elements, stats and learnset from the species catalog', () => {
    const encounter: WildEncounter = {
      tableId: 'element-test',
      speciesId: 'pidgey',
      displayName: 'Pidgey',
      level: 4,
      spritePath: '/assets/Pokemon/Pidgey.png',
    }

    const session = createReferenceBattleSession(encounter)

    expect(session.enemy.elements).toEqual(['air', 'neutral'])
    expect(session.enemy.maxHp).toBe(19)
    expect(session.enemy.moves.map((move) => move.id)).toEqual(['basic-strike', 'gust-cut', 'quick-hit'])
  })
})
