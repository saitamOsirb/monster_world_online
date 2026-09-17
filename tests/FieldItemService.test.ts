import { describe, expect, it } from 'vitest'
import { InventoryStore } from '../src/game/inventory/InventoryStore'
import { CAPTURE_CAPSULE_ID, HEALING_TONIC_ID } from '../src/game/inventory/types'
import { FieldItemService } from '../src/game/items/FieldItemService'
import { MonsterCollectionStore } from '../src/game/monsters/MonsterCollectionStore'
import { createStarterMonster } from '../src/game/monsters/MonsterFactory'

class MemoryStorage {
  readonly data = new Map<string, string>()
  getItem(key: string): string | null { return this.data.get(key) ?? null }
  setItem(key: string, value: string): void { this.data.set(key, value) }
  removeItem(key: string): void { this.data.delete(key) }
}

function setup(currentHp: number, tonicStock = 1) {
  const storage = new MemoryStorage()
  const inventory = new InventoryStore(storage)
  const collection = new MonsterCollectionStore(storage)
  const starter = createStarterMonster(new Date(0))
  collection.ensureStarter(starter)
  collection.updateCurrentHp(starter.instanceId, currentHp)
  inventory.ensureStarterStock(0)
  if (tonicStock > 0) inventory.add(HEALING_TONIC_ID, tonicStock)
  return {
    storage,
    inventory,
    collection,
    starter,
    service: new FieldItemService(inventory, collection),
  }
}

describe('FieldItemService', () => {
  it('heals persistent HP and consumes exactly one Healing Tonic', () => {
    const { service, inventory, collection, starter, storage } = setup(5, 2)

    const result = service.use(HEALING_TONIC_ID, starter.instanceId)

    expect(result).toMatchObject({
      ok: true,
      healedHp: 20,
      currentHp: 25,
      maxHp: 26,
    })
    expect(inventory.getQuantity(HEALING_TONIC_ID)).toBe(1)
    expect(collection.lead?.currentHp).toBe(25)
    expect(new MonsterCollectionStore(storage).lead?.currentHp).toBe(25)
    expect(new InventoryStore(storage).getQuantity(HEALING_TONIC_ID)).toBe(1)
  })

  it('can recover a fainted monster from zero HP', () => {
    const { service, collection, starter } = setup(0)

    const result = service.use(HEALING_TONIC_ID, starter.instanceId)

    expect(result).toMatchObject({ ok: true, healedHp: 20, currentHp: 20 })
    expect(collection.lead?.currentHp).toBe(20)
  })

  it('does not consume a Healing Tonic at full HP', () => {
    const { service, inventory, starter } = setup(26)

    const result = service.use(HEALING_TONIC_ID, starter.instanceId)

    expect(result).toEqual({ ok: false, reason: 'already-full' })
    expect(inventory.getQuantity(HEALING_TONIC_ID)).toBe(1)
  })

  it('does not mutate HP when no Healing Tonic is available', () => {
    const { service, collection, starter } = setup(4, 0)

    const result = service.use(HEALING_TONIC_ID, starter.instanceId)

    expect(result).toEqual({ ok: false, reason: 'no-stock' })
    expect(collection.lead?.currentHp).toBe(4)
  })

  it('rejects battle-only items in the field without consuming them', () => {
    const { service, inventory, starter } = setup(4)
    inventory.add(CAPTURE_CAPSULE_ID, 1)
    const before = inventory.getQuantity(CAPTURE_CAPSULE_ID)

    const result = service.use(CAPTURE_CAPSULE_ID, starter.instanceId)

    expect(result).toEqual({ ok: false, reason: 'not-field-usable' })
    expect(inventory.getQuantity(CAPTURE_CAPSULE_ID)).toBe(before)
  })

  it('loads legacy inventory payloads without manufacturing Healing Tonics', () => {
    const storage = new MemoryStorage()
    storage.setItem('monster-world.inventory.v1', JSON.stringify({
      version: 1,
      initialized: true,
      quantities: { [CAPTURE_CAPSULE_ID]: 3 },
    }))

    const inventory = new InventoryStore(storage)

    expect(inventory.getQuantity(CAPTURE_CAPSULE_ID)).toBe(3)
    expect(inventory.getQuantity(HEALING_TONIC_ID)).toBe(0)
    inventory.add(HEALING_TONIC_ID, 2)
    expect(new InventoryStore(storage).getQuantity(HEALING_TONIC_ID)).toBe(2)
  })
})
