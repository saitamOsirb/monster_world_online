import { describe, expect, it } from 'vitest'
import { CAPTURE_CAPSULE_ID } from '../src/game/inventory/types'
import { LootService } from '../src/game/loot/LootService'
import type { LootTable } from '../src/game/loot/types'

const table: LootTable = {
  id: 'test',
  entries: [
    {
      itemId: CAPTURE_CAPSULE_ID,
      chance: 0.5,
      minQuantity: 1,
      maxQuantity: 3,
    },
  ],
}

describe('LootService', () => {
  it('returns no drop when chance roll misses', () => {
    const service = new LootService(() => 0.9)
    expect(service.roll(table)).toEqual([])
  })

  it('uses injected RNG for deterministic quantity', () => {
    const rolls = [0.1, 0.75]
    const service = new LootService(() => rolls.shift() ?? 0)

    expect(service.roll(table)).toEqual([
      { itemId: CAPTURE_CAPSULE_ID, quantity: 3 },
    ])
  })

  it('supports guaranteed drops', () => {
    const service = new LootService(() => 0.999)
    const guaranteed: LootTable = {
      id: 'guaranteed',
      entries: [{ itemId: CAPTURE_CAPSULE_ID, chance: 1, minQuantity: 1, maxQuantity: 1 }],
    }

    expect(service.roll(guaranteed)).toEqual([
      { itemId: CAPTURE_CAPSULE_ID, quantity: 1 },
    ])
  })

  it('rejects malformed loot rules', () => {
    const service = new LootService(() => 0)
    const invalid: LootTable = {
      id: 'invalid',
      entries: [{ itemId: CAPTURE_CAPSULE_ID, chance: 1.1, minQuantity: 0, maxQuantity: 0 }],
    }

    expect(() => service.roll(invalid)).toThrow()
  })
})
