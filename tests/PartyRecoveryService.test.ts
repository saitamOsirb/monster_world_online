import { describe, expect, it } from 'vitest'
import { MonsterCollectionStore } from '../src/game/monsters/MonsterCollectionStore'
import { createStarterMonster } from '../src/game/monsters/MonsterFactory'
import type { OwnedMonster } from '../src/game/monsters/types'
import { PartyRecoveryService } from '../src/game/recovery/PartyRecoveryService'

class MemoryStorage {
  readonly data = new Map<string, string>()
  writes = 0

  getItem(key: string): string | null { return this.data.get(key) ?? null }
  setItem(key: string, value: string): void {
    this.writes += 1
    this.data.set(key, value)
  }
  removeItem(key: string): void { this.data.delete(key) }
}

function monster(instanceId: string, currentHp: number, maxHp = 30): OwnedMonster {
  const starter = createStarterMonster(new Date('2026-01-01T00:00:00.000Z'))
  return {
    ...starter,
    instanceId,
    displayName: instanceId,
    maxHp,
    currentHp,
    moves: starter.moves.map((move) => ({ ...move })),
  }
}

describe('PartyRecoveryService', () => {
  it('restores fainted and damaged active monsters to full HP', () => {
    const storage = new MemoryStorage()
    const collection = new MonsterCollectionStore(storage)
    collection.ensureStarter(monster('lead', 30))
    collection.addCaptured(monster('ally', 30, 40))
    collection.updateCurrentHp('lead', 0)
    collection.updateCurrentHp('ally', 9)

    const result = new PartyRecoveryService(collection).recoverActiveParty()

    expect(result).toEqual({
      recoveredMonsters: 2,
      totalHpRestored: 61,
      alreadyHealthy: false,
    })
    expect(collection.party.map((entry) => entry.currentHp)).toEqual([30, 40])
  })

  it('does not heal monsters kept in storage', () => {
    const storage = new MemoryStorage()
    const collection = new MonsterCollectionStore(storage)
    collection.ensureStarter(monster('lead', 30))
    collection.addCaptured(monster('stored', 7, 35))
    expect(collection.movePartyMemberToStorage('stored')).toBe(true)
    collection.updateCurrentHp('lead', 12)

    new PartyRecoveryService(collection).recoverActiveParty()

    expect(collection.lead?.currentHp).toBe(30)
    expect(collection.storageMonsters[0].currentHp).toBe(7)
  })

  it('does not persist again when every active monster is already healthy', () => {
    const storage = new MemoryStorage()
    const collection = new MonsterCollectionStore(storage)
    collection.ensureStarter(monster('lead', 30))
    const writesBefore = storage.writes

    const result = new PartyRecoveryService(collection).recoverActiveParty()

    expect(result.alreadyHealthy).toBe(true)
    expect(result.recoveredMonsters).toBe(0)
    expect(result.totalHpRestored).toBe(0)
    expect(storage.writes).toBe(writesBefore)
  })

  it('handles an empty collection as an already healthy no-op', () => {
    const collection = new MonsterCollectionStore(new MemoryStorage())

    expect(new PartyRecoveryService(collection).recoverActiveParty()).toEqual({
      recoveredMonsters: 0,
      totalHpRestored: 0,
      alreadyHealthy: true,
    })
  })
})
