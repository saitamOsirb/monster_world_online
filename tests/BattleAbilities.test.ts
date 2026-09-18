import { describe, expect, it } from 'vitest'
import { BattleEngine } from '../src/game/battle/BattleEngine'
import type {
  BattleCombatantDefinition,
  BattleEvent,
  BattleMove,
} from '../src/game/battle/types'

const PHYSICAL: BattleMove = {
  id: 'physical-test',
  name: 'Physical Test',
  power: 40,
  accuracy: 1,
  element: 'neutral',
  damageClass: 'physical',
}

const SPECIAL: BattleMove = {
  id: 'special-test',
  name: 'Special Test',
  power: 40,
  accuracy: 1,
  element: 'neutral',
  damageClass: 'special',
}

function combatant(
  id: string,
  overrides: Partial<BattleCombatantDefinition> = {},
): BattleCombatantDefinition {
  return {
    id,
    displayName: id,
    level: 10,
    maxHp: 200,
    currentHp: 200,
    attack: 40,
    defense: 30,
    specialAttack: 40,
    specialDefense: 30,
    speed: 10,
    elements: ['neutral'],
    moves: [PHYSICAL],
    ...overrides,
  }
}

function damageTo(events: readonly BattleEvent[], target: 'player' | 'enemy'): number {
  const event = events.find((candidate) => candidate.type === 'damage' && candidate.target === target)
  return event?.type === 'damage' ? event.amount : 0
}

