import { describe, expect, it } from 'vitest'
import { WalletStore } from '../src/game/economy/WalletStore'
import { InventoryStore } from '../src/game/inventory/InventoryStore'
import { CAPTURE_CAPSULE_ID } from '../src/game/inventory/types'
import { LootService } from '../src/game/loot/LootService'
import type { LootTable } from '../src/game/loot/types'
import { BattleRewardService } from '../src/game/rewards/BattleRewardService'
import type { BattleCombatantState } from '../src/game/battle/types'

class MemoryStorage {
  readonly data = new Map<string, string>()
  getItem(key: string): string | null { return this.data.get(key) ?? null }
  setItem(key: string, value: string): void { this.data.set(key, value) }
  removeItem(key: string): void { this.data.delete(key) }
}

const enemy: BattleCombatantState = {
  id: 'wild-test',
  displayName: 'Wild Test',
  level: 4,
  maxHp: 35,
  currentHp: 0,
  attack: 10,
  defense: 9,
  specialAttack: 10,
  specialDefense: 9,
  speed: 8,
  elements: ['neutral'],
  moves: [],
}

const guaranteedLoot: LootTable = {
  id: 'guaranteed',
  entries: [{ itemId: CAPTURE_CAPSULE_ID, chance: 1, minQuantity: 2, maxQuantity: 2 }],
}

function fixture() {
  const storage = new MemoryStorage()
  const inventory = new InventoryStore(storage, 'inventory')
  const wallet = new WalletStore(storage, 'wallet')
  inventory.ensureStarterStock(0)
  wallet.ensureStarterBalance(0)
  const service = new BattleRewardService(inventory, wallet, new LootService(() => 0))
  return { inventory, wallet, service }
}

describe('BattleRewardService', () => {
  it('grants persistent credits and resolved loot', () => {
    const { inventory, wallet, service } = fixture()
    const result = service.grantVictory(enemy, guaranteedLoot)

    expect(result).toEqual({
      credits: 27,
      drops: [{ itemId: CAPTURE_CAPSULE_ID, quantity: 2 }],
    })
    expect(wallet.getBalance()).toBe(27)
    expect(inventory.getQuantity(CAPTURE_CAPSULE_ID)).toBe(2)
  })

  it('scales credits from enemy level and max HP', () => {
    const { service } = fixture()
    expect(service.creditsForVictory({ level: 1, maxHp: 10 })).toBe(13)
    expect(service.creditsForVictory({ level: 10, maxHp: 99 })).toBe(57)
  })

  it('can grant credits when a loot table rolls no items', () => {
    const { inventory, wallet, service } = fixture()
    const empty: LootTable = { id: 'empty', entries: [] }

    const result = service.grantVictory(enemy, empty)
    expect(result.drops).toEqual([])
    expect(wallet.getBalance()).toBe(result.credits)
    expect(inventory.getQuantity(CAPTURE_CAPSULE_ID)).toBe(0)
  })
})
