import { describe, expect, it } from 'vitest'
import { WalletStore } from '../src/game/economy/WalletStore'
import { InventoryStore } from '../src/game/inventory/InventoryStore'
import { CAPTURE_CAPSULE_ID, HEALING_TONIC_ID } from '../src/game/inventory/types'
import {
  ORIN_FIELD_METHODS_QUEST,
  ORIN_THREE_ROADS_QUEST,
  RESEARCH_BASELINE_SAMPLES_QUEST,
} from '../src/game/quests/catalog'
import { QuestRewardService } from '../src/game/quests/QuestRewardService'
import { QuestService } from '../src/game/quests/QuestService'
import { QuestStore } from '../src/game/quests/QuestStore'
import {
  ORIN_FIELD_METHODS_QUEST_ID,
  ORIN_THREE_ROADS_QUEST_ID,
  QUEST_STATUS,
  RESEARCH_BASELINE_SAMPLES_QUEST_ID,
} from '../src/game/quests/types'
import { UnlockStore } from '../src/game/unlocks/UnlockStore'
import { FIELD_RESEARCH_CLEARANCE_ID } from '../src/game/unlocks/types'

class MemoryStorage {
  readonly data = new Map<string, string>()
  getItem(key: string): string | null { return this.data.get(key) ?? null }
  setItem(key: string, value: string): void { this.data.set(key, value) }
  removeItem(key: string): void { this.data.delete(key) }
}


class FailingDeliveryQuestStore extends QuestStore {
  failDelivery = false

  override recordObjectiveProgress(
    questId: Parameters<QuestStore['recordObjectiveProgress']>[0],
    objectiveId: string,
    increment: number,
    requiredByObjective: Readonly<Record<string, number>>,
  ): boolean {
    if (this.failDelivery && objectiveId === 'deliver-healing-tonic') {
      throw new Error('forced delivery persistence failure')
    }
    return super.recordObjectiveProgress(
      questId,
      objectiveId,
      increment,
      requiredByObjective,
    )
  }
}

interface Fixture {
  service: QuestService
  store: QuestStore
  wallet: WalletStore
  inventory: InventoryStore
  unlocks: UnlockStore
  questStorage: MemoryStorage
  walletStorage: MemoryStorage
  inventoryStorage: MemoryStorage
  unlockStorage: MemoryStorage
}

function createService(
  questStorage = new MemoryStorage(),
  walletStorage = new MemoryStorage(),
  inventoryStorage = new MemoryStorage(),
  unlockStorage = new MemoryStorage(),
): Fixture {
  const store = new QuestStore(questStorage)
  const wallet = new WalletStore(walletStorage)
  const inventory = new InventoryStore(inventoryStorage)
  const unlocks = new UnlockStore(unlockStorage)
  const rewards = new QuestRewardService(wallet, inventory, unlocks)
  wallet.ensureStarterBalance(200)
  inventory.ensureStarterStock(0)
  return {
    service: new QuestService(store, rewards, inventory),
    store,
    wallet,
    inventory,
    unlocks,
    questStorage,
    walletStorage,
    inventoryStorage,
    unlockStorage,
  }
}

function completeThreeRoads(fixture: Fixture): void {
  fixture.service.accept(ORIN_THREE_ROADS_QUEST_ID)
  for (const objective of ORIN_THREE_ROADS_QUEST.objectives) {
    fixture.service.recordSceneVisit(objective.scenePath)
  }
  fixture.service.turnIn(ORIN_THREE_ROADS_QUEST_ID)
}


function completeFieldMethods(fixture: Fixture): void {
  completeThreeRoads(fixture)
  fixture.inventory.add(HEALING_TONIC_ID, 1)
  fixture.service.accept(ORIN_FIELD_METHODS_QUEST_ID)
  fixture.service.recordDefeat('skyrill', 2)
  fixture.service.recordCapture('rillfin')
  fixture.service.deliverItems(ORIN_FIELD_METHODS_QUEST_ID)
  fixture.service.turnIn(ORIN_FIELD_METHODS_QUEST_ID)
}