describe('BattleEngine abilities', () => {
  it('Kindled Heart boosts Fire damage at one-third HP or lower', () => {
    const fireMove: BattleMove = {
      ...SPECIAL,
      id: 'fire-test',
      name: 'Fire Test',
      element: 'fire',
    }
    const lowHp = new BattleEngine(
      combatant('cindlet', {
        currentHp: 33,
        maxHp: 100,
        speed: 20,
        elements: ['fire'],
        abilityId: 'kindled-heart',
        moves: [fireMove],
      }),
      combatant('enemy', { speed: 1 }),
      () => 0,
    )
    const highHp = new BattleEngine(
      combatant('cindlet', {
        currentHp: 34,
        maxHp: 100,
        speed: 20,
        elements: ['fire'],
        abilityId: 'kindled-heart',
        moves: [fireMove],
      }),
      combatant('enemy', { speed: 1 }),
      () => 0,
    )

    const boosted = lowHp.resolvePlayerAction({ kind: 'move', moveId: fireMove.id })
    const normal = highHp.resolvePlayerAction({ kind: 'move', moveId: fireMove.id })

    expect(damageTo(boosted.events, 'enemy')).toBeGreaterThan(damageTo(normal.events, 'enemy'))
    expect(boosted.events).toContainEqual({
      type: 'ability-activated',
      side: 'player',
      abilityId: 'kindled-heart',
      abilityName: 'Kindled Heart',
    })
    expect(normal.events.some((event) => event.type === 'ability-activated')).toBe(false)
  })

  it('Stonehide reduces incoming physical damage but not special damage', () => {
    const physicalNormal = new BattleEngine(
      combatant('attacker', { speed: 20, moves: [PHYSICAL] }),
      combatant('plain', { speed: 1 }),
      () => 0,
    )
    const physicalStonehide = new BattleEngine(
      combatant('attacker', { speed: 20, moves: [PHYSICAL] }),
      combatant('terrun', { speed: 1, abilityId: 'stonehide' }),
      () => 0,
    )
    const specialNormal = new BattleEngine(
      combatant('attacker', { speed: 20, moves: [SPECIAL] }),
      combatant('plain', { speed: 1 }),
      () => 0,
    )
    const specialStonehide = new BattleEngine(
      combatant('attacker', { speed: 20, moves: [SPECIAL] }),
      combatant('terrun', { speed: 1, abilityId: 'stonehide' }),
      () => 0,
    )

    const normalPhysical = physicalNormal.resolvePlayerAction({ kind: 'move', moveId: PHYSICAL.id })
    const reducedPhysical = physicalStonehide.resolvePlayerAction({ kind: 'move', moveId: PHYSICAL.id })
    const normalSpecial = specialNormal.resolvePlayerAction({ kind: 'move', moveId: SPECIAL.id })
    const stonehideSpecial = specialStonehide.resolvePlayerAction({ kind: 'move', moveId: SPECIAL.id })

    expect(damageTo(reducedPhysical.events, 'enemy')).toBeLessThan(damageTo(normalPhysical.events, 'enemy'))
    expect(reducedPhysical.events).toContainEqual({
      type: 'ability-activated',
      side: 'enemy',
      abilityId: 'stonehide',
      abilityName: 'Stonehide',
    })
    expect(damageTo(stonehideSpecial.events, 'enemy')).toBe(damageTo(normalSpecial.events, 'enemy'))
  })

  it('Venom Hunger boosts damage only against poisoned targets', () => {
    const poisoned = new BattleEngine(
      combatant('miretoad', { speed: 20, abilityId: 'venom-hunger' }),
      combatant('poisoned', { speed: 1, status: { condition: 'poison' } }),
      () => 0,
    )
    const healthy = new BattleEngine(
      combatant('miretoad', { speed: 20, abilityId: 'venom-hunger' }),
      combatant('healthy', { speed: 1 }),
      () => 0,
    )

    const boosted = poisoned.resolvePlayerAction({ kind: 'move', moveId: PHYSICAL.id })
    const normal = healthy.resolvePlayerAction({ kind: 'move', moveId: PHYSICAL.id })

    expect(damageTo(boosted.events, 'enemy')).toBeGreaterThan(damageTo(normal.events, 'enemy'))
    expect(boosted.events).toContainEqual({
      type: 'ability-activated',
      side: 'player',
      abilityId: 'venom-hunger',
      abilityName: 'Venom Hunger',
    })
  })

  it('Live Wire blocks paralysis after the secondary-effect roll succeeds', () => {
    const shock: BattleMove = {
      ...SPECIAL,
      id: 'shock-test',
      name: 'Shock Test',
      element: 'electric',
      statusEffect: { condition: 'paralysis', chance: 1 },
    }
    const engine = new BattleEngine(
      combatant('attacker', { speed: 20, elements: ['electric'], moves: [shock] }),
      combatant('voltail', { speed: 1, abilityId: 'live-wire' }),
      () => 0,
    )

    const result = engine.resolvePlayerAction({ kind: 'move', moveId: shock.id })

    expect(result.state.enemy.status).toBeUndefined()
    expect(result.events).toContainEqual({
      type: 'status-immune',
      target: 'enemy',
      condition: 'paralysis',
      abilityId: 'live-wire',
      abilityName: 'Live Wire',
    })
    expect(result.events.some((event) => event.type === 'status-applied')).toBe(false)
  })

  it('Tailwind changes move order through a generic speed multiplier', () => {
    const withTailwind = new BattleEngine(
      combatant('skyrill', { speed: 10, abilityId: 'tailwind' }),
      combatant('enemy', { speed: 11 }),
      () => 0,
    )
    const withoutTailwind = new BattleEngine(
      combatant('plain', { speed: 10 }),
      combatant('enemy', { speed: 11 }),
      () => 0,
    )

    const tailwindTurn = withTailwind.resolvePlayerAction({ kind: 'move', moveId: PHYSICAL.id })
    const plainTurn = withoutTailwind.resolvePlayerAction({ kind: 'move', moveId: PHYSICAL.id })

    expect(tailwindTurn.events[0]).toMatchObject({ type: 'move', side: 'player' })
    expect(plainTurn.events[0]).toMatchObject({ type: 'move', side: 'enemy' })
  })

  it('rejects an unsupported ability id at battle construction', () => {
    expect(() => new BattleEngine(
      combatant('invalid', { abilityId: 'not-real' as never }),
      combatant('enemy'),
      () => 0,
    )).toThrow('Unsupported battle ability')
  })
})
