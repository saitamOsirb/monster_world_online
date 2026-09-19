import { describe, expect, it } from 'vitest'
import { UnlockStore } from '../src/game/unlocks/UnlockStore'
import { FIELD_RESEARCH_CLEARANCE_ID } from '../src/game/unlocks/types'

class MemoryStorage {
  readonly data = new Map<string, string>()
  getItem(key: string): string | null { return this.data.get(key) ?? null }
  setItem(key: string, value: string): void { this.data.set(key, value) }
  removeItem(key: string): void { this.data.delete(key) }
}

describe('UnlockStore', () => {
  it('starts locked and persists an unlock exactly once', () => {
    const storage = new MemoryStorage()
    const store = new UnlockStore(storage)

    expect(store.has(FIELD_RESEARCH_CLEARANCE_ID)).toBe(false)
    expect(store.unlock(FIELD_RESEARCH_CLEARANCE_ID)).toEqual({ applied: true })
    expect(store.unlock(FIELD_RESEARCH_CLEARANCE_ID)).toEqual({ applied: false })

    const reloaded = new UnlockStore(storage)
    expect(reloaded.has(FIELD_RESEARCH_CLEARANCE_ID)).toBe(true)
    expect(reloaded.snapshot.unlockedIds).toEqual([FIELD_RESEARCH_CLEARANCE_ID])
  })

  it('recovers safely from corrupt unlock payloads', () => {
    const storage = new MemoryStorage()
    storage.setItem('monster-world.unlocks.v1', JSON.stringify({
      version: 1,
      unlockedIds: ['unknown-unlock'],
    }))

    const store = new UnlockStore(storage)
    expect(store.snapshot).toEqual({ version: 1, unlockedIds: [] })
  })

  it('clear removes all persisted unlocks', () => {
    const storage = new MemoryStorage()
    const store = new UnlockStore(storage)
    store.unlock(FIELD_RESEARCH_CLEARANCE_ID)

    store.clear()

    expect(store.has(FIELD_RESEARCH_CLEARANCE_ID)).toBe(false)
    expect(storage.getItem('monster-world.unlocks.v1')).toBeNull()
  })
})
