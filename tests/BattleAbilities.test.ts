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

  it('Kindled Heart does not boost non-Fire damage at low HP', () => {
    const withAbility = new BattleEngine(
      combatant('cindlet', {
        currentHp: 33,
        maxHp: 100,
        speed: 20,
        elements: ['fire'],
        abilityId: 'kindled-heart',
        moves: [PHYSICAL],
      }),
      combatant('enemy', { speed: 1 }),
      () => 0,
    )
    const withoutAbility = new BattleEngine(
      combatant('cindlet', {
        currentHp: 33,
        maxHp: 100,
        speed: 20,
        elements: ['fire'],
        moves: [PHYSICAL],
      }),
      combatant('enemy', { speed: 1 }),
      () => 0,
    )

    const scoped = withAbility.resolvePlayerAction({ kind: 'move', moveId: PHYSICAL.id })
    const baseline = withoutAbility.resolvePlayerAction({ kind: 'move', moveId: PHYSICAL.id })

    expect(damageTo(scoped.events, 'enemy')).toBe(damageTo(baseline.events, 'enemy'))
    expect(scoped.events.some((event) => event.type === 'ability-activated')).toBe(false)
  })

  it('Flow Guard reduces incoming special damage but not physical damage', () => {
    const specialProbe: BattleMove = {
      ...SPECIAL,
      id: 'special-flow-guard-probe',
      power: 100,
    }
    const specialNormal = new BattleEngine(
      combatant('attacker', { speed: 20, moves: [specialProbe] }),
      combatant('plain', { speed: 1 }),
      () => 0,
    )
    const specialFlowGuard = new BattleEngine(
      combatant('attacker', { speed: 20, moves: [specialProbe] }),
      combatant('rillfin', { speed: 1, abilityId: 'flow-guard' }),
      () => 0,
    )
    const physicalNormal = new BattleEngine(
      combatant('attacker', { speed: 20, moves: [PHYSICAL] }),
      combatant('plain', { speed: 1 }),
      () => 0,
    )
    const physicalFlowGuard = new BattleEngine(
      combatant('attacker', { speed: 20, moves: [PHYSICAL] }),
      combatant('rillfin', { speed: 1, abilityId: 'flow-guard' }),
      () => 0,
    )

    const normalSpecial = specialNormal.resolvePlayerAction({ kind: 'move', moveId: specialProbe.id })
    const reducedSpecial = specialFlowGuard.resolvePlayerAction({ kind: 'move', moveId: specialProbe.id })
    const normalPhysical = physicalNormal.resolvePlayerAction({ kind: 'move', moveId: PHYSICAL.id })
    const flowGuardPhysical = physicalFlowGuard.resolvePlayerAction({ kind: 'move', moveId: PHYSICAL.id })

    expect(damageTo(reducedSpecial.events, 'enemy')).toBeLessThan(damageTo(normalSpecial.events, 'enemy'))
    expect(reducedSpecial.events).toContainEqual({
      type: 'ability-activated',
      side: 'enemy',
      abilityId: 'flow-guard',
      abilityName: 'Flow Guard',
    })
    expect(damageTo(flowGuardPhysical.events, 'enemy')).toBe(damageTo(normalPhysical.events, 'enemy'))
    expect(flowGuardPhysical.events.some((event) => event.type === 'ability-activated')).toBe(false)
  })

  it('Verdant Purity blocks poison', () => {
    const poisonMove: BattleMove = {
      ...SPECIAL,
      id: 'poison-test',
      name: 'Poison Test',
      statusEffect: { condition: 'poison', chance: 1 },
    }
    const engine = new BattleEngine(
      combatant('attacker', { speed: 20, moves: [poisonMove] }),
      combatant('mossprig', { speed: 1, abilityId: 'verdant-purity' }),
      () => 0,
    )

    const result = engine.resolvePlayerAction({ kind: 'move', moveId: poisonMove.id })

    expect(result.state.enemy.status).toBeUndefined()
    expect(result.events).toContainEqual({
      type: 'status-immune',
      target: 'enemy',
      condition: 'poison',
      abilityId: 'verdant-purity',
      abilityName: 'Verdant Purity',
    })
  })

  it('Frost Mantle blocks burn', () => {
    const burnMove: BattleMove = {
      ...SPECIAL,
      id: 'burn-test',
      name: 'Burn Test',
      statusEffect: { condition: 'burn', chance: 1 },
    }
    const engine = new BattleEngine(
      combatant('attacker', { speed: 20, moves: [burnMove] }),
      combatant('glacub', { speed: 1, abilityId: 'frost-mantle' }),
      () => 0,
    )

    const result = engine.resolvePlayerAction({ kind: 'move', moveId: burnMove.id })

    expect(result.state.enemy.status).toBeUndefined()
    expect(result.events).toContainEqual({
      type: 'status-immune',
      target: 'enemy',
      condition: 'burn',
      abilityId: 'frost-mantle',
      abilityName: 'Frost Mantle',
    })
  })

  it('Dreamwalker blocks sleep', () => {
    const sleepMove: BattleMove = {
      ...SPECIAL,
      id: 'sleep-test',
      name: 'Sleep Test',
      statusEffect: { condition: 'sleep', chance: 1, durationTurns: 2 },
    }
    const engine = new BattleEngine(
      combatant('attacker', { speed: 20, moves: [sleepMove] }),
      combatant('wispurr', { speed: 1, abilityId: 'dreamwalker' }),
      () => 0,
    )

    const result = engine.resolvePlayerAction({ kind: 'move', moveId: sleepMove.id })

    expect(result.state.enemy.status).toBeUndefined()
    expect(result.events).toContainEqual({
      type: 'status-immune',
      target: 'enemy',
      condition: 'sleep',
      abilityId: 'dreamwalker',
      abilityName: 'Dreamwalker',
    })
  })

  it('Dusk Hunter boosts damage only against sleeping targets', () => {
    const sleeping = new BattleEngine(
      combatant('duskfin', { speed: 20, abilityId: 'dusk-hunter' }),
      combatant('sleeping', { speed: 1, status: { condition: 'sleep', remainingTurns: 2 } }),
      () => 0,
    )
    const awake = new BattleEngine(
      combatant('duskfin', { speed: 20, abilityId: 'dusk-hunter' }),
      combatant('awake', { speed: 1 }),
      () => 0,
    )

    const boosted = sleeping.resolvePlayerAction({ kind: 'move', moveId: PHYSICAL.id })
    const normal = awake.resolvePlayerAction({ kind: 'move', moveId: PHYSICAL.id })

    expect(damageTo(boosted.events, 'enemy')).toBeGreaterThan(damageTo(normal.events, 'enemy'))
    expect(boosted.events).toContainEqual({
      type: 'ability-activated',
      side: 'player',
      abilityId: 'dusk-hunter',
      abilityName: 'Dusk Hunter',
    })
    expect(normal.events.some((event) => event.type === 'ability-activated')).toBe(false)
  })

  it('preserves the pre-ability deterministic damage formula when no ability is present', () => {
    const engine = new BattleEngine(
      combatant('plain-attacker', { speed: 20 }),
      combatant('plain-defender', { speed: 1 }),
      () => 0,
    )

    const result = engine.resolvePlayerAction({ kind: 'move', moveId: PHYSICAL.id })

    expect(damageTo(result.events, 'enemy')).toBe(8)
    expect(result.events.some((event) => event.type === 'ability-activated')).toBe(false)
    expect(result.events.some((event) => event.type === 'status-immune')).toBe(false)
  })

})
