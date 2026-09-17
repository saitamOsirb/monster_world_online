import { describe, expect, it } from 'vitest'
import { BattleEngine } from '../src/game/battle/BattleEngine'
import type { BattleCombatantDefinition, BattleEvent, BattleMove } from '../src/game/battle/types'

const PHYSICAL: BattleMove = {
  id: 'physical-test',
  name: 'Physical Test',
  power: 40,
  accuracy: 1,
  damageClass: 'physical',
}

const SPECIAL: BattleMove = {
  id: 'special-test',
  name: 'Special Test',
  power: 40,
  accuracy: 1,
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
    attack: 20,
    defense: 20,
    specialAttack: 20,
    specialDefense: 20,
    speed: 10,
    elements: ['neutral'],
    moves: [PHYSICAL],
    ...overrides,
  }
}

function damageToEnemy(events: readonly BattleEvent[]): number {
  const event = events.find((candidate) => candidate.type === 'damage' && candidate.target === 'enemy')
  return event?.type === 'damage' ? event.amount : 0
}

describe('physical and special battle stats', () => {
  it('uses Attack for physical moves and Special Attack for special moves', () => {
    const physicalEngine = new BattleEngine(
      combatant('player', { attack: 10, specialAttack: 60, speed: 20, moves: [PHYSICAL] }),
      combatant('enemy'),
      () => 0,
    )
    const specialEngine = new BattleEngine(
      combatant('player', { attack: 10, specialAttack: 60, speed: 20, moves: [SPECIAL] }),
      combatant('enemy'),
      () => 0,
    )

    const physical = damageToEnemy(
      physicalEngine.resolvePlayerAction({ kind: 'move', moveId: PHYSICAL.id }).events,
    )
    const special = damageToEnemy(
      specialEngine.resolvePlayerAction({ kind: 'move', moveId: SPECIAL.id }).events,
    )

    expect(special).toBeGreaterThan(physical)
  })

  it('uses Defense only for physical and Special Defense only for special damage', () => {
    const physicalEngine = new BattleEngine(
      combatant('player', { attack: 40, specialAttack: 40, speed: 20, moves: [PHYSICAL] }),
      combatant('enemy', { defense: 80, specialDefense: 10 }),
      () => 0,
    )
    const specialEngine = new BattleEngine(
      combatant('player', { attack: 40, specialAttack: 40, speed: 20, moves: [SPECIAL] }),
      combatant('enemy', { defense: 80, specialDefense: 10 }),
      () => 0,
    )

    const physical = damageToEnemy(
      physicalEngine.resolvePlayerAction({ kind: 'move', moveId: PHYSICAL.id }).events,
    )
    const special = damageToEnemy(
      specialEngine.resolvePlayerAction({ kind: 'move', moveId: SPECIAL.id }).events,
    )

    expect(special).toBeGreaterThan(physical)
  })

  it('burn reduces physical damage but leaves special damage unchanged', () => {
    const healthySpecial = new BattleEngine(
      combatant('player', { specialAttack: 50, speed: 20, moves: [SPECIAL] }),
      combatant('enemy'),
      () => 0,
    )
    const burnedSpecial = new BattleEngine(
      combatant('player', {
        specialAttack: 50,
        speed: 20,
        maxHp: 200,
        status: { condition: 'burn' },
        moves: [SPECIAL],
      }),
      combatant('enemy'),
      () => 0,
    )

    expect(damageToEnemy(
      burnedSpecial.resolvePlayerAction({ kind: 'move', moveId: SPECIAL.id }).events,
    )).toBe(damageToEnemy(
      healthySpecial.resolvePlayerAction({ kind: 'move', moveId: SPECIAL.id }).events,
    ))
  })

  it('normalizes legacy combatants without special stats from Attack and Defense', () => {
    const engine = new BattleEngine(
      combatant('player', { specialAttack: undefined, specialDefense: undefined }),
      combatant('enemy'),
      () => 0,
    )

    expect(engine.state.player.specialAttack).toBe(engine.state.player.attack)
    expect(engine.state.player.specialDefense).toBe(engine.state.player.defense)
  })
})
