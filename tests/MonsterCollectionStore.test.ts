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
    experience: 0,
    maxHp: 20,
    currentHp: 20,
    attack: 9,
    defense: 8,
    speed: 7,
    elements: ['water'],
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

    const reloaded = new MonsterCollectionStore(storage).lead
    expect(reloaded?.instanceId).toBe('starter')
    expect(reloaded?.elements).toEqual(['water'])
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
    snapshot.party[0].experience = 999
    ;(snapshot.party[0].elements as string[])[0] = 'fire'

    expect(store.lead?.currentHp).toBe(20)
    expect(store.lead?.experience).toBe(0)
    expect(store.lead?.elements).toEqual(['water'])
  })

  it('persists experience updates', () => {
    const storage = new MemoryStorage()
    const store = new MonsterCollectionStore(storage)
    const starter = monster('starter')
    store.ensureStarter(starter)

    store.updateMonster({ ...starter, experience: 77, level: 4 })

    const reloaded = new MonsterCollectionStore(storage).lead
    expect(reloaded?.experience).toBe(77)
    expect(reloaded?.level).toBe(4)
  })

  it('migrates version 1 collections with zero experience', () => {
    const storage = new MemoryStorage()
    const legacy = monster('legacy')
    const { experience: _experience, ...legacyMonster } = legacy
    storage.setItem('monster-world.collection.v1', JSON.stringify({
      version: 1,
      party: [legacyMonster],
      storage: [],
    }))

    const store = new MonsterCollectionStore(storage)

    expect(store.snapshot.version).toBe(2)
    expect(store.lead?.instanceId).toBe('legacy')
    expect(store.lead?.experience).toBe(0)
    expect(store.lead?.elements).toEqual(['water'])
    expect(JSON.parse(storage.getItem('monster-world.collection.v1') ?? '{}').version).toBe(2)
  })

  it('normalizes pre-element version 2 monsters to neutral without inventing move typing', () => {
    const storage = new MemoryStorage()
    const current = monster('legacy-v2')
    const { elements: _elements, ...withoutElements } = current
    storage.setItem('monster-world.collection.v1', JSON.stringify({
      version: 2,
      party: [withoutElements],
      storage: [],
    }))

    const lead = new MonsterCollectionStore(storage).lead

    expect(lead?.elements).toEqual(['neutral'])
    expect(lead?.specialAttack).toBe(lead?.attack)
    expect(lead?.specialDefense).toBe(lead?.defense)
    expect(lead?.moves[0].element).toBeUndefined()
  })

  it('promotes any party member to lead and persists the order', () => {
    const storage = new MemoryStorage()
    const store = new MonsterCollectionStore(storage)
    store.ensureStarter(monster('a'))
    store.addCaptured(monster('b'))
    store.addCaptured(monster('c'))

    expect(store.setLead('c')).toBe(true)
    expect(store.party.map((entry) => entry.instanceId)).toEqual(['c', 'a', 'b'])
    expect(new MonsterCollectionStore(storage).lead?.instanceId).toBe('c')
  })

  it('moves a party member to storage while keeping at least one active monster', () => {
    const storage = new MemoryStorage()
    const store = new MonsterCollectionStore(storage)
    store.ensureStarter(monster('a'))
    store.addCaptured(monster('b'))

    expect(store.movePartyMemberToStorage('a')).toBe(true)
    expect(store.party.map((entry) => entry.instanceId)).toEqual(['b'])
    expect(store.storageMonsters.map((entry) => entry.instanceId)).toEqual(['a'])
    expect(store.movePartyMemberToStorage('b')).toBe(false)
    expect(store.party).toHaveLength(1)
  })

  it('moves a stored monster back to party when a slot is available', () => {
    const storage = new MemoryStorage()
    const store = new MonsterCollectionStore(storage)
    store.ensureStarter(monster('starter'))
    for (let index = 1; index <= 6; index += 1) store.addCaptured(monster(String(index)))

    expect(store.storageMonsters.map((entry) => entry.instanceId)).toEqual(['6'])
    expect(store.movePartyMemberToStorage('1')).toBe(true)
    expect(store.moveStorageMonsterToParty('6')).toBe(true)
    expect(store.party.map((entry) => entry.instanceId)).toContain('6')
    expect(store.storageMonsters.map((entry) => entry.instanceId)).toContain('1')
  })

  it('refuses to exceed six active party members', () => {
    const storage = new MemoryStorage()
    const store = new MonsterCollectionStore(storage)
    store.ensureStarter(monster('starter'))
    for (let index = 1; index <= 6; index += 1) store.addCaptured(monster(String(index)))

    expect(store.party).toHaveLength(6)
    expect(store.moveStorageMonsterToParty('6')).toBe(false)
    expect(store.party).toHaveLength(6)
    expect(store.storageMonsters).toHaveLength(1)
  })

  it('rejects unknown monster ids without mutating collection state', () => {
    const storage = new MemoryStorage()
    const store = new MonsterCollectionStore(storage)
    store.ensureStarter(monster('starter'))
    const before = store.snapshot

    expect(store.setLead('missing')).toBe(false)
    expect(store.movePartyMemberToStorage('missing')).toBe(false)
    expect(store.moveStorageMonsterToParty('missing')).toBe(false)
    expect(store.snapshot).toEqual(before)
  })
})
