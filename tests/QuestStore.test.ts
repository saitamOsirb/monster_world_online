import { describe, expect, it } from 'vitest'
import { QuestStore } from '../src/game/quests/QuestStore'
import {
  ORIN_FIELD_METHODS_QUEST_ID,
  ORIN_THREE_ROADS_QUEST_ID,
  QUEST_STATUS,
} from '../src/game/quests/types'

class MemoryStorage {
  readonly data = new Map<string, string>()
  getItem(key: string): string | null { return this.data.get(key) ?? null }
  setItem(key: string, value: string): void { this.data.set(key, value) }
  removeItem(key: string): void { this.data.delete(key) }
}

const REQUIREMENTS = {
  coast: 1,
  cavern: 1,
  marsh: 1,
} as const

describe('QuestStore', () => {
  it('starts quests as available and persists acceptance in v2', () => {
    const storage = new MemoryStorage()
    const store = new QuestStore(storage)

    expect(store.getProgress(ORIN_THREE_ROADS_QUEST_ID)).toEqual({
      questId: ORIN_THREE_ROADS_QUEST_ID,
      status: QUEST_STATUS.available,
      objectiveProgress: {},
    })

    expect(store.accept(ORIN_THREE_ROADS_QUEST_ID)).toBe(true)
    expect(store.accept(ORIN_THREE_ROADS_QUEST_ID)).toBe(false)

    expect(new QuestStore(storage).getProgress(ORIN_THREE_ROADS_QUEST_ID)).toEqual({
      questId: ORIN_THREE_ROADS_QUEST_ID,
      status: QUEST_STATUS.active,
      objectiveProgress: {},
    })
    expect(JSON.parse(storage.getItem('monster-world.quests.v1') ?? '{}').version).toBe(2)
  })

  it('increments objective progress quantitatively and caps at the target', () => {
    const store = new QuestStore(new MemoryStorage())
    store.accept(ORIN_FIELD_METHODS_QUEST_ID)

    const requirements = { defeat: 2, capture: 1 }
    expect(store.recordObjectiveProgress(
      ORIN_FIELD_METHODS_QUEST_ID,
      'defeat',
      1,
      requirements,
    )).toBe(true)
    expect(store.getProgress(ORIN_FIELD_METHODS_QUEST_ID).objectiveProgress.defeat).toBe(1)

    expect(store.recordObjectiveProgress(
      ORIN_FIELD_METHODS_QUEST_ID,
      'defeat',
      10,
      requirements,
    )).toBe(true)
    expect(store.getProgress(ORIN_FIELD_METHODS_QUEST_ID).objectiveProgress.defeat).toBe(2)

    expect(store.recordObjectiveProgress(
      ORIN_FIELD_METHODS_QUEST_ID,
      'defeat',
      1,
      requirements,
    )).toBe(false)
  })

  it('becomes ready only when every objective reaches its required quantity', () => {
    const store = new QuestStore(new MemoryStorage())
    store.accept(ORIN_THREE_ROADS_QUEST_ID)

    expect(store.recordObjectiveProgress(
      ORIN_THREE_ROADS_QUEST_ID,
      'coast',
      1,
      REQUIREMENTS,
    )).toBe(true)
    expect(store.getProgress(ORIN_THREE_ROADS_QUEST_ID).status).toBe(QUEST_STATUS.active)

    store.recordObjectiveProgress(ORIN_THREE_ROADS_QUEST_ID, 'cavern', 1, REQUIREMENTS)
    expect(store.getProgress(ORIN_THREE_ROADS_QUEST_ID).status).toBe(QUEST_STATUS.active)

    store.recordObjectiveProgress(ORIN_THREE_ROADS_QUEST_ID, 'marsh', 1, REQUIREMENTS)
    expect(store.getProgress(ORIN_THREE_ROADS_QUEST_ID).status)
      .toBe(QUEST_STATUS.readyToTurnIn)
  })

  it('does not record objective progress before a quest is accepted', () => {
    const store = new QuestStore(new MemoryStorage())

    expect(store.recordObjectiveProgress(
      ORIN_THREE_ROADS_QUEST_ID,
      'coast',
      1,
      REQUIREMENTS,
    )).toBe(false)
    expect(store.getProgress(ORIN_THREE_ROADS_QUEST_ID).objectiveProgress).toEqual({})
  })

  it('completes only a quest that is ready to turn in', () => {
    const storage = new MemoryStorage()
    const store = new QuestStore(storage)
    store.accept(ORIN_THREE_ROADS_QUEST_ID)

    expect(store.complete(ORIN_THREE_ROADS_QUEST_ID)).toBe(false)

    for (const objectiveId of Object.keys(REQUIREMENTS)) {
      store.recordObjectiveProgress(
        ORIN_THREE_ROADS_QUEST_ID,
        objectiveId,
        1,
        REQUIREMENTS,
      )
    }

    expect(store.complete(ORIN_THREE_ROADS_QUEST_ID)).toBe(true)
    expect(store.complete(ORIN_THREE_ROADS_QUEST_ID)).toBe(false)
    expect(new QuestStore(storage).getProgress(ORIN_THREE_ROADS_QUEST_ID).status)
      .toBe(QUEST_STATUS.completed)
  })

  it('migrates valid v1 completed objectives to v2 counts without losing progress', () => {
    const storage = new MemoryStorage()
    storage.setItem('monster-world.quests.v1', JSON.stringify({
      version: 1,
      quests: {
        [ORIN_THREE_ROADS_QUEST_ID]: {
          questId: ORIN_THREE_ROADS_QUEST_ID,
          status: QUEST_STATUS.active,
          completedObjectiveIds: ['visit-tidewater-coast', 'visit-frosthollow-cavern'],
        },
      },
    }))

    const store = new QuestStore(storage)

    expect(store.getProgress(ORIN_THREE_ROADS_QUEST_ID)).toEqual({
      questId: ORIN_THREE_ROADS_QUEST_ID,
      status: QUEST_STATUS.active,
      objectiveProgress: {
        'visit-tidewater-coast': 1,
        'visit-frosthollow-cavern': 1,
      },
    })
    expect(JSON.parse(storage.getItem('monster-world.quests.v1') ?? '{}').version).toBe(2)
  })

  it('recovers safely from corrupt persisted quest state', () => {
    const storage = new MemoryStorage()
    storage.setItem('monster-world.quests.v1', JSON.stringify({
      version: 2,
      quests: {
        [ORIN_THREE_ROADS_QUEST_ID]: {
          questId: ORIN_THREE_ROADS_QUEST_ID,
          status: 'broken',
          objectiveProgress: {},
        },
      },
    }))

    expect(new QuestStore(storage).getProgress(ORIN_THREE_ROADS_QUEST_ID).status)
      .toBe(QUEST_STATUS.available)
  })
})
