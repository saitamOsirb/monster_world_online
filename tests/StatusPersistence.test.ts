import { describe, expect, it } from 'vitest'
import { MonsterCollectionStore } from '../src/game/monsters/MonsterCollectionStore'
import { createStarterMonster } from '../src/game/monsters/MonsterFactory'

class MemoryStorage {
  readonly data = new Map<string, string>()
  getItem(key: string): string | null { return this.data.get(key) ?? null }
  setItem(key: string, value: string): void { this.data.set(key, value) }
  removeItem(key: string): void { this.data.delete(key) }
}

describe('persistent monster status state', () => {
  it('persists battle HP and status together across reloads', () => {
    const storage = new MemoryStorage()
    const collection = new MonsterCollectionStore(storage)
    const starter = createStarterMonster(new Date(0))
    collection.ensureStarter(starter)

    expect(collection.updateBattleState(starter.instanceId, 7, { condition: 'sleep', remainingTurns: 2 })).toBe(true)

    const reloaded = new MonsterCollectionStore(storage)
    expect(reloaded.lead?.currentHp).toBe(7)
    expect(reloaded.lead?.status).toEqual({ condition: 'sleep', remainingTurns: 2 })
  })

  it('clears a persisted condition without changing HP', () => {
    const storage = new MemoryStorage()
    const collection = new MonsterCollectionStore(storage)
    const starter = createStarterMonster(new Date(0))
    collection.ensureStarter(starter)
    collection.updateBattleState(starter.instanceId, 11, { condition: 'burn' })

    expect(collection.updateBattleState(starter.instanceId, 11, undefined)).toBe(true)

    const reloaded = new MonsterCollectionStore(storage)
    expect(reloaded.lead?.currentHp).toBe(11)
    expect(reloaded.lead?.status).toBeUndefined()
  })

  it('loads existing version-2 collection payloads that have no status field', () => {
    const storage = new MemoryStorage()
    const starter = createStarterMonster(new Date(0))
    const legacyCompatible = {
      version: 2,
      party: [{ ...starter, status: undefined }],
      storage: [],
    }
    storage.setItem('monster-world.collection.v1', JSON.stringify(legacyCompatible))

    const collection = new MonsterCollectionStore(storage)

    expect(collection.lead?.instanceId).toBe(starter.instanceId)
    expect(collection.lead?.status).toBeUndefined()
  })
})
