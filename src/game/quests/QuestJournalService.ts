import { QUEST_CATALOG } from './catalog'
import { QuestService } from './QuestService'
import { QUEST_STATUS, type QuestId, type QuestStatus } from './types'

export interface QuestJournalObjective {
  id: string
  description: string
  current: number
  required: number
  completed: boolean
}

export interface QuestJournalEntry {
  questId: QuestId
  title: string
  status: QuestStatus
  completedObjectives: number
  totalObjectives: number
  rewardCredits: number
  objectives: readonly QuestJournalObjective[]
}

export interface QuestJournalSnapshot {
  active: readonly QuestJournalEntry[]
  completed: readonly QuestJournalEntry[]
}

export class QuestJournalService {
  constructor(private readonly quests: QuestService) {}

  getSnapshot(): QuestJournalSnapshot {
    const active: QuestJournalEntry[] = []
    const completed: QuestJournalEntry[] = []

    for (const definition of Object.values(QUEST_CATALOG)) {
      const progress = this.quests.getProgress(definition.id)
      if (progress.status === QUEST_STATUS.available) continue

      const objectives = definition.objectives.map((objective) => {
        const current = Math.min(
          objective.required,
          progress.objectiveProgress[objective.id] ?? 0,
        )
        return {
          id: objective.id,
          description: objective.description,
          current,
          required: objective.required,
          completed: current >= objective.required,
        }
      })

      const entry: QuestJournalEntry = {
        questId: definition.id,
        title: definition.title,
        status: progress.status,
        completedObjectives: objectives.filter((objective) => objective.completed).length,
        totalObjectives: objectives.length,
        rewardCredits: definition.rewardCredits,
        objectives,
      }

      if (progress.status === QUEST_STATUS.completed) completed.push(entry)
      else active.push(entry)
    }

    return {
      active: this.sortEntries(active),
      completed: this.sortEntries(completed),
    }
  }

  private sortEntries(entries: readonly QuestJournalEntry[]): readonly QuestJournalEntry[] {
    return [...entries].sort((left, right) => left.title.localeCompare(right.title))
  }
}
