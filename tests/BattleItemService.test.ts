import { describe, expect, it } from 'vitest'
import type { BattleCombatantState } from '../src/game/battle/types'
import { InventoryStore } from '../src/game/inventory/InventoryStore'
import {
  HEALING_TONIC_ID,
  REVIVE_KIT_ID,
  STATUS_REMEDY_ID,
} from '../src/game/inventory/types'
import { BattleItemService } from '../src/game/items/BattleItemService'

class MemoryStorage {
  readonly data = new Map<string, string>()
  getItem(key: string): string | null { return this.data.get(key) ?? null }
  setItem(key: string, value: string): void { this.data.set(key, value) }
  removeItem(key: string): void { this.data.delete(key) }
}

function target(overrides: Partial<BattleCombatantState> = {}): BattleCombatantState {
  return {
    id: 'partner',
    displayName: 'Partner',
    level: 5,
    maxHp: 30,
    currentHp: 10,
    attack: 12,
    defense: 10,
    specialAttack: 14,
    specialDefense: 11,
    speed: 10,
    elements: ['fire'],
    moves: [{ id: 'strike', name: 'Strike', power: 40, accuracy: 1 }],
    ...overrides,
  }
}

function setup() {
  const storage = new MemoryStorage()
  const inventory = new InventoryStore(storage)
  inventory.ensureStarterStock(0)
  return { inventory, service: new BattleItemService(inventory) }
}

describe('BattleItemService', () => {
  it('heals the active battle target and consumes exactly one tonic', () => {
    const { inventory, service } = setup()
    inventory.add(HEALING_TONIC_ID, 2)

    const result = service.use(HEALING_TONIC_ID, target())

    expect(result).toMatchObject({
      ok: true,
      itemId: HEALING_TONIC_ID,
      currentHp: 30,
      healedHp: 20,
    })
    expect(inventory.getQuantity(HEALING_TONIC_ID)).toBe(1)
  })

  it('does not consume a tonic when HP is already full', () => {
    const { inventory, service } = setup()
    inventory.add(HEALING_TONIC_ID, 1)

    expect(service.use(HEALING_TONIC_ID, target({ currentHp: 30 }))).toEqual({
      ok: false,
      reason: 'already-full',
    })
    expect(inventory.getQuantity(HEALING_TONIC_ID)).toBe(1)
  })

  it('clears an active status and consumes exactly one remedy', () => {
    const { inventory, service } = setup()
    inventory.add(STATUS_REMEDY_ID, 1)

    const result = service.use(
      STATUS_REMEDY_ID,
      target({ status: { condition: 'paralysis' } }),
    )

    expect(result).toMatchObject({
      ok: true,
      itemId: STATUS_REMEDY_ID,
      clearedStatus: 'paralysis',
      status: undefined,
    })
    expect(inventory.getQuantity(STATUS_REMEDY_ID)).toBe(0)
  })

  it('does not consume a remedy when there is no status', () => {
    const { inventory, service } = setup()
    inventory.add(STATUS_REMEDY_ID, 1)

    expect(service.use(STATUS_REMEDY_ID, target())).toEqual({
      ok: false,
      reason: 'no-status',
    })
    expect(inventory.getQuantity(STATUS_REMEDY_ID)).toBe(1)
  })

  it('does not consume a Revive Kit on a conscious battle target', () => {
    const { inventory, service } = setup()
    inventory.add(REVIVE_KIT_ID, 1)

    expect(service.use(REVIVE_KIT_ID, target())).toEqual({
      ok: false,
      reason: 'not-fainted',
    })
    expect(inventory.getQuantity(REVIVE_KIT_ID)).toBe(1)
  })

  it('rejects an otherwise valid item when stock is zero', () => {
    const { service } = setup()

    expect(service.use(HEALING_TONIC_ID, target())).toEqual({
      ok: false,
      reason: 'no-stock',
    })
  })
})
