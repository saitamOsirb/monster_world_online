import { describe, expect, it } from 'vitest'
import { WalletStore } from '../src/game/economy/WalletStore'
import { ORIN_THREE_ROADS_QUEST } from '../src/game/quests/catalog'
import { QuestJournalService } from '../src/game/quests/QuestJournalService'
import { QuestService } from '../src/game/quests/QuestService'
import { QuestStore } from '../src/game/quests/QuestStore'
import { ORIN_THREE_ROADS_QUEST_ID, QUEST_STATUS } from '../src/game/quests/types'

class MemoryStorage {
  readonly data = new Map<string, string>()
  getItem(key: string): string | null { return this.data.get(key) ?? null }
  setItem(key: string, value: string): void { this.data.set(key, value) }
  removeItem(key: string): void { this.data.delete(key) }
}

function setup(): {
  quests: QuestService
  journal: QuestJournalService
} {
  const questStore = new QuestStore(new MemoryStorage())
  const wallet = new WalletStore(new MemoryStorage())
  wallet.ensureStarterBalance(200)
  const quests = new QuestService(questStore, wallet)
  return {
    quests,
    journal: new QuestJournalService(quests),
  }
}

describe('QuestJournalService', () => {
  it('hides quests that have not been accepted yet', () => {
    const { journal } = setup()

    expect(journal.getSnapshot()).toEqual({
      active: [],
      completed: [],
    })
  })

  it('projects active quest objectives and reward metadata', () => {
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
    })
    expect(snapshot.active[0].objectives.map((objective) => objective.completed)).toEqual([
      true,
      false,
      false,
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
    quests.accept(ORIN_THREE_ROADS_QUEST_ID)
    for (const objective of ORIN_THREE_ROADS_QUEST.objectives) {
      quests.recordSceneVisit(objective.scenePath)
    }
    quests.turnIn(ORIN_THREE_ROADS_QUEST_ID)

    const snapshot = journal.getSnapshot()
    expect(snapshot.active).toEqual([])
    expect(snapshot.completed[0]).toMatchObject({
      questId: ORIN_THREE_ROADS_QUEST_ID,
      status: QUEST_STATUS.completed,
      completedObjectives: 3,
      rewardCredits: 120,
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
