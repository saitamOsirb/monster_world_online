import { describe, expect, it } from 'vitest'
import { CaptureService } from '../src/game/capture/CaptureService'
import type { BattleCombatantState } from '../src/game/battle/types'

function target(currentHp: number, maxHp = 100): BattleCombatantState {
  return {
    id: 'wild-test',
    displayName: 'Wild Test',
    level: 5,
    maxHp,
    currentHp,
    attack: 10,
    defense: 10,
    speed: 10,
    elements: ['neutral'],
    moves: [{ id: 'hit', name: 'Hit', power: 20, accuracy: 1 }],
  }
}

describe('CaptureService', () => {
  it('increases capture chance as target HP decreases', () => {
    const service = new CaptureService(() => 0.99)
    expect(service.attempt(target(100)).chance).toBeCloseTo(0.15)
    expect(service.attempt(target(50)).chance).toBeCloseTo(0.475)
    expect(service.attempt(target(1)).chance).toBeGreaterThan(0.78)
  })

  it('caps capture chance and resolves against injected RNG', () => {
    expect(new CaptureService(() => 0).attempt(target(1), 10)).toEqual({ success: true, chance: 0.9 })
    expect(new CaptureService(() => 0.95).attempt(target(1), 10)).toEqual({ success: false, chance: 0.9 })
  })

  it('does not capture a fainted target', () => {
    expect(new CaptureService(() => 0).attempt(target(0))).toEqual({ success: false, chance: 0 })
  })
})
