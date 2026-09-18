import {
  ORIN_THREE_ROADS_QUEST_ID,
  QUEST_IDS,
  QUEST_STATUS,
  type LegacyQuestProgress,
  type LegacyQuestState,
  type QuestId,
  type QuestProgress,
  type QuestState,
  type QuestStatus,
} from './types'

const PERSISTED_QUEST_STATUSES: ReadonlySet<QuestStatus> = new Set([
  QUEST_STATUS.active,
  QUEST_STATUS.readyToTurnIn,
  QUEST_STATUS.completed,
])

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
          objectiveProgress: {},
        }
  }

  accept(questId: QuestId): boolean {
    const current = this.getProgress(questId)
    if (current.status !== QUEST_STATUS.available) return false

    this.state.quests[questId] = {
      questId,
      status: QUEST_STATUS.active,
      objectiveProgress: {},
    }
    this.persist()
    return true
  }

  recordObjectiveProgress(
    questId: QuestId,
    objectiveId: string,
    increment: number,
    requiredByObjective: Readonly<Record<string, number>>,
  ): boolean {
    this.assertProgressIncrement(increment)
    this.assertObjectiveRequirements(requiredByObjective)

    const required = requiredByObjective[objectiveId]
    if (!required) {
      throw new Error(`Unknown objective "${objectiveId}" for quest "${questId}"`)
    }

    const current = this.getProgress(questId)
    if (current.status !== QUEST_STATUS.active) return false

    const previous = current.objectiveProgress[objectiveId] ?? 0
    const next = Math.min(required, previous + increment)
    if (next === previous) return false

    const objectiveProgress = {
      ...current.objectiveProgress,
      [objectiveId]: next,
    }
    const ready = Object.entries(requiredByObjective)
      .every(([id, target]) => (objectiveProgress[id] ?? 0) >= target)

    this.state.quests[questId] = {
      questId,
      status: ready ? QUEST_STATUS.readyToTurnIn : QUEST_STATUS.active,
      objectiveProgress,
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
      objectiveProgress: { ...current.objectiveProgress },
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
      if (this.isQuestState(parsed)) return this.cloneState(parsed)
      if (this.isLegacyQuestState(parsed)) {
        const migrated = this.migrateLegacyState(parsed)
        this.storage.setItem(this.storageKey, JSON.stringify(migrated))
        return migrated
      }
      return this.emptyState()
    } catch {
      return this.emptyState()
    }
  }

  private persist(): void {
    this.storage.setItem(this.storageKey, JSON.stringify(this.state))
  }

  private emptyState(): QuestState {
    return { version: 2, quests: {} }
  }

  private cloneState(state: QuestState): QuestState {
    const quests: QuestState['quests'] = {}
    for (const questId of QUEST_IDS) {
      const progress = state.quests[questId]
      if (progress) quests[questId] = this.cloneProgress(progress)
    }
    return { version: 2, quests }
  }

  private cloneProgress(progress: QuestProgress): QuestProgress {
    return {
      questId: progress.questId,
      status: progress.status,
      objectiveProgress: { ...progress.objectiveProgress },
    }
  }

  private migrateLegacyState(state: LegacyQuestState): QuestState {
    const legacy = state.quests[ORIN_THREE_ROADS_QUEST_ID]
    if (!legacy) return this.emptyState()

    return {
      version: 2,
      quests: {
        [ORIN_THREE_ROADS_QUEST_ID]: this.migrateLegacyProgress(legacy),
      },
    }
  }

  private migrateLegacyProgress(progress: LegacyQuestProgress): QuestProgress {
    return {
      questId: ORIN_THREE_ROADS_QUEST_ID,
      status: progress.status,
      objectiveProgress: Object.fromEntries(
        progress.completedObjectiveIds.map((objectiveId) => [objectiveId, 1]),
      ),
    }
  }

  private isQuestState(value: unknown): value is QuestState {
    if (!value || typeof value !== 'object') return false
    const candidate = value as Partial<QuestState>
    if (candidate.version !== 2 || !candidate.quests || typeof candidate.quests !== 'object') {
      return false
    }

    const entries = Object.entries(candidate.quests)
    return entries.every(([questId, progress]) =>
      this.isQuestId(questId) && this.isQuestProgress(questId, progress))
  }

  private isLegacyQuestState(value: unknown): value is LegacyQuestState {
    if (!value || typeof value !== 'object') return false
    const candidate = value as Partial<LegacyQuestState>
    if (candidate.version !== 1 || !candidate.quests || typeof candidate.quests !== 'object') {
      return false
    }

    const entries = Object.entries(candidate.quests)
    return entries.every(([questId, progress]) =>
      questId === ORIN_THREE_ROADS_QUEST_ID && this.isLegacyQuestProgress(progress))
  }

  private isLegacyQuestProgress(value: unknown): value is LegacyQuestProgress {
    if (!value || typeof value !== 'object') return false
    const progress = value as Partial<LegacyQuestProgress>
    return progress.questId === ORIN_THREE_ROADS_QUEST_ID
      && this.isPersistedQuestStatus(progress.status)
      && Array.isArray(progress.completedObjectiveIds)
      && progress.completedObjectiveIds.every((id) => typeof id === 'string' && id.length > 0)
      && new Set(progress.completedObjectiveIds).size === progress.completedObjectiveIds.length
  }

  private isQuestId(value: string): value is QuestId {
    return QUEST_IDS.some((questId) => questId === value)
  }

  private isPersistedQuestStatus(value: unknown): value is QuestStatus {
    return value === QUEST_STATUS.active
      || value === QUEST_STATUS.readyToTurnIn
      || value === QUEST_STATUS.completed
  }

  private isQuestProgress(questId: QuestId, value: unknown): value is QuestProgress {
    if (!value || typeof value !== 'object') return false
    const progress = value as Partial<QuestProgress>
    if (progress.questId !== questId) return false
    if (!progress.status || !PERSISTED_QUEST_STATUSES.has(progress.status)) return false
    if (!progress.objectiveProgress || typeof progress.objectiveProgress !== 'object') return false

    return Object.entries(progress.objectiveProgress).every(([objectiveId, count]) =>
      objectiveId.length > 0
      && typeof count === 'number'
      && Number.isSafeInteger(count)
      && count >= 0)
  }

  private assertProgressIncrement(increment: number): void {
    if (!Number.isSafeInteger(increment) || increment <= 0) {
      throw new Error('Quest objective progress increment must be a positive integer')
    }
  }

  private assertObjectiveRequirements(requiredByObjective: Readonly<Record<string, number>>): void {
    const entries = Object.entries(requiredByObjective)
    if (
      entries.length === 0
      || entries.some(([id, target]) =>
        id.trim().length === 0
        || !Number.isSafeInteger(target)
        || target <= 0)
    ) {
      throw new Error('Quest objective requirements must use non-empty ids and positive integer targets')
    }
  }
}
