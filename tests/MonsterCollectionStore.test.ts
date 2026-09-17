import { describe, expect, it } from 'vitest'
import { MonsterCollectionStore } from '../src/game/monsters/MonsterCollectionStore'
import type { OwnedMonster } from '../src/game/monsters/types'

class MemoryStorage {
  private readonly data = new Map<string, string>()
  getItem(key: string): string | null { return this.data.get(key) ?? null }
  setItem(key: string, value: string): void { this.data.set(key, value) }
  removeItem(key: string): void { this.data.delete(key) }
}

function monster(id: string): OwnedMonster {
  return {
    instanceId: id,
    speciesId: `species-${id}`,
    displayName: `Monster ${id}`,
    level: 3,
    maxHp: 20,
    currentHp: 20,
    attack: 9,
    defense: 8,
    speed: 7,
    moves: [{ id: 'hit', name: 'Hit', power: 20, accuracy: 1 }],
    spritePath: '/assets/test.png',
    capturedAt: '2026-09-17T00:00:00.000Z',
  }
}

describe('MonsterCollectionStore', () => {
  it('persists a starter and reloads it', () => {
    const storage = new MemoryStorage()
    const store = new MonsterCollectionStore(storage)
    store.ensureStarter(monster('starter'))

    expect(new MonsterCollectionStore(storage).lead?.instanceId).toBe('starter')
  })

  it('fills the six party slots then overflows to storage', () => {
    const storage = new MemoryStorage()
    const store = new MonsterCollectionStore(storage)
    store.ensureStarter(monster('starter'))

    for (let index = 1; index <= 6; index += 1) {
      store.addCaptured(monster(String(index)))
    }

    expect(store.party).toHaveLength(6)
    expect(store.storageMonsters).toHaveLength(1)
    expect(store.storageMonsters[0].instanceId).toBe('6')
  })

  it('returns defensive snapshots rather than mutable internal state', () => {
    const storage = new MemoryStorage()
    const store = new MonsterCollectionStore(storage)
    store.ensureStarter(monster('starter'))

    const snapshot = store.snapshot
    snapshot.party[0].currentHp = 1

    expect(store.lead?.currentHp).toBe(20)
  })
})
