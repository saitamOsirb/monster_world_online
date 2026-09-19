import { describe, expect, it } from 'vitest'
import { WalletStore } from '../src/game/economy/WalletStore'
import { InventoryStore } from '../src/game/inventory/InventoryStore'
import { CAPTURE_CAPSULE_ID } from '../src/game/inventory/types'
import { QuestRewardService } from '../src/game/quests/QuestRewardService'
import { ORIN_FIELD_METHODS_QUEST_ID } from '../src/game/quests/types'
import { UnlockStore } from '../src/game/unlocks/UnlockStore'
import { FIELD_RESEARCH_CLEARANCE_ID } from '../src/game/unlocks/types'

class MemoryStorage {
  readonly data = new Map<string, string>()
  getItem(key: string): string | null { return this.data.get(key) ?? null }
  setItem(key: string, value: string): void { this.data.set(key, value) }
  removeItem(key: string): void { this.data.delete(key) }
}

const REWARD = {
  credits: 220,
  items: [{ itemId: CAPTURE_CAPSULE_ID, quantity: 2 }],
  unlocks: [FIELD_RESEARCH_CLEARANCE_ID],
} as const

function setup(
  walletStorage = new MemoryStorage(),
  inventoryStorage = new MemoryStorage(),
  unlockStorage = new MemoryStorage(),
): {
  rewards: QuestRewardService
  wallet: WalletStore
  inventory: InventoryStore
  unlocks: UnlockStore
} {
  const wallet = new WalletStore(walletStorage)
  const inventory = new InventoryStore(inventoryStorage)
  const unlocks = new UnlockStore(unlockStorage)
  wallet.ensureStarterBalance(200)
  inventory.ensureStarterStock(0)
  return {
    rewards: new QuestRewardService(wallet, inventory, unlocks),
    wallet,
    inventory,
    unlocks,
  }
}

describe('QuestRewardService', () => {
  it('grants credits, items and unlocks as one retryable reward package', () => {
    const fixture = setup()

    expect(fixture.rewards.grant(ORIN_FIELD_METHODS_QUEST_ID, REWARD)).toEqual({
      credits: 220,
      items: [{ itemId: CAPTURE_CAPSULE_ID, quantity: 2 }],
      unlocks: [FIELD_RESEARCH_CLEARANCE_ID],
      applied: true,
    })
    expect(fixture.wallet.balance).toBe(420)
    expect(fixture.inventory.getQuantity(CAPTURE_CAPSULE_ID)).toBe(2)
    expect(fixture.unlocks.has(FIELD_RESEARCH_CLEARANCE_ID)).toBe(true)
  })

  it('does not duplicate any component when the whole reward is retried', () => {
    const walletStorage = new MemoryStorage()
    const inventoryStorage = new MemoryStorage()
    const unlockStorage = new MemoryStorage()
    const first = setup(walletStorage, inventoryStorage, unlockStorage)

    first.rewards.grant(ORIN_FIELD_METHODS_QUEST_ID, REWARD)

    const second = setup(walletStorage, inventoryStorage, unlockStorage)
    expect(second.rewards.grant(ORIN_FIELD_METHODS_QUEST_ID, REWARD).applied).toBe(false)
    expect(second.wallet.balance).toBe(420)
    expect(second.inventory.getQuantity(CAPTURE_CAPSULE_ID)).toBe(2)
    expect(second.unlocks.has(FIELD_RESEARCH_CLEARANCE_ID)).toBe(true)
  })

  it('preserves the historical credit transaction id when reconciling new components', () => {
    const walletStorage = new MemoryStorage()
    const inventoryStorage = new MemoryStorage()
    const unlockStorage = new MemoryStorage()
    const fixture = setup(walletStorage, inventoryStorage, unlockStorage)

    expect(fixture.wallet.creditOnce(
      'quest:orin-field-methods:reward',
      220,
    ).applied).toBe(true)

    const grant = fixture.rewards.grant(ORIN_FIELD_METHODS_QUEST_ID, REWARD)

    expect(grant.applied).toBe(true)
    expect(fixture.wallet.balance).toBe(420)
    expect(fixture.inventory.getQuantity(CAPTURE_CAPSULE_ID)).toBe(2)
    expect(fixture.unlocks.has(FIELD_RESEARCH_CLEARANCE_ID)).toBe(true)
  })

  it('retries only the missing component after a partial previous grant', () => {
    const walletStorage = new MemoryStorage()
    const inventoryStorage = new MemoryStorage()
    const unlockStorage = new MemoryStorage()
    const fixture = setup(walletStorage, inventoryStorage, unlockStorage)

    fixture.wallet.creditOnce('quest:orin-field-methods:reward', 220)
    fixture.inventory.addOnce(
      'quest:orin-field-methods:reward:item:capture-capsule',
      CAPTURE_CAPSULE_ID,
      2,
    )

    expect(fixture.unlocks.has(FIELD_RESEARCH_CLEARANCE_ID)).toBe(false)
    expect(fixture.rewards.grant(ORIN_FIELD_METHODS_QUEST_ID, REWARD).applied).toBe(true)
    expect(fixture.wallet.balance).toBe(420)
    expect(fixture.inventory.getQuantity(CAPTURE_CAPSULE_ID)).toBe(2)
    expect(fixture.unlocks.has(FIELD_RESEARCH_CLEARANCE_ID)).toBe(true)
  })
})
