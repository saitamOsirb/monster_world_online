import { describe, expect, it } from 'vitest'
import { QuestStore } from '../src/game/quests/QuestStore'
import { ORIN_THREE_ROADS_QUEST_ID } from '../src/game/quests/types'

class MemoryStorage {
  readonly data = new Map<string, string>()
  getItem(key: string): string | null { return this.data.get(key) ?? null }
  setItem(key: string, value: string): void { this.data.set(key, value) }
  removeItem(key: string): void { this.data.delete(key) }
}

const OBJECTIVES = ['coast', 'cavern', 'marsh'] as const

describe('QuestStore', () => {
  it('starts quests as available and persists acceptance', () => {
    const storage = new MemoryStorage()
    const store = new QuestStore(storage)

    expect(store.getProgress(ORIN_THREE_ROADS_QUEST_ID).status).toBe('available')
    expect(store.accept(ORIN_THREE_ROADS_QUEST_ID)).toBe(true)
    expect(store.accept(ORIN_THREE_ROADS_QUEST_ID)).toBe(false)

    expect(new QuestStore(storage).getProgress(ORIN_THREE_ROADS_QUEST_ID)).toEqual({
      questId: ORIN_THREE_ROADS_QUEST_ID,
      status: 'active',
      completedObjectiveIds: [],
    })
  })

  it('records unique objectives and becomes ready only after all required objectives', () => {
    const store = new QuestStore(new MemoryStorage())
    store.accept(ORIN_THREE_ROADS_QUEST_ID)

    expect(store.recordObjective(ORIN_THREE_ROADS_QUEST_ID, 'coast', OBJECTIVES)).toBe(true)
    expect(store.getProgress(ORIN_THREE_ROADS_QUEST_ID).status).toBe('active')
    expect(store.recordObjective(ORIN_THREE_ROADS_QUEST_ID, 'cavern', OBJECTIVES)).toBe(true)
    expect(store.getProgress(ORIN_THREE_ROADS_QUEST_ID).status).toBe('active')
    expect(store.recordObjective(ORIN_THREE_ROADS_QUEST_ID, 'marsh', OBJECTIVES)).toBe(true)
    expect(store.getProgress(ORIN_THREE_ROADS_QUEST_ID).status).toBe('ready-to-turn-in')
  })

  it('ignores duplicate objectives without changing persisted progress', () => {
    const store = new QuestStore(new MemoryStorage())
    store.accept(ORIN_THREE_ROADS_QUEST_ID)

    expect(store.recordObjective(ORIN_THREE_ROADS_QUEST_ID, 'coast', OBJECTIVES)).toBe(true)
    expect(store.recordObjective(ORIN_THREE_ROADS_QUEST_ID, 'coast', OBJECTIVES)).toBe(false)
    expect(store.getProgress(ORIN_THREE_ROADS_QUEST_ID).completedObjectiveIds).toEqual(['coast'])
  })

  it('does not record exploration before the quest is accepted', () => {
    const store = new QuestStore(new MemoryStorage())

    expect(store.recordObjective(ORIN_THREE_ROADS_QUEST_ID, 'coast', OBJECTIVES)).toBe(false)
    expect(store.getProgress(ORIN_THREE_ROADS_QUEST_ID).status).toBe('available')
  })

  it('completes only a quest that is ready to turn in', () => {
    const storage = new MemoryStorage()
    const store = new QuestStore(storage)
    store.accept(ORIN_THREE_ROADS_QUEST_ID)

    expect(store.complete(ORIN_THREE_ROADS_QUEST_ID)).toBe(false)
    for (const objective of OBJECTIVES) {
      store.recordObjective(ORIN_THREE_ROADS_QUEST_ID, objective, OBJECTIVES)
    }

    expect(store.complete(ORIN_THREE_ROADS_QUEST_ID)).toBe(true)
    expect(store.complete(ORIN_THREE_ROADS_QUEST_ID)).toBe(false)
    expect(new QuestStore(storage).getProgress(ORIN_THREE_ROADS_QUEST_ID).status).toBe('completed')
  })

  it('recovers safely from corrupt persisted quest state', () => {
    const storage = new MemoryStorage()
    storage.setItem('monster-world.quests.v1', JSON.stringify({
      version: 1,
      quests: {
        [ORIN_THREE_ROADS_QUEST_ID]: {
          questId: ORIN_THREE_ROADS_QUEST_ID,
          status: 'broken',
          completedObjectiveIds: [],
        },
      },
    }))

    expect(new QuestStore(storage).getProgress(ORIN_THREE_ROADS_QUEST_ID).status).toBe('available')
  })
})