describe('QuestService', () => {
  it('records scene visits only after The Three Roads is active', () => {
    const fixture = createService()
    const coast = ORIN_THREE_ROADS_QUEST.objectives[0]

    expect(fixture.service.recordSceneVisit(coast.scenePath)).toEqual([])
    fixture.service.accept(ORIN_THREE_ROADS_QUEST_ID)

    expect(fixture.service.recordSceneVisit(coast.scenePath)).toEqual([{
      questId: ORIN_THREE_ROADS_QUEST_ID,
      objectiveId: coast.id,
      current: 1,
      required: 1,
      status: QUEST_STATUS.active,
    }])
  })

  it('moves The Three Roads to ready after all configured visits', () => {
    const fixture = createService()
    fixture.service.accept(ORIN_THREE_ROADS_QUEST_ID)

    for (const objective of ORIN_THREE_ROADS_QUEST.objectives) {
      fixture.service.recordSceneVisit(objective.scenePath)
    }

    expect(fixture.service.getProgress(ORIN_THREE_ROADS_QUEST_ID)).toEqual({
      questId: ORIN_THREE_ROADS_QUEST_ID,
      status: QUEST_STATUS.readyToTurnIn,
      objectiveProgress: {
        'visit-tidewater-coast': 1,
        'visit-frosthollow-cavern': 1,
        'visit-duskmire-marsh': 1,
      },
    })
  })

  it('keeps Field Methods locked until The Three Roads is completed', () => {
    const fixture = createService()

    expect(fixture.service.isUnlocked(ORIN_FIELD_METHODS_QUEST_ID)).toBe(false)
    expect(fixture.service.accept(ORIN_FIELD_METHODS_QUEST_ID)).toBe(false)

    completeThreeRoads(fixture)

    expect(fixture.service.isUnlocked(ORIN_FIELD_METHODS_QUEST_ID)).toBe(true)
    expect(fixture.service.accept(ORIN_FIELD_METHODS_QUEST_ID)).toBe(true)
  })

  it('counts species defeats quantitatively and caps at the configured target', () => {
    const fixture = createService()
    completeThreeRoads(fixture)
    fixture.service.accept(ORIN_FIELD_METHODS_QUEST_ID)

    expect(fixture.service.recordDefeat('skyrill')).toEqual([{
      questId: ORIN_FIELD_METHODS_QUEST_ID,
      objectiveId: 'defeat-skyrill',
      current: 1,
      required: 2,
      status: QUEST_STATUS.active,
    }])

    fixture.service.recordDefeat('skyrill', 5)
    expect(
      fixture.service.getProgress(ORIN_FIELD_METHODS_QUEST_ID)
        .objectiveProgress['defeat-skyrill'],
    ).toBe(2)
    expect(fixture.service.recordDefeat('skyrill')).toEqual([])
    expect(fixture.service.recordDefeat('cindlet')).toEqual([])
  })

  it('records captures independently from defeats', () => {
    const fixture = createService()
    completeThreeRoads(fixture)
    fixture.service.accept(ORIN_FIELD_METHODS_QUEST_ID)

    expect(fixture.service.recordCapture('rillfin')).toEqual([{
      questId: ORIN_FIELD_METHODS_QUEST_ID,
      objectiveId: 'capture-rillfin',
      current: 1,
      required: 1,
      status: QUEST_STATUS.active,
    }])
    expect(
      fixture.service.getProgress(ORIN_FIELD_METHODS_QUEST_ID)
        .objectiveProgress['defeat-skyrill'],
    ).toBeUndefined()
  })

  it('syncs collect-item objectives from inventory when a quest is accepted', () => {
    const fixture = createService()
    completeThreeRoads(fixture)
    fixture.inventory.add(HEALING_TONIC_ID, 1)

    fixture.service.accept(ORIN_FIELD_METHODS_QUEST_ID)

    expect(
      fixture.service.getProgress(ORIN_FIELD_METHODS_QUEST_ID)
        .objectiveProgress['collect-healing-tonic'],
    ).toBe(1)
    expect(fixture.inventory.getQuantity(HEALING_TONIC_ID)).toBe(1)
  })

  it('records items acquired after quest acceptance', () => {
    const fixture = createService()
    completeThreeRoads(fixture)
    fixture.service.accept(ORIN_FIELD_METHODS_QUEST_ID)

    fixture.inventory.add(HEALING_TONIC_ID, 1)
    expect(fixture.service.recordItemAcquired(HEALING_TONIC_ID, 1)).toEqual([{
      questId: ORIN_FIELD_METHODS_QUEST_ID,
      objectiveId: 'collect-healing-tonic',
      current: 1,
      required: 1,
      status: QUEST_STATUS.active,
    }])
  })

  it('does not consume delivery items while other objectives are incomplete', () => {
    const fixture = createService()
    completeThreeRoads(fixture)
    fixture.inventory.add(HEALING_TONIC_ID, 1)
    fixture.service.accept(ORIN_FIELD_METHODS_QUEST_ID)

    expect(fixture.service.canDeliverItems(ORIN_FIELD_METHODS_QUEST_ID)).toBe(false)
    expect(fixture.service.deliverItems(ORIN_FIELD_METHODS_QUEST_ID)).toEqual({
      ok: false,
      reason: 'requirements-incomplete',
      deliveredItemIds: [],
      status: QUEST_STATUS.active,
    })
    expect(fixture.inventory.getQuantity(HEALING_TONIC_ID)).toBe(1)
  })

  it('consumes the delivery exactly once after all non-delivery objectives are complete', () => {
    const fixture = createService()
    completeThreeRoads(fixture)
    fixture.inventory.add(HEALING_TONIC_ID, 1)
    fixture.service.accept(ORIN_FIELD_METHODS_QUEST_ID)
    fixture.service.recordDefeat('skyrill', 2)
    fixture.service.recordCapture('rillfin')

    expect(fixture.service.canDeliverItems(ORIN_FIELD_METHODS_QUEST_ID)).toBe(true)
    expect(fixture.service.deliverItems(ORIN_FIELD_METHODS_QUEST_ID)).toEqual({
      ok: true,
      deliveredItemIds: [HEALING_TONIC_ID],
      status: QUEST_STATUS.readyToTurnIn,
    })
    expect(fixture.inventory.getQuantity(HEALING_TONIC_ID)).toBe(0)

    expect(fixture.service.deliverItems(ORIN_FIELD_METHODS_QUEST_ID)).toEqual({
      ok: false,
      reason: 'not-active',
      deliveredItemIds: [],
      status: QUEST_STATUS.readyToTurnIn,
    })
  })

  it('rejects turn-in before objectives are complete without granting credits', () => {
    const fixture = createService()
    fixture.service.accept(ORIN_THREE_ROADS_QUEST_ID)

    expect(fixture.service.turnIn(ORIN_THREE_ROADS_QUEST_ID)).toEqual({
      ok: false,
      status: QUEST_STATUS.active,
      rewardCredits: 0,
      rewardItems: [],
      rewardUnlocks: [],
      rewardApplied: false,
    })
    expect(fixture.wallet.balance).toBe(200)
  })

  it('grants each quest completion reward exactly once across reloads', () => {
    const fixture = createService()
    fixture.service.accept(ORIN_THREE_ROADS_QUEST_ID)
    for (const objective of ORIN_THREE_ROADS_QUEST.objectives) {
      fixture.service.recordSceneVisit(objective.scenePath)
    }

    expect(fixture.service.turnIn(ORIN_THREE_ROADS_QUEST_ID)).toEqual({
      ok: true,
      status: QUEST_STATUS.completed,
      rewardCredits: 120,
      rewardItems: [],
      rewardUnlocks: [],
      rewardApplied: true,
    })
    expect(fixture.wallet.balance).toBe(320)

    const reloadedWallet = new WalletStore(fixture.walletStorage)
    const reloadedInventory = new InventoryStore(fixture.inventoryStorage)
    const reloadedUnlocks = new UnlockStore(fixture.unlockStorage)
    const reloaded = new QuestService(
      new QuestStore(fixture.questStorage),
      new QuestRewardService(reloadedWallet, reloadedInventory, reloadedUnlocks),
      reloadedInventory,
    )
    expect(reloaded.turnIn(ORIN_THREE_ROADS_QUEST_ID)).toEqual({
      ok: true,
      status: QUEST_STATUS.completed,
      rewardCredits: 120,
      rewardItems: [],
      rewardUnlocks: [],
      rewardApplied: false,
    })
    expect(new WalletStore(fixture.walletStorage).balance).toBe(320)
  })

  it('restores delivered items if quest persistence fails after consumption', () => {
    const questStorage = new MemoryStorage()
    const walletStorage = new MemoryStorage()
    const inventoryStorage = new MemoryStorage()
    const store = new FailingDeliveryQuestStore(questStorage)
    const wallet = new WalletStore(walletStorage)
    const inventory = new InventoryStore(inventoryStorage)
    wallet.ensureStarterBalance(200)
    inventory.ensureStarterStock(0)
    const unlockStorage = new MemoryStorage()
    const unlocks = new UnlockStore(unlockStorage)
    const service = new QuestService(
      store,
      new QuestRewardService(wallet, inventory, unlocks),
      inventory,
    )
    const fixture: Fixture = {
      service,
      store,
      wallet,
      inventory,
      unlocks,
      questStorage,
      walletStorage,
      inventoryStorage,
      unlockStorage,
    }

    completeThreeRoads(fixture)
    inventory.add(HEALING_TONIC_ID, 1)
    service.accept(ORIN_FIELD_METHODS_QUEST_ID)
    service.recordDefeat('skyrill', 2)
    service.recordCapture('rillfin')

    store.failDelivery = true
    expect(() => service.deliverItems(ORIN_FIELD_METHODS_QUEST_ID))
      .toThrow('forced delivery persistence failure')
    expect(inventory.getQuantity(HEALING_TONIC_ID)).toBe(1)
    expect(
      service.getProgress(ORIN_FIELD_METHODS_QUEST_ID)
        .objectiveProgress['deliver-healing-tonic'],
    ).toBeUndefined()
  })

  it('Field Methods catalog contains all four advanced objective kinds', () => {
    expect(ORIN_FIELD_METHODS_QUEST.objectives.map((objective) => objective.kind)).toEqual([
      'defeat-species',
      'capture-species',
      'collect-item',
      'deliver-item',
    ])
  })

  it('grants the full Field Methods reward package exactly once', () => {
    const fixture = createService()
    completeThreeRoads(fixture)
    fixture.inventory.add(HEALING_TONIC_ID, 1)
    fixture.service.accept(ORIN_FIELD_METHODS_QUEST_ID)
    fixture.service.recordDefeat('skyrill', 2)
    fixture.service.recordCapture('rillfin')
    fixture.service.deliverItems(ORIN_FIELD_METHODS_QUEST_ID)

    expect(fixture.service.turnIn(ORIN_FIELD_METHODS_QUEST_ID)).toEqual({
      ok: true,
      status: QUEST_STATUS.completed,
      rewardCredits: 220,
      rewardItems: [{ itemId: CAPTURE_CAPSULE_ID, quantity: 2 }],
      rewardUnlocks: [FIELD_RESEARCH_CLEARANCE_ID],
      rewardApplied: true,
    })
    expect(fixture.wallet.balance).toBe(540)
    expect(fixture.inventory.getQuantity(CAPTURE_CAPSULE_ID)).toBe(2)
    expect(fixture.unlocks.has(FIELD_RESEARCH_CLEARANCE_ID)).toBe(true)

    expect(fixture.service.turnIn(ORIN_FIELD_METHODS_QUEST_ID).rewardApplied).toBe(false)
    expect(fixture.wallet.balance).toBe(540)
    expect(fixture.inventory.getQuantity(CAPTURE_CAPSULE_ID)).toBe(2)
  })


  it('reconciles missing composite components for an already-completed legacy reward', () => {
    const fixture = createService()
    completeThreeRoads(fixture)
    fixture.inventory.add(HEALING_TONIC_ID, 1)
    fixture.service.accept(ORIN_FIELD_METHODS_QUEST_ID)
    fixture.service.recordDefeat('skyrill', 2)
    fixture.service.recordCapture('rillfin')
    fixture.service.deliverItems(ORIN_FIELD_METHODS_QUEST_ID)

    expect(fixture.store.complete(ORIN_FIELD_METHODS_QUEST_ID)).toBe(true)
    expect(fixture.wallet.creditOnce(
      'quest:orin-field-methods:reward',
      220,
    ).applied).toBe(true)
    expect(fixture.wallet.balance).toBe(540)
    expect(fixture.inventory.getQuantity(CAPTURE_CAPSULE_ID)).toBe(0)
    expect(fixture.unlocks.has(FIELD_RESEARCH_CLEARANCE_ID)).toBe(false)

    const reloadedWallet = new WalletStore(fixture.walletStorage)
    const reloadedInventory = new InventoryStore(fixture.inventoryStorage)
    const reloadedUnlocks = new UnlockStore(fixture.unlockStorage)
    const reloaded = new QuestService(
      new QuestStore(fixture.questStorage),
      new QuestRewardService(reloadedWallet, reloadedInventory, reloadedUnlocks),
      reloadedInventory,
    )

    expect(reloaded.reconcileCompletedRewards().some((result) =>
      result.rewardUnlocks.includes(FIELD_RESEARCH_CLEARANCE_ID)
      && result.rewardApplied)).toBe(true)

    expect(reloadedWallet.balance).toBe(540)
    expect(reloadedInventory.getQuantity(CAPTURE_CAPSULE_ID)).toBe(2)
    expect(reloadedUnlocks.has(FIELD_RESEARCH_CLEARANCE_ID)).toBe(true)
  })


  it('keeps Baseline Samples locked until Field Methods is completed', () => {
    const fixture = createService()

    expect(fixture.service.isUnlocked(RESEARCH_BASELINE_SAMPLES_QUEST_ID)).toBe(false)
    expect(fixture.service.accept(RESEARCH_BASELINE_SAMPLES_QUEST_ID)).toBe(false)

    completeFieldMethods(fixture)

    expect(fixture.service.isUnlocked(RESEARCH_BASELINE_SAMPLES_QUEST_ID)).toBe(true)
    expect(fixture.service.accept(RESEARCH_BASELINE_SAMPLES_QUEST_ID)).toBe(true)
  })

  it('tracks all three research captures and grants the Baseline Samples reward once', () => {
    const fixture = createService()
    completeFieldMethods(fixture)
    fixture.service.accept(RESEARCH_BASELINE_SAMPLES_QUEST_ID)

    for (const objective of RESEARCH_BASELINE_SAMPLES_QUEST.objectives) {
      expect(objective.kind).toBe('capture-species')
      if (objective.kind === 'capture-species') {
        fixture.service.recordCapture(objective.speciesId)
      }
    }

    expect(fixture.service.getProgress(RESEARCH_BASELINE_SAMPLES_QUEST_ID)).toEqual({
      questId: RESEARCH_BASELINE_SAMPLES_QUEST_ID,
      status: QUEST_STATUS.readyToTurnIn,
      objectiveProgress: {
        'capture-glacub-sample': 1,
        'capture-miretoad-sample': 1,
        'capture-wispurr-sample': 1,
      },
    })

    expect(fixture.service.turnIn(RESEARCH_BASELINE_SAMPLES_QUEST_ID)).toEqual({
      ok: true,
      status: QUEST_STATUS.completed,
      rewardCredits: 300,
      rewardItems: [{ itemId: CAPTURE_CAPSULE_ID, quantity: 3 }],
      rewardUnlocks: [],
      rewardApplied: true,
    })
    expect(fixture.wallet.balance).toBe(840)
    expect(fixture.inventory.getQuantity(CAPTURE_CAPSULE_ID)).toBe(5)

    expect(fixture.service.turnIn(RESEARCH_BASELINE_SAMPLES_QUEST_ID).rewardApplied).toBe(false)
    expect(fixture.wallet.balance).toBe(840)
    expect(fixture.inventory.getQuantity(CAPTURE_CAPSULE_ID)).toBe(5)
  })

})
