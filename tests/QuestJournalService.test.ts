import { describe, expect, it } from 'vitest'
import { WalletStore } from '../src/game/economy/WalletStore'
import { InventoryStore } from '../src/game/inventory/InventoryStore'
import {
  ORIN_THREE_ROADS_QUEST,
} from '../src/game/quests/catalog'
import { QuestJournalService } from '../src/game/quests/QuestJournalService'
import { QuestRewardService } from '../src/game/quests/QuestRewardService'
import { QuestService } from '../src/game/quests/QuestService'
import { QuestStore } from '../src/game/quests/QuestStore'
import {
  ORIN_FIELD_METHODS_QUEST_ID,
  ORIN_THREE_ROADS_QUEST_ID,
  QUEST_STATUS,
} from '../src/game/quests/types'
import { UnlockStore } from '../src/game/unlocks/UnlockStore'

class MemoryStorage {
  readonly data = new Map<string, string>()
  getItem(key: string): string | null { return this.data.get(key) ?? null }
  setItem(key: string, value: string): void { this.data.set(key, value) }
  removeItem(key: string): void { this.data.delete(key) }
}

function setup(): {
  quests: QuestService
  journal: QuestJournalService
  inventory: InventoryStore
} {
  const questStore = new QuestStore(new MemoryStorage())
  const wallet = new WalletStore(new MemoryStorage())
  const inventory = new InventoryStore(new MemoryStorage())
  const unlocks = new UnlockStore(new MemoryStorage())
  wallet.ensureStarterBalance(200)
  inventory.ensureStarterStock(0)
  const quests = new QuestService(
    questStore,
    new QuestRewardService(wallet, inventory, unlocks),
    inventory,
  )
  return {
    quests,
    journal: new QuestJournalService(quests),
    inventory,
  }
}

function completeThreeRoads(quests: QuestService): void {
  quests.accept(ORIN_THREE_ROADS_QUEST_ID)
  for (const objective of ORIN_THREE_ROADS_QUEST.objectives) {
    quests.recordSceneVisit(objective.scenePath)
  }
  quests.turnIn(ORIN_THREE_ROADS_QUEST_ID)
}

describe('QuestJournalService', () => {
  it('hides quests that have not been accepted yet', () => {
    const { journal } = setup()

    expect(journal.getSnapshot()).toEqual({
      active: [],
      completed: [],
    })
  })

  it('projects active visit objectives and reward metadata', () => {
    const { quests, journal } = setup()
    quests.accept(ORIN_THREE_ROADS_QUEST_ID)
    quests.recordSceneVisit(ORIN_THREE_ROADS_QUEST.objectives[0].scenePath)

    const snapshot = journal.getSnapshot()
    expect(snapshot.completed).toEqual([])
    expect(snapshot.active).toHaveLength(1)
    expect(snapshot.active[0]).toMatchObject({
      questId: ORIN_THREE_ROADS_QUEST_ID,
      title: 'The Three Roads',
      status: QUEST_STATUS.active,
      completedObjectives: 1,
      totalObjectives: 3,
      rewardCredits: 120,
      rewardText: '120 credits',
      rewardComponentCount: 1,
    })
    expect(snapshot.active[0].objectives.map((objective) => ({
      current: objective.current,
      required: objective.required,
      completed: objective.completed,
    }))).toEqual([
      { current: 1, required: 1, completed: true },
      { current: 0, required: 1, completed: false },
      { current: 0, required: 1, completed: false },
    ])
  })

  it('keeps a ready-to-turn-in quest in the active tab', () => {
    const { quests, journal } = setup()
    quests.accept(ORIN_THREE_ROADS_QUEST_ID)
    for (const objective of ORIN_THREE_ROADS_QUEST.objectives) {
      quests.recordSceneVisit(objective.scenePath)
    }

    expect(journal.getSnapshot().active[0]).toMatchObject({
      status: QUEST_STATUS.readyToTurnIn,
      completedObjectives: 3,
      totalObjectives: 3,
    })
    expect(journal.getSnapshot().completed).toEqual([])
  })

  it('moves completed quests to the completed tab', () => {
    const { quests, journal } = setup()
    completeThreeRoads(quests)

    const snapshot = journal.getSnapshot()
    expect(snapshot.active).toEqual([])
    expect(snapshot.completed[0]).toMatchObject({
      questId: ORIN_THREE_ROADS_QUEST_ID,
      status: QUEST_STATUS.completed,
      completedObjectives: 3,
      rewardCredits: 120,
    })
  })

  it('shows quantitative progress for advanced objectives', () => {
    const { quests, journal } = setup()
    completeThreeRoads(quests)
    quests.accept(ORIN_FIELD_METHODS_QUEST_ID)
    quests.recordDefeat('skyrill')

    const entry = journal.getSnapshot().active[0]
    expect(entry).toMatchObject({
      questId: ORIN_FIELD_METHODS_QUEST_ID,
      title: 'Field Methods',
      completedObjectives: 0,
      totalObjectives: 4,
      rewardCredits: 220,
      rewardText: '220 credits + 2 Capture Capsules + Field Research Clearance',
      rewardComponentCount: 3,
    })
    expect(entry.objectives[0]).toMatchObject({
      id: 'defeat-skyrill',
      current: 1,
      required: 2,
      completed: false,
    })
  })

  it('returns fresh progress on every snapshot without caching UI state', () => {
    const { quests, journal } = setup()
    quests.accept(ORIN_THREE_ROADS_QUEST_ID)

    expect(journal.getSnapshot().active[0].completedObjectives).toBe(0)

    quests.recordSceneVisit(ORIN_THREE_ROADS_QUEST.objectives[0].scenePath)
    expect(journal.getSnapshot().active[0].completedObjectives).toBe(1)

    quests.recordSceneVisit(ORIN_THREE_ROADS_QUEST.objectives[1].scenePath)
    expect(journal.getSnapshot().active[0].completedObjectives).toBe(2)
  })
})
