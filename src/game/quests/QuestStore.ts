import { ORIN_THREE_ROADS_QUEST_ID, QUEST_STATUS, type QuestId, type QuestProgress, type QuestState } from './types'

const DEFAULT_KEY = 'monster-world.quests.v1'

export class QuestStore {
  private state: QuestState

  constructor(
    private readonly storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = window.localStorage,
    private readonly storageKey = DEFAULT_KEY,
  ) {
    this.state = this.load()
  }

  get snapshot(): QuestState {
    return this.cloneState(this.state)
  }

  getProgress(questId: QuestId): QuestProgress {
    const progress = this.state.quests[questId]
    return progress
      ? this.cloneProgress(progress)
      : {
          questId,
          status: QUEST_STATUS.available,
          completedObjectiveIds: [],
        }
  }

  accept(questId: QuestId): boolean {
    const current = this.getProgress(questId)
    if (current.status !== QUEST_STATUS.available) return false

    this.state.quests[questId] = {
      questId,
      status: QUEST_STATUS.active,
      completedObjectiveIds: [],
    }
    this.persist()
    return true
  }

  recordObjective(
    questId: QuestId,
    objectiveId: string,
    requiredObjectiveIds: readonly string[],
  ): boolean {
    this.assertObjectiveIds(requiredObjectiveIds)
    if (!requiredObjectiveIds.includes(objectiveId)) {
      throw new Error(`Unknown objective "${objectiveId}" for quest "${questId}"`)
    }

    const current = this.getProgress(questId)
    if (current.status !== QUEST_STATUS.active) return false
    if (current.completedObjectiveIds.includes(objectiveId)) return false

    const completedObjectiveIds = [...current.completedObjectiveIds, objectiveId]
    const ready = requiredObjectiveIds.every((id) => completedObjectiveIds.includes(id))

    this.state.quests[questId] = {
      questId,
      status: ready ? QUEST_STATUS.readyToTurnIn : QUEST_STATUS.active,
      completedObjectiveIds,
    }
    this.persist()
    return true
  }

  complete(questId: QuestId): boolean {
    const current = this.getProgress(questId)
    if (current.status !== QUEST_STATUS.readyToTurnIn) return false

    this.state.quests[questId] = {
      ...current,
      status: QUEST_STATUS.completed,
      completedObjectiveIds: [...current.completedObjectiveIds],
    }
    this.persist()
    return true
  }

  clear(): void {
    this.state = this.emptyState()
    this.storage.removeItem(this.storageKey)
  }

  private load(): QuestState {
    const raw = this.storage.getItem(this.storageKey)
    if (!raw) return this.emptyState()

    try {
      const parsed = JSON.parse(raw) as unknown
      if (!this.isQuestState(parsed)) return this.emptyState()
      return this.cloneState(parsed)
    } catch {
      return this.emptyState()
    }
  }

  private persist(): void {
    this.storage.setItem(this.storageKey, JSON.stringify(this.state))
  }

  private emptyState(): QuestState {
    return { version: 1, quests: {} }
  }

  private cloneState(state: QuestState): QuestState {
    const quests: QuestState['quests'] = {}
    const progress = state.quests[ORIN_THREE_ROADS_QUEST_ID]
    if (progress) quests[ORIN_THREE_ROADS_QUEST_ID] = this.cloneProgress(progress)
    return { version: 1, quests }
  }

  private cloneProgress(progress: QuestProgress): QuestProgress {
    return {
      questId: progress.questId,
      status: progress.status,
      completedObjectiveIds: [...progress.completedObjectiveIds],
    }
  }

  private isQuestState(value: unknown): value is QuestState {
    if (!value || typeof value !== 'object') return false
    const candidate = value as Partial<QuestState>
    if (candidate.version !== 1 || !candidate.quests || typeof candidate.quests !== 'object') {
      return false
    }

    const entries = Object.entries(candidate.quests)
    if (entries.some(([questId]) => questId !== ORIN_THREE_ROADS_QUEST_ID)) return false

    return entries.every(([questId, progress]) =>
      this.isQuestProgress(questId as QuestId, progress))
  }

  private isQuestProgress(questId: QuestId, value: unknown): value is QuestProgress {
    if (!value || typeof value !== 'object') return false
    const progress = value as Partial<QuestProgress>
    if (progress.questId !== questId) return false
    if (
      progress.status !== QUEST_STATUS.active
      && progress.status !== QUEST_STATUS.readyToTurnIn
      && progress.status !== QUEST_STATUS.completed
    ) {
      return false
    }
    return Array.isArray(progress.completedObjectiveIds)
      && progress.completedObjectiveIds.every((id) => typeof id === 'string' && id.length > 0)
      && new Set(progress.completedObjectiveIds).size === progress.completedObjectiveIds.length
  }

  private assertObjectiveIds(objectiveIds: readonly string[]): void {
    if (
      objectiveIds.length === 0
      || objectiveIds.some((id) => id.trim().length === 0)
      || new Set(objectiveIds).size !== objectiveIds.length
    ) {
      throw new Error('Quest objective ids must be unique non-empty strings')
    }
  }
}
