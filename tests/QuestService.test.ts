import { describe, expect, it } from 'vitest'
import { WalletStore } from '../src/game/economy/WalletStore'
import { ORIN_THREE_ROADS_QUEST } from '../src/game/quests/catalog'
import { QuestService } from '../src/game/quests/QuestService'
import { QuestStore } from '../src/game/quests/QuestStore'
import { ORIN_THREE_ROADS_QUEST_ID } from '../src/game/quests/types'

class MemoryStorage {
  readonly data = new Map<string, string>()
  getItem(key: string): string | null { return this.data.get(key) ?? null }
  setItem(key: string, value: string): void { this.data.set(key, value) }
  removeItem(key: string): void { this.data.delete(key) }
}

function createService(
  questStorage = new MemoryStorage(),
  walletStorage = new MemoryStorage(),
): { service: QuestService; store: QuestStore; wallet: WalletStore } {
  const store = new QuestStore(questStorage)
  const wallet = new WalletStore(walletStorage)
  wallet.ensureStarterBalance(200)
  return { service: new QuestService(store, wallet), store, wallet }
}

describe('QuestService', () => {
  it('records scene visits only after the quest is active', () => {
    const { service } = createService()
    const coast = ORIN_THREE_ROADS_QUEST.objectives[0]

    expect(service.recordSceneVisit(coast.scenePath)).toEqual([])
    service.accept(ORIN_THREE_ROADS_QUEST_ID)

    expect(service.recordSceneVisit(coast.scenePath)).toEqual([{
      questId: ORIN_THREE_ROADS_QUEST_ID,
      objectiveId: coast.id,
      status: 'active',
    }])
  })

  it('ignores scenes that are not quest objectives', () => {
    const { service } = createService()
    service.accept(ORIN_THREE_ROADS_QUEST_ID)

    expect(service.recordSceneVisit('res://Town.tscn')).toEqual([])
    expect(service.getProgress(ORIN_THREE_ROADS_QUEST_ID).completedObjectiveIds).toEqual([])
  })

  it('moves to ready-to-turn-in after visiting all three configured biomes', () => {
    const { service } = createService()
    service.accept(ORIN_THREE_ROADS_QUEST_ID)

    for (const objective of ORIN_THREE_ROADS_QUEST.objectives) {
      service.recordSceneVisit(objective.scenePath)
    }

    expect(service.getProgress(ORIN_THREE_ROADS_QUEST_ID)).toEqual({
      questId: ORIN_THREE_ROADS_QUEST_ID,
      status: 'ready-to-turn-in',
      completedObjectiveIds: ORIN_THREE_ROADS_QUEST.objectives.map((objective) => objective.id),
    })
  })

  it('rejects turn-in before objectives are complete without granting credits', () => {
    const { service, wallet } = createService()
    service.accept(ORIN_THREE_ROADS_QUEST_ID)

    expect(service.turnIn(ORIN_THREE_ROADS_QUEST_ID)).toEqual({
      ok: false,
      status: 'active',
      rewardCredits: 0,
      rewardApplied: false,
    })
    expect(wallet.balance).toBe(200)
  })

  it('grants the completion reward exactly once across repeated turn-ins', () => {
    const questStorage = new MemoryStorage()
    const walletStorage = new MemoryStorage()
    const { service, wallet } = createService(questStorage, walletStorage)
    service.accept(ORIN_THREE_ROADS_QUEST_ID)
    for (const objective of ORIN_THREE_ROADS_QUEST.objectives) {
      service.recordSceneVisit(objective.scenePath)
    }

    expect(service.turnIn(ORIN_THREE_ROADS_QUEST_ID)).toEqual({
      ok: true,
      status: 'completed',
      rewardCredits: 120,
      rewardApplied: true,
    })
    expect(wallet.balance).toBe(320)

    const reloaded = new QuestService(
      new QuestStore(questStorage),
      new WalletStore(walletStorage),
    )
    expect(reloaded.turnIn(ORIN_THREE_ROADS_QUEST_ID)).toEqual({
      ok: true,
      status: 'completed',
      rewardCredits: 120,
      rewardApplied: false,
    })
    expect(new WalletStore(walletStorage).balance).toBe(320)
  })
})
