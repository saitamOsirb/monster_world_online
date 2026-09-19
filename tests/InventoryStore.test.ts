import { describe, expect, it } from 'vitest'
import { InventoryStore } from '../src/game/inventory/InventoryStore'
import { CAPTURE_CAPSULE_ID } from '../src/game/inventory/types'

class MemoryStorage {
  readonly data = new Map<string, string>()
  getItem(key: string): string | null { return this.data.get(key) ?? null }
  setItem(key: string, value: string): void { this.data.set(key, value) }
  removeItem(key: string): void { this.data.delete(key) }
}

describe('InventoryStore', () => {
  it('grants starter capture stock only once', () => {
    const storage = new MemoryStorage()
    const store = new InventoryStore(storage)

    store.ensureStarterStock(5)
    expect(store.getQuantity(CAPTURE_CAPSULE_ID)).toBe(5)

    expect(store.consume(CAPTURE_CAPSULE_ID, 5)).toBe(true)
    store.ensureStarterStock(5)
    expect(store.getQuantity(CAPTURE_CAPSULE_ID)).toBe(0)
  })

  it('persists quantities and initialization across reloads', () => {
    const storage = new MemoryStorage()
    const first = new InventoryStore(storage)
    first.ensureStarterStock(5)
    first.consume(CAPTURE_CAPSULE_ID, 2)

    const reloaded = new InventoryStore(storage)
    expect(reloaded.snapshot.initialized).toBe(true)
    expect(reloaded.getQuantity(CAPTURE_CAPSULE_ID)).toBe(3)
  })

  it('never consumes more items than are available', () => {
    const storage = new MemoryStorage()
    const store = new InventoryStore(storage)
    store.ensureStarterStock(1)

    expect(store.consume(CAPTURE_CAPSULE_ID)).toBe(true)
    expect(store.consume(CAPTURE_CAPSULE_ID)).toBe(false)
    expect(store.getQuantity(CAPTURE_CAPSULE_ID)).toBe(0)
  })

  it('adds capture items and persists the resulting quantity', () => {
    const storage = new MemoryStorage()
    const store = new InventoryStore(storage)
    store.ensureStarterStock(0)

    expect(store.add(CAPTURE_CAPSULE_ID, 4)).toBe(4)
    expect(new InventoryStore(storage).getQuantity(CAPTURE_CAPSULE_ID)).toBe(4)
  })

  it('returns categorized bag entries with live quantities', () => {
    const storage = new MemoryStorage()
    const store = new InventoryStore(storage)
    store.ensureStarterStock(5)

    const entries = store.getEntries('capture')
    expect(entries).toHaveLength(1)
    expect(entries[0].item.id).toBe(CAPTURE_CAPSULE_ID)
    expect(entries[0].item.displayName).toBe('Capture Capsule')
    expect(entries[0].quantity).toBe(5)
    expect(entries[0].item.useContext).toBe('battle')
    expect(store.getEntries('healing')).toEqual([])
  })

  it('hides zero-stock entries unless explicitly requested', () => {
    const storage = new MemoryStorage()
    const store = new InventoryStore(storage)
    store.ensureStarterStock(0)

    expect(store.getEntries('capture')).toEqual([])
    const entries = store.getEntries('capture', true)
    expect(entries).toHaveLength(1)
    expect(entries[0].quantity).toBe(0)
  })

  it('returns defensive item definitions for bag consumers', () => {
    const storage = new MemoryStorage()
    const store = new InventoryStore(storage)
    store.ensureStarterStock(2)

    const entry = store.getEntries('capture')[0]
    entry.item.displayName = 'Changed externally'

    expect(store.getEntries('capture')[0].item.displayName).toBe('Capture Capsule')
  })

  it('rejects invalid inventory mutations', () => {
    const storage = new MemoryStorage()
    const store = new InventoryStore(storage)

    expect(() => store.ensureStarterStock(-1)).toThrow()
    expect(() => store.add(CAPTURE_CAPSULE_ID, 0)).toThrow()
    expect(() => store.consume(CAPTURE_CAPSULE_ID, 1.5)).toThrow()
  })

  it('recovers from a corrupt persisted payload without manufacturing stock', () => {
    const storage = new MemoryStorage()
    storage.setItem('monster-world.inventory.v1', JSON.stringify({
      version: 1,
      initialized: true,
      quantities: { [CAPTURE_CAPSULE_ID]: -4 },
    }))

    const store = new InventoryStore(storage)
    expect(store.snapshot.initialized).toBe(false)
    expect(store.getQuantity(CAPTURE_CAPSULE_ID)).toBe(0)
  })

  it('applies an idempotent item grant exactly once across reloads', () => {
    const storage = new MemoryStorage()
    const store = new InventoryStore(storage)
    store.ensureStarterStock(0)

    expect(store.addOnce('quest:field-methods:reward:item:capture-capsule', CAPTURE_CAPSULE_ID, 2))
      .toEqual({ applied: true, quantity: 2 })
    expect(store.addOnce('quest:field-methods:reward:item:capture-capsule', CAPTURE_CAPSULE_ID, 2))
      .toEqual({ applied: false, quantity: 2 })

    const reloaded = new InventoryStore(storage)
    expect(reloaded.addOnce(
      'quest:field-methods:reward:item:capture-capsule',
      CAPTURE_CAPSULE_ID,
      2,
    )).toEqual({ applied: false, quantity: 2 })
  })

  it('migrates valid v1 inventory state to v2 without losing quantities', () => {
    const storage = new MemoryStorage()
    storage.setItem('monster-world.inventory.v1', JSON.stringify({
      version: 1,
      initialized: true,
      quantities: { [CAPTURE_CAPSULE_ID]: 4 },
    }))

    const store = new InventoryStore(storage)

    expect(store.getQuantity(CAPTURE_CAPSULE_ID)).toBe(4)
    expect(store.snapshot.version).toBe(2)
    expect(store.snapshot.appliedTransactions).toEqual([])
    expect(JSON.parse(storage.getItem('monster-world.inventory.v1') ?? '{}').version).toBe(2)
  })

  it('rejects invalid inventory transaction ids', () => {
    const store = new InventoryStore(new MemoryStorage())

    expect(() => store.addOnce('', CAPTURE_CAPSULE_ID, 1))
      .toThrow('Inventory transaction id')
    expect(() => store.addOnce('../unsafe', CAPTURE_CAPSULE_ID, 1))
      .toThrow('Inventory transaction id')
  })

})
