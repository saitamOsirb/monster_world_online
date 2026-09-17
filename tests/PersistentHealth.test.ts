import { describe, expect, it } from 'vitest'
import { BattleEngine } from '../src/game/battle/BattleEngine'
import { createReferenceBattleSession } from '../src/game/battle/BattleSessionFactory'
import type { WildEncounter } from '../src/game/encounters/types'
import { MonsterCollectionStore } from '../src/game/monsters/MonsterCollectionStore'
import { createStarterMonster } from '../src/game/monsters/MonsterFactory'

class MemoryStorage {
  readonly data = new Map<string, string>()
  getItem(key: string): string | null { return this.data.get(key) ?? null }
  setItem(key: string, value: string): void { this.data.set(key, value) }
  removeItem(key: string): void { this.data.delete(key) }
}

const encounter: WildEncounter = {
  tableId: 'test-table',
  speciesId: 'test-wild',
  displayName: 'Wildling',
  level: 3,
  spritePath: '/test.png',
}

describe('persistent monster HP', () => {
  it('starts a battle from the owned monster current HP instead of max HP', () => {
    const lead = { ...createStarterMonster(new Date(0)), currentHp: 7 }
    const definitions = createReferenceBattleSession(encounter, lead)
    const engine = new BattleEngine(definitions.player, definitions.enemy, () => 0)

    expect(definitions.player.currentHp).toBe(7)
    expect(engine.state.player.currentHp).toBe(7)
    expect(engine.state.player.maxHp).toBe(26)
  })

  it('keeps partial HP unchanged when running from battle', () => {
    const lead = { ...createStarterMonster(new Date(0)), currentHp: 11 }
    const definitions = createReferenceBattleSession(encounter, lead)
    const engine = new BattleEngine(definitions.player, definitions.enemy)

    const result = engine.resolvePlayerAction({ kind: 'run' })

    expect(result.state.phase).toBe('ran')
    expect(result.state.player.currentHp).toBe(11)
  })

  it('rejects starting a combatant at zero HP', () => {
    const lead = { ...createStarterMonster(new Date(0)), currentHp: 0 }
    const definitions = createReferenceBattleSession(encounter, lead)

    expect(() => new BattleEngine(definitions.player, definitions.enemy)).toThrow(
      'current HP must be greater than zero',
    )
  })

  it('persists terminal HP updates across collection reloads', () => {
    const storage = new MemoryStorage()
    const collection = new MonsterCollectionStore(storage)
    const starter = createStarterMonster(new Date(0))
    collection.ensureStarter(starter)

    expect(collection.updateCurrentHp(starter.instanceId, 0)).toBe(true)
    expect(collection.lead?.currentHp).toBe(0)

    const reloaded = new MonsterCollectionStore(storage)
    expect(reloaded.lead?.currentHp).toBe(0)
  })

  it('rejects impossible persisted HP values', () => {
    const storage = new MemoryStorage()
    const collection = new MonsterCollectionStore(storage)
    const starter = createStarterMonster(new Date(0))
    collection.ensureStarter(starter)

    expect(() => collection.updateCurrentHp(starter.instanceId, starter.maxHp + 1)).toThrow()
    expect(collection.lead?.currentHp).toBe(starter.maxHp)
  })
})
