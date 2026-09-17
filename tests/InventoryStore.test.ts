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
})
